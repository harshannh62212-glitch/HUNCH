/* =========================================================================
   The Hunch · AEGIS-V1 product page
   1. sidebar highlights the section in view
   2. preview stage: poster → live CAD page (rover / dock) in an iframe
   3. route transit: rover follows the SVG path with real accel / decel, slows on the crater margin
   4. payload budget: mass, lunar weight, CoG from bay positions, eased capacity ring
   No frameworks, no external scripts.
   ========================================================================= */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

  /* ---------- 1. sidebar scroll-spy ---------- */
  var links = [].slice.call(document.querySelectorAll('.sidebar li a'));
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  function spy() {
    var y = window.scrollY + window.innerHeight * 0.3, cur = sections[0];
    sections.forEach(function (s) { if (s.offsetTop <= y) cur = s; });
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) cur = sections[sections.length - 1];
    links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + cur.id); });
  }
  addEventListener('scroll', spy, { passive: true }); spy();

  /* ---------- 2. preview stage ---------- */
  var stage = $('stage'), poster = $('stagePoster'), openLink = $('stageOpen'), frame = null;
  var tabs = [].slice.call(document.querySelectorAll('#preview [role="tab"]'));
  var posters = { 0: 'assets/screens/rover-overview.jpg', 1: 'assets/screens/dock-overview.jpg?v=4' };
  function load(src) {
    var f = document.createElement('iframe');
    f.title = 'Interactive 3D model'; f.src = src; f.setAttribute('allow', 'fullscreen');
    f.addEventListener('load', function () { setTimeout(function () { f.classList.add('ready'); poster.classList.add('gone'); }, 350); });
    if (frame) { var old = frame; old.classList.remove('ready'); setTimeout(function () { old.remove(); }, 650); }
    stage.insertBefore(f, openLink); frame = f;
  }
  $('stagePlay').addEventListener('click', function () {
    var t = tabs.filter(function (b) { return b.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    load(t.getAttribute('data-src'));
  });
  tabs.forEach(function (b, i) {
    b.addEventListener('click', function () {
      tabs.forEach(function (o) { o.setAttribute('aria-selected', o === b ? 'true' : 'false'); });
      openLink.href = b.getAttribute('data-open');
      if (frame) { load(b.getAttribute('data-src')); }
      else { poster.querySelector('img').src = posters[i]; }
    });
  });

  /* ---------- 3. route transit ---------- */
  var path = $('routePath'), done = $('routeDone'), rover = $('routeRover');
  var L = path.getTotalLength(), DIST = 850;            // metres on the ground for the full path
  var CRUISE = 5.2 / 3.6, SLOW = 2.4 / 3.6, ACC = 0.12;  // m/s, m/s, m/s²
  var LAPSE = 60;                                        // time-lapse factor
  var r = { s: 0, v: 0, a: 0, run: false, last: 0 };
  done.style.strokeDasharray = L; done.style.strokeDashoffset = L;
  function crater(s) { return s > 0.29 * DIST && s < 0.44 * DIST; }
  function slope(s) { return crater(s) ? 6.4 : (s < 0.12 * DIST ? 1.8 : 2.1); }
  function draw() {
    var u = r.s / DIST, p = path.getPointAtLength(u * L);
    rover.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')');
    done.style.strokeDashoffset = (L * (1 - u)).toFixed(1);
    $('mDist').textContent = Math.round(r.s) + ' / ' + DIST + ' m';
    $('mSpeed').textContent = (r.v * 3.6).toFixed(1) + ' km/h';
    $('mSlope').textContent = '+' + slope(r.s).toFixed(1) + '°' + (crater(r.s) ? ' crater margin' : '');
    var left = r.v > 0.05 ? (DIST - r.s) / Math.max(r.v, SLOW) : (r.s >= DIST ? 0 : (DIST - r.s) / CRUISE);
    $('mEta').textContent = r.s >= DIST ? 'Arrived' : (r.s === 0 && !r.run ? '—' : Math.floor(left / 60) + ':' + String(Math.round(left % 60)).padStart(2, '0'));
    $('mBar').style.width = (u * 100).toFixed(2) + '%';
  }
  function tick(now) {
    if (!r.run) return;
    var dt = Math.min(0.05, (now - r.last) / 1000) * LAPSE; r.last = now;
    var n = Math.ceil(dt / 0.2), h = dt / n;
    for (var i = 0; i < n; i++) {
      var remaining = DIST - r.s;
      var vMax = crater(r.s) || (r.s > 0.25 * DIST && r.s < 0.29 * DIST) ? SLOW : CRUISE;   // slow down before the margin, not on it
      var vStop = Math.sqrt(Math.max(0, 2 * ACC * 0.85 * remaining));
      var vWant = Math.min(vMax, vStop, remaining * 0.8 + 0.02);
      var aWant = clamp((vWant - r.v) / 0.8, -ACC, ACC);
      r.a += (aWant - r.a) * (1 - Math.exp(-h / 2.0));                // gentle jerk: the throttle eases in and out
      r.v = Math.max(0, r.v + r.a * h);
      r.s = Math.min(DIST, r.s + r.v * h);
    }
    if (r.s >= DIST - 0.05 && r.v < 0.02) { r.s = DIST; r.v = 0; r.run = false; $('routeGo').textContent = 'Arrived'; $('routeGo').disabled = true; }
    draw();
    if (r.run) requestAnimationFrame(tick);
  }
  $('routeGo').addEventListener('click', function () {
    if (r.s >= DIST) return;
    r.run = !r.run; this.textContent = r.run ? 'Pause' : 'Resume';
    if (r.run) { r.last = performance.now(); requestAnimationFrame(tick); }
  });
  $('routeReset').addEventListener('click', function () {
    r.s = 0; r.v = 0; r.a = 0; r.run = false;
    $('routeGo').textContent = 'Start transit'; $('routeGo').disabled = false; draw();
  });
  draw();

  /* ---------- 4. payload budget ---------- */
  var G_MOON = 1.622, G_EARTH = 9.80665, RATED = 500, CIRC = 2 * Math.PI * 50;
  var boxes = [].slice.call(document.querySelectorAll('#manifest input'));
  var shown = { pct: 0 }, target = { pct: 0 }, animT = null;
  function fmt(n, d) { return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function calc() {
    var m = 0, kwh = 0, mx = 0;
    boxes.forEach(function (b) {
      if (!b.checked) return;
      var k = +b.dataset.mass; m += k; kwh += +b.dataset.kwh; mx += k * (+b.dataset.x);   // x = bay position fore/aft (m)
    });
    var cog = m > 0 ? mx / m : 0, over = m > RATED;
    $('cMass').textContent = fmt(m, 0) + ' kg';
    $('cWeight').textContent = fmt(m * G_MOON, 0) + ' N';
    $('cFeel').textContent = fmt(m * G_MOON / G_EARTH, 1) + ' kg';
    var cogEl = $('cCog');
    if (m === 0) { cogEl.textContent = 'Empty bay'; cogEl.className = ''; }
    else { cogEl.textContent = (cog >= 0 ? '+' : '−') + fmt(Math.abs(cog) * 100, 1) + ' cm ' + (cog >= 0 ? 'fwd' : 'aft') + (Math.abs(cog) > 0.25 ? ' · rebalance' : ''); cogEl.className = Math.abs(cog) > 0.25 ? 'bad' : 'ok'; }
    $('cKwh').textContent = m === 0 ? '1.2 kWh (empty)' : fmt(kwh + 1.2, 1) + ' kWh';
    $('ring').classList.toggle('over', over);
    target.pct = m / RATED * 100;
    animate();
  }
  function animate() {
    var from = shown.pct, to = target.pct, t0 = performance.now(), T = reduce ? 1 : 520;
    if (animT) cancelAnimationFrame(animT);
    (function step(now) {
      var u = clamp((now - t0) / T, 0, 1), e = u * u * u * (10 + u * (-15 + 6 * u));   // minimum-jerk ease
      shown.pct = from + (to - from) * e;
      $('ringFg').style.strokeDashoffset = (CIRC * (1 - clamp(shown.pct, 0, 100) / 100)).toFixed(2);
      $('cPct').textContent = Math.round(shown.pct) + '%';
      if (u < 1) animT = requestAnimationFrame(step);
    })(performance.now());
  }
  boxes.forEach(function (b) { b.addEventListener('change', calc); });
  calc();
})();
