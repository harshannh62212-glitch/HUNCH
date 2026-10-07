# NASA HUNCH Autonomous Tracked Lunar Rover | Hardware & Engineering Specification
**Project Reference:** `LLASO-P1-AMR-2026`  
**Chassis Architecture:** Space-Frame Truss with Embedded Brass Heat-Set Inserts & Crawler Tracks

---

## ⚡ 1. Drivetrain & Motor Torque Sizing Calculation

### Rover Mass & Operating Conditions
- **Dry Chassis & Electronics Mass:** $2.85\,\text{kg}$
- **Payload Capacity (CTB / Locker / Regolith samples):** up to $5.0\,\text{kg}$
- **Gross Operating Mass ($M_{\text{gross}}$):** $7.85\,\text{kg} \approx 8.0\,\text{kg}$
- **Drive Sprocket Radius ($R$):** $45\,\text{mm} = 0.045\,\text{m}$ (Diameter $90\,\text{mm}$)
- **Max Operating Incline ($\theta$):** $25^\circ$ slope (ramps into 40-ft container or lunar craters)
- **Skid-Steer Track Resistance Factor ($\mu_{\text{track}}$):** $0.65$ on soft regolith / soil simulant

### Physics Comparison: Earth Testing vs. Lunar Surface

$$\text{Earth Weight } (1.0\,\text{g}): \quad W_{\text{earth}} = 8.0\,\text{kg} \times 9.81\,\text{m/s}^2 = 78.5\,\text{N}$$

$$\text{Lunar Weight } (1/6\,\text{g}): \quad W_{\text{moon}} = 8.0\,\text{kg} \times 1.622\,\text{m/s}^2 = 13.0\,\text{N}$$

> [!IMPORTANT]
> **Engineering Rule**: Motors must be sized for **Earth testing (1.0 g)** so the physical demonstrator functions on Earth during classroom evaluation and NASA review, while providing abundant mechanical overhead in 1/6 g on the Moon!

### Torque Equation on 25° Incline:
$$F_{\text{total}} = W_{\text{earth}} \cdot (\sin 25^\circ + \mu_{\text{track}} \cos 25^\circ) = 78.5 \cdot (0.423 + 0.65 \times 0.906) \approx 80.0\,\text{N}$$

With 2 primary drive motors (or 4 in 4WD crawler setup):
$$F_{\text{per motor}} = \frac{80.0\,\text{N}}{2} = 40.0\,\text{N}$$

$$\tau_{\text{required}} = F_{\text{per motor}} \times R = 40.0\,\text{N} \times 0.045\,\text{m} = 1.80\,\text{N}\cdot\text{m} = \mathbf{18.4\,\text{kg}\cdot\text{cm}}$$

Applying a **$1.6\times$ Engineering Safety Factor**:
$$\tau_{\text{stall target}} \ge \mathbf{28 - 35\,\text{kg}\cdot\text{cm}} \quad (2.8 - 3.5\,\text{N}\cdot\text{m})$$

---

### Recommended Motor Models (Amazon / Robotics Vendors)

| Spec Item | Recommended Selection (Option A - Best Overall) | Option B (Heavy Duty Planetary) |
| :--- | :--- | :--- |
| **Model** | **JGB37-550 High-Torque 12V DC Gear Motor** (with Optical/Magnetic Quadrature Encoder) | **PG45775 / Pololu 37D Metal Gearmotor** |
| **Gear Ratio** | **30:1 or 50:1** | **30:1 or 43:1** |
| **No-Load Speed** | $160 - 200\,\text{RPM}$ (gives rover speed $\approx 0.7 - 0.9\,\text{m/s}$) | $150 - 220\,\text{RPM}$ |
| **Rated Torque** | $12.0\,\text{kg}\cdot\text{cm}$ ($1.18\,\text{N}\cdot\text{m}$) | $16.0\,\text{kg}\cdot\text{cm}$ |
| **Stall Torque** | **$35.0\,\text{kg}\cdot\text{cm}$ ($3.43\,\text{N}\cdot\text{m}$)** | **$45.0\,\text{kg}\cdot\text{cm}$ ($4.41\,\text{N}\cdot\text{m}$)** |
| **Stall Current** | $4.5\,\text{A} - 5.5\,\text{A}$ at $12\,\text{V}$ | $6.0\,\text{A}$ at $12\,\text{V}$ |
| **Shaft Diameter** | $6\,\text{mm}$ D-shaft with keyway flat | $6\,\text{mm}$ or $8\,\text{mm}$ keyed shaft |

---

## 🔌 2. Step-Down DC-DC Buck Converter Specification

The Raspberry Pi 4/5, YDLIDAR, and Camera draw substantial current during bootup, laser spinning, and neural network inference.

### Load Current Budget at 5.0V:
- **Raspberry Pi 4B / 5 (Quad Core CPU + AI inference):** $2.5\,\text{A}$ to $3.5\,\text{A}$ peak
- **YDLIDAR (Laser Diode + Coreless Motor):** $0.5\,\text{A}$ continuous, $1.0\,\text{A}$ startup
- **Camera Module + Status LEDs:** $0.25\,\text{A}$
- **Total 5V Current Demand:** **$3.5\,\text{A}$ nominal, $4.75\,\text{A}$ peak**

> [!WARNING]
> Standard cheap 3A LM2596 converters will trigger Raspberry Pi "Under-voltage detected!" throttling and brownouts when the LiDAR starts up. You must use a **5A continuous (8A peak)** converter!

### Recommended Buck Converter Models:
1. **XL4015 5A Step-Down DC-DC Buck Converter Module**
   - **Input Voltage:** $8\text{V} - 36\text{V}$ DC (perfect for 12V LiFePO4)
   - **Output Voltage:** Regulated $5.1\text{V}$ DC (trim potentiometer)
   - **Continuous Current:** $5.0\,\text{A}$ (with aluminum heatsink)
   - **Peak Current:** $8.0\,\text{A}$
   - **Efficiency:** $\approx 96\%$
2. **Alternative (Industrial):** **Pololu D24V50F5 (5V, 5A)** Synchronous Step-Down Regulator or **Hobbywing 5V/6V 8A UBEC**.

---

## 🏎️ 4. Motor Driver / H-Bridge Controller

Because each JGB37-550 motor draws up to $5\,\text{A}$ stall current, the driver must handle at least $10\,\text{A}$ continuous per channel:
- **Recommended Option 1 (Top Choice):** **Cytron MDD10A (Dual 10A 5V-30V DC Motor Driver)**
  - Dual channel, handles $10\,\text{A}$ continuous, $30\,\text{A}$ peak per channel.
  - Direct 3.3V / 5V PWM & DIR logic compatibility (plugs straight into Raspberry Pi GPIO).
  - No external heat sinks needed due to ultra-low $R_{DS(on)}$ MOSFETs.
- **Budget Option 2:** **Dual BTS7960 43A High-Power H-Bridge Modules** (handles extreme current, large aluminum heatsink).

---

## 🔋 5. Power System: 12V LiFePO4 Battery Pack

- **Chemistry:** Lithium Iron Phosphate ($\text{LiFePO}_4$, 4S configuration: $4 \times 3.2\text{V} = 12.8\text{V}$ nominal).
- **Advantages over LiPo/Li-Ion:**
  - Zero thermal runaway risk (will not ignite or explode if punctured).
  - Extended lifecycle: $> 2,000$ to $4,000$ full cycles.
  - Flat voltage discharge curve (maintains constant motor speed).
- **Recommended Capacity:** **12.8V 3,000 mAh to 6,000 mAh (38Wh to 76Wh)**.
- **Run Time Estimate:** $\approx 1.5 - 2.5\text{ hours}$ of continuous autonomous mapping and navigation.

---

## 🏗️ 6. Structure & Fasteners Specification

### 3D Printing Material: PETG (Polyethylene Terephthalate Glycol)
- **Why PETG:** High impact resistance, tensile strength ($50\,\text{MPa}$), ductile failure mode (unlike brittle PLA), and thermal resistance up to $75^\circ\text{C}$ (handles motor warmth).
- **Recommended Print Settings:**
  - Nozzle Temp: $240^\circ\text{C} - 245^\circ\text{C}$
  - Bed Temp: $75^\circ\text{C}$
  - Walls / Perimeters: **4 walls minimum** (essential for rigid structural trusses)
  - Infill: **35% - 40% Gyroid** (isotropic strength)

### Brass Heat-Set Threaded Inserts
- **M3 Inserts:** $\varnothing 4.6\,\text{mm}$ outer diameter $\times 5.0\,\text{mm}$ length (for PCB, sensor mast, camera, motor brackets).
- **M4 Inserts:** $\varnothing 6.0\,\text{mm}$ outer diameter $\times 8.0\,\text{mm}$ length (for primary structural truss joints and track bogie attachments).
- **Installation:** Standard soldering iron with heat-set insert tip set to $230^\circ\text{C}$. Press flush into pre-modeled cylindrical bosses.

### Hardware Fastener Kit
- **Screws:** ISO 7380 M3 & M4 304 Stainless Steel Button Head Hex Socket Screws:
  - M3: $8\,\text{mm}, 12\,\text{mm}, 16\,\text{mm}$
  - M4: $12\,\text{mm}, 16\,\text{mm}, 20\,\text{mm}$
- **Lock Nuts:** M3 & M4 Nylon-insert locknuts (prevents loosening from crawler vibration).
