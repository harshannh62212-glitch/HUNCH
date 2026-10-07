#!/usr/bin/env python3
"""Headless nav safety checks (pit / crater geometry). Run before demos or in CI."""
from __future__ import annotations

import math
import sys


def is_in_crater_bowl(x: float, z: float, craters: list, small_craters: list) -> bool:
    for c in craters:
        if c.get("d", 1) <= 0:
            continue
        if math.hypot(x - c["x"], z - c["z"]) < c["r"] * 0.93:
            return True
    for sc in small_craters:
        if math.hypot(x - sc["x"], z - sc["z"]) / sc["r"] < 0.88:
            return True
    return False


def nearest_safe_point(x: float, z: float, blocked_fn, max_r: float = 8.0):
    if not blocked_fn(x, z):
        return x, z
    for r in [0.8 * i for i in range(1, int(max_r / 0.8) + 1)]:
        for a in range(16):
            ang = a * math.pi * 2 / 16
            nx, nz = x + math.cos(ang) * r, z + math.sin(ang) * r
            if not blocked_fn(nx, nz):
                return nx, nz
    return None


def run() -> int:
    failures = []

    big = [{"x": 12.0, "z": -8.0, "r": 6.0, "d": 1.2}]
    small = [{"x": 12.2, "z": -7.8, "r": 1.5}]

    if not is_in_crater_bowl(12.0, -8.0, big, small):
        failures.append("center of crater should be blocked")
    if is_in_crater_bowl(30.0, 30.0, big, small):
        failures.append("open plain should not be in bowl")

    def blocked(x, z):
        return is_in_crater_bowl(x, z, big, small)

    snap = nearest_safe_point(12.0, -8.0, blocked, 10.0)
    if snap is None:
        failures.append("expected safe snap near crater")
    else:
        sx, sz = snap
        if blocked(sx, sz):
            failures.append("snap point must be safe")
        if math.hypot(sx - 12.0, sz + 8.0) < 0.5:
            failures.append("snap should move away from crater center")

    # Goal inside pit should remap
    goal_x, goal_z = 12.1, -8.1
    safe = nearest_safe_point(goal_x, goal_z, blocked, 12.0)
    if safe and blocked(safe[0], safe[1]):
        failures.append("goal snap produced unsafe cell")

    if failures:
        print("NAV SCENARIOS: FAILED")
        for f in failures:
            print("  -", f)
        return 1

    print("NAV SCENARIOS: OK (crater bowl + safe snap)")
    return 0


if __name__ == "__main__":
    sys.exit(run())
