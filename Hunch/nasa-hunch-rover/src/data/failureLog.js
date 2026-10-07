export const failureLogs = [
  {
    id: "NCR-001",
    subsystem: "Compute & Power Interface",
    severity: "CRITICAL (Loss of Autonomous Mission)",
    title: "Motor Inductive Voltage Spikes Triggering MCU Hard Brownout",
    dateDiscovered: "CDR Prototype Stage - Run #14",
    status: "RESOLVED & VERIFIED",
    symptom: "During sudden skid-steer maneuvers over 80mm rock steps, the Arduino UNO R4 WiFi rebooted instantaneously, halting all active mission tasks and clearing the navigation state machine.",
    rootCauseAnalysis: "Oscilloscope probing revealed that high-torque motor stalls generated negative reverse-EMF spikes up to -38V across the common ground rail. This transient coupled through the non-isolated 5V buck regulator, dropping the MCU VCC line below 3.8V for 2.4 microseconds and triggering the Renesas RA4M1 internal brown-out reset (BOR).",
    correctiveAction: [
      "Replaced single shared buck converter with dual isolated 12V-to-5V 5A DC-DC converters (1500V galvanic isolation).",
      "Dedicated Rail A solely to the Arduino microcontroller and IMU; Rail B powers high-transient sensors and camera.",
      "Added bidirectional TVS (Transient Voltage Suppressor) diodes (SMCJ15CA) and 2200µF low-ESR bypass capacitors across each motor driver input.",
      "Implemented optical isolation between MCU PWM pins and BTS7960 gate drive logic."
    ],
    verificationMethod: "Performed 150 consecutive hard stall cycles under maximum mechanical load. Oscilloscope showed logic rail ripple remained < 22mV with zero MCU brownouts or watchdog triggers."
  },
  {
    id: "NCR-002",
    subsystem: "Drivetrain & Kinematics",
    severity: "HIGH (Mechanical Degradation & Stalling)",
    title: "Gearbox Tooth Stripping & Thermal Stall Under Loose Sand Incline",
    dateDiscovered: "PDR Initial Mobility Test - Bench #04",
    status: "RESOLVED & VERIFIED",
    symptom: "Rover failed to sustain forward crawl on 22° loose aggregate incline. Motors drew excessive current (> 6.2A per bank), resulting in internal plastic gearbox teeth shear on front axle motors.",
    rootCauseAnalysis: "Initial prototype utilized off-the-shelf 12V 250 RPM motors with 1:10 hybrid brass/nylon spur gears. The 1:10 ratio provided insufficient reduction torque (only 8.5 kg·cm stall per motor). When the wheels encountered sinkage, the motors stalled near zero-RPM, generating excessive resistive I²R heating and exceeding the shear strength of the nylon spur teeth.",
    correctiveAction: [
      "Transitioned to heavy-duty matched 12V 100 RPM high-reduction (1:31.6) geared motors featuring 100% hardened steel planetary gearboxes.",
      "Increased per-wheel stall torque from 8.5 kg·cm to 38 kg·cm (228 kg·cm aggregate for 6 wheels).",
      "Added software current-limiting feedback: MCU monitors BTS7960 current sense pins and pulses motor PWM if aggregate current exceeds 12A for more than 400ms."
    ],
    verificationMethod: "Completed 4-hour torture crawl on 28° regolith test incline. Current stabilized at 3.8A total draw; gearbox showed zero mechanical backlash or tooth wear after disassembly."
  },
  {
    id: "NCR-003",
    subsystem: "Chassis & Thermal Management",
    severity: "MODERATE (Component Thermal Degradation)",
    title: "Thermal Throttling of Motor Drivers During Long-Duration Desert Simulant Crawl",
    dateDiscovered: "CDR Environmental Chamber Run #08",
    status: "RESOLVED & VERIFIED",
    symptom: "Motor driver output shut down after 42 minutes of continuous high-load running in an ambient 40°C test chamber. Status LED signaled BTS7960 thermal protection tripping (>110°C).",
    rootCauseAnalysis: "Original sealed PETG avionics compartment lacked convective airflow. Passive aluminum heatsinks saturated with heat inside the enclosed volume with zero airflow dissipation.",
    correctiveAction: [
      "Redesigned the PETG chassis with dual-sided lower-intake and upper-exhaust convective chimney ducts.",
      "Installed 304 stainless steel 400-mesh wire screens (37-micron aperture) over all vent openings to permit airflow while strictly barring abrasive simulant dust.",
      "Bonded motor driver power MOSFETs directly to a machined 4mm aluminum baseplate functioning as a structural external heat spreader."
    ],
    verificationMethod: "Continuous 3-hour run in 45°C thermal chamber under 80% motor load. Driver MOSFET temperatures leveled off at 64°C, well below the 110°C thermal protection trip point."
  },
  {
    id: "NCR-004",
    subsystem: "Sensors & Optical Array",
    severity: "MODERATE (False Obstacle Triggers)",
    title: "Optical Washout & Ranging Noise on LiDAR Under High-Incidence Sunlight",
    dateDiscovered: "Field Test Run #03",
    status: "RESOLVED & VERIFIED",
    symptom: "Center Benewake TF-Luna LiDAR reported erratic jump readings (oscillating between 0.2m and 8.0m) when heading directly toward an artificial solar arc lamp, prompting the rover to execute emergency avoidance stops in clear terrain.",
    rootCauseAnalysis: "Direct high-angle sunlight contained infrared spectral irradiance matching the 850nm ToF receiver band, blinding the photodiode when unshielded and causing the internal DSP to report low signal quality (Amp < 100).",
    correctiveAction: [
      "Engineered 3D-printed PETG parabolic glare cowls around all three TF-Luna optics, restricting off-axis solar glare to < 18° cone.",
      "Updated Arduino firmware to evaluate the TF-Luna 'Signal Strength (Amp)' register. Readout is rejected as invalid if Amp < 150, falling back to multi-frame median filtering before issuing collision stops.",
      "Interlocked LiDAR ranging with InnoMaker camera optical flow detection to cross-validate genuine physical obstacles."
    ],
    verificationMethod: "100 runs facing 1000W halogen sunlight simulators. Zero false emergency brakes recorded; genuine obstacle detection remained 100% reliable up to 6.5 meters."
  }
];
