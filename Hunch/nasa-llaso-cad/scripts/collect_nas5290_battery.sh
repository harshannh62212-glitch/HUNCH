#!/bin/bash
# Pull host + telemetry battery snapshots from Dell Latitude 5290 NAS (when on LAN).
set -euo pipefail
HOST="harshan@192.168.1.27"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="$OUT_DIR/review/nas5290_battery_${STAMP}.txt"

mkdir -p "$OUT_DIR/review"

ssh -o BatchMode=yes -o ConnectTimeout=12 -o HostKeyAlias=192.168.1.27 "$HOST" bash -s <<'REMOTE' | tee "$REPORT"
echo "=== NAS5290 battery / power $(date -u -Iseconds) ==="
hostname
if command -v upower >/dev/null 2>&1; then
  BAT=$(upower -e | grep -i BAT | head -1)
  if [ -n "$BAT" ]; then upower -i "$BAT"; fi
fi
for f in /sys/class/power_supply/BAT*/capacity /sys/class/power_supply/BAT*/status; do
  [ -f "$f" ] && echo "$f: $(cat "$f")"
done
echo "--- hunch_telemetry_sync ---"
ls -la ~/hunch_telemetry_sync 2>/dev/null | tail -8
echo "--- tail battery_telemetry.jsonl (if synced) ---"
tail -n 3 ~/hunch_telemetry_sync/battery_telemetry.jsonl 2>/dev/null || echo "(no rover battery log on NAS yet)"
REMOTE

echo "Wrote $REPORT"
