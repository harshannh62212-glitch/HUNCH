---
name: lunar-robotics-guidelines
description: "Core physical constants, electrical tolerances, and hardware rules for NASA HUNCH lunar rover development."
trigger: "always_on"
---

# NASA HUNCH Robotics & Physics Guidelines

When writing, debugging, or reviewing code, CAD models, or telemetry calculations for the NASA HUNCH rovers:

## 1. Gravitational & Dynamic Physics
- **Lunar Gravity:** Always use $g = 1.622\,\text{m/s}^2$ (approx $1/6$ Earth gravity $9.80665\,\text{m/s}^2$).
- **Inertial Mass vs Normal Force:** When calculating acceleration, braking distance, and turning stability, remember that while weight decreases by $83.5\%$, **inertial mass ($m$) is identical to Earth**. Traction is dramatically reduced ($\mu_{\text{track}} \approx 0.55\text{--}0.65$), meaning braking distances are substantially longer.
- **Motor Sizing Rule:** All drive motors must be sized for **Earth testing (1.0g)** so physical demonstrator units perform reliably during evaluation, providing a $6\times$ safety margin on the Moon.

## 2. Power Electronics & Computing
- **Raspberry Pi 4/5 Brownout Protection:** The YDLIDAR laser motor draws up to $1.0\,\text{A}$ startup current on top of the Pi's $2.5\text{--}3.5\,\text{A}$ AI inference spike. Standard 3A buck converters (like LM2596) will trigger `Under-voltage detected!`. **Always require a 5.0A continuous (8.0A peak) converter (XL4015 or UBEC).**
- **Battery System:** 12.8V nominal $\text{LiFePO}_4$ (4S) chemistry is mandatory for safety (non-explosive, flat discharge curve).
- **Motor Driver:** Dual H-bridge rated for at least $10\,\text{A}$ continuous per channel (Cytron MDD10A) to absorb stall spikes ($4.5\text{--}5.5\,\text{A}$ per motor).

## 3. Structural Fabrication
- **3D Printing Material:** Use **PETG** with 4 perimeters/walls and 35–40% gyroid infill (never PLA, which fails catastrophically under motor thermal strain).
- **Fasteners:** Always specify M3 and M4 brass heat-set threaded inserts installed at $230^\circ\text{C}$ into pre-sized bosses, with nylon locknuts for crawler vibration damping.
