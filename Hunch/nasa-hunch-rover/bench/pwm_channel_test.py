#!/usr/bin/env python3
"""
Bench-test Cytron MDD10A (or compatible) PWM/DIR channels from Raspberry Pi GPIO.

Run on the Pi with wheels OFF THE GROUND. Requires: pip install gpiozero
Edit PIN_MAP below to match your wiring before first power-on.
"""
from __future__ import annotations

import argparse
import time

try:
    import gpiozero  # noqa: F401 — required on Pi for DiffDrive
except ImportError as exc:
    raise SystemExit("Install gpiozero on the Pi: pip install gpiozero") from exc
import sys
from pathlib import Path
_ONBOARD = Path(__file__).resolve().parents[1] / "onboard"
sys.path.insert(0, str(_ONBOARD))

from diff_drive import DEFAULT_PIN_MAP, DiffDrive  # noqa: E402

PIN_MAP = DEFAULT_PIN_MAP


def ramp_channel(drive: DiffDrive, label: str, bank: str, hold_s: float) -> None:
    print(f"[{label}] forward ramp 0 → 0.5 → 0")
    for duty in [0.0, 0.15, 0.3, 0.5, 0.3, 0.15, 0.0]:
        t = duty / drive.max_duty
        if bank == "left":
            drive.apply_bank(t, 0.0)
        else:
            drive.apply_bank(0.0, t)
        print(f"  PWM {duty:.2f}")
        time.sleep(hold_s)
    print(f"[{label}] reverse pulse 0.25")
    if bank == "left":
        drive.apply_bank(-0.45, 0.0)
    else:
        drive.apply_bank(0.0, -0.45)
    time.sleep(hold_s * 2)
    drive.apply_bank(0.0, 0.0)
    print(f"[{label}] OK")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hold", type=float, default=0.8, help="seconds per PWM step")
    parser.add_argument("--channel", choices=["left", "right", "both"], default="both")
    args = parser.parse_args()
    print("WARNING: wheels must be elevated. LiFePO4 connected — fuse recommended.")
    time.sleep(2)
    drive = DiffDrive(PIN_MAP, dry_run=False)
    drive.open()
    try:
        if args.channel == "both":
            ramp_channel(drive, "left", "left", args.hold)
            ramp_channel(drive, "right", "right", args.hold)
        else:
            ramp_channel(drive, args.channel, args.channel, args.hold)
    finally:
        drive.stop()
    print("All requested channels exercised.")


if __name__ == "__main__":
    main()
