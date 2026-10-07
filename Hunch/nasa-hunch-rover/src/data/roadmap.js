export const missionMilestones = [
  {
    phase: "PHASE 1: PDR",
    title: "Preliminary Design Review",
    date: "November 2025",
    status: "COMPLETE",
    score: "96.4% Flight Feasibility",
    objectives: [
      "Define autonomous mission profile for NASA HUNCH requirements.",
      "Conduct mathematical trade studies for 4WD vs 6WD vs Rocker-Bogie mobility.",
      "Establish power budget (360 Wh LiFePO4 pack vs solar replenishment curve).",
      "Simulate planetary terrain clearance and motor torque demands in Webots."
    ],
    keyDeliverables: [
      "Complete CAD kinematic skeleton and center-of-gravity mass breakdown.",
      "Avionics architecture trade matrix selecting Arduino UNO R4 WiFi dual-core.",
      "Initial FMEA risk matrix identifying reverse-EMF and fine regolith dust hazards."
    ],
    outcomes: "Approved by NASA HUNCH engineering evaluators to proceed to physical prototyping and hardware sourcing."
  },
  {
    phase: "PHASE 2: CDR",
    title: "Critical Design Review & Build",
    date: "February 2026",
    status: "COMPLETE",
    score: "98.1% Design Readiness",
    objectives: [
      "Fabricate structural chassis using Polymaker PolyMax PETG and 2020 aluminum rails.",
      "Implement 6WD high-reduction (1:31.6) matched planetary DC motor layout.",
      "Integrate ECO-WORTHY 30Ah LiFePO4 battery, MPPT solar controller, and dual isolated buck regulators.",
      "Mount and calibrate triple Benewake TF-Luna LiDAR array and InnoMaker UVC camera."
    ],
    keyDeliverables: [
      "Fully assembled functional flight hardware prototype (AER-V2 CHRONOS).",
      "Embedded C++ firmware codebase featuring non-blocking state machine navigation.",
      "Electrical wiring schematics with 1500V galvanic isolation boundaries."
    ],
    outcomes: "Cleared with distinction; verified zero ground loop coupling and full skid-steer mobility."
  },
  {
    phase: "PHASE 3: RELIABILITY",
    title: "Torture & Environmental Reliability Testing",
    date: "March 2026",
    status: "IN PROGRESS",
    progress: 82,
    score: "Current Health: NOMINAL",
    objectives: [
      "100-Hour cumulative autonomous field crawl over jagged rock and simulated regolith.",
      "Thermal stress test in 45°C environmental chamber at 80% motor load.",
      "Obstacle drop-off and ditch avoidance validation using trifocal LiDAR array.",
      "Continuous solar charging validation under varying simulated solar flux angles."
    ],
    keyDeliverables: [
      "Vibration and drop test survivability logs (15cm unpowered step drops).",
      "Thermal imaging heat dissipation profiles under continuous stall conditions.",
      "304 stainless steel mesh filtration dust intrusion inspection report."
    ],
    outcomes: "Surpassed 82 hours continuous run with zero hardware watchdog resets; battery capacity retention at 99.4%."
  },
  {
    phase: "PHASE 4: FDR",
    title: "Final Design Review & Demonstration",
    date: "April 2026",
    status: "SCHEDULED",
    score: "Final Review Target",
    objectives: [
      "Deliver live autonomous obstacle negotiation demonstration for NASA HUNCH review board.",
      "Present validated telemetry logs, power efficiency metrics, and FMEA closure documents.",
      "Submit complete open-source engineering package (CAD, schematics, and autonomous navigation code)."
    ],
    keyDeliverables: [
      "Autonomous flight demonstration in mock lunar/Martian obstacle field.",
      "Formal engineering technical report and failure mode verification dossier.",
      "Turn-key operational deployment manual and ground control station software."
    ],
    outcomes: "Ready for live demonstration and formal flight certification submission."
  }
];
