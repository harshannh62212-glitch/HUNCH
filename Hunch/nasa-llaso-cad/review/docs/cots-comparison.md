# Commercial Off-The-Shelf (COTS) Comparison

**Purpose:** Show judges we evaluated existing parts before custom design (HUNCH tri-fold requirement).

| Category | Option evaluated | Why kept / rejected | Selected for build |
|----------|------------------|---------------------|--------------------|
| Drive motor | Generic 12 V 250 RPM 1:10 spur gear | Stripped nylon teeth under incline (FMEA NCR-002) | JGB37-550 30:1–50:1 (~35 kg·cm stall) |
| Motor driver | L298N dual H-bridge | Insufficient continuous current | Cytron MDD10A (10 A cont.) |
| 5 V supply | LM2596 3 A buck | Pi + LiDAR brownout on spin-up | XL4015 5 A / Pololu D24V50F5 |
| LiDAR | YDLIDAR X4 / TF-Luna class | TF-Luna triple array for forward + side clearance | Benewake TF-Luna (per failure log NCR-004) |
| Compute | Arduino UNO R4 WiFi + RPi | Split: real-time PWM + vision stack | Dual-compute architecture in handoff |
| Chassis material | PLA truss | Brittle impact failure | PETG 4-wall gyroid 35–40% |
| Tracks vs wheels | Skid-steer wheels | High sinkage on regolith sim | Printed track + sprocket CAD meshes |

Full torque and electrical sizing: `Hunch/nasa-hunch-rover/cad_model/hardware_specification_sheet.md`.
