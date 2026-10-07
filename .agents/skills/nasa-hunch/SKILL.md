---
name: nasa-hunch
description: "Runbooks and operational workflows for the NASA HUNCH LLASO lunar rover simulator, AI training pipeline, logistics optimizer, and hardware specifications."
---

# NASA HUNCH Operations Skill

This skill guides you through executing, debugging, and modifying the various subsystems of the NASA HUNCH LLASO robotics suite.

---

## 1. Running the 3D Digital Twin & Flight Simulator
The digital twin simulator in `nasa-llaso-cad` includes a telemetry receiver server.

```bash
# 1. Start the HTTP server with telemetry logging enabled
cd /Users/harshan/Hunch/Hunch/nasa-llaso-cad
python3 serve.py 8002

# 2. Access the simulator
# Open http://127.0.0.1:8002/launcher.html (hub) or /viewer.html
# Quick start: QUICK MISSION button · regression: python3 run_nav_scenarios.py
# Validation runbook: engineering_validation_runbook.md · metrics: LOG TELEMETRY → CSV / METRICS JSON
```
- **Controls:** WASD for manual driving, Space for handbrake.
- **Flight Recorder:** Press "Record Demonstration" to capture frames into `dataset_latest.json`.
- **Live ONNX Pilot:** Toggle "Enable Neural Pilot (ONNX WebAssembly)" to run `rover_pilot.onnx` at 60 FPS.

---

## 2. Training the Neural Imitation Policy
When new human flight demonstrations are recorded:

```bash
cd /Users/harshan/Hunch/Hunch/nasa-llaso-cad

# Requires PyTorch with MPS support (Apple Silicon):
python3 train_rover_imitation.py
```
- Reads demonstration frames from `dataset_latest.json`.
- Generates horizontal flip symmetry augmentations + reverse escape reflexes.
- Trains `RoverPilotNet` (CNN + Telemetry MLP) for continuous `[steer, throttle]`.
- Exports `rover_pilot_best.pth`, `rover_pilot.pth`, and `rover_pilot.onnx`.

---

## 3. Running the Lunar Logistics Manifest Optimizer
To recalculate LIFO packing and CoM vectors:

```bash
cd /Users/harshan/Hunch/Hunch/nasa-llaso-cad
python3 optimize_manifest.py
```
- Validates 14-day reverse-chronological mission profile.
- Calculates Center of Mass $\mathbf{r}_{\text{CoM}}$ to ensure lateral stability ($<\pm 0.05\,\text{m}$).
- Updates `lunar_logistics_manifest.json`.

---

## 4. Developing the React AMR Rover Dashboard
For the dedicated AMR rover UI:

```bash
cd /Users/harshan/Hunch/Hunch/nasa-hunch-rover
npm install
npm run dev
```

---

## 6. Physical Rover Onboard Bridge (`nasa-hunch-rover/onboard`)

Runs sim-aligned escape supervisor + reactive LiDAR nav on the Raspberry Pi:

```bash
cd /Users/harshan/Hunch/Hunch/nasa-hunch-rover/onboard
python3 rover_loop.py --dry-run --mock-lidar --auto --duration 8   # Mac smoke test
python3 rover_loop.py --lidar-port /dev/ttyUSB0 --auto --max-throttle 0.35  # Pi
```

See `onboard/README.md`. Verify GPIO with `../bench/pwm_channel_test.py` (wheels up) before `--auto` without `--dry-run`.

---

## 5. Deploying the Root AEGIS-V1 Mission Control
To deploy changes to production:

```bash
cd /Users/harshan/Hunch
npx vercel --prod
```
