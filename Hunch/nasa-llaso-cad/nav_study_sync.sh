#!/bin/bash
# Copy the live nav study log to the Latitude 5290 until the 60-minute run finishes.
set -u
ROOT="/Users/harshan/Hunch/Hunch/nasa-llaso-cad"
LOG="$ROOT/nav_study.jsonl"
DEST="harshan@100.122.117.6:/home/harshan/hunch_telemetry_sync/"
SSH="ssh -o BatchMode=yes -o ConnectTimeout=12 -o HostKeyAlias=192.168.1.27"
cd "$ROOT"
deadline=$((SECONDS + 80 * 60))
while [ "$SECONDS" -lt "$deadline" ]; do
  if [ -s "$LOG" ]; then
    rsync -az --update -e "$SSH" "$LOG" "$ROOT/rover_actions.log" "$ROOT"/nav_study_report_*.md "$ROOT"/nav_study_report_*.json "$DEST" 2>/dev/null || \
    rsync -az --update -e "$SSH" "$LOG" "$ROOT/rover_actions.log" "$DEST" || true
  fi
  if [ -s "$LOG" ] && grep -q '"kind": "finish"' "$LOG"; then
    rsync -az -e "$SSH" "$LOG" "$ROOT/rover_actions.log" "$ROOT"/nav_study_report_*.md "$ROOT"/nav_study_report_*.json "$DEST" 2>/dev/null || \
    rsync -az -e "$SSH" "$LOG" "$ROOT/rover_actions.log" "$DEST" || true
    echo "STUDY_FINISHED"
    exit 0
  fi
  sleep 30
done
rsync -az -e "$SSH" "$LOG" "$ROOT/rover_actions.log" "$DEST" || true
echo "STUDY_TIMEOUT"
exit 1
