"""
Safety supervisor + reactive steer/throttle — ported from nasa-llaso-cad/viewer.html.

Sign convention (same as sim + dataset):
  steer: + = left, - = right (skid steer yaw rate command, roughly -1..1)
  throttle: + = forward, - = reverse (-1..1)
"""
from __future__ import annotations

from dataclasses import dataclass, field

from lidar_sectors import lunar_speed_cap, smoothstep


@dataclass
class EscapeState:
    active: bool = False
    timer_s: float = 0.0
    duration_s: float = 0.0
    steer: float = 0.0
    cooldown_s: float = 0.0
    stuck_timer_s: float = 0.0


@dataclass
class ControlState:
    prev_steer: float = 0.0
    target_speed: float = 0.0
    escape: EscapeState = field(default_factory=EscapeState)


def lidar_dodge_bias(sm: dict[str, float]) -> float:
    """applyLidarDodgeAssist() → llmDodgeBias scale."""
    s_fl, s_fc, s_fr = sm["FL"], sm["F"], sm["FR"]
    if s_fl > s_fr + 1.0:
        return 0.35
    if s_fr > s_fl + 1.0:
        return -0.35
    if s_fc < 3.0:
        return 0.35 if s_fl >= s_fr else -0.35
    return 0.0


def evaluate_obstacle_escape(
    sm: dict[str, float],
    dt: float,
    *,
    auto_active: bool,
    speed_mps: float,
    state: EscapeState,
) -> tuple[dict[str, float] | None, EscapeState]:
    """evaluateObstacleProximityAndEscape — no slope gate on hardware (IMU optional later)."""
    st = EscapeState(
        active=state.active,
        timer_s=state.timer_s,
        duration_s=state.duration_s,
        steer=state.steer,
        cooldown_s=max(0.0, state.cooldown_s - dt),
        stuck_timer_s=state.stuck_timer_s,
    )
    if not auto_active:
        return None, st

    s_fl, s_fc, s_fr = sm["FL"], sm["F"], sm["FR"]
    min_front = min(s_fc, s_fl, s_fr)

    if st.active:
        st.timer_s -= dt
        st.duration_s += dt
        if (st.timer_s <= 0 and min_front >= 1.9) or st.duration_s >= 1.1:
            st.active = False
            st.duration_s = 0.0
            st.stuck_timer_s = 0.0
            st.cooldown_s = 1.2
            return None, st
        return {"steer": st.steer, "throttle": -0.60, "active": True}, st

    if st.cooldown_s > 0:
        return None, st

    if abs(speed_mps) < 0.08:
        st.stuck_timer_s += dt
    else:
        st.stuck_timer_s = max(0.0, st.stuck_timer_s - dt * 2.0)

    too_close = (s_fc < 0.45) or (s_fl < 0.25) or (s_fr < 0.25)
    stalled = st.stuck_timer_s > 0.85 and min_front < 1.25

    if too_close or stalled:
        st.active = True
        st.timer_s = 0.85
        st.duration_s = 0.0
        if s_fl < s_fr:
            st.steer = -0.65
        elif s_fr < s_fl:
            st.steer = 0.65
        else:
            st.steer = 0.0
        return {"steer": st.steer, "throttle": -0.60, "active": True}, st

    return None, st


def reactive_autopilot(
    sm: dict[str, float],
    dt: float,
    *,
    goal_bearing_rad: float | None,
    ctrl: ControlState,
    max_throttle: float = 0.55,
) -> tuple[float, float, ControlState]:
    """
    Lightweight forward nav: optional goal bearing + lidar dodge + speed gating.
    Full A* / pure pursuit stays in the browser sim; this is the hardware-safe subset.
    """
    dodge = lidar_dodge_bias(sm)
    s_fl, s_fc, s_fr = sm["FL"], sm["F"], sm["FR"]
    side_min = min(sm["L"], sm["R"], s_fl, s_fr)

    steer = dodge
    if goal_bearing_rad is not None:
        # Proportional heading hold (bearing relative to rover forward = 0)
        steer += max(-0.85, min(0.85, goal_bearing_rad * 1.1))
    if s_fl < 0.9:
        steer += 0.35
    if s_fr < 0.9:
        steer -= 0.35

    steer = max(-1.35, min(1.35, steer))
    slew = 2.4 * dt
    d_steer = steer - ctrl.prev_steer
    d_steer = max(-slew, min(slew, d_steer))
    ctrl.prev_steer += d_steer
    steer = ctrl.prev_steer
    if abs(steer) < 0.02:
        steer = 0.0

    cap = lunar_speed_cap(min(s_fc, side_min + 0.5))
    speed = min(max_throttle, cap)
    if abs(steer) > 0.55:
        speed *= 0.72
    if s_fc < 1.0:
        speed *= smoothstep(0.25, 1.0, s_fc)

    rate = 6.0 if speed > ctrl.target_speed else 1.8
    ctrl.target_speed += (speed - ctrl.target_speed) * min(1.0, rate * dt)
    throttle = max(0.0, min(1.0, ctrl.target_speed))
    return steer, throttle, ctrl


def compose_auto_command(
    sm: dict[str, float],
    dt: float,
    *,
    auto_active: bool,
    speed_mps: float,
    goal_bearing_rad: float | None,
    ctrl: ControlState,
    max_throttle: float,
) -> tuple[float, float, str, ControlState]:
    escape_cmd, ctrl.escape = evaluate_obstacle_escape(
        sm, dt, auto_active=auto_active, speed_mps=speed_mps, state=ctrl.escape
    )
    if escape_cmd:
        return escape_cmd["steer"], escape_cmd["throttle"], "escape", ctrl

    if not auto_active:
        return 0.0, 0.0, "idle", ctrl

    steer, throttle, ctrl = reactive_autopilot(
        sm,
        dt,
        goal_bearing_rad=goal_bearing_rad,
        ctrl=ctrl,
        max_throttle=max_throttle,
    )
    return steer, throttle, "reactive", ctrl
