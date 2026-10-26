/**
 * Mission scoring for LLASO-P2-XPORT-2026 (Missions 2, 3, 5, 6).
 * Pure logic, no THREE or DOM, so tools/mission_scoring_test.js can run it in Node.
 *   - tip gate: scales speed down as the static rollover margin shrinks
 *   - stability tracker: pod carried through start / stop / turn on rough ground
 *   - dust seal: extend -> compress -> sealed, only when the rover is square to the face
 *   - verdicts and the end-of-cycle report
 */
(function (root) {
  var TOL = {
    placementM: 0.10,        // pod set within 10 cm of the receiving-zone anchor
    alignYawRad: 6 * Math.PI / 180,   // rover square to the airlock face within 6 deg (collar compliance)
    tipStop: 0.5,            // m/s^2 lateral margin; same limit the ROLLOVER alert uses
    tipWarn: 1.0,
    tiltRad: 0.30,           // same limit as the TILT alert
    latFrac: 0.6             // lateral accel must stay under 60 % of the tip margin
  };
  var SEAL_T = { extend: 1.2, compress: 0.9 };

  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /** Speed multiplier from the weaker of roll/pitch margin and current lateral acceleration. */
  function tipSpeedScale(marginRoll, marginPitch, latAccel) {
    var m = Math.min(marginRoll, marginPitch);
    var s = m >= TOL.tipWarn ? 1 : 0.3 + 0.7 * clamp((m - TOL.tipStop) / (TOL.tipWarn - TOL.tipStop), 0, 1);
    if (latAccel > TOL.latFrac * m) s = Math.min(s, 0.7);
    return s;
  }
  function tipLevel(marginRoll, marginPitch) {
    var m = Math.min(marginRoll, marginPitch);
    return m < TOL.tipStop ? 'stop' : (m < TOL.tipWarn ? 'warn' : 'ok');
  }

  function createStability() {
    var s = { samples: 0, minMargin: Infinity, maxLatAccel: 0, maxTilt: 0, starts: 0, stops: 0, turns: 0, lockLost: false, moving: false, turning: false };
    return {
      reset: function () { s = { samples: 0, minMargin: Infinity, maxLatAccel: 0, maxTilt: 0, starts: 0, stops: 0, turns: 0, lockLost: false, moving: false, turning: false }; },
      /** in: { carrying, lockHeld, speed, yawRate, marginRoll, marginPitch, tilt } */
      add: function (i) {
        if (!i.carrying) { s.moving = false; s.turning = false; return; }
        if (!i.lockHeld) s.lockLost = true;
        var moving = Math.abs(i.speed) > 0.05, turning = Math.abs(i.yawRate) > 0.2;
        if (moving && !s.moving) s.starts++;
        if (!moving && s.moving) s.stops++;
        if (turning && !s.turning && moving) s.turns++;
        s.moving = moving; s.turning = turning;
        s.samples++;
        s.minMargin = Math.min(s.minMargin, i.marginRoll, i.marginPitch);
        s.maxLatAccel = Math.max(s.maxLatAccel, Math.abs(i.speed * i.yawRate));
        s.maxTilt = Math.max(s.maxTilt, Math.abs(i.tilt || 0));
      },
      result: function () {
        var exercised = s.starts > 0 && s.stops > 0 && s.turns > 0;
        var margin = s.samples ? s.minMargin : null;
        var limitsOk = s.samples > 0 && margin >= TOL.tipStop && s.maxLatAccel <= TOL.latFrac * margin && s.maxTilt <= TOL.tiltRad;
        return {
          samples: s.samples, starts: s.starts, stops: s.stops, turns: s.turns,
          minMargin: margin, maxLatAccel: s.maxLatAccel, maxTilt: s.maxTilt, lockLost: s.lockLost,
          exercised: exercised, pass: !s.lockLost && limitsOk && exercised
        };
      }
    };
  }

  function createSeal() {
    var st = { state: 'RETRACTED', t: 0, fault: null };
    return {
      get state() { return st.state; },
      get fault() { return st.fault; },
      get ready() { return st.state === 'SEALED'; },
      /**
       * want: rover is parked at the face and the door should open
       * yawErr: rover heading error to the face normal (rad)
       * doorClosed: door fully shut (seal may only retract once it is)
       */
      step: function (dt, want, yawErr, doorClosed) {
        if (want) {
          if (st.state === 'RETRACTED' || st.state === 'FAULT') {
            if (Math.abs(wrap(yawErr)) > TOL.alignYawRad) {
              st.state = 'FAULT'; st.fault = 'NOT SQUARE ' + (Math.abs(wrap(yawErr)) * 180 / Math.PI).toFixed(1) + ' deg';
              return;
            }
            st.state = 'EXTEND'; st.t = 0; st.fault = null;
          }
          if (st.state === 'EXTEND') { st.t += dt; if (st.t >= SEAL_T.extend) { st.state = 'COMPRESS'; st.t = 0; } }
          else if (st.state === 'COMPRESS') { st.t += dt; if (st.t >= SEAL_T.compress) { st.state = 'SEALED'; st.t = 0; } }
        } else if (st.state !== 'RETRACTED' && (doorClosed !== false)) {
          st.state = 'RETRACTED'; st.t = 0; st.fault = null;
        }
      },
      /** 0 = retracted, 1 = fully compressed; drives the seal ring animation. */
      extension: function () {
        if (st.state === 'EXTEND') return 0.7 * clamp(st.t / SEAL_T.extend, 0, 1);
        if (st.state === 'COMPRESS') return 0.7 + 0.3 * clamp(st.t / SEAL_T.compress, 0, 1);
        return st.state === 'SEALED' ? 1 : 0;
      }
    };
  }

  function placementVerdict(errM) {
    return { errM: errM, pass: errM != null && errM <= TOL.placementM, tolM: TOL.placementM };
  }
  function alignVerdict(yawErrRad) {
    var e = Math.abs(wrap(yawErrRad));
    return { yawErrDeg: e * 180 / Math.PI, pass: e <= TOL.alignYawRad, tolDeg: TOL.alignYawRad * 180 / Math.PI };
  }

  /** s: { simTimeS, distanceM, whUsed, delivered, massKg, placementErrM, sealed, stability } */
  function buildReport(s) {
    var place = placementVerdict(s.placementErrM);
    var stab = s.stability || { pass: false };
    return {
      simTimeS: +s.simTimeS.toFixed(1), distanceM: +s.distanceM.toFixed(1), whUsed: +s.whUsed.toFixed(2),
      delivered: s.delivered, massKg: +s.massKg.toFixed(2),
      placementErrM: s.placementErrM == null ? null : +s.placementErrM.toFixed(3),
      placementPass: place.pass, sealed: !!s.sealed, stabilityPass: !!stab.pass, stability: stab,
      success: s.delivered > 0 && place.pass && !!s.sealed && !!stab.pass
    };
  }

  root.NASA_Scoring = {
    TOL: TOL, SEAL_T: SEAL_T, tipSpeedScale: tipSpeedScale, tipLevel: tipLevel,
    createStability: createStability, createSeal: createSeal,
    placementVerdict: placementVerdict, alignVerdict: alignVerdict, buildReport: buildReport, wrap: wrap,
    _scale: 1,
    speedScale: function () { return root.NASA_Scoring._scale; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NASA_Scoring;
})(typeof window !== 'undefined' ? window : globalThis);
