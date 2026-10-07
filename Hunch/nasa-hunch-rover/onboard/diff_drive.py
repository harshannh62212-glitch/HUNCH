"""Skid-steer: sim steer/throttle → Cytron MDD10A PWM/DIR (BCM pins)."""
from __future__ import annotations

from dataclasses import dataclass

# Default wiring — edit before first drive (same as bench/pwm_channel_test.py)
DEFAULT_PIN_MAP = {
    "left": {"pwm": 12, "dir": 16},
    "right": {"pwm": 13, "dir": 20},
}

PWM_HZ = 20_000
MAX_DUTY = 0.55  # hardware safety cap on Pi (raise after tuning)


@dataclass
class DriveCommand:
    left_duty: float
    right_duty: float
    left_forward: bool
    right_forward: bool


def skid_steer_mix(steer: float, throttle: float, *, max_duty: float = MAX_DUTY) -> DriveCommand:
    """
    steer/throttle in [-1, 1] (sim convention).
    steer + = left turn → left track slower / reverse on tight pivot.
    """
    steer = max(-1.0, min(1.0, steer))
    throttle = max(-1.0, min(1.0, throttle))
    turn = steer * 0.65
    left = throttle - turn
    right = throttle + turn
    mag = max(abs(left), abs(right), 1e-6)
    if mag > 1.0:
        left /= mag
        right /= mag
    left_duty = min(max_duty, abs(left) * max_duty)
    right_duty = min(max_duty, abs(right) * max_duty)
    return DriveCommand(
        left_duty=left_duty,
        right_duty=right_duty,
        left_forward=left >= 0,
        right_forward=right >= 0,
    )


class DiffDrive:
    def __init__(
        self,
        pin_map: dict | None = None,
        *,
        dry_run: bool = False,
        max_duty: float = MAX_DUTY,
    ) -> None:
        self.pin_map = pin_map or DEFAULT_PIN_MAP
        self.dry_run = dry_run
        self.max_duty = max_duty
        self._left_pwm = self._right_pwm = self._left_dir = self._right_dir = None

    def open(self) -> None:
        if self.dry_run:
            return
        from gpiozero import DigitalOutputDevice, PWMOutputDevice

        lp = self.pin_map["left"]
        rp = self.pin_map["right"]
        self._left_pwm = PWMOutputDevice(lp["pwm"], frequency=PWM_HZ)
        self._right_pwm = PWMOutputDevice(rp["pwm"], frequency=PWM_HZ)
        self._left_dir = DigitalOutputDevice(lp["dir"])
        self._right_dir = DigitalOutputDevice(rp["dir"])

    def stop(self) -> None:
        self.apply(0.0, 0.0)
        for dev in (self._left_pwm, self._right_pwm, self._left_dir, self._right_dir):
            if dev is not None:
                dev.close()
        self._left_pwm = self._right_pwm = self._left_dir = self._right_dir = None

    def apply(self, steer: float, throttle: float) -> DriveCommand:
        cmd = skid_steer_mix(steer, throttle, max_duty=self.max_duty)
        self._emit(cmd)
        return cmd

    def apply_bank(self, left: float, right: float) -> DriveCommand:
        """Direct left/right command in [-1, 1] for per-channel bench tests."""
        left = max(-1.0, min(1.0, left))
        right = max(-1.0, min(1.0, right))
        cmd = DriveCommand(
            left_duty=min(self.max_duty, abs(left) * self.max_duty),
            right_duty=min(self.max_duty, abs(right) * self.max_duty),
            left_forward=left >= 0,
            right_forward=right >= 0,
        )
        self._emit(cmd)
        return cmd

    def _emit(self, cmd: DriveCommand) -> None:
        if self.dry_run:
            return
        assert self._left_pwm and self._right_pwm and self._left_dir and self._right_dir
        self._left_dir.on() if cmd.left_forward else self._left_dir.off()
        self._right_dir.on() if cmd.right_forward else self._right_dir.off()
        self._left_pwm.value = cmd.left_duty
        self._right_pwm.value = cmd.right_duty
