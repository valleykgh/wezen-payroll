#!/usr/bin/env bash
set -Eeuo pipefail

AWS_REGION="us-west-1"
AWS_ACCOUNT_ID="211125653940"

CLUSTER_NAME="wezen-payroll-cluster"
SERVICE_NAME="wezen-staffing-web-service"
TASK_FAMILY="wezen-staffing-web-task"
CONTAINER_NAME="staffing-web"
ECR_REPO="wezen-staffing-web"

STAFFING_API_URL="https://api.wezenstaffing.com"
PAYROLL_PORTAL_URL="https://payroll.wezenstaffing.com"
TURNSTILE_SITE_KEY="${TURNSTILE_SITE_KEY:-0x4AAAAAAENoEFj8z9tNetBn}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_DEF_FILE="$SCRIPT_DIR/wezen-staffing-web-task-def.json"

TAG="${1:-$(git rev-parse --short HEAD)}"
IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$TAG"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_cmd aws
require_cmd docker
require_cmd jq
require_cmd git

echo "=== Deploy Staffing Web ==="
echo "Region:            $AWS_REGION"
echo "Cluster:           $CLUSTER_NAME"
echo "Service:           $SERVICE_NAME"
echo "Task family:       $TASK_FAMILY"
echo "Image:             $IMAGE_URI"
echo "Staffing API URL:  $STAFFING_API_URL"
echo "Payroll Portal:    $PAYROLL_PORTAL_URL"
echo

echo "1) Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
| docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "2) Building and pushing staffing-web image for linux/amd64..."
docker buildx build \
  --platform linux/amd64 \
  -f docker/staffing-web.Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.wezenstaffing.com \
  --build-arg NEXT_PUBLIC_PAYROLL_PORTAL_URL=https://payroll.wezenstaffing.com \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY="$TURNSTILE_SITE_KEY" \
  -t "$IMAGE_URI" \
  --push \
  .

echo "3) Preparing new task definition JSON..."
TMP_TASK_DEF="$(mktemp)"

jq \
  --arg IMAGE_URI "$IMAGE_URI" \
  --arg CONTAINER_NAME "$CONTAINER_NAME" \
  '
  .containerDefinitions |= map(
    if .name == $CONTAINER_NAME
    then .image = $IMAGE_URI
    else .
    end
  )
  ' "$TASK_DEF_FILE" > "$TMP_TASK_DEF"

echo "4) Validating task definition JSON..."
jq . "$TMP_TASK_DEF" >/dev/null

echo "5) Registering new task definition revision..."
REGISTER_OUTPUT="$(aws ecs register-task-definition \
  --cli-input-json "file://$TMP_TASK_DEF" \
  --region "$AWS_REGION")"

NEW_TASK_DEF_ARN="$(echo "$REGISTER_OUTPUT" | jq -r '.taskDefinition.taskDefinitionArn')"
NEW_REVISION="$(echo "$REGISTER_OUTPUT" | jq -r '.taskDefinition.revision')"

echo "Registered: $NEW_TASK_DEF_ARN"

echo "6) Updating ECS service..."
aws ecs update-service \
  --cluster "$CLUSTER_NAME" \
  --service "$SERVICE_NAME" \
  --task-definition "$NEW_TASK_DEF_ARN" \
  --force-new-deployment \
  --region "$AWS_REGION" >/dev/null

echo "7) Waiting for service to stabilize..."
aws ecs wait services-stable \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME" \
  --region "$AWS_REGION"

echo "8) Verifying active task definition..."
ACTIVE_TASK_DEF="$(aws ecs describe-services \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME" \
  --region "$AWS_REGION" \
  --query 'services[0].taskDefinition' \
  --output text)"

echo "Active task definition: $ACTIVE_TASK_DEF"

if [[ "$ACTIVE_TASK_DEF" != "$NEW_TASK_DEF_ARN" ]]; then
  echo "Deployment did not land on expected revision." >&2
  exit 1
fi

echo "9) Printing recent ECS service events..."
aws ecs describe-services \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME" \
  --region "$AWS_REGION" \
  --query 'services[0].events[0:10].[createdAt,message]' \
  --output table

rm -f "$TMP_TASK_DEF"

echo
echo "Staffing web deploy complete."
echo "Revision: $NEW_REVISION"
echo "Task ARN:  $NEW_TASK_DEF_ARN"
