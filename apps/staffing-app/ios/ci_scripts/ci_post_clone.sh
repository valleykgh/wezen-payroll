#!/bin/sh
set -e

cd "$CI_WORKSPACE/apps/staffing-app"

npm ci
npm run build
npx cap sync ios
