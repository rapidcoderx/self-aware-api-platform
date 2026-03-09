#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Installing frontend dependencies..."
npm install

echo "==> Building frontend..."
npm run build

echo ""
echo "✅  Build complete. Output is in frontend/dist/"
echo "    Run 'npm run dev' to start the dev server (port 5173)."
