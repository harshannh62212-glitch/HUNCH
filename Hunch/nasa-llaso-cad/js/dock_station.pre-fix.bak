/* =========================================================================
 * NASA HUNCH LLASO — Autonomous Docking & Charging Station (AEGIS-V1 Garage)
 * js/dock_station.js
 *
 * Pure controller + station model + 3D hardware builder.
 *  - step()            docking state machine  ALIGN → ENTER → CAPTURE → LATCH → (DOCKED = CHARGE)
 *                      with RETRY / FAULT recovery. Viewer owns TRANSIT / UNDOCK.
 *  - sensor model      far-field UWB+IR, mid-field 300 mm fiducial, near-field 100 mm IR fiducial,
 *                      hall array. Noise grows with range; estimates are filtered (EMA @30 Hz).
 *  - station model     PV → MPPT → buffer → dock charger, thermal (day / night survival).
 *  - build()/update()  guide clamp arms, floating magnetic coupler, sensors, radiator, louvers, MLI box.
 *
 * Frames (same as viewer.html dockFrame):
 *   along = metres out of the door along the dock axis (+ = outside), lat = left/right offset,
 *   psi   = faceIn = how far the rover is from pointing straight into the bay (rad).
 *   Forward motion changes lat by  v*sin(psi) and along by  -v*cos(psi);  steer>0 decreases psi.
 * ========================================================================= */
(function (root) {
  'use strict';

  // shared motion primitives (js/motion.js). In node, load the sibling file; if it is missing, fall back to linear moves.
  var MO = root.NASA_Motion || null;
  if (!MO && typeof require === 'function') { try { MO = require('./motion.js'); } catch (e) { MO = null; } }

  var C = {
    GATE_ALONG: 3.8,        // stand-off point outside the door where the rover squares up
    PARK_ALONG: -1.18,      // rover centre when parked (coupler sits over the top-deck pad)
    PAD_OFFSET: 0.22,       // pad is 0.22 m behind rover centre (rover local x = -0.22)
    PRECAP_ALONG: -0.78,    // pre-capture check plane
    PRECAP_LAT: 0.012,      // m   — must be inside before the clamp arms may close (wheel-to-jaw slop is ~27 mm per side)
    PRECAP_PSI: 0.0175,     // rad (1 deg; at 3 deg the corner wheel swings out 24 mm)
    STATE_TIMEOUT_S: 20,    // watchdog: any docking sub-state stuck this long retries
    STALE_S: 0.5,           // sensor estimate older than this is not trusted
    ARM_OPEN_GAP: 0.30,     // m of clearance each side with arms open
    FLOAT_LAT: 0.008,       // m   — coupler float envelope
    FLOAT_PSI: 0.05,        // rad
    MAX_RETRIES: 3,
    MAX_SPEED: 0.94,        // m/s  (6 x 100 RPM drive, throttle scaling)
    CHARGE_W_CC: 64.0,      // 5 A (1C) CC into the 12.8 V LiFePO4 pack
    STANDBY_W: 5.0, DOCKING_W: 9.5, NIGHT_SURVIVAL_W: 2.1,
    PV_PANELS: 4, PV_EACH_W: 70.0,
    PV_BUS_W: 266.0,        // 4 x 70 W nominal x 0.95 MPPT
    BUFFER_AH: 100, BUFFER_WH: 1280.0,   // 100 Ah x 12.8 V LiFePO4 station buffer
    PACK_AH: 5, PACK_V: 12.8, PACK_WH: 64.0,   // rover + spare hot-swap LiFePO4 packs (5 Ah each)
    PACK_FLOOR: 0.18,       // SoC floor kept for return-to-dock
    SWAP_S: 25.0,           // robotic pack exchange, door closed
    SWAP_MIN_DELTA: 0.15    // swap only if the spare is >= 15 % SoC better
  };

  function wrapPi(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function rnd() { var u = 0, v = 0; while (u === 0) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  var S = null;
  function fresh() {
    return {
      phase: 'IDLE', t: 0, atGate: false, settle: 0, retries: 0, fault: '',
      est: { lat: 0, psi: 0, along: 9, ready: false }, sampT: 0, sensor: '—', sigma: 0,
      arm: 1, armTarget: 1,          // 1 = open, 0 = clamped
      coupler: 0, couplerTarget: 0,  // 0 = stowed, 1 = mated
      latched: false, contactsLive: false, contactT: 0, couplerT: 0,
      chargeRamp: 0, retreatTo: 6.5, lastLabel: '', events: [], env: 'day',
      bufferWh: C.BUFFER_WH * 0.92, lastCapture: null, result: null,
      spares: [C.PACK_WH, C.PACK_WH], spareWh: C.PACK_WH, spareW: 0, swapT: 0, swaps: 0, sorties: [], depWh: null, depT: 0, simT: 0
    };
  }
  S = fresh();

  function log(msg) { S.events.push(msg); if (S.events.length > 40) S.events.shift(); if (S.onLog) S.onLog(msg); }

  /* ---------------- sensor model ---------------- */
  function sensorFor(along) {
    var Z = Math.max(0.3, along + 2.1);               // camera-to-tag distance (tag on aft wall / facade)
    if (along > 14) return { name: 'UWB + IR BEACON', sl: 0.10, sp: 0.05, Z: Z };
    if (along > 3.6) return { name: 'MASTCAM 300mm TAG', sl: 0.0012 * Z, sp: (0.2 + 0.06 * Z) * Math.PI / 180, Z: Z };
    if (along > C.PARK_ALONG + 0.6) return { name: 'BAY CAM 100mm IR TAG', sl: 0.0006 * Z + 0.0005, sp: (0.1 + 0.04 * Z) * Math.PI / 180, Z: Z };
    // The hall array sits in the coupler head; it only sees the pad once the coupler has come down.
    if (S && S.coupler > 0.9) return { name: 'HALL ARRAY + BAY CAM', sl: 0.0005, sp: 0.05 * Math.PI / 180, Z: Z };
    return { name: 'BAY CAM 100mm IR TAG', sl: 0.0006 * Z + 0.0005, sp: (0.1 + 0.04 * Z) * Math.PI / 180, Z: Z };
  }
  function sense(truth, dt) {
    S.sampT += dt;
    var period = 1 / 30;
    if (S.sampT >= period) {
      S.sampT = 0;
      var s = sensorFor(truth.along);
      S.sensor = s.name; S.sigma = s.sl;
      var drop = Math.random() < 0.01 || (S.inject && S.t >= S.inject.from && S.t < S.inject.to);   // 1 % frame drops (glare / dust) plus injected blackout bursts
      if (!drop) {
        var m = { lat: truth.lat + rnd() * s.sl, psi: truth.psi + rnd() * s.sp, along: truth.along + rnd() * Math.max(0.004, s.sl * 1.5) };
        S.lastGood = S.t;
        var tau = truth.along < 3.6 ? 0.06 : 0.18;     // short filter near the bay so the estimate does not lag the creep
        var a = 1 - Math.exp(-period / tau);
        if (!S.est.ready) { S.est.lat = m.lat; S.est.psi = m.psi; S.est.along = m.along; S.est.ready = true; }
        else { S.est.lat += (m.lat - S.est.lat) * a; S.est.psi += (m.psi - S.est.psi) * a; S.est.along += (m.along - S.est.along) * a; }
      }
    }
    return S.est;
  }

  /* ---------------- helpers ---------------- */
  function stanley(e, v, k, kc, v0) {
    var dir = v >= 0 ? 1 : -1;
    var psid = -dir * Math.atan(kc * e.lat / (Math.abs(v) + v0));
    psid = clamp(psid, -0.6, 0.6);
    return { steer: k * (e.psi - psid), err: e.psi - psid };
  }
  function cmd(steer, v, label, next) {
    // The drive layer zeroes turn-rate below 0.018 rad/s (blend 0.125/frame) so steer < ~0.15 does nothing.
    // Duty-cycle (stochastic dither) tiny commands so the *average* yaw rate is what the controller asked for.
    var as = Math.abs(steer);
    if (as > 0.004 && as < 0.16) steer = (Math.random() < as / 0.16 ? 0.16 : 0) * (steer < 0 ? -1 : 1);
    var out = { steer: clamp(steer, -1.7, 1.7), throttle: 0, forward: false, reverse: false, label: label, next: next || null };
    if (v > 0.003) { out.throttle = clamp(v / C.MAX_SPEED, 0, 1); out.forward = true; }
    else if (v < -0.003) { out.throttle = clamp(-v / (C.MAX_SPEED * 0.4), 0, 1); out.reverse = true; }
    return out;
  }

  /* ---------------- the docking state machine ---------------- */
  function beginApproach() { S.lastGood = 0; S.stT = 0; S.lastSt = ''; S.phase = 'IDLE'; S.atGate = false; S.settle = 0; S.retries = 0; S.fault = ''; S.est.ready = false; S.t = 0; S.result = null; S.latched = false; S.contactsLive = false; S.armTarget = 1; S.couplerTarget = 0; }

  function startRetry(why, e) {
    S.retries++; S.fault = why; S.atGate = false; S.settle = 0;
    S.armTarget = 1; S.couplerTarget = 0; S.latched = false; S.contactsLive = false;
    S.retreatTo = Math.max(6.5, C.GATE_ALONG + 1.5 * Math.abs(e.lat) + 0.8);
    log('RETRY ' + S.retries + '/' + C.MAX_RETRIES + ': ' + why);
    if (S.retries > C.MAX_RETRIES) { S.fault = 'dock aborted after ' + C.MAX_RETRIES + ' retries'; log('FAULT: ' + S.fault); return 'FAULT'; }
    return 'RETRY';
  }

  // ctx: { state, along, lat, psi, vel, dt }   returns command (+ next dockingState, + assist clamps)
  function step(ctx) {
    var dt = ctx.dt || 0.016;
    S.t += dt;
    var e = sense(ctx, dt);
    var st = ctx.state;
    var out;

    // watchdog: time spent in the current docking state
    if (st !== S.lastSt) { S.lastSt = st; S.stT = 0; }
    S.stT = (S.stT || 0) + dt;

    if (st === 'FAULT') {
      // limp-out: after 30 s the rover opens the clamps, stows the coupler and tries again from the gate
      if (S.stT > 30) {
        S.retries = 0; S.fault = ''; S.armTarget = 1; S.couplerTarget = 0; S.latched = false; S.contactsLive = false;
        log('FAULT recovery: backing out to retry');
        return cmd(0, 0, 'RETRY', 'RETRY');
      }
      return cmd(0, 0, 'FAULT');
    }
    if (st !== 'IDLE' && st !== 'DOCKED' && st !== 'NONE' && st !== 'DEPARTED') {
      if (S.stT > C.STATE_TIMEOUT_S * (st === 'ALIGN' || st === 'ENTER' ? 4 : 1) && st !== 'RETRY') {
        var nt = startRetry(st + ' timed out', e);
        return cmd(0, 0, 'RETRY', nt);
      }
      if (st === 'RETRY' && S.stT > C.STATE_TIMEOUT_S * 2) {
        S.fault = 'retry timed out'; log('FAULT: ' + S.fault);
        return cmd(0, 0, 'FAULT', 'FAULT');
      }
      if (e.ready && (S.t - (S.lastGood || 0)) > C.STALE_S && st !== 'RETRY') {
        if ((S.t - (S.lastGood || 0)) > 3) { var ns = startRetry('sensor lost', e); return cmd(0, 0, 'RETRY', ns); }
        return cmd(0, 0, 'SENSOR STALE: HOLD');
      }
    }

    /* ---- ALIGN: far/mid-field Stanley path to the stand-off gate, then square up ---- */
    if (st === 'ALIGN') {
      if (!e.ready) return cmd(0, 0, 'ALIGN (sensing)');
      if (e.along < C.GATE_ALONG - 0.35 || (e.along - C.GATE_ALONG) < 1.2 * Math.abs(e.lat) - 0.2 && !S.atGate) {
        var nx = startRetry(e.along < C.GATE_ALONG - 0.35 ? 'inside gate' : 'insufficient run-in', e);
        return cmd(0, 0, 'RETRY', nx);
      }
      if (!S.atGate) {
        var dist = e.along - C.GATE_ALONG;
        var v = clamp(0.9 * dist, 0.07, 0.55);
        if (Math.abs(e.lat) > 0.5) v = Math.min(v, 0.4);
        var s = stanley(e, v, 1.9, 1.6, 0.3);
        if (Math.abs(s.err) > 0.6) v = 0;                      // pivot in place first
        if (dist < 0.03) { S.atGate = true; S.settle = 0; S.gateT = 0; log('gate reached  lat=' + (e.lat * 1000).toFixed(0) + ' mm'); }
        return cmd(s.steer, v, 'ALIGN: APPROACH ' + e.along.toFixed(1) + 'm');
      }
      // square up at the gate
      var s2 = stanley(e, 0, 5.0, 0, 1);
      var steady = Math.abs(e.psi) < 0.015 && Math.abs(e.lat) < 0.15 && Math.abs(ctx.vel) < 0.03;
      S.settle = steady ? S.settle + dt : 0;
      S.gateT = (S.gateT || 0) + dt;
      if (S.gateT > 6 && Math.abs(e.lat) >= 0.15) { S.gateT = 0; return cmd(0, 0, 'RETRY', startRetry('lateral error at gate (' + (e.lat * 1000).toFixed(0) + ' mm)', e)); }
      if (S.settle > 0.5 && ctx.doorOpen > 0.8) {
        log('squared up  lat=' + (e.lat * 1000).toFixed(0) + ' mm psi=' + (e.psi * 57.3).toFixed(2) + ' deg');
        out = cmd(0, 0, 'ALIGN: LOCKED', 'ENTER');
        return out;
      }
      return cmd(s2.steer, 0, 'ALIGN: SQUARE-UP');
    }

    /* ---- ENTER: slow visual-servo insertion on the bay centreline ---- */
    if (st === 'ENTER') {
      if (ctx.doorOpen !== undefined && ctx.doorOpen < 0.5) return cmd(0, 0, 'ENTER: DOOR NOT OPEN, HOLD');   // door closed or closing mid-entry
      if (Math.abs(e.lat) > 0.25 || Math.abs(e.psi) > 0.45) {
        var n2 = startRetry('left insertion corridor', e);
        return cmd(0, 0, 'RETRY', n2);
      }
      var vE = e.along > C.PARK_ALONG + 1.4 ? 0.30 : 0.18;
      var sE = stanley(e, vE, 2.2, 1.8, 0.25);
      if (e.along <= C.PRECAP_ALONG) {
        if (Math.abs(e.lat) < C.PRECAP_LAT && Math.abs(e.psi) < C.PRECAP_PSI) {
          S.lastCapture = { lat: ctx.lat, psi: ctx.psi };
          S.armTarget = 0; S.phase = 'CAPTURE'; log('pre-capture OK  lat=' + (ctx.lat * 1000).toFixed(1) + ' mm psi=' + (ctx.psi * 57.3).toFixed(2) + ' deg → CLAMP');
          return cmd(sE.steer, 0.10, 'CAPTURE', 'CAPTURE');
        }
        var n3 = startRetry('pre-capture envelope missed (' + (e.lat * 1000).toFixed(0) + ' mm, ' + (e.psi * 57.3).toFixed(1) + ' deg)', e);
        return cmd(0, 0, 'RETRY', n3);
      }
      return cmd(sE.steer, vE, 'ENTER ' + e.along.toFixed(2) + 'm');
    }

    /* ---- CAPTURE: clamp arms close, rover creeps to the hard-stop bumper ---- */
    if (st === 'CAPTURE') {
      var armsClosed = S.arm < 0.02;
      var atStop = e.along <= C.PARK_ALONG + 0.004;
      // jaw-load abort: jaws almost shut and the rover is still off-centre means a wheel is in the way
      if (S.arm < 0.1 && Math.abs(e.lat) > 0.02) {
        var nj = startRetry('jaw load abort (lat ' + (e.lat * 1000).toFixed(0) + ' mm)', e);
        return cmd(0, 0, 'RETRY', nj);
      }
      if (atStop && armsClosed) {
        S.couplerTarget = 1; log('captured → coupler descending');
        return cmd(0, 0, 'LATCH', 'LATCH');
      }
      var vC = atStop ? 0 : 0.10;
      return cmd(0, vC, 'CAPTURE (arms ' + Math.round((1 - S.arm) * 100) + '%)');
    }

    /* ---- LATCH: coupler lowers, magnets snap, contact check, latch, charge ---- */
    if (st === 'LATCH') {
      if (S.coupler > 0.985) {
        S.couplerT += dt;
        var ok = Math.abs(e.lat) < C.FLOAT_LAT && Math.abs(e.psi) < C.FLOAT_PSI && Math.abs(e.along - C.PARK_ALONG) < 0.015;
        if (!ok) {
          var n4 = startRetry('contact check failed', e);
          return cmd(0, 0, 'RETRY', n4);
        }
        if (S.couplerT > 0.6) {
          S.latched = true; S.contactsLive = true; S.phase = 'CHARGE';
          S.result = { lat: ctx.lat, psi: ctx.psi, along: ctx.along, retries: S.retries, t: S.t };
          log('LATCHED  residual lat=' + (ctx.lat * 1000).toFixed(1) + ' mm  → CHARGE (retries ' + S.retries + ')');
          return cmd(0, 0, 'DOCKED', 'DOCKED');
        }
      } else { S.couplerT = 0; }
      return cmd(0, 0, 'LATCH (coupler ' + Math.round(S.coupler * 100) + '%)');
    }

    /* ---- RETRY: open clamps, stow coupler, back straight out, then re-run ALIGN ---- */
    if (st === 'RETRY') {
      var ready = S.arm > 0.95 && S.coupler < 0.05;
      var vR = ready ? -0.35 : 0;
      var sR = stanley(e, vR || -0.1, 2.0, 1.0, 0.3);
      if (e.ready && e.along >= S.retreatTo && Math.abs(e.psi) < 0.1) {
        S.atGate = false; S.settle = 0;
        return cmd(0, 0, 'ALIGN', 'ALIGN');
      }
      return cmd(sR.steer, vR, 'RETRY: BACK OUT');
    }

    return cmd(0, 0, st);
  }

  /* mechanical assist produced by the clamp arms (viewer applies it to the pose) */
  function assist() {
    var gap = C.ARM_OPEN_GAP * S.arm;
    var latMax = gap + 0.002;
    return { latMax: latMax, psiMax: latMax / 0.5 };
  }

  /* ---------------- station electrical / thermal model ---------------- */
  function chargePowerW(soc, pvOn) {
    if (!S.contactsLive) return 0;                            // S.chargeRamp is advanced in stepStation (time-based, ~1.5 s soft start)
    var taper = 1 - clamp((soc - 0.9) / 0.1, 0, 1) * 0.88;
    var p = C.CHARGE_W_CC * taper * S.chargeRamp;
    if (S.env === 'night') p = Math.min(p, 0);                // never charge from the buffer at night
    if (S.th && S.th.box < 0) p = 0;                          // LiFePO4 must not charge below 0 C
    return p;
  }
  function stationLoadW(dockingState) {
    if (S.env === 'night') return C.NIGHT_SURVIVAL_W;
    if (dockingState === 'NONE' || dockingState === 'DEPARTED') return C.STANDBY_W;
    if (dockingState === 'DOCKED') return C.STANDBY_W + 1.2;
    return C.DOCKING_W;
  }
  function stepStation(dt, dockingState, roverChargeW) {
    var pv = S.env === 'night' ? 0 : C.PV_BUS_W;
    S.chargeRamp = S.contactsLive ? Math.min(1, S.chargeRamp + dt / 1.5) : 0;   // frame-rate independent soft start
    var load = stationLoadW(dockingState) + roverChargeW / 0.94;
    // spare pack: charged from whatever PV budget is left (rover has priority)
    var avail = Math.max(0, pv - load - 0.5);
    var sW = 0, budget = avail;                      // two spare packs share what is left, emptier one first
    var order = S.spares[0] <= S.spares[1] ? [0, 1] : [1, 0];
    for (var oi = 0; oi < 2; oi++) {
      var k = order[oi], sSoc = S.spares[k] / C.PACK_WH;
      var p = (S.env === 'night' || sSoc >= 0.999) ? 0 : Math.min(budget, C.CHARGE_W_CC * (1 - clamp((sSoc - 0.9) / 0.1, 0, 1) * 0.88));
      S.spares[k] = clamp(S.spares[k] + p * 0.94 * dt / 3600, 0, C.PACK_WH);
      budget -= p; sW += p;
    }
    S.spareWh = Math.max(S.spares[0], S.spares[1]);   // best spare
    S.spareW = sW; S.simT += dt;
    load += sW / 0.94;
    var net = pv - load;
    S.bufferWh = clamp(S.bufferWh + net * dt / 3600, 0, C.BUFFER_WH);
    S.pvW = pv; S.loadW = load; S.netW = net;
    var th = S.env === 'night'
      ? { box: -22, radiator: -158, louver: 0, heaterW: 1.7, leakW: 1.7, rejectW: 0 }
      : { box: 24, radiator: 41, louver: clamp(0.35 + 0.65 * (roverChargeW / 41), 0, 1), heaterW: 0, leakW: 0, rejectW: 2.4 + roverChargeW * 0.12 };
    S.th = th;
    return S;
  }


  /* ---------------- pack hot-swap + sortie accounting ---------------- */
  function packFloorWh() { return C.PACK_WH * C.PACK_FLOOR; }
  /* Call every frame while DOCKED. Returns the rover pack energy (changes only when a swap completes). */
  function swapStep(dt, dockingState, roverWh, doorClosed) {
    var ok = dockingState === 'DOCKED' && S.latched && S.env !== 'night' && doorClosed !== false;
    var want = ok && (S.spareWh - roverWh) >= C.SWAP_MIN_DELTA * C.PACK_WH;
    if (!want) { S.swapT = 0; return roverWh; }
    S.swapT += dt;
    if (S.swapT < C.SWAP_S) return roverWh;
    S.swapT = 0; S.swaps++; S.chargeRamp = 0;
    var bi = S.spares[0] >= S.spares[1] ? 0 : 1;      // trade for the fullest spare
    var nw = S.spares[bi]; S.spares[bi] = roverWh; S.spareWh = Math.max(S.spares[0], S.spares[1]);
    if (S.onLog) S.onLog('[PACK SWAP #' + S.swaps + '] rover ' + (roverWh / C.PACK_WH * 100).toFixed(0) + '% <-> spare ' + (nw / C.PACK_WH * 100).toFixed(0) + '% · ready to depart at ' + (nw / C.PACK_WH * 100).toFixed(0) + '%');
    return nw;
  }
  function noteDeparture(roverWh) { S.depWh = roverWh; S.depT = S.simT; }
  function noteArrival(roverWh) {
    if (S.depWh == null) return;
    var used = S.depWh - roverWh, mins = (S.simT - S.depT) / 60;
    S.sorties.push({ usedWh: used, min: mins, from: S.depWh, to: roverWh });
    if (S.onLog) S.onLog('[SORTIE #' + S.sorties.length + '] ' + used.toFixed(1) + ' Wh in ' + mins.toFixed(1) + ' min · pack ' + (S.depWh / C.PACK_WH * 100).toFixed(0) + '% -> ' + (roverWh / C.PACK_WH * 100).toFixed(0) + '%');
    S.depWh = null;
  }
  /* time (min) to charge a pack from soc a to b with the dock charger law (CC then taper) */
  function chargeMinutes(a, b) {
    var soc = a, t = 0;
    while (soc < b && t < 1e6) { soc += C.CHARGE_W_CC * (1 - clamp((soc - 0.9) / 0.1, 0, 1) * 0.88) * 0.94 / 3600 / C.PACK_WH; t++; }
    return t / 60;
  }
  function runsLeft(roverWh) {
    if (!S.sorties.length) return null;
    var avg = 0; S.sorties.forEach(function (q) { avg += q.usedWh; }); avg /= S.sorties.length;
    return avg > 0.1 ? Math.max(0, Math.floor((roverWh - packFloorWh()) / avg)) : null;
  }

  /* ---------------- 3D hardware ---------------- */
  var H = null;
  function tagTexture(THREE, size, seed, bg, fg) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    var n = 8, cell = size / n, r = seed;
    function rr() { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; }
    g.fillStyle = fg;
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      var border = (i === 0 || j === 0 || i === n - 1 || j === n - 1);
      if (border || rr() > 0.5) g.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
    }
    var t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t;
  }

  function build(THREE, dockGroup, m) {
    H = { THREE: THREE, group: dockGroup, mats: m };
    var white = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.55, metalness: 0.05 });
    var rubber = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    var silver = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.25 });
    var gold = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.85, roughness: 0.38, emissive: 0x2a1c00, emissiveIntensity: 0.3 });
    var led = function (c) { return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6 }); };
    var G = dockGroup;

    /* clamp / guide arms (parallel-jaw, lead-screw driven; bar stays parallel to the bay axis).
       Each jaw rides two guide actuators: a fixed barrel on the wall and a rod that slides out of it. */
    H.arms = [];
    var BARREL_L = 0.42, ROD_L = 0.74;
    [-1, 1].forEach(function (s) {
      var grp = new THREE.Group(); G.add(grp);
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.13, 0.035), m.bayTrim);
      var padM = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.10, 0.012), rubber);
      var lead = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.035), m.hazard);
      bar.castShadow = true; lead.castShadow = true;
      grp.add(bar, padM, lead);
      var acts = [];
      [-0.45, 0.45].forEach(function (ax) {
        var cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, BARREL_L, 14), m.bayDark);
        cyl.rotation.x = Math.PI / 2; cyl.position.set(C.PARK_ALONG + ax, 0.20, s * (1.52 - BARREL_L / 2)); cyl.castShadow = true; grp.add(cyl);
        var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 14), m.bayTrim);
        cap.rotation.x = Math.PI / 2; cap.position.set(C.PARK_ALONG + ax, 0.20, s * (1.52 - BARREL_L)); grp.add(cap);
        var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, ROD_L, 10), silver);
        rod.rotation.x = Math.PI / 2; grp.add(rod);
        var clev = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.03), m.bayDark); grp.add(clev);
        acts.push({ cyl: cyl, rod: rod, clev: clev, ax: ax });
      });
      // lead-screw drive: motor can on the wall + threaded shaft into the bar
      var motor = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.10, 16), m.bayDark);
      motor.rotation.x = Math.PI / 2; motor.position.set(C.PARK_ALONG, 0.28, s * 1.47); grp.add(motor);
      var screw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.7, roughness: 0.35 }));
      screw.rotation.x = Math.PI / 2; grp.add(screw);
      var nut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.04), m.copper); grp.add(nut);
      H.arms.push({ s: s, grp: grp, bar: bar, pad: padM, lead: lead, acts: acts, screw: screw, nut: nut, rodL: ROD_L });
    });

    /* floating magnetic coupler: a 3-stage scissor lift hung from the roof lowers the head onto the rover pad.
       (The old single column was stretched with scale.y, which read as rubber, not hardware.) */
    var cg = new THREE.Group(); G.add(cg);
    H.coupler = cg;
    var stowX = C.PARK_ALONG + C.PAD_OFFSET;
    var mount = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.22), m.bayDark); mount.position.set(stowX, 1.425, 0); cg.add(mount);
    var rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.015, 0.03), silver); rail2.position.set(stowX, 1.395, 0); cg.add(rail2);
    var lmot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 14), m.bayDark); lmot.rotation.z = Math.PI / 2; lmot.position.set(stowX + 0.27, 1.41, 0); cg.add(lmot);
    H.scissor = { rods: [], pins: [], L: 0.40, n: 3, top: 1.395, x0: stowX };
    var rodMat = m.bayTrim, pinMat = silver;
    for (var st = 0; st < 3; st++) {
      [-1, 1].forEach(function (side) {                      // two rod pairs, one each side of the head
        [-1, 1].forEach(function (diag) {
          var r = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.022, 0.012), rodMat); r.castShadow = true; cg.add(r);
          H.scissor.rods.push({ mesh: r, st: st, side: side, diag: diag });
        });
        var pin = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.15, 8), pinMat); pin.rotation.x = Math.PI / 2; cg.add(pin);
        H.scissor.pins.push({ mesh: pin, st: st, side: side });
      });
    }
    H.couplerHead = new THREE.Group(); cg.add(H.couplerHead);
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.05, 0.26), new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.5, roughness: 0.35 }));
    body.castShadow = true;
    H.couplerHead.add(body);
    var skirt = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.012, 0.28), m.bayTrim); skirt.position.y = 0.03; H.couplerHead.add(skirt);
    H.magRings = [];
    [-0.105, 0.105].forEach(function (px) {
      var mag = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 20), silver); mag.position.set(px, -0.032, 0); H.couplerHead.add(mag);
      var ringMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.4 });
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.004, 8, 24), ringMat); ring.rotation.x = Math.PI / 2; ring.position.set(px, -0.041, 0); H.couplerHead.add(ring);
      H.magRings.push(ringMat);
    });
    H.pogos = [];
    [[-0.04, -0.05], [0.04, -0.05], [-0.04, 0.05], [0.04, 0.05]].forEach(function (pp) {
      var pogo = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8), m.copper); pogo.position.set(pp[0], -0.04, pp[1]); H.couplerHead.add(pogo); H.pogos.push(pogo);
    });
    H.couplerLed = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), led(0xf59e0b)); H.couplerLed.position.set(0, 0.03, 0.13); H.couplerHead.add(H.couplerLed);
    cg.position.set(0, 0, 0);   // head/scissor positions are set in dock-local coordinates in update()

    /* sensors */
    var tagAft = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ map: tagTexture(THREE, 128, 7, '#ffffff', '#000000') }));
    tagAft.rotation.y = Math.PI / 2; tagAft.position.set(-2.495, 0.60, 0); G.add(tagAft);
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      var l = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), led(0xef4444));
      l.position.set(-2.49, 0.60 + Math.sin(a) * 0.115, Math.cos(a) * 0.115); G.add(l);
    }
    var tagFac = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), new THREE.MeshBasicMaterial({ map: tagTexture(THREE, 128, 23, '#ffffff', '#000000') }));
    tagFac.rotation.y = Math.PI / 2; tagFac.position.set(2.33, 1.74, 0); G.add(tagFac);
    var tagMast = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.40, 0.40), m.bayDark); tagMast.position.set(2.31, 1.74, 0); G.add(tagMast);
    [-1, 1].forEach(function (s) {                                   // UWB anchors
      var puck = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.06), m.bayDark); puck.position.set(2.22, 1.56, s * 1.58); G.add(puck);
      var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.10, 6), silver); ant.position.set(2.22, 1.62, s * 1.58); G.add(ant);
      var tof = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), m.bayDark); tof.position.set(-0.2, 0.40, s * 1.51); G.add(tof);
      var tl = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), led(0xef4444)); tl.position.set(-0.2, 0.40, s * 1.485); G.add(tl);
    });
    var sw = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.10), led(0xfacc15)); sw.position.set(-1.838, 0.245, 0.42); G.add(sw);   // bumper limit switch (front face of the hard stop)

    /* thermal: MLI warm box in the back corner of the bay, ammonia heat pipes straight up through the roof
       to the zenith-facing radiator + bimetal louvers directly above it */
    var BX = -2.26, BZ = 1.05, FLOOR = 0.08;
    var foot = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.04, 0.34), m.bayDark); foot.position.set(BX, FLOOR + 0.02, BZ); G.add(foot);
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.30, 0.30), gold); box.position.set(BX, FLOOR + 0.04 + 0.15, BZ); box.castShadow = true; G.add(box); H.box = box;
    var strap = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.025, 0.31), rubber); strap.position.set(BX, FLOOR + 0.04 + 0.15, BZ); G.add(strap);
    H.heaterGlow = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.20), new THREE.MeshStandardMaterial({ color: 0x7c2d12, emissive: 0xf97316, emissiveIntensity: 0 }));
    H.heaterGlow.position.set(BX + 0.19, FLOOR + 0.04 + 0.15, BZ); G.add(H.heaterGlow);             // faces into the bay so the night heater glow is visible
    var boxTop = FLOOR + 0.04 + 0.30, RAD_Y = 1.63;
    [-0.05, 0.05].forEach(function (dx) {                                                          // heat-pipe pair, box → radiator
      var len = RAD_Y - boxTop;
      var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, len, 10), silver); pipe.position.set(BX + dx, boxTop + len / 2, BZ); G.add(pipe);
      var clampB = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), m.bayDark); clampB.position.set(BX + dx, 0.95, BZ); G.add(clampB);
    });
    var boot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), rubber); boot.position.set(BX, 1.535, BZ); G.add(boot);   // roof penetration boot
    var rad = new THREE.Group(); rad.position.set(BX, RAD_Y, BZ); G.add(rad); H.rad = rad;
    var panel = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.02, 0.40), white); rad.add(panel);
    [-0.12, 0, 0.12].forEach(function (zz) { var hp = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.40, 8), silver); hp.rotation.x = Math.PI / 2; hp.position.set(0, 0.016, zz); rad.add(hp); });
    [-0.05, 0.05].forEach(function (dx) { var hdr = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.30, 8), silver); hdr.rotation.x = Math.PI / 2; hdr.position.set(dx, -0.016, 0); rad.add(hdr); });
    var standA = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.02), m.bayDark); standA.position.set(0, -0.06, 0.17); rad.add(standA);
    var standB = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.02), m.bayDark); standB.position.set(0, -0.06, -0.17); rad.add(standB);
    H.louvers = [];
    for (var k = 0; k < 6; k++) {
      var v = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.40), silver);
      v.position.set(-0.175 + k * 0.07, 0.05, 0); rad.add(v); H.louvers.push(v);
    }
    G.updateMatrixWorld(true);
    return H;
  }


  /* ---------------- sectional (overhead) garage door ----------------
   * Six hinged panels ride vertical side tracks, curve through a radius into horizontal ceiling tracks and
   * park flat under the roof, like a conventional garage door. Dock-local: door plane x=2.15, y from 0.115 to 1.40. */
  function buildDoor(THREE, G, m) {
    var X = 2.15, N = 6, PITCH = 0.215, Y0 = 1.255, R = 0.11, YH = Y0 + R, ARC = Math.PI * R / 2;
    var rig = { panels: [], max: (Y0 - 0.115) + ARC + 0.30 };
    var win = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.55 });
    for (var i = 0; i < N; i++) {
      var g = new THREE.Group();
      var mat = i === N - 1 ? m.hazard : (i === 2 ? win : m.bayDark);
      var slat = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.20, 3.04), mat); slat.castShadow = true; g.add(slat);
      var rib = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.022, 3.06), m.bayTrim); rib.position.y = 0.10; g.add(rib);
      G.add(g); rig.panels.push({ g: g, w0: -(i * PITCH) });          // w = distance past the start of the curve (<0 = still on the vertical track)
    }
    // tracks: vertical rails, curved elbow, horizontal ceiling rails, torsion drum + opener
    var steel = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.3 });
    [-1, 1].forEach(function (s) {
      var v = new THREE.Mesh(new THREE.BoxGeometry(0.03, Y0 - 0.1, 0.03), steel); v.position.set(X + 0.03, (Y0 + 0.1) / 2, s * 1.53); G.add(v);
      var el = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.015, 8, 16, Math.PI / 2), steel); el.position.set(X - R, Y0, s * 1.53); G.add(el);
      var h = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.03, 0.03), steel); h.position.set(X - R - 1.15, YH + 0.03, s * 1.53); G.add(h);
      var hb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), steel); hb.position.set(X - R - 1.0, YH + 0.09, s * 1.53); G.add(hb);
    });
    // torsion drum (spins with travel; the two cable drums carry dark index marks so the spin reads)
    var drum = new THREE.Group(); drum.position.set(X + 0.06, 1.38, 0); G.add(drum);
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.0, 12), steel); shaft.rotation.x = Math.PI / 2; drum.add(shaft);
    var spring = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.1, 14), new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.6, roughness: 0.45 }));
    spring.rotation.x = Math.PI / 2; drum.add(spring);
    var spinner = new THREE.Group(); drum.add(spinner);
    [-1.45, 1.45].forEach(function (z) {
      var cd = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 18), steel); cd.rotation.x = Math.PI / 2; cd.position.z = z; spinner.add(cd);
      var mark = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.062, 0.054), m.bayDark); mark.position.set(0, 0.03, z); spinner.add(mark);
    });
    // opener: motor head + rail + trolley that pulls the top panel
    var opener = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.22), m.bayDark); opener.position.set(X - 2.2, 1.36, 0); G.add(opener);
    var openerLight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.12), new THREE.MeshStandardMaterial({ color: 0xfff7e6, emissive: 0xfff1d6, emissiveIntensity: 0.0 }));
    openerLight.position.set(X - 2.03, 1.33, 0); G.add(openerLight);
    var rail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.03, 0.05), steel); rail.position.set(X - 1.05, 1.432, 0); G.add(rail);
    var header = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 3.2), m.bayTrim); header.position.set(X + 0.04, 1.40, 0); G.add(header);   // lintel over the opening
    var trolley = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.03, 0.07), m.hazard); G.add(trolley);
    var DB = 0.30, drawbar = new THREE.Mesh(new THREE.BoxGeometry(DB, 0.012, 0.03), steel); G.add(drawbar);   // rigid arm, pivots at both ends
    var seal = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 3.1), m.bayDark); seal.position.set(X + 0.04, 0.1, 0); G.add(seal);   // brush seal at the sill
    // amber motion beacon on the facade: rotating reflector + pulsing lens while the door moves
    var beacon = new THREE.Group(); beacon.position.set(X + 0.13, 1.52, -1.25); G.add(beacon);
    var bBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.03, 16), m.bayDark); beacon.add(bBase);
    var lensMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.08, transparent: true, opacity: 0.75, roughness: 0.2 });
    var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.07, 16), lensMat); lens.position.y = 0.05; beacon.add(lens);
    var refl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.006), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfbbf24, emissiveIntensity: 0.0 }));
    refl.position.y = 0.05; beacon.add(refl);

    rig.set = function (open) {
      var sTravel = clamp(open, 0, 1) * rig.max;
      for (var k = 0; k < rig.panels.length; k++) {
        var P = rig.panels[k], w = P.w0 + sTravel, x, y, rz;
        if (w <= 0) { x = X; y = Y0 + w; rz = 0; }
        else if (w <= ARC) { var th = w / R; x = X - R + R * Math.cos(th); y = Y0 + R * Math.sin(th); rz = th; }
        else { x = X - R - (w - ARC); y = YH; rz = Math.PI / 2; }
        P.g.position.set(x, y, 0); P.g.rotation.z = rz;
      }
      spinner.rotation.y = -sTravel / 0.06;                    // cable pays off the 60 mm drum
      var top = rig.panels[0].g.position, py = top.y + 0.06, dy = 1.40 - py;
      var tx = top.x - Math.sqrt(Math.max(0, DB * DB - dy * dy));          // trolley sits where the rigid drawbar reaches
      trolley.position.set(tx, 1.402, 0);
      drawbar.position.set((tx + top.x) / 2, (1.40 + py) / 2, 0);
      drawbar.rotation.z = Math.atan2(py - 1.40, top.x - tx);
      rig.open = clamp(open, 0, 1);
    };
    /* drive(target01, dt): opener with soft start, cruise and soft stop (no exponential snap).
       Returns the open fraction. ~3.5 s full travel, like a slow-start residential opener. */
    var ax = MO ? new MO.Axis(0, { vmax: 0.55, amax: 0.45, jerkTau: 0.16 }) : null;
    var beaconT = 0, lightOn = 0;
    rig.drive = function (target, dt) {
      if (!ax) { var o = rig.open + clamp(target - rig.open, -dt / 3.5, dt / 3.5); rig.set(o); return o; }
      ax.target = clamp(target, 0, 1) * rig.max;
      ax.step(dt);
      rig.set(ax.pos / rig.max);
      var moving = Math.abs(ax.vel) > 0.004;
      beaconT += dt;
      var blink = moving ? 0.5 + 0.5 * Math.sin(beaconT * 7.5) : 0;
      lensMat.emissiveIntensity += ((moving ? 0.5 + 1.2 * blink : 0.08) - lensMat.emissiveIntensity) * Math.min(1, dt * 12);
      refl.rotation.y += (moving ? 7.5 : 0) * dt;
      refl.material.emissiveIntensity = moving ? 1.4 : 0;
      lightOn = moving ? 1 : Math.max(0, lightOn - dt / 6);       // opener courtesy light fades out after the move
      openerLight.material.emissiveIntensity = 1.6 * lightOn;
      rig.moving = moving; rig.vel = ax.vel;
      return rig.open;
    };
    rig.snap = function (open01) { if (ax) ax.snap(clamp(open01, 0, 1) * rig.max); rig.set(open01); };
    rig.open = 0;
    rig.set(0);
    return rig;
  }

  var _tmp = null, _clock = 0;
  function update(dt, dockingState, padObj) {
    if (!H) return;
    var THREE = H.THREE;
    _clock += dt;
    // targets by state
    var closed = dockingState === 'CAPTURE' || dockingState === 'LATCH' || dockingState === 'DOCKED';
    if (dockingState === 'UNDOCK') { S.couplerTarget = 0; S.armTarget = S.coupler < 0.05 ? 1 : 0; S.latched = false; S.contactsLive = false; S.chargeRamp = 0; }
    else if (dockingState === 'ENTER' || dockingState === 'ALIGN' || dockingState === 'TRANSIT' || dockingState === 'RETRY') { S.armTarget = 1; S.couplerTarget = 0; }
    else if (dockingState === 'NONE' || dockingState === 'UNDOCK_EXIT') { S.armTarget = 1; S.couplerTarget = 0; S.latched = false; S.contactsLive = false; S.chargeRamp = 0; }
    else if (closed) { S.armTarget = 0; }

    /* clamps + coupler: quintic (minimum-jerk) moves instead of constant-rate ramps. A caller may write S.arm /
       S.coupler directly (reset, scripted poses): the actuators then snap to the new value. */
    if (MO) {
      if (!H.armAct) { H.armAct = new MO.Actuator(S.arm, { vmax: 1.1, tmin: 0.5 }); H.cplAct = new MO.Actuator(S.coupler, { vmax: 0.95, tmin: 0.6 }); H.lastArm = S.arm; H.lastCpl = S.coupler;
        H.armBounce = new MO.Spring(0, { freq: 9, zeta: 0.32 }); H.seat = new MO.Spring(0, { freq: 7, zeta: 0.3 }); H.lou = new MO.Spring(0.3, { freq: 0.12, zeta: 1 }); }
      if (Math.abs(S.arm - H.lastArm) > 1e-9) H.armAct.snap(S.arm);
      if (Math.abs(S.coupler - H.lastCpl) > 1e-9) H.cplAct.snap(S.coupler);
      var armWas = H.armAct.value, cplWas = H.cplAct.value;
      H.armAct.set(S.armTarget); H.cplAct.set(S.couplerTarget);
      S.arm = clamp(H.armAct.step(dt), 0, 1); S.coupler = clamp(H.cplAct.step(dt), 0, 1);
      H.lastArm = S.arm; H.lastCpl = S.coupler;
      // contact transients: rubber pads squash when the jaws land, pogo pins compress when the head seats
      if (armWas > 0.004 && S.arm <= 0.004) H.armBounce.v = -0.06;
      if (cplWas < 0.996 && S.coupler >= 0.996) H.seat.v = -0.09;
      H.armBounce.step(dt); H.seat.step(dt);
    } else {
      S.arm += clamp(S.armTarget - S.arm, -dt / 1.6, dt / 1.6);
      S.coupler += clamp(S.couplerTarget - S.coupler, -dt / 1.6, dt / 1.6);
    }
    var squash = H.armBounce ? H.armBounce.x : 0, seatDip = H.seat ? H.seat.x : 0;

    H.arms.forEach(function (a) {
      var zi = 0.425 + C.ARM_OPEN_GAP * S.arm + squash * 0.25;   // jaw inner face, m from centreline
      var zc = a.s * (zi + 0.0175);
      a.bar.position.set(C.PARK_ALONG, 0.20, zc);
      a.pad.position.set(C.PARK_ALONG, 0.20, a.s * (zi - 0.003));
      a.pad.scale.z = 1 + Math.max(0, -squash) * 18;                         // visible pad squash on contact
      a.lead.position.set(C.PARK_ALONG + 0.96, 0.20, zc + a.s * 0.12); a.lead.rotation.y = -a.s * 0.55;
      var barBack = zc + a.s * 0.0175;                                          // wall-side face of the jaw bar
      a.acts.forEach(function (ac) {
        ac.rod.position.set(C.PARK_ALONG + ac.ax, 0.20, barBack + a.s * a.rodL / 2);   // rod slides; its far end hides in the barrel
        ac.clev.position.set(C.PARK_ALONG + ac.ax, 0.20, barBack + a.s * 0.015);
      });
      a.screw.position.set(C.PARK_ALONG, 0.28, a.s * 0.93);          // fixed 1.0 m screw, wall → just inside the closed jaw
      a.nut.position.set(C.PARK_ALONG, 0.28, barBack + a.s * 0.03);    // the nut rides the screw with the jaw
      a.screw.rotation.y += (H.armAct ? H.armAct.vel : 0) * 22 * dt;    // screw spin follows jaw speed
    });

    // coupler: stowed under the roof; when lowering it tracks the pad (float compliance)
    var stowY = 1.30, stowX = C.PARK_ALONG + C.PAD_OFFSET;
    var tx = stowX, ty = stowY, tz = 0;
    if (padObj) {
      if (!_tmp) _tmp = new THREE.Vector3();
      padObj.getWorldPosition(_tmp); H.group.worldToLocal(_tmp);
      tx = _tmp.x; tz = _tmp.z; ty = _tmp.y + 0.062;
    }
    var f = S.coupler;                                       // already a smooth min-jerk profile
    var cl = MO ? MO.smoothstep(0.55, 1.0, f) : f;          // lateral float only engages near the pad (guide lips)
    var hx = stowX + (tx - stowX) * cl, hy = stowY + (ty - stowY) * f + seatDip, hz = tz * cl;
    H.couplerHead.position.set(hx, hy, hz);
    // scissor stages share the drop equally; each stage is an X of two rods of fixed length
    var sc = H.scissor, headTop = hy + 0.03, drop = Math.max(0.03, sc.top - headTop), hStage = drop / sc.n;
    var halfW = Math.sqrt(Math.max(1e-6, sc.L * sc.L - hStage * hStage)) / 2, ang = Math.atan2(hStage, 2 * halfW);
    sc.rods.forEach(function (r) {
      var yMid = sc.top - (r.st + 0.5) * hStage;
      var xMid = sc.x0 + (hx - sc.x0) * ((r.st + 0.5) / sc.n);
      r.mesh.position.set(xMid, yMid, hz * ((r.st + 0.5) / sc.n) + r.side * 0.075 + r.diag * 0.007);
      r.mesh.rotation.set(0, 0, r.diag * ang);
    });
    sc.pins.forEach(function (pn) {
      var yMid = sc.top - (pn.st + 0.5) * hStage;
      pn.mesh.position.set(sc.x0 + (hx - sc.x0) * ((pn.st + 0.5) / sc.n), yMid, hz * ((pn.st + 0.5) / sc.n) + pn.side * 0.075);
    });
    // status LED: red stowed → amber seated → green breathing while charge current flows
    var live = S.contactsLive, seated = S.coupler > 0.98;
    var col = live ? 0x22c55e : (seated ? 0xf59e0b : 0x7f1d1d);
    H.couplerLed.material.emissive.setHex(col); H.couplerLed.material.color.setHex(col);
    H.couplerLed.material.emissiveIntensity = live ? 0.9 + 0.7 * (0.5 + 0.5 * Math.sin(_clock * 2 * Math.PI / 2.6)) * (S.chargeRamp || 0) : 1.6;
    // magnet rings glow as the head approaches the pad (hall array lock-on)
    var near = MO ? MO.smoothstep(0.75, 1.0, f) : f;
    H.magRings.forEach(function (mm) { mm.emissiveIntensity = 0.25 + 1.6 * near; });

    // louvers: bimetal springs are slow — they swing over tens of seconds, never snap. Heater glow fades.
    var th = S.th || { louver: 0.3, heaterW: 0 };
    var lv = th.louver;
    if (H.lou) { H.lou.target = lv; lv = H.lou.step(dt); }
    H.louvers.forEach(function (v, i) { v.rotation.z = lv * 1.2 * (0.96 + 0.04 * Math.sin(i * 1.7)); });
    var hg = H.heaterGlow.material;
    hg.emissiveIntensity += ((th.heaterW > 0 ? 1.2 + 0.25 * Math.sin(_clock * 0.9) : 0.0) - hg.emissiveIntensity) * Math.min(1, dt / 2.5);
  }

  /* ---------------- HUD ---------------- */
  var _hudT = 0;
  function hud(dockingState, pose, roverWh) {
    if (typeof document === 'undefined') return;
    var nowMs = (typeof performance !== 'undefined') ? performance.now() : 0;
    if (nowMs - _hudT < 100 && document.getElementById('dock-hud')) return;
    _hudT = nowMs;
    var el = document.getElementById('dock-hud');
    if (!el) {
      el = document.createElement('div'); el.id = 'dock-hud';
      el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:50;width:262px;font:10px/1.35 ui-monospace,Menlo,monospace;color:#cbd5e1;background:rgba(2,6,23,.82);border:1px solid #334155;border-radius:6px;padding:6px 8px;pointer-events:auto';
      document.body.appendChild(el);
      el.addEventListener('click', function (ev) { if (ev.target && ev.target.id === 'dock-env') { S.env = S.env === 'day' ? 'night' : 'day'; } });
    }
    var show = dockingState && dockingState !== 'NONE';
    var th = S.th || {};
    var f = function (x, d) { return (x === undefined || isNaN(x)) ? '—' : x.toFixed(d); };
    var lat = pose ? (pose.lat * 1000) : NaN, psi = pose ? (pose.psi * 57.2958) : NaN;
    el.innerHTML =
      '<div style="color:#38bdf8;font-weight:700;letter-spacing:.05em">DOCK STATION · ' + (show ? dockingState : 'IDLE') + (S.fault && show ? ' <span style="color:#f59e0b">(' + S.fault + ')</span>' : '') + '</div>' +
      (show ? '<div>SENSOR <span style="color:#a7f3d0">' + S.sensor + '</span></div>' +
        '<div>lat <b>' + f(lat, 1) + '</b> mm · yaw <b>' + f(psi, 2) + '</b>° · σ ' + f(S.sigma * 1000, 1) + ' mm</div>' +
        '<div>CLAMP ' + Math.round((1 - S.arm) * 100) + '% · COUPLER ' + Math.round(S.coupler * 100) + '% · ' + (S.latched ? '<span style="color:#4ade80">LATCHED</span>' : 'unlatched') + (S.retries ? ' · retry ' + S.retries : '') + '</div>' : '') +
      '<div>PV ' + f(S.pvW, 0) + ' W · LOAD ' + f(S.loadW, 1) + ' W · BUF ' + f(S.bufferWh / C.BUFFER_WH * 100, 0) + '% (' + f(S.bufferWh, 0) + ' Wh)</div>' +
      (roverWh != null ? '<div style="color:#fde68a">ROVER ' + f(roverWh / C.PACK_WH * 100, 0) + '% (' + f(roverWh, 1) + '/' + C.PACK_WH + ' Wh, ' + C.PACK_AH + ' Ah) · SPARES ' + f(S.spares[0] / C.PACK_WH * 100, 0) + '/' + f(S.spares[1] / C.PACK_WH * 100, 0) + '% ' + (S.spareW > 0.5 ? '+' + f(S.spareW, 0) + ' W' : 'full/idle') + '</div>' +
        '<div style="color:#fde68a">swaps ' + S.swaps + (S.swapT > 0 ? ' · SWAPPING ' + f(S.swapT / C.SWAP_S * 100, 0) + '%' : '') + ' · sorties ' + S.sorties.length + (S.sorties.length ? ' · avg ' + f(S.sorties.reduce(function (a, q) { return a + q.usedWh; }, 0) / S.sorties.length, 1) + ' Wh · runs left ' + runsLeft(roverWh) : '') + '</div>' : '') +
      '<div>BOX ' + f(th.box, 0) + '°C · RAD ' + f(th.radiator, 0) + '°C · LOUVER ' + f((th.louver || 0) * 100, 0) + '% · HTR ' + f(th.heaterW, 2) + ' W</div>' +
      '<div><button id="dock-env" style="margin-top:3px;background:#1e293b;border:1px solid #475569;border-radius:3px;color:#e2e8f0;padding:0 6px;cursor:pointer">ENV: ' + S.env.toUpperCase() + ' (click to toggle)</button>' +
      (S.env === 'night' ? ' <span style="color:#fbbf24">hold ≈ ' + f(S.bufferWh * 0.8 / C.NIGHT_SURVIVAL_W, 0) + ' h of 354 h</span>' : '') + '</div>';
  }

  root.NASA_Dock = {
    C: C, state: function () { return S; }, reset: function () { var lg = S.onLog; S = fresh(); S.onLog = lg; },   // keep the logger across resets
    beginApproach: beginApproach, step: step, assist: assist, sensorFor: sensorFor,
    chargePowerW: chargePowerW, stepStation: stepStation, stationLoadW: stationLoadW,
    build: build, buildDoor: buildDoor, update: update, hud: hud, setLogger: function (fn) { S.onLog = fn; },
    resetSpares: function () { S.spares = [C.PACK_WH, C.PACK_WH]; S.spareWh = C.PACK_WH; },
    swapStep: swapStep, noteDeparture: noteDeparture, noteArrival: noteArrival, chargeMinutes: chargeMinutes, runsLeft: runsLeft,
    releaseReady: function () { return S.arm > 0.97 && S.coupler < 0.03; },
    _wrapPi: wrapPi
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NASA_Dock;
})(typeof window !== 'undefined' ? window : globalThis);
