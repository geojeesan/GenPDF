#!/usr/bin/env bash
set -e

# Navigate to repository root
cd "$(dirname "$0")"

echo "Starting GenPDF Vite dev server (http://localhost:5173)..."
npm run dev
