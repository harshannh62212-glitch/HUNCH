---
title: "AEGIS-V1 rover v4 — swerve drive in a 24 in cube"
date: 2026-10-28
tags: [review, design, rover]
---
# AEGIS-V1 rover v4 — swerve drive in a 24 in cube

**Status:** CAD + simulator implementation. **Code:** `js/fusion_rover.js` (model, `GEOM`), `js/rover_bom.js` (parts, masses, CoM), `js/rover_dynamics.js` (wheel loads), `viewer.html` (swerve, grip, load transfer, ballast, tip-over), `js/dock_station.js` (dock fit). **Checks:** `node tools/cad_model_check.js` (28 checks). Related: [[dock-station-design]], [[runtime-energy-analysis]], [[test-plan]].

## 1. Envelope — fits a 24 in (0.6096 m) cube

| | v4 | limit |
|---|---:|---:|
| Length, stowed (bumper to tail) | 0.580 m | 0.6096 |
| Width, wheels straight | 0.552 m | 0.6096 |
| Width / length with every module steered through 360° | 0.604 / 0.584 m | 0.6096 |
| Height (top of lidar; stowed arm elbow 0.576) | 0.563 m | 0.6096 |
| Ground clearance (belly skid plate) | 0.064 m | — |

The arm stows folded back over the deck (base yaw π, shoulder 1.25 rad, elbow −2.6 rad) so it never sticks out of the cube.

## 2. Layout

Root frame: +X forward, +Y up, ±Z sides, ground at y = 0.

- **Six swerve modules** at x = +0.215 / 0 / −0.215, z = ±0.225. Each module:
  - 130 mm wheel: PETG rim with six spokes, TPU tread with 24 chevron grousers.
  - In-hub 37 mm gearmotor for drive.
  - goBILDA 25-2 dual-mode servo in continuous mode for steering, driving a 12:36 pinion / ring gear.
  - AS5600 absolute encoder and a 6-wire slip ring, so steering is unlimited (true 360°).
  - Coil-over strut on the steering axis, ±20 mm stroke.
  - 12 motors in all. A module sweeps r = 0.077 m as it turns: neighbours are 0.215 m apart (> 0.154 m) and the belly tub edge is at 0.138 m (< 0.148 m), so nothing can touch while steering.
- **Belly tub** (z ±0.138, y 0.066–0.205) holds the 12.8 V 5 Ah LiFePO4 pack in the centre on a lead-screw sled (hot-swap door aft), plus the Pi 5, Arduino Mega, three MDD10A drivers, PCA9685 and the buck converter.
- **Deck** (y 0.225) carries:
  - avionics pod with the dock charge pad on its roof (copper face y 0.297, x +0.19);
  - arm turret (front port);
  - sensor mast with stereo pair and YDLIDAR X2L (front starboard);
  - two cargo cradles (aft).

## 3. Cargo canisters and how they ride

The cargo module is no longer a box. It's a pressure-vessel **canister**: 1.04 m long × 0.60 m diameter flight article, 0.26 × 0.15 m at 1:4, 5 lb, with:
- 2:1 elliptical domed ends;
- a gold MLI belt and two machined girth rings;
- a **trunnion pin** on each dome;
- a **mushroom grapple knob** on top.

The arm grips the knob neck. The canister hangs from it like a gimbal: plumb under the fingertip with a damped pendulum swing (see the [[2026-10-28]] notes).

On the rover, the two canisters lie **crosswise** in **V-saddles** (flanks tangent at ±36°, rubber pads). Rotary latch hooks close over the trunnions once seated. The cradle pitch is 0.157 m, so the canisters sit 7 mm apart. `cargo_types.js` gives canisters a vee saddle.

## 4. Parts, masses and sources

Masses are from vendor listings for bought parts and estimates (★) for printed or machined parts. The raw sum is 6.70 kg; `rover_bom.js` scales every line by 1.015 to the 15 lb (6.80 kg) prototype curb mass, keeping each part's share.

| Part | Qty | Each | Source / note |
|---|---:|---:|---|
| 12.8 V 5 Ah LiFePO4 (107 × 90 × 70 mm) | 1 | 0.80 kg | listing: 0.8 kg, 90 × 70 × 107 mm ([solaranlage-tipps pbq 12.8 V 5 Ah](https://www.solaranlage-tipps.de/speicher/pbq-lifepo4-akku-12-8v-5ah-inkl-bms-balancer-faston-6-3.md)) |
| Greartisan 12 V 37 mm gearmotor (drive) | 6 | 0.200 kg | existing BOM |
| goBILDA 2000-0025-0002 dual-mode servo (steer, continuous) | 6 | 0.062 kg | 60–64 g ([Core Electronics](https://core-electronics.com.au/2000-series-dual-mode-servo-25-2-torque.html), [ServoCity](https://www.servocity.com/2000-series-dual-mode-servo-25-2)) |
| YDLIDAR X2L | 1 | 0.19 kg | Φ60.5 × 96 mm; listed weights disagree (0.2–0.6 kg incl. packaging), 0.19 kg used ([robotshop](https://ca.robotshop.com/products/xiaor-geek-ydlidar-x2l-360-scanning-laser-radar)) |
| Raspberry Pi 5 + active cooler | 1 | 0.060 kg | |
| Arduino Mega 2560 / PCA9685 | 1 / 1 | 0.037 / 0.009 kg | |
| Cytron MDD10A | 3 | 0.050 kg | existing BOM |
| 130 mm wheel ★ / swerve module ★ / coil-over | 6 each | 0.095 / 0.085 / 0.030 kg | |
| Belly tub + deck ★ | 1 | 1.45 kg | 6061 rails + PETG panels |
| Arm + gripper (3 servos) ★ | 1 | 0.46 kg | |
| Cradles ★, avionics pod ★, mast ★, harness ★ | — | 0.20, 0.14, 0.09, 0.20 kg | |

Not chosen: goBILDA 5203 Yellow Jacket motors weigh 0.39–0.49 kg each (six would add 1.5–1.7 kg) ([goBILDA](https://gobilda.com/5203-series-yellow-jacket-motor-1-1-ratio-24mm-length-8mm-rex-shaft-6000-rpm-3-3-5v-encoder)).

## 5. Balance

| | Empty | Two canisters (2 × 2.27 kg) |
|---|---:|---:|
| Mass | 6.80 kg | 11.34 kg |
| CoM x (fore +) | +31 mm | −35 mm |
| CoM z | +4.5 mm | +2.7 mm |
| CoM height | 169 mm | ~215 mm |
| Side force to tip (`tipMarginRoll`) | 2.12 m/s² | ~1.7 m/s² |

The empty rover is slightly nose-heavy so that, once loaded, the CoM sits about the same distance behind the centre. Wheel loads stay even in both states.

## 6. Physics in the simulator

- **Swerve kinematics.** Module *i* at (x, z) steers along (v + ω·z, u − ω·x).
  - The steering rate is limited to 1.75 rad/s (servo through the 12:36 gear).
  - A module turns the short way and reverses its drive past 90°.
  - The chassis drives and yaws only as far as the modules are lined up (`cos` of the heading error). Misaligned modules scrub.
  - A pivot in place puts the corner modules at ±44° and the middle pair straight.
- **Per-wheel grip.** The drive torque is split equally over six motors.
  - Each wheel delivers at most μ·Nᵢ (from the rigid-body load solve) × its alignment.
  - Traction control hands 80 % of a slipping wheel's shortfall to the others.
  - Lifted wheels deliver nothing. Wheelspin is per wheel.
- **Closed-loop wheel speed.** The speed controller adds gravity feed-forward (encoders + PID) to hold speed on grades, within motor force and grip.
- **Load transfer.** Accelerating moves load to the rear wheels, braking to the front, cornering to the outside.
  - Each corner sags (Nᵢ − N_static,ᵢ)/k with k giving 8 mm static sag.
  - The body heaves, pitches and rolls on a 2.5 Hz damped spring; wheels stay on the ground.
- **Active ballast.** The 0.8 kg battery sled moves ±50 mm on a lead screw at 80 mm/s against the fore-aft inertial force. When the rover accelerates forward it shifts weight forward, putting load back on the front wheels.
- **Tip-over.** Rigid-body rotation about the outer wheel line:
  - overturning moment f·(h cos a + d sin a), against the restoring moment gₙ·(d cos a − h sin a);
  - f = slope gravity + inertia + centripetal;
  - past ~80° the run ends: "TIPPED OVER" names the side, CoM height, track and forces.
  - Verified: holds at 2.0 m/s² sustained side force, rolls at 2.2 (statics predict 2.12); a 0.35 s 2.9 m/s² spike lifts 8° and lands back.

## 7. Dock and logistics fit

- **Dock:** park centre −1.538 (5 mm nose gap), pad offset −0.19, pre-capture −1.138. Clamp jaws close to ±0.31 on the wheel modules (bar 0.50 m, rods 0.80 m, screw 1.12 m).
- **Logistics:** half-length 0.30, half-width 0.305; the arm stows to the published pose.
- **Regression results:**
  - Simulator dock: latched, 0 retries, 0.36 mm residual.
  - Cargo run: parks within 2–5 mm / 0.15°; canisters seat within 0.9 mm.
  - Nav benchmark: 12/12 with no crashes, crater entries, rock contacts or tip-overs. Top speed is now 0.49 m/s (130 mm wheels at the same RPM).
