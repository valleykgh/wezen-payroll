#!/usr/bin/env bash
set -Eeuo pipefail

AWS_REGION="us-west-1"
AWS_ACCOUNT_ID="211125653940"

CLUSTER_NAME="wezen-payroll-cluster"
SERVICE_NAME="wezen-payroll-frontend-service"
TASK_FAMILY="wezen-payroll-frontend-task"
CONTAINER_NAME="frontend"
ECR_REPO="wezen-payroll-frontend"
API_URL="https://api.payroll.wezenstaffing.com"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_DEF_FILE="$SCRIPT_DIR/frontend-task-def.json"

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

echo "=== Deploy Frontend ==="
echo "Image: $IMAGE_URI"

aws ecr get-login-password --region "$AWS_REGION" \
| docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

docker buildx build \
  --platform linux/amd64 \
  -f apps/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
  -t "$IMAGE_URI" \
  --push \
  .

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

jq . "$TMP_TASK_DEF" >/dev/null

REGISTER_OUTPUT="$(aws ecs register-task-definition \
  --cli-input-json "file://$TMP_TASK_DEF" \
  --region "$AWS_REGION")"

NEW_TASK_DEF_ARN="$(echo "$REGISTER_OUTPUT" | jq -r '.taskDefinition.taskDefinitionArn')"

aws ecs update-service \
  --cluster "$CLUSTER_NAME" \
  --service "$SERVICE_NAME" \
  --task-definition "$NEW_TASK_DEF_ARN" \
  --force-new-deployment \
  --region "$AWS_REGION" >/dev/null

aws ecs wait services-stable \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME" \
  --region "$AWS_REGION"

rm -f "$TMP_TASK_DEF"

echo "Frontend deploy complete."
echo "$NEW_TASK_DEF_ARN"
