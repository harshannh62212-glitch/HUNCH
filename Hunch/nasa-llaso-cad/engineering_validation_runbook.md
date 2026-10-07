# LLASO / AMR Engineering Validation Runbook

**Project:** `LLASO-P1-AMR-2026`  
**Audience:** NASA HUNCH team (sim → bench → structure)

This runbook ties the digital twin (`nasa-llaso-cad`) to hardware bring-up (`nasa-hunch-rover`) and PETG fabrication order.

---

## 1. Extract and document simulation data

### Metrics captured in sim

| Metric | UI / field | Meaning |
|--------|------------|---------|
| Wheel slip | `stat-slip` → CSV `slip`, `slip_ratio` | Traction limit exceeded; `slip_ratio` = commanded accel ÷ traction cap |
| Motor load | CSV `motor_cmd_frac` | Commanded drive vs motor accel limit (correlate to **≥35 kg·cm stall** on bench) |
| Traction cap | CSV `traction_lim_mps2` | $\mu G \cos(\text{pitch})$ model used in physics |
| Regolith sink | CSV `lunar_sink_cm` | Sink depth during slip / slope |
| Turning radius | CSV `turn_radius_m` | $R \approx \|v\| / \|\dot\psi\|$ (skid-steer instantaneous) |
| Pit clearance | CSV `pit_clear_m` | Distance to nearest crater rim |

### Recording procedure

1. Start server: `cd Hunch/nasa-llaso-cad && python3 serve.py 8002`
2. Open http://127.0.0.1:8002/viewer.html — hard refresh.
3. Click **● LOG TELEMETRY**, run **QUICK MISSION** or **?selftest=pits** (pit regression).
4. Click **■ STOP LOG**, then **CSV EXPORT** and **METRICS JSON**.
5. Optional CLI summary:  
   `python3 extract_sim_metrics.py rover_telemetry_YYYY-MM-DD.csv -o sim_summary.json`

### Suggested demo scenarios (log each separately)

| Scenario | Purpose |
|----------|---------|
| QUICK MISSION | Path planning + cruise slip / turn radius |
| CARGO RUN | Longer traverse, pit repulsion |
| `?selftest=pits` | Obstacle avoidance / recovery (console table) |
| Manual WASD on 25° slope | Max `motor_cmd_frac` and slip fraction |

### Side-by-side screen recordings

Record **two synchronized clips** for review decks:

1. **Layout:** Browser window showing 3D view **and** minimap / explored grid (resize so both visible). Optional: Picture-in-Picture on mastcam panel.
2. **Mac:** QuickTime → File → New Screen Recording; or OBS with 1920×1080 canvas, 30 fps.
3. **Pair A — path planning:** LOG TELEMETRY on → QUICK MISSION → full route visible on green ribbon + minimap fill.
4. **Pair B — recovery:** Place rover near pit field (or run `?selftest=pits`) → capture replan + pit guard log lines + velocity recovery.
5. **Naming:** `sim_planning_YYYYMMDD.mp4`, `sim_recovery_YYYYMMDD.mp4`; store next to exported CSV/JSON in Google Drive sync folder.

---

## 2. Bench-test core electronics (testbed)

**Bill of materials:** Raspberry Pi 4/5, Cytron MDD10A, 12.8 V LiFePO4 4S (fused), XL4015 5 V buck (Pi + sensors), JGB37-550 motors (wheels **off ground**).

### Wiring checks (power off)

| Step | Action |
|------|--------|
| 1 | Pi logic **GND** common with MDD10A GND only at one star point |
| 2 | Motor power **12 V** on MDD10A VM; never on Pi 5 V pin |
| 3 | Buck output trimmed to **5.1 V** under LiDAR + Pi load |
| 4 | Confirm encoder lines not sharing motor power wires |

### PWM verification (Pi)

```bash
cd /Users/harshan/Hunch/Hunch/nasa-hunch-rover/bench
# Edit PIN_MAP in pwm_channel_test.py to match BCM wiring
python3 pwm_channel_test.py --channel both --hold 0.8
```

**Pass criteria:** Each channel ramps forward 0→50% PWM without Pi undervoltage; direction reverses cleanly; no driver fault LED.

### Drive code alignment

- Sim uses abstract accel limits (`activeMotor.torque` in `viewer.html`); hardware target is **28–35 kg·cm stall** per `cad_model/hardware_specification_sheet.md`.
- Map autopilot throttle $\in [0,1]$ to PWM duty on Pi; cap acceleration in software if aggregate stall current exceeds **10 A continuous** (MDD10A spec).

---

## 3. Validate sensor pipelines

**Target nav loop:** 10 Hz (100 ms) per `pi_telemetry_schema.json` — sensor p95 latency must stay **below** this budget.

```bash
cd /Users/harshan/Hunch/Hunch/nasa-hunch-rover/bench
pip install opencv-python pyserial gpiozero   # on Pi
python3 sensor_pipeline_stress.py --duration 60 --nav-loop-ms 100
# Desk without LiDAR:
python3 sensor_pipeline_stress.py --mock-lidar --duration 30
```

**Pass criteria:**

| Check | Target |
|-------|--------|
| Camera effective FPS | ≥ 15 sustained (640×480) |
| LiDAR scan rate | ≥ 8 Hz (or vendor spec for YDLIDAR X2) |
| CPU temp | < 80 °C at 25 °C ambient (throttle if higher) |
| `within_nav_budget` | `true` (combined p95 sensor latency < 100 ms) |

Cross-check obstacle latency: log timestamp from LiDAR frame → dodge decision in AEGIS `payload.json` policy (goal: **< 100 ms** on Pi 4).

---

## 4. Fabricate the structural core (PETG)

Print **high-stress parts first** before large plates. Reference: `cad_model/hardware_specification_sheet.md` §6.

### Print order

| Priority | Part (STL) | Why first |
|----------|------------|-----------|
| 1 | Wheel / sprocket mounts, drive shaft bosses | Shaft tolerance, 6 mm D-flat |
| 2 | Rocker / bogie pivots, brass M4 insert bosses | Bearing fit, $230 °C$ insert install |
| 3 | Motor brackets | Motor hole pattern vs JGB37 face |
| 4 | `chassis_truss` segments (short coupons) | Screw clearance M3/M4 |
| 5 | Full truss plates, track shells, lidar mast | After fits verified |

### Settings

- PETG 240–245 °C nozzle, 75 °C bed, **4 walls**, **35–40 % gyroid**
- M3 inserts: $\varnothing 4.6$ mm × 5 mm; M4: $\varnothing 6$ mm × 8 mm @ 230 °C iron tip

### Fitment gates (do not print full frame until pass)

1. Drive shaft slides through mount with **0.1–0.25 mm** clearance (no bind).
2. 608 or specified bearing presses by hand + thumb — not hammer.
3. M4 bolt through truss joint without bulging layers (re-drill only as last resort).
4. Track idler spins freely under 2 N side load.

---

## Quick reference commands

```bash
# Sim + telemetry
cd Hunch/nasa-llaso-cad && python3 serve.py 8002
python3 run_nav_scenarios.py
python3 extract_sim_metrics.py rover_telemetry_*.csv

# React dashboard (mission docs)
cd Hunch/nasa-hunch-rover && npm run dev
```

Store exports under team Drive: **Hunch / Validation / Sim_YYYY-MM** and link CSV + MP4 + JSON in engineering log.
