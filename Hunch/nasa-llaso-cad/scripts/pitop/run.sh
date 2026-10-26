#!/usr/bin/env bash
# pi-top 4: serve LLASO viewer and open Chromium (run from clone after git pull).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAD_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${CAD_ROOT}"

PORT="${PORT:-8002}"
URL="http://127.0.0.1:${PORT}/viewer.html"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 required" >&2
  exit 1
fi

if lsof -i ":${PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Port ${PORT} already in use; assuming serve.py is running."
else
  echo "Starting serve.py on port ${PORT}..."
  python3 serve.py "${PORT}" &
  SERVE_PID=$!
  sleep 1
  if ! kill -0 "${SERVE_PID}" 2>/dev/null; then
    echo "serve.py failed to start" >&2
    exit 1
  fi
fi

CHROMIUM=""
for c in chromium-browser chromium google-chrome; do
  if command -v "$c" >/dev/null 2>&1; then
    CHROMIUM="$c"
    break
  fi
done

if [[ -z "${CHROMIUM}" ]]; then
  echo "No Chromium found. Open manually: ${URL}"
  exit 0
fi

# WebGL on Pi: common flags; adjust per your pi-top OS image.
exec "${CHROMIUM}" \
  --app="${URL}" \
  --no-first-run \
  --disable-infobars \
  --enable-webgl \
  --ignore-gpu-blocklist \
  "${CHROMIUM_EXTRA_FLAGS:-}"
