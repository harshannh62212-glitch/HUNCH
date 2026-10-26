/**
 * Mission 7: the scaled lunar supply route.
 * The storyboard has about 2 km between landing pad and habitat. The sim field is only about
 * 160 m across, so the course is scaled 1:25 (80 m = 2 km). The rover starts just outside the pad's
 * plume blast zone and must reach the habitat on its own, around restricted zones and steep ground.
 * Pure logic (zones, stats) is testable in Node; the browser part wires it to the rover.
 */
(function (root) {
  var SCALE = 25;
  var PAD = { x: 45, z: -40 };
  var START = { x: 62, z: -48, yaw: Math.PI };          // heading -x (west)
  var ZONES = [
    { id: 'plume',  label: 'Landing plume blast zone', x: PAD.x, z: PAD.z, r: 11, kind: 'plume' },
    { id: 'rz-1',   label: 'Restricted zone 1',        x: 22,    z: -34,   r: 6,  kind: 'restricted' },
    { id: 'rz-2',   label: 'Restricted zone 2',        x: 0,     z: -26,   r: 6,  kind: 'restricted' },
    { id: 'rz-3',   label: 'Restricted zone 3',        x: -10,   z: -33,   r: 5,  kind: 'restricted' }
  ];
  var LIMITS = { slopeDeg: 20, minScaledKm: 1.9 };

  function inside(x, z, zones) {
    for (var i = 0; i < zones.length; i++) {
      if (Math.hypot(x - zones[i].x, z - zones[i].z) < zones[i].r) return zones[i];
    }
    return null;
  }
  function clearance(x, z, zones) {
    var m = Infinity;
    zones.forEach(function (q) { m = Math.min(m, Math.hypot(x - q.x, z - q.z) - q.r); });
    return m;
  }
  function slopeDeg(h0, h1, d) { return Math.atan2(Math.abs(h1 - h0), d) * 180 / Math.PI; }

  function createRun(zones) {
    var st = { pathM: 0, last: null, violations: {}, violationSamples: 0, minClear: Infinity, maxSlope: 0, steepSamples: 0, samples: 0 };
    return {
      /** Feed the rover position each tick; slope is the grade over the last step. */
      sample: function (x, z, h) {
        if (st.last) {
          var d = Math.hypot(x - st.last.x, z - st.last.z);
          st.pathM += d;
        }
        // Grade is measured over a 0.5 m baseline (about the rover's wheelbase) so bumps from a single
        // rock or noisy height sample do not count as a steep slope.
        if (!st.anchor) st.anchor = { x: x, z: z, h: h };
        var da = Math.hypot(x - st.anchor.x, z - st.anchor.z);
        if (da >= 0.5) {
          var sd = slopeDeg(st.anchor.h, h, da);
          if (sd > st.maxSlope) st.maxSlope = sd;
          if (sd > LIMITS.slopeDeg) st.steepSamples++;
          st.anchor = { x: x, z: z, h: h };
        }
        st.last = { x: x, z: z, h: h };
        st.samples++;
        var z0 = inside(x, z, zones);
        if (z0) { st.violations[z0.id] = (st.violations[z0.id] || 0) + 1; st.violationSamples++; }
        st.minClear = Math.min(st.minClear, clearance(x, z, zones));
      },
      result: function () {
        var km = st.pathM * SCALE / 1000;
        return {
          pathM: +st.pathM.toFixed(1), scaledKm: +km.toFixed(2), scale: SCALE,
          zoneViolations: Object.keys(st.violations), violationSamples: st.violationSamples,
          minZoneClearanceM: st.minClear === Infinity ? null : +st.minClear.toFixed(1),
          maxSlopeDeg: +st.maxSlope.toFixed(1), steepSamples: st.steepSamples,
          longEnough: km >= LIMITS.minScaledKm,
          pass: st.violationSamples === 0 && st.steepSamples === 0 && km >= LIMITS.minScaledKm
        };
      }
    };
  }

  var api = { SCALE: SCALE, START: START, ZONES: ZONES, LIMITS: LIMITS, inside: inside, clearance: clearance, slopeDeg: slopeDeg, createRun: createRun, active: false, run: null, last: null };
  root.NASA_SupplyRoute = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // ---- browser side ----
  if (typeof window === 'undefined') return;
  var markers = [];

  function say(h) { if (typeof llog === 'function') llog(h); }

  function buildMarkers() {
    clearMarkers();
    ZONES.forEach(function (q) {
      var col = q.kind === 'plume' ? 0xef4444 : 0xf59e0b;
      var ring = new THREE.Mesh(new THREE.RingGeometry(q.r - 0.25, q.r, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(q.x, getH(q.x, q.z) + 0.15, q.z);
      scene.add(ring); markers.push(ring);
      var fill = new THREE.Mesh(new THREE.CircleGeometry(q.r - 0.25, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(q.x, getH(q.x, q.z) + 0.14, q.z);
      scene.add(fill); markers.push(fill);
    });
  }
  function clearMarkers() { markers.forEach(function (m) { scene.remove(m); }); markers = []; }

  api.circles = function () { return api.active ? ZONES.map(function (q) { return { x: q.x, z: q.z, r: q.r + 1.0 }; }) : []; };

  api.start = function () {
    if (!window.NASA_Logistics) return false;
    var ph = NASA_Logistics.phase();
    if (!(ph === 'idle' || ph === 'rth')) { say('<span class="text-amber-300">[ROUTE] Start the supply route while the rover is idle.</span>'); return false; }
    wanderOn = false;
    api.active = true;
    api.run = createRun(ZONES);
    api.last = null;
    buildMarkers();
    roverGroup.position.set(START.x, getH(START.x, START.z) + 0.1, START.z);
    roverYaw = START.yaw; vel = 0; turnVel = 0;
    if (typeof navForceReplan !== 'undefined') navForceReplan = true;
    say('<span class="text-sky-300 font-bold">[ROUTE] Scaled supply route 1:' + SCALE + '. Start outside the plume zone at (' + START.x + ', ' + START.z + '). Avoid the plume blast zone, 3 restricted zones and slopes over ' + LIMITS.slopeDeg + '°. Autonomous drive to the habitat.</span>');
    NASA_Logistics.goToBase();
    return true;
  };

  api.finish = function (why) {
    if (!api.active) return;
    var r = api.run.result();
    api.last = r;
    api.active = false;
    window.__routeReport = r;
    say('<span class="' + (r.pass ? 'text-emerald-400' : 'text-amber-300') + ' font-bold">[ROUTE REPORT] ' + (r.pass ? 'PASS' : 'INCOMPLETE') + ' (' + why + ') | path ' + r.pathM + ' m = ' + r.scaledKm + ' km scaled | zone violations ' + (r.zoneViolations.length ? r.zoneViolations.join(',') : 'none') +
        ' | min clearance ' + r.minZoneClearanceM + ' m | max slope ' + r.maxSlopeDeg + '° | ' + (r.longEnough ? 'full 2 km course' : 'shorter than the 2 km course') + '</span>');
    clearMarkers();
    if (typeof navForceReplan !== 'undefined') navForceReplan = true;
  };

  api.tick = function () {
    if (!api.active) return;
    var x = roverGroup.position.x, z = roverGroup.position.z;
    api.run.sample(x, z, getH(x, z));
    var ph = NASA_Logistics.phase();
    if (ph === 'align_drop' || ph === 'arm_place') {
      api.finish('reached the habitat airlock');
      NASA_Logistics.abort();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
