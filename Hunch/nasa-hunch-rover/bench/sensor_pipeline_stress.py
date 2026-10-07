#!/usr/bin/env python3
"""
Concurrent sensor stress test on Raspberry Pi: camera capture + periodic LiDAR-style reads.

Measures effective Hz, CPU temperature, and end-to-end loop latency for navigation budgeting.
LiDAR: plug in YDLIDAR via USB serial or use --mock-lidar for desk testing without hardware.
"""
from __future__ import annotations

import argparse
import statistics
import sys
import threading
import time
from pathlib import Path


def read_cpu_temp_c() -> float | None:
    try:
        raw = Path("/sys/class/thermal/thermal_zone0/temp").read_text().strip()
        return int(raw) / 1000.0
    except Exception:
        return None


def camera_loop(duration: float, out: dict) -> None:
    try:
        import cv2
    except ImportError:
        out["camera_error"] = "opencv-python not installed"
        return
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        out["camera_error"] = "cannot open camera index 0"
        return
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    times: list[float] = []
    t_end = time.monotonic() + duration
    while time.monotonic() < t_end:
        t0 = time.monotonic()
        ok, _frame = cap.read()
        if not ok:
            break
        times.append(time.monotonic() - t0)
    cap.release()
    if times:
        out["camera_fps"] = round(len(times) / duration, 1)
        out["camera_frame_ms_p95"] = round(statistics.quantiles(times, n=20)[18] * 1000, 2)


def lidar_loop(duration: float, mock: bool, out: dict) -> None:
    latencies: list[float] = []
    t_end = time.monotonic() + duration
    ser = None
    if not mock:
        try:
            import serial

            ser = serial.Serial("/dev/ttyUSB0", 115200, timeout=0.05)
        except Exception as exc:
            out["lidar_error"] = str(exc)
            mock = True
    count = 0
    while time.monotonic() < t_end:
        t0 = time.monotonic()
        if mock:
            time.sleep(0.01)
        else:
            assert ser is not None
            ser.reset_input_buffer()
            ser.write(b"\xA5\x60")
            _ = ser.read(32)
        latencies.append(time.monotonic() - t0)
        count += 1
    if ser:
        ser.close()
    out["lidar_scans"] = count
    out["lidar_hz"] = round(count / duration, 1)
    if latencies:
        out["lidar_latency_ms_p95"] = round(statistics.quantiles(latencies, n=20)[18] * 1000, 2)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--duration", type=float, default=30.0)
    ap.add_argument("--mock-lidar", action="store_true")
    ap.add_argument("--nav-loop-ms", type=float, default=100.0, help="target control period (10 Hz default)")
    args = ap.parse_args()

    cam_out: dict = {}
    lid_out: dict = {}
    tc = threading.Thread(target=camera_loop, args=(args.duration, cam_out), daemon=True)
    tl = threading.Thread(target=lidar_loop, args=(args.duration, args.mock_lidar, lid_out), daemon=True)
    t0 = time.monotonic()
    tc.start()
    tl.start()
    tc.join()
    tl.join()
    elapsed = time.monotonic() - t0

    temp = read_cpu_temp_c()
    nav_budget_ms = args.nav_loop_ms
    lid_p95 = lid_out.get("lidar_latency_ms_p95")
    cam_p95 = cam_out.get("camera_frame_ms_p95")
    combined = (lid_p95 or 0) + (cam_p95 or 0)
    report = {
        "duration_sec": round(elapsed, 1),
        "cpu_temp_c": temp,
        "camera": cam_out,
        "lidar": lid_out,
        "nav_loop_budget_ms": nav_budget_ms,
        "estimated_sensor_latency_ms_p95": combined,
        "within_nav_budget": combined < nav_budget_ms if combined else None,
    }
    print(json_dumps(report))
    if combined and combined >= nav_budget_ms:
        print(
            f"FAIL: sensor p95 latency {combined:.1f} ms exceeds nav loop {nav_budget_ms:.0f} ms",
            file=sys.stderr,
        )
        return 1
    return 0


def json_dumps(obj: dict) -> str:
    import json

    return json.dumps(obj, indent=2)


if __name__ == "__main__":
    raise SystemExit(main())
