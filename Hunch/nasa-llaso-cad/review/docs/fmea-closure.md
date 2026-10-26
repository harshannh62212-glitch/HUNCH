---
title: "FMEA Closure Log (Engineering Notebook Extract)"
date: 2026-09-29
tags: [review, design]
---
# FMEA Closure Log (Engineering Notebook Extract)

Source narrative: `Hunch/nasa-hunch-rover/src/data/failureLog.js` — exported here for judges (print/PDF).

| ID | Subsystem | Severity | Status | Verification |
|----|-----------|----------|--------|--------------|
| NCR-001 | Compute & power | Critical | Resolved | 150 stall cycles, logic rail <22 mV ripple |
| NCR-002 | Drivetrain | High | Resolved | 28° regolith incline, 4 h crawl, gearbox inspection |
| NCR-003 | Thermal | Moderate | Resolved | 3 h @ 45°C, MOSFET 64°C |
| NCR-004 | LiDAR / optics | Moderate | Resolved | 100 runs vs halogen sun simulator |
| NCR-005 | Dock: pogo overload | High | Open | Charger carries 5 A through 2 power pogos; needs 5 A-class parts in a 2+2 pattern |
| NCR-006 | Dock: jaw on wheel | High | Mitigated in sim | Capture window tightened to 12 mm / 1°, jaw-load abort added; confirm on hardware |
| NCR-007 | Dock: door jam / obstruction | Moderate | Open | No photo-eye or obstruction reverse yet |
| NCR-008 | Dock: dust on contacts and radiator | Moderate | Open | Not modelled; needs brush seals and a contact-resistance check |
| NCR-009 | Dock: cold charging | High | Mitigated in sim | LiFePO4 charge blocked below 0 °C box temperature; confirm heated box |

## NCR-001 — Motor reverse-EMF brownout

- **Symptom:** MCU reset on hard skid-steer stalls.
- **Fix:** Dual isolated 5 V rails, TVS on motor inputs, optical PWM isolation.
- **Design link:** `hardware_specification_sheet.md` buck converter section.

## NCR-002 — Gearbox tooth stripping

- **Symptom:** Stall on 22° loose aggregate.
- **Fix:** 1:31.6 planetary motors, software current foldback.
- **Design link:** Torque ≥28–35 kg·cm stall target in hardware spec.

## NCR-003 — Driver thermal trip

- **Symptom:** BTS7960 thermal shutdown at 42 min enclosed.
- **Fix:** Chimney vents + 304 mesh + aluminum spreader plate.

## NCR-004 — LiDAR sun washout

- **Symptom:** False emergency stops in clear terrain.
- **Fix:** Glare cowls + Amp threshold + camera cross-check.

## NCR-005 to NCR-009 — Dock (opened Oct 2026 from the dock and rover review)

- **NCR-005 Pogo overload.** 64 W at 12.8 V is 5 A. The design note assumed 3 A. At up to 200 mΩ contact resistance, 5 A dissipates about 5 W with no convection in vacuum, and one failed power pin puts the full current through a 3 A part. Fix: 5 A-class pogos in a 2+2 power pattern with 2 sense pins, or cap the charge current near 3 A (41 W).
- **NCR-006 Jaw on wheel.** The closed jaw pad face is at 0.416 m from the centreline and the widest wheel at 0.389 m, so there is about 27 mm of room per side, less 3.6 mm of thermal growth. At 3° of yaw the corner wheel swings out 24 mm. Fix applied in `dock_station.js`: pre-capture window 12 mm and 1°, jaw-load abort if the rover is still off-centre when the jaws are almost shut. Still needs a force sensor on hardware.
- **NCR-007 Door jam.** The door has no photo-eye and no obstruction reverse. Fix: add a photo-eye and a current-spike reverse.
- **NCR-008 Dust.** Dust on the tag windows, pogos, pad and radiator is not modelled. Fix: brush seals, a contact-resistance check before latch, and a radiator absorptivity margin.
- **NCR-009 Cold charging.** LiFePO4 must not charge below 0 °C, but the warm box sits near −22 °C at night. Fix applied: the code blocks charging when the box is below 0 °C. Needs a heated box confirmed on hardware.

## Note on NCR-001 to NCR-004

These rows were written against an earlier parts list and a convection-cooled enclosure. Before the next review, reconcile the named parts (BTS7960 driver, dual isolated 5 V rails, 1:31.6 planetary motors) with `rover_bom.js` (Cytron MDD10A driver, one buck converter, Greartisan 12 V 100 RPM motor), and note that chimney vents and mesh rely on air, which the Moon does not have.
