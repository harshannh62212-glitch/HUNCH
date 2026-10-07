#!/usr/bin/env python3
"""Summarize nav_study.jsonl from a wander/endurance run and suggest improvements."""
from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
from collections import Counter
from pathlib import Path
from typing import Any


def load_records(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def pct(xs: list[float], p: float) -> float | None:
    if not xs:
        return None
    xs = sorted(xs)
    i = min(len(xs) - 1, max(0, int(round((p / 100) * (len(xs) - 1)))))
    return xs[i]


def analyze(rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        raise ValueError("no records")

    run_ids = sorted({r.get("run") for r in rows if r.get("run")})
    latest_run = run_ids[-1] if run_ids else None
    scoped = [r for r in rows if r.get("run") == latest_run] if latest_run else rows

    kinds = Counter(r.get("kind") for r in scoped)
    replans = [r for r in scoped if r.get("kind") == "replan"]
    samples = [r for r in scoped if r.get("kind") == "sample"]
    finishes = [r for r in scoped if r.get("kind") == "finish"]

    reasons = Counter(r.get("reason") for r in replans)
    straight = [float(r["straightOff"]) for r in replans if r.get("straightOff") is not None]
    plan_ms = [float(r["planMs"]) for r in replans if r.get("planMs")]
    cross = [float(r["cross"]) for r in samples if r.get("cross") is not None]
    min_clear = [float(r["minClear"]) for r in samples if r.get("minClear") is not None]
    goal_dists = [float(r["goalDist"]) for r in samples if r.get("goalDist") is not None]

    t_end = max(float(r.get("t") or 0) for r in scoped)
    t_start = min(float(r.get("t") or 0) for r in scoped)
    sim_min = (t_end - t_start) / 60.0

    last_sample = samples[-1] if samples else scoped[-1]
    dist_m = float(last_sample.get("dist") or 0)
    goals = int(last_sample.get("goals") or 0)
    stuck = int(last_sample.get("stuck") or 0)
    replan_n = int(last_sample.get("replans") or len(replans))

    finish_text = finishes[-1].get("summary") if finishes else None

    return {
        "run_id": latest_run,
        "sim_minutes": round(sim_min, 2),
        "event_counts": dict(kinds),
        "finish_summary": finish_text,
        "distance_m": round(dist_m, 1),
        "goals_reached": goals,
        "replan_count": replan_n,
        "replan_reasons": dict(reasons),
        "replans_per_min": round(replan_n / sim_min, 3) if sim_min > 0.1 else replan_n,
        "stuck_marks": stuck,
        "path_detour_m": {
            "mean": round(statistics.fmean(straight), 2) if straight else None,
            "p90": round(pct(straight, 90) or 0, 2) if straight else None,
            "max": round(max(straight), 2) if straight else None,
        },
        "plan_ms": {
            "mean": round(statistics.fmean(plan_ms), 1) if plan_ms else None,
            "p95": round(pct(plan_ms, 95) or 0, 1) if plan_ms else None,
        },
        "cross_track_m": {
            "mean": round(statistics.fmean(cross), 2) if cross else None,
            "p95": round(pct(cross, 95) or 0, 2) if cross else None,
        },
        "min_rock_clearance_m": {
            "min": round(min(min_clear), 2) if min_clear else None,
            "p10": round(pct(min_clear, 10) or 0, 2) if min_clear else None,
        },
        "goal_dist_m_mean": round(statistics.fmean(goal_dists), 1) if goal_dists else None,
        "sample_count": len(samples),
        "replan_count_events": len(replans),
    }


def recommendations(stats: dict[str, Any]) -> list[str]:
    out: list[str] = []
    rpm = stats.get("replans_per_min") or 0
    if rpm > 0.35:
        out.append(
            "Replan rate is high (>{:.2f}/min). Tighten commit thresholds or decay lidar "
            "occupancy slower so symmetric routes do not flip.".format(rpm)
        )
    reasons = stats.get("replan_reasons") or {}
    if reasons.get("offtrack", 0) + reasons.get("blocked", 0) > reasons.get("goal", 0):
        out.append(
            "Many replans are off-track/blocked vs new goals — improve path tracking "
            "(lookahead, cross-track gain) or widen passable corridor in cost map."
        )
    if reasons.get("commit", 0) > 5:
        out.append(
            "Stuck watchdog is firing often — review forward blockage marks and whether "
            "stuck timer marks obstacles too aggressively on slopes."
        )
    detour = (stats.get("path_detour_m") or {}).get("p90")
    if detour is not None and detour > 8:
        out.append(
            "Paths deviate far from straight chords (p90 detour {:.1f} m). Planner may be "
            "over-penalizing mild slopes or under-weighting distance-to-goal.".format(detour)
        )
    ct = (stats.get("cross_track_m") or {}).get("p95")
    if ct is not None and ct > 2.5:
        out.append(
            "Cross-track error p95 {:.1f} m — follower is leaving the ribbon; consider "
            "stronger Stanley/CTE when speed > 0.4 m/s.".format(ct)
        )
    mc = (stats.get("min_rock_clearance_m") or {}).get("min")
    if mc is not None and mc < 0.55:
        out.append(
            "Rover passed within {:.2f} m of rock surfaces — inflate lethal radius or "
            "slow more when corridor clearance < rover radius + margin.".format(mc)
        )
    p95 = (stats.get("plan_ms") or {}).get("p95")
    if p95 is not None and p95 > 80:
        out.append(
            "A* planning p95 {:.0f} ms may hitch the sim — shrink search window or cache "
            "cost patches between replans.".format(p95)
        )
    if not out:
        out.append(
            "No major red flags in this run. Next: compare two runs after parameter "
            "tweaks and track replans/min + min rock clearance."
        )
    return out


def render_md(stats: dict[str, Any], recs: list[str], source: Path) -> str:
    lines = [
        "# LLASO Autopilot Nav Study Report",
        "",
        f"- **Source:** `{source}`",
        f"- **Run id:** `{stats.get('run_id')}`",
        f"- **Simulated time:** {stats.get('sim_minutes')} min",
        f"- **Distance:** {stats.get('distance_m')} m",
        f"- **Goals reached:** {stats.get('goals_reached')}",
        f"- **Replans:** {stats.get('replan_count')} ({stats.get('replans_per_min')}/min)",
        f"- **Stuck marks:** {stats.get('stuck_marks')}",
        "",
    ]
    if stats.get("finish_summary"):
        lines += ["## Outcome", "", str(stats["finish_summary"]), ""]
    lines += [
        "## Event mix",
        "",
        "```json",
        json.dumps(stats.get("event_counts"), indent=2),
        "```",
        "",
        "## Replan reasons",
        "",
        "```json",
        json.dumps(stats.get("replan_reasons"), indent=2),
        "```",
        "",
        "## Path quality",
        "",
        f"- Detour vs straight chord (m): {json.dumps(stats.get('path_detour_m'))}",
        f"- Cross-track while driving (m): {json.dumps(stats.get('cross_track_m'))}",
        f"- Planner time (ms): {json.dumps(stats.get('plan_ms'))}",
        f"- Closest rock approach (m): {json.dumps(stats.get('min_rock_clearance_m'))}",
        "",
        "## How the stack behaved (for study)",
        "",
        "1. **Goals:** `pickWanderGoal()` sets random safe targets; each goal triggers A* on the lidar occupancy grid.",
        "2. **Commit:** Replans swap the polyline only when blocked, goal moves, off-track timer, or stuck commit.",
        "3. **Follow:** Pure pursuit on a short lookahead with cross-track correction; samples every 2 sim-seconds.",
        "4. **Logs:** `replan` rows include `poly` (path vertices); `sample` rows track pose, steer, clearance.",
        "",
        "## Suggested improvements",
        "",
    ]
    for r in recs:
        lines.append(f"- {r}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "jsonl",
        type=Path,
        nargs="?",
        default=Path(__file__).resolve().parent / "nav_study.jsonl",
    )
    ap.add_argument("-o", "--out", type=Path, help="Write markdown report")
    ap.add_argument("--json", type=Path, help="Write machine-readable summary JSON")
    args = ap.parse_args()
    if not args.jsonl.is_file():
        print(f"missing {args.jsonl}", file=sys.stderr)
        return 1
    rows = load_records(args.jsonl)
    stats = analyze(rows)
    recs = recommendations(stats)
    md = render_md(stats, recs, args.jsonl)
    if args.out:
        args.out.write_text(md)
        print(f"wrote {args.out}")
    else:
        print(md)
    if args.json:
        payload = {"stats": stats, "recommendations": recs}
        args.json.write_text(json.dumps(payload, indent=2) + "\n")
        print(f"wrote {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
