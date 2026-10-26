/* =========================================================================
 * NASA HUNCH LLASO — shared look for the 3D CAD pages (rover, dock, website)
 * js/studio.js  →  window.NASA_Studio
 *
 *  renderer(canvasOrParent)  ACES tone mapping, sRGB output, soft shadows
 *  environment(renderer)      procedural soft-box studio → PMREM env map (metals reflect, no black chrome)
 *  regolith(size)             lunar-ground canvas texture
 *  hazard(w,h)                yellow/black chevron stripe texture
 *  CameraRig(camera, controls) eased orbit moves along the sphere (no straight-line cuts through the model)
 * ========================================================================= */
(function (root) {
  'use strict';
  var MO = root.NASA_Motion;

  function renderer(parent, opts) {
    opts = opts || {};
    var r = new THREE.WebGLRenderer({ antialias: true, alpha: !!opts.alpha, preserveDrawingBuffer: !!opts.preserve });
    r.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    // authored hex colours in this project assume linear output (r128 has no colour management), so keep it
    if (opts.srgb) r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = opts.exposure || 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.physicallyCorrectLights = false;
    if (parent && parent.appendChild) parent.appendChild(r.domElement);
    return r;
  }

  // a dim studio: gradient dome, a big soft key box overhead, two strip lights. Enough for believable metal.
  function environment(rend, opts) {
    opts = opts || {};
    var env = new THREE.Scene();
    var top = new THREE.Color(opts.top || 0x9fb3c8), bottom = new THREE.Color(opts.bottom || 0x1a2029);
    var g = new THREE.SphereGeometry(20, 32, 16);
    var cols = [], pos = g.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var t = (pos.getY(i) / 20) * 0.5 + 0.5, c = bottom.clone().lerp(top, Math.pow(t, 1.4));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    env.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    function panel(w, h, x, y, z, k) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 1.02), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    panel(14, 8, 2, 15, 4, opts.key || 3.2);       // overhead soft box
    panel(3, 12, -15, 4, -4, 1.6);                  // strip left
    panel(3, 12, 14, 3, -9, 1.2);                   // strip back right
    panel(10, 2, 0, 2, 16, 0.8);                    // low front fill
    var pm = new THREE.PMREMGenerator(rend);
    var tex = pm.fromScene(env, 0.035).texture;
    pm.dispose();
    return tex;
  }

  function canvasTex(w, h, draw, rep) {
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(cv);
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    t.anisotropy = 4;
    return t;
  }

  function regolith(rep) {
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    return canvasTex(512, 512, function (c, w, h) {
      c.fillStyle = '#4a4b4d'; c.fillRect(0, 0, w, h);
      var img = c.getImageData(0, 0, w, h), d = img.data;
      for (var i = 0; i < d.length; i += 4) { var n = (rnd() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.95; }
      c.putImageData(img, 0, 0);
      for (var k = 0; k < 90; k++) {                        // small craterlets: soft dark floor + faint lit rim
        var x = rnd() * w, y = rnd() * h, r = 1.5 + rnd() * rnd() * 14;
        var gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(28,28,30,' + (0.05 + rnd() * 0.07) + ')'); gr.addColorStop(1, 'rgba(28,28,30,0)');
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = gr; c.fill();
        c.beginPath(); c.arc(x - r * 0.12, y - r * 0.12, r * 0.9, Math.PI * 0.95, Math.PI * 1.65); c.strokeStyle = 'rgba(210,210,215,0.07)'; c.lineWidth = Math.max(1, r * 0.14); c.stroke();
      }
    }, rep || [4, 4]);
  }

  function hazard(rep, square) {
    if (square) return canvasTex(256, 256, function (c, w, h) {
      c.fillStyle = '#e8b10a'; c.fillRect(0, 0, w, h); c.fillStyle = '#16181c';
      for (var x = -w; x < w * 2; x += 64) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 32, h); c.lineTo(x + 32 + h, 0); c.lineTo(x + h, 0); c.closePath(); c.fill(); }
    }, rep || [1, 1]);
    return canvasTex(256, 64, function (c, w, h) {
      c.fillStyle = '#e8b10a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#16181c';
      for (var x = -h; x < w + h; x += 48) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 24, h); c.lineTo(x + 24 + h, 0); c.lineTo(x + h, 0); c.closePath(); c.fill(); }
    }, rep || [1, 1]);
  }

  /* Camera moves travel along the orbit (spherical lerp of the offset) with a min-jerk profile, and the
     duration scales with how far the view has to turn — short nudges are quick, big swings take longer. */
  function CameraRig(camera, controls) {
    this.cam = camera; this.ctl = controls; this.move = null;
  }
  CameraRig.prototype.go = function (pos, target, opts) {
    opts = opts || {};
    var p0 = this.cam.position.clone(), t0 = this.ctl.target.clone();
    var p1 = pos.clone ? pos.clone() : new THREE.Vector3().fromArray(pos), t1 = target.clone ? target.clone() : new THREE.Vector3().fromArray(target);
    var o0 = p0.clone().sub(t0), o1 = p1.clone().sub(t1);
    var s0 = new THREE.Spherical().setFromVector3(o0), s1 = new THREE.Spherical().setFromVector3(o1);
    var dth = s1.theta - s0.theta; while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
    var ang = Math.abs(dth) + Math.abs(s1.phi - s0.phi), dist = t0.distanceTo(t1) + Math.abs(Math.log(s1.radius / s0.radius)) * 2;
    var T = opts.duration || Math.max(0.7, Math.min(2.4, 0.55 + ang * 0.55 + dist * 0.35));
    this.move = { t: 0, T: T, t0: t0, t1: t1, s0: s0, r0: s0.radius, r1: s1.radius, th0: s0.theta, dth: dth, ph0: s0.phi, ph1: s1.phi };
    if (this.ctl) this.ctl.enabled = true;
  };
  CameraRig.prototype.busy = function () { return !!this.move; };
  CameraRig.prototype.cancel = function () { this.move = null; };
  CameraRig.prototype.update = function (dt) {
    var m = this.move; if (!m) return false;
    m.t += dt;
    var u = MO ? MO.minJerk(m.t / m.T) : Math.min(1, m.t / m.T);
    var tgt = m.t0.clone().lerp(m.t1, u);
    var sp = new THREE.Spherical(m.r0 * Math.pow(m.r1 / m.r0, u), m.ph0 + (m.ph1 - m.ph0) * u, m.th0 + m.dth * u);
    var off = new THREE.Vector3().setFromSpherical(sp);
    this.ctl.target.copy(tgt); this.cam.position.copy(tgt).add(off);
    if (m.t >= m.T) this.move = null;
    return true;
  };

  /* soft idle turntable: eases in after a pause, eases out the moment the user touches the view */
  function IdleSpin(controls, opts) {
    opts = opts || {};
    this.ctl = controls; this.delay = opts.delay || 9; this.speed = opts.speed || 0.45; this.idle = 0; this.k = 0; this.enabled = opts.enabled !== false;
    var self = this;
    ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function (ev) {
      (ev === 'keydown' ? root : controls.domElement).addEventListener(ev, function () { self.idle = 0; }, { passive: true });
    });
  }
  IdleSpin.prototype.update = function (dt, busy) {
    if (busy) this.idle = 0; else this.idle += dt;
    var want = (this.enabled && this.idle > this.delay) ? 1 : 0;
    this.k += (want - this.k) * Math.min(1, dt * (want ? 0.6 : 4));
    this.ctl.autoRotate = this.k > 0.002;
    this.ctl.autoRotateSpeed = this.speed * this.k;
  };

  root.NASA_Studio = { renderer: renderer, environment: environment, regolith: regolith, hazard: hazard, canvasTex: canvasTex, CameraRig: CameraRig, IdleSpin: IdleSpin };
})(typeof window !== 'undefined' ? window : globalThis);
