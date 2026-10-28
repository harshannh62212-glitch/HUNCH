/**
 * NASA HUNCH LLASO — AEGIS-V1 Autonomous Lunar Cargo Rover, 3D assembly  v4.0
 * ============================================================================
 * Fits a 24 in (0.6096 m) cube: 0.584 x 0.604 m swept footprint, 0.556 m tall (top of lidar).
 * Six 360-degree swerve modules (6 drive gearmotors + 6 continuous-rotation steering servos), belly tub with
 * the 12.8 V 5 Ah LiFePO4 pack centred and low, 2-link grabber arm that stows over the deck, two cargo
 * canisters carried crosswise in V-saddle cradles with trunnion latches, dock charge pad on the avionics pod.
 * Part masses and sizes: see NASA_RoverBOM (js/rover_bom.js) and review/docs/rover-v4-design.md.
 *
 * Root frame: +X forward, +Y up, ±Z sides, ground at y = 0, wheel axles at y = 0.065.
 *
 * Simulator contract (do not rename): wheels[], wheelGroups[{group,steer,tire,lowerEye,id,localPos,baseZ}],
 * window.shockLinks, lidarHead, fanRotors, headlights, avLidGroup, cargoLidGroup, upperShellGroup,
 * roverArm{base,shoulder,elbow,wrist,gripper,fingerL,fingerR,tip,grabberCam,L1,L2,stow}, grabberCamera,
 * cargoBayGroup, cargoBaySlots, comMarkerGroup, batteryBay, roverRig, ROVER_GEOM.
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
  // Rounded, bevelled box (extruded rounded rectangle) so panels catch light on their edges like machined /
  // moulded parts instead of reading as raw boxes. r = corner radius in the XY plane, edges bevelled along Z.
  function rbox(w, h, d, r, mat, x, y, z, parent, shadow) {
    var bev = Math.max(0.0008, Math.min(r * 0.5, d * 0.25, 0.006));
    var hw = w / 2 - bev, hh = h / 2 - bev, rr = Math.max(0.0006, Math.min(r, hw - 1e-4, hh - 1e-4));
    var s = new THREE.Shape();
    s.moveTo(-hw + rr, -hh); s.lineTo(hw - rr, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + rr);
    s.lineTo(hw, hh - rr); s.quadraticCurveTo(hw, hh, hw - rr, hh); s.lineTo(-hw + rr, hh);
    s.quadraticCurveTo(-hw, hh, -hw, hh - rr); s.lineTo(-hw, -hh + rr); s.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
    var depth = Math.max(0.0005, d - 2 * bev);
    var geo = new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 6 });
    geo.translate(0, 0, -depth / 2);
    geo.computeVertexNormals();
    return mk(geo, mat, x, y, z, parent, shadow);
  }
  // spur gear outline (extruded), axis along Y after the rotation below
  function gear(rad, teeth, thick, mat, x, y, z, parent) {
    var s = new THREE.Shape(), n = teeth * 4, td = rad * 0.10;
    for (var i = 0; i <= n; i++) {
      var a = i / n * Math.PI * 2, q = i % 4, rr = (q === 1 || q === 2) ? rad : rad - td;
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    var hole = new THREE.Path(); hole.absarc(0, 0, rad * 0.35, 0, Math.PI * 2, true); s.holes.push(hole);
    var g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -thick / 2); g.rotateX(Math.PI / 2);
    return mk(g, mat, x, y, z, parent, true);
  }

  /* =============================================================================================
   * AEGIS-V1 rover v4 — swerve-drive cargo rover inside a 24 in (0.6096 m) cube.
   * Root frame: +X forward, +Y up, ±Z sides, ground at y = 0 (wheel radius 0.065 = axle height).
   *   6 swerve modules at x = +0.215 / 0 / -0.215, z = ±0.225. Each: 130 mm wheel with an in-hub 37 mm
   *   gearmotor (drive), a continuous-rotation steering servo + AS5600 absolute encoder + 6-wire slip ring
   *   (unlimited 360 deg swivel), and a coil-over strut. 12 motors in all. A module sweeps r = 0.077 m when it
   *   turns, so modules never touch and the swept outline stays inside 0.292 x 0.302 m half-size.
   *   Belly tub (z ±0.14, y 0.065-0.185) carries the 5 Ah pack and electronics low and central.
   *   Deck top y = 0.205: avionics pod + charge pad (front), arm turret (front port), mast + lidar
   *   (front starboard), two cargo canisters crosswise in V-saddle cradles (aft).
   * ============================================================================================= */
  var GEOM = {
    wheelR: 0.065, wheelW: 0.050, axleY: 0.065, deckY: 0.225, modX: 0.215, modZ: 0.225, sweepR: 0.077,
    halfLen: 0.30, halfWid: 0.302, height: 0.58, collR: 0.33, suspTravel: 0.020,
    pad: { x: 0.19, y: 0.286, z: 0 },          // dock coupler reference: 11 mm under the copper face (y 0.297) so the pogos compress 4 mm
    slots: [{ x: -0.055, z: 0 }, { x: -0.212, z: 0 }],
    canister: { L: 0.26, D: 0.15 }
  };

  function initFusionRover(opts) {
    opts = opts || {};
    var roverGroup = opts.roverGroup;
    var wheelGroups = opts.wheelGroups || [];
    var wheels = opts.wheels || [];
    var root = new THREE.Group();
    root.name = 'aegisRoverAssembly';
    roverGroup.add(root);
    (opts.hide || []).forEach(function (o) { if (o) o.visible = false; });

    // ── materials (white thermal paint, graphite structure, anodised aluminium, one blue accent) ─────────
    var paintMap = paintTexture();
    var mPaint = new THREE.MeshPhysicalMaterial({ color: 0xf4f6f8, map: paintMap, roughness: 0.32, metalness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.06 });
    var mPaintShade = new THREE.MeshPhysicalMaterial({ color: 0xdfe4ea, roughness: 0.36, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.1 });
    var mBlue = new THREE.MeshPhysicalMaterial({ color: 0x0b4fb3, roughness: 0.28, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.1 });
    var mGraphite = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.5, metalness: 0.5 });
    var mGraphiteMatte = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.78, metalness: 0.25 });
    var mAlu = new THREE.MeshStandardMaterial({ color: 0xc9d1db, roughness: 0.28, metalness: 0.85 });
    var mAluDark = new THREE.MeshStandardMaterial({ color: 0x6f7a87, roughness: 0.34, metalness: 0.8 });
    var mSteel = new THREE.MeshStandardMaterial({ color: 0xaab2bc, roughness: 0.18, metalness: 0.95 });
    var mFoil = new THREE.MeshStandardMaterial({ color: 0xffffff, map: foilTexture(), roughness: 0.4, metalness: 0.6 });
    var mRubber = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.93, metalness: 0.02 });
    var mTire = new THREE.MeshStandardMaterial({ color: 0x1b1d22, map: treadTexture(), roughness: 0.88, metalness: 0.04 });
    var mSeal = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.9 });
    var mCopper = new THREE.MeshStandardMaterial({ color: 0xc27a2c, roughness: 0.3, metalness: 0.85 });
    var mLens = new THREE.MeshPhysicalMaterial({ color: 0x050b14, emissive: 0x0b66b8, emissiveIntensity: 0.45, roughness: 0.04, metalness: 0.4, clearcoat: 1 });
    var mGlass = new THREE.MeshPhysicalMaterial({ color: 0x0c1a2b, roughness: 0.05, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.85 });
    var mPcb = new THREE.MeshStandardMaterial({ color: 0x0f5a2e, roughness: 0.6, metalness: 0.2 });
    var mLedWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dd, emissiveIntensity: 2.2 });
    var mLedGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 2.0 });
    var mLedRed = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 2.2 });
    var mAmber = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.9 });
    var mDeck = new THREE.MeshStandardMaterial({ color: 0xffffff, map: diamondTexture(), roughness: 0.55, metalness: 0.4 });

    var fanRotors = [], headlights = [];
    var G = GEOM, DY = G.deckY, R = G.wheelR, AY = G.axleY;

    // =========================================================================
    // 1. STRUCTURE — belly tub, skid plate, deck, frame rails
    // =========================================================================
    var TUB_W = 0.276, TUB_L = 0.50, TUB_Y0 = 0.066, TUB_Y1 = 0.205;
    rbox(TUB_L, TUB_Y1 - TUB_Y0, TUB_W, 0.022, mGraphite, 0, (TUB_Y0 + TUB_Y1) / 2, 0, root, true);
    rbox(TUB_L - 0.06, 0.008, TUB_W - 0.04, 0.02, mAlu, 0, TUB_Y0 - 0.002, 0, root);                      // skid plate
    [1, -1].forEach(function (s) {                                                                           // sloped entry/exit skids
      var sk = rbox(0.06, 0.008, TUB_W - 0.05, 0.01, mAluDark, s * (TUB_L / 2 - 0.012), TUB_Y0 + 0.012, 0, root); sk.rotation.z = s * 0.45;
    });
    // tub side panels: white skin with louvred cooling grilles and the wordmark plate
    [1, -1].forEach(function (s) {
      rbox(TUB_L - 0.07, 0.090, 0.006, 0.012, mPaint, 0, 0.127, s * (TUB_W / 2 + 0.002), root, true);
      for (var lv = 0; lv < 7; lv++) rbox(0.006, 0.040, 0.004, 0.002, mGraphiteMatte, 0.10 + lv * 0.014, 0.128, s * (TUB_W / 2 + 0.006), root);
      rbox(0.14, 0.022, 0.003, 0.004, mBlue, -0.11, 0.150, s * (TUB_W / 2 + 0.006), root);
    });
    // deck: rounded white plate with a diamond-tread walkway between the cargo cradles
    rbox(0.58, 0.014, 0.52, 0.035, mPaint, 0, DY - 0.007, 0, root, true);
    rbox(0.30, 0.002, 0.30, 0.02, mDeck, -0.135, DY + 0.001, 0, root);
    [1, -1].forEach(function (s) {                                                                           // blue edge piping
      rbox(0.54, 0.006, 0.006, 0.003, mBlue, 0, DY - 0.010, s * 0.258, root);
    });
    // frame rails under the deck (aluminium extrusion) tying the modules into the tub
    [1, -1].forEach(function (s) {
      rbox(0.56, 0.018, 0.020, 0.003, mAluDark, 0, DY - 0.023, s * 0.205, root, true);
    });
    [-G.modX, 0, G.modX].forEach(function (mx) { rbox(0.020, 0.018, 0.40, 0.003, mAluDark, mx, DY - 0.023, 0, root); });

    // =========================================================================
    // 2. SWERVE MODULES — 6 x (in-hub drive gearmotor + 360 deg steering servo + coil-over)
    // =========================================================================
    var wheelDefs = [
      { id: 'FL', x: G.modX, z: G.modZ }, { id: 'ML', x: 0, z: G.modZ }, { id: 'BL', x: -G.modX, z: G.modZ },
      { id: 'FR', x: G.modX, z: -G.modZ }, { id: 'MR', x: 0, z: -G.modZ }, { id: 'BR', x: -G.modX, z: -G.modZ }
    ];
    wheelGroups.forEach(function (w) { if (w && w.group) w.group.visible = false; });
    wheels.forEach(function (t) { if (t) t.visible = false; });
    wheels.length = 0; wheelGroups.length = 0;
    var shockLinks = [];
    var tireGeo = new THREE.CylinderGeometry(R - 0.004, R - 0.004, G.wheelW, 48, 1);
    wheelDefs.forEach(function (wd) {
      // fixed to the deck: slewing bearing, steering servo + pinion, encoder / slip-ring cap
      var BY = DY - 0.034;
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.007, 10, 40), mAluDark); ring.rotation.x = Math.PI / 2; ring.position.set(wd.x, BY, wd.z); root.add(ring);
      cyl(0.050, 0.050, 0.010, mGraphite, wd.x, BY + 0.010, wd.z, root, null, 40, true);                   // bearing housing
      var sOff = (wd.x >= 0 ? -1 : 1) * 0.058;                                                               // servo sits inboard along X
      rbox(0.040, 0.038, 0.020, 0.004, mGraphite, wd.x + sOff, DY + 0.019, wd.z, root, true);              // steering servo body
      rbox(0.054, 0.004, 0.020, 0.002, mAluDark, wd.x + sOff, DY + 0.002, wd.z, root);                     // servo ears
      cyl(0.006, 0.006, 0.010, mSteel, wd.x + sOff, DY - 0.003, wd.z, root, null, 12);                      // spline
      gear(0.014, 12, 0.006, mSteel, wd.x + sOff * 0.62, BY + 0.002, wd.z, root);                          // pinion
      cyl(0.016, 0.016, 0.018, mAlu, wd.x, DY + 0.009, wd.z, root, null, 24, true);                         // slip-ring / encoder cap
      cyl(0.011, 0.011, 0.003, mPcb, wd.x, DY + 0.019, wd.z, root, null, 18);                               // AS5600 board
      cyl(0.004, 0.004, 0.002, mLedGreen, wd.x + 0.006, DY + 0.021, wd.z, root, null, 8);                   // module status LED

      // moving: wg rides the suspension (y), steer swivels (rotation.y, unlimited), spin turns the wheel
      var wg = new THREE.Group(); wg.position.set(wd.x, AY, wd.z);
      var steer = new THREE.Group(); wg.add(steer);
      // fork: crown + two legs straddling the wheel, a steering column up into the bearing
      rbox(0.064, 0.012, 0.086, 0.01, mAlu, 0, R + 0.016, 0, steer, true);
      [1, -1].forEach(function (s) {
        var leg = rbox(0.044, R + 0.020, 0.006, 0.012, mAlu, 0, (R + 0.020) / 2 + 0.002, s * 0.036, steer, true);
        rbox(0.020, 0.040, 0.007, 0.004, mAluDark, 0.012, 0.030, s * 0.036, steer);                         // lightening pocket insert
      });
      cyl(0.017, 0.017, 0.040, mAluDark, 0, R + 0.040, 0, steer, null, 24, true);                          // steering column
      gear(0.036, 36, 0.006, mSteel, 0, R + 0.058, 0, steer);                                               // ring gear (driven by the pinion)
      // in-hub drive: 37 mm gearmotor along the axle, gearbox bolted to one leg, encoder cap out the other
      cyl(0.0185, 0.0185, 0.074, mGraphite, 0, 0, 0, steer, 'z', 28, true);
      cyl(0.0125, 0.0125, 0.010, mAluDark, 0, 0, -0.042, steer, 'z', 20);
      cyl(0.008, 0.008, 0.004, mPcb, 0, 0, -0.047, steer, 'z', 14);
      var lEye = new THREE.Object3D(); lEye.name = 'axle-eye-' + wd.id; lEye.position.set(0, R + 0.022, 0); wg.add(lEye);   // on the steering axis
      // wheel: TPU tread with chevron grousers on a six-spoke machined rim
      var spin = new THREE.Group(); spin.rotation.x = Math.PI / 2; steer.add(spin);
      var tire = new THREE.Mesh(tireGeo, mTire); tire.castShadow = true; tire.receiveShadow = true; spin.add(tire);
      for (var gi = 0; gi < 24; gi++) {
        var a = gi / 24 * Math.PI * 2;
        [1, -1].forEach(function (half) {                                                                     // chevron = two angled blades
          var lug = new THREE.Mesh(new THREE.BoxGeometry(0.0055, G.wheelW * 0.5, 0.0075), mRubber);
          lug.position.set(Math.cos(a) * (R - 0.0038), half * G.wheelW * 0.25, Math.sin(a) * (R - 0.0038));   // grouser tips on the 65 mm radius
          lug.rotation.y = -a; lug.rotation.x = half * 0.42; tire.add(lug);
        });
      }
      [1, -1].forEach(function (s) {
        var bead = new THREE.Mesh(new THREE.TorusGeometry(R - 0.006, 0.0035, 8, 48), mRubber);
        bead.rotation.x = Math.PI / 2; bead.position.y = s * (G.wheelW / 2 - 0.002); tire.add(bead);
      });
      cyl(R - 0.016, R - 0.016, G.wheelW + 0.002, mAlu, 0, 0, 0, tire, null, 40);                            // rim barrel
      cyl(R - 0.022, R - 0.022, G.wheelW + 0.004, mGraphite, 0, 0, 0, tire, null, 36);                       // rim well
      for (var sp = 0; sp < 6; sp++) {
        var sa = sp / 6 * Math.PI * 2;
        [1, -1].forEach(function (s) {
          var spoke = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.006, 0.007), mAlu);
          spoke.position.set(Math.cos(sa) * 0.026, s * (G.wheelW / 2 - 0.001), Math.sin(sa) * 0.026); spoke.rotation.y = -sa; tire.add(spoke);
        });
      }
      cyl(0.021, 0.021, G.wheelW + 0.008, mBlue, 0, 0, 0, tire, null, 28);                                  // hub shell
      cyl(0.008, 0.008, G.wheelW + 0.012, mSteel, 0, 0, 0, tire, null, 14);                                 // axle cap
      root.add(wg);
      wheels.push(tire);
      wheelGroups.push({ group: wg, steer: steer, tire: tire, lowerEye: lEye, id: wd.id, localPos: new THREE.Vector3(wd.x, AY, wd.z), baseZ: wd.z });

      // coil-over strut on the steering axis: deck bearing → fork crown
      var uEye = new THREE.Object3D(); uEye.position.set(wd.x, BY - 0.004, wd.z); root.add(uEye);
      var rest = Math.max(0.02, (BY - 0.004) - (AY + R + 0.022));
      var shock = new THREE.Group(); shock.name = 'shock-' + wd.id;
      var R2 = rest / 2;
      cyl(0.0045, 0.0045, rest * 0.9, mSteel, 0, 0, 0, shock, null, 10);
      for (var c = 0; c < 4; c++) {
        var coil = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0022, 6, 20), mBlue);
        coil.rotation.x = Math.PI / 2; coil.position.y = -R2 + (c + 0.5) * (rest / 4); shock.add(coil);
      }
      shock.position.set(wd.x, (BY - 0.004 + AY + R + 0.022) / 2, wd.z);
      root.add(shock);
      shockLinks.push({ shock: shock, upper: uEye, lower: lEye, rest: rest });
    });
    global.shockLinks = shockLinks;

    // =========================================================================
    // 3. BELLY TUB INTERNALS — 5 Ah pack (hot-swap, centred, low), compute and drivers forward
    // =========================================================================
    var internals = new THREE.Group(); internals.name = 'internals'; root.add(internals);
    rbox(0.085, 0.006, 0.056, 0.004, mPcb, 0.165, 0.150, 0.07, internals);                               // Raspberry Pi 5
    cyl(0.018, 0.018, 0.008, mGraphite, 0.165, 0.158, 0.07, internals, null, 20);                         // active cooler
    var piFan = new THREE.Group(); piFan.position.set(0.165, 0.163, 0.07); internals.add(piFan);
    for (var fb = 0; fb < 7; fb++) { var bl = box(0.014, 0.001, 0.004, mAluDark, 0.006, 0, 0, piFan); bl.rotation.y = fb / 7 * Math.PI * 2; }
    fanRotors.push(piFan);
    rbox(0.101, 0.006, 0.053, 0.004, mPcb, 0.165, 0.150, -0.07, internals);                              // Arduino Mega 2560
    [-0.015, 0.025, 0.065].forEach(function (z, k) { rbox(0.065, 0.022, 0.095 * 0.6, 0.004, mGraphite, 0.205, 0.095, z - 0.025, internals); });   // 3 x MDD10A
    rbox(0.062, 0.010, 0.025, 0.003, mPcb, 0.11, 0.150, -0.105, internals);                               // PCA9685 servo driver
    rbox(0.066, 0.018, 0.036, 0.004, mGraphite, 0.11, 0.150, 0.105, internals);                           // 12 V → 5 V buck

    // ── BATTERY BAY: hot-swap pack in the centre of the tub; drop-down door on the aft face, pack on a sled ──
    var BAY_W = 0.110, BAY_H = 0.090, BAY_Y0 = 0.078, HOME_X = 0.02;
    rbox(0.006, BAY_H + 0.016, BAY_W + 0.016, 0.006, mGraphiteMatte, -TUB_L / 2 - 0.001, BAY_Y0 + BAY_H / 2, 0, root);
    var batDoor = new THREE.Group(); batDoor.name = 'batteryDoor'; batDoor.position.set(-TUB_L / 2 - 0.006, BAY_Y0, 0); root.add(batDoor);
    rbox(0.006, BAY_H, BAY_W, 0.008, mPaint, 0, BAY_H / 2, 0, batDoor, true);
    rbox(0.007, 0.010, BAY_W - 0.02, 0.003, mBlue, -0.001, BAY_H - 0.012, 0, batDoor);
    cyl(0.004, 0.004, BAY_W + 0.010, mAluDark, 0, 0, 0, batDoor, 'z', 10);
    var batLatches = [];
    [-1, 1].forEach(function (sz) {
      var lt = new THREE.Group(); lt.position.set(-0.004, BAY_H - 0.024, sz * (BAY_W / 2 - 0.016)); batDoor.add(lt);
      cyl(0.008, 0.008, 0.005, mAluDark, 0, 0, 0, lt, 'x', 14);
      box(0.006, 0.005, 0.022, mAmber, -0.003, 0, 0, lt);
      batLatches.push(lt);
    });
    var batPack = new THREE.Group(); batPack.name = 'batteryPack'; batPack.position.set(HOME_X, 0.122, 0); root.add(batPack);
    rbox(0.107, 0.070, 0.090, 0.008, mGraphite, 0, 0, 0, batPack, true);                                 // 12.8 V 5 Ah LiFePO4 (107 x 90 x 70)
    rbox(0.070, 0.002, 0.060, 0.004, mBlue, 0, 0.036, 0, batPack);
    rbox(0.115, 0.006, 0.100, 0.004, mAluDark, 0, -0.038, 0, batPack);                                   // sled
    rbox(0.012, 0.022, 0.050, 0.004, mAlu, -0.060, 0.004, 0, batPack);                                   // pull handle
    var packLedMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 2.0 });
    box(0.003, 0.008, 0.060, packLedMat, -0.055, 0.024, 0, batPack);
    global.batteryBay = {
      door: batDoor, pack: batPack, latches: batLatches, led: packLedMat,
      set: function (open, ext, soc, latch) {
        batDoor.rotation.z = open * 1.52;
        batPack.position.x = HOME_X + (global.batteryBay.ballast || 0) - ext * 0.36;   // ballast shift on the lead screw
        var lq = latch == null ? 1 - open : latch;
        batLatches.forEach(function (lt) { lt.rotation.x = (1 - lq) * 1.5708; });
        if (soc != null) {
          var col = soc > 0.5 ? 0x22c55e : soc > 0.25 ? 0xf59e0b : 0xef4444;
          packLedMat.color.setHex(col); packLedMat.emissive.setHex(soc > 0.5 ? 0x16a34a : soc > 0.25 ? 0xd97706 : 0xb91c1c);
        }
      }
    };
    global.batteryBay.set(0, 0, 0.8, 1);

    // tub nose: headlights + ToF + bumper, tub tail: tail lights + charge port
    var NOSE = TUB_L / 2;
    rbox(0.012, 0.030, TUB_W + 0.02, 0.008, mAluDark, NOSE + 0.006, 0.085, 0, root, true);              // bumper bar
    [-0.10, 0.10].forEach(function (z) {
      rbox(0.008, 0.020, 0.050, 0.006, mGlass, NOSE + 0.003, 0.150, z, root);
      var hl = rbox(0.004, 0.012, 0.040, 0.004, mLedWhite, NOSE + 0.007, 0.150, z, root);
      headlights.push(hl);
    });
    cyl(0.008, 0.009, 0.010, mLens, NOSE + 0.005, 0.120, 0, root, 'x', 16);                               // front ToF
    [-0.10, 0.10].forEach(function (z) { rbox(0.006, 0.012, 0.050, 0.004, mLedRed, -NOSE - 0.004, 0.172, z, root); });
    cyl(0.009, 0.009, 0.010, mGraphite, -NOSE - 0.004, 0.172, 0, root, 'x', 14);

    // =========================================================================
    // 4. AVIONICS POD (front deck) with the dock charge pad on its roof
    // =========================================================================
    var upperShell = new THREE.Group(); upperShell.name = 'upperShell'; root.add(upperShell);
    var avLid = new THREE.Group(); avLid.name = 'avLidGroup'; avLid.position.set(0.115, DY + 0.060, 0); upperShell.add(avLid);   // hinged at its aft edge
    rbox(0.155, 0.058, 0.200, 0.024, mPaint, 0.19, DY + 0.029, 0, upperShell, true);
    rbox(0.004, 0.030, 0.150, 0.004, mGraphiteMatte, 0.268, DY + 0.030, 0, upperShell);                    // front vent
    for (var vk = 0; vk < 5; vk++) rbox(0.003, 0.003, 0.140, 0.001, mAluDark, 0.271, DY + 0.018 + vk * 0.006, 0, upperShell);
    var P = G.pad;
    rbox(0.140, 0.008, 0.170, 0.014, mGraphite, P.x - 0.115, 0.004, 0, avLid, true);                       // pad base (lid)
    [-0.045, 0.045].forEach(function (z) { rbox(0.110, 0.004, 0.030, 0.003, mCopper, P.x - 0.115, 0.010, z, avLid); });
    rbox(0.016, 0.003, 0.070, 0.002, mLedGreen, P.x - 0.115 + 0.060, 0.009, 0, avLid);
    [1, -1].forEach(function (s) {                                                                          // coupler guide lips
      var lip = rbox(0.140, 0.014, 0.006, 0.003, mBlue, P.x - 0.115, 0.012, s * 0.086, avLid); lip.rotation.x = -s * 0.5;
    });
    var antenna = cyl(0.003, 0.003, 0.090, mGraphite, 0.255, DY + 0.105, 0.085, upperShell, null, 8);
    cyl(0.006, 0.006, 0.010, mAluDark, 0.255, DY + 0.063, 0.085, upperShell, null, 12);

    // =========================================================================
    // 5. SENSOR MAST (front starboard): stereo pair + YDLIDAR X2L on top (top of lidar = 0.556 m)
    // =========================================================================
    var mast = new THREE.Group(); mast.name = 'sensorMast'; mast.position.set(0.235, DY, -0.205); root.add(mast);
    cyl(0.020, 0.024, 0.012, mAluDark, 0, 0.006, 0, mast, null, 24, true);
    cyl(0.011, 0.011, 0.262, mAlu, 0, 0.140, 0, mast, null, 20, true);
    rbox(0.026, 0.026, 0.086, 0.008, mGraphite, 0.010, 0.258, 0, mast, true);                             // stereo bar
    [-0.032, 0.032].forEach(function (z) { cyl(0.007, 0.008, 0.012, mLens, 0.026, 0.258, z, mast, 'x', 16); });
    cyl(0.032, 0.030, 0.028, mGraphite, 0, 0.286, 0, mast, null, 32, true);                               // lidar base (X2L Φ60)
    var lidarHead = new THREE.Group(); lidarHead.position.set(0, 0.318, 0); mast.add(lidarHead);
    cyl(0.028, 0.030, 0.034, mGraphiteMatte, 0, 0, 0, lidarHead, null, 32, true);
    rbox(0.014, 0.012, 0.018, 0.003, mLens, 0.026, 0.002, 0, lidarHead);
    cyl(0.024, 0.024, 0.004, mAlu, 0, 0.019, 0, lidarHead, null, 28);

    // =========================================================================
    // 6. CARGO CRADLES (aft deck): canisters lie crosswise in V-saddles; trunnion hooks latch them
    // =========================================================================
    var cargoBay = new THREE.Group(); cargoBay.position.set(0, 0, 0); root.add(cargoBay);
    var CAN = G.canister, CR = CAN.D / 2, SEAT_Y = DY + CR + 0.004;
    global.cargoBaySlots = [];
    G.slots.forEach(function (sl) {
      [1, -1].forEach(function (s) {                                                                         // V-saddle end frames
        var zc = s * (CAN.L / 2 - 0.035);
        rbox(0.130, 0.010, 0.026, 0.004, mAluDark, sl.x, DY + 0.005, zc, cargoBay, true);                    // foot
        [1, -1].forEach(function (k) {                                                                       // the two V flanks, tangent at ±36 deg
          var AL = 0.62, nx = k * Math.sin(AL), ny = -Math.cos(AL);                                          // outward normal at the contact
          var cx = sl.x + CR * nx, cy = SEAT_Y + CR * ny;                                                     // contact point on the canister
          var pad = rbox(0.046, 0.005, 0.022, 0.002, mRubber, cx + nx * 0.0026, cy + ny * 0.0026, zc, cargoBay); pad.rotation.z = k * AL;
          var flank = rbox(0.052, 0.012, 0.024, 0.004, mAlu, cx + nx * 0.0112, cy + ny * 0.0112, zc, cargoBay, true); flank.rotation.z = k * AL;
        });
        // trunnion hook post at the canister end: rotary latch closes over the trunnion pin
        var px = sl.x, pz = s * (CAN.L / 2 + 0.018);
        rbox(0.026, SEAT_Y - DY + 0.012, 0.010, 0.004, mGraphite, px, (SEAT_Y + DY) / 2 + 0.006, pz, cargoBay, true);
        cyl(0.009, 0.009, 0.014, mBlue, px, SEAT_Y + 0.012, pz, cargoBay, 'z', 16);                          // latch actuator
      });
      var slot = new THREE.Object3D(); slot.position.set(sl.x, SEAT_Y, sl.z); slot.rotation.y = Math.PI / 2; cargoBay.add(slot);
      // latch hooks shown closed while a canister is seated (the simulator toggles userData.ties)
      var ties = [];
      [1, -1].forEach(function (s) {
        var hook = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 8, 16, Math.PI), mBlue);
        hook.position.set(s * (CAN.L / 2 + 0.010), 0.004, 0); hook.rotation.y = Math.PI / 2; hook.visible = false; slot.add(hook); ties.push(hook);
      });
      slot.userData.ties = ties;
      global.cargoBaySlots.push(slot);
    });
    global.cargoBayGroup = cargoBay; window.cargoBayGroup = cargoBay;
    var cargoLid = new THREE.Group(); cargoLid.name = 'cargoLidGroup'; root.add(cargoLid);                  // (kept for the viewer API)

    // =========================================================================
    // 7. GRABBER ARM — turret (front port), shoulder, elbow, parallel gripper + eye-in-hand camera.
    //    Stows folded back over the deck (yaw pi) so the whole rover stays inside the 24 in cube.
    // =========================================================================
    var L1 = 0.28, L2 = 0.25;
    var armBase = new THREE.Group(); armBase.position.set(0.200, DY, 0.180); root.add(armBase);
    cyl(0.036, 0.040, 0.010, mAluDark, 0, 0.005, 0, armBase, null, 32);
    for (var bi = 0; bi < 8; bi++) { var ba = bi / 8 * Math.PI * 2; cyl(0.003, 0.003, 0.004, mSteel, Math.cos(ba) * 0.032, 0.012, Math.sin(ba) * 0.032, armBase, null, 8); }
    cyl(0.028, 0.031, 0.030, mPaint, 0, 0.025, 0, armBase, null, 32, true);
    cyl(0.0295, 0.0295, 0.007, mFoil, 0, 0.032, 0, armBase, null, 32);
    cyl(0.022, 0.022, 0.010, mBlue, 0, 0.044, 0, armBase, null, 28);
    var shoulder = new THREE.Group(); shoulder.position.set(0, 0.062, 0); armBase.add(shoulder);
    rbox(0.040, 0.046, 0.058, 0.010, mPaint, 0, -0.004, 0, shoulder, true);
    cyl(0.026, 0.026, 0.074, mAluDark, 0, 0, 0, shoulder, 'z', 32, true);
    cyl(0.018, 0.018, 0.080, mBlue, 0, 0, 0, shoulder, 'z', 28);
    rbox(L1 - 0.03, 0.032, 0.030, 0.010, mPaint, L1 * 0.5, 0, 0, shoulder, true);
    rbox(L1 - 0.07, 0.010, 0.034, 0.004, mGraphite, L1 * 0.5, -0.016, 0, shoulder);
    rbox(L1 - 0.09, 0.005, 0.034, 0.002, mBlue, L1 * 0.5, 0.017, 0, shoulder);
    var elbow = new THREE.Group(); elbow.position.set(L1, 0, 0); shoulder.add(elbow);
    cyl(0.023, 0.023, 0.064, mAluDark, 0, 0, 0, elbow, 'z', 32, true);
    cyl(0.016, 0.016, 0.070, mBlue, 0, 0, 0, elbow, 'z', 28);
    cyl(0.007, 0.007, 0.074, mSteel, 0, 0, 0, elbow, 'z', 12);
    rbox(L2 - 0.045, 0.027, 0.025, 0.009, mPaint, L2 * 0.5 - 0.005, 0, 0, elbow, true);
    rbox(L2 - 0.075, 0.009, 0.028, 0.004, mGraphite, L2 * 0.5 - 0.005, -0.013, 0, elbow);
    cyl(0.017, 0.017, 0.046, mAluDark, L2, 0, 0, elbow, 'z', 24, true);
    var wrist = new THREE.Group(); wrist.position.set(L2, 0, 0); elbow.add(wrist);
    cyl(0.015, 0.015, 0.024, mAluDark, -0.010, 0, 0, wrist, 'x', 24, true);
    rbox(0.028, 0.030, 0.028, 0.006, mGraphite, 0.012, 0, 0, wrist, true);
    function jaw(sgn) {
      var f = new THREE.Group();
      rbox(0.062, 0.014, 0.007, 0.003, mAlu, 0.016, 0, 0, f, true);
      var hook = rbox(0.018, 0.016, 0.007, 0.003, mAlu, 0.060, 0, -sgn * 0.009, f); hook.rotation.y = -sgn * 0.5;
      rbox(0.044, 0.011, 0.004, 0.002, mRubber, 0.030, 0, -sgn * 0.0055, f);
      rbox(0.012, 0.018, 0.006, 0.003, mBlue, -0.010, 0, sgn * 0.003, f);
      return f;
    }
    var fingerL = jaw(-1); fingerL.position.set(0.012, 0, -0.055);
    var fingerR = jaw(1); fingerR.position.set(0.012, 0, 0.055);
    wrist.add(fingerL, fingerR);
    var STOW = { yaw: Math.PI, sh: 1.25, el: -2.6 };
    armBase.rotation.y = STOW.yaw; shoulder.rotation.z = STOW.sh; elbow.rotation.z = STOW.el;
    var tip = new THREE.Object3D(); tip.position.set(0.03, 0, 0); wrist.add(tip);
    var gcBracket = new THREE.Group(); gcBracket.name = 'grabberCamBracket'; gcBracket.position.set(0.010, 0.024, 0);
    rbox(0.020, 0.014, 0.022, 0.004, mGraphite, 0, 0, 0, gcBracket, true);
    cyl(0.0055, 0.0055, 0.004, mLens, 0.012, 0, 0, gcBracket, 'x', 14);
    gcBracket.rotation.z = -0.42; wrist.add(gcBracket);
    var grabberCam = new THREE.PerspectiveCamera(62, 320 / 240, 0.02, 25);
    grabberCam.name = 'aiGrabberCamera'; grabberCam.position.set(0.022, 0.032, 0);
    grabberCam.rotation.order = 'YXZ'; grabberCam.rotation.set(0, -Math.PI / 2, -0.45);
    wrist.add(grabberCam); global.grabberCamera = grabberCam; window.grabberCamera = grabberCam;

    // =========================================================================
    // 8. DETAILS — guarded E-stop (aft port deck corner), status light bar, CoM marker
    // =========================================================================
    var EX = -0.255, EZ = 0.215;
    rbox(0.040, 0.012, 0.040, 0.006, mGraphite, EX, DY + 0.006, EZ, root);
    cyl(0.014, 0.012, 0.012, mLedRed, EX, DY + 0.018, EZ, root, null, 24);
    rbox(0.006, 0.006, 0.36, 0.003, mLedWhite, 0.268, DY - 0.006, 0, root);                               // forward light strip
    var com = (global.NASA_RoverBOM && NASA_RoverBOM.com) ? NASA_RoverBOM.com() : { x: 0, y: 0.15 };
    var comMarker = new THREE.Group(); comMarker.position.set(com.x || 0, (com.y || 0.15) + 0.20, 0); root.add(comMarker);
    cyl(0.026, 0.026, 0.003, mAmber, 0, 0, 0, comMarker, null, 24);
    box(0.060, 0.004, 0.004, mBlue, 0, 0, 0, comMarker); box(0.004, 0.004, 0.060, mBlue, 0, 0, 0, comMarker);
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
    global.ROVER_GEOM = GEOM;
    window.roverArm = {
      base: armBase, shoulder: shoulder, elbow: elbow, wrist: wrist,
      gripper: wrist, fingerL: fingerL, fingerR: fingerR, tip: tip,
      grabberCam: grabberCam, grabberBracket: gcBracket, L1: L1, L2: L2, stow: STOW
    };
    root.userData.internals = internals;

    /* motion rig for the CAD pages (the simulator runs its own physics and drives the same groups)
       roll(d)         spin all tyres for d metres of travel
       setTravel(a)    per-wheel suspension travel (m, + = wheel up), clamped ±30 mm
       setSteer(a)     per-module steering angle (rad, unlimited)
       updateShocks()  re-aim / re-length each coil-over between the deck bearing and the fork crown */
    var _up = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
    var finishes = {
      flight: { paint: 0xf4f6f8, shade: 0xdfe4ea, map: paintMap, rough: 0.32, clear: 1.0 },
      petg: { paint: 0x1c1f24, shade: 0x2a2e35, map: null, rough: 0.46, clear: 0.35 }
    };
    var rig = {
      root: root, wheelGroups: wheelGroups, tires: wheels, R: R, finish: 'flight', geom: GEOM,
      roll: function (d) { for (var i = 0; i < wheels.length; i++) wheels[i].rotation.y -= d / R; },
      setTravel: function (arr) {
        for (var i = 0; i < wheelGroups.length; i++) {
          var tr = arr ? (arr[i] || 0) : 0;
          wheelGroups[i].group.position.y = AY + Math.max(-0.03, Math.min(0.03, tr));
        }
        rig.updateShocks();
      },
      setSteer: function (arr) { for (var i = 0; i < wheelGroups.length; i++) wheelGroups[i].steer.rotation.y = arr ? (arr[i] || 0) : 0; },
      updateShocks: function () {
        for (var i = 0; i < shockLinks.length; i++) {
          var L = shockLinks[i], par = L.shock.parent; if (!par) continue;
          L.upper.getWorldPosition(_a); L.lower.getWorldPosition(_b); par.worldToLocal(_a); par.worldToLocal(_b);
          var dx = _a.x - _b.x, dy = _a.y - _b.y, dz = _a.z - _b.z, len = Math.max(0.01, Math.sqrt(dx * dx + dy * dy + dz * dz));
          _d.x = dx / len; _d.y = dy / len; _d.z = dz / len;
          L.shock.position.set((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2);
          L.shock.quaternion.setFromUnitVectors(_up, _d);
          L.shock.scale.set(1, len / (L.rest || 0.03), 1);
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
    return { chL: 2 * GEOM.halfLen, chW: 2 * GEOM.halfWid };
  }

  global.NASA_FusionRover = {
    init: initFusionRover, GEOM: GEOM,
    loadManifest: function () {
      return Promise.resolve({ roverRadius: GEOM.collR, modelCenter: { x: 0, y: 0, z: 0 } });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
