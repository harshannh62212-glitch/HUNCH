# FMEA Closure Log (Engineering Notebook Extract)

Source narrative: `Hunch/nasa-hunch-rover/src/data/failureLog.js` — exported here for judges (print/PDF).

| ID | Subsystem | Severity | Status | Verification |
|----|-----------|----------|--------|--------------|
| NCR-001 | Compute & power | Critical | Resolved | 150 stall cycles, logic rail <22 mV ripple |
| NCR-002 | Drivetrain | High | Resolved | 28° regolith incline, 4 h crawl, gearbox inspection |
| NCR-003 | Thermal | Moderate | Resolved | 3 h @ 45°C, MOSFET 64°C |
| NCR-004 | LiDAR / optics | Moderate | Resolved | 100 runs vs halogen sun simulator |

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
