export const roverSystemOverview = {
  missionName: "NASA HUNCH Autonomous Exploration Rover",
  designation: "AER-V2 'CHRONOS'",
  classification: "NASA HUNCH Flight Prototype / Technology Demonstrator",
  designReviews: ["PDR (Passed)", "CDR (Approved)", "FDR (Upcoming)"],
  primaryMission: "Long-endurance autonomous planetary exploration rover engineered to traverse severe regolith topography, sustain continuous operations via smart solar harvesting, and execute obstacle mapping without real-time human intervention.",
  operatingParameters: {
    nominalRunTime: "14.5 Hours continuous (Autonomous Crawl)",
    totalMass: "18.4 kg (Dry) / 19.8 kg (Operational with Payload)",
    topSpeed: "0.42 m/s (1.51 km/h) nominal crawl",
    maxIncline: "28° on compacted loose aggregate",
    operatingTemp: "-10°C to +55°C operational range",
    chassisFootprint: "720 mm (L) × 540 mm (W) × 390 mm (H)",
    groundClearance: "145 mm central clearance"
  }
};

export const subsystems = [
  {
    id: "avionics",
    name: "Compute & Avionics Architecture",
    badge: "Dual-Core Realtime",
    icon: "Cpu",
    leadEngineer: "Avionics Subteam",
    summary: "High-reliability dual-processor architecture partitioning deterministic real-time motor control from telemetry streaming and state-machine navigation.",
    coreComponents: [
      {
        part: "Arduino UNO R4 WiFi",
        spec: "Renesas RA4M1 (Arm Cortex-M4 @ 48MHz) + Espressif ESP32-S3",
        role: "Primary Flight Controller & Telemetry Gateway",
        rationale: "Separates deterministic motor pulse/PID generation on the hardware RA4M1 core from memory-heavy WiFi/telemetry socket handling on the ESP32-S3. Eliminates task-switching jitter during active sensor ranging."
      },
      {
        part: "Hardware Watchdog Timer (WDT)",
        spec: "Sub-second timeout with automated brownout & stall reset",
        role: "Autonomous Fault Detection & Safe Recovery",
        rationale: "Ensures self-healing capability in autonomous planetary environments. If execution loops freeze due to electrostatic discharge or unhandled exceptions, the WDT safely cuts drive power and reboots cleanly in under 45ms."
      },
      {
        part: "Dual Isolated I2C / SPI Buses",
        spec: "Galvanically isolated lines with pull-up termination",
        role: "Sensor Communication Backbone",
        rationale: "Prevents high-frequency switching noise from the motor H-bridges and buck converters from corrupting LiDAR I2C registers."
      }
    ],
    technicalHighlights: [
      { label: "Main Core", value: "Renesas RA4M1 48MHz" },
      { label: "Coprocessor", value: "ESP32-S3 Dual Tensilica" },
      { label: "SRAM / Flash", value: "32 KB / 256 KB + 512 KB" },
      { label: "Telemetry Latency", value: "< 14 ms loop time" },
      { label: "Watchdog Recovery", value: "45 ms warm restart" }
    ],
    pinoutDiagram: [
      { pin: "D0 / D1 (UART)", usage: "Primary Telemetry uplink / debug bridge" },
      { pin: "D2 / D3 (ExtInt)", usage: "LiDAR interrupt & collision abort flags" },
      { pin: "D5, D6, D9, D10 (PWM)", usage: "6WD High-side dual H-Bridge PWM throttles" },
      { pin: "A4 / A5 (I2C)", usage: "LiDAR address multiplexer & BNO055 IMU" },
      { pin: "A0 / A1 (ADC)", usage: "Battery shunt resistor & MPPT voltage divider" }
    ]
  },
  {
    id: "drivetrain",
    name: "Drivetrain & Kinematics",
    badge: "6WD Independent High-Torque",
    icon: "Truck",
    leadEngineer: "Mechanical & Mobility Subteam",
    summary: "6-wheel drive layout with matched high-reduction DC motors delivering maximum crawling torque without cross-gearing drag or mechanical binding on irregular obstacles.",
    coreComponents: [
      {
        part: "6× 12V 100 RPM Geared DC Motors",
        spec: "1:31.6 High-Reduction All-Metal Planetary Gearbox",
        role: "Independent Axle Propulsion",
        rationale: "Direct axle coupling removes complex belts, chains, and cross-gearing shafts that introduce mechanical friction, backlash, and single-point-of-failure binding over rock piles. 1:31.6 reduction ensures 38 kg-cm stall torque per wheel."
      },
      {
        part: "Dual High-Current Motor Drivers",
        spec: "Dual BTS7960 43A H-Bridge Drivers with heatsink cooling",
        role: "PWM Speed & Bi-Directional Skid Steering",
        rationale: "Enables zero-radius skid turns. High 43A peak surge capacity absorbs inductive spikes during sudden tire entrapment without thermal throttling."
      },
      {
        part: "High-Traction Lunar Cleat Wheels",
        spec: "120 mm diameter Polymaker PETG hubs with TPU outer tread",
        role: "Traction on Loose Fine Regolith",
        rationale: "Combines rigid structural PETG rim support with shock-absorbing TPU tread lugs, preventing wheel sinkage and providing mechanical interlock on loose soil."
      }
    ],
    technicalHighlights: [
      { label: "Drive Layout", value: "6WD Independent Skid-Steer" },
      { label: "Gear Ratio", value: "1:31.6 All-Metal Planetary" },
      { label: "Nominal Output", value: "100 RPM @ 12V DC" },
      { label: "Combined Stall Torque", value: "228 kg·cm aggregate" },
      { label: "Obstacle Climb", value: "115 mm step threshold" }
    ],
    pinoutDiagram: [
      { pin: "M1 - M3 (Left Bank)", usage: "Forward/Reverse PWM via Driver 1" },
      { pin: "M4 - M6 (Right Bank)", usage: "Forward/Reverse PWM via Driver 2" },
      { pin: "IS1 / IS2 Current Sense", usage: "Analog current feedback per motor channel" },
      { pin: "Thermal Probe", usage: "10k NTC on central motor driver heat sinks" }
    ]
  },
  {
    id: "power",
    name: "Power Architecture & MPPT",
    badge: "360Wh LiFePO4 + Solar Reg.",
    icon: "BatteryCharging",
    leadEngineer: "Power & Thermal Subteam",
    summary: "Reliable deep-cycle energy storage paired with smart solar energy harvesting and dual isolated DC-DC buck converters to prevent inductive motor spikes from corrupting logic.",
    coreComponents: [
      {
        part: "ECO-WORTHY 12V 30Ah LiFePO4 Battery",
        spec: "360 Wh nominal capacity, 3000+ cycle life, built-in BMS",
        role: "Primary Deep-Cycle Energy Storage",
        rationale: "Lithium Iron Phosphate (LiFePO4) exhibits superior thermal stability, zero fire runaway hazard compared to standard Li-ion/LiPo, and maintains a stable 12.8V-13.2V discharge plateau over 85% of its discharge curve."
      },
      {
        part: "20W 12V Monocrystalline Solar Array",
        spec: "21.6V Open Circuit (Voc), 1.16A Imp with MPPT regulation",
        role: "Auxiliary Energy Harvesting & Range Extension",
        rationale: "Provides active solar replenishment while resting or during daytime autonomous crawl. Smart MPPT keeps the panel at maximum power point even under partial shadow."
      },
      {
        part: "Dual 12V-to-5V 5A Isolated Buck Converters",
        spec: "Galvanic isolation, 94% efficiency, low ripple (<30mV)",
        role: "Logic & Sensor Clean Power Rail",
        rationale: "Separates the sensitive 5V Arduino microcontroller and LiDAR electronics from the noisy 12V motor power rail. Motor stall surges and reverse-EMF transients are completely blocked from logic lines."
      }
    ],
    technicalHighlights: [
      { label: "Battery Chemistry", value: "LiFePO4 (Lithium Iron Phosphate)" },
      { label: "Pack Rating", value: "12.8V / 30Ah (384Wh rated / 360Wh usable)" },
      { label: "Solar Capacity", value: "20W Peak with MPPT Controller" },
      { label: "Logic Bus Isolation", value: "1500V DC Galvanic Isolation" },
      { label: "Continuous Autonomy", value: "14.5+ Hours daylight crawl" }
    ],
    pinoutDiagram: [
      { pin: "BUS 12V_UNREG", usage: "Raw battery to BTS7960 Motor Drivers" },
      { pin: "BUS 5V_LOGIC", usage: "Isolated Buck 1 -> UNO R4 & Watchdog" },
      { pin: "BUS 5V_SENSORS", usage: "Isolated Buck 2 -> TF-Luna LiDAR & Vision Cam" },
      { pin: "SOLAR_IN", usage: "20W Array input -> MPPT Charger -> Battery" }
    ]
  },
  {
    id: "sensors",
    name: "Sensors & Optical Vision Array",
    badge: "Triple LiDAR + UVC Vision",
    icon: "Eye",
    leadEngineer: "Sensors & Perception Subteam",
    summary: "Precision multi-angle ranging sensor suite paired with high-definition day/night optical vision to provide autonomous hazard detection and terrain classification.",
    coreComponents: [
      {
        part: "Triple Benewake TF-Luna LiDAR Rangefinders",
        spec: "850nm ToF, 0.2m - 8.0m range, ±6cm accuracy @ 100Hz",
        role: "Trifocal Ranging & Obstacle Mapping",
        rationale: "Mounted in a forward trifocal array (Left: +35°, Center: 0°, Right: -35°). Provides simultaneous collision warning, drop-off trench detection, and hallway clearance mapping with millisecond response times."
      },
      {
        part: "InnoMaker 1080P USB UVC Day/Night Camera",
        spec: "1920×1080 @ 30FPS, Auto IR-Cut Filter, 120° Wide Angle FOV",
        role: "Visual Odometry & Remote Reconnaissance Feed",
        rationale: "Automatic mechanical IR-cut filter transitions seamlessly between bright outdoor daylight and low-light shadow/cave traversal without washed-out color or darkness blindness."
      },
      {
        part: "Bosch BNO055 9-DOF IMU",
        spec: "On-chip sensor fusion (Accel + Gyro + Magnetometer)",
        role: "Kinematic Attitude & Tilt/Roll Roll-over Detection",
        rationale: "Supplies quaternion heading data directly to the navigation state machine, enabling emergency roll-over cutoff if rover pitch exceeds 32°."
      }
    ],
    technicalHighlights: [
      { label: "LiDAR Array", value: "3× Benewake TF-Luna ToF (100Hz)" },
      { label: "LiDAR FOV", value: "70° Tri-Beam Angular Sweep" },
      { label: "Optical Camera", value: "InnoMaker 1080P IR-Cut UVC" },
      { label: "Collision Threshold", value: "0.45 m emergency brake distance" },
      { label: "Attitude Fusion", value: "9-DOF hardware quaternions" }
    ],
    pinoutDiagram: [
      { pin: "TF-Luna 1 (Left)", usage: "I2C 0x10, trigger on D2" },
      { pin: "TF-Luna 2 (Center)", usage: "I2C 0x11, trigger on D3" },
      { pin: "TF-Luna 3 (Right)", usage: "I2C 0x12, trigger on D4" },
      { pin: "BNO055 IMU", usage: "I2C 0x28, heading & tilt telemetry" },
      { pin: "USB UVC Camera", usage: "Dedicated high-bandwidth USB stream" }
    ]
  },
  {
    id: "chassis",
    name: "Chassis, Materials & Filtration",
    badge: "Polymaker PETG + 304 Mesh",
    icon: "Shield",
    leadEngineer: "Structures & Thermal Subteam",
    summary: "Impact-resistant polymer enclosure engineered to withstand abrasive lunar simulant, direct solar UV degradation, and fine particulate intrusion.",
    coreComponents: [
      {
        part: "Polymaker PolyMax PETG Enclosures",
        spec: "High impact resistance, 78°C HDT, UV and chemical stable",
        role: "Modular Avionics & Battery Bays",
        rationale: "Provides superior toughness over standard PLA and avoid brittle fracturing during rock collisions. Easy to iterate rapidly on custom mounting geometry."
      },
      {
        part: "304 Stainless Steel Wire Mesh Filtration Vents",
        spec: "400-mesh (37-micron aperture) woven 304 stainless steel",
        role: "Thermal Convection Dust Exclusion",
        rationale: "Allows critical heat dissipation from power converters and motor drivers while completely rejecting electrostatically charged abrasive dust grains (>37 µm)."
      },
      {
        part: "Modular 2020 Aluminum Rail Spine",
        spec: "Anodized T-slot aluminum extrusion core",
        role: "Structural Backbone & Suspension Mounts",
        rationale: "Enables rapid payload swapping and rigid mounting for the 6 independent motor brackets with zero torsional chassis sag under full 20 kg payload."
      }
    ],
    technicalHighlights: [
      { label: "Enclosure Material", value: "Polymaker PolyMax PETG" },
      { label: "Filtration Spec", value: "304 SS 37-micron woven mesh" },
      { label: "Structural Core", value: "2020 Anodized Al Extrusion" },
      { label: "Ingress Rating Target", value: "IP54 Equivalent Dust & Splash" },
      { label: "Chassis Weight", value: "4.2 kg dry structural mass" }
    ],
    pinoutDiagram: [
      { pin: "Thermal Intake Vent", usage: "Lower intake with 304 SS 37µm mesh" },
      { pin: "Exhaust Vent", usage: "Upper baffled convection vent with mesh" },
      { pin: "Modular Rails", usage: "M5 T-nut mounting tracks for payloads" }
    ]
  }
];
