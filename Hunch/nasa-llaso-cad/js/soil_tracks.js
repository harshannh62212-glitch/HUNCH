/*
 * Soil tracks and compaction for the LLASO simulator.
 *
 * Each wheel imprints the tread it really has: a 16-lug chevron grouser tyre, 0.076 m wide, 0.10 m radius,
 * lugs skewed +/-0.18 rad in alternation (see createWheel in viewer.html). One lug imprint is stamped every
 * lug pitch of ground travel (2 pi r / 16 = 39 mm), between them a smooth compaction band with raised berms
 * at the edges (the soil the tyre pushes aside).
 *
 * Soil physics, per wheel, every frame:
 *   compaction   a 0.08 m grid remembers how many times soil has been rolled over (0 virgin .. 1 fully
 *                compacted, +0.2 per pass). It feeds back into the vehicle:
 *                  sinkage       z = z0 * (1 - 0.55 c)            second pass runs shallower (Bekker: compacted
 *                                                                 soil has a larger bearing modulus)
 *                  rolling drag  Rr = Rr0 * (1 - 0.30 c)          less soil displaced, less compaction resistance
 *                  grip          mu = mu0 * (1 + 0.05 c)          compacted regolith has higher shear strength
 *                slip digs in: z *= 1 + 0.6 * min(1, slip)        (slip sinkage)
 *   rut depth    sets how dark the track is; deep ruts read darker, shallow ones fade into the soil.
 *   no marks on  poured pads, the dock floor and ramp (isSoil returns 0 there).
 *
 * Stamps are instanced quads that lie on the ground (tilted to the local terrain normal) and use the same
 * lighting as the terrain with a bump map, so the low sun rakes across the lugs. A ring buffer keeps the
 * newest ~310 m of wheel path (six wheels).
 */
(function (global) {
  'use strict';

  var TIRE_W = 0.076, RADIUS = 0.10, LUGS = 16;
  var PITCH = 2 * Math.PI * RADIUS / LUGS;      // ground distance between lug imprints, m
  var BAND_STEP = 0.08, BAND_LEN = 0.092, BAND_W = 0.088;
  var LUG_LEN = 0.0348;
  var MAX_LUG = 48000, MAX_BAND = 24000;
  var CELL = 0.08;

  var S = null;                  // scene state once init() ran
  var W = [];                    // per wheel stamping state
  var meanC = 0;

  // ------------------------------------------------------------------ textures
  function lugTextures(THREE) {
    var w = 96, h = 44, i;
    var cv = document.createElement('canvas'), bv = document.createElement('canvas');
    cv.width = bv.width = w; cv.height = bv.height = h;
    var c = cv.getContext('2d'), b = bv.getContext('2d');
    function bar(ctx, grow) {
      var t = 17.7 / 2 + grow;                     // half thickness, px
      ctx.beginPath();
      ctx.moveTo(6 - grow, 29.8 + t); ctx.lineTo(90 + grow, 14.2 + t);
      ctx.lineTo(90 + grow, 14.2 - t); ctx.lineTo(6 - grow, 29.8 - t);
      ctx.closePath();
    }
    // colour + alpha: a pale berm outline under a dark depression
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(176,170,160,0.42)'; bar(c, 3.2); c.fill();
    c.shadowColor = 'rgba(122,117,110,0.9)'; c.shadowBlur = 4;
    c.fillStyle = 'rgba(122,117,110,0.80)'; bar(c, 0); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(96,92,87,0.45)'; bar(c, -3); c.fill();       // deeper core
    // bump: grey 128 flat, berm high, floor low
    b.fillStyle = 'rgb(128,128,128)'; b.fillRect(0, 0, w, h);
    b.fillStyle = 'rgb(200,200,200)'; bar(b, 3.2); b.fill();
    b.shadowColor = 'rgb(30,30,30)'; b.shadowBlur = 4;
    b.fillStyle = 'rgb(40,40,40)'; bar(b, 0); b.fill();
    var map = new THREE.CanvasTexture(cv), bump = new THREE.CanvasTexture(bv);
    map.anisotropy = bump.anisotropy = 8;
    return { map: map, bump: bump };
  }
  function bandTextures(THREE) {
    var w = 64, h = 70, cv = document.createElement('canvas'), bv = document.createElement('canvas');
    cv.width = bv.width = w; cv.height = bv.height = h;
    var c = cv.getContext('2d'), b = bv.getContext('2d');
    var ci = c.createImageData(w, h), bi = b.createImageData(w, h);
    function sm(a, e, x) { var t = Math.max(0, Math.min(1, (x - a) / (e - a))); return t * t * (3 - 2 * t); }
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var u = (x + 0.5) / w, v = (y + 0.5) / h, k = (y * w + x) * 4;
      var edge = Math.min(u, 1 - u);                                  // 0 at the side, 0.5 at the centre
      var endFade = sm(0, 0.14, v) * sm(0, 0.14, 1 - v);               // crossfade with the next stamp
      var berm = sm(0.00, 0.07, edge) * (1 - sm(0.07, 0.15, edge));    // light ridge of pushed-aside soil
      var pan = sm(0.10, 0.20, edge);                                  // compacted pan
      var a = Math.max(berm * 0.30, pan * 0.46) * endFade;
      var lum = berm > pan * 0.8 ? 0.78 : 0.46;
      ci.data[k] = lum * 255 * 1.02; ci.data[k + 1] = lum * 255; ci.data[k + 2] = lum * 255 * 0.965; ci.data[k + 3] = a * 255;
      var hh = 128 + berm * 70 - pan * 40;
      bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = hh; bi.data[k + 3] = 255;
    }
    c.putImageData(ci, 0, 0); b.putImageData(bi, 0, 0);
    var map = new THREE.CanvasTexture(cv), bump = new THREE.CanvasTexture(bv);
    map.anisotropy = bump.anisotropy = 8;
    return { map: map, bump: bump };
  }

  // ------------------------------------------------------------------ meshes
  function makeStamps(THREE, scene, tex, w, l, max, baseColor, bumpScale, order) {
    var geo = new THREE.PlaneGeometry(w, l);
    geo.rotateX(-Math.PI / 2);                    // lies in XZ, normal +Y, texture top points to -Z
    var mat = new THREE.MeshStandardMaterial({
      map: tex.map, bumpMap: tex.bump, bumpScale: bumpScale, color: baseColor,
      roughness: 0.96, metalness: 0.04, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2 - order, polygonOffsetUnits: -2 - order, side: THREE.DoubleSide
    });
    var mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.renderOrder = 2 + order;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Allocate the colour buffer at full size first: setColorAt sizes it from mesh.count.
    mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    scene.add(mesh);
    var set = { mesh: mesh, max: max, head: 0, filled: 0, lo: 1e9, hi: -1, wrapped: false };
    mesh.onAfterRender = function () { set.lo = 1e9; set.hi = -1; set.wrapped = false; };
    return set;
  }

  // ------------------------------------------------------------------ compaction grid
  function cellIndex(x, z) {
    var i = Math.floor((x + S.ext) / CELL), j = Math.floor((z + S.ext) / CELL);
    if (i < 0 || j < 0 || i >= S.n || j >= S.n) return -1;
    return j * S.n + i;
  }
  function comp(x, z) { var k = cellIndex(x, z); return k < 0 ? 0 : S.grid[k] / 255; }
  function addComp(x, z, amount) {
    var k = cellIndex(x, z);
    if (k < 0) return;
    var v = S.grid[k] + amount;
    S.grid[k] = v > 255 ? 255 : v;
  }

  // ------------------------------------------------------------------ stamping
  var _s = { y: 0, nx: 0, ny: 1, nz: 0 };
  function place(set, x, z, yaw, mirror, shade, tone) {
    var THREE = S.THREE;
    // Sit exactly on the rendered surface: the terrain mesh is flat triangles, not the smooth height field.
    var sf = S.surface(x, z, _s), y = sf.y, nx = sf.nx, ny = sf.ny, nz = sf.nz;
    var fx = Math.cos(yaw), fz = -Math.sin(yaw);                       // rover forward on the ground plane
    var fd = fx * nx + fz * nz;                                        // remove the normal component
    var tx = fx - nx * fd, ty = -ny * fd, tz = fz - nz * fd;
    var tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    // X = forward x normal (axle direction), Y = normal, Z = -forward
    var ax = ty * nz - tz * ny, ay = tz * nx - tx * nz, az = tx * ny - ty * nx;
    if (mirror) { ax = -ax; ay = -ay; az = -az; }
    var lift = 0.0025;
    S.m4.set(ax, nx, -tx, x + nx * lift,
             ay, ny, -ty, y + ny * lift,
             az, nz, -tz, z + nz * lift,
             0, 0, 0, 1);
    var k = set.head;
    set.mesh.setMatrixAt(k, S.m4);
    var a = S.albedo(x, z) * shade;
    S.col.setRGB(a * tone[0], a * tone[1], a * tone[2]);
    set.mesh.setColorAt(k, S.col);
    if (k < set.lo) set.lo = k;
    if (k > set.hi) set.hi = k;
    set.head = (k + 1) % set.max;
    if (set.head === 0) set.wrapped = true;
    if (set.filled < set.max) set.filled++;
  }
  // The dirty range keeps growing until the mesh has actually been drawn (onAfterRender), so a physics step that is
  // not followed by a render cannot lose stamps.
  function flush(set) {
    if (set.hi < 0) return;
    var m = set.mesh;
    m.count = set.filled;
    var im = m.instanceMatrix, ic = m.instanceColor;
    if (set.wrapped) {
      im.updateRange.offset = 0; im.updateRange.count = -1; ic.updateRange.offset = 0; ic.updateRange.count = -1;
    } else {
      im.updateRange.offset = set.lo * 16; im.updateRange.count = (set.hi - set.lo + 1) * 16;
      ic.updateRange.offset = set.lo * 3; ic.updateRange.count = (set.hi - set.lo + 1) * 3;
    }
    im.needsUpdate = true; ic.needsUpdate = true;
  }

  // ------------------------------------------------------------------ public API
  function init(o) {
    var THREE = o.THREE;
    var ext = o.ext || 80;
    var n = Math.ceil(2 * ext / CELL);
    var lugT = lugTextures(THREE), bandT = bandTextures(THREE);
    var base = o.baseColor != null ? o.baseColor : 0x7f7a72;
    S = {
      THREE: THREE, ext: ext, n: n, grid: new Uint8Array(n * n), getH: o.getH, surface: o.surface, albedo: o.albedo || function () { return 1; },
      isSoil: o.isSoil || function () { return 1; }, m4: new THREE.Matrix4(), col: new THREE.Color(),
      band: makeStamps(THREE, o.scene, bandT, BAND_W, BAND_LEN, MAX_BAND, base, 0.10, 0),
      lug: makeStamps(THREE, o.scene, lugT, TIRE_W, LUG_LEN, MAX_LUG, base, 0.18, 1),
      passes: 0, stamps: 0
    };
    W = [];
    return S;
  }

  var TONE = [1.02, 1.0, 0.965];
  // depth: wheel rut depth in metres (already includes soil, load, slip and compaction); slip: 0..2
  function wheel(i, x, z, yaw, depth, slip) {
    if (!S) return;
    var w = W[i] || (W[i] = { x: NaN, z: NaN, dl: 0, db: 0, par: 0, c: 0 });
    var mask = S.isSoil(x, z);
    w.c = comp(x, z);
    if (w.x !== w.x) { w.x = x; w.z = z; return; }
    var dx = x - w.x, dz = z - w.z, d = Math.sqrt(dx * dx + dz * dz);
    w.x = x; w.z = z;
    if (d > 0.5 || d < 1e-6) return;                                    // teleport (reset) or standing still
    if (mask < 0.35) { w.dl = 0; w.db = 0; return; }                    // pad, floor or ramp: nothing to imprint
    var k = Math.max(0.2, Math.min(1.25, depth / 0.02)) * (0.55 + 0.45 * mask);
    var shade = 1.0 - 0.30 * Math.min(1, k) - 0.08 * w.c;
    w.dl += d; w.db += d;
    var guard = 0, back;
    while (w.dl >= PITCH && guard++ < 12) {
      w.dl -= PITCH;
      back = d > 0 ? w.dl / d : 0;
      w.par ^= 1;
      place(S.lug, x - dx * back, z - dz * back, yaw, w.par === 1, shade * 0.95, TONE);
      S.stamps++;
    }
    guard = 0;
    while (w.db >= BAND_STEP && guard++ < 12) {
      w.db -= BAND_STEP;
      back = d > 0 ? w.db / d : 0;
      var px = x - dx * back, pz = z - dz * back;
      place(S.band, px, pz, yaw, false, shade, TONE);
      var sx = Math.sin(yaw), sz = Math.cos(yaw);                       // across the track
      addComp(px, pz, 50);
      addComp(px + sx * 0.04, pz + sz * 0.04, 30);
      addComp(px - sx * 0.04, pz - sz * 0.04, 30);
      S.passes++;
    }
  }
  function frame() {
    if (!S) return;
    flush(S.band); flush(S.lug);
    var s = 0, n = 0;
    for (var i = 0; i < W.length; i++) if (W[i]) { s += W[i].c; n++; }
    meanC = n ? s / n : 0;
  }
  function clear() {
    if (!S) return;
    S.grid.fill(0);
    S.band.filled = S.band.head = 0; S.lug.filled = S.lug.head = 0;
    S.band.mesh.count = 0; S.lug.mesh.count = 0;
    W = []; meanC = 0; S.stamps = 0; S.passes = 0;
  }

  global.NASA_SoilTracks = {
    init: init, wheel: wheel, frame: frame, clear: clear,
    compaction: function (x, z) { return S ? comp(x, z) : 0; },
    sinkFactor: function (x, z) { return S ? 1 - 0.55 * comp(x, z) : 1; },       // multiplies rut depth
    dragFactor: function () { return 1 - 0.30 * meanC; },                         // multiplies rolling resistance
    gripFactor: function () { return 1 + 0.05 * meanC; },                         // multiplies tyre-soil friction
    meanCompaction: function () { return meanC; },
    stats: function () { return S ? { lugStamps: S.lug.filled, bandStamps: S.band.filled, passes: S.passes, meanCompaction: meanC } : null; },
    PITCH: PITCH, TIRE_W: TIRE_W,
    _debug: function () { return S; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
