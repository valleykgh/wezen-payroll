#!/usr/bin/env bash
set -euo pipefail

COMMIT_MSG="${1:-Deploy latest payroll changes}"

git add .
git commit -m "$COMMIT_MSG" || true
git push

REGION="us-west-1"
ACCOUNT_ID="211125653940"

API_ECR="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/wezen-payroll-api"
FRONTEND_ECR="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/wezen-payroll-frontend"

CLUSTER="wezen-payroll-cluster"
API_SERVICE="wezen-payroll-api-service"
FRONTEND_SERVICE="wezen-payroll-frontend-service"

API_URL="https://api.payroll.wezenstaffing.com"

aws ecr get-login-password --region "$REGION" \
| docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

aws ecr describe-repositories --repository-names wezen-payroll-api --region "$REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name wezen-payroll-api --region "$REGION" >/dev/null

aws ecr describe-repositories --repository-names wezen-payroll-frontend --region "$REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name wezen-payroll-frontend --region "$REGION" >/dev/null

GIT_SHA="$(git rev-parse --short HEAD)"

docker buildx build \
  --platform linux/amd64 \
  -f apps/api/Dockerfile \
  -t "${API_ECR}:latest" \
  -t "${API_ECR}:${GIT_SHA}" \
  --push .

docker buildx build \
  --platform linux/amd64 \
  -f apps/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL="${API_URL}" \
  -t "${FRONTEND_ECR}:latest" \
  -t "${FRONTEND_ECR}:${GIT_SHA}" \
  --push .

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$API_SERVICE" \
  --force-new-deployment \
  --region "$REGION" >/dev/null

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$FRONTEND_SERVICE" \
  --force-new-deployment \
  --region "$REGION" >/dev/null

aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$API_SERVICE" "$FRONTEND_SERVICE" \
  --region "$REGION" \
  --query 'services[*].{service:serviceName,desired:desiredCount,running:runningCount,pending:pendingCount}' \
  --output table
