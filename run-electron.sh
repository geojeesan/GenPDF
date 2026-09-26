#!/usr/bin/env bash
set -e

# Navigate to repository root
cd "$(dirname "$0")"

# Ensure production bundle exists if dev server is not active
if [ ! -f "dist/index.html" ]; then
  echo "Building GenPDF frontend..."
  npm run build
fi

echo "Launching GenPDF Studio..."
npx electron electron/main.js "$@"
