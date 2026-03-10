#!/bin/bash

set -e

echo "Starting deployment..."

AWS_REGION="us-west-1"
ACCOUNT_ID="211125653940"

API_REPO="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wezen-payroll-api"
FRONTEND_REPO="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wezen-payroll-frontend"

TAG=$(git rev-parse --short HEAD)

echo "Build tag: $TAG"

########################################
# LOGIN TO ECR
########################################

echo "Logging into ECR..."

aws ecr get-login-password --region $AWS_REGION \
| docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com


########################################
# BUILD API IMAGE
########################################

echo "Building API image..."

docker build \
-f apps/api/Dockerfile \
-t wezen-payroll-api:$TAG .

docker tag wezen-payroll-api:$TAG $API_REPO:$TAG

docker push $API_REPO:$TAG


########################################
# BUILD FRONTEND IMAGE
########################################

echo "Building frontend image..."

docker build \
-f apps/frontend/Dockerfile \
--build-arg NEXT_PUBLIC_API_URL=https://api.payroll.wezenstaffing.com \
-t wezen-payroll-frontend:$TAG .

docker tag wezen-payroll-frontend:$TAG $FRONTEND_REPO:$TAG

docker push $FRONTEND_REPO:$TAG


########################################
# UPDATE TASK DEFINITION
########################################

echo "Updating task definition..."

sed -i '' "s#wezen-payroll-api:[^\"]*#wezen-payroll-api:$TAG#g" api-task-def.json

aws ecs register-task-definition \
--cli-input-json file://api-task-def.json \
--region $AWS_REGION


########################################
# DEPLOY ECS SERVICE
########################################

echo "Deploying API service..."

aws ecs update-service \
--cluster wezen-payroll-cluster \
--service wezen-payroll-api-service \
--force-new-deployment \
--region $AWS_REGION


########################################
# GIT COMMIT
########################################

echo "Committing changes..."

git add .
git commit -m "deploy $TAG" || true
git push

echo "Deployment complete 🚀"
