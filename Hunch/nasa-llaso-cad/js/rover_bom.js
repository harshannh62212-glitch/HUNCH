/**
 * LLASO-P2-XPORT-2026 rover bill of materials & dynamic thermal subsystem.
 * High-sensitivity aggressive thermal physics responding dynamically to load, slip, and fan RPM.
 */
(function (global) {
  // Earth-demo planform from the bay-balance board: 4 ft long × 2 ft wide.
  // Front avionics bay; 5 Ah hot-swap pack + ballast plate under the aft deck for rear-axle grip. Cargo bay is aft.
  // v4 planform: everything (wheels swept through a full 360-degree steer, mast, stowed arm) fits a 24 in cube.
  var ROVER_FOOTPRINT = {
    lengthFt: 2,
    widthFt: 2,
    lengthM: 0.6096,
    widthM: 0.6096,
    lengthIn: 24,
    widthIn: 24,
    refLengthM: 0.6096,
    refWidthM: 0.6096
  };

  // Masses: vendor listings where a part is bought (cited in review/docs/rover-v4-design.md), estimates
  // (estimate: true) for printed / machined parts. pos = centre of mass in the rover frame (x fwd, y up from
  // ground, z port), m. Six identical items on symmetric corners sit at their common centroid.
  var PARTS = [
    { id: 'chassis', name: 'Belly tub + deck (6061 extrusion rails, PETG panels)', count: 1, spare: 0, massKg: 1.45, heatW: 0, size: [0.58, 0.14, 0.52], pos: [0.0, 0.160, 0], estimate: true, onVehicle: true },
    { id: 'wheel', name: '130 mm wheel (PETG rim, TPU chevron tread)', count: 6, spare: 1, massKg: 0.095, heatW: 0, size: [0.13, 0.05, 0.13], pos: [0, 0.065, 0], estimate: true, onVehicle: true },
    { id: 'module', name: 'Swerve module (fork, slewing bearing, ring gear, 6-wire slip ring, AS5600)', count: 6, spare: 0, massKg: 0.085, heatW: 0, size: [0.10, 0.09, 0.09], pos: [0, 0.145, 0], estimate: true, onVehicle: true },
    { id: 'shock', name: 'Coil-over strut', count: 6, spare: 2, massKg: 0.030, heatW: 0, size: [0.044, 0.030, 0.044], pos: [0, 0.160, 0], onVehicle: true },
    { id: 'motor', name: 'Greartisan 12V 37 mm gearmotor (in-hub drive)', count: 6, spare: 0, massKg: 0.200, heatW: 0, size: [0.074, 0.037, 0.037], pos: [0, 0.065, 0], onVehicle: true },
    { id: 'steer', name: 'goBILDA 2000-0025-0002 dual-mode servo (continuous, steering)', count: 6, spare: 1, massKg: 0.062, heatW: 0.6, size: [0.040, 0.038, 0.020], pos: [0, 0.244, 0], onVehicle: true },
    { id: 'battery', name: '12.8V 5Ah LiFePO4 pack (hot-swap)', count: 1, spare: 1, massKg: 0.80, heatW: 0.45, size: [0.107, 0.070, 0.090], pos: [0.02, 0.122, 0], onVehicle: true, wh: 64, dimsMm: [107, 90, 70] },
    { id: 'imu', name: 'IMU tip sensor (BNO085)', count: 1, spare: 0, massKg: 0.003, heatW: 0.05, size: [0.025, 0.004, 0.020], pos: [0.0, 0.17, 0.0], onVehicle: true },
    { id: 'pi5', name: 'Raspberry Pi 5 (4 GB) + active cooler', count: 1, spare: 0, massKg: 0.060, heatW: 7.0, size: [0.085, 0.020, 0.056], piBoardSize: [0.085, 0.006, 0.056], pos: [0.165, 0.155, 0.07], onVehicle: true, dimsMm: [85, 56, 20] },
    { id: 'uno', name: 'Arduino Mega 2560 (12 motor channels)', count: 1, spare: 0, massKg: 0.037, heatW: 0.5, size: [0.101, 0.015, 0.053], pos: [0.165, 0.155, -0.07], onVehicle: true },
    { id: 'pwm', name: 'PCA9685 16-ch servo driver', count: 1, spare: 0, massKg: 0.009, heatW: 0.1, size: [0.062, 0.010, 0.025], pos: [0.11, 0.15, -0.105], onVehicle: true },
    { id: 'buck', name: 'YRDZXG 12V to 5V 5A buck', count: 1, spare: 0, massKg: 0.055, heatW: 1.5, size: [0.066, 0.018, 0.036], pos: [0.11, 0.15, 0.105], onVehicle: true },
    { id: 'driver', name: 'Cytron MDD10A dual 10 A driver', count: 3, spare: 0, massKg: 0.050, heatW: 3.0, size: [0.095, 0.022, 0.065], pos: [0.205, 0.095, 0.0], onVehicle: true },
    { id: 'fan', name: '30 mm 3007 fan', count: 2, spare: 2, massKg: 0.008, heatW: 0.15, size: [0.030, 0.030, 0.007], pos: [0.10, 0.13, 0], onVehicle: true },
    { id: 'camera', name: 'Arducam OV5647', count: 2, spare: 0, massKg: 0.004, heatW: 0.25, size: [0.025, 0.024, 0.017], pos: [0.26, 0.483, -0.205], onVehicle: true },
    { id: 'lidar', name: 'YDLIDAR X2L (Φ60 x 96 mm)', count: 1, spare: 0, massKg: 0.19, heatW: 2.0, size: [0.0605, 0.050, 0.0605], pos: [0.235, 0.540, -0.205], onVehicle: true },
    { id: 'mast', name: 'Mast tube + stereo bar', count: 1, spare: 0, massKg: 0.090, heatW: 0, size: [0.03, 0.26, 0.09], pos: [0.235, 0.37, -0.205], estimate: true, onVehicle: true },
    { id: 'arm', name: '2-link arm + gripper (3 servos), stowed', count: 1, spare: 0, massKg: 0.46, heatW: 0, size: [0.28, 0.30, 0.06], pos: [0.13, 0.42, 0.18], estimate: true, onVehicle: true },
    { id: 'cradle', name: 'Canister cradles (V-saddles, trunnion latches)', count: 1, spare: 0, massKg: 0.20, heatW: 0, size: [0.30, 0.10, 0.30], pos: [-0.135, 0.255, 0], estimate: true, onVehicle: true },
    { id: 'avionics', name: 'Avionics pod + dock charge pad', count: 1, spare: 0, massKg: 0.14, heatW: 0, size: [0.155, 0.060, 0.20], pos: [0.19, 0.26, 0], estimate: true, onVehicle: true },
    { id: 'harness', name: 'Fasteners and wire', count: 1, spare: 0, massKg: 0.20, heatW: 0, size: [0.10, 0.02, 0.05], pos: [0.05, 0.15, 0], estimate: true, onVehicle: true },
    { id: 'solar', name: 'HQST 100W 12V panel', count: 1, spare: 0, massKg: 6.5, heatW: 0, size: [0.808, 0.030, 0.698], pos: null, onVehicle: false, powerW: 100 },
    { id: 'petg_spool', name: 'Polymaker PETG spool', count: 1, spare: 0, massKg: 1.0, heatW: 0, size: [0.20, 0.07, 0.20], pos: null, onVehicle: false, estimate: true }
  ];

  var BAY_HEAT_IDS = { pi5: 1, uno: 1, buck: 1, driver: 1, fan: 1 };

  function byId(id) {
    for (var i = 0; i < PARTS.length; i++) if (PARTS[i].id === id) return PARTS[i];
    return null;
  }

  function dX(legacyX) {
    return legacyX * (ROVER_FOOTPRINT.lengthM / ROVER_FOOTPRINT.refLengthM);
  }

  function dZ(legacyZ) {
    return legacyZ * (ROVER_FOOTPRINT.widthM / ROVER_FOOTPRINT.refWidthM);
  }

  // Prototype rover is 15 lb (6.804 kg) on its own. The CAD part masses are estimates, so they
  // are scaled together to hit that figure; the split between parts is kept.
  var LB_KG = 0.45359237;
  var PROTOTYPE_CURB_KG = 15 * LB_KG;
  function rawCurbKg() {
    var m = 0;
    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      if (p.onVehicle) m += p.massKg * p.count;
    }
    return m;
  }
  var MASS_SCALE = PROTOTYPE_CURB_KG / rawCurbKg();

  /** Scaled mass of one BOM line (all units of it), kg. */
  function partKg(p) {
    return p.massKg * p.count * MASS_SCALE;
  }

  function curbKg() {
    return PROTOTYPE_CURB_KG;
  }

  /** Where the 15 lb sits: every on-vehicle BOM line with its scaled mass, rover-local position and share. */
  function massBreakdown() {
    var rows = [];
    var total = curbKg();
    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      if (!p.onVehicle) continue;
      var kg = partKg(p);
      rows.push({ id: p.id, name: p.name, kg: kg, lb: kg / LB_KG, share: kg / total, pos: p.pos ? p.pos.slice() : null });
    }
    rows.sort(function (a, b) { return b.kg - a.kg; });
    return rows;
  }

  function com() {
    var m = 0, x = 0, y = 0, z = 0;
    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      if (!p.onVehicle || !p.pos) continue;
      var w = partKg(p);
      m += w;
      x += p.pos[0] * w;
      y += p.pos[1] * w;
      z += p.pos[2] * w;
    }
    if (m <= 0) return { x: 0, y: 0, z: 0, kg: 0 };
    return { x: x / m, y: y / m, z: z / m, kg: m };
  }

  var G_LUNAR = 1.625;
  var G_EARTH = 9.806;

  /** Bogie axle X (m): front, mid, rear — matches fusion_rover axle tubes. */
  function axleXM() {
    return [0.215, 0, -0.215];          // swerve module rows (fusion_rover GEOM.modX)
  }

  /**
   * Static pitch-plane load split (front vs rear bogie pairs) for grip budgeting.
   * Optional cargo mass at cargoXM (aft bay center by default).
   */
  function tractionSnapshot(opts) {
    opts = opts || {};
    var grav = opts.g != null ? opts.g : G_LUNAR;
    var cargoKg = Math.max(0, opts.cargoKg || 0);
    var cargoX = opts.cargoX != null ? opts.cargoX : -0.134;      // midway between the two canister cradles
    var m0 = curbKg();
    var c0 = com();
    var massKg = m0 + cargoKg;
    var cx = cargoKg > 0 ? (c0.x * m0 + cargoX * cargoKg) / massKg : c0.x;
    var ax = axleXM();
    var xF = ax[0];
    var xR = ax[2];
    var span = xF - xR;
    var rearFrac = span > 0.01 ? Math.max(0.08, Math.min(0.92, (xF - cx) / span)) : 0.5;
    var frontFrac = 1 - rearFrac;
    var weightN = massKg * grav;
    return {
      g: grav,
      massKg: +massKg.toFixed(3),
      comX: +cx.toFixed(4),
      comY: +c0.y.toFixed(4),
      rearBogieN: +(weightN * rearFrac).toFixed(2),
      frontBogieN: +(weightN * frontFrac).toFixed(2),
      rearWheelN: +(weightN * rearFrac / 4).toFixed(2),
      frontWheelN: +(weightN * frontFrac / 4).toFixed(2),
      rearFrac: +rearFrac.toFixed(3),
      cargoKg: cargoKg
    };
  }

  function bayHeatW() {
    var w = 0;
    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      if (BAY_HEAT_IDS[p.id]) w += p.heatW * p.count;
    }
    return w;
  }

  // 12.8 V 5 Ah LiFePO4 hot-swap pack (64 Wh); a second pack charges in the dock. Aft under-cargo ballast for traction.
  var BATTERY = {
    ah: 5,
    vNom: 12.8,
    wh: 64,
    socReserve: 0.18,
    name: '12.8V 5Ah LiFePO4 hot-swap pack (x2: rover + dock spare)'
  };

  var powerModeId = 'eco';
  var powerEcoMode = true;

  /** Four energy profiles for the 5 Ah / 64 Wh pack (LLASO cargo rover). */
  var POWER_MODES = {
    range: {
      id: 'range',
      label: 'Range',
      hint: 'Max trips — slow cruise, sensors sleep when idle',
      cruiseRpmCap: 58,
      transitSpeedCap: 0.48,
      fanNominalRpm: 2200,
      fanWarmRpm: 3200,
      fanHotRpm: 4500,
      lidarMovingW: 1.6,
      lidarIdleW: 0.22,
      lidarSpinMoving: 10,
      lidarSpinIdle: 2,
      camActiveW: 0.55,
      camSleepW: 0.08,
      piBase: 4.0,
      piTransitTrim: 0.45,
      driverScale: 5.2,
      motorIdle: 0.34,
      motorLoadScale: 0.88,
      armW: 8.0,
      slopeScale: 11,
      slipDriverAdd: 2.0,
      whPerRoundTrip: 7.55  // from tools/energy_runtime_sim.js (135 m route); faster modes spend less time per delivery
    },
    eco: {
      id: 'eco',
      label: 'Eco',
      hint: 'Default logistics — balanced savings',
      cruiseRpmCap: 72,
      transitSpeedCap: 0.62,
      fanNominalRpm: 2800,
      fanWarmRpm: 3600,
      fanHotRpm: 4500,
      lidarMovingW: 2.0,
      lidarIdleW: 0.35,
      lidarSpinMoving: 12,
      lidarSpinIdle: 4,
      camActiveW: 0.65,
      camSleepW: 0.12,
      piBase: 4.2,
      piTransitTrim: 0.35,
      driverScale: 5.8,
      motorIdle: 0.38,
      motorLoadScale: 1.0,
      armW: 8.5,
      slopeScale: 13,
      slipDriverAdd: 2.5,
      whPerRoundTrip: 6.85  // from tools/energy_runtime_sim.js (135 m route); faster modes spend less time per delivery
    },
    balance: {
      id: 'balance',
      label: 'Balance',
      hint: 'Faster legs — moderate sensor + fan use',
      cruiseRpmCap: 88,
      transitSpeedCap: 0.78,
      fanNominalRpm: 3600,
      fanWarmRpm: 4200,
      fanHotRpm: 5500,
      lidarMovingW: 2.2,
      lidarIdleW: 0.85,
      lidarSpinMoving: 12,
      lidarSpinIdle: 8,
      camActiveW: 0.72,
      camSleepW: 0.28,
      piBase: 4.6,
      piTransitTrim: 0.15,
      driverScale: 6.2,
      motorIdle: 0.4,
      motorLoadScale: 1.08,
      armW: 9.5,
      slopeScale: 14.5,
      slipDriverAdd: 3.2,
      whPerRoundTrip: 6.01  // from tools/energy_runtime_sim.js (135 m route); faster modes spend less time per delivery
    },
    boost: {
      id: 'boost',
      label: 'Boost',
      hint: 'Full torque & sensors — shortest time',
      cruiseRpmCap: 100,
      transitSpeedCap: 1.0,
      fanNominalRpm: 4500,
      fanWarmRpm: 5500,
      fanHotRpm: 7000,
      lidarMovingW: 2.4,
      lidarIdleW: 1.2,
      lidarSpinMoving: 12,
      lidarSpinIdle: 12,
      camActiveW: 0.8,
      camSleepW: 0.4,
      piBase: 4.8,
      piTransitTrim: 0,
      driverScale: 6.5,
      motorIdle: 0.42,
      motorLoadScale: 1.18,
      armW: 11.0,
      slopeScale: 16,
      slipDriverAdd: 4.0,
      whPerRoundTrip: 5.21  // from tools/energy_runtime_sim.js (135 m route); faster modes spend less time per delivery
    }
  };

  function getPowerMode() {
    return POWER_MODES[powerModeId] || POWER_MODES.eco;
  }

  function setPowerMode(id) {
    if (!POWER_MODES[id]) id = 'eco';
    powerModeId = id;
    powerEcoMode = id !== 'boost';
    if (global.NASA_RoverBOM) {
      global.NASA_RoverBOM.powerModeId = powerModeId;
      global.NASA_RoverBOM.powerEcoMode = powerEcoMode;
    }
    return getPowerMode();
  }

  function setPowerEcoMode(on) {
    return setPowerMode(on ? 'eco' : 'boost');
  }

  /** Fan RPM from active energy mode + thermal status. */
  function ecoFanTargetRpm(thermalState) {
    thermalState = thermalState || thermal;
    var m = getPowerMode();
    var st = thermalState.status || 'NOMINAL';
    if (st === 'THROTTLING' || st === 'HOT') return m.fanHotRpm;
    if (st === 'WARM') return m.fanWarmRpm;
    return m.fanNominalRpm;
  }

  /**
   * Electrical draw (W) from the on-rover BOM + drive state.
   * Motors: Greartisan 12V ×6 via Cytron MDD10A; avionics on YRDZXG 5 V buck.
   */
  function computePowerDraw(state) {
    state = state || {};
    var mode = state.powerModeId && POWER_MODES[state.powerModeId]
      ? POWER_MODES[state.powerModeId]
      : getPowerMode();
    var throttle = Math.abs(state.throttle || 0);
    var vel = Math.abs(state.vel || 0);
    var massRatio = Math.max(1, state.massRatio || 1);
    var fanFrac = state.fanRpmFrac != null ? state.fanRpmFrac : (thermal.fanRpm / thermal.fanNominalRpm);
    var moving = vel > 0.05 || throttle > 0.08;
    var transit = !!state.logisticsTransit;

    var pi = byId('pi5');
    var uno = byId('uno');
    var cam = byId('camera');
    var fan = byId('fan');
    var buck = byId('buck');
    var driver = byId('driver');
    var motor = byId('motor');
    var bat = byId('battery');

    var wPi = mode.piBase + (state.neuralOn ? 3.0 : 0.45) + (state.visionActive ? 1.4 : 0.2);
    if (transit && !state.neuralOn) wPi -= mode.piTransitTrim;
    var wUno = (uno && uno.heatW) ? uno.heatW + 0.05 : 0.45;
    var wCam = state.visionActive || state.armMoving ? mode.camActiveW : mode.camSleepW;
    var wLidar = moving || state.navActive ? mode.lidarMovingW : mode.lidarIdleW;
    var wFans = (fan ? fan.heatW * fan.count : 0.6) * Math.max(0.15, fanFrac);
    var wBuck = 0.85 + wPi * 0.13;
    var wBms = (bat && bat.heatW) ? bat.heatW + 0.15 : 0.45;
    var avionicsW = wPi + wUno + wCam + wLidar + wFans + wBuck + wBms;

    var wDriver = 0.75 + (driver ? driver.heatW * 0.35 : 1.0) + mode.driverScale * Math.pow(throttle, 1.65);
    if (state.slip) wDriver += mode.slipDriverAdd;

    var perMotorLoad = (2.2 * throttle + 5.2 * throttle * Math.min(1, vel / 0.52)) * mode.motorLoadScale;
    var wMotors = (motor ? motor.count : 6) * (mode.motorIdle + perMotorLoad) * Math.pow(massRatio, 0.8);
    if (!moving) wMotors = (motor ? motor.count : 6) * mode.motorIdle;

    var wArm = state.armMoving ? mode.armW : 0.35;
    var slopeW = Math.abs(state.slopeSin || 0) * mode.slopeScale * massRatio;

    var totalW = avionicsW + wDriver + wMotors + wArm + slopeW;
    return {
      totalW: totalW,
      powerModeId: mode.id,
      eco: mode.id !== 'boost',
      battery: BATTERY,
      breakdown: {
        pi: +wPi.toFixed(2),
        uno: +wUno.toFixed(2),
        cameras: +wCam.toFixed(2),
        lidar: +wLidar.toFixed(2),
        fans: +wFans.toFixed(2),
        buck: +wBuck.toFixed(2),
        bms: +wBms.toFixed(2),
        avionics: +avionicsW.toFixed(2),
        driver: +wDriver.toFixed(2),
        motors: +wMotors.toFixed(2),
        arm: +wArm.toFixed(2),
        slope: +slopeW.toFixed(2)
      }
    };
  }

  function benchmarkPowerScenarios() {
    var scenarios = [
      { name: 'idle_hangar', state: { throttle: 0, vel: 0, massRatio: 1 } },
      { name: 'idle_eco', state: { throttle: 0, vel: 0, massRatio: 1 }, ecoOnly: true },
      { name: 'transit_eco', state: { throttle: 0.55, vel: 0.26, massRatio: 1.06, logisticsTransit: true, navActive: true } },
      { name: 'transit_full', state: { throttle: 0.72, vel: 0.38, massRatio: 1.08, navActive: true } },
      { name: 'arm_pick', state: { throttle: 0.15, vel: 0.05, massRatio: 1.04, armMoving: true, visionActive: true } },
      { name: 'slip_recovery', state: { throttle: 0.85, vel: 0.12, massRatio: 1.1, slip: true } }
    ];
    var rows = [];
    for (var i = 0; i < scenarios.length; i++) {
      var sc = scenarios[i];
      var prev = powerModeId;
      var off = sc.ecoOnly ? null : (setPowerMode('boost'), computePowerDraw(sc.state));
      setPowerMode('eco');
      var on = computePowerDraw(sc.state);
      setPowerMode(prev);
      rows.push({
        name: sc.name,
        wattsFull: off ? +off.totalW.toFixed(2) : null,
        wattsEco: +on.totalW.toFixed(2),
        savedW: off ? +(off.totalW - on.totalW).toFixed(2) : 0,
        ecoBreakdown: on.breakdown
      });
    }
    var modeSummary = [];
    var ids = ['range', 'eco', 'balance', 'boost'];
    for (var mi = 0; mi < ids.length; mi++) {
      var mid = ids[mi];
      setPowerMode(mid);
      var m = getPowerMode();
      var cruise = computePowerDraw({
        throttle: 0.55,
        vel: m.transitSpeedCap * 0.42,
        massRatio: 1.05,
        logisticsTransit: true,
        navActive: true
      });
      modeSummary.push({
        id: mid,
        label: m.label,
        cruiseW: +cruise.totalW.toFixed(2),
        whPerRoundTrip: m.whPerRoundTrip,
        tripsAt90: estimateRoundTrips(90, m.whPerRoundTrip).trips
      });
    }
    setPowerMode('eco');
    return {
      scenarios: rows,
      modes: modeSummary,
      modelWhPerRoundTrip: POWER_MODES.eco.whPerRoundTrip,
      tripsAt90pctEco: estimateRoundTrips(90, POWER_MODES.eco.whPerRoundTrip).trips
    };
  }

  function whUsableFromSoc(socPct, reservePct) {
    var cap = BATTERY.wh;
    var reserve = reservePct != null ? reservePct : (BATTERY.socReserve * 100);
    var floor = cap * (reserve / 100);
    var avail = cap * (Math.max(0, Math.min(100, socPct)) / 100) - floor;
    return Math.max(0, avail);
  }

  function estimateRoundTrips(socStartPct, whPerRoundTrip) {
    var usable = whUsableFromSoc(socStartPct);
    if (!whPerRoundTrip || whPerRoundTrip <= 0) return { usableWh: usable, trips: 0 };
    return { usableWh: +usable.toFixed(1), trips: Math.floor(usable / whPerRoundTrip) };
  }

  // =========================================================================
  // HIGH-SENSITIVITY AGGRESSIVE THERMAL PHYSICS ENGINE
  // =========================================================================
  var air = { ambientC: 22.0, rho: 1.2, cp: 1007, cfmEach: 1.35, intakeCount: 2 };

  var thermal = {
    ambientC: 22.0,
    fanRpm: 4500,
    fanNominalRpm: 4500,
    fanSpinRad: 24,
    intakeC: 22.0,
    exhaustC: 25.4,
    flowLs: 2.15,
    heatW: 9.8,

    // Core Component Temperatures in °C
    // BCM2711 SoC die idle baseline in 22°C ambient with active fan is ~50-53°C (die junction resistance floor)
    piChipC: 52.5,     // Raspberry Pi 4 4GB BCM2711 SoC
    chamberC: 24.5,    // Internal avionics chamber air
    driverC: 28.0,     // Cytron MDD10A dual H-bridge driver
    buckC: 26.5,       // 12V -> 5V 5A buck regulator
    batteryC: 23.5,    // LiFePO4 12V 5Ah pack (aft tray, outside avionics duct)

    // 6 Wheel Motors (Greartisan 12V 100 RPM)
    motorNames: ['FL', 'FR', 'ML', 'MR', 'BL', 'BR'],
    motorsC: [24.0, 24.0, 24.0, 24.0, 24.0, 24.0],
    hottestMotor: { index: 0, name: 'FL', tempC: 24.0 },

    status: 'NOMINAL', // NOMINAL, WARM, HOT, THROTTLING
    throttling: false,
    throttleFactor: 1.0,
    note: 'Authentic silicon junction thermal physics · Pi idle ~50-53°C · Throttle at 80°C.'
  };

  var airState = {
    intakeC: 22.0,
    exhaustC: 25.4,
    flowLs: 2.15,
    heatW: 9.8,
    riseC: 3.4,
    spinRad: 24,
    note: 'Earth air ducting · 4x 3007 fans.'
  };

  function setFanRPM(rpm) {
    rpm = Math.max(0, Math.min(8000, Number(rpm) || 0));
    thermal.fanRpm = rpm;
    return rpm;
  }

  function stepThermal(dt, vehicleState) {
    dt = Math.max(0.001, Math.min(0.1, dt || 0.016));
    vehicleState = vehicleState || {};
    var throttle = Math.abs(vehicleState.throttle || 0);
    var vel = Math.abs(vehicleState.vel || 0);
    var steer = Math.abs(vehicleState.steer || 0);
    var slip = !!vehicleState.slip;
    var neuralOn = !!vehicleState.neuralOn;
    var visionActive = !!vehicleState.visionActive;
    var armMoving = !!vehicleState.armMoving;

    // Fan airflow scaling proportional to RPM
    var rpmFrac = thermal.fanRpm / thermal.fanNominalRpm; // 1.0 at 4500 RPM, 0.0 at 0 RPM, 1.78 at 8000 RPM
    var cfmEach = 1.35 * rpmFrac;
    var qM3s = air.intakeCount * cfmEach * 0.000471947;
    thermal.flowLs = qM3s * 1000;
    // Visual rotor spin speed for 3D fan meshes
    thermal.fanSpinRad = (thermal.fanRpm / 60) * Math.PI * 0.45;

    // 1. Internal Avionics Chamber Heat Generation
    // Pi 4 4GB BCM2711 SoC: 4.8W base idle, +3.2W neural ONNX inference, +1.8W CV grabber cam, +1.6W motor control/PWM
    var qPi = 4.8 + (neuralOn ? 3.2 : 0.5) + (visionActive ? 1.8 : 0.3) + throttle * 1.6;
    var qDriver = 1.0 + 5.5 * Math.pow(throttle, 1.8) + (slip ? 4.5 : 0);
    var qBuck = 1.2 + qPi * 0.15;
    var qBat = 0.35 + 1.4 * Math.pow(throttle, 2.0);
    var totalBayHeat = qPi + qDriver + qBuck + (armMoving ? 2.5 : 0);
    thermal.heatW = totalBayHeat;

    // 4x 3007 chassis fans forced air convection
    var cAir = (qM3s * 2) * air.rho * air.cp; // 4 fans total (2 intakes + 2 exhaust blowers)
    var kChassis = 0.40; // Chassis wall conductive loss
    var tChamberTarget = thermal.ambientC + totalBayHeat / (cAir + kChassis + 0.12);
    // Chamber air dynamic step (tau ~ 4.5s)
    thermal.chamberC += (tChamberTarget - thermal.chamberC) * (1 - Math.exp(-dt / 4.5));
    thermal.chamberC = Math.max(thermal.ambientC, thermal.chamberC);

    // Exhaust temperature calculation
    var deltaExhaust = qM3s > 0.0001 ? (totalBayHeat * 0.75 / (qM3s * 2 * air.rho * air.cp)) : (thermal.chamberC - thermal.ambientC);
    thermal.exhaustC = thermal.ambientC + Math.max(0, deltaExhaust);

    // 2. Raspberry Pi 4 4GB BCM2711 SoC Die Junction Temperature
    // Die junction + TIM thermal resistance: theta_die = 2.6 °C/W (physical packaging floor!)
    var thetaDie = 2.6;
    // Heatsink convective resistance: drops with fan RPM
    var thetaHs = 1.2 + 4.2 / (0.7 + 2.6 * Math.pow(rpmFrac, 0.85));
    var thetaTotalPi = thetaDie + thetaHs;
    var tPiTarget = thermal.chamberC + qPi * thetaTotalPi;
    // Fast silicon junction response (tau ~ 2.2s)
    thermal.piChipC += (tPiTarget - thermal.piChipC) * (1 - Math.exp(-dt / 2.2));
    // Physical floor: Pi 4 running Linux never drops below ~46.5°C in a 22°C room even at max fan
    thermal.piChipC = Math.max(thermal.chamberC + 22.0, thermal.piChipC);

    // 3. Cytron MDD10A Motor Driver
    var thetaDriver = 0.8 + 2.2 / (0.5 + 1.8 * Math.pow(rpmFrac, 0.85));
    var tDriverTarget = thermal.chamberC + qDriver * thetaDriver;
    thermal.driverC += (tDriverTarget - thermal.driverC) * (1 - Math.exp(-dt / 2.5));
    thermal.driverC = Math.max(thermal.ambientC, thermal.driverC);

    // 4. 6 Wheel Motors (Greartisan 12V 100RPM DC Gearmotors)
    var maxMotTemp = -999;
    var maxMotIdx = 0;
    for (var mi = 0; mi < 6; mi++) {
      var isCorner = (mi === 0 || mi === 1 || mi === 4 || mi === 5); // FL, FR, BL, BR
      var isFront = (mi === 0 || mi === 1);
      var loadFactor = throttle * (isFront ? 1.15 : 1.0) + (isCorner ? steer * 0.75 : 0) + (slip ? 1.2 : 0);
      var qMotor = 0.5 + 11.0 * Math.pow(loadFactor, 1.8);
      var hMotor = 0.36 + 0.14 * (vel * 0.8);
      var tMotorTarget = thermal.ambientC + qMotor / hMotor;
      thermal.motorsC[mi] += (tMotorTarget - thermal.motorsC[mi]) * (1 - Math.exp(-dt / 2.8));
      thermal.motorsC[mi] = Math.max(thermal.ambientC, thermal.motorsC[mi]);
      if (thermal.motorsC[mi] > maxMotTemp) {
        maxMotTemp = thermal.motorsC[mi];
        maxMotIdx = mi;
      }
    }
    thermal.hottestMotor = {
      index: maxMotIdx,
      name: thermal.motorNames[maxMotIdx],
      tempC: maxMotTemp
    };

    var tBatTarget = thermal.ambientC + 6 + qBat * 4.2 + throttle * 3.5;
    thermal.batteryC += (tBatTarget - thermal.batteryC) * (1 - Math.exp(-dt / 6.5));
    thermal.batteryC = Math.max(thermal.ambientC, thermal.batteryC);

    // 5. Overall Thermal Status & Hardware Throttling
    var isThrottled = (thermal.piChipC >= 80.0 || maxMotTemp >= 78.0 || thermal.chamberC >= 60.0);
    thermal.throttling = isThrottled;
    thermal.throttleFactor = isThrottled ? Math.max(0.40, 1.0 - (Math.max(thermal.piChipC - 80, maxMotTemp - 78, 0)) * 0.05) : 1.0;

    if (isThrottled) {
      thermal.status = 'THROTTLING';
    } else if (thermal.piChipC >= 74 || maxMotTemp >= 70 || thermal.chamberC >= 50) {
      thermal.status = 'HOT';
    } else if (thermal.piChipC >= 62 || maxMotTemp >= 48 || thermal.chamberC >= 36) {
      thermal.status = 'WARM';
    } else {
      thermal.status = 'NOMINAL';
    }

    airState.intakeC = thermal.intakeC;
    airState.exhaustC = thermal.exhaustC;
    airState.flowLs = thermal.flowLs;
    airState.heatW = thermal.heatW;
    airState.riseC = thermal.exhaustC - thermal.intakeC;
    airState.spinRad = thermal.fanSpinRad;

    return thermal;
  }

  function stepAir() {
    return stepThermal(0.016, {});
  }

  global.NASA_RoverBOM = {
    parts: PARTS,
    roverFootprint: ROVER_FOOTPRINT,
    dX: dX,
    dZ: dZ,
    byId: byId,
    curbKg: curbKg,
    massBreakdown: massBreakdown,
    partKg: partKg,
    MASS_SCALE: MASS_SCALE,
    LB_KG: LB_KG,
    com: com,
    G_LUNAR: G_LUNAR,
    G_EARTH: G_EARTH,
    axleXM: axleXM,
    tractionSnapshot: tractionSnapshot,
    bayHeatW: bayHeatW,
    battery: BATTERY,
    powerModeId: powerModeId,
    powerEcoMode: powerEcoMode,
    POWER_MODES: POWER_MODES,
    getPowerMode: getPowerMode,
    setPowerMode: setPowerMode,
    setPowerEcoMode: setPowerEcoMode,
    ecoFanTargetRpm: ecoFanTargetRpm,
    computePowerDraw: computePowerDraw,
    benchmarkPowerScenarios: benchmarkPowerScenarios,
    whUsableFromSoc: whUsableFromSoc,
    estimateRoundTrips: estimateRoundTrips,
    air: air,
    thermal: thermal,
    setFanRPM: setFanRPM,
    stepThermal: stepThermal,
    stepAir: stepAir,
    airState: function () { return airState; },
    solar: byId('solar'),
    pod: {
      scale: 4,
      fullM: [1.04, 0.60, 0.60],
      lengthM: 0.26,
      widthM: 0.15,
      heightM: 0.15,
      shape: 'canister',
      note: 'Cargo canister (1.04 m x 0.60 m dia flight article) at 1:4: domed ends, top grapple knob, side trunnions'
    },
    airlock: {
      fullOpeningM: 1.5,
      scale: 4,
      openingM: 1.5 / 4
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
