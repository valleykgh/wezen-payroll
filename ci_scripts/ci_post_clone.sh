#!/bin/sh
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT/apps/staffing-app"

npm ci
npm run build
npx cap sync ios
