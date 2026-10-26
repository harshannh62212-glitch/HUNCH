/*
 * Rover dynamics: mass, lunar weight, per-wheel normal load and grip.
 *
 * Prototype numbers (from the team brief):
 *   rover alone    15 lb  (6.804 kg)   split across BOM parts by NASA_RoverBOM.massBreakdown()
 *   cargo           2 x 5 lb (2.268 kg each), on the aft cradle or in the gripper
 *   lunar gravity   1.622 m/s^2
 *
 * The six wheel loads come from rigid-body equilibrium on the contact plane:
 *   sum N_i          = m * g_n
 *   sum N_i * x_i    = m * g_n * x_com + F_x * h_com
 *   sum N_i * z_i    = m * g_n * z_com + F_z * h_com
 * where F_x, F_z are the horizontal forces seen at the centre of mass in the chassis frame
 * (gravity along the slope, braking/accelerating inertia, centripetal force in a turn).
 * With six wheels the system is under-determined, so the load is the plane N = a + b x + c z
 * (the same shape a rocker-bogie suspension settles into), clipped at zero for a lifted wheel.
 */
(function (global) {
  'use strict';
  var LB = 0.45359237;
  var G_MOON = 1.622;
  var ROVER_KG = 15 * LB;
  var CARGO_KG = 5 * LB;
  var WHEEL_IDS = ['FL', 'ML', 'BL', 'FR', 'MR', 'BR'];

  var state = {
    loads: [0, 0, 0, 0, 0, 0],      // N, filtered
    raw: [0, 0, 0, 0, 0, 0],
    staticLoads: [0, 0, 0, 0, 0, 0],
    totalN: 0, massKg: ROVER_KG, cargoKg: 0,
    com: { x: 0, y: 0.15, z: 0, h: 0.15 },
    ax: 0, az: 0, aLong: 0,
    minN: 0, maxN: 0, uniformity: 1, lifted: 0,
    muEff: 0.65, gripN: 0, gripAccel: 0, usableFrac: 1,
    tipMarginRoll: 1, tipMarginPitch: 1,
    wheelGrip: [0, 0, 0, 0, 0, 0],   // per-wheel traction limit, N
    slipRisk: [0, 0, 0, 0, 0, 0],
    ready: false
  };

  function det3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
           m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
           m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }

  /** Solve wheel normal loads. wheels = [{x,z}...] in chassis frame. Returns array of N. */
  function solveLoads(wheels, W, momX, momZ) {
    var n = wheels.length, Sx = 0, Sz = 0, Sxx = 0, Szz = 0, Sxz = 0;
    for (var i = 0; i < n; i++) {
      var w = wheels[i];
      Sx += w.x; Sz += w.z; Sxx += w.x * w.x; Szz += w.z * w.z; Sxz += w.x * w.z;
    }
    var A = [[n, Sx, Sz], [Sx, Sxx, Sxz], [Sz, Sxz, Szz]];
    var B = [W, momX, momZ];
    var d = det3(A);
    var out = new Array(n), k;
    if (Math.abs(d) < 1e-9) { for (k = 0; k < n; k++) out[k] = W / n; return out; }
    function col(c) {
      var M = [A[0].slice(), A[1].slice(), A[2].slice()];
      for (var r = 0; r < 3; r++) M[r][c] = B[r];
      return det3(M) / d;
    }
    var a = col(0), b = col(1), c = col(2);
    var sum = 0;
    for (k = 0; k < n; k++) { out[k] = a + b * wheels[k].x + c * wheels[k].z; if (out[k] < 0) out[k] = 0; sum += out[k]; }
    if (sum > 1e-9) { var sc = W / sum; for (k = 0; k < n; k++) out[k] *= sc; }
    return out;
  }

  function cargoPoints() {
    var L = global.NASA_Logistics;
    return (L && L.cargoPoints) ? L.cargoPoints() : [];
  }

  /**
   * One physics step.
   * in: { dt, wheels:[{x,z}x6], pitch, roll, vel, accel, yawRate, contactY, muBase, sinkRatio, motorN }
   *   pitch  nose-up positive (rad), roll right-side-up positive (rad)
   *   accel  chassis longitudinal acceleration, m/s^2 (d vel / dt)
   *   contactY  rover-local y of the wheel contact points
   */
  function step(inp) {
    var BOM = global.NASA_RoverBOM;
    var base = BOM && BOM.com ? BOM.com() : { x: 0, y: 0.15, z: 0, kg: ROVER_KG };
    var pts = cargoPoints();
    var m = ROVER_KG, mx = base.x * ROVER_KG, my = base.y * ROVER_KG, mz = base.z * ROVER_KG, cargo = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      m += p.kg; cargo += p.kg;
      mx += p.x * p.kg; my += p.y * p.kg; mz += p.z * p.kg;
    }
    var cx = mx / m, cy = my / m, cz = mz / m;
    var contactY = inp.contactY != null ? inp.contactY : 0;
    var h = Math.max(0.05, cy - contactY);
    var pitch = inp.pitch || 0, roll = inp.roll || 0;
    var cosT = Math.max(0.2, Math.cos(pitch) * Math.cos(roll));
    var gN = G_MOON * cosT;
    var gX = -G_MOON * Math.sin(pitch);
    var gZ = -G_MOON * Math.sin(roll);
    var ax = inp.accel || 0;
    var az = (inp.vel || 0) * (inp.yawRate || 0);
    var Fx = m * (gX - ax);
    var Fz = m * (gZ + az);
    var W = m * gN;
    var wheels = inp.wheels;
    var raw = solveLoads(wheels, W, m * gN * cx + Fx * h, m * gN * cz + Fz * h);
    var stat = solveLoads(wheels, m * G_MOON, m * G_MOON * cx, m * G_MOON * cz);
    var dt = Math.max(1e-4, inp.dt || 1 / 60);
    var k = state.ready ? Math.min(1, dt * 9) : 1;     // ~18 ms suspension settling
    var mn = 1e9, mxN = 0, sumN = 0, lifted = 0;
    var wheelGrip = state.wheelGrip, slip = state.slipRisk;
    var mu = (inp.muBase || 0.65) * (inp.sinkFactor != null ? inp.sinkFactor : 1);
    for (var j = 0; j < wheels.length; j++) {
      state.raw[j] = raw[j];
      state.loads[j] += (raw[j] - state.loads[j]) * k;
      state.staticLoads[j] = stat[j];
      var N = state.loads[j];
      sumN += N;
      if (N < mn) mn = N;
      if (N > mxN) mxN = N;
      if (N < 0.04 * W / wheels.length) lifted++;
      // wheel grip: Coulomb with a small cohesion floor (regolith), N
      wheelGrip[j] = mu * N + 0.25 * (N > 0.05 ? 1 : 0);
      slip[j] = 0;
    }
    var uniformity = sumN > 1e-6 ? Math.min(1, wheels.length * mn / sumN) : 1;
    // Independent wheel motors share torque roughly equally; the lightest wheel breaks away
    // first unless traction control rebalances it. Blend 55 % total grip, 45 % lightest-wheel-limited.
    var totalGrip = 0;
    for (var q = 0; q < wheels.length; q++) totalGrip += wheelGrip[q];
    var minGrip = 1e9;
    for (var r2 = 0; r2 < wheels.length; r2++) minGrip = Math.min(minGrip, wheelGrip[r2]);
    var usable = 0.55 * totalGrip + 0.45 * wheels.length * minGrip;
    state.com = { x: cx, y: cy, z: cz, h: h };
    state.totalN = W; state.massKg = m; state.cargoKg = cargo;
    state.ax = ax; state.az = az; state.aLong = ax;
    state.minN = mn; state.maxN = mxN; state.uniformity = uniformity; state.lifted = lifted;
    state.muEff = mu; state.gripN = usable; state.gripAccel = usable / m;
    state.usableFrac = totalGrip > 1e-9 ? usable / totalGrip : 1;
    // Static stability margins: how much side / fore-aft acceleration it takes to lift a wheel row.
    var halfTrack = 0, halfBase = 0;
    for (var t = 0; t < wheels.length; t++) { halfTrack = Math.max(halfTrack, Math.abs(wheels[t].z)); halfBase = Math.max(halfBase, Math.abs(wheels[t].x)); }
    state.tipMarginRoll = Math.max(0, (halfTrack - Math.abs(cz)) / h * G_MOON * cosT);       // m/s^2 of lateral accel to tip
    state.tipMarginPitch = Math.max(0, (halfBase - Math.abs(cx)) / h * G_MOON * cosT);
    state.ready = true;
    return state;
  }

  /** Slip risk for each wheel given a requested drive force (N) shared equally. */
  function slipRisk(driveN) {
    var per = Math.abs(driveN) / 6;
    for (var i = 0; i < 6; i++) state.slipRisk[i] = state.wheelGrip[i] > 1e-6 ? Math.min(2, per / state.wheelGrip[i]) : 2;
    return state.slipRisk;
  }

  global.NASA_Dynamics = {
    LB: LB, G_MOON: G_MOON, ROVER_KG: ROVER_KG, CARGO_KG: CARGO_KG, WHEEL_IDS: WHEEL_IDS,
    step: step, solveLoads: solveLoads, slipRisk: slipRisk,
    state: function () { return state; },
    kgToLb: function (kg) { return kg / LB; },
    weightN: function (kg) { return kg * G_MOON; }
  };
})(window);
