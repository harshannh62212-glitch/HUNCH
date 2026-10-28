/*
 * Lunar terrain for the LLASO simulator: one height field shared by the render mesh and the physics.
 *
 * Height   fractal mare swells + two wrinkle ridges + a crater population.
 * Craters  rim crest, power-law ejecta blanket (thickness ~ r^-3), parabolic bowl, size-frequency
 *          N(>D) ~ D^-2, freshness from 0 (old, infilled, soft rim) to 1 (sharp rim, rocky ejecta).
 * Soil     per-location sinkage scale, wheel grip scale, boulder density and albedo, derived from
 *          the same crater and slope fields so the ground looks like what it does to the wheels:
 *            crater floors and low spots  loose fines   -> deeper ruts, a little less grip
 *            fresh rims and ejecta        blocky, firm  -> shallow ruts, more grip, more boulders
 *            steep slopes                 thin regolith -> firmer, brighter (fresher material shows)
 * Pads (spawn, hangar, base, lander) stay exactly flat and firm.
 *
 * Everything is sampled once into a grid at load; height(x, z) etc. are O(1) bilinear lookups, so the
 * wheels, lidar rays and the planner all see the surface the camera sees.
 */
(function (global) {
  'use strict';

  var EXT = 80;                       // half extent of the field, m
  var N = 480;                        // cells per side (0.333 m)
  var STEP = (2 * EXT) / N;
  var W = N + 1;

  // ---------------------------------------------------------------- noise
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(ix, iz, s) {
    var h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function vnoise(x, z, s) {                       // 0..1
    var ix = Math.floor(x), iz = Math.floor(z);
    var fx = x - ix, fz = z - iz;
    var a = hash2(ix, iz, s), b = hash2(ix + 1, iz, s), c = hash2(ix, iz + 1, s), d = hash2(ix + 1, iz + 1, s);
    var u = fade(fx), v = fade(fz);
    var top = a + (b - a) * u, bot = c + (d - c) * u;
    return top + (bot - top) * v;
  }
  function fbm(x, z, oct, s) {                     // about -0.8..0.8
    var sum = 0, amp = 1, norm = 0, f = 1;
    for (var i = 0; i < oct; i++) {
      sum += amp * (vnoise(x * f + i * 17.3, z * f - i * 9.1, s + i * 131) * 2 - 1);
      norm += amp; amp *= 0.5; f *= 2.03;
    }
    return sum / norm;
  }
  function smooth(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // ---------------------------------------------------------------- layout
  // Flat, firm zones: [x, z, flat radius, blend radius]
  var ZONES = [
    { x: 0, z: 5, a: 5, b: 12 },          // spawn pad
    { x: -15, z: -15, a: 8, b: 16 },      // hangar and dock
    { x: -24.5, z: -22, a: 10, b: 18 },   // base and intake table
    { x: 45, z: -38, a: 9, b: 16 }        // lander staging pad
  ];
  // Haul roads kept free of crater pits (they may still cross ridges and gentle swells).
  var CORRIDORS = [
    [45, -38, -21, -22],
    [0, 5, -15, -15],
    [0, 5, -24.5, -22]
  ];
  function flatMask(x, z) {
    var m = 1;
    for (var i = 0; i < ZONES.length; i++) {
      var q = ZONES[i], d = Math.hypot(x - q.x, z - q.z);
      if (d < q.b) { var t = Math.max(0, (d - q.a) / (q.b - q.a)); m *= t * t * (3 - 2 * t); }
    }
    return m;
  }
  function distToSegment(x, z, ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    var t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
  }
  function nearCorridor(x, z, margin) {
    for (var i = 0; i < CORRIDORS.length; i++) {
      var c = CORRIDORS[i];
      if (distToSegment(x, z, c[0], c[1], c[2], c[3]) < margin) return true;
    }
    return false;
  }
  function nearZone(x, z, extra) {
    for (var i = 0; i < ZONES.length; i++) {
      var q = ZONES[i];
      if (Math.hypot(x - q.x, z - q.z) < q.b + extra) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- wrinkle ridges
  // Wrinkle ridges are broad, low arches: flank slopes of a few degrees. At the scale of this 160 m field a ridge
  // is ~40 m wide and 2 m high (max slope = h * 0.86 / w = 5 deg), not a narrow wall.
  var RIDGES = [
    { w: 22.0, h: 2.4, pts: [[-80, 34], [-45, 41], [-10, 45], [28, 40], [58, 47], [80, 44]] },
    { w: 18.0, h: 1.8, pts: [[-80, -52], [-42, -60], [-5, -54], [25, -62], [58, -56], [80, -60]] }
  ];
  function ridgeH(x, z) {
    var y = 0;
    for (var r = 0; r < RIDGES.length; r++) {
      var R = RIDGES[r], best = 1e9, along = 0, len = 0;
      for (var i = 0; i < R.pts.length - 1; i++) {
        var a = R.pts[i], b = R.pts[i + 1];
        var dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
        var t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
        var d = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
        if (d < best) { best = d; along = len + t * Math.sqrt(l2); }
        len += Math.sqrt(l2);
      }
      if (best > R.w * 3) continue;
      var k = best / R.w;
      var crest = Math.exp(-k * k);
      var broad = 0.35 * Math.exp(-k * k * 0.12);       // gentle arch the ridge sits on
      var seg = 0.55 + 0.45 * vnoise(along * 0.05, r * 7.7, 31);
      y += R.h * (crest * seg + broad * 0.5);
    }
    return y;
  }

  // ---------------------------------------------------------------- natural surface
  function natural(x, z) {
    var wx = x + 9 * fbm(x * 0.017 + 3.1, z * 0.017 - 7.7, 2, 11);
    var wz = z + 9 * fbm(x * 0.017 - 5.3, z * 0.017 + 2.9, 2, 12);
    return 3.4 * fbm(wx * 0.0105, wz * 0.0105, 4, 21)      // broad mare swells, 60-120 m
         + 0.6 * fbm(wx * 0.055, wz * 0.055, 3, 22)         // rolling ground, 10-25 m
         + 0.04 * fbm(x * 0.42, z * 0.42, 2, 23)            // metre-scale roughness
         + ridgeH(x, z);
  }

  // ---------------------------------------------------------------- craters
  // Mission craters keep their positions (the nav stack and the rocks use them). d < 0 is a dome.
  var craters = [
    { x: 12, z: 18, r: 8, d: 3.5, fresh: 0.85 },
    { x: -18, z: 16, r: 6.5, d: 2.8, fresh: 0.55 },
    { x: 8, z: -22, r: 5, d: 2, fresh: 0.45 },
    { x: 28, z: 8, r: 10, d: -1.6 },
    { x: -48, z: 32, r: 8, d: 3.5, fresh: 0.95 },
    { x: -8, z: 36, r: 6, d: 2.5, fresh: 0.35 },
    { x: 20, z: -10, r: 4, d: 1.5, fresh: 0.7 },
    { x: -52, z: -45, r: 8, d: -1.4 }
  ];
  var smallCraters = [];     // crisp craters, D >= 4 m, d/D >= 0.11: the rover treats their bowls as no-go
  var oldCraters = [];       // degraded dishes, D >= 4 m, d/D < 0.11: shallow, harmless
  var microCraters = [];     // D 1-4 m pits, harmless

  // Lunar mare population. Small craters sit at equilibrium: cumulative N(>D) = SAT * 1.54 / D^2 per km^2
  // (D in km), with SAT the fraction of geometric saturation (Trask 1971; Gault 1970; Xiao and Werner 2015:
  // 3 to 5 % below ~100 m). Depth/diameter follows Pike (1977): 0.18 fresh down to 0.05 degraded.
  // Rim crest height is ~0.04 D (hr in craterH). Counts are over the 150 m x 150 m placement area.
  var SAT = 0.03, PLACE = 75, DMIN = 1.0, DMAX = 26.0;
  var AREA_KM2 = Math.pow(2 * PLACE / 1000, 2);
  function expectedCount(dmin, dmax) { return SAT * 1.54e6 * AREA_KM2 * (1 / (dmin * dmin) - 1 / (dmax * dmax)); }
  function mkCrater(x, z, D, dd, fresh) {                  // dd = true depth / D, rim crest to floor
    var r = D / 2, hr = r * (0.03 + 0.05 * fresh), dEff = Math.max(0.02, dd * D - hr);
    return { x: x, z: z, r: r, d: dEff / (0.6 + 0.25 * fresh), fresh: fresh };
  }

  (function populate() {
    var rnd = mulberry32(17);
    var n = Math.round(expectedCount(DMIN, DMAX)), k, i;
    for (i = 0; i < n; i++) {
      var u = rnd();
      var D = DMIN / Math.sqrt(1 - u * (1 - (DMIN / DMAX) * (DMIN / DMAX)));      // inverse CDF of N(>D) ~ D^-2
      var x = (rnd() * 2 - 1) * PLACE, z = (rnd() * 2 - 1) * PLACE;
      var t = Math.pow(rnd(), 2.0);                                                 // 0 degraded .. 1 fresh; most are old
      var dd = 0.06 + 0.12 * t, r = D / 2, c;
      if (D >= 4) {
        if (Math.hypot(x, z - 5) < 16 || Math.hypot(x + 15, z + 15) < 20 || Math.hypot(x + 24.5, z + 22) < 22 || Math.hypot(x - 45, z + 38) < 18) continue;
        if (dd >= 0.11) {
          if (nearCorridor(x, z, 4.5 + r)) continue;
          var ok = true;
          for (k = 0; k < craters.length && ok; k++) if (Math.hypot(x - craters[k].x, z - craters[k].z) < r + craters[k].r + 1.5) ok = false;
          for (k = 0; k < smallCraters.length && ok; k++) if (Math.hypot(x - smallCraters[k].x, z - smallCraters[k].z) < r + smallCraters[k].r + 1.0) ok = false;
          if (!ok) continue;
          smallCraters.push(mkCrater(x, z, D, dd, t));
        } else {
          if (nearZone(x, z, r * 0.4)) continue;
          oldCraters.push(mkCrater(x, z, D, dd, t * 0.3));
        }
      } else {
        if (nearZone(x, z, 0) || nearCorridor(x, z, 2.2 + r)) continue;
        microCraters.push(mkCrater(x, z, D, dd, t));
      }
    }
  })();

  // Crater profile. u = distance / rim radius. Returns the height change.
  // Parabolic bowl inside, Hermite-rounded crest (sharper when fresh), r^-3 ejecta outside.
  function craterH(u, R, d, fresh) {
    var hr = R * (0.03 + 0.05 * fresh);
    var dEff = d * (0.6 + 0.25 * fresh);
    var w = 0.16 - 0.10 * fresh;
    var u0 = 1 - w, u1 = 1 + w;
    if (u <= u0) return -dEff + (dEff + hr) * u * u;
    if (u >= 5) return 0;
    var tail = u >= 3 ? 1 - smooth(3, 5, u) : 1;
    if (u >= u1) return hr * Math.pow(u, -3) * tail;
    var z0 = -dEff + (dEff + hr) * u0 * u0, m0 = 2 * (dEff + hr) * u0;
    var z1 = hr * Math.pow(u1, -3), m1 = -3 * hr * Math.pow(u1, -4);
    var D = u1 - u0, t = (u - u0) / D, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * z0 + (t3 - 2 * t2 + t) * D * m0 + (-2 * t3 + 3 * t2) * z1 + (t3 - t2) * D * m1;
  }
  function domeH(u, h) {
    if (u >= 1.3) return 0;
    var t = u / 1.3;
    return h * (1 - t * t * (3 - 2 * t));
  }

  // ---------------------------------------------------------------- sampled grids
  var H = new Float32Array(W * W);
  var SINK = new Float32Array(W * W);
  var MU = new Float32Array(W * W);
  var ROCK = new Float32Array(W * W);
  var ALB = new Float32Array(W * W);
  var LOOSE = new Float32Array(W * W);
  var FRESH = new Float32Array(W * W);
  var MARE = new Float32Array(W * W);     // 0 highland, 1 dark mare basalt
  var RAY = new Float32Array(W * W);      // bright ejecta rays from fresh craters
  var built = false;

  function splat(c) {
    var dome = c.d < 0;
    var reach = (dome ? 1.3 : 5) * c.r;
    var fresh = c.fresh == null ? 0.3 : c.fresh;
    var i0 = Math.max(0, Math.floor((c.x - reach + EXT) / STEP)), i1 = Math.min(N, Math.ceil((c.x + reach + EXT) / STEP));
    var j0 = Math.max(0, Math.floor((c.z - reach + EXT) / STEP)), j1 = Math.min(N, Math.ceil((c.z + reach + EXT) / STEP));
    for (var j = j0; j <= j1; j++) {
      var z = -EXT + j * STEP, dz = z - c.z;
      for (var i = i0; i <= i1; i++) {
        var x = -EXT + i * STEP, dx = x - c.x;
        var u = Math.sqrt(dx * dx + dz * dz) / c.r;
        if (u >= (dome ? 1.3 : 5)) continue;
        var idx = j * W + i;
        if (dome) { H[idx] += domeH(u, -c.d); continue; }
        H[idx] += craterH(u, c.r, c.d, fresh);
        if (u < 0.85) {                                 // fines pond on the floor
          var L = (0.55 + 0.3 * (1 - fresh)) * (1 - smooth(0.25, 0.8, u));
          if (L > LOOSE[idx]) LOOSE[idx] = L;
        }
        if (u > 0.55 && u < 4.2) {                      // blocky rim and ejecta
          var f = u < 1 ? smooth(0.55, 1.0, u) : Math.exp(-(u - 1) * 0.85);
          f *= fresh;
          if (f > FRESH[idx]) FRESH[idx] = f;
        }
        if (fresh > 0.6 && u > 1.0 && u < 5.0) {        // rays: radial streaks of bright ejecta
          var th = Math.atan2(dz, dx), ph = c.r * 1.7;
          var streak = Math.max(0, Math.cos(9 * th + ph)) * (0.55 + 0.45 * Math.max(0, Math.cos(23 * th - ph * 0.5)));
          var rv = fresh * streak * Math.exp(-(u - 1) * 0.7);
          if (rv > RAY[idx]) RAY[idx] = rv;
        }
      }
    }
  }

  function build() {
    if (built) return;
    var i, j, idx, x, z;
    for (j = 0; j <= N; j++) {
      z = -EXT + j * STEP;
      for (i = 0; i <= N; i++) { x = -EXT + i * STEP; H[j * W + i] = natural(x, z); }
    }
    for (i = 0; i < oldCraters.length; i++) splat(oldCraters[i]);
    for (i = 0; i < craters.length; i++) splat(craters[i]);
    for (i = 0; i < smallCraters.length; i++) splat(smallCraters[i]);
    for (i = 0; i < microCraters.length; i++) splat(microCraters[i]);
    // Maria: dark basalt plains in broad, low-contrast patches. Highlands stay bright.
    for (j = 0; j <= N; j++) {
      z = -EXT + j * STEP;
      for (i = 0; i <= N; i++) {
        x = -EXT + i * STEP; idx = j * W + i;
        var mv = fbm(x * 0.011 + 90, z * 0.011 - 30, 3, 401) + 0.12 * fbm(x * 0.03, z * 0.03, 2, 402);
        MARE[idx] = smooth(-0.02, 0.16, mv);
      }
    }
    // Flat pads: height goes to zero and the soil to nominal.
    var MASK = new Float32Array(W * W);
    for (j = 0; j <= N; j++) {
      z = -EXT + j * STEP;
      for (i = 0; i <= N; i++) {
        x = -EXT + i * STEP; idx = j * W + i;
        var m = flatMask(x, z);
        MASK[idx] = m;
        H[idx] *= m;
      }
    }
    // Soil from slope, porosity noise and the crater fields.
    for (j = 0; j <= N; j++) {
      z = -EXT + j * STEP;
      for (i = 0; i <= N; i++) {
        x = -EXT + i * STEP; idx = j * W + i;
        var il = Math.max(0, i - 1), ir = Math.min(N, i + 1), jl = Math.max(0, j - 1), jr = Math.min(N, j + 1);
        var gx = (H[j * W + ir] - H[j * W + il]) / ((ir - il) * STEP);
        var gz = (H[jr * W + i] - H[jl * W + i]) / ((jr - jl) * STEP);
        var slope = Math.atan(Math.sqrt(gx * gx + gz * gz));
        var por = fbm(x * 0.045 + 40, z * 0.045 - 20, 3, 71);          // loose or packed patches
        var thin = smooth(0.12, 0.40, slope);                           // regolith thins on steep ground
        var loose = LOOSE[idx], fresh = FRESH[idx], m2 = MASK[idx];
        var sink = (1 + 0.55 * por + 0.55 * loose - 0.35 * fresh) * (1 - 0.35 * thin);
        var mu = 1 - 0.10 * loose - 0.10 * por + 0.07 * fresh + 0.04 * thin;
        var rock = Math.min(1, fresh * 0.9 + 0.25 * thin + 0.12 * Math.max(0, por));
        // Albedo: highland regolith ~0.18, mare basalt ~0.08, fresh ejecta up to ~0.3 (rays included).
        var alb = (1 - 0.55 * MARE[idx]) * (1 + 0.22 * fresh - 0.07 * loose + 0.07 * thin + 0.05 * por) + 0.35 * RAY[idx] * (1 - MARE[idx] * 0.5);
        SINK[idx] = 1 + (Math.max(0.6, Math.min(1.8, sink)) - 1) * m2;
        MU[idx] = 1 + (Math.max(0.78, Math.min(1.1, mu)) - 1) * m2;
        ROCK[idx] = rock * m2;
        // Pads are poured concrete: a fixed mid-light tone, not the regolith albedo.
        ALB[idx] = 0.62 + (Math.max(0.34, Math.min(1.45, alb)) * 0.62 - 0.62) * m2;
      }
    }
    built = true;
  }

  function sample(A, x, z) {
    var fx = (x + EXT) / STEP, fz = (z + EXT) / STEP;
    if (fx < 0) fx = 0; else if (fx > N - 1e-6) fx = N - 1e-6;
    if (fz < 0) fz = 0; else if (fz > N - 1e-6) fz = N - 1e-6;
    var i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * W + i;
    var a = A[k], b = A[k + 1], c = A[k + W], d = A[k + W + 1];
    var top = a + (b - a) * tx, bot = c + (d - c) * tx;
    return top + (bot - top) * tz;
  }


  // ---------------------------------------------------------------- seamless regolith texture
  // Colour and bump come from one height field (grain + craterlets), so the pits that look dark are the
  // ones the light catches, and the texture tiles without seams. Periodic value noise: lattice wraps.
  function pnoise(x, z, per, s) {
    var ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    var x0 = ((ix % per) + per) % per, x1 = (x0 + 1) % per, z0 = ((iz % per) + per) % per, z1 = (z0 + 1) % per;
    var a = hash2(x0, z0, s), b = hash2(x1, z0, s), c = hash2(x0, z1, s), d = hash2(x1, z1, s);
    var u = fade(fx), v = fade(fz), top = a + (b - a) * u, bot = c + (d - c) * u;
    return top + (bot - top) * v;
  }
  function regolithTextures(size, doc) {
    doc = doc || document;
    var n = size * size, h = new Float32Array(n), mot = new Float32Array(n), i, x, y, o;
    // grain and clods: periods 8..256 cells, amplitude falls 0.6x per octave
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
      var u = x / size, v = y / size, amp = 1, sum = 0, tot = 0;
      for (o = 0; o < 6; o++) {
        var per = 8 << o;
        sum += amp * (pnoise(u * per, v * per, per, 400 + o * 13) * 2 - 1); tot += amp; amp *= 0.6;
      }
      h[y * size + x] = sum / tot;
      mot[y * size + x] = pnoise(u * 3, v * 3, 3, 951) * 0.6 + pnoise(u * 7, v * 7, 7, 977) * 0.4;   // soft patches of lighter and darker soil
    }
    // craterlets, wrapped so they cross the tile edge cleanly
    var rnd = mulberry32(5150), count = 340;
    for (var k = 0; k < count; k++) {
      var cx = rnd() * size, cy = rnd() * size, rr = 3 + Math.pow(rnd(), 2.4) * 34, dd = rr * (0.008 + 0.006 * rnd()), fresh = rnd();
      var R = Math.ceil(rr * 2.6);
      for (var oy = -R; oy <= R; oy++) for (var ox = -R; ox <= R; ox++) {
        var q = Math.sqrt(ox * ox + oy * oy) / rr;
        if (q > 2.6) continue;
        var px = (Math.floor(cx) + ox + size) % size, py = (Math.floor(cy) + oy + size) % size;
        var dh = q < 1 ? (-1 + 2 * q * q) * dd : (1 / (q * q * q)) * dd * (1 - smooth(1.6, 2.6, q));   // bowl, crest at q = 1, r^-3 ejecta
        h[py * size + px] += dh * (0.5 + 0.5 * fresh);
      }
    }
    var cv = doc.createElement('canvas'), bv = doc.createElement('canvas'), nv = doc.createElement('canvas');
    cv.width = cv.height = bv.width = bv.height = nv.width = nv.height = size;
    var cc = cv.getContext('2d'), bc = bv.getContext('2d'), nc = nv.getContext('2d');
    var ci = cc.createImageData(size, size), bi = bc.createImageData(size, size), ni = nc.createImageData(size, size);
    var mn = 1e9, mx = -1e9;
    for (i = 0; i < n; i++) { if (h[i] < mn) mn = h[i]; if (h[i] > mx) mx = h[i]; }
    var span = (mx - mn) || 1;
    for (i = 0; i < n; i++) {
      var hv = (h[i] - mn) / span;                        // 0..1
      var lum = 0.50 + 0.15 * (mot[i] - 0.5) + 0.40 * (hv - 0.5);
      lum = Math.max(0.12, Math.min(0.95, lum));
      ci.data[i * 4] = Math.min(255, lum * 255 * 1.02); ci.data[i * 4 + 1] = lum * 255; ci.data[i * 4 + 2] = lum * 255 * 0.965; ci.data[i * 4 + 3] = 255;
      var bvv = Math.round(hv * 255);
      bi.data[i * 4] = bi.data[i * 4 + 1] = bi.data[i * 4 + 2] = bvv; bi.data[i * 4 + 3] = 255;
    }
    // Tangent-space normal map from the same height field (central differences, wrapped): smooth, filterable
    // shading of grains, clods and craterlets instead of a bump map, which aliases into a pixelated look.
    var NS = 5.5 * size / 1024;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
      var xl = (x - 1 + size) % size, xr = (x + 1) % size, yu = (y - 1 + size) % size, yd = (y + 1) % size;
      var dx = (h[y * size + xl] - h[y * size + xr]) / span * NS, dy = (h[yu * size + x] - h[yd * size + x]) / span * NS;
      var inv = 1 / Math.sqrt(dx * dx + dy * dy + 1), j = (y * size + x) * 4;
      ni.data[j] = Math.round((dx * inv * 0.5 + 0.5) * 255); ni.data[j + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255);
      ni.data[j + 2] = Math.round((inv * 0.5 + 0.5) * 255); ni.data[j + 3] = 255;
    }
    cc.putImageData(ci, 0, 0); bc.putImageData(bi, 0, 0); nc.putImageData(ni, 0, 0);
    return { color: cv, bump: bv, normal: nv };
  }

  build();

  global.NASA_Terrain = {
    regolithTextures: regolithTextures,
    EXT: EXT, N: N, STEP: STEP,
    craters: craters, smallCraters: smallCraters, oldCraters: oldCraters, microCraters: microCraters,
    population: { SAT: SAT, DMIN: DMIN, DMAX: DMAX, areaKm2: AREA_KM2, expected: expectedCount },
    zones: ZONES, flatMask: flatMask,
    height: function (x, z) { return sample(H, x, z); },
    slope: function (x, z) {
      var e = STEP;
      var gx = (sample(H, x + e, z) - sample(H, x - e, z)) / (2 * e);
      var gz = (sample(H, x, z + e) - sample(H, x, z - e)) / (2 * e);
      return Math.atan(Math.sqrt(gx * gx + gz * gz));
    },
    soilSink: function (x, z) { return sample(SINK, x, z); },
    soilMu: function (x, z) { return sample(MU, x, z); },
    rockiness: function (x, z) { return sample(ROCK, x, z); },
    albedo: function (x, z) { return sample(ALB, x, z); },
    classAt: function (x, z) {
      var s = sample(SINK, x, z), r = sample(ROCK, x, z);
      if (r > 0.55) return 'ROCKY';
      if (s > 1.25) return 'LOOSE';
      if (s > 1.08) return 'SOFT';
      if (s < 0.88) return 'FIRM';
      return 'REGOLITH';
    },
    albedoGrid: ALB
  };
})(typeof window !== 'undefined' ? window : globalThis);
