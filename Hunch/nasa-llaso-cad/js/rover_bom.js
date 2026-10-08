/**
 * LLASO-P2-XPORT-2026 rover bill of materials.
 * Sizes and masses are catalog-typical for the purchased parts.
 * Entries marked estimate are printed structure, not a weighed part.
 * The HQST panel and the PETG spool are not on the vehicle.
 */
(function (global) {
  var PARTS = [
    { id: 'chassis', name: 'Polymaker PETG chassis', count: 1, spare: 0, massKg: 1.80, heatW: 0, size: [0.86, 0.16, 0.54], pos: [0, 0.13, 0], estimate: true, onVehicle: true },
    { id: 'wheel', name: 'Wheel', count: 6, spare: 0, massKg: 0.18, heatW: 0, size: [0.20, 0.078, 0.20], pos: [0, 0.09, 0], estimate: true, onVehicle: true },
    { id: 'shock', name: '1/10 RC shock', count: 6, spare: 2, massKg: 0.042, heatW: 0, size: [0.022, 0.090, 0.022], pos: [0, 0.14, 0], onVehicle: true },
    { id: 'motor', name: 'Greartisan 12V 100 RPM', count: 6, spare: 0, massKg: 0.200, heatW: 0, size: [0.078, 0.037, 0.037], pos: [0, 0.09, 0], onVehicle: true },
    { id: 'battery', name: 'GOLDENMATE 12V 10Ah LiFePO4', count: 1, spare: 0, massKg: 1.10, heatW: 0.3, size: [0.151, 0.094, 0.065], pos: [-0.06, 0.16, 0], onVehicle: true, wh: 128 },
    { id: 'pi5', name: 'Raspberry Pi 5 + active cooler', count: 1, spare: 0, massKg: 0.11, heatW: 7.0, size: [0.090, 0.028, 0.062], pos: [0.18, 0.19, -0.05], onVehicle: true },
    { id: 'uno', name: 'Arduino Uno REV3', count: 1, spare: 0, massKg: 0.025, heatW: 0.4, size: [0.0686, 0.015, 0.0534], pos: [0.16, 0.185, 0.07], onVehicle: true },
    { id: 'buck', name: 'YRDZXG 12V to 5V 5A buck', count: 1, spare: 0, massKg: 0.055, heatW: 1.5, size: [0.066, 0.018, 0.036], pos: [0.05, 0.185, 0.10], onVehicle: true },
    { id: 'driver', name: 'Cytron MDD10A', count: 1, spare: 0, massKg: 0.050, heatW: 3.0, size: [0.095, 0.022, 0.065], pos: [0.04, 0.185, -0.11], onVehicle: true },
    { id: 'fan', name: '30 mm 3007 fan', count: 4, spare: 2, massKg: 0.008, heatW: 0.15, size: [0.030, 0.030, 0.007], pos: [0, 0.16, 0], onVehicle: true },
    { id: 'camera', name: 'Arducam OV5647', count: 2, spare: 0, massKg: 0.004, heatW: 0.25, size: [0.025, 0.024, 0.017], pos: [0.32, 0.48, 0], onVehicle: true },
    { id: 'arm', name: 'Cargo arm', count: 1, spare: 0, massKg: 0.35, heatW: 0, size: [0.40, 0.08, 0.08], pos: [0.30, 0.32, 0.12], estimate: true, onVehicle: true },
    { id: 'mast', name: 'Mast and LiDAR', count: 1, spare: 0, massKg: 0.18, heatW: 0.4, size: [0.08, 0.30, 0.08], pos: [0.28, 0.42, -0.14], estimate: true, onVehicle: true },
    { id: 'harness', name: 'Fasteners and wire', count: 1, spare: 0, massKg: 0.15, heatW: 0, size: [0.10, 0.02, 0.05], pos: [0, 0.14, 0], estimate: true, onVehicle: true },
    { id: 'solar', name: 'HQST 100W 12V panel', count: 1, spare: 0, massKg: 6.5, heatW: 0, size: [0.808, 0.030, 0.698], pos: null, onVehicle: false, powerW: 100 },
    { id: 'petg_spool', name: 'Polymaker PETG spool', count: 1, spare: 0, massKg: 1.0, heatW: 0, size: [0.20, 0.07, 0.20], pos: null, onVehicle: false, estimate: true }
  ];

  var BAY_HEAT_IDS = { pi5: 1, uno: 1, buck: 1, driver: 1, battery: 1, fan: 1 };

  function byId(id) {
    for (var i = 0; i < PARTS.length; i++) if (PARTS[i].id === id) return PARTS[i];
    return null;
  }

  function curbKg() {
    var m = 0;
    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      if (p.onVehicle) m += p.massKg * p.count;
    }
    return m;
  }

  function com() {
    var m = 0, x = 0, y = 0, z = 0;
    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      if (!p.onVehicle || !p.pos) continue;
      var w = p.massKg * p.count;
      m += w;
      x += p.pos[0] * w;
      y += p.pos[1] * w;
      z += p.pos[2] * w;
    }
    if (m <= 0) return { x: 0, y: 0, z: 0, kg: 0 };
    return { x: x / m, y: y / m, z: z / m, kg: m };
  }

  function bayHeatW() {
    var w = 0;
    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      if (BAY_HEAT_IDS[p.id]) w += p.heatW * p.count;
    }
    return w;
  }

  var air = { ambientC: 22, rho: 1.2, cp: 1007, cfmEach: 1.0, intakeCount: 2 };
  var airState = {
    intakeC: 22,
    exhaustC: 22,
    flowLs: 0,
    heatW: 0,
    riseC: 0,
    spinRad: 16,
    note: 'Earth air. These fans do not convect on the Moon.'
  };

  function stepAir() {
    var heat = bayHeatW();
    var q = air.intakeCount * air.cfmEach * 0.000471947;
    var mdot = air.rho * q;
    var rise = heat / (mdot * air.cp);
    airState.intakeC = air.ambientC;
    airState.exhaustC = air.ambientC + rise;
    airState.flowLs = q * 1000;
    airState.heatW = heat;
    airState.riseC = rise;
    airState.spinRad = 14 + Math.min(22, rise * 1.4);
    return airState;
  }

  global.NASA_RoverBOM = {
    parts: PARTS,
    byId: byId,
    curbKg: curbKg,
    com: com,
    bayHeatW: bayHeatW,
    air: air,
    stepAir: stepAir,
    airState: function () { return airState; },
    solar: byId('solar'),
    pod: {
      scale: 4,
      fullFt: [4, 2],
      lengthM: 1.2192 / 4,
      widthM: 0.6096 / 4,
      heightM: 0.6096 / 4,
      note: 'Astrobotic 4 ft × 2 ft pod at 1:4'
    },
    airlock: {
      fullOpeningM: 1.5,
      scale: 4,
      openingM: 1.5 / 4
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
