/**
 * Cinematic start-up sequence: a powered descent stage lowers the rover to the
 * regolith on cables (sky-crane), cuts away and flies off. Self-contained; the
 * viewer only calls NASA_Intro.play(onDone) and NASA_Intro.tick(dt) each frame.
 * Skip with Space / Enter / Escape / click. Disable with ?intro=0.
 */
(function () {
  var T_DESCENT = 9, T_LOWER = 3.5, T_RELEASE = 1.2, T_ASCENT = 5.5;
  var T_END = T_DESCENT + T_LOWER + T_RELEASE + T_ASCENT;
  var HANG0 = 4, HANG1 = 8, HOVER = 8, START_H = 70;
  var ANCHORS = [[0.34, 0.3, 0.3], [0.34, 0.3, -0.3], [-0.34, 0.3, 0]];

  var S = { active: false, t: 0, done: null, restY: 0, x: 0, z: 0, g: null, flames: [], cables: [], dust: null, light: null, bars: null, rng: null, flash: 0, released: false };

  function rng32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function sm(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function mat(c, r, m) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); }

  function buildStage() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.3, 24), mat(0xe7e5e4, 0.4, 0.6));
    body.castShadow = true; g.add(body);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 0.5, 24), mat(0xb45309, 0.5, 0.5));
    cap.position.y = 0.9; g.add(cap);
    var band = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 8, 32), mat(0x0ea5e9, 0.4, 0.5));
    band.rotation.x = Math.PI / 2; band.position.y = 0.2; g.add(band);
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + Math.PI / 4, cx = Math.cos(a) * 1.35, cz = Math.sin(a) * 1.35;
      var arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), mat(0x78716c, 0.5, 0.7));
      arm.position.set(cx * 0.62, -0.4, cz * 0.62); arm.rotation.y = -a; g.add(arm);
      var bell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 0.55, 14, 1, true), mat(0x292524, 0.4, 0.8));
      bell.position.set(cx, -0.55, cz); g.add(bell);
      var fg = new THREE.ConeGeometry(0.3, 1, 14, 1, true);
      fg.rotateX(Math.PI); fg.translate(0, -0.5, 0);
      var fm = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      fm.position.set(cx, -0.82, cz); g.add(fm);
      S.flames.push(fm);
    }
    var winch = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 12), mat(0x44403c, 0.5, 0.8));
    winch.position.y = -0.75; g.add(winch);
    return g;
  }

  function build() {
    S.g = buildStage();
    scene.add(S.g);
    var lm = new THREE.LineBasicMaterial({ color: 0xfacc15 });
    ANCHORS.forEach(function () {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      var ln = new THREE.Line(geo, lm);
      ln.frustumCulled = false;
      scene.add(ln); S.cables.push(ln);
    });
    S.light = new THREE.PointLight(0xffb060, 0, 40, 1.6);
    scene.add(S.light);
    var N = 420, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    S.dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.5, map: puff(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    S.dust.frustumCulled = false;
    S.dust.userData = { life: new Float32Array(N), vel: new Float32Array(N * 3), n: N };
    for (var i = 0; i < N; i++) { pos[i * 3 + 1] = -999; S.dust.userData.life[i] = 0; }
    scene.add(S.dust);

    var bars = document.createElement('div');
    bars.id = 'intro-bars';
    bars.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;font-family:ui-monospace,monospace;color:#e2e8f0;';
    bars.innerHTML =
      '<div style="position:absolute;left:0;right:0;top:0;height:11%;background:#000"></div>' +
      '<div style="position:absolute;left:0;right:0;bottom:0;height:11%;background:#000"></div>' +
      '<div id="intro-title" style="position:absolute;left:5%;bottom:3%;font-size:13px;letter-spacing:.18em;opacity:0;transition:opacity 1.2s">AEGIS-V1 &middot; POWERED DESCENT &middot; ROVER DELIVERY</div>' +
      '<div style="position:absolute;right:5%;bottom:3%;font-size:10px;letter-spacing:.14em;opacity:.7">SPACE / CLICK TO SKIP</div>';
    document.body.appendChild(bars);
    S.bars = bars;
    S.style = document.createElement('style');
    S.style.textContent = '#hud-panels,#btn-hud-toggle,#dock-hud,#crash-screen,#fault-ui,#dispatch-ui,#supervisor-ui,#coop-ui{visibility:hidden!important}';
    document.head.appendChild(S.style);
    setTimeout(function () { var t = document.getElementById('intro-title'); if (t) t.style.opacity = '1'; }, 400);
  }

  function puff() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function emitDust(dt, groundY, power) {
    var d = S.dust, u = d.userData, pos = d.geometry.attributes.position.array;
    var want = Math.floor(power * 260 * dt);
    for (var i = 0; i < u.n; i++) {
      if (u.life[i] <= 0 && want > 0) {
        var a = S.rng() * Math.PI * 2, r = 0.3 + S.rng() * 0.8, sp = 3 + S.rng() * 6 * power;
        pos[i * 3] = S.x + Math.cos(a) * r; pos[i * 3 + 1] = groundY + 0.1; pos[i * 3 + 2] = S.z + Math.sin(a) * r;
        u.vel[i * 3] = Math.cos(a) * sp; u.vel[i * 3 + 1] = 0.4 + S.rng() * 1.4; u.vel[i * 3 + 2] = Math.sin(a) * sp;
        u.life[i] = 1.2 + S.rng() * 1.6; want--;
      }
    }
  }
  function stepDust(dt) {
    var d = S.dust, u = d.userData, pos = d.geometry.attributes.position.array, col = d.geometry.attributes.color.array;
    for (var i = 0; i < u.n; i++) {
      if (u.life[i] > 0) {
        u.life[i] -= dt;
        var drag = Math.exp(-1.1 * dt);
        u.vel[i * 3] *= drag; u.vel[i * 3 + 2] *= drag; u.vel[i * 3 + 1] -= 1.622 * dt * 0.6;
        pos[i * 3] += u.vel[i * 3] * dt; pos[i * 3 + 1] += u.vel[i * 3 + 1] * dt; pos[i * 3 + 2] += u.vel[i * 3 + 2] * dt;
        var f = Math.max(0, Math.min(1, u.life[i] / 1.5)) * 0.22;
        col[i * 3] = 0.72 * f; col[i * 3 + 1] = 0.66 * f; col[i * 3 + 2] = 0.58 * f;
      } else { pos[i * 3 + 1] = -999; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; }
    }
    d.geometry.attributes.position.needsUpdate = true;
    d.geometry.attributes.color.needsUpdate = true;
  }

  function setCables(hang, visible) {
    var rp = roverGroup.position;
    S.cables.forEach(function (ln, i) {
      ln.visible = visible;
      var p = ln.geometry.attributes.position.array, a = ANCHORS[i];
      p[0] = S.g.position.x + a[0] * 0.6; p[1] = S.g.position.y - 0.8; p[2] = S.g.position.z + a[2] * 0.6;
      p[3] = rp.x + a[0]; p[4] = rp.y + a[1]; p[5] = rp.z + a[2];
      ln.geometry.attributes.position.needsUpdate = true;
    });
  }

  function camFor(t) {
    var gp = S.g.position, rp = roverGroup.position;
    var pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    var tA = T_DESCENT * 0.62, tB = T_DESCENT + T_LOWER;
    if (t < tA) {
      var u = sm(t / tA);
      pos.set(lerp(-34, -22, u), lerp(26, 14, u), lerp(46, 34, u));
      tgt.copy(gp);
    } else if (t < tB + 0.5) {
      var v = sm((t - tA) / (tB + 0.5 - tA));
      var gy = getH(S.x - 9, S.z + 10) + 1.7;
      pos.set(lerp(-22, S.x - 9, v), lerp(14, gy, v), lerp(34, S.z + 10, v));
      tgt.set(S.x, lerp(gp.y, (gp.y + rp.y) * 0.5, v), S.z);
    } else {
      var w = sm((t - tB - 0.5) / (T_END - tB - 0.5));
      var ang = lerp(2.2, 0.2, w), rad = lerp(9, 6.4, w);
      pos.set(S.x + Math.cos(ang) * rad, rp.y + lerp(1.7, 2.6, w), S.z + Math.sin(ang) * rad);
      tgt.set(S.x, rp.y + 0.3 + Math.min(6, Math.max(0, (gp.y - rp.y) * 0.25)) * (1 - w), S.z);
    }
    return { pos: pos, tgt: tgt };
  }

  function finish() {
    if (!S.active) return;
    S.active = false;
    scene.remove(S.g); scene.remove(S.dust); scene.remove(S.light);
    S.cables.forEach(function (c) { scene.remove(c); });
    if (S.bars && S.bars.parentNode) S.bars.parentNode.removeChild(S.bars);
    if (S.style && S.style.parentNode) S.style.parentNode.removeChild(S.style);
    removeEventListener('keydown', onKey); removeEventListener('pointerdown', skip);
    roverGroup.position.set(S.x, S.restY, S.z);
    if (typeof setCamMode === 'function') setCamMode('chase');
    var cb = S.done; S.done = null;
    if (cb) cb();
  }
  function skip() { finish(); }
  function onKey(e) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); finish(); } }

  var api = {
    get active() { return S.active; },
    duration: T_END,
    play: function (onDone) {
      if (S.active) return;
      var q = new URLSearchParams(location.search);
      if (q.get('intro') === '0') { if (onDone) onDone(); return; }
      S.done = onDone || null;
      S.rng = rng32(20261026);
      S.flames = []; S.cables = [];
      // Settle the rover once so we know the resting height, then hang it from the stage.
      S.x = roverGroup.position.x; S.z = roverGroup.position.z;
      if (typeof updatePhysics === 'function') updatePhysics(1 / 60);
      S.restY = roverGroup.position.y;
      S.t = 0; S.released = false; S.flash = 0; S.active = true;
      build();
      if (typeof camMode !== 'undefined') camMode = 'intro';
      if (typeof controls !== 'undefined') controls.enabled = false;
      addEventListener('keydown', onKey); addEventListener('pointerdown', skip);
      api.tick(0);
    },
    skip: finish,
    tick: function (dt) {
      if (!S.active) return;
      S.t += dt;
      var t = S.t, hang, stageY, throttle, driftX = 0, driftZ = 0, tilt = 0;
      var groundY = getH(S.x, S.z);
      var tD = T_DESCENT, tL = tD + T_LOWER, tR = tL + T_RELEASE;
      if (t < tD) {
        var u = Math.min(1, t / tD), e = 1 - Math.pow(1 - u, 3);
        stageY = S.restY + lerp(START_H, HOVER, e);
        hang = HANG0; throttle = 0.65 + 0.35 * e;
        driftX = Math.sin(t * 1.3) * (1 - e) * 2.2; driftZ = Math.cos(t * 0.9) * (1 - e) * 1.6;
        tilt = Math.sin(t * 1.3) * (1 - e) * 0.05;
      } else if (t < tL) {
        stageY = S.restY + HOVER; hang = lerp(HANG0, HANG1, sm((t - tD) / T_LOWER)); throttle = 0.85;
      } else if (t < tR) {
        stageY = S.restY + HOVER; hang = HANG1; throttle = 0.85;
        if (!S.released) { S.released = true; S.flash = 1; }
      } else {
        var a = t - tR, ac = a * a * 0.9;
        stageY = S.restY + HOVER + ac * 2.4; hang = HANG1; throttle = 1;
        driftX = ac * 1.6; driftZ = -ac * 1.1; tilt = Math.min(0.5, a * 0.1);
      }
      S.g.position.set(S.x + driftX, stageY, S.z + driftZ);
      S.g.rotation.set(tilt, 0, tilt * 0.6);
      var attached = t < tL + T_RELEASE * 0.4;
      if (t < tL) {
        roverGroup.position.set(S.x + driftX * 0.0, stageY - hang, S.z);
      } else {
        roverGroup.position.y = S.restY;
      }
      setCables(hang, attached);
      for (var i = 0; i < S.flames.length; i++) {
        var f = S.flames[i], fl = (0.7 + 1.5 * throttle) * (0.85 + 0.3 * S.rng());
        f.scale.set(0.8 + 0.4 * throttle, fl, 0.8 + 0.4 * throttle);
        f.material.opacity = 0.35 + 0.3 * throttle;
      }
      var h = stageY - groundY;
      var near = Math.max(0, Math.min(1, 1 - (h - 6) / 40));
      S.light.position.set(S.g.position.x, stageY - 2.5, S.g.position.z);
      S.light.intensity = (2 + 8 * throttle) * (0.3 + near) + S.flash * 6;
      S.flash = Math.max(0, S.flash - dt * 2.5);
      if (h < 55) emitDust(dt, groundY, throttle * (0.25 + near));
      stepDust(dt);
      var c = camFor(t);
      camera.position.copy(c.pos);
      camera.lookAt(c.tgt);
      if (t >= T_END) finish();
    }
  };
  window.NASA_Intro = api;
})();
