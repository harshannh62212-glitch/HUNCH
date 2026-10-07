# NASA HUNCH SFT 2026-27 | LLASO Project 1
## Lunar Logistics Supply Chain (VR Simulation, Game & Math Model)
**NASA Reference Name:** `LLASO-P1-VR-2026`  
**Requested By:** NASA HUNCH / Kennedy Space Center  
**Target:** 40-ft (~12.2 m) Long × 3.0 m Diameter Cylindrical Lunar Cargo Module

---

## 🛰️ 1. Internal Structural Architecture

The proposed internal architecture optimizes packing capacity, robotic accessibility, and mass distribution within a $3.0\,\text{m}$ outer diameter ($2.8\,\text{m}$ usable inner diameter) by $12.192\,\text{m}$ (40 ft) cylindrical pressure vessel:

```
[ AFT BULKHEAD: x = -6.1m ]                                              [ FWD DOCKING HATCH: x = +6.1m ]
+-------------------------------------------------------------------------------------------------------+
|  [Cryo Tank A]   [Bay 7: D13-14]  [Bay 6: D11-12]  ...  [Bay 2: D3-4]   [Bay 1: D1-2]  [Science POD]   |
|   (Oversized)        Tier 1-3         Tier 1-3              Tier 1-3        Tier 1-3     (Early Staging) |
|=======================================================================================================|
|  <--- CEILING GANTRY RAIL (X-Axis: 11m travel) + TELESCOPING ROBOTIC MAST (Z-Axis) & EXTRACTOR --->   |
|-------------------------------------------------------------------------------------------------------|
|  <----------------- CENTRAL UTILITY & MOBILITY CORRIDOR (Width: 0.90 m) ----------------------------> |
|=======================================================================================================|
|  [Cryo Tank B]   [Bay 7: D13-14]  [Bay 6: D11-12]  ...  [Bay 2: D3-4]   [Bay 1: D1-2]  [Airlock Buffer]|
|   (Oversized)        Tier 1-3         Tier 1-3              Tier 1-3        Tier 1-3    (Dust Exclusion)|
+-------------------------------------------------------------------------------------------------------+
```

1. **Walking & Rolling Deck**: Flat honeycomb composite deck at $z = -0.72\,\text{m}$, providing a $1.8\,\text{m}$ wide base with integrated floor guide rails and sub-floor utility ducting.
2. **Ceiling Rail & Autonomous Gantry Robot (ILTR)**: Continuous overhead track at $z = +1.25\,\text{m}$ supporting a 3-DOF robotic cargo extractor (11m longitudinal $X$ transit, $\pm 0.4\,\text{m}$ lateral $Y$ reach, $0.9\,\text{m}$ vertical $Z$ telescoping stroke).
3. **Modular Rack Bays (Port & Starboard)**:
   - 7 distinct longitudinal bays per side (total 14 main bays).
   - 3 vertical tiers per bay:
     - **Tier 1 (Lower)**: Heavy Single & Double Metal Stowage Lockers (lowers center of gravity).
     - **Tier 2 (Mid)**: Standard 1U–4U Cargo Transfer Bags (CTBs) and intermediate spares.
     - **Tier 3 (Upper)**: High-access 1U CTBs, emergency medical kits, and fresh food rations.
4. **Aft Heavy & Irregular Cargo Bay ($x = -5.6\,\text{m}$ to $-4.4\,\text{m}$)**:
   - Houses two vertical Cryogenic/Fluid Cylinders ($4\,\text{ft} \times 2\,\text{ft}$) with structural tie-down ring collars.
5. **Dust & Regolith Exclusion Buffer**:
   - Forward hatch ($x = +6.096\,\text{m}$) features a standard $1.2\,\text{m}$ pressurized docking collar compatible with lunar surface habitats, rovers, and pressurized transfer tunnels.

---

## 📦 2. Cargo Standardization & Models

| Cargo Category | Standard Types Modeled | Dimensions ($L \times W \times H$) | Description |
| :--- | :--- | :--- | :--- |
| **CTB** | 1U, 2U, 3U, 4U | $0.25 \times 0.43 \times 0.50\,\text{m}$ (1U) | Flight Nomex soft stowage bags with handles |
| **Metal Lockers** | Single (1U) & Double (2U) | $0.44 \times 0.28 \times 0.51\,\text{m}$ (Single) | Precision aluminum lockers with captive latches |
| **Fluid Cylinders** | Cryogenic O2/Water Tank | $\varnothing 0.61\,\text{m} \times 1.22\,\text{m}$ ($2 \times 4\,\text{ft}$) | High-pressure composite over-wrapped vessels |
| **Science POD** | Modular Equipment Housing | $0.90 \times 0.70 \times 0.80\,\text{m}$ | Heavy instrument package with shock mountings |

---

## 🧠 3. LIFO Mission Loading & Optimization

The 14-Day reverse-chronological mission profile dictates:
- **Last-In, First-Out (LIFO)**: Items needed on **Day 1** are loaded *last* on Earth (placed closest to the forward hatch at $x \approx +3.8\,\text{m}$ to $+5.0\,\text{m}$). Items needed on **Day 14** are loaded *first* on Earth (placed deepest at $x \approx -3.7\,\text{m}$ to $-5.0\,\text{m}$).
- **Center of Mass (CoM) Stability**:
  - Total Cargo Mass: **$748.5\,\text{kg}$**
  - Resulting CoM Vector: $\mathbf{r}_{\text{CoM}} = [-0.912\,\text{m},\, -0.022\,\text{m},\, +0.002\,\text{m}]$
  - Lateral balance ($\Delta Y = -0.022\,\text{m}$) is within strict flight margins ($<\pm 0.05\,\text{m}$).

### The 5 Fundamental NASA Tracking Variables
All items in [`lunar_logistics_manifest.json`](file:///Users/nhharshan/projects/chat-app/nasa-llaso-cad/lunar_logistics_manifest.json) record:
1. **Item** (Name & Cargo Type)
2. **Quantity**
3. **Location** (Bay, Side, Tier, and $[X,Y,Z]$ coordinates in meters)
4. **Time Needed** (Mission Day 1 to 14)
5. **Responsible Actor** (`Astronaut`, `Internal Robot`, `External Robot`, `Maintenance Robot`, `Fabrication System`, or `Mission Control`)

---

## 🌑 4. Reduced Gravity Handling (Earth 1g vs. Moon 1/6g)

| Parameter | Earth Logistics Hall ($1.0\,\text{g}$) | Lunar Receiving ($1/6\,\text{g} = 1.622\,\text{m/s}^2$) |
| :--- | :--- | :--- |
| **Total Payload Weight** | $7,340.3\,\text{N}$ | $1,214.1\,\text{N}$ (6.04× reduction) |
| **Cryo Tank ($145\,\text{kg}$)** | $1,422.0\,\text{N}$ | $235.2\,\text{N}$ |
| **Robot Motor Actuator Strain** | High steady-state lift torque | Low vertical lift torque; dominated by inertial acceleration ($F = ma$) |
| **Operational Challenge** | Heavy lifting strain & structural sag | Momentum control, micro-vibrations, bouncing, and collision avoidance |

---

## 🖥️ 5. How to View & Simulate

### A. Instant 3D Digital Twin Viewer (No install required)
Open [`viewer.html`](file:///Users/nhharshan/projects/chat-app/nasa-llaso-cad/viewer.html) in your web browser:
- Interactive 3D orbit, pan, and zoom.
- Toggle between **1/6 g Lunar** and **1.0 g Earth** gravity readouts.
- Scrub the **Day 1–14 Timeline** to watch the internal robot navigate to the correct shelf.
- Click any locker or CTB to inspect its 5 NASA fundamental variables.
- Run automated unloading sequence.

### B. CoppeliaSim Import (Joints & Dynamic Physics)
1. Open **CoppeliaSim**.
2. Click **File → Import → URDF...** and select [`llaso_cargo_module.urdf`](file:///Users/nhharshan/projects/chat-app/nasa-llaso-cad/llaso_cargo_module.urdf).
3. Attach the script [`coppelia_unloading_simulation.lua`](file:///Users/nhharshan/projects/chat-app/nasa-llaso-cad/coppelia_unloading_simulation.lua) to the model.
4. Press **Play** to run autonomous gantry cargo retrieval under $1/6\,\text{g}$ lunar physics!

### C. Direct CAD Mesh Import (Fusion 360, SolidWorks, Blender, FreeCAD)
- Import [`llaso_lunar_cargo_container.obj`](file:///Users/nhharshan/projects/chat-app/nasa-llaso-cad/llaso_lunar_cargo_container.obj) (includes `.mtl` colors and separated parts).
