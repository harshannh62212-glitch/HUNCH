#!/usr/bin/env python3
"""
Run sim-aligned autonomy on the physical tracked rover (Raspberry Pi).

  cd /Users/harshan/Hunch/Hunch/nasa-hunch-rover/onboard
  python3 rover_loop.py --dry-run --mock-lidar --auto --duration 5

On Pi (wheels up first time):
  python3 rover_loop.py --mock-lidar --dry-run
  python3 rover_loop.py --lidar-port /dev/ttyUSB0 --auto --max-throttle 0.35
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

_ONBOARD = Path(__file__).resolve().parent
if str(_ONBOARD) not in sys.path:
    sys.path.insert(0, str(_ONBOARD))

from diff_drive import DEFAULT_PIN_MAP, DiffDrive  # noqa: E402
from lidar_sectors import payload_ten_sectors, sector_mins  # noqa: E402
from lidar_source import MockLidar, StaticScenarioLidar, YdlidarSerial  # noqa: E402
from sim_policy import ControlState, compose_auto_command  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--hz", type=float, default=20.0, help="control loop rate")
    p.add_argument("--duration", type=float, default=0.0, help="seconds (0 = run until Ctrl+C)")
    p.add_argument("--dry-run", action="store_true", help="no GPIO; print commands only")
    p.add_argument("--mock-lidar", action="store_true", help="synthetic scan (Mac or desk)")
    p.add_argument("--escape-test", action="store_true", help="fixed close obstacle scenario")
    p.add_argument("--lidar-port", default="/dev/ttyUSB0", help="YDLIDAR serial device")
    p.add_argument("--auto", action="store_true", help="enable reactive auto + escape supervisor")
    p.add_argument("--max-throttle", type=float, default=0.45, help="cap forward command 0..1")
    p.add_argument(
        "--goal-bearing-deg",
        type=float,
        default=None,
        help="optional constant heading error setpoint (deg), for bench tuning",
    )
    p.add_argument("--steer", type=float, default=0.0, help="manual steer if not --auto")
    p.add_argument("--throttle", type=float, default=0.0, help="manual throttle if not --auto")
    p.add_argument("--json-log", type=Path, default=None, help="append one JSON line per tick")
    p.add_argument("--left-pwm", type=int, default=DEFAULT_PIN_MAP["left"]["pwm"])
    p.add_argument("--left-dir", type=int, default=DEFAULT_PIN_MAP["left"]["dir"])
    p.add_argument("--right-pwm", type=int, default=DEFAULT_PIN_MAP["right"]["pwm"])
    p.add_argument("--right-dir", type=int, default=DEFAULT_PIN_MAP["right"]["dir"])
    return p.parse_args()


def make_lidar(args: argparse.Namespace):
    if args.escape_test:
        return StaticScenarioLidar(front_m=0.32)
    if args.mock_lidar:
        return MockLidar()
    return YdlidarSerial(port=args.lidar_port)


def main() -> None:
    args = parse_args()
    lidar = make_lidar(args)
    pin_map = {
        "left": {"pwm": args.left_pwm, "dir": args.left_dir},
        "right": {"pwm": args.right_pwm, "dir": args.right_dir},
    }
    drive = DiffDrive(pin_map, dry_run=args.dry_run)
    drive.open()

    ctrl = ControlState()
    goal_bearing = None
    if args.goal_bearing_deg is not None:
        goal_bearing = args.goal_bearing_deg * 3.141592653589793 / 180.0

    dt = 1.0 / max(1.0, args.hz)
    t_end = time.monotonic() + args.duration if args.duration > 0 else None
    log_fp = args.json_log.open("a", encoding="utf-8") if args.json_log else None

    print(
        f"rover_loop: auto={args.auto} dry_run={args.dry_run} hz={args.hz} "
        f"max_throttle={args.max_throttle}"
    )
    if not args.dry_run:
        print("WARNING: wheels elevated? E-stop ready? Starting in 3s...")
        time.sleep(3)

    speed_est = 0.0
    try:
        while t_end is None or time.monotonic() < t_end:
            t0 = time.monotonic()
            bins = lidar.read_bins()
            sm = sector_mins(bins)
            ten = payload_ten_sectors(sm)

            if args.auto:
                steer, throttle, mode, ctrl = compose_auto_command(
                    sm,
                    dt,
                    auto_active=True,
                    speed_mps=speed_est,
                    goal_bearing_rad=goal_bearing,
                    ctrl=ctrl,
                    max_throttle=args.max_throttle,
                )
            else:
                steer, throttle, mode = args.steer, args.throttle, "manual"

            cmd = drive.apply(steer, throttle)
            speed_est = throttle * 0.6  # rough dead-reckon for stuck detector

            row = {
                "t": round(time.time(), 3),
                "mode": mode,
                "steer": round(steer, 3),
                "throttle": round(throttle, 3),
                "sectors": {k: round(v, 2) for k, v in sm.items()},
                "payload10": {k: round(v, 2) for k, v in ten.items() if k != "side_min"},
                "left_duty": round(cmd.left_duty, 3),
                "right_duty": round(cmd.right_duty, 3),
            }
            print(json.dumps(row), flush=True)
            if log_fp:
                log_fp.write(json.dumps(row) + "\n")

            elapsed = time.monotonic() - t0
            time.sleep(max(0.0, dt - elapsed))
    except KeyboardInterrupt:
        print("\nStopping.")
    finally:
        drive.stop()
        if log_fp:
            log_fp.close()
        if hasattr(lidar, "close"):
            lidar.close()


if __name__ == "__main__":
    main()
