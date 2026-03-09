#!/usr/bin/env bash
set -euo pipefail

echo "▶ Building..."
npm run build

echo "▶ Deploying to Vercel (production)..."
vercel --prod --yes

echo "✅ Done — https://hackathon-nu-blush.vercel.app/"
