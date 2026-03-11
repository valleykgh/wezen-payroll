#!/usr/bin/env bash
set -Eeuo pipefail
git add .
git commit -m "paystub v1 + employee portal improvements"
AWS_REGION="us-west-1"
AWS_ACCOUNT_ID="211125653940"

CLUSTER_NAME="wezen-payroll-cluster"
SERVICE_NAME="wezen-payroll-api-service"
TASK_FAMILY="wezen-payroll-api-task"
CONTAINER_NAME="api"
ECR_REPO="wezen-payroll-api"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_DEF_FILE="$SCRIPT_DIR/api-task-def.json"

TAG="${1:-$(git rev-parse --short HEAD)}"
IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$TAG"

echo "=== Deploy API ==="
echo "Region:      $AWS_REGION"
echo "Cluster:     $CLUSTER_NAME"
echo "Service:     $SERVICE_NAME"
echo "Task family: $TASK_FAMILY"
echo "Image:       $IMAGE_URI"
echo

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

echo "1) Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
| docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "2) Building API image for linux/amd64..."
IMAGE=211125653940.dkr.ecr.us-west-1.amazonaws.com/wezen-payroll-frontend:$IMAGE_TAG
docker buildx build \
  --platform linux/amd64 \
  -f apps/api/Dockerfile \
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
echo "API deploy complete."
echo "Revision: $NEW_REVISION"
echo "Task ARN:  $NEW_TASK_DEF_ARN"
