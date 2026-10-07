# Onboard bridge (sim policy → real rover)

Connects the **same steer/throttle + escape supervisor semantics** as `nasa-llaso-cad/viewer.html` to Cytron MDD10A GPIO on a Raspberry Pi.

## Quick test (Mac, no hardware)

```bash
cd /Users/harshan/Hunch/Hunch/nasa-hunch-rover/onboard
python3 rover_loop.py --dry-run --mock-lidar --auto --duration 8
python3 rover_loop.py --dry-run --escape-test --auto --duration 3
```

The second command should show `"mode":"escape"` and negative throttle (auto-reverse).

## Raspberry Pi

```bash
cd ~/Hunch/Hunch/nasa-hunch-rover/onboard
pip3 install -r requirements.txt
python3 ../bench/pwm_channel_test.py   # verify wiring first (wheels up)
python3 rover_loop.py --dry-run --mock-lidar --auto
python3 rover_loop.py --lidar-port /dev/ttyUSB0 --auto --max-throttle 0.35
```

Edit `diff_drive.DEFAULT_PIN_MAP` or pass `--left-pwm`, `--left-dir`, `--right-pwm`, `--right-dir` to match your harness.

## What is ported vs not

| Sim | Onboard |
|-----|---------|
| Escape supervisor (`evaluateObstacleProximityAndEscape`) | Yes |
| Lidar dodge bias (`applyLidarDodgeAssist`) | Yes |
| Reactive speed cap from clearance | Yes |
| A*, pure pursuit, docking, ONNX in browser | Sim only (for now) |
| 10-sector LLM dodge (`payload.json`) | Exposed in JSON log as `payload10` |

Optional next steps: run `rover_pilot.onnx` via `onnxruntime` + Picamera2, or stream `payload10` to Ollama on the M4 Mini.
