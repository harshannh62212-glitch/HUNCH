/**
 * NASA HUNCH LLASO — AEGIS-V1 Autonomous Lunar AMR Rover 3D Assembly
 * Engineering CAD Digital Twin matching template orthographic views:
 * - Monocoque Polymaker Black PETG chassis with embossed "AEGIS" side flanks
 * - 6-wheel chevron locomotion with deep-dish rims & brass M3 lug nuts
 * - 3 transverse axle tubes underneath with central chassis mounting clamps
 * - 6 vertical wheel drop yokes & Greartisan 12V 100RPM 37mm gear motors
 * - Front deck articulated robotic arm with spherical shoulder & 2-prong claw
 * - Perception mast with spinning EC Buying YDLIDAR X2L 360° & stereo cameras
 * - Front face rectangular stereo perception aperture & round sensor port
 * - Recessed cargo hopper bed with standardized NASA HUNCH container
 * - Full internal avionics bay (GOLDENMATE 12V LiFePO4, Pi 5, Arduino Uno R3,
 *   Buck converter, Cytron MDD10A, 6x 3007 cooling fans).
 */
(function (global) {
  var MESH_BASE = 'meshes/fusion_rover/';

  // Procedural Texture Generators
  function createPetgTexture() {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    var c = cv.getContext('2d');
    c.fillStyle = '#141720'; c.fillRect(0, 0, 512, 512);
    // 0.2mm FDM layer lines
    for (var y = 0; y < 512; y += 3) {
      var s = 22 + Math.sin(y * 1.8) * 4 + (Math.random() - 0.5) * 4;
      c.fillStyle = 'rgb(' + Math.round(s) + ',' + Math.round(s + 1) + ',' + Math.round(s + 4) + ')';
      c.fillRect(0, y, 512, 1.8);
    }
    // Carbon/PETG 45-degree diagonal infill weave
    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 1.0;
    for (var d = -512; d < 1024; d += 8) {
      c.beginPath(); c.moveTo(d, 0); c.lineTo(d + 512, 512); c.stroke();
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 3);
    return tex;
  }

  function createWheelTreadTexture() {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    var c = cv.getContext('2d');
    c.fillStyle = '#262a34'; c.fillRect(0, 0, 512, 512);
    c.strokeStyle = '#3d4452'; c.lineWidth = 14;
    for (var y = -64; y < 576; y += 48) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(256, y + 36);
      c.lineTo(512, y);
      c.stroke();
    }
    c.fillStyle = 'rgba(203,213,225,0.18)';
    for (var i = 0; i < 400; i++) {
      c.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 4);
    return tex;
  }

  function createGoldenmateTexture() {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    var c = cv.getContext('2d');
    c.fillStyle = '#0f172a'; c.fillRect(0, 0, 512, 256);
    var grad = c.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#0284c7'); grad.addColorStop(0.5, '#06b6d4'); grad.addColorStop(1, '#f59e0b');
    c.fillStyle = grad; c.fillRect(0, 0, 512, 48);
    c.fillStyle = '#ffffff'; c.font = 'bold 28px sans-serif';
    c.fillText('GOLDENMATE', 18, 35);
    c.font = 'bold 20px monospace';
    c.fillText('12V 10Ah • 128Wh • LiFePO4', 18, 90);
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText('Deep Cycle • Built-in Smart BMS • IP67', 18, 120);
    c.fillText('Continuous Discharge: 10A (Peak 20A)', 18, 142);
    c.fillText('Charge Voltage: 14.4V - 14.6V', 18, 164);
    c.strokeStyle = '#334155'; c.strokeRect(18, 185, 160, 22);
    c.fillStyle = '#22c55e';
    for (var seg = 0; seg < 4; seg++) c.fillRect(22 + seg * 31, 189, 27, 14);
    c.fillStyle = '#e2e8f0'; c.font = 'bold 12px sans-serif';
    c.fillText('BMS STATE: 82% CHARGED', 190, 201);
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  function createArduinoTexture() {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 384;
    var c = cv.getContext('2d');
    c.fillStyle = '#008784'; c.fillRect(0, 0, 512, 384);
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 2.0;
    c.strokeRect(12, 12, 488, 360);
    c.fillStyle = '#ffffff'; c.font = 'bold 26px sans-serif';
    c.fillText('ARDUINO', 28, 48);
    c.font = 'bold 16px sans-serif';
    c.fillText('UNO REV3 [A000066]', 28, 72);
    c.font = '12px monospace';
    c.fillText('ATmega328P • 16MHz • PWM MOTOR CONTROLLER', 28, 96);
    c.fillStyle = '#1e293b'; c.fillRect(180, 140, 200, 60);
    c.fillStyle = '#64748b';
    for (var p = 0; p < 14; p++) {
      c.fillRect(190 + p * 13, 134, 6, 6);
      c.fillRect(190 + p * 13, 200, 6, 6);
    }
    c.fillStyle = '#cbd5e1'; c.font = 'bold 11px monospace';
    c.fillText('ATMEGA328P-PU', 230, 175);
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  function createPi5Texture() {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 384;
    var c = cv.getContext('2d');
    c.fillStyle = '#15803d'; c.fillRect(0, 0, 512, 384);
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.5;
    c.strokeRect(8, 8, 496, 368);
    c.fillStyle = '#ffffff'; c.font = 'bold 24px sans-serif';
    c.fillText('Raspberry Pi 5', 24, 42);
    c.font = 'bold 14px monospace';
    c.fillText('Broadcom BCM2712 Quad Cortex-A76 @ 2.4GHz', 24, 66);
    c.font = '12px sans-serif';
    c.fillText('SANOOV Active Cooler Equipped • 4GB LPDDR4X', 24, 88);
    c.fillStyle = '#0f172a'; c.fillRect(190, 130, 110, 110);
    c.fillStyle = '#94a3b8'; c.font = 'bold 10px monospace';
    c.fillText('BCM2712', 220, 185);
    c.fillStyle = '#1e293b'; c.fillRect(320, 145, 80, 80);
    c.fillStyle = '#cbd5e1'; c.fillText('4GB RAM', 335, 190);
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  function createBuckTexture() {
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    var c = cv.getContext('2d');
    c.fillStyle = '#334155'; c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#0f172a'; c.fillRect(10, 10, 236, 108);
    c.fillStyle = '#f59e0b'; c.font = 'bold 16px sans-serif';
    c.fillText('YRDZXG BUCK STEP-DOWN', 20, 36);
    c.fillStyle = '#e2e8f0'; c.font = '12px monospace';
    c.fillText('IN: DC 12V/24V (8V-40V)', 20, 62);
    c.fillText('OUT: DC 5V 5A (25W MAX)', 20, 82);
    c.fillStyle = '#22c55e'; c.fillText('SYNC RECTIFICATION • 96%', 20, 102);
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  function initFusionRover(opts) {
    opts = opts || {};
    var roverGroup = opts.roverGroup;
    var hide = opts.hide || [];
    var wheelGroups = opts.wheelGroups || [];
    var wheels = opts.wheels || [];

    // Hide old objects
    hide.forEach(function (o) {
      if (o) o.visible = false;
    });
    if (opts.cargoBayGroup) opts.cargoBayGroup.visible = false;
    if (opts.armBase) opts.armBase.visible = false;
    if (opts.mastGroup) opts.mastGroup.visible = false;

    var root = new THREE.Group();
    root.name = 'aegisRoverAssembly';
    roverGroup.add(root);

    // Textures & Materials
    var petgTex = (typeof global.createPetgTex === 'function') ? global.createPetgTex(true) : createPetgTexture();
    var wheelTex = (typeof global.createWheelTreadTex === 'function') ? global.createWheelTreadTex() : createWheelTreadTexture();
    var batTex = (typeof global.createGoldenmateBatTex === 'function') ? global.createGoldenmateBatTex() : createGoldenmateTexture();
    var unoTex = (typeof global.createArduinoUnoTex === 'function') ? global.createArduinoUnoTex() : createArduinoTexture();
    var piTex = (typeof global.createPi5BoardTex === 'function') ? global.createPi5BoardTex() : createPi5Texture();
    var buckTex = (typeof global.createBuckConverterTex === 'function') ? global.createBuckConverterTex() : createBuckTexture();

    var matChassis = new THREE.MeshStandardMaterial({
      color: 0x181c26,
      map: petgTex,
      roughness: 0.50,
      metalness: 0.35
    });
    var matChassisTrim = new THREE.MeshStandardMaterial({
      color: 0x242a38,
      roughness: 0.42,
      metalness: 0.48
    });
    var matAlloy = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.20,
      metalness: 0.92
    });
    var matDarkAlloy = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.30,
      metalness: 0.85
    });
    var matArtemisBlue = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.22,
      metalness: 0.90
    });
    var matBrass = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.22,
      metalness: 0.94
    });
    var matGoldFoil = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.32,
      metalness: 0.88
    });
    var matTire = new THREE.MeshStandardMaterial({
      color: 0x242832,
      map: wheelTex,
      roughness: 0.80,
      metalness: 0.30
    });
    var matLens = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      roughness: 0.05,
      metalness: 0.95
    });
    var matAmber = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.9,
      roughness: 0.28
    });
    var matGreenLed = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 2.0,
      roughness: 0.18
    });
    var matWireRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.42 });
    var matWireBlk = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.48 });

    var fanRotors = [];
    var headlights = [];

    // =========================================================================
    // 1. LOWER MONOCOQUE CHASSIS TUB & UNDERBODY SKID (Template Images 1, 2, 3, 5)
    // =========================================================================
    var lowerTub = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.14, 0.52),
      matChassis
    );
    lowerTub.position.set(0, 0.13, 0);
    lowerTub.castShadow = true; lowerTub.receiveShadow = true;
    root.add(lowerTub);

    // Front & Rear Underbody Approach Skid Plates
    var frontSkid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.48), matAlloy);
    frontSkid.position.set(0.42, 0.065, 0); frontSkid.rotation.z = 0.36;
    root.add(frontSkid);
    var rearSkid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.48), matAlloy);
    rearSkid.position.set(-0.42, 0.065, 0); rearSkid.rotation.z = -0.36;
    root.add(rearSkid);

    // Perimeter M3/M4 Brass Heat-Set Threaded Inserts
    for (var bx = -0.36; bx <= 0.37; bx += 0.145) {
      [-0.245, 0.245].forEach(function (bz) {
        var boss = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.012, 0.02, 10), matChassisTrim);
        boss.position.set(bx, 0.20, bz);
        var insert = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.022, 10), matBrass);
        insert.position.set(bx, 0.202, bz);
        root.add(boss, insert);
      });
    }

    // =========================================================================
    // 2. EMBOSSED "AEGIS" NAMEPLATES ON BOTH SIDE FLANKS (Matching Template Image 1)
    // Placed at y = 0.21, perfectly above wheel tops and clearly visible!
    // =========================================================================
    function create3DLetter(char, mat) {
      var g = new THREE.Group();
      var w = 0.042, h = 0.054, t = 0.008, d = 0.007;
      function b(bw, bh, bd, x, y, z) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        g.add(m);
        return m;
      }
      if (char === 'A') {
        b(t, h, d, -w / 2 + t / 2, 0, 0);
        b(t, h, d, w / 2 - t / 2, 0, 0);
        b(w, t, d, 0, h / 2 - t / 2, 0);
        b(w - t, t, d, 0, -0.004, 0);
      } else if (char === 'E') {
        b(t, h, d, -w / 2 + t / 2, 0, 0);
        b(w, t, d, 0, h / 2 - t / 2, 0);
        b(w * 0.75, t, d, -w * 0.125, 0, 0);
        b(w, t, d, 0, -h / 2 + t / 2, 0);
      } else if (char === 'G') {
        b(t, h, d, -w / 2 + t / 2, 0, 0);
        b(w, t, d, 0, h / 2 - t / 2, 0);
        b(w, t, d, 0, -h / 2 + t / 2, 0);
        b(t, h * 0.5, d, w / 2 - t / 2, -h * 0.25 + t / 2, 0);
        b(w * 0.5, t, d, w * 0.25, 0, 0);
      } else if (char === 'I') {
        b(t * 1.2, h, d, 0, 0, 0);
        b(w * 0.8, t, d, 0, h / 2 - t / 2, 0);
        b(w * 0.8, t, d, 0, -h / 2 + t / 2, 0);
      } else if (char === 'S') {
        b(w, t, d, 0, h / 2 - t / 2, 0);
        b(t, h * 0.5, d, -w / 2 + t / 2, h * 0.25 - t / 2, 0);
        b(w, t, d, 0, 0, 0);
        b(t, h * 0.5, d, w / 2 - t / 2, -h * 0.25 + t / 2, 0);
        b(w, t, d, 0, -h / 2 + t / 2, 0);
      }
      return g;
    }

    var matAegisLetter = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      roughness: 0.15,
      metalness: 0.92
    });
    var matBadgeBack = new THREE.MeshStandardMaterial({
      color: 0x090c12,
      roughness: 0.35,
      metalness: 0.70
    });

    [-1, 1].forEach(function (sideSign) {
      var badgeGroup = new THREE.Group();
      badgeGroup.position.set(0, 0.210, sideSign * 0.264);
      if (sideSign < 0) badgeGroup.rotation.y = Math.PI;

      // Inset plaque plate
      var plaque = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.082, 0.006), matBadgeBack);
      plaque.receiveShadow = true;
      badgeGroup.add(plaque);

      // Artemis blue border frame
      var frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.005, 0.008), matArtemisBlue);
      frameTop.position.set(0, 0.040, 0.002);
      var frameBot = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.005, 0.008), matArtemisBlue);
      frameBot.position.set(0, -0.040, 0.002);
      badgeGroup.add(frameTop, frameBot);

      // 5 Raised 3D Letters: A - E - G - I - S
      var letters = ['A', 'E', 'G', 'I', 'S'];
      var spacing = 0.068;
      for (var li = 0; li < letters.length; li++) {
        var letterMesh = create3DLetter(letters[li], matAegisLetter);
        letterMesh.position.set(-0.136 + li * spacing, 0, 0.004);
        badgeGroup.add(letterMesh);
      }
      root.add(badgeGroup);
    });

    // =========================================================================
    // 3. 3 TRANSVERSE AXLE TUBES WITH CENTRAL CHASSIS CLAMPS (Matching Template Image 5)
    // =========================================================================
    var axleXPositions = [0.38, 0.00, -0.38];
    axleXPositions.forEach(function (ax) {
      var transverseTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.68, 20),
        matAlloy
      );
      transverseTube.rotation.x = Math.PI / 2;
      transverseTube.position.set(ax, 0.080, 0);
      transverseTube.castShadow = true;
      root.add(transverseTube);

      // Heavy CNC-machined central mounting collar clamp (Template Image 5)
      var centerClamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.046, 0.036, 0.048),
        matDarkAlloy
      );
      centerClamp.position.set(ax, 0.084, 0);
      centerClamp.castShadow = true;
      root.add(centerClamp);

      // 2 Brass M4 clamping bolts
      [-0.015, 0.015].forEach(function (cz) {
        var clampBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.040, 8), matBrass);
        clampBolt.position.set(ax, 0.086, cz);
        root.add(clampBolt);
      });
    });

    // =========================================================================
    // 4. VERTICAL WHEEL DROP YOKES & 6x GREARTISAN 37mm MOTORS (Matching Template Images 1, 3, 5)
    // =========================================================================
    var wheelDefs = [
      { id: 'FL', x: 0.38, z: 0.34 },
      { id: 'ML', x: 0.00, z: 0.34 },
      { id: 'BL', x: -0.38, z: 0.34 },
      { id: 'FR', x: 0.38, z: -0.34 },
      { id: 'MR', x: 0.00, z: -0.34 },
      { id: 'BR', x: -0.38, z: -0.34 }
    ];

    wheels.length = 0;
    wheelGroups.length = 0;

    wheelDefs.forEach(function (wd, idx) {
      var sideSign = wd.z > 0 ? 1 : -1;
      var wg = new THREE.Group();
      wg.position.set(wd.x, 0.09, wd.z);

      // Vertical Drop Yoke Bracket (Template Images 1, 3, 5)
      var yoke = new THREE.Group();
      var verticalStrut = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.110, 0.026),
        matChassisTrim
      );
      verticalStrut.position.set(0, 0.052, -sideSign * 0.016);
      verticalStrut.castShadow = true;
      yoke.add(verticalStrut);

      // Greartisan 37mm Motor Clamp Pod Collar
      var motorClamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.030, 0.030, 0.040, 18),
        matDarkAlloy
      );
      motorClamp.rotation.x = Math.PI / 2;
      motorClamp.position.set(0, 0, -sideSign * 0.054);
      yoke.add(motorClamp);

      // Brass M4 clamp bolt
      var clampBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.044, 8), matBrass);
      clampBolt.position.set(0.020, 0.020, -sideSign * 0.054);
      yoke.add(clampBolt);

      // Greartisan DC 12V 100RPM 37mm Gearbox (Silver)
      var gearbox = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.042, 20),
        matAlloy
      );
      gearbox.rotation.x = Math.PI / 2;
      gearbox.position.set(0, 0, -sideSign * 0.048);
      gearbox.castShadow = true;
      yoke.add(gearbox);

      // Greartisan Black DC Motor Can
      var motorCan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.023, 0.023, 0.050, 20),
        matDarkAlloy
      );
      motorCan.rotation.x = Math.PI / 2;
      motorCan.position.set(0, 0, -sideSign * 0.092);
      motorCan.castShadow = true;
      yoke.add(motorCan);

      // Red & Black Silicone Power Leads
      var redLead = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.090, 6), matWireRed);
      redLead.position.set(0.010, 0.046, -sideSign * 0.096);
      var blkLead = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.090, 6), matWireBlk);
      blkLead.position.set(-0.010, 0.046, -sideSign * 0.096);
      yoke.add(redLead, blkLead);

      // Brass 6mm D-Shaft Hex Coupler
      var hexCoupler = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.022, 6), matBrass);
      hexCoupler.rotation.x = Math.PI / 2;
      hexCoupler.position.set(0, 0, -sideSign * 0.022);
      yoke.add(hexCoupler);

      wg.add(yoke);

      // 6-Wheel Directional Chevron Grouser Tires & Rim Hubs
      var spinAxle = new THREE.Group();
      spinAxle.rotation.x = Math.PI / 2;

      var tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.10, 0.078, 32),
        matTire
      );
      tire.castShadow = true; tire.receiveShadow = true;
      spinAxle.add(tire);

      // 16 Chevron Grouser Paddles
      for (var gi = 0; gi < 16; gi++) {
        var chevron = new THREE.Mesh(
          new THREE.BoxGeometry(0.014, 0.016, 0.070),
          matChassisTrim
        );
        var ang = (gi / 16) * Math.PI * 2;
        chevron.position.set(Math.cos(ang) * 0.099, Math.sin(ang) * 0.099, 0);
        chevron.rotation.z = ang;
        chevron.rotation.y = (gi % 2 === 0) ? 0.18 : -0.18;
        tire.add(chevron);
      }

      // Brushed Aluminum Deep-Dish Rim & Hub Cap
      var rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.068, 0.080, 24),
        matAlloy
      );
      tire.add(rim);
      var hubCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.030, 0.084, 16),
        matArtemisBlue
      );
      tire.add(hubCap);

      // 6 Brass M3 Lug Nuts
      for (var li = 0; li < 6; li++) {
        var lAng = (li / 6) * Math.PI * 2;
        var lug = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.083, 6), matBrass);
        lug.position.set(Math.cos(lAng) * 0.046, Math.sin(lAng) * 0.046, 0);
        tire.add(lug);
      }

      wg.add(spinAxle);
      root.add(wg);

      wheels.push(tire);
      wheelGroups.push({
        group: wg,
        tire: tire,
        localPos: new THREE.Vector3(wd.x, 0.09, wd.z),
        baseZ: wd.z
      });
    });

    // =========================================================================
    // 5. INTERNAL AVIONICS BAY (VISIBLE IN EXPLODED VIEW)
    // =========================================================================
    var internalsGroup = new THREE.Group();
    internalsGroup.position.set(0, 0.17, 0);
    root.add(internalsGroup);

    // Gold Kapton Thermal MLI Deck Tray
    var tray = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.010, 0.44), matGoldFoil);
    tray.position.set(0, 0, 0);
    internalsGroup.add(tray);

    // (A) GOLDENMATE 12V 10Ah LiFePO4 Lithium Battery (128Wh)
    var batGroup = new THREE.Group();
    batGroup.position.set(-0.16, 0.070, -0.06);
    internalsGroup.add(batGroup);
    var batMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.130, 0.150),
      new THREE.MeshStandardMaterial({ map: batTex, roughness: 0.35, metalness: 0.20 })
    );
    batMesh.castShadow = true;
    batGroup.add(batMesh);
    var posPost = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 12), matWireRed);
    posPost.position.set(0.08, 0.075, 0.045);
    var negPost = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 12), matWireBlk);
    negPost.position.set(0.08, 0.075, -0.045);
    var batStrap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.140, 0.165), matDarkAlloy);
    batGroup.add(posPost, negPost, batStrap);

    // (B) SANOOV Raspberry Pi 5 4GB + Active Cooler
    var piGroup = new THREE.Group();
    piGroup.position.set(0.16, 0.032, -0.09);
    internalsGroup.add(piGroup);
    var piPcb = new THREE.Mesh(
      new THREE.BoxGeometry(0.156, 0.006, 0.102),
      new THREE.MeshStandardMaterial({ map: piTex, roughness: 0.38, metalness: 0.30 })
    );
    piGroup.add(piPcb);
    var coolerSink = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.024, 0.068), matAlloy);
    coolerSink.position.set(-0.01, 0.028, 0);
    piGroup.add(coolerSink);
    // Radial Blower Fan
    var piBlower = new THREE.Group();
    piBlower.position.set(0.01, 0.040, 0.01);
    var piRotor = new THREE.Group();
    for (var pf = 0; pf < 9; pf++) {
      var pBlade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.004, 0.003), matDarkAlloy);
      var pAng = (pf / 9) * Math.PI * 2;
      pBlade.position.set(Math.cos(pAng) * 0.012, 0.002, Math.sin(pAng) * 0.012);
      pBlade.rotation.y = pAng;
      piRotor.add(pBlade);
    }
    piBlower.add(piRotor);
    piGroup.add(piBlower);
    var usbPorts = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.024), matArtemisBlue);
    usbPorts.position.set(0.072, 0.028, -0.028);
    piGroup.add(usbPorts);

    // (C) Arduino Uno REV3 [A000066] ATmega328P
    var unoGroup = new THREE.Group();
    unoGroup.position.set(0.16, 0.026, 0.11);
    internalsGroup.add(unoGroup);
    var unoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.138, 0.006, 0.104),
      new THREE.MeshStandardMaterial({ map: unoTex, roughness: 0.35, metalness: 0.25 })
    );
    unoGroup.add(unoMesh);
    var usbBPort = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.020, 0.020), matAlloy);
    usbBPort.position.set(-0.058, 0.012, -0.024);
    var barrelJack = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.020, 0.016), matDarkAlloy);
    barrelJack.position.set(-0.058, 0.012, 0.026);
    var unoLed = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 0.006), matGreenLed);
    unoLed.position.set(-0.01, 0.005, -0.012);
    unoGroup.add(usbBPort, barrelJack, unoLed);

    // (D) YRDZXG 12V/24V to 5V 5A Buck Converter
    var buckGroup = new THREE.Group();
    buckGroup.position.set(-0.15, 0.030, 0.13);
    internalsGroup.add(buckGroup);
    var buckMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.036, 0.068),
      new THREE.MeshStandardMaterial({ map: buckTex, roughness: 0.35, metalness: 0.70 })
    );
    buckGroup.add(buckMesh);
    for (var bf = -2; bf <= 2; bf++) {
      var bFin = new THREE.Mesh(new THREE.BoxGeometry(0.114, 0.004, 0.072), matAlloy);
      bFin.position.y = bf * 0.006;
      buckGroup.add(bFin);
    }

    // (E) Cytron MDD10A Dual 10A Motor Driver Module
    var cytronGroup = new THREE.Group();
    cytronGroup.position.set(0.00, 0.026, 0.00);
    internalsGroup.add(cytronGroup);
    var cytronPcb = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.005, 0.065),
      matArtemisBlue
    );
    var cytronSink = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, 0.052), matDarkAlloy);
    cytronSink.position.y = 0.012;
    cytronGroup.add(cytronPcb, cytronSink);

    // 6x 3007 Brushless Chassis Ventilation Fans (Indices 0..5 in fanRotors)
    [-1, 1].forEach(function (sideSign) {
      [-0.22, 0.0, 0.22].forEach(function (fx) {
        var fanGroup = new THREE.Group();
        fanGroup.position.set(fx, 0.135, sideSign * 0.264);
        var fFrame = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.072, 0.014), matDarkAlloy);
        fanGroup.add(fFrame);
        var fRotor = new THREE.Group();
        var fHub = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.016, 12), matDarkAlloy);
        fHub.rotation.x = Math.PI / 2;
        fRotor.add(fHub);
        for (var fb = 0; fb < 7; fb++) {
          var blade = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.006, 0.003), matAlloy);
          var bAng = (fb / 7) * Math.PI * 2;
          blade.position.set(Math.cos(bAng) * 0.018, Math.sin(bAng) * 0.018, 0);
          blade.rotation.z = bAng + 0.4;
          blade.rotation.y = 0.45;
          fRotor.add(blade);
        }
        fanGroup.add(fRotor);
        fanRotors.push(fRotor); // Indices 0..5
        root.add(fanGroup);
      });
    });

    // Add Pi5 radial blower as index 6
    fanRotors.push(piRotor);

    // =========================================================================
    // 6. UPPER CARAPACE & RECESSED CARGO HOPPER (Lifts smoothly on 'E' Exploded View)
    // =========================================================================
    var upperShellGroup = new THREE.Group();
    root.add(upperShellGroup);

    // Front Elevated Deck (Hosts Arm, Mast, and Perception Sensors)
    var frontDeck = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.060, 0.52),
      matChassis
    );
    frontDeck.position.set(0.25, 0.23, 0);
    frontDeck.castShadow = true; frontDeck.receiveShadow = true;
    upperShellGroup.add(frontDeck);

    // Recessed Cargo Hopper / Bed (Matching Template Images 1, 3, 4)
    var cargoBayGroup = new THREE.Group();
    cargoBayGroup.position.set(-0.16, 0.20, 0);
    upperShellGroup.add(cargoBayGroup);

    // Ribbed Diamond Plate Bed Floor
    var bayFloor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.016, 0.42), matDarkAlloy);
    bayFloor.receiveShadow = true;
    cargoBayGroup.add(bayFloor);

    // Left, Right, Rear, and Front Perimeter Hopper Walls
    var wallL = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.020), matChassis);
    wallL.position.set(0, 0.062, 0.20);
    var wallR = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.020), matChassis);
    wallR.position.set(0, 0.062, -0.20);
    var wallBack = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.12, 0.42), matChassis);
    wallBack.position.set(-0.24, 0.062, 0);
    var wallFront = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.12, 0.42), matChassis);
    wallFront.position.set(0.24, 0.062, 0);
    cargoBayGroup.add(wallL, wallR, wallBack, wallFront);

    // Top Perimeter Containment Rails
    var railL = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.48, 8), matArtemisBlue);
    railL.rotation.z = Math.PI / 2; railL.position.set(0, 0.125, 0.20);
    var railR = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.48, 8), matArtemisBlue);
    railR.rotation.z = Math.PI / 2; railR.position.set(0, 0.125, -0.20);
    cargoBayGroup.add(railL, railR);

    // Standardized NASA HUNCH Lunar Logistics Container / Cask
    var containerGroup = new THREE.Group();
    containerGroup.position.set(0, 0.060, 0);
    var caskBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.100, 0.20), matAlloy);
    caskBody.castShadow = true;
    var caskStripe = new THREE.Mesh(new THREE.BoxGeometry(0.244, 0.026, 0.204), matArtemisBlue);
    var caskLatch = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.035, 0.016), matBrass);
    caskLatch.position.set(0.122, 0, 0);
    containerGroup.add(caskBody, caskStripe, caskLatch);
    containerGroup.visible = false; // Initially empty until picked up from cargo lander
    cargoBayGroup.add(containerGroup);
    window.roverHopperContainer = containerGroup;

    window.cargoBaySlots = [];
    [-0.14, 0.14].forEach(function (zSlot) {
      var slot = new THREE.Object3D();
      slot.position.set(0, 0.04, zSlot);
      cargoBayGroup.add(slot);
      window.cargoBaySlots.push(slot);
    });

    // =========================================================================
    // 7. ARTICULATED ROBOTIC ARM WITH SPHERICAL SHOULDER & 2-PRONG CLAW (Images 1, 2, 5)
    // =========================================================================
    var armBase = new THREE.Group();
    armBase.position.set(0.30, 0.26, 0.12);
    upperShellGroup.add(armBase);

    // Cylindrical Yaw Turret Base
    var baseTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.040, 0.024, 20), matDarkAlloy);
    baseTurret.position.y = 0.012;
    var baseBrassRing = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.006, 20), matBrass);
    baseBrassRing.position.y = 0.026;
    armBase.add(baseTurret, baseBrassRing);

    // Prominent Spherical Shoulder Ball Joint (Template Images 1, 2, 3!)
    var shoulder = new THREE.Group();
    shoulder.position.set(0, 0.055, 0);
    armBase.add(shoulder);

    var shoulderBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 24, 16),
      matDarkAlloy
    );
    shoulderBall.castShadow = true;
    shoulder.add(shoulderBall);

    // Upper Arm Boom Link (Angled up and forward)
    var upperArmLink = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.028, 0.028), matChassisTrim);
    upperArmLink.position.set(0.10, 0.04, 0);
    upperArmLink.rotation.z = 0.35;
    upperArmLink.castShadow = true;
    shoulder.add(upperArmLink);

    // Hydraulic/Linear Actuator Cylinder along upper arm
    var actuator = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.14, 12), matAlloy);
    actuator.position.set(0.08, 0.018, 0);
    actuator.rotation.z = 0.35;
    shoulder.add(actuator);

    // Elbow Dual-Shear Hinge Joint
    var elbow = new THREE.Group();
    elbow.position.set(0.19, 0.075, 0);
    shoulder.add(elbow);

    var elbowPin = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.036, 16), matBrass);
    elbowPin.rotation.x = Math.PI / 2;
    elbow.add(elbowPin);

    // Forearm Link (Angled downward and forward)
    var foreArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.024, 0.024), matChassisTrim);
    foreArm.position.set(0.085, -0.045, 0);
    foreArm.rotation.z = -0.55;
    foreArm.castShadow = true;
    elbow.add(foreArm);

    // Wrist Pitch/Yaw Gimbal
    var wrist = new THREE.Group();
    wrist.position.set(0.16, -0.095, 0);
    elbow.add(wrist);

    var wristJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.028, 12), matArtemisBlue);
    wristJoint.rotation.x = Math.PI / 2;
    wrist.add(wristJoint);

    // Two-Prong Gripper Claw (End-Effector - Template Images 1, 2, 5!)
    var gripperCrossbar = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.020, 0.130), matAlloy);
    gripperCrossbar.position.set(0.015, 0, 0);
    wrist.add(gripperCrossbar);

    var fingerL = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.016, 0.016), matAlloy);
    fingerL.position.set(0.052, 0, 0.052);
    fingerL.castShadow = true;
    var padL = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.012, 0.004), matDarkAlloy);
    padL.position.set(0.052, 0, 0.043);

    var fingerR = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.016, 0.016), matAlloy);
    fingerR.position.set(0.052, 0, -0.052);
    fingerR.castShadow = true;
    var padR = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.012, 0.004), matDarkAlloy);
    padR.position.set(0.052, 0, -0.043);

    wrist.add(fingerL, padL, fingerR, padR);

    // =========================================================================
    // 8. PERCEPTION MAST WITH SPINNING EC BUYING YDLIDAR X2L 360° (Images 1, 2, 3, 4)
    // =========================================================================
    var mastGroup = new THREE.Group();
    mastGroup.position.set(0.28, 0.26, -0.14);
    upperShellGroup.add(mastGroup);

    // Black Anodized Mast Column
    var mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.25, 20), matDarkAlloy);
    mastPole.position.set(0, 0.125, 0);
    mastPole.castShadow = true;
    mastGroup.add(mastPole);

    // Royal Blue Anodized Accent Ring
    var mastRing = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 20), matArtemisBlue);
    mastRing.position.set(0, 0.21, 0);
    mastGroup.add(mastRing);

    // Mast Top Sensor Platform
    var mastHead = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.054, 0.018, 24), matDarkAlloy);
    mastHead.position.set(0, 0.255, 0);
    mastGroup.add(mastHead);

    // Spinning YDLIDAR X2L 360° Laser Range Scanner Head
    var lidarHead = new THREE.Group();
    lidarHead.position.set(0, 0.285, 0);
    mastGroup.add(lidarHead);

    var lidarPuck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.044, 0.038, 24), matDarkAlloy);
    lidarPuck.castShadow = true;
    lidarHead.add(lidarPuck);

    // Dual Laser Emitter & Receiver Lenses inside YDLIDAR Window
    [-0.014, 0.014].forEach(function (lz) {
      var lOptic = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 16), matLens);
      lOptic.rotation.z = Math.PI / 2;
      lOptic.position.set(0.038, 0, lz);
      lidarHead.add(lOptic);
    });

    // Forward Navigation Mastcam Module (Arducam 5MP OV5647)
    var navCam = new THREE.Group();
    navCam.position.set(0.044, 0.23, 0);
    var camBezel = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.048, 0.048), matChassisTrim);
    var camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.018, 16), matLens);
    camLens.rotation.z = Math.PI / 2;
    camLens.position.x = 0.015;
    navCam.add(camBezel, camLens);
    mastGroup.add(navCam);

    if (global.piCamera) {
      navCam.add(global.piCamera);
      global.piCamera.position.set(0.06, 0.01, 0);
      global.piCamera.rotation.set(-0.16, -Math.PI / 2, 0);
    }

    // =========================================================================
    // 9. FRONT FACE PERCEPTION APERTURES & HEADLIGHTS (Matching Template Image 2)
    // =========================================================================
    var rectAperture = new THREE.Group();
    rectAperture.position.set(0.432, 0.138, 0.10);
    var rectFrame = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.095), matDarkAlloy);
    var rectGlass = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.035, 0.082), matLens);
    rectAperture.add(rectFrame, rectGlass);
    root.add(rectAperture);

    var circAperture = new THREE.Group();
    circAperture.position.set(0.432, 0.138, -0.10);
    var circFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 16), matDarkAlloy);
    circFrame.rotation.z = Math.PI / 2;
    var circMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.016, 16), matAlloy);
    circMesh.rotation.z = Math.PI / 2;
    circAperture.add(circFrame, circMesh);
    root.add(circAperture);

    // Front Push Bumper & Dual Recovery Tow Shackles
    var frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.58), matAlloy);
    frontBumper.position.set(0.445, 0.115, 0);
    frontBumper.castShadow = true;
    root.add(frontBumper);

    [-0.18, 0.18].forEach(function (shz) {
      var shackle = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 8, 16), matAmber);
      shackle.rotation.y = Math.PI / 2;
      shackle.position.set(0.470, 0.115, shz);
      root.add(shackle);
    });

    // Dual Forward High-Intensity LED Headlights
    [-0.21, 0.21].forEach(function (hz) {
      var hlBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.024, 16), matDarkAlloy);
      hlBezel.rotation.z = Math.PI / 2;
      hlBezel.position.set(0.438, 0.145, hz);
      var hlEmitter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.026, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffeedd, emissiveIntensity: 2.0 })
      );
      hlEmitter.rotation.z = Math.PI / 2;
      hlEmitter.position.set(0.440, 0.145, hz);
      root.add(hlBezel, hlEmitter);

      var spot = new THREE.SpotLight(0xffeedd, 2.5, 25, Math.PI / 5, 0.4, 1.5);
      spot.position.set(0.46, 0.15, hz);
      var spotTarget = new THREE.Object3D();
      spotTarget.position.set(5.0, -0.4, hz);
      root.add(spotTarget);
      spot.target = spotTarget;
      root.add(spot);
      headlights.push(spot);
    });

    // Rear 5-Segment BMS State-of-Charge LED Bar & E-Stop Button
    for (var lb = 0; lb < 5; lb++) {
      var ledSeg = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.026), matGreenLed);
      ledSeg.position.set(-0.38, 0.28, -0.08 + lb * 0.04);
      upperShellGroup.add(ledSeg);
    }
    var eStopBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.016, 0.022, 16), matWireRed);
    eStopBtn.position.set(-0.36, 0.29, 0.16);
    upperShellGroup.add(eStopBtn);

    // =========================================================================
    // EXPOSE HANDLES TO SIMULATOR RUNTIME & PHYSICS
    // =========================================================================
    global.lidarHead = lidarHead;
    global.fanRotors = fanRotors;
    global.upperShellGroup = upperShellGroup;
    global.internalsGroup = internalsGroup;
    global.headlights = headlights;
    global.cargoBayGroup = cargoBayGroup;
    window.cargoBayGroup = cargoBayGroup;
    window.roverArm = {
      base: armBase,
      shoulder: shoulder,
      elbow: elbow,
      wrist: wrist,
      gripper: wrist,
      fingerL: fingerL,
      fingerR: fingerR
    };

    return Promise.resolve(root);
  }

  global.NASA_FusionRover = {
    init: initFusionRover,
    loadManifest: function () {
      return Promise.resolve({
        roverRadius: 0.35,
        modelCenter: { x: 0, y: 0, z: 0 }
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
