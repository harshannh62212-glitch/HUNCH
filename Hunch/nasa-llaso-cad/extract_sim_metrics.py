#!/usr/bin/env python3
"""Summarize exported rover telemetry CSV (slip, torque command fraction, turn radius)."""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path


def summarize(path: Path) -> dict:
    rows = list(csv.DictReader(path.open(newline="")))
    if not rows:
        raise ValueError("empty CSV")

    slip_n = 0
    max_slip = 0.0
    max_motor = 0.0
    max_sink = 0.0
    min_turn = math.inf
    min_pit = math.inf
    max_vel = 0.0
    dist = 0.0
    prev_x = prev_z = None

    for r in rows:
        slip = r.get("slip", "0") in ("1", "true", "True")
        if slip:
            slip_n += 1
        max_slip = max(max_slip, float(r.get("slip_ratio") or 0))
        max_motor = max(max_motor, float(r.get("motor_cmd_frac") or 0))
        max_sink = max(max_sink, float(r.get("lunar_sink_cm") or 0))
        max_vel = max(max_vel, float(r.get("vel_mps") or 0))
        tr = float(r.get("turn_radius_m") or -1)
        if tr > 0:
            min_turn = min(min_turn, tr)
        pc = float(r.get("pit_clear_m") or -1)
        if pc >= 0:
            min_pit = min(min_pit, pc)
        x, z = float(r["x"]), float(r["z"])
        if prev_x is not None:
            dist += math.hypot(x - prev_x, z - prev_z)
        prev_x, prev_z = x, z

    t0 = float(rows[0]["t_sec"])
    t1 = float(rows[-1]["t_sec"])
    return {
        "source_csv": str(path),
        "sample_count": len(rows),
        "duration_sec": round(t1 - t0, 2),
        "distance_m": round(dist, 2),
        "slip_event_fraction": round(slip_n / len(rows), 4),
        "max_slip_ratio": round(max_slip, 4),
        "max_motor_cmd_fraction": round(max_motor, 4),
        "max_lunar_sink_cm": round(max_sink, 2),
        "min_turn_radius_m": None if min_turn is math.inf else round(min_turn, 3),
        "min_pit_clearance_m": None if min_pit is math.inf else round(min_pit, 3),
        "peak_speed_mps": round(max_vel, 3),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("csv", type=Path, help="rover_telemetry_*.csv from viewer METRICS/CSV export")
    ap.add_argument("-o", "--out", type=Path, help="write JSON summary (default stdout)")
    args = ap.parse_args()
    summary = summarize(args.csv)
    payload = {"summary": summary}
    text = json.dumps(payload, indent=2)
    if args.out:
        args.out.write_text(text + "\n")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
