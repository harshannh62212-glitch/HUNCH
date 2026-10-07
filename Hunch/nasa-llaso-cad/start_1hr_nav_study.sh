#!/bin/bash
# Start a 60-minute AI nav study locally; syncs to Dell 5290. Safe to close Cursor after this.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p logs
export NAV_STUDY_MINUTES="${NAV_STUDY_MINUTES:-60}"
export NAV_STUDY_PORT="${NAV_STUDY_PORT:-8002}"
PIDFILE="$ROOT/logs/nav_study_headless.pid"
if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "Study already running (pid $(cat "$PIDFILE")). tail -f $ROOT/logs/nav_study_*.log"
  exit 0
fi
nohup caffeinate -dims python3 "$ROOT/run_nav_study_headless.py" >>"$ROOT/logs/nav_study_runner.log" 2>&1 &
echo $! >"$PIDFILE"
echo "Started 1hr nav study (pid $(cat "$PIDFILE"))."
echo "  Local log: tail -f $ROOT/logs/nav_study_runner.log"
echo "  Data file: $ROOT/nav_study.jsonl (updates every ~2s sim time)"
echo "  NAS copy:  harshan@192.168.1.27:~/hunch_telemetry_sync/ (every 30s via nav_study_sync.sh)"
echo "  When done: nav_study_report_*.md on this folder + NAS"
