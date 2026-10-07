#!/usr/bin/env bash
# Push local main to both GitHub mirrors (HUNCH + chat-app).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-main}"

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Missing origin remote." >&2
  exit 1
fi
if ! git remote get-url chat-app >/dev/null 2>&1; then
  git remote add chat-app https://github.com/harshannh62212-glitch/chat-app.git
fi

echo "→ origin ($(git remote get-url origin))"
git push origin "$BRANCH"

echo "→ chat-app ($(git remote get-url chat-app))"
git push chat-app "$BRANCH"

echo "Done: both remotes updated ($BRANCH)."
