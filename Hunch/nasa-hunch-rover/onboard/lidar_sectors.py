"""36-bin LiDAR layout + sector mins (matches nasa-llaso-cad/viewer.html navSecMins)."""
from __future__ import annotations

import math
from typing import Mapping

SCAN_RANGE_M = 8.0
NUM_BINS = 36


def empty_bins(fill: float = SCAN_RANGE_M) -> list[float]:
    return [fill] * NUM_BINS


def bin_index_for_angle_deg(angle_deg: float) -> int:
    """0° = forward (+X in sim); bins sweep CCW (same convention as viewer lidarSweep)."""
    a = (angle_deg % 360.0 + 360.0) % 360.0
    return int(a / (360.0 / NUM_BINS)) % NUM_BINS


def ingest_scan_points(bins: list[float], points: list[tuple[float, float]]) -> None:
    """Update bins from (angle_deg, range_m) pairs; keeps minimum range per bin."""
    for angle_deg, dist_m in points:
        if dist_m <= 0.05 or dist_m > SCAN_RANGE_M:
            continue
        idx = bin_index_for_angle_deg(angle_deg)
        if dist_m < bins[idx]:
            bins[idx] = dist_m


def sector_mins(bins: list[float]) -> dict[str, float]:
    """Eight compass sectors used by the sim autopilot and escape supervisor."""
    if len(bins) != NUM_BINS:
        raise ValueError(f"expected {NUM_BINS} bins, got {len(bins)}")
    return {
        "F": min(bins[35], bins[0], bins[1]),
        "FL": min(bins[3], bins[4], bins[5], bins[6]),
        "L": min(bins[7], bins[8], bins[9], bins[10], bins[11]),
        "BL": min(bins[12], bins[13], bins[14], bins[15]),
        "B": min(bins[16], bins[17], bins[18], bins[19], bins[20]),
        "BR": min(bins[21], bins[22], bins[23], bins[24]),
        "R": min(bins[25], bins[26], bins[27], bins[28], bins[29]),
        "FR": min(bins[30], bins[31], bins[32], bins[33], bins[34]),
    }


def payload_ten_sectors(sm: Mapping[str, float]) -> dict[str, float]:
    """Ten clearance fields for AEGIS payload.json / dodge LLM (meters)."""
    side_min = min(sm["FL"], sm["FR"], sm["L"], sm["R"])
    return {
        "FL": sm["FL"],
        "FC": sm["F"],
        "FR": sm["FR"],
        "cL": min(sm["FL"], sm["L"]),
        "cR": min(sm["FR"], sm["R"]),
        "SL": sm["L"],
        "SR": sm["R"],
        "BL": sm["BL"],
        "BC": sm["B"],
        "BR": sm["BR"],
        "side_min": side_min,
    }


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    if edge0 == edge1:
        return 1.0 if x >= edge1 else 0.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def lunar_speed_cap(min_clear_m: float, mu: float = 0.65, g: float = 9.81) -> float:
    """Normalized throttle cap from forward clearance (mirrors sim lunarSpeedCap idea)."""
    if min_clear_m >= 6.0:
        return 1.0
    if min_clear_m <= 0.35:
        return 0.0
    return max(0.12, smoothstep(0.35, 5.5, min_clear_m) * 0.95)
