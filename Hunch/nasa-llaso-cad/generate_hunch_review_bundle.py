#!/usr/bin/env python3
"""Generate HUNCH review test artifacts (nav regression + sample telemetry summary).

Does not modify viewer.html or autonomy / AI nav code. Re-run after exporting
a fresh CSV from the sim (LOG TELEMETRY → CSV EXPORT) to refresh sim_summary.json.
"""
from __future__ import annotations

import csv
import json
import math
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REVIEW = ROOT / "review"
RESULTS = REVIEW / "test-results"


def run_nav_regression() -> str:
    proc = subprocess.run(
        [sys.executable, str(ROOT / "run_nav_scenarios.py")],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    out += f"\nexit_code={proc.returncode}\n"
    return out


def write_archetype_telemetry_csv(path: Path) -> None:
    """Representative QUICK MISSION–style log for metrics tooling (replace with live export)."""
    header = (
        "t_sec,x,z,yaw_deg,vel_mps,turn_vel_rad_s,steer_cmd,throttle,dist_goal_m,"
        "in_terrain_block,auto_on,neural_on,controller,"
        "slip,slip_ratio,motor_cmd_frac,traction_lim_mps2,lunar_sink_cm,turn_radius_m,pit_clear_m\n"
    )
    rows = []
    x, z, yaw = 0.0, 0.0, 0.0
    dt = 0.1
    for i in range(600):
        t = i * dt
        throttle = 0.55 if t < 45 else 0.35
        steer = 0.12 * math.sin(t * 0.15) if 20 < t < 50 else 0.0
        vel = 0.42 * throttle
        x += vel * math.cos(yaw) * dt
        z += vel * math.sin(yaw) * dt
        yaw += steer * dt
        on_slope = t > 30
        motor_frac = min(0.92, 0.35 + throttle * 0.5 + (0.15 if on_slope else 0))
        slip = 1 if motor_frac > 0.78 and on_slope else 0
        slip_ratio = motor_frac * 0.85 if slip else motor_frac * 0.4
        sink = 1.8 if slip else 0.4
        turn_r = max(0.65, abs(vel / (steer + 1e-6)))
        pit_clear = 4.2 + 2 * math.sin(t * 0.05)
        rows.append(
            [
                f"{t:.2f}",
                f"{x:.3f}",
                f"{z:.3f}",
                f"{math.degrees(yaw):.2f}",
                f"{vel:.3f}",
                f"{steer:.3f}",
                f"{steer:.3f}",
                f"{throttle:.3f}",
                f"{max(0, 80 - math.hypot(x, z)):.2f}",
                "0",
                "1",
                "0",
                "pure_pursuit",
                str(slip),
                f"{slip_ratio:.4f}",
                f"{motor_frac:.4f}",
                "2.450",
                f"{sink:.2f}",
                f"{turn_r:.3f}",
                f"{pit_clear:.2f}",
            ]
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        f.write(header)
        csv.writer(f).writerows(rows)


def main() -> int:
    RESULTS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")

    nav_log = run_nav_regression()
    (RESULTS / "nav_geometry_regression.txt").write_text(nav_log)

    csv_path = RESULTS / "rover_telemetry_archetype_quick_mission.csv"
    write_archetype_telemetry_csv(csv_path)

    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "extract_sim_metrics.py"),
            str(csv_path),
            "-o",
            str(RESULTS / "sim_summary.json"),
        ],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
    )
    if proc.returncode != 0:
        print(proc.stderr or proc.stdout, file=sys.stderr)
        return proc.returncode

    manifest = {
        "generated_at_utc": stamp,
        "note": "Archetype CSV models QUICK MISSION physics bands; replace with viewer CSV export for judge demos.",
        "artifacts": {
            "nav_geometry_regression": str(RESULTS / "nav_geometry_regression.txt"),
            "telemetry_csv": str(csv_path),
            "sim_summary": str(RESULTS / "sim_summary.json"),
        },
        "bench_scripts": [
            "Hunch/nasa-hunch-rover/bench/pwm_channel_test.py",
            "Hunch/nasa-hunch-rover/bench/sensor_pipeline_stress.py",
        ],
        "runbook": "engineering_validation_runbook.md",
    }
    (RESULTS / "bundle_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
