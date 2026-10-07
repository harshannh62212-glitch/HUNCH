"""LiDAR → 36 distance bins for onboard policy."""
from __future__ import annotations

import math
import random
import time
from abc import ABC, abstractmethod

from lidar_sectors import SCAN_RANGE_M, empty_bins, ingest_scan_points


class LidarSource(ABC):
    @abstractmethod
    def read_bins(self) -> list[float]:
        ...


class MockLidar(LidarSource):
    """Desk / Mac testing without hardware."""

    def __init__(self, seed: int = 0) -> None:
        self._t0 = time.monotonic()
        random.seed(seed)

    def read_bins(self) -> list[float]:
        bins = empty_bins()
        t = time.monotonic() - self._t0
        # Synthetic wall ahead that moves slightly — enough to exercise escape logic.
        front = 2.2 + 0.4 * math.sin(t * 0.7)
        points: list[tuple[float, float]] = []
        for deg in range(-40, 41, 4):
            points.append((float(deg), front + random.uniform(-0.05, 0.05)))
        for deg in range(120, 241, 6):
            points.append((float(deg), 4.5 + random.uniform(0, 0.3)))
        ingest_scan_points(bins, points)
        return bins


class StaticScenarioLidar(LidarSource):
    """Fixed scenario for unit-style checks."""

    def __init__(self, front_m: float = 0.35) -> None:
        self.front_m = front_m

    def read_bins(self) -> list[float]:
        bins = empty_bins()
        points = [(d, self.front_m) for d in range(-30, 31, 5)]
        ingest_scan_points(bins, points)
        return bins


class YdlidarSerial(LidarSource):
    """
    YDLIDAR over official OS Python SDK (Pi).
    Install on robot: pip install ydlidar  (or build ydlidar-os-sdk bindings)
    """

    def __init__(self, port: str = "/dev/ttyUSB0", baud: int = 128000) -> None:
        self.port = port
        self.baud = baud
        self._lidar = None
        self._started = False

    def _ensure(self) -> None:
        if self._lidar is not None:
            return
        try:
            import ydlidar  # type: ignore
        except ImportError as exc:
            raise SystemExit(
                "YDLIDAR SDK not installed. On the Pi: pip install ydlidar "
                "or use --mock-lidar for bench testing."
            ) from exc
        self._lidar = ydlidar.YDLidar()
        self._lidar.setlidaropt(ydlidar.LidarPropSerialPort, self.port)
        self._lidar.setlidaropt(ydlidar.LidarPropSerialBaudrate, self.baud)
        if not self._lidar.initialize():
            raise RuntimeError(f"YDLIDAR initialize failed on {self.port}")
        ret = self._lidar.turnOn()
        if not ret:
            raise RuntimeError("YDLIDAR turnOn failed")
        self._started = True

    def read_bins(self) -> list[float]:
        self._ensure()
        import ydlidar  # type: ignore

        bins = empty_bins()
        scan = ydlidar.LaserScan()
        count = self._lidar.doProcessSimple(scan)
        if count <= 0:
            return bins
        points: list[tuple[float, float]] = []
        for i in range(count):
            ang = scan.points[i].angle * 180.0 / math.pi
            dist = scan.points[i].range
            points.append((ang, dist))
        ingest_scan_points(bins, points)
        return bins

    def close(self) -> None:
        if self._lidar and self._started:
            self._lidar.turnOff()
            self._lidar.disconnecting()
            self._started = False
