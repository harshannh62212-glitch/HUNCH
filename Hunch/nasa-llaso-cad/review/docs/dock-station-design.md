---
title: "AEGIS-V1 Autonomous Docking & Charging Station — Design Package"
date: 2026-10-24
tags: [review, design]
---
# AEGIS-V1 Autonomous Docking & Charging Station — Design Package

**Project:** NASA HUNCH LLASO Project 2 · **Status:** design v1 + simulator implementation · **Code:** `Hunch/nasa-llaso-cad/js/dock_station.js`, hooks in `viewer.html`

> **Read this first — the one thing that changes the design.**
> A lunar night is about **354 h**. With the specified 5 Ah buffer (≈ 69 Wh, ≈ 55 Wh usable) the station can run its survival heater for **~26 h**, not 354 h. Surviving a full equatorial night needs **≈ 740 Wh (≈ 67 Ah @ 13.8 V)** or radioisotope heater units. This package therefore treats the 5 Ah pack as the *day-side operating and eclipse/short-shadow* buffer, defines a night-survival mode that is honest about its limit, and prices the upgrade (§1.5, §4.5). Everything else in the spec is met as written.

---

## 0. System at a glance

```
                        ZENITH
        ┌──────────────[ RADIATOR 0.16 m² + bimetal louvers ]──── heat pipes ───┐
  ☀     │  [100 W PV panel, tilt]                                                │
        │        │ 18 V                                                         ▼
 ┌──────┴────────▼───────────────── INSULATED GARAGE BAY (MLI-lined, dust labyrinth) ─────────────┐
 │  UWB anchor        IR beacon + strobe                [facade tag 300 mm]       motorised door      │
 │                                                                                   (6-slat, brush seal)│
 │  ┌─ WARM BOX (MLI ×30) ─────────┐   ← apron / approach                                              │
 │  │ MPPT · 6S LTO 5 Ah · dock    │      ───►  [clamp arm L]═══ROVER═══[clamp arm R]  [aft tag 100 mm]│
 │  │ charger · MCU · heaters      │                 ▲ floating magnetic coupler (roof)  [bumper sw] │
 │  └──────────────────────────────┘                 └── contacts mate with rover top-deck pad          │
 └───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. System architecture & electrical budget

### 1.1 Power routing

```
 100 W PV (Voc ≈ 22 V, Vmp ≈ 18 V)
    │  fuse 10 A · reverse-polarity FET
    ▼
 MPPT buck-boost (≈95 %)  ──►  STATION BUS 12–14.5 V  ◄──►  BUFFER: 6S LTO 5 Ah (13.8 V, 69 Wh) + BMS
                                   │        │                         (warm box, heater-protected)
                                   │        ├─► 5 V / 3.3 V rails (MCU, sensors, comms)  ≈ 2–4 W
                                   │        ├─► actuator driver rail (door, 2 clamps, coupler)  peaks 18 W
                                   │        ├─► IR beacon / LED chevrons / IR illuminators
                                   │        └─► survival heater (switched, thermostat + MCU)
                                   ▼
                        DOCK CHARGER (sync buck-boost, CC/CV, 94 %)
                          CC 3.0 A → CV 14.4 V (rover LiFePO4 4S 12.8 V 10 Ah)
                                   ▼
                  contactor (opens on any fault) → 2 power pogos + 2 sense pogos → rover BMS
```

* **PV budget.** 100 W rated → **70 W** nominal → **66.5 W at the bus** (95 % MPPT). There is no atmosphere on the Moon, so the real derates are cell temperature (−0.35 %/°C: a 110 °C cell gives ~70 W), dust and sun angle; the 70 W figure is a sound planning number, not margin to spend.
* **Charger.** The charger sits on the dock so the rover stays simple; the rover BMS keeps final authority (it can open its own FET). Contacts are **de-energised until latch + contact-resistance check pass** (50 mA sense current, <200 mΩ), then ramped over ~1 s.
* **Polarity / hot-plug safety.** Ring magnets are arranged in an asymmetric N/S pattern so the coupler can only seat one way; sense pogos carry rover-ID and BMS CAN-lite; any loss of the sense line opens the contactor in <10 ms.

### 1.2 Power states (station side; numbers are what the simulator uses)

| State | Station load | Notes |
|---|---:|---|
| **Standby** (door closed, sensors dormant, beacon heartbeat) | **5.0 W** | MCU 1.0, comms 0.8, thermal control 0.7, beacon 0.6, sensor wake 0.4, converter losses ~0.8, margin |
| **Docking** (door, clamps, coupler, sensors, IR illumination) | **9.5 W avg**, peak 18 W | ~6 min sequence; actuators only move for seconds |
| **Charging** | **6.2 W** electronics **+ 43.6 W** charger input (41 W CC to the rover pack) | 49.8 W total vs 66.5 W PV → **+16.7 W** surplus refills the buffer |
| **Night survival** | **2.1 W** | heater 1.7 W (offsets MLI + standoff leak) + 0.4 W wake MCU/RTC; no charging, door shut |

Target "5–10 W baseline" is met in standby and docking. Rover charge from 20 % → 100 % (128 Wh pack): ≈ 102 Wh delivered → **≈ 2.7 h** at 41 W.

### 1.3 Charging controller topology
Synchronous 4-switch buck-boost (so the bus can sit 12–14.5 V while the rover pack sits 10–14.6 V), CC/CV with taper above 90 % SoC (simulator: 41 W → ~5 W), input-current limit tied to PV availability so the charger never browns out the bus, thermal derating from the warm-box NTC, output contactor in series, and a second independent over-voltage comparator (hardware, not firmware).

### 1.4 Fault handling
Over-current, over-temperature, contact-resistance rise, loss of sense line, latch-switch open → contactor opens, charger disables, state machine returns to RETRY (§3).

### 1.5 Night-survival budget (the honest numbers)

| Quantity | Value |
|---|---|
| Night length (equatorial) | ~354 h |
| Warm box (30-layer MLI, 0.56 m²), held at −20 °C | leak **1.7 W** (ε_eff 0.005) · 2.3 W (0.01) · 3.5 W (0.02) |
| Survival load | **2.1 W** (best case) … 3.9 W (poor MLI) |
| 5 Ah LTO usable (80 % DoD) | 55 Wh → **26 h** (best) … 14 h (poor) |
| Energy for a full night | **743 Wh** → **67 Ah @ 13.8 V** (80 % DoD) |
| Alternatives | ~2 RHU-class heater units (≈1 W_th each) in place of the electric heater; or site the dock on a peak of near-eternal light; or add a ~0.9 kWh "night pack" and accept the mass |

Design response: keep the 5 Ah pack as specified, mark the night pack / RHU as **a decision for the team** (§5 optional line items), and let the station fall back to **cold-soak hibernate** (only the wake MCU on a supercap, battery cell below its −40 °C limit is *not* protected) if the reserve runs out.

---

## 2. Docking & alignment mechanism

### 2.1 Layers of tolerance (coarse → fine)

| Layer | Captures | Residual after | Hardware |
|---|---|---|---|
| Sensor servo (§3) | start ±3 m lateral | ±2 mm, ±0.5° (simulated, 500 runs) | cameras, UWB, hall array |
| Door + fixed lead-in flares | ±0.35 m | — | existing apron flares |
| **Parallel-jaw clamp arms** | ±0.30 m each side, ±15° | **±3 mm, ±1°** | two lead-screw actuators per side, bar stays parallel to the bay axis |
| **Hard-stop bumper** | along-axis | ±5 mm | spring bumper + limit switch |
| **Floating coupler** | ±8 mm, ±3° | seated, contact-force controlled | 2-axis float on springs, magnet funnel |

### 2.2 Clamp ("assist") arms
* Two bars, 1.5 m long, riding cross-slides on each side wall; each driven by **2 lead-screw linear actuators** (synchronised by a rack-and-pinion tie so the pair always centres on the bay axis).
* Open: 0.725 m from centreline (clearance 0.30 m past the wheels). Closed: 0.425 m (wheel outer face is ~0.41 m). Rubber pads, 0.35 m flared lead-in on the door-side end.
* Stroke time 1.6 s; stall-current limited so a mis-capture cannot crush a wheel; a force/current spike aborts and retries.

### 2.3 Magnetic coupling interface
* **Rover side:** top-deck pad (220 × 200 mm) with 2 brass power rails, a ferromagnetic keeper, and a chamfered recess.
* **Dock side:** coupler head descends from the roof on a telescoping column, hanging on a 2-axis spring float. Two **N42SH** ring magnets (SH grade for temperature) give ~30–40 N total pull at contact; 4 spring pogos (2 power, 2 sense) at ~1.5 N each; a 3-axis **hall array** reads the pad magnet to centre the head to <1 mm before contact.
* Mating sequence: hover → hall-centre → lower → magnet snap → contact-resistance check → latch pin → ramp.

### 2.4 Tolerance stack (why ±8 mm float is enough)
Sensor residual 2 mm + clamp compliance 3 mm = 5 mm lateral, inside the ±8 mm float; 5 mm along-axis is absorbed by pogo travel. Thermal growth over a 300 K swing (aluminium, 4 m span ≈ 28 mm total) is taken up by slotted mounts, and the coupler and pad sit close together so their *differential* growth is small.

---

## 3. Parking-assist sensor pipeline

### 3.1 Sensor selection & placement

| Zone | Range | Dock-side | Rover-side | Accuracy |
|---|---|---|---|---|
| **Far-field** | 50 → 14 m | UWB anchors ×2 (roof corners) + coded 940 nm IR beacon / strobe (mast) | UWB tag; 4-quadrant IR receiver; mastcam sees strobe | bearing ±1°, range ±0.10 m |
| **Mid-field** | 14 → 3.6 m | **300 mm active-IR fiducial** above the door | Mastcam (Arducam OV5647, 5 MP, 54° HFOV) | 300 mm tag = 95 px at 8 m, 25 px at 30 m; lateral σ ≈ 1.2 mm per metre |
| **Near-field** | 3.6 m → coupler | **100 mm fiducial** on aft wall + 8× 850 nm LED ring (light-independent) | Global-shutter nav camera (IMX296 class) + VL53L5CX multizone ToF on the nose | lateral σ ≈ 0.6 mm per metre of range |
| **Final** | < 0.6 m | **Hall array** in coupler head; 2× side TF-Luna LiDAR on walls; bumper limit switch | Pad magnet; wheel odometry + IMU | < 1 mm lateral at contact |
| **Truth/safety** | all | Door and clamp encoders, current sensing | YDLIDAR X2L for obstacle/rock check on the apron | — |

**Why active fiducials:** lunar low-sun glare and hard shadows make passive printed tags unreliable. Self-illuminated IR tags with an IR band-pass filter give the same contrast at noon, dusk and night. (Tag patterns in the sim are tag36h11-*style* placeholders; use the real tag36h11 family on hardware.)

**Fusion:** EKF on lateral offset, heading and range; 30 Hz vision updates, 1 % frame-drop tolerance (simulated), outlier gating, IMU/odometry dead-reckoning bridges dropouts. The simulator uses a filtered 30 Hz estimate with range-dependent noise.

### 3.2 Docking state machine

```
 TRANSIT ─► ALIGN ─► ENTER ─► CAPTURE ─► LATCH ─► CHARGE(DOCKED)
 (far-field)  (squared at gate) (visual servo)  (clamps + bumper) (coupler + contacts)
     ▲            │       │          │              │
     └── RETRY ◄──┴───────┴──────────┴──────────────┘   ≤3 retries → FAULT (hold, call operator)
```

| State | Entry condition | Action | Exit / abort |
|---|---|---|---|
| **TRANSIT** (Approach) | RTH command | A* to the staging point 8.4 m out, door opens < 24 m | within apron → ALIGN |
| **ALIGN** (Fine align) | on apron, door ≥ 80 % open | Stanley path to the gate at 3.8 m, then in-place squaring to ±0.9° | settled 0.5 s → ENTER; inside gate, too tight a run-in, or lateral error > 150 mm → RETRY |
| **ENTER** | squared, door clear | 0.30 → 0.18 m/s visual servo down the centreline | pre-capture plane (x = −0.78): need ≤ 30 mm and ≤ 3° → CAPTURE, else RETRY; leaves ±250 mm corridor → RETRY |
| **CAPTURE** | pre-capture OK | clamps close (1.6 s), rover creeps at 0.10 m/s to the bumper switch | arms closed + at stop → LATCH |
| **LATCH** | captured | coupler descends, hall-centres, magnets snap, contact-resistance check, latch pin | residual ≤ 8 mm / 3° / 15 mm → CHARGE; else RETRY |
| **CHARGE** (`DOCKED`) | latched | contactor closes, current ramps, door closes | rover commanded to depart → UNDOCK |
| **UNDOCK** | depart command | contactor opens, coupler lifts, clamps open, **then** door/exit | `releaseReady()` gates the exit |
| **RETRY / FAULT** | any abort | open clamps, stow coupler, reverse straight out to ≥ 6.5 m, re-run ALIGN | 4th failure → FAULT |

### 3.3 Simulated results (controller on the simulator's drive dynamics, noisy sensors)
500 randomised starts (6–12 m out, ±1.5 m lateral, any heading): **500/500 docked, 0 retries; pre-capture error median 0.3 mm / 0.05°, worst 1.9 mm / 0.5°; ≈ 42 s start-to-latch.** Adversarial starts (3–12 m, ±2.8 m): 400/400 docked with automatic back-out and retry. This is a controller-level result; the in-simulator regression (`?selftest=dock&n=10`) is the check on the full 3D sim.

---

## 4. Thermal control subsystem (−150 °C … +150 °C)

### 4.1 Strategy
Keep the **warm box** (battery, charger, MCU) inside a narrow band (−20 … +45 °C), isolate it from the extremes with MLI and low-conductance supports, reject day-side heat from a zenith radiator that is *thermally switched off* at night, and use as little electric heating as possible.

### 4.2 Component breakdown

| Function | Hardware | Notes |
|---|---|---|
| Insulation | **30-layer MLI** (aluminised Kapton/Mylar + Dacron spacers), outer layer Kapton + ITO for charge bleed | ε_eff 0.005–0.02; seams overlapped, vented |
| Supports | G10/Ti-6Al-4V standoffs, 6×; harness through thermal breaks | conduction ≈ 1.1 W at ΔT 130 K |
| Radiator | **0.16 m² zenith-facing**, silver-Teflon or OSR (α/ε ≈ 0.07/0.80) or Z93P white (0.17/0.92) | rejects **≈ 270–340 W/m² net at 40 °C even at lunar noon** → needs 0.03–0.06 m²; 0.16 m² gives >2× margin |
| Why not vertical | A vertical panel sees ground at ~390 K: **net −100 W/m² at noon** (it would *absorb* heat) | use zenith-facing + shade or a ground skirt |
| Heat transport | **Ammonia / aluminium axial-groove heat pipes** (3×) from warm box to radiator | **Not copper-water** — water freezes at −150 °C and bursts the pipe; ammonia pipes survive freeze/thaw |
| Day/night switching | **Bimetallic thermal louvers** over the radiator (open ~25 °C, closed ~5 °C, passive) + variable-conductance (gas-loaded) heat pipe so the radiator floats cold at night | night loss of an un-isolated radiator at 20 °C would be ~58 W; isolated and louvered it is ~1 W |
| Survival heaters | Kapton foil heaters on battery and charger, **thermostat in series** (hardware backup) + MCU PWM | 1.7 W at −20 °C hold |
| Battery chemistry | **LTO** (accepts charge to −30 °C, stores to −40 °C) instead of LiFePO4 (no charging < 0 °C) | |
| Dust | labyrinth + brush seal on door, electrodynamic dust screen on tag windows and radiator, sealed actuators | IP6X-class on the bay, conformal-coated PCBs |
| Moving-part lubrication | MoS₂/PTFE dry film, **no grease** | greases stiffen at −150 °C |
| Sun/ground shield | polished shade over radiator at low sun angle | |

### 4.3 Thermal states

| State | Warm box | Radiator | Louvers | Heater | Notes |
|---|---|---|---|---|---|
| Day, idle | ~24 °C | ~41 °C | partly open | 0 | rejects ~2.4 W |
| Day, charging | ~30 °C | ~41 °C | fully open | 0 | rejects ~7 W (charger loss ~3 W + electronics) |
| Night survival | −20 °C | ≈ −160 °C | closed | 1.7 W | 26 h on the 5 Ah buffer |
| Dawn restart | warm up on PV first, charge only when box > −10 °C | | | | LTO charging allowed ≥ −30 °C |

### 4.4 Peak-day check
Ground at 150 °C (423 K) radiates onto the shelter walls; the MLI-lined bay and its low-α white roof limit shelter wall temperature, the box sits behind MLI and the radiator sees only sky. Electronics are derated to 85 °C junction; the louvers and heat pipes keep the box below +45 °C. Actuator motors run only seconds per sequence.

### 4.5 Open risk (honest)
Full-night survival with only 5 Ah is **not possible** (§1.5). The simulator's ENV toggle shows the night state and prints the remaining hold time.

---

## 5. Bill of materials

Notes: **Prototype** column is available COTS for an Earth-based HUNCH build; **Flight-like** is what a real lunar unit would use. Part numbers are real product lines but **verify current availability, specs and price before ordering**; prices are rough (USD).

### 5.1 Sensing
| Item | Prototype part | Qty | ≈ $ | Flight-like note |
|---|---|---:|---:|---|
| Far-field UWB | Qorvo DWM3001C (anchors ×2, tag ×1) | 3 | 60 | rad-tolerant UWB or optical beacon only |
| IR beacon + strobe | 940 nm high-power LED + TSOP38238 receivers on rover | 1 set | 30 | coded 38 kHz |
| Mastcam | Arducam OV5647 5 MP (already on rover) | 1 | 0 | add IR band-pass filter |
| Near-field camera | Raspberry Pi Global Shutter (IMX296) + 6 mm lens + 850 nm filter | 1 | 70 | |
| Active fiducials | 100 mm and 300 mm tag36h11 on diffused IR LED backplates | 2 | 40 | |
| Multizone ToF | ST VL53L5CX breakout | 1 | 20 | |
| Side LiDAR | Benewake TF-Luna ×2 | 2 | 50 | |
| Hall array | TI DRV5055 ×3 (or Melexis MLX90393 3-axis) | 3 | 10 | |
| Bumper switch | snap-action limit switch, sealed | 2 | 10 | |

### 5.2 Actuation & mechanics
| Item | Prototype part | Qty | ≈ $ |
|---|---|---:|---:|
| Clamp actuators | Actuonix L16 / L12-class 100 mm linear actuators with position feedback | 4 | 280 |
| Door drive | NEMA17 + lead screw + TMC2209 (or existing slat door motor) | 1 | 60 |
| Coupler lift | Actuonix L12-50-class | 1 | 70 |
| Magnets | N42SH ring magnets 20 mm | 4 | 20 |
| Pogo pins | spring-loaded 3 A class ×4 + keeper | 1 set | 15 |
| Structure | 6061-T6 frame, G10 standoffs, stainless fasteners, rubber pads | — | 150 |
| Dust seals | brush/labyrinth strips | — | 25 |

### 5.3 Power
| Item | Prototype part | Qty | ≈ $ |
|---|---|---:|---:|
| PV panel | HQST 100 W (already in sim/BOM) | 1 | 100 |
| MPPT | Genasun GV-10-class (prototype); custom LM5176-based buck-boost (flight-like) | 1 | 120 |
| Dock charger | CC/CV buck-boost, 14.4 V / 3–5 A (e.g., programmable DC-DC with CAN) | 1 | 60 |
| Buffer battery | **6S LTO 5 Ah pack with BMS** (cells: Toshiba SCiB / Yinlong class — confirm cell and capacity with vendor) | 1 | 250 |
| Contactor | automotive-grade relay + parallel FET stage | 1 | 20 |
| Controller | Raspberry Pi 5 (already) or STM32 for safety layer + Arduino/STM32 motion | 1 | 50 |
| Protection | fuses, TVS, reverse-polarity FET | — | 20 |

### 5.4 Thermal
| Item | Part | Qty | ≈ $ |
|---|---|---:|---:|
| MLI blankets | custom 30-layer aluminised Kapton/Mylar (Dunmore / Sheldahl-class) | 1 set | 200 |
| Radiator + coating | Al panel, silver-Teflon tape or Z93P-class paint | 1 | 120 |
| Heat pipes | ammonia / aluminium axial groove, ~300 mm | 3 | 450 |
| Louvers | bimetal-actuated louver set (custom; prototype uses bimetal springs + aluminium vanes) | 1 | 150 |
| Heaters | Minco / Kapton foil heaters 2–5 W | 3 | 90 |
| Thermostats / NTC | bimetal thermostat (series backup) + 10 k NTC ×6 | 1 set | 40 |
| Dust screen | electrodynamic dust shield film (prototype: sealed windows) | 1 | 60 |

### 5.5 Optional (decision for the team)
| Item | Purpose | ≈ $ |
|---|---|---:|
| 67 Ah (≈ 0.9 kWh) night pack | full 354 h night survival | 800+ and ~8–10 kg |
| RHU-class heaters | replaces electric night heating | not obtainable for HUNCH |

---

## 6. Simulator implementation (what you will see)

* **Hardware:** two parallel-jaw clamp bars on lead-screw actuators; floating magnetic coupler that descends and tracks the rover pad; aft and facade fiducials with IR rings; UWB anchors; side LiDAR; bumper switch; zenith radiator with animated louvers and heat pipes; gold MLI warm box with a heater glow at night.
* **Behaviour:** press **Charge** or click the map near the dock. Rover transits, squares up, enters on the centreline, clamps close, coupler lowers, magnets snap, contacts go live (charging at 41 W CC), door closes. **Depart** releases coupler, clamps, then exits.
* **HUD (bottom-left):** state, active sensor, lateral/yaw error, clamp %, coupler %, latch, PV/load/buffer, warm-box/radiator/louver/heater; **ENV** button toggles day/night.
* **Regression:** open `viewer.html?selftest=dock&n=10` (or run `runDockSelfTest(20)` in the console). Each run teleports the rover to a random apron pose, docks, charges 20 s, departs, and reports pre-capture error, final residual, retries and charge power.
* **Files changed:** `js/dock_station.js` (new), `viewer.html` (hooks; original saved as `_archive/viewer.pre-dock-backup.html`).
