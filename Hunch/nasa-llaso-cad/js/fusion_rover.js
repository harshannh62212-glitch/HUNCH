/**
 * NASA HUNCH LLASO — AEGIS-V1 Autonomous Lunar Cargo Rover, 3D assembly  v3.0
 * ============================================================================
 * 4 ft × 2 ft planform (1219.2 mm × 609.6 mm), 6 × 200 rpm drive wheels, 2-link grabber arm,
 * open cargo cradle with pod guides + hold-down, top-deck magnetic charge bridge for the dock.
 *
 * Look: white thermal-control paint (high solar reflectance / high emittance), aluminised-foil
 * radiator, gold MLI wraps on the battery hatch and arm turret, NASA-blue accents, graphite structure.
 *
 * Layout (root frame: +X forward, +Y up, ±Z sides, wheel centres at y = 0.09, ground at y = -0.01):
 *   x  +0.61 ……… +0.23  avionics hood (lid hinged on the port edge) · mast (lidar + stereo) · arm turret
 *   x  +0.22              bulkhead
 *   x  +0.21 ……… -0.10  cargo cradle: pod slot at x = +0.055, guides, hold-downs
 *   x  -0.10 ……… -0.57  aft service deck: charge bridge pad at x = -0.22, battery hatch, SoC LEDs
 *
 * Simulator contract (do not rename): wheels[], wheelGroups[{group,tire,lowerEye,id,localPos,baseZ}],
 * window.shockLinks, lidarHead, fanRotors, headlights, avLidGroup, cargoLidGroup, upperShellGroup,
 * roverArm{base,shoulder,elbow,wrist,gripper,fingerL,fingerR,tip,grabberCam,L1,L2}, grabberCamera,
 * cargoBayGroup, cargoBaySlots, comMarkerGroup.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------
  function mk(geo, mat, x, y, z, parent, shadow) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (shadow) m.castShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function box(w, h, d, mat, x, y, z, parent, shadow) { return mk(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent, shadow); }
  function cyl(rt, rb, h, mat, x, y, z, parent, axis, seg, shadow) {
    var m = mk(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat, x, y, z, parent, shadow);
    if (axis === 'x') m.rotation.z = Math.PI / 2;      // cylinder axis along X
    else if (axis === 'z') m.rotation.x = Math.PI / 2; // cylinder axis along Z
    return m;
  }
  function canvasTex(w, h, draw, rep) {
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var c = cv.getContext('2d'); draw(c, w, h);
    var t = new THREE.CanvasTexture(cv);
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }

  // Painted skin: very fine orange-peel + panel-line texture so the white coat reads as paint, not plastic.
  function paintTexture() {
    return canvasTex(512, 512, function (c, w, h) {
      c.fillStyle = '#f4f6f8'; c.fillRect(0, 0, w, h);
      for (var i = 0; i < 2600; i++) {
        var s = 236 + Math.random() * 18;
        c.fillStyle = 'rgba(' + (s | 0) + ',' + (s | 0) + ',' + ((s + 4) | 0) + ',0.5)';
        c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, [2, 2]);
  }
  function diamondTexture() {
    return canvasTex(256, 256, function (c, w, h) {
      c.fillStyle = '#20252d'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#3a424e'; c.lineWidth = 3;
      for (var y = 0; y < h; y += 32) for (var x = 0; x < w; x += 32) {
        c.beginPath(); c.moveTo(x + 4, y + 28); c.lineTo(x + 28, y + 4); c.stroke();
        c.beginPath(); c.moveTo(x + 4, y + 4); c.lineTo(x + 28, y + 28); c.stroke();
      }
    }, [4, 4]);
  }
  function treadTexture() {
    return canvasTex(256, 128, function (c, w, h) {
      c.fillStyle = '#17191e'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#262a31';
      for (var x = 0; x < w; x += 16) c.fillRect(x, 0, 8, h);
    }, [6, 1]);
  }
  function foilTexture() {
    return canvasTex(256, 256, function (c, w, h) {
      c.fillStyle = '#d9a21b'; c.fillRect(0, 0, w, h);
      for (var i = 0; i < 90; i++) {
        c.fillStyle = 'rgba(' + (255 - Math.random() * 60 | 0) + ',' + (200 - Math.random() * 60 | 0) + ',40,0.45)';
        var x = Math.random() * w, y = Math.random() * h;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30 + Math.random() * 40, y + 10 - Math.random() * 20); c.lineTo(x + 10, y + 30); c.fill();
      }
    }, [2, 2]);
  }

  // ---------------------------------------------------------------------------
  function initFusionRover(opts) {
    opts = opts || {};
    var roverGroup = opts.roverGroup;
    var wheelGroups = opts.wheelGroups || [];
    var wheels = opts.wheels || [];
    var bom = global.NASA_RoverBOM;

    var root = new THREE.Group();
    root.name = 'aegisRoverAssembly';
    roverGroup.add(root);
    // hide the simulator's placeholder (procedural) rover parts so they don't show through this model
    (opts.hide || []).forEach(function (o) { if (o) o.visible = false; });

    // ── materials ─────────────────────────────────────────────────────────────
    var paintMap = paintTexture();
    // White thermal-control coating: bright, glossy, mostly dielectric so it stays white under a single sun.
    var mPaint = new THREE.MeshPhysicalMaterial({ color: 0xf6f8fa, map: paintMap, roughness: 0.30, metalness: 0.06, clearcoat: 1.0, clearcoatRoughness: 0.05 });
    var mPaintShade = new THREE.MeshPhysicalMaterial({ color: 0xe3e8ee, roughness: 0.34, metalness: 0.06, clearcoat: 0.8, clearcoatRoughness: 0.08 });
    var mBlue = new THREE.MeshStandardMaterial({ color: 0x0b4fb3, roughness: 0.32, metalness: 0.25 });
    var mRed = new THREE.MeshStandardMaterial({ color: 0xe5361f, roughness: 0.35, metalness: 0.1 });
    var mOrange = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4, metalness: 0.1 });
    var mGraphite = new THREE.MeshStandardMaterial({ color: 0x252a33, roughness: 0.55, metalness: 0.45 });
    var mDeck = new THREE.MeshStandardMaterial({ color: 0xffffff, map: diamondTexture(), roughness: 0.6, metalness: 0.35 });
    var mAlu = new THREE.MeshStandardMaterial({ color: 0xcdd5df, roughness: 0.35, metalness: 0.55 });
    var mAluDark = new THREE.MeshStandardMaterial({ color: 0x7c8794, roughness: 0.4, metalness: 0.6 });
    var mFoil = new THREE.MeshStandardMaterial({ color: 0xffffff, map: foilTexture(), roughness: 0.42, metalness: 0.5 });
    var mRubber = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.92, metalness: 0.05 });
    var mTire = new THREE.MeshStandardMaterial({ color: 0xffffff, map: treadTexture(), roughness: 0.9, metalness: 0.05 });
    var mSeal = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.9 });
    var mCopper = new THREE.MeshStandardMaterial({ color: 0xc27a2c, roughness: 0.32, metalness: 0.8 });
    var mBrass = new THREE.MeshStandardMaterial({ color: 0xe0a21a, roughness: 0.3, metalness: 0.6 });
    var mLens = new THREE.MeshStandardMaterial({ color: 0x06101c, emissive: 0x0b66b8, emissiveIntensity: 0.55, roughness: 0.05, metalness: 0.7 });
    var mGlass = new THREE.MeshStandardMaterial({ color: 0x0c1a2b, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.88 });
    var mLedWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dd, emissiveIntensity: 2.2 });
    var mLedGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 2.0 });
    var mLedRed = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 2.2 });
    var mAmber = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.9 });

    var fanRotors = [];
    var headlights = [];

    // ── planform ──────────────────────────────────────────────────────────────
    var chSpec = bom ? bom.byId('chassis') : null;
    var CH_L = chSpec ? chSpec.size[0] : 1.2192;
    var CH_W = chSpec ? chSpec.size[2] : 0.6096;
    var HL = CH_L * 0.5, HW = CH_W * 0.5;
    var BW = 0.262;                 // body half-width (wheels sit outboard of the body)
    var DECK_Y = 0.18;              // top of the structural tub = cargo floor
    var BULK_X = 0.222;             // avionics / cargo partition
    var HOOD_TOP = 0.25;            // avionics hood top (arm turret sits here)
    var SLOT_X = 0.055;             // cargo pod slot centre (pod is 0.305 long along X: spans -0.098 … +0.208)
    var PAD = { x: -0.22, y: 0.338, z: 0 };   // magnetic charge pad — must match the dock coupler (viewer chargePadGroup)

    // =========================================================================
    // 1. STRUCTURE — graphite tub, belly plate, skid plates, sloped nose
    // =========================================================================
    box(CH_L - 0.06, 0.115, BW * 2 - 0.02, mGraphite, 0, 0.117, 0, root, true);          // tub 0.06 … 0.175
    box(CH_L - 0.22, 0.012, BW * 2 - 0.08, mAlu, 0, 0.054, 0, root);                      // belly plate
    [1, -1].forEach(function (s) {                                                         // angled approach skids
      var sk = box(0.13, 0.014, BW * 1.7, mAlu, s * (HL - 0.045), 0.072, 0, root, true);
      sk.rotation.z = s * 0.24;
    });

    // body skin: side panels (white) with a blue belt line and a red safety-stripe tab
    [1, -1].forEach(function (s) {
      box(CH_L - 0.10, 0.105, 0.020, mPaint, 0, 0.128, s * (BW + 0.002), root, true);
      box(CH_L - 0.10, 0.012, 0.022, mBlue, 0, 0.168, s * (BW + 0.003), root);
      box(0.10, 0.012, 0.022, mRed, -HL + 0.12, 0.168, s * (BW + 0.004), root);
      // panel gaps (dark seal lines) so the skin reads as separate bolted panels
      [-0.30, 0.09, 0.40].forEach(function (gx) { box(0.004, 0.100, 0.022, mSeal, gx, 0.128, s * (BW + 0.004), root); });
    });
    // rear & front fascia
    box(0.020, 0.105, BW * 2, mPaint, -HL + 0.012, 0.128, 0, root, true);
    var nose = box(0.16, 0.012, BW * 2 - 0.02, mPaint, HL - 0.04, 0.178, 0, root, true); nose.rotation.z = -0.36;   // sloped nose plate
    box(0.030, 0.085, BW * 2 - 0.01, mPaint, HL - 0.01, 0.125, 0, root, true);
    // bumper bar (aluminium) with two soft-stop pads
    box(0.030, 0.026, BW * 2 + 0.03, mAlu, HL + 0.012, 0.085, 0, root, true);
    [-0.17, 0.17].forEach(function (z) { box(0.012, 0.020, 0.07, mRubber, HL + 0.032, 0.085, z, root); });
    // rear towing clevises (recessed D-rings) and charge-port cover
    [-0.15, 0.15].forEach(function (z) {
      box(0.020, 0.030, 0.034, mAluDark, -HL - 0.002, 0.100, z, root);
      var d = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 14), mAlu); d.position.set(-HL - 0.012, 0.100, z); d.rotation.y = Math.PI / 2; root.add(d);
    });

    // wordmark flanks ("AEGIS-V1") — chunky block letters, mirrored on both sides
    (function () {
      var glyph = {
        A: ['010', '101', '111', '101', '101'], E: ['111', '100', '110', '100', '111'], G: ['011', '100', '101', '101', '011'],
        I: ['111', '010', '010', '010', '111'], S: ['011', '100', '010', '001', '110'], '-': ['000', '000', '111', '000', '000'],
        V: ['101', '101', '101', '101', '010'], '1': ['010', '110', '010', '010', '111']
      };
      // sits in the gap between the middle and rear wheels; reads front-to-back correctly from either side
      var text = 'AEGIS-V1', cell = 0.0068, gapC = 0.0068, adv = 3 * cell + gapC;
      var span = text.length * adv - gapC, xMid = -0.268;
      [1, -1].forEach(function (s) {
        text.split('').forEach(function (ch, k) {
          var g = glyph[ch]; if (!g) return;
          // port (+Z) side: reader faces -Z, +X is to the reader's right, so text runs toward -X (rear→front reads left→right)
          var x0 = s > 0 ? xMid - span / 2 + k * adv : xMid + span / 2 - k * adv;
          for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) if (g[r][c] === '1') {
            var cx = s > 0 ? x0 + c * cell : x0 - c * cell;
            box(cell * 0.9, cell * 0.9, 0.003, mBlue, cx, 0.142 - r * cell, s * (BW + 0.0135), root);
          }
        });
      });
    })();

    // =========================================================================
    // 2. WHEELS & SUSPENSION — 6 × 200 rpm gearmotor drive pods, damper per corner
    // =========================================================================
    function dXs(v) { return bom && bom.dX ? bom.dX(v) : v * (CH_L / 0.86); }
    var axleX = [dXs(0.38), 0, dXs(-0.38)];
    axleX.forEach(function (ax) {                                                          // through-axle tubes hidden inside the tub
      cyl(0.012, 0.012, CH_W * 1.0, mAlu, ax, 0.09, 0, root, 'z', 14);
    });
    var wheelDefs = [
      { id: 'FL', x: dXs(0.38), z: CH_W * 0.56 }, { id: 'ML', x: 0.00, z: CH_W * 0.56 }, { id: 'BL', x: dXs(-0.38), z: CH_W * 0.56 },
      { id: 'FR', x: dXs(0.38), z: -CH_W * 0.56 }, { id: 'MR', x: 0.00, z: -CH_W * 0.56 }, { id: 'BR', x: dXs(-0.38), z: -CH_W * 0.56 }
    ];
    // the simulator hands over its placeholder wheels: hide them before replacing the arrays' contents
    wheelGroups.forEach(function (w) { if (w && w.group) w.group.visible = false; });
    wheels.forEach(function (t) { if (t) t.visible = false; });
    wheels.length = 0; wheelGroups.length = 0;
    wheelDefs.forEach(function (wd) {
      var ss = wd.z > 0 ? 1 : -1;
      var wg = new THREE.Group(); wg.position.set(wd.x, 0.09, wd.z);
      var yoke = new THREE.Group();
      box(0.040, 0.118, 0.022, mAlu, 0, 0.056, -ss * 0.024, yoke, true);                  // fork strut
      box(0.040, 0.020, 0.075, mAlu, 0, 0.112, -ss * 0.052, yoke, true);                   // swing arm back toward the body
      cyl(0.0185, 0.0185, 0.052, mGraphite, 0, 0, -ss * 0.050, yoke, 'z', 20, true);       // gearmotor can
      cyl(0.016, 0.016, 0.030, mAluDark, 0, 0, -ss * 0.022, yoke, 'z', 20);                // gearbox
      cyl(0.0125, 0.0125, 0.012, mBrass, 0, 0, -ss * 0.082, yoke, 'z', 16);                // encoder cap
      box(0.006, 0.050, 0.006, mRed, 0.010, 0.050, -ss * 0.050, yoke);                     // motor leads
      box(0.006, 0.050, 0.006, mRubber, -0.010, 0.050, -ss * 0.050, yoke);
      wg.add(yoke);
      var lEye = new THREE.Object3D(); lEye.name = 'axle-eye-' + wd.id; lEye.position.set(0, 0, -ss * 0.02); wg.add(lEye);
      var spin = new THREE.Group(); spin.rotation.x = Math.PI / 2;
      var tire = new THREE.Mesh(new THREE.CylinderGeometry(0.093, 0.093, 0.078, 36), mTire); tire.castShadow = true; tire.receiveShadow = true; spin.add(tire);   // lugs bring it to the 0.10 m rolling radius
      for (var gi = 0; gi < 14; gi++) {                                                     // chevron lugs
        var a = gi / 14 * Math.PI * 2;
        var lug = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.074, 0.016), mRubber);   // chevron lug across the tread
        lug.position.set(Math.cos(a) * 0.0955, 0, Math.sin(a) * 0.0955); lug.rotation.y = -a; lug.rotation.x = (gi % 2 === 0) ? 0.10 : -0.10; tire.add(lug);
      }
      cyl(0.071, 0.071, 0.080, mAlu, 0, 0, 0, tire, null, 30);                              // rim barrel
      cyl(0.062, 0.062, 0.082, mAluDark, 0, 0, 0, tire, null, 30);                          // dished face
      for (var sp = 0; sp < 5; sp++) {                                                       // spokes
        var sa = sp / 5 * Math.PI * 2;
        var spoke = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.086, 0.010), mAlu);
        spoke.position.set(Math.cos(sa) * 0.036, 0, Math.sin(sa) * 0.036); spoke.rotation.y = -sa; tire.add(spoke);
      }
      cyl(0.026, 0.030, 0.090, mBlue, 0, 0, 0, tire, null, 20);                             // hub
      cyl(0.011, 0.011, 0.095, mBrass, 0, 0, 0, tire, null, 10);                            // axle nut
      wg.add(spin); root.add(wg);
      wheels.push(tire);
      wheelGroups.push({ group: wg, tire: tire, lowerEye: lEye, id: wd.id, localPos: new THREE.Vector3(wd.x, 0.09, wd.z), baseZ: wd.z });

      // white wheel arch over each wheel (fixed to the body, clears the tire through full suspension travel)
      (function () {
        var ARC_R = 0.150, SEGS = 9, a0 = wd.x > 0.1 ? 1.0 : 0.38, a1 = wd.x < -0.1 ? Math.PI - 1.0 : Math.PI - 0.38, seg = (a1 - a0) / SEGS;
        var chord = 2 * ARC_R * Math.sin(seg / 2) + 0.006;
        for (var q = 0; q < SEGS; q++) {
          var ang = a0 + (q + 0.5) * seg;
          var plate = new THREE.Mesh(new THREE.BoxGeometry(chord, 0.010, 0.088), mPaint);
          plate.position.set(wd.x + Math.cos(ang) * ARC_R, 0.09 + Math.sin(ang) * ARC_R, wd.z);
          plate.rotation.z = ang - Math.PI / 2; plate.castShadow = true; root.add(plate);
        }
        box(0.012, 0.012, 0.090, mBlue, wd.x + Math.cos(a0) * ARC_R, 0.09 + Math.sin(a0) * ARC_R, wd.z, root);          // piping at the arch ends
        box(0.012, 0.012, 0.090, mBlue, wd.x + Math.cos(a1) * ARC_R, 0.09 + Math.sin(a1) * ARC_R, wd.z, root);
      })();
    });

    // dampers (kept as { shock, upper, lower, rest } for the simulator's suspension animation)
    var shockLinks = [];
    wheelGroups.forEach(function (w) {
      var lx = w.localPos.x, lz = w.localPos.z, ss = lz >= 0 ? 1 : -1;
      var UY = 0.205, UZ = ss * (BW + 0.024);
      var uEye = new THREE.Object3D(); uEye.position.set(lx + 0.035, UY, UZ); root.add(uEye);
      box(0.050, 0.030, 0.018, mAluDark, lx + 0.035, UY - 0.004, ss * (BW + 0.010), root);       // damper bracket on the body side
      var du = new THREE.Vector3(0.035, UY - 0.09, UZ - (lz - ss * 0.02));
      var rest = Math.max(0.05, Math.hypot(du.x, du.y, du.z));
      var shock = new THREE.Group(); shock.name = 'shock-' + w.id;
      var R2 = rest / 2;
      box(0.020, 0.010, 0.012, mAluDark, 0, R2 - 0.005, 0, shock);                           // top clevis
      cyl(0.0032, 0.0032, rest * 0.55, mAlu, 0, R2 - rest * 0.275, 0, shock, null, 8);       // chrome shaft
      cyl(0.010, 0.010, rest * 0.45, mRed, 0, -R2 + rest * 0.24, 0, shock, null, 14);        // damper body
      box(0.020, 0.010, 0.012, mAluDark, 0, -R2 + 0.005, 0, shock);                          // bottom clevis
      for (var c = 0; c < 5; c++) {                                                           // spring coils
        var coil = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0018, 5, 14), mAluDark);
        coil.rotation.x = Math.PI / 2; coil.position.y = -R2 * 0.6 + c * (rest * 0.17); shock.add(coil);
      }
      (function () {                                                                         // align local +Y with lower→upper
        var up = uEye.position, lo = new THREE.Vector3(lx, 0.09, lz - ss * 0.02);
        var dx = up.x - lo.x, dy = up.y - lo.y, dz = up.z - lo.z, L = Math.hypot(dx, dy, dz);
        dx /= L; dy /= L; dz /= L;
        var cz = Math.sqrt(Math.max(1e-9, 1 - dx * dx));
        shock.rotation.set(Math.atan2(dz / cz, dy / cz), 0, Math.asin(-dx));
        shock.position.set((up.x + lo.x) / 2, (up.y + lo.y) / 2, (up.z + lo.z) / 2);
      })();
      root.add(shock);
      shockLinks.push({ shock: shock, upper: uEye, lower: w.lowerEye, rest: rest });
    });
    global.shockLinks = shockLinks;

    // =========================================================================
    // 3. AVIONICS HOOD (front) — hinged lid, radiator, sensors, headlights
    // =========================================================================
    var HOOD_LEN = HL - BULK_X - 0.01;          // 0.479
    var HOOD_CX = BULK_X + HOOD_LEN * 0.5 + 0.005;
    box(0.014, 0.075, BW * 2 - 0.02, mGraphite, BULK_X, 0.2175, 0, root);                    // bulkhead
    // hood walls (white), open top beneath the lid
    box(HOOD_LEN, HOOD_TOP - DECK_Y - 0.012, 0.018, mPaint, HOOD_CX, (DECK_Y + HOOD_TOP) / 2 - 0.006, BW - 0.010, root, true);
    box(HOOD_LEN, HOOD_TOP - DECK_Y - 0.012, 0.018, mPaint, HOOD_CX, (DECK_Y + HOOD_TOP) / 2 - 0.006, -BW + 0.010, root, true);
    box(0.018, HOOD_TOP - DECK_Y - 0.012, BW * 2 - 0.02, mPaint, HL - 0.012, (DECK_Y + HOOD_TOP) / 2 - 0.006, 0, root, true);

    // internals visible when the lid is open (Pi-top 4 / drivers / buck / IMU)
    var internals = new THREE.Group(); root.add(internals);
    // (laid out under the lid footprint: x 0.23 … 0.48, z -0.26 … 0.06)
    box(0.240, 0.010, 0.300, mGraphite, 0.355, DECK_Y + 0.007, -0.100, internals);                 // electronics tray
    box(0.120, 0.028, 0.100, mGraphite, 0.410, DECK_Y + 0.026, -0.040, internals);                 // pi-top [4]
    box(0.104, 0.004, 0.084, mBlue, 0.410, DECK_Y + 0.042, -0.040, internals);
    [-0.205, -0.135, -0.065].forEach(function (zz) {                                                // 3 × dual motor drivers
      box(0.060, 0.016, 0.060, mBlue, 0.285, DECK_Y + 0.020, zz, internals);
      box(0.020, 0.010, 0.040, mAluDark, 0.285, DECK_Y + 0.033, zz, internals);
    });
    box(0.050, 0.020, 0.040, mRed, 0.440, DECK_Y + 0.022, -0.190, internals);                    // 12 V → 5 V buck
    box(0.030, 0.006, 0.030, mGraphite, 0.350, DECK_Y + 0.015, 0.020, internals);                // IMU
    for (var wi = 0; wi < 6; wi++) box(0.004, 0.004, 0.16, wi % 2 ? mRubber : mRed, 0.325 + wi * 0.009, DECK_Y + 0.015, -0.125, internals);

    var upperShell = new THREE.Group();          // sim lifts this for EXPLODE; keep origin at y = 0
    upperShell.name = 'upperShellGroup';
    root.add(upperShell);
    // hood top = fixed sensor deck (front strip, carries the mast) + fixed arm pedestal (port strip, carries the arm)
    //           + hinged lid over the electronics (hinge on its port edge, so it opens without hitting the arm or mast)
    var DECK_FX = 0.485;                                 // front sensor deck from here to the nose
    var PED_Z = 0.060;                                   // arm pedestal from here to the port side
    var LID_X0 = BULK_X + 0.006, LID_X1 = DECK_FX - 0.004, LID_LEN = LID_X1 - LID_X0, LID_CX = (LID_X0 + LID_X1) / 2;
    var LID_Z0 = -BW + 0.006, LID_W = PED_Z - LID_Z0 - 0.004;
    box(HL - DECK_FX, 0.014, BW * 2 - 0.006, mPaint, (HL + DECK_FX) / 2 - 0.002, HOOD_TOP - 0.006, 0, root, true);       // sensor deck
    box(LID_LEN + 0.004, 0.014, BW - PED_Z - 0.004, mPaint, LID_CX, HOOD_TOP - 0.006, (BW + PED_Z) / 2, root, true);  // arm pedestal plate
    box(LID_LEN + 0.004, 0.006, 0.010, mSeal, LID_CX, HOOD_TOP - 0.010, PED_Z, root);                                 // seam
    box(0.006, 0.006, BW * 2 - 0.02, mSeal, DECK_FX - 0.002, HOOD_TOP - 0.010, 0, root);
    var avLid = new THREE.Group(); avLid.name = 'avionicsLidGroup';   // rotates about X; positive angle opens it upward
    var HINGE_Z = PED_Z - 0.004, HINGE_Y = HOOD_TOP - 0.006;
    avLid.position.set(LID_CX, HINGE_Y, HINGE_Z);
    upperShell.add(avLid);
    box(LID_LEN, 0.014, LID_W, mPaint, 0, 0, -LID_W / 2, avLid, true);                                      // lid panel
    box(LID_LEN + 0.012, 0.010, 0.016, mBlue, 0, 0.011, -LID_W + 0.006, avLid);                              // blue lip, starboard edge
    for (var hg = -1; hg <= 1; hg += 2) cyl(0.007, 0.007, 0.050, mAluDark, hg * LID_LEN * 0.32, 0.004, -0.002, avLid, 'x', 12);   // hinge knuckles
    // zenith radiator: aluminised pad with louvered slats (the lid is the electronics' heat-rejection surface)
    box(LID_LEN - 0.050, 0.003, LID_W - 0.070, mAlu, -0.004, 0.0085, -LID_W / 2 - 0.010, avLid);
    var nSl = 9;
    for (var lv = 0; lv < nSl; lv++) box(0.010, 0.004, LID_W - 0.080, mAluDark, -(LID_LEN - 0.070) / 2 + lv * (LID_LEN - 0.070) / (nSl - 1), 0.011, -LID_W / 2 - 0.010, avLid);
    // quarter-turn latches on the starboard edge
    [-0.07, 0.07].forEach(function (lx) { cyl(0.008, 0.008, 0.010, mBrass, lx, 0.012, -LID_W + 0.018, avLid, null, 10); });
    // compression gasket under the lid edges
    box(LID_LEN, 0.004, 0.010, mSeal, LID_CX, HOOD_TOP - 0.014, -BW + 0.016, root);
    box(0.010, 0.004, LID_W, mSeal, LID_X0 + 0.008, HOOD_TOP - 0.014, LID_Z0 + LID_W / 2, root);

    // front sensor window (glazed), IR/ToF eyes, and headlight pods
    box(0.014, 0.036, 0.20, mSeal, HL + 0.002, 0.168, 0, root);
    box(0.010, 0.030, 0.19, mGlass, HL + 0.008, 0.168, 0, root);
    [-0.06, 0.0, 0.06].forEach(function (z) { cyl(0.007, 0.008, 0.008, mLens, HL + 0.014, 0.168, z, root, 'x', 12); });
    [-1, 1].forEach(function (s) {
      var z = s * (BW - 0.045);
      cyl(0.026, 0.028, 0.026, mGraphite, HL + 0.010, 0.145, z, root, 'x', 18);
      cyl(0.018, 0.018, 0.028, mLedWhite, HL + 0.016, 0.145, z, root, 'x', 18);
      var spot = new THREE.SpotLight(0xffeedd, 2.5, 25, Math.PI / 5, 0.4, 1.5);
      spot.position.set(HL + 0.03, 0.145, z);
      var tgt = new THREE.Object3D(); tgt.position.set(5.0, -0.4, z); root.add(tgt); spot.target = tgt; root.add(spot); headlights.push(spot);
    });

    // =========================================================================
    // 4. PERCEPTION MAST — stereo cameras + 360° lidar, stow lock
    // =========================================================================
    var mast = new THREE.Group();
    mast.position.set((HL + DECK_FX) / 2 - 0.004, HOOD_TOP, -BW * 0.55);   // on the fixed sensor deck
    root.add(mast);
    cyl(0.030, 0.034, 0.016, mAluDark, 0, 0.008, 0, mast, null, 20);                         // base flange
    cyl(0.016, 0.020, 0.230, mPaint, 0, 0.125, 0, mast, null, 20, true);                    // pole
    cyl(0.024, 0.024, 0.010, mBlue, 0, 0.215, 0, mast, null, 20);
    cyl(0.046, 0.050, 0.016, mGraphite, 0, 0.246, 0, mast, null, 24);                        // sensor deck
    var lidarHead = new THREE.Group(); lidarHead.position.set(0, 0.283, 0); mast.add(lidarHead);
    cyl(0.042, 0.044, 0.040, mGraphite, 0, 0, 0, lidarHead, null, 26, true);
    cyl(0.043, 0.043, 0.006, mBlue, 0, 0.012, 0, lidarHead, null, 26);
    cyl(0.020, 0.020, 0.012, mLens, 0.036, 0.0, 0.0, lidarHead, 'x', 16);
    [-0.016, 0.016].forEach(function (z) { box(0.020, 0.024, 0.010, mGraphite, 0.050, 0.236, z * 2, mast); cyl(0.0065, 0.0075, 0.012, mLens, 0.062, 0.236, z * 2, mast, 'x', 14); });
    box(0.040, 0.018, 0.024, mBlue, 0.030, 0.062, 0, mast);                                   // stow-lock bracket
    cyl(0.004, 0.004, 0.034, mBrass, 0.030, 0.062, 0, mast, 'x', 8);
    box(0.022, 0.014, 0.003, mAmber, 0.044, 0.062, 0.014, mast);                              // remove-before-flight tag

    // =========================================================================
    // 5. CARGO CRADLE (aft) — floor, rails, pod guides, hold-down clamps, service deck
    // =========================================================================
    var podSpec = bom && bom.pod ? bom.pod : null;
    var podH = podSpec ? podSpec.heightM : 0.152, podW = podSpec ? podSpec.widthM : 0.152, podL = podSpec ? podSpec.lengthM : 0.305;
    var CR_X0 = -HL + 0.04, CR_X1 = BULK_X - 0.012;         // −0.569 … +0.108
    var CR_LEN = CR_X1 - CR_X0, CR_CX = (CR_X0 + CR_X1) / 2;
    var cargoBay = new THREE.Group(); cargoBay.position.set(0, DECK_Y, 0); root.add(cargoBay);
    box(CR_LEN, 0.012, BW * 2 - 0.02, mDeck, CR_CX, 0.000, 0, cargoBay);                      // diamond-plate floor
    // side rails (white with blue cap) — low so the arm can drop pods in from above
    [1, -1].forEach(function (s) {
      box(CR_LEN, 0.060, 0.016, mPaint, CR_CX, 0.036, s * (BW - 0.012), cargoBay, true);
      box(CR_LEN, 0.008, 0.026, mBlue, CR_CX, 0.070, s * (BW - 0.012), cargoBay);
      box(CR_LEN, 0.010, 0.012, mAlu, CR_CX, 0.012, s * (BW - 0.050), cargoBay);             // slide track for hold-down
    });
    box(0.016, 0.060, BW * 2 - 0.02, mPaint, CR_X0 + 0.008, 0.036, 0, cargoBay, true);       // aft wall
    box(0.008, 0.008, BW * 2 - 0.02, mBlue, CR_X0 + 0.008, 0.070, 0, cargoBay);
    // pod guides: four wedge posts funnel the pod into the slot, painted safety orange
    var gx = podL * 0.5 + 0.004, gz = podW * 0.5 + 0.016;   // pod is long along X
    // Two pods ride side by side (2 x 5 lb): slot centres at z = +/-SLOT_DZ, each with its own four guide posts.
    var SLOT_DZ = 0.125;
    [SLOT_DZ, -SLOT_DZ].forEach(function (zc) {
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (g) {
        var post = box(0.020, 0.075, 0.020, mOrange, SLOT_X + g[0] * gx, 0.040, zc + g[1] * gz, cargoBay, true);
        var cap = box(0.032, 0.008, 0.032, mRed, SLOT_X + g[0] * (gx + 0.002), 0.082, zc + g[1] * gz, cargoBay);
        var fl = box(0.020, 0.040, 0.012, mOrange, SLOT_X + g[0] * gx, 0.066, zc + g[1] * (gz + 0.014), cargoBay); fl.rotation.x = g[1] * 0.45;
      });
    });
    // swing hold-down clamps on the side rails (parked open, along the rail, so the arm can drop pods in from above)
    [1, -1].forEach(function (s) {
      var pz = s * (BW - 0.030), top = 0.014 + podH + 0.010;
      box(0.022, top, 0.022, mAluDark, SLOT_X, top / 2, pz, cargoBay, true);                   // clamp post
      cyl(0.016, 0.016, 0.020, mBlue, SLOT_X, top + 0.004, pz, cargoBay, null, 16);            // rotary actuator
      box(0.110, 0.012, 0.018, mAlu, SLOT_X - 0.050, top + 0.018, pz, cargoBay);               // clamp arm (open)
      box(0.018, 0.010, 0.020, mRubber, SLOT_X - 0.100, top + 0.010, pz, cargoBay);            // rubber toe
    });
    // tie-down eyes
    [-0.50, -0.34].forEach(function (x) { [1, -1].forEach(function (s) {
      var eye = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0028, 6, 14), mAlu); eye.position.set(x, 0.017, s * (BW - 0.045)); eye.rotation.x = Math.PI / 2; cargoBay.add(eye);
    }); });
    // pod slot (x = SLOT_X): sim seats parcels here
    global.cargoBaySlots = [];
    [SLOT_DZ, -SLOT_DZ].forEach(function (zc) {
      var slot = new THREE.Object3D(); slot.position.set(SLOT_X, 0.006 + podH * 0.5, zc); cargoBay.add(slot);
      var tieA = box(0.024, 0.006, podW + 0.024, mOrange, podL * 0.30, podH * 0.5 + 0.003, 0, slot);    // ratchet straps over the pod
      var tieB = box(0.024, 0.006, podW + 0.024, mOrange, -podL * 0.30, podH * 0.5 + 0.003, 0, slot);
      tieA.visible = tieB.visible = false;                                                                // sim shows them when a pod is seated
      slot.userData.ties = [tieA, tieB];
      global.cargoBaySlots.push(slot);
    });
    global.cargoBayGroup = cargoBay; window.cargoBayGroup = cargoBay;

    // cargo lid: dust cover over the aft service deck (slides rearward in the model viewer)
    var cargoLid = new THREE.Group(); cargoLid.name = 'cargoLidGroup';
    cargoLid.position.set(-HL + 0.17, DECK_Y + 0.034, 0); root.add(cargoLid);
    box(0.20, 0.010, BW * 2 - 0.06, mPaintShade, 0, 0, 0, cargoLid, true);
    box(0.20, 0.006, 0.020, mBlue, 0, 0.007, 0, cargoLid);
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { box(0.012, 0.024, 0.012, mAlu, sx * 0.09, -0.016, sz * (BW - 0.045), cargoLid); }); });   // slide carriages
    [-0.10, 0.10].forEach(function (z) { cyl(0.008, 0.008, 0.010, mBrass, -0.085, 0.008, z, cargoLid, null, 10); });

    // ── battery hatch (gold MLI wrap) + SoC LED bar on the aft service deck ──
    box(0.16, 0.004, 0.20, mFoil, -HL + 0.14, DECK_Y + 0.008, 0, root);
    for (var lb = 0; lb < 5; lb++) box(0.012, 0.008, 0.026, lb < 4 ? mLedGreen : mAmber, -HL + 0.034, DECK_Y + 0.072, -0.08 + lb * 0.04, root);

    // ── BATTERY BAY: aft-face service bay with a drop-down door, twin cam latches and a sliding pack sled ──
    // Door hinges on its lower edge and swings down to become a tray; the pack rides out on rails, the dock
    // robot swaps it, and the pack slides home before the door closes and the latches turn.
    var BAY_W = 0.205, BAY_H = 0.125, BAY_Y0 = 0.036;
    box(0.010, BAY_H + 0.020, BAY_W + 0.020, mGraphite, -HL - 0.001, BAY_Y0 + BAY_H / 2, 0, root);          // dark recess
    [[BAY_H + 0.020, 0.010, 0, (BAY_W + 0.010) / 2], [BAY_H + 0.020, 0.010, 0, -(BAY_W + 0.010) / 2]].forEach(function (f) {
      box(0.014, f[0], f[1], mAluDark, -HL - 0.003, BAY_Y0 + BAY_H / 2, f[3], root);                       // side frame
    });
    box(0.014, 0.010, BAY_W + 0.030, mAluDark, -HL - 0.003, BAY_Y0 + BAY_H + 0.009, 0, root);             // top frame
    // rails inside the opening
    [-1, 1].forEach(function (sz) { box(0.40, 0.008, 0.012, mAlu, -HL + 0.18, 0.058, sz * 0.078, root); });
    var batDoor = new THREE.Group(); batDoor.name = 'batteryDoor';
    batDoor.position.set(-HL - 0.012, BAY_Y0, 0); root.add(batDoor);
    box(0.008, BAY_H, BAY_W, mPaint, 0, BAY_H / 2, 0, batDoor, true);
    box(0.010, 0.012, BAY_W - 0.020, mBlue, -0.001, BAY_H - 0.014, 0, batDoor);
    box(0.010, 0.040, 0.050, mFoil, -0.001, BAY_H / 2 + 0.006, 0, batDoor);
    cyl(0.006, 0.006, BAY_W + 0.020, mAluDark, 0, 0, 0, batDoor, 'z', 10);                                // hinge barrel
    var batLatches = [];
    [-1, 1].forEach(function (sz) {                                                                          // quarter-turn cam latches
      var lt = new THREE.Group(); lt.position.set(-0.006, BAY_H - 0.026, sz * (BAY_W / 2 - 0.022)); batDoor.add(lt);
      cyl(0.011, 0.011, 0.006, mAluDark, 0, 0, 0, lt, 'x', 14);
      box(0.008, 0.006, 0.030, mAmber, -0.004, 0, 0, lt);
      batLatches.push(lt);
    });
    var batPack = new THREE.Group(); batPack.name = 'batteryPack'; batPack.position.set(-0.30, 0.100, 0); root.add(batPack);
    box(0.181, 0.076, 0.166, mGraphite, 0, 0, 0, batPack, true);                                             // LiFePO4 pack
    box(0.100, 0.002, 0.120, mBlue, 0, 0.039, 0, batPack);                                                   // label
    box(0.181, 0.008, 0.178, mAluDark, 0, -0.042, 0, batPack);                                               // sled plate
    box(0.016, 0.026, 0.070, mAlu, -0.098, 0.004, 0, batPack);                                               // pull handle
    var packLedMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 2.0 });
    box(0.004, 0.010, 0.100, packLedMat, -0.092, 0.026, 0, batPack);                                         // SoC strip, visible when out
    [-1, 1].forEach(function (sz) { box(0.020, 0.012, 0.016, mBrass, 0.092, -0.012, sz * 0.040, batPack); }); // power contacts
    var _bayHome = -0.30;
    global.batteryBay = {
      door: batDoor, pack: batPack, latches: batLatches, led: packLedMat,
      // open 0..1 (door angle), ext 0..1 (pack travel), soc 0..1 (LED colour)
      set: function (open, ext, soc, latch) {
        batDoor.rotation.z = open * 1.52;
        batPack.position.x = _bayHome - ext * 0.36;
        var lq = latch == null ? 1 - open : latch;
        batLatches.forEach(function (lt) { lt.rotation.x = (1 - lq) * 1.5708; });
        if (soc != null) {
          var c = soc > 0.5 ? 0x22c55e : soc > 0.25 ? 0xf59e0b : 0xef4444;
          packLedMat.color.setHex(c); packLedMat.emissive.setHex(soc > 0.5 ? 0x16a34a : soc > 0.25 ? 0xd97706 : 0xb91c1c);
        }
      }
    };
    global.batteryBay.set(0, 0, 0.8, 1);

    // =========================================================================
    // 6. CHARGE BRIDGE — top-deck magnetic pad the dock coupler mates with (x = -0.22, y = 0.338)
    // =========================================================================
    var bridge = new THREE.Group(); bridge.position.y = 0.006; root.add(bridge);   // pad surface lands at the dock coupler's contact height
    // legs: the front pair sits 10 mm aft of the pod slots (pods span x -0.0975 … +0.2075); they used to clip both pods
    [[-0.33, 0.125], [-0.115, 0.125], [-0.33, -0.125], [-0.115, -0.125]].forEach(function (p) {   // legs
      box(0.014, PAD.y - DECK_Y - 0.002, 0.014, mAlu, p[0], (PAD.y + DECK_Y) / 2 - 0.001, p[1], bridge, true);
    });
    box(0.225, 0.010, 0.020, mPaint, PAD.x - 0.0025, PAD.y - 0.011, 0.125, bridge);            // cross rails
    box(0.225, 0.010, 0.020, mPaint, PAD.x - 0.0025, PAD.y - 0.011, -0.125, bridge);
    box(0.220, 0.012, 0.215, mGraphite, PAD.x, PAD.y - 0.006, 0, bridge, true);                // pad base
    [-0.055, 0.055].forEach(function (z) { box(0.180, 0.006, 0.040, mCopper, PAD.x, PAD.y + 0.002, z, bridge); });   // contact rails
    box(0.022, 0.004, 0.100, mLedGreen, PAD.x + 0.100, PAD.y + 0.001, 0, bridge);              // alignment light
    [1, -1].forEach(function (s) {                                                              // tapered guide lips for coupler float
      var lip = box(0.220, 0.020, 0.010, mBlue, PAD.x, PAD.y + 0.006, s * 0.108, bridge); lip.rotation.x = -s * 0.5;
    });
    [1, -1].forEach(function (s) {
      var lip2 = box(0.010, 0.020, 0.200, mBlue, PAD.x + s * 0.113, PAD.y + 0.006, 0, bridge); lip2.rotation.z = s * 0.5;
    });
    // magnetic keeper plates on top of the bridge
    [1, -1].forEach(function (s) { box(0.040, 0.004, 0.040, mAluDark, PAD.x + s * 0.080, PAD.y + 0.0, s * 0.0, bridge); });

    // =========================================================================
    // 7. GRABBER ARM — turret, shoulder, elbow, wrist roll, parallel-jaw gripper + eye-in-hand camera
    // =========================================================================
    var L1 = 0.34, L2 = 0.30;   // 0.64 m reach: pods are presented just clear of the nose, so the arm has to reach past it
    var armBase = new THREE.Group();
    armBase.position.set(0.327, HOOD_TOP, 0.122);
    root.add(armBase);
    cyl(0.040, 0.044, 0.012, mAlu, 0, 0.006, 0, armBase, null, 24);                              // mounting ring
    for (var bi = 0; bi < 6; bi++) { var ba = bi / 6 * Math.PI * 2; cyl(0.004, 0.004, 0.008, mBrass, Math.cos(ba) * 0.036, 0.014, Math.sin(ba) * 0.036, armBase, null, 8); }
    cyl(0.031, 0.034, 0.030, mPaint, 0, 0.027, 0, armBase, null, 24, true);                       // turret
    cyl(0.0325, 0.0325, 0.008, mFoil, 0, 0.034, 0, armBase, null, 24);                            // gold MLI collar
    cyl(0.024, 0.024, 0.010, mBlue, 0, 0.046, 0, armBase, null, 24);
    var shoulder = new THREE.Group(); shoulder.position.set(0, 0.062, 0); armBase.add(shoulder);
    box(0.040, 0.050, 0.064, mPaint, 0, -0.004, 0, shoulder, true);                                // shoulder yoke block
    cyl(0.028, 0.028, 0.080, mAluDark, 0, 0, 0, shoulder, 'z', 24, true);                          // shoulder motor
    cyl(0.020, 0.020, 0.088, mBlue, 0, 0, 0, shoulder, 'z', 20);
    // upper arm: tapered white box beam with a dark service channel and a stiffening rib
    box(L1 - 0.03, 0.036, 0.034, mPaint, L1 * 0.5, 0, 0, shoulder, true);
    box(L1 - 0.06, 0.012, 0.038, mGraphite, L1 * 0.5, -0.018, 0, shoulder);
    box(L1 - 0.09, 0.006, 0.040, mBlue, L1 * 0.5, 0.019, 0, shoulder);
    box(L1 - 0.08, 0.010, 0.010, mRubber, L1 * 0.5, 0.0, 0.020, shoulder);                         // cable conduit
    var elbow = new THREE.Group(); elbow.position.set(L1, 0, 0); shoulder.add(elbow);
    cyl(0.026, 0.026, 0.070, mAluDark, 0, 0, 0, elbow, 'z', 24, true);
    cyl(0.018, 0.018, 0.078, mBlue, 0, 0, 0, elbow, 'z', 20);
    cyl(0.008, 0.008, 0.082, mBrass, 0, 0, 0, elbow, 'z', 10);                                     // pivot pin
    box(L2 - 0.05, 0.030, 0.028, mPaint, L2 * 0.5 - 0.005, 0, 0, elbow, true);                     // forearm
    box(L2 - 0.08, 0.010, 0.032, mGraphite, L2 * 0.5 - 0.005, -0.015, 0, elbow);
    box(L2 - 0.10, 0.005, 0.034, mBlue, L2 * 0.5 - 0.005, 0.016, 0, elbow);
    // wrist pitch knuckle (fixed to the forearm): the wrist group pitches about Z here so the gripper can stay
    // vertical for top-down grasps. The simulator leaves wrist.rotation.z at 0 (gripper in line with the forearm).
    cyl(0.019, 0.019, 0.052, mAluDark, L2, 0, 0, elbow, 'z', 20, true);
    cyl(0.013, 0.013, 0.058, mBlue, L2, 0, 0, elbow, 'z', 16);
    var wrist = new THREE.Group(); wrist.position.set(L2, 0, 0); elbow.add(wrist);
    cyl(0.017, 0.017, 0.028, mAluDark, -0.012, 0, 0, wrist, 'x', 18, true);                       // wrist roll housing
    cyl(0.018, 0.018, 0.006, mFoil, -0.026, 0, 0, wrist, 'x', 18);                                 // MLI sleeve
    box(0.030, 0.034, 0.030, mGraphite, 0.012, 0, 0, wrist, true);                                 // gripper palm (z half-width 0.015 < closed gap)
    box(0.010, 0.036, 0.030, mBlue, 0.027, 0, 0, wrist);
    // two parallel jaws. The sim slides fingerL.z = -grip, fingerR.z = +grip.
    function jaw(sgn) {
      var f = new THREE.Group();                                                                   // origin sits on the jaw centre line
      box(0.070, 0.016, 0.008, mAlu, 0.018, 0, 0, f, true);                                         // bar
      box(0.026, 0.020, 0.008, mAlu, 0.058, 0, -sgn * 0.004, f);                                   // hooked tip
      var hook = box(0.020, 0.018, 0.008, mAlu, 0.070, 0, -sgn * 0.011, f); hook.rotation.y = -sgn * 0.5;
      box(0.050, 0.012, 0.004, mRubber, 0.034, 0, -sgn * 0.0065, f);                                // soft pad (faces the pod handle)
      for (var k = 0; k < 4; k++) box(0.004, 0.012, 0.006, mGraphite, 0.014 + k * 0.014, 0, -sgn * 0.009, f);   // grip serrations
      box(0.014, 0.020, 0.006, mBlue, -0.010, 0, sgn * 0.003, f);                                   // carriage
      f.position.set(0.012, 0, sgn * 0.055);
      return f;
    }
    var fingerL = jaw(-1); fingerL.position.z = -0.055;
    var fingerR = jaw(1); fingerR.position.z = 0.055;
    wrist.add(fingerL, fingerR);
    shoulder.rotation.z = 1.15; elbow.rotation.z = -2.45;                                         // stowed pose (matches the sim's idle stow)
    var tip = new THREE.Object3D(); tip.position.set(0.03, 0, 0); wrist.add(tip);
    // eye-in-hand camera on a small bracket above the palm
    var gcBracket = new THREE.Group(); gcBracket.name = 'grabberCamBracket'; gcBracket.position.set(0.010, 0.026, 0);
    box(0.022, 0.016, 0.024, mGraphite, 0, 0, 0, gcBracket, true);
    cyl(0.0085, 0.0095, 0.010, mBrass, 0.012, 0, 0, gcBracket, 'x', 14);
    cyl(0.0058, 0.0058, 0.004, mLens, 0.018, 0, 0, gcBracket, 'x', 14);
    gcBracket.rotation.z = -0.42; wrist.add(gcBracket);
    var grabberCam = new THREE.PerspectiveCamera(62, 320 / 240, 0.02, 25);
    grabberCam.name = 'aiGrabberCamera'; grabberCam.position.set(0.022, 0.032, 0);
    grabberCam.rotation.order = 'YXZ'; grabberCam.rotation.set(0, -Math.PI / 2, -0.45);
    wrist.add(grabberCam); global.grabberCamera = grabberCam; window.grabberCamera = grabberCam;

    // =========================================================================
    // 8. SMALL DETAILS — E-stop (port, guarded), rear lights, rear charge port, CoM marker
    // =========================================================================
    var EX = 0.27, EY = 0.135, EZ = BW + 0.012;   // between the front and middle wheels, not hidden behind a tire
    box(0.050, 0.050, 0.014, mGraphite, EX, EY, EZ, root);
    cyl(0.025, 0.025, 0.018, mAluDark, EX, EY, EZ + 0.010, root, 'z', 18);
    cyl(0.018, 0.015, 0.020, mLedRed, EX, EY, EZ + 0.022, root, 'z', 18);
    box(0.044, 0.008, 0.003, mRed, EX, EY + 0.034, EZ + 0.002, root);
    [-0.20, 0.20].forEach(function (z) {                                                          // rear light bars
      box(0.008, 0.016, 0.070, mLedRed, -HL - 0.001, 0.150, z, root);
    });
    cyl(0.013, 0.013, 0.016, mGraphite, -HL - 0.004, 0.100, 0.0, root, 'x', 14);                  // rear charge port + cap
    cyl(0.015, 0.015, 0.008, mSeal, -HL - 0.012, 0.100, 0.0, root, 'x', 14);

    var com = bom && bom.com ? bom.com() : { x: -0.06, y: 0.12 };
    var comMarker = new THREE.Group(); comMarker.position.set(com.x || -0.06, (com.y || 0.12) + 0.14, 0); root.add(comMarker);
    cyl(0.030, 0.030, 0.003, mAmber, 0, 0, 0, comMarker, null, 16);
    box(0.070, 0.004, 0.004, mBlue, 0, 0, 0, comMarker); box(0.004, 0.004, 0.070, mBlue, 0, 0, 0, comMarker);
    comMarker.visible = false;
    global.comMarkerGroup = comMarker;

    // ── expose handles to the simulator runtime ──────────────────────────────
    global.lidarHead = lidarHead;
    global.fanRotors = fanRotors;
    global.headlights = headlights;
    global.avLidGroup = avLid;
    global.cargoLidGroup = cargoLid;
    global.upperShellGroup = upperShell;
    global.sensorMastGroup = mast;
    window.roverArm = {
      base: armBase, shoulder: shoulder, elbow: elbow, wrist: wrist,
      gripper: wrist, fingerL: fingerL, fingerR: fingerR, tip: tip,
      grabberCam: grabberCam, grabberBracket: gcBracket, L1: L1, L2: L2
    };
    root.userData.internals = internals;

    /* ── motion rig for the CAD pages (the simulator keeps its own physics; this mirrors it) ──────────
       roll(d)        spin all tyres for d metres of travel (0.10 m rolling radius)
       setTravel(a)   per-wheel suspension travel in metres (+ = wheel up into the arch), clamped ±35 mm
       updateShocks() re-aim / re-length each damper between its body eye and wheel eye (as viewer.html does)
       setFinish(k)   'flight' (white thermal paint) or 'petg' (the physical prototype: black PETG shell) */
    var _up = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
    var finishes = {
      flight: { paint: 0xf6f8fa, shade: 0xe3e8ee, map: paintMap, rough: 0.30, clear: 1.0 },
      petg: { paint: 0x1c1f24, shade: 0x2a2e35, map: null, rough: 0.46, clear: 0.35 }
    };
    var rig = {
      root: root, wheelGroups: wheelGroups, tires: wheels, R: 0.10, finish: 'flight',
      roll: function (d) { for (var i = 0; i < wheels.length; i++) wheels[i].rotation.y -= d / 0.10; },
      setTravel: function (arr) {
        for (var i = 0; i < wheelGroups.length; i++) {
          var tr = arr ? (arr[i] || 0) : 0;
          wheelGroups[i].group.position.y = 0.09 + Math.max(-0.035, Math.min(0.035, tr));
        }
        rig.updateShocks();
      },
      updateShocks: function () {
        for (var i = 0; i < shockLinks.length; i++) {
          var L = shockLinks[i], par = L.shock.parent; if (!par) continue;
          L.upper.getWorldPosition(_a); L.lower.getWorldPosition(_b); par.worldToLocal(_a); par.worldToLocal(_b);
          var dx = _a.x - _b.x, dy = _a.y - _b.y, dz = _a.z - _b.z, len = Math.max(0.02, Math.sqrt(dx * dx + dy * dy + dz * dz));
          _d.x = dx / len; _d.y = dy / len; _d.z = dz / len;                 // local +Y points lower → upper (as built)
          L.shock.position.set((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2);
          L.shock.quaternion.setFromUnitVectors(_up, _d);
          L.shock.scale.set(1, len / (L.rest || 0.09), 1);
        }
      },
      setFinish: function (k) {
        var f = finishes[k] || finishes.flight; rig.finish = finishes[k] ? k : 'flight';
        mPaint.color.setHex(f.paint); mPaint.map = f.map; mPaint.roughness = f.rough; mPaint.clearcoat = f.clear; mPaint.needsUpdate = true;
        mPaintShade.color.setHex(f.shade); mPaintShade.roughness = f.rough + 0.04; mPaintShade.needsUpdate = true;
      },
      materials: { paint: mPaint, paintShade: mPaintShade, foil: mFoil, alu: mAlu }
    };
    root.userData.rig = rig; global.roverRig = rig;
    root.updateMatrixWorld(true); rig.updateShocks();
    return Promise.resolve(root);
  }

  function chassisPlanformM() {
    var b = global.NASA_RoverBOM, c = b ? b.byId('chassis') : null;
    return { chL: c ? c.size[0] : 1.2192, chW: c ? c.size[2] : 0.6096 };
  }

  global.NASA_FusionRover = {
    init: initFusionRover,
    loadManifest: function () {
      var plan = chassisPlanformM();
      return Promise.resolve({ roverRadius: Math.max(plan.chL, plan.chW) * 0.52, modelCenter: { x: 0, y: 0, z: 0 } });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
