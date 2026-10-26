#!/bin/bash
# Deploy the Hunch site to Vercel and point ageisv1.vercel.app at it.
set -e
cd "$(dirname "$0")/.."
LOG=$(mktemp)
npx vercel --prod --yes 2>&1 | tee "$LOG"
URL=$(grep -Eo 'https://[a-z0-9-]+\.vercel\.app' "$LOG" | grep -v -- '-one\.vercel\.app' | head -1)
echo "Deployed: $URL"
npx vercel alias set "$URL" ageisv1.vercel.app
echo "Live at https://ageisv1.vercel.app"
