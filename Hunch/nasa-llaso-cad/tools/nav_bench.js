/* Navigation benchmark for viewer.html (runs in the page, steps the sim headlessly with updatePhysics).
 * Load:  var s = document.createElement('script'); s.src = 'tools/nav_bench.js'; document.body.appendChild(s);
 * Run:   NavBench.reset(); then call NavBench.step(25000) until it returns 'done'; NavBench.summary().
 * 12 routes: the 4 crater-field corridors from runPitCorridorSelfTest plus 8 seeded routes across the map.
 * Per route: reached goal, crash, crater-bowl entry, min pit-edge and rock clearance, rock contacts,
 * time, path efficiency (straight / driven), time stopped and reversing, steering reversals per minute. */
(function () {
  'use strict';
  var DT = 0.05, LIMIT_STEPS = 3000;   // 150 s per route
  function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function routes() {
    var R = rng(777), out = [
      { from: { x: 0, z: 5 }, to: { x: -20, z: 16 }, label: 'NW craters' },
      { from: { x: 2, z: 4 }, to: { x: 14, z: -20 }, label: 'SE pit field' },
      { from: { x: -4, z: 2 }, to: { x: 18, z: 22 }, label: 'NE holes' },
      { from: { x: 5, z: -5 }, to: { x: -15, z: -25 }, label: 'SW rim' }
    ];
    var guard = 0;
    while (out.length < 12 && guard++ < 500) {
      var a = { x: (R() - 0.5) * 80, z: (R() - 0.5) * 80 }, b = { x: (R() - 0.5) * 80, z: (R() - 0.5) * 80 };
      if (Math.hypot(a.x - b.x, a.z - b.z) < 22) continue;
      var sa = nearestSafeNavPoint(a.x, a.z, 10), sb = nearestSafeNavPoint(b.x, b.z, 10);
      if (!sa || !sb) continue;
      out.push({ from: { x: sa.x, z: sa.z }, to: { x: sb.x, z: sb.z }, label: 'R' + out.length });
    }
    return out;
  }
  var B = null;
  function start(c) {
    if (isCrashed) document.getElementById('btn-retry').click();
    wanderOn = false; dockingState = 'NONE'; pendingMissionAfterUndock = null;
    roverGroup.position.set(c.from.x, getH(c.from.x, c.from.z) + 0.22, c.from.z);
    roverYaw = Math.atan2(-(c.to.z - c.from.z), c.to.x - c.from.x);
    vel = 0; turnVel = 0; isCrashed = false;
    if (typeof navResetMap === 'function') navResetMap();   // fresh onboard map per route: results do not depend on order
    plannedPathPoints = []; navPathIdx = 0; navStuckTimer = 0;
    document.getElementById('crash-screen').style.display = 'none';
    autoOn = true; syncAutopilotUiEngaged();
    queueMissionOrUndock(c.to.x, c.to.z, 'BENCH ' + c.label);
    return { label: c.label, steps: 0, dist: 0, minPit: 99, minRock: 99, bowl: false, crashed: false, reached: false, contacts: 0,
      stopT: 0, revT: 0, flips: 0, lastSign: 0, prev: { x: c.from.x, z: c.from.z }, straight: Math.hypot(c.to.x - c.from.x, c.to.z - c.from.z) };
  }
  function step(budgetMs) {
    var t0 = performance.now();
    while (performance.now() - t0 < budgetMs) {
      if (!B.cur) { B.i++; if (B.i >= B.cases.length) return 'done'; B.cur = start(B.cases[B.i]); }
      var m = B.cur;
      updatePhysics(DT); m.steps++;
      var p = roverGroup.position;
      m.dist += Math.hypot(p.x - m.prev.x, p.z - m.prev.z); m.prev = { x: p.x, z: p.z };
      m.minPit = Math.min(m.minPit, nearestPitClearance(p.x, p.z));
      if (isInCraterBowl(p.x, p.z)) m.bowl = true;
      var rc = 99;
      for (var i = 0; i < rockData.length; i++) { var r = rockData[i]; var d = Math.hypot(p.x - r.x, p.z - r.z) - r.r - 0.48; if (d < rc) rc = d; }
      m.minRock = Math.min(m.minRock, rc); if (rc < 0) m.contacts++;
      if (Math.abs(vel) < 0.05) m.stopT += DT;
      if (vel < -0.02) m.revT += DT;
      var sg = turnVel > 0.15 ? 1 : (turnVel < -0.15 ? -1 : 0);
      if (sg && m.lastSign && sg !== m.lastSign) m.flips++;
      if (sg) m.lastSign = sg;
      if (isCrashed) m.crashed = true;
      var g = globalGoal, near = g && Math.hypot(p.x - g.x, p.z - g.z) < 2.8;
      if (near) m.reached = true;
      if (isCrashed || near || m.steps >= LIMIT_STEPS) {
        var mins = m.steps * DT / 60;
        B.res.push({ label: m.label, reached: m.reached, crashed: m.crashed, bowl: m.bowl, t: Math.round(m.steps * DT),
          eff: +(m.straight / Math.max(1, m.dist)).toFixed(2), minPit: +m.minPit.toFixed(2), minRock: +m.minRock.toFixed(2),
          contacts: m.contacts, stopS: Math.round(m.stopT), revS: Math.round(m.revT), flipsPerMin: +(m.flips / Math.max(0.1, mins)).toFixed(1) });
        B.cur = null;
      }
    }
    return 'route ' + (B.i + 1) + '/' + B.cases.length;
  }
  function summary() {
    var r = B.res, n = r.length || 1, s = function (f) { return r.reduce(function (a, x) { return a + f(x); }, 0); };
    return {
      routes: r.length, reached: s(function (x) { return x.reached ? 1 : 0; }), crashed: s(function (x) { return x.crashed ? 1 : 0; }),
      bowl: s(function (x) { return x.bowl ? 1 : 0; }), contactFrames: s(function (x) { return x.contacts; }),
      meanT: +(s(function (x) { return x.t; }) / n).toFixed(1), meanEff: +(s(function (x) { return x.eff; }) / n).toFixed(2),
      minPit: Math.min.apply(null, r.map(function (x) { return x.minPit; })), minRock: Math.min.apply(null, r.map(function (x) { return x.minRock; })),
      stopS: s(function (x) { return x.stopS; }), revS: s(function (x) { return x.revS; }),
      meanFlipsPerMin: +(s(function (x) { return x.flipsPerMin; }) / n).toFixed(1)
    };
  }
  window.NavBench = {
    reset: function () { if (window.NASA_Intro && NASA_Intro.active) NASA_Intro.skip(); B = { cases: routes(), i: -1, res: [], cur: null }; return B.cases.length; },
    step: step, summary: summary, results: function () { return B.res; }, cases: function () { return B.cases; },
    only: function (labels) { B.cases = B.cases.filter(function (c) { return labels.indexOf(c.label) >= 0; }); return B.cases.length; }
  };
})();
