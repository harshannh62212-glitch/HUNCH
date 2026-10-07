export const webotsSimulation = {
  engine: "Webots Open-Source Robot Simulator (ODE Physics Engine)",
  timestep: "16 ms deterministic integration",
  terrainTypes: [
    { name: "Loose Aggregate Regolith (Angle of Repose 34°)", coefficientFriction: 0.58, slipRatio: "14%" },
    { name: "Jagged Basalt Boulder Field (0.1m - 0.25m height)", clearanceMargin: "35 mm", successRate: "98.2%" },
    { name: "Continuous 25° Incline Traverse", sustainedSpeed: "0.36 m/s", currentDraw: "4.1A aggregate" }
  ],
  benchmarks: [
    { metric: "Autonomous Obstacle Avoidance", rate: "99.4% in 500 simulated scenarios" },
    { metric: "Zero-Radius Turn Clearance", rate: "680 mm envelope circle" },
    { metric: "Average Recovery from Slip", rate: "< 1.2s dynamic torque vectoring" },
    { metric: "Solar Surface Flux Utilization", rate: "18.4W average during noon cycle" }
  ]
};

export const cadMetadata = {
  software: "Autodesk Fusion 360 / SolidWorks Aerospace Assembly",
  componentsCount: 142,
  dryMass: "18.4 kg",
  centerOfMass: "X: 0.0 mm, Y: -12.4 mm, Z: 110 mm (Ultra-low stability baseline)",
  dimensions: {
    length: "720 mm",
    width: "540 mm",
    height: "390 mm",
    wheelbase: "480 mm",
    trackWidth: "460 mm",
    wheelDiameter: "120 mm"
  }
};

export const teamMembers = [
  {
    role: "Project Director & Systems Lead",
    focus: "Mission Architecture, NASA HUNCH Compliance, FMEA Safety Matrix",
    badges: ["Systems Engineering", "PDR/CDR Lead"]
  },
  {
    role: "Avionics & Firmware Lead",
    focus: "Arduino UNO R4 WiFi dual-core firmware, telemetry socket daemon, watchdog integration",
    badges: ["Arm Cortex-M4", "FreeRTOS / C++", "ESP32-S3"]
  },
  {
    role: "Mechanical & Mobility Lead",
    focus: "6WD high-reduction planetary drivetrain, PETG chassis 3D CAD, 304 SS mesh integration",
    badges: ["Fusion 360 CAD", "Kinematics", "FEA Analysis"]
  },
  {
    role: "Power & Electrical Engineer",
    focus: "LiFePO4 battery management, 20W MPPT solar array, galvanic power rail isolation",
    badges: ["Power Systems", "MPPT Charging", "EMC / EMI Shielding"]
  },
  {
    role: "Perception & Simulation Engineer",
    focus: "Triple Benewake TF-Luna LiDAR calibration, Webots physics simulation, optical IR-cut camera",
    badges: ["LiDAR ToF", "Webots ODE", "Computer Vision"]
  }
];
