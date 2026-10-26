/* =========================================================================
 * NASA HUNCH LLASO — motion primitives for the CAD viewers, dock station and website
 * js/motion.js   →  window.NASA_Motion   (also require()-able in node)
 *
 * Why: linear "rate" moves and exponential lerps look robotic. Real mechanisms accelerate,
 * cruise, decelerate, and settle with a little compliance. Everything here is frame-rate
 * independent and works with any dt.
 *
 *   minJerk(u)            0..1 → 0..1, zero velocity + acceleration at both ends (Flash & Hogan)
 *   Quintic               boundary-matched polynomial (p,v,a) → (p1,0,0); retargets without a jolt
 *   Actuator              motor-driven joint: quintic reference + optional 2nd-order compliance
 *   Spring                damped spring follower (critically / under-damped), sub-stepped
 *   Axis                  velocity/acceleration-limited follower with smoothed (jerk-limited) accel
 *   Timeline              sequence of timed segments with overlaps, for scripted demos
 *   damp(a,b,lambda,dt)   frame-rate independent exponential smoothing (for cameras / UI only)
 * ========================================================================= */
(function (root) {
  'use strict';

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function minJerk(u) { u = clamp(u, 0, 1); return u * u * u * (10 + u * (-15 + 6 * u)); }
  function minJerkVel(u) { u = clamp(u, 0, 1); return 30 * u * u * (1 - u) * (1 - u); }   // d/du
  function easeInOutCubic(u) { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function easeOutCubic(u) { u = clamp(u, 0, 1); return 1 - Math.pow(1 - u, 3); }
  function easeInCubic(u) { u = clamp(u, 0, 1); return u * u * u; }
  function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
  function wrapPi(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  /* ---- quintic from (p0, v0, a0) to (p1, v1, a1) in T seconds ---- */
  function Quintic(p0, v0, a0, p1, v1, a1, T) {
    T = Math.max(1e-4, T);
    var T2 = T * T, T3 = T2 * T, T4 = T3 * T, T5 = T4 * T, d = p1 - p0;
    this.T = T; this.p1 = p1;
    this.c = [p0, v0, a0 / 2,
      (20 * d - (8 * v1 + 12 * v0) * T - (3 * a0 - a1) * T2) / (2 * T3),
      (-30 * d + (14 * v1 + 16 * v0) * T + (3 * a0 - 2 * a1) * T2) / (2 * T4),
      (12 * d - 6 * (v1 + v0) * T - (a0 - a1) * T2) / (2 * T5)];
  }
  Quintic.prototype.eval = function (t) {
    var c = this.c;
    if (t >= this.T) { return { p: this.p1, v: 0, a: 0 }; }
    if (t <= 0) t = 0;
    return {
      p: c[0] + t * (c[1] + t * (c[2] + t * (c[3] + t * (c[4] + t * c[5])))),
      v: c[1] + t * (2 * c[2] + t * (3 * c[3] + t * (4 * c[4] + t * 5 * c[5]))),
      a: 2 * c[2] + t * (6 * c[3] + t * (12 * c[4] + t * 20 * c[5]))
    };
  };

  /* ---- Spring: x'' = w^2 (target - x) - 2 zeta w x' ---- */
  function Spring(x, opt) {
    opt = opt || {};
    this.x = x || 0; this.v = 0; this.target = this.x;
    this.freq = opt.freq || 3; this.zeta = opt.zeta == null ? 1 : opt.zeta;
  }
  Spring.prototype.step = function (dt) {
    var w = 2 * Math.PI * this.freq, n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
    for (var i = 0; i < n; i++) {
      var acc = w * w * (this.target - this.x) - 2 * this.zeta * w * this.v;
      this.v += acc * h; this.x += this.v * h;          // semi-implicit Euler: stable for these stiffnesses
    }
    return this.x;
  };
  Spring.prototype.snap = function (x) { this.x = this.target = x; this.v = 0; return this; };
  Spring.prototype.settled = function (eps) { eps = eps || 1e-4; return Math.abs(this.target - this.x) < eps && Math.abs(this.v) < eps * 10; };

  /* ---- Actuator: a motor joint. Quintic reference (retargets keep p/v/a continuous) and an optional
   *      compliance spring on top so the output lags a hair and settles like real hardware.
   *      opt: { vmax (units/s peak), tmin (s), comply: {freq, zeta} | null, bias: s added per move } ---- */
  function Actuator(value, opt) {
    opt = opt || {};
    this.vmax = opt.vmax || 1; this.tmin = opt.tmin == null ? 0.35 : opt.tmin; this.bias = opt.bias || 0;
    this.ref = value || 0; this.vref = 0; this.aref = 0; this.target = this.ref;
    this.q = null; this.t = 0;
    this.comply = opt.comply ? new Spring(this.ref, opt.comply) : null;
    this.value = this.ref; this.vel = 0;
  }
  Actuator.prototype.duration = function (d) {
    // a min-jerk move peaks at 1.875x its average speed: size T so the peak stays under vmax
    var T = 1.875 * Math.abs(d) / this.vmax + this.bias;
    if (this.vref * d < 0) T += Math.abs(this.vref) / this.vmax * 0.6;    // reversing: allow time to stop first
    return Math.max(this.tmin, T);
  };
  Actuator.prototype.set = function (target, T) {
    if (Math.abs(target - this.target) < 1e-9 && this.q) return this;
    if (Math.abs(target - this.ref) < 1e-9 && Math.abs(this.vref) < 1e-6) { this.target = target; this.q = null; return this; }
    this.target = target;
    this.q = new Quintic(this.ref, this.vref, this.aref, target, 0, 0, T || this.duration(target - this.ref));
    this.t = 0;
    return this;
  };
  Actuator.prototype.snap = function (v) { this.ref = this.target = this.value = v; this.vref = this.aref = this.vel = 0; this.q = null; if (this.comply) this.comply.snap(v); return this; };
  Actuator.prototype.step = function (dt) {
    if (this.q) {
      this.t += dt;
      var s = this.q.eval(this.t);
      this.ref = s.p; this.vref = s.v; this.aref = s.a;
      if (this.t >= this.q.T) { this.q = null; this.ref = this.target; this.vref = this.aref = 0; }
    }
    var prev = this.value;
    if (this.comply) { this.comply.target = this.ref; this.value = this.comply.step(dt); }
    else this.value = this.ref;
    this.vel = dt > 0 ? (this.value - prev) / dt : 0;
    return this.value;
  };
  Actuator.prototype.busy = function () { return !!this.q || (this.comply && !this.comply.settled(1e-4)); };
  Actuator.prototype.progress = function () { return this.q ? clamp(this.t / this.q.T, 0, 1) : 1; };

  /* ---- Axis: velocity/acceleration-limited follower (vehicle drive, door opener, lead screw).
   *      Brakes on the v^2 = 2 a d curve, acceleration is low-pass filtered (soft jerk) so starts and
   *      stops have no corners. opt: { vmax, amax, jerkTau (s) } ---- */
  function Axis(pos, opt) {
    opt = opt || {};
    this.pos = pos || 0; this.vel = 0; this.acc = 0; this.target = this.pos;
    this.vmax = opt.vmax || 1; this.amax = opt.amax || 1; this.jerkTau = opt.jerkTau == null ? 0.18 : opt.jerkTau;
    this.vlimit = this.vmax; this.kFinal = opt.kFinal || 1.8;
  }
  Axis.prototype.step = function (dt) {
    var n = Math.max(1, Math.ceil(dt / 0.005)), h = dt / n;
    for (var i = 0; i < n; i++) {
      var d = this.target - this.pos, dir = d >= 0 ? 1 : -1;
      // braking speed with margin for the filtered acceleration lag
      var lead = Math.abs(this.vel) * this.jerkTau * 1.3;               // distance covered while the filtered decel builds up
      var vStop = Math.sqrt(Math.max(0, 2 * this.amax * 0.8 * Math.max(0, Math.abs(d) - lead)));
      // final approach is first-order (v = k d) so the filtered acceleration can't overshoot the stop
      var vWant = dir * Math.min(this.vlimit, vStop, this.kFinal * Math.abs(d));
      if (Math.abs(d) < 1e-4 && Math.abs(this.vel) < 1e-3) { vWant = 0; }
      var aWant = clamp((vWant - this.vel) / Math.max(h, 0.06), -this.amax, this.amax);
      this.acc += (aWant - this.acc) * (1 - Math.exp(-h / Math.max(1e-3, this.jerkTau)));
      this.vel += this.acc * h;
      this.pos += this.vel * h;
      if (Math.abs(this.target - this.pos) < 5e-4 && Math.abs(this.vel) < 0.004) { this.pos = this.target; this.vel = 0; this.acc = 0; }
    }
    return this.pos;
  };
  Axis.prototype.snap = function (p) { this.pos = this.target = p; this.vel = this.acc = 0; return this; };
  Axis.prototype.arrived = function (eps) { return Math.abs(this.target - this.pos) < (eps || 1e-3) && Math.abs(this.vel) < 0.01; };

  /* ---- Timeline: list of { at, dur, fn(u, uRaw), ease } run by elapsed time; .then() chains ---- */
  function Timeline() { this.items = []; this.t = 0; this.cursor = 0; this.done = false; this.onDone = null; }
  Timeline.prototype.add = function (at, dur, fn, ease) { this.items.push({ at: at, dur: Math.max(1e-4, dur), fn: fn, ease: ease || minJerk, fired: false, ended: false }); this.cursor = Math.max(this.cursor, at + dur); return this; };
  Timeline.prototype.then = function (dur, fn, ease, overlap) { return this.add(this.cursor - (overlap || 0), dur, fn, ease); };
  Timeline.prototype.wait = function (dur) { this.cursor += dur; return this; };
  Timeline.prototype.call = function (fn) { var at = this.cursor; this.items.push({ at: at, dur: 1e-4, fn: function (u) { if (u >= 1) fn(); }, ease: function (u) { return u; }, once: true }); return this; };
  Timeline.prototype.step = function (dt) {
    if (this.done) return true;
    this.t += dt;
    var all = true;
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      if (it.ended) continue;
      if (this.t < it.at) { all = false; continue; }
      var u = clamp((this.t - it.at) / it.dur, 0, 1);
      it.fn(it.ease(u), u);
      if (u >= 1) it.ended = true; else all = false;
    }
    if (all) { this.done = true; if (this.onDone) this.onDone(); }
    return this.done;
  };
  Timeline.prototype.length = function () { return this.cursor; };

  /* ---- joint-space path through via points with continuous velocity (no stop at each via).
   *      pts: [{q:[...], t:seconds from previous, stop:true to come to rest there}]  ---- */
  function ViaPath(q0, pts) {
    this.segs = []; var prev = q0.slice(), tAcc = 0, n = q0.length;
    // via velocities: average of neighbouring slopes when they agree in sign, else 0 (classic heuristic)
    var Q = [q0.slice()].concat(pts.map(function (p) { return p.q.slice(); }));
    var Ts = [0].concat(pts.map(function (p) { return p.t; }));
    var V = Q.map(function () { var z = []; for (var k = 0; k < n; k++) z.push(0); return z; });
    for (var i = 1; i < Q.length - 1; i++) {
      if (pts[i - 1].stop) continue;
      for (var k = 0; k < n; k++) {
        var s0 = (Q[i][k] - Q[i - 1][k]) / Ts[i], s1 = (Q[i + 1][k] - Q[i][k]) / Ts[i + 1];
        V[i][k] = (s0 * s1 > 0) ? 0.5 * (s0 + s1) * (Math.min(Math.abs(s0), Math.abs(s1)) / Math.max(Math.abs(s0), Math.abs(s1))) * 1.2 : 0;
      }
    }
    for (var j = 1; j < Q.length; j++) {
      var qs = [];
      for (var kk = 0; kk < n; kk++) qs.push(new Quintic(Q[j - 1][kk], V[j - 1][kk], 0, Q[j][kk], V[j][kk], 0, Ts[j]));
      this.segs.push({ t0: tAcc, T: Ts[j], q: qs, tag: pts[j - 1].tag || null, fired: false });
      tAcc += Ts[j];
    }
    this.T = tAcc; this.t = 0; this.n = n; this.end = Q[Q.length - 1];
  }
  ViaPath.prototype.step = function (dt, onTag) {
    this.t += dt;
    var out = this.end.slice();
    for (var i = 0; i < this.segs.length; i++) {
      var s = this.segs[i];
      if (this.t < s.t0 + s.T || i === this.segs.length - 1) {
        var tt = clamp(this.t - s.t0, 0, s.T);
        for (var k = 0; k < this.n; k++) out[k] = s.q[k].eval(tt).p;
        break;
      }
    }
    // tags fire when their segment completes (e.g. 'grip' after arriving over the pod)
    for (var j = 0; j < this.segs.length; j++) {
      var sg = this.segs[j];
      if (!sg.fired && this.t >= sg.t0 + sg.T) { sg.fired = true; if (sg.tag && onTag) onTag(sg.tag); }
    }
    return out;
  };
  ViaPath.prototype.done = function () { return this.t >= this.T; };

  root.NASA_Motion = {
    clamp: clamp, lerp: lerp, minJerk: minJerk, minJerkVel: minJerkVel, smoothstep: smoothstep,
    easeInOutCubic: easeInOutCubic, easeOutCubic: easeOutCubic, easeInCubic: easeInCubic, damp: damp, wrapPi: wrapPi,
    Quintic: Quintic, Spring: Spring, Actuator: Actuator, Axis: Axis, Timeline: Timeline, ViaPath: ViaPath
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NASA_Motion;
})(typeof window !== 'undefined' ? window : globalThis);
