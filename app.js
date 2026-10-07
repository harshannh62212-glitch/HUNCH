// NASA HUNCH 2026–2027 // LLASO Project 2
// AEGIS-V1 External Cargo Transport System (ECTS)
// Engineering CAD Viewer & Mission Simulation Engine

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- 1. THREE.JS CAD INSPECTION VIEWER ---
  const canvas = document.getElementById('rover-canvas');
  if (canvas && window.THREE) {
    initCADViewer(canvas);
  }

  function initCADViewer(canvasEl) {
    const container = canvasEl.parentElement;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d16);
    scene.fog = new THREE.FogExp2(0x0a0d16, 0.025);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(10, 6.5, 11);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
      alpha: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Orbit Controls
    const controls = new THREE.OrbitControls(camera, canvasEl);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.minDistance = 3.5;
    controls.maxDistance = 32;
    controls.target.set(0, 1.2, 0);

    // Balanced Studio & Lunar Fill Lighting
    const ambientLight = new THREE.AmbientLight(0x2a3346, 0.95);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(14, 22, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.85);
    fillLight.position.set(-14, 12, -12);
    scene.add(fillLight);

    const earthBounceLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    earthBounceLight.position.set(-6, -10, 14);
    scene.add(earthBounceLight);

    // Studio Inspection Floor Plate
    const floorGeo = new THREE.CylinderGeometry(15, 15, 0.2, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      roughness: 0.85,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    // CAD Precision Alignment Grid
    const grid = new THREE.GridHelper(26, 26, 0x334155, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    // Procedural HD Canvas Textures
    function createPetgTex() {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
      const c = cv.getContext('2d');
      c.fillStyle = '#12151d'; c.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 3) {
        const s = Math.round(18 + Math.sin(y * 1.8) * 4 + (Math.random() - 0.5) * 5);
        c.fillStyle = 'rgb(' + s + ',' + (s+1) + ',' + (s+4) + ')';
        c.fillRect(0, y, 512, 1.8);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2);
      return tex;
    }

    function createGoldenmateTex() {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
      const c = cv.getContext('2d');
      c.fillStyle = '#0f172a'; c.fillRect(0, 0, 512, 256);
      c.fillStyle = '#0284c7'; c.fillRect(0, 0, 512, 48);
      c.fillStyle = '#ffffff'; c.font = 'bold 26px sans-serif';
      c.fillText('GOLDENMATE', 24, 34);
      c.fillStyle = '#38bdf8'; c.font = 'bold 36px monospace';
      c.fillText('12V 10Ah', 24, 110);
      c.fillStyle = '#94a3b8'; c.font = '18px monospace';
      c.fillText('LiFePO4 LITHIUM • 128Wh', 24, 145);
      c.fillText('100% SMART BMS • IP67', 24, 175);
      c.fillStyle = '#ef4444'; c.fillRect(430, 20, 50, 50);
      c.fillStyle = '#ffffff'; c.font = 'bold 28px sans-serif'; c.fillText('+', 446, 56);
      c.fillStyle = '#1e293b'; c.fillRect(430, 90, 50, 50);
      c.fillStyle = '#ffffff'; c.fillText('-', 450, 124);
      return new THREE.CanvasTexture(cv);
    }

    function createArduinoTex() {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 360;
      const c = cv.getContext('2d');
      c.fillStyle = '#0891b2'; c.fillRect(0, 0, 512, 360);
      c.fillStyle = '#0e7490'; c.fillRect(15, 15, 482, 330);
      c.fillStyle = '#1e293b'; c.fillRect(160, 110, 190, 65);
      c.fillStyle = '#ffffff'; c.font = 'bold 15px monospace';
      c.fillText('ATmega328P', 195, 148);
      c.fillStyle = '#cbd5e1'; c.fillRect(10, 25, 80, 70);
      c.fillStyle = '#1e293b'; c.fillRect(10, 260, 95, 75);
      c.fillStyle = '#ffffff'; c.font = 'bold 22px sans-serif';
      c.fillText('ARDUINO UNO R3', 150, 60);
      return new THREE.CanvasTexture(cv);
    }

    function createPi5Tex() {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 340;
      const c = cv.getContext('2d');
      c.fillStyle = '#14532d'; c.fillRect(0, 0, 512, 340);
      c.fillStyle = '#ffffff'; c.font = 'bold 18px monospace';
      c.fillText('Raspberry Pi 5 4GB', 75, 72);
      c.fillStyle = '#86efac'; c.font = '14px monospace';
      c.fillText('SANOOV ACTIVE COOLER • BCM2712', 75, 98);
      for (let p = 0; p < 20; p++) {
        c.fillStyle = '#fbbf24';
        c.fillRect(65 + p * 18, 14, 10, 10);
        c.fillRect(65 + p * 18, 28, 10, 10);
      }
      return new THREE.CanvasTexture(cv);
    }

    function createBuckTex() {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
      const c = cv.getContext('2d');
      c.fillStyle = '#1e293b'; c.fillRect(0, 0, 256, 128);
      c.fillStyle = '#38bdf8'; c.font = 'bold 16px monospace';
      c.fillText('YRDZXG BUCK', 15, 34);
      c.fillStyle = '#e2e8f0'; c.font = '13px monospace';
      c.fillText('12V -> 5V 5A 25W', 15, 60);
      c.fillText('WATERPROOF IP68', 15, 84);
      return new THREE.CanvasTexture(cv);
    }

    const petgTex = createPetgTex();
    const goldenmateTex = createGoldenmateTex();
    const arduinoTex = createArduinoTex();
    const pi5Tex = createPi5Tex();
    const buckTex = createBuckTex();

    // Engineering Materials
    const materials = {
      petgChassis: new THREE.MeshStandardMaterial({ map: petgTex, bumpMap: petgTex, bumpScale: 0.03, color: 0x161a23, roughness: 0.48, metalness: 0.28 }),
      petgArmor: new THREE.MeshStandardMaterial({ map: petgTex, bumpMap: petgTex, bumpScale: 0.02, color: 0x12151c, roughness: 0.38, metalness: 0.32 }),
      brassInsert: new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.94 }),
      titaniumBumper: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.24, metalness: 0.88 }),
      darkAnodized: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.32, metalness: 0.84 }),
      blueAnodized: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.25, metalness: 0.85 }),
      treadWheel: new THREE.MeshStandardMaterial({ color: 0x222630, roughness: 0.76, metalness: 0.35 }),
      wheelRim: new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.22, metalness: 0.90 }),
      goldenmateBat: new THREE.MeshStandardMaterial({ map: goldenmateTex, roughness: 0.38, metalness: 0.2 }),
      arduinoPcb: new THREE.MeshStandardMaterial({ map: arduinoTex, roughness: 0.35, metalness: 0.25 }),
      pi5Pcb: new THREE.MeshStandardMaterial({ map: pi5Tex, roughness: 0.38, metalness: 0.28 }),
      buckMat: new THREE.MeshStandardMaterial({ map: buckTex, roughness: 0.32, metalness: 0.75 }),
      arducamPcb: new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.45, metalness: 0.3 }),
      sensorOptics: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.08, metalness: 0.95 }),
      cyanGlow: new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.25 }),
      amberGlow: new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 1.1 }),
      cargoEnclosure: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32, metalness: 0.25 })
    };

    const inspectableMeshes = [];
    const fanRotors = [];
    const wheelMeshes = [];
    const regMesh = (m) => { inspectableMeshes.push(m); return m; };

    // Root Assembly
    const assembly = new THREE.Group();
    scene.add(assembly);

    const chassisGroup = new THREE.Group();
    const suspensionGroup = new THREE.Group();
    const upperShellGroup = new THREE.Group();
    assembly.add(chassisGroup);
    assembly.add(suspensionGroup);
    assembly.add(upperShellGroup);

    // =========================================================================
    // 1. LOWER MONOCOQUE CHASSIS TUB & UNDERSIDE AXLES (Template Image 5)
    // =========================================================================
    const lowerTub = regMesh(new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.72, 2.65),
      materials.petgChassis
    ));
    lowerTub.position.y = 1.05;
    lowerTub.castShadow = true; lowerTub.receiveShadow = true;
    chassisGroup.add(lowerTub);

    // 3 CONTINUOUS TRANSVERSE TUBULAR AXLES UNDERNEATH WITH CENTRAL MOUNTING CLAMPS (Template Image 5)
    const axleXPositions = [1.95, 0.0, -1.95];
    axleXPositions.forEach(ax => {
      // Transverse tubular axle connecting left and right wheel assemblies
      const axleTube = regMesh(new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 3.42, 24).rotateX(Math.PI / 2),
        materials.darkAnodized
      ));
      axleTube.position.set(ax, 0.56, 0);
      axleTube.castShadow = true;
      chassisGroup.add(axleTube);

      // Central split-collar chassis mounting clamp (Template Image 5)
      const collar = regMesh(new THREE.Mesh(
        new THREE.CylinderGeometry(0.165, 0.165, 0.36, 20).rotateX(Math.PI / 2),
        materials.titaniumBumper
      ));
      collar.position.set(ax, 0.56, 0);
      chassisGroup.add(collar);

      [-0.12, 0.12].forEach(offZ => {
        const bolt = regMesh(new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 0.38, 12),
          materials.brassInsert
        ));
        bolt.position.set(ax, 0.56, offZ);
        chassisGroup.add(bolt);
      });
    });

    // 20x M3/M4 Brass Heat-Set Threaded Inserts on Chassis Deck Perimeter
    for (let bx = -1.9; bx <= 1.95; bx += 0.76) {
      [-1.26, 1.26].forEach(bz => {
        const insert = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12), materials.brassInsert));
        insert.position.set(bx, 1.42, bz);
        chassisGroup.add(insert);
      });
    }

    // Front Face Push Bumper with Rectangular Stereo Aperture & Round Sensor Port (Template Image 2)
    const frontBumper = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 2.85), materials.titaniumBumper));
    frontBumper.position.set(2.36, 1.05, 0);
    chassisGroup.add(frontBumper);

    const rearBumper = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 2.75), materials.titaniumBumper));
    rearBumper.position.set(-2.32, 1.05, 0);
    chassisGroup.add(rearBumper);

    // Rectangular Stereo Perception Window (Lower-Left front view, +Z)
    const stereoWindow = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.58), materials.darkAnodized));
    stereoWindow.position.set(2.51, 1.05, 0.55);
    const stereoLens1 = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16).rotateZ(Math.PI / 2), materials.sensorOptics));
    stereoLens1.position.set(2.54, 1.05, 0.70);
    const stereoLens2 = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16).rotateZ(Math.PI / 2), materials.sensorOptics));
    stereoLens2.position.set(2.54, 1.05, 0.40);
    chassisGroup.add(stereoWindow, stereoLens1, stereoLens2);

    // Circular Sensor Port with Grill (Lower-Right front view, -Z)
    const roundPort = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 24).rotateZ(Math.PI / 2), materials.darkAnodized));
    roundPort.position.set(2.51, 1.05, -0.65);
    const roundEye = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 20).rotateZ(Math.PI / 2), materials.sensorOptics));
    roundEye.position.set(2.54, 1.05, -0.65);
    chassisGroup.add(roundPort, roundEye);

    // Amber Heavy-Duty Tow Shackles
    [-1.05, 1.05].forEach(sz => {
      const shackle = regMesh(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 12, 24), materials.amberGlow));
      shackle.position.set(2.50, 0.88, sz);
      shackle.rotation.y = Math.PI / 2;
      chassisGroup.add(shackle);
    });

    // 6x 3007 (30x30x7mm) Brushless Chassis Cooling Fans (3 Left Intake, 3 Right Exhaust)
    [-1.34, 1.34].forEach(fz => {
      [-1.15, 0.0, 1.15].forEach(fx => {
        const fanHousing = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.08), materials.darkAnodized));
        fanHousing.position.set(fx, 1.06, fz);
        chassisGroup.add(fanHousing);

        const rotor = new THREE.Group();
        rotor.position.set(fx, 1.06, fz + (fz > 0 ? 0.03 : -0.03));
        const rHub = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), materials.brassInsert));
        rHub.rotation.x = Math.PI / 2;
        rotor.add(rHub);
        for (let b = 0; b < 7; b++) {
          const blade = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.015), materials.titaniumBumper));
          const ang = (b / 7) * Math.PI * 2;
          blade.position.set(Math.cos(ang) * 0.11, Math.sin(ang) * 0.11, 0);
          blade.rotation.z = ang + 0.45;
          rotor.add(blade);
        }
        chassisGroup.add(rotor);
        fanRotors.push(rotor);
      });
    });

    // =========================================================================
    // 2. INTERNAL AVIONICS BAY (Revealed in Exploded View)
    // =========================================================================
    const goldenmateBat = regMesh(new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.68, 0.82), materials.goldenmateBat));
    goldenmateBat.position.set(-0.88, 1.56, -0.32);
    goldenmateBat.castShadow = true;
    chassisGroup.add(goldenmateBat);

    const pi5Board = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 0.58), materials.pi5Pcb));
    pi5Board.position.set(0.82, 1.46, -0.48);
    const pi5Cooler = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.42), materials.titaniumBumper));
    pi5Cooler.position.set(0.82, 1.58, -0.48);
    chassisGroup.add(pi5Board, pi5Cooler);

    const arduinoUno = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.56), materials.arduinoPcb));
    arduinoUno.position.set(0.82, 1.45, 0.52);
    chassisGroup.add(arduinoUno);

    const buckConverter = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.42), materials.buckMat));
    buckConverter.position.set(-0.82, 1.48, 0.68);
    chassisGroup.add(buckConverter);

    const cytronDriver = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.48), materials.darkAnodized));
    cytronDriver.position.set(0.0, 1.46, 0.0);
    chassisGroup.add(cytronDriver);

    // =========================================================================
    // 3. 6-WHEEL CHEVRON LOCOMOTION, VERTICAL YOKES & GREARTISAN 37MM MOTORS
    // =========================================================================
    const wheelPositions = [
      { x: 1.95, z: 1.68 },  { x: 0.0, z: 1.82 },  { x: -1.95, z: 1.68 },
      { x: 1.95, z: -1.68 }, { x: 0.0, z: -1.82 }, { x: -1.95, z: -1.68 }
    ];

    wheelPositions.forEach(pos => {
      const wheelAssembly = new THREE.Group();
      wheelAssembly.position.set(pos.x, 0.56, pos.z);
      const zSign = pos.z > 0 ? 1 : -1;

      // Vertical Drop Yoke (Matching Template Images 1, 3, 5)
      const yoke = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.16), materials.petgArmor));
      yoke.position.set(0, 0.42, zSign * 0.28);
      wheelAssembly.add(yoke);

      // Deep-Dish Wheel Rim
      const rim = regMesh(new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 0.42, 24).rotateX(Math.PI / 2),
        materials.wheelRim
      ));
      wheelAssembly.add(rim);

      // Compliant Chevron Tire
      const tireGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.44, 32);
      tireGeo.rotateX(Math.PI / 2);
      const tire = regMesh(new THREE.Mesh(tireGeo, materials.treadWheel));
      tire.castShadow = true; tire.receiveShadow = true;
      wheelAssembly.add(tire);
      wheelMeshes.push(tire);

      // 16 Directional Chevron Grousers (Template Images 1, 3, 5)
      for (let g = 0; g < 16; g++) {
        const ang = (g / 16) * Math.PI * 2;
        const chevronL = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.18), materials.petgArmor));
        chevronL.position.set(Math.cos(ang) * 0.56, Math.sin(ang) * 0.56, 0.09);
        chevronL.rotation.z = ang; chevronL.rotation.y = 0.28;

        const chevronR = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.18), materials.petgArmor));
        chevronR.position.set(Math.cos(ang) * 0.56, Math.sin(ang) * 0.56, -0.09);
        chevronR.rotation.z = ang; chevronR.rotation.y = -0.28;

        tire.add(chevronL, chevronR);
      }

      // Greartisan DC 12V 100RPM 37mm Gearbox (Silver) + Motor Can (Black)
      const gearbox37 = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 20).rotateX(Math.PI / 2), materials.titaniumBumper));
      gearbox37.position.set(0, 0, -zSign * 0.34);
      const motorCan = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.32, 20).rotateX(Math.PI / 2), materials.darkAnodized));
      motorCan.position.set(0, 0, -zSign * 0.62);

      // Brass Hex Coupler & Lug Nuts
      const hexCoupler = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 6).rotateX(Math.PI / 2), materials.brassInsert));
      hexCoupler.position.set(0, 0, zSign * 0.24);
      wheelAssembly.add(gearbox37, motorCan, hexCoupler);

      suspensionGroup.add(wheelAssembly);
    });

    // =========================================================================
    // 4. UPPER CARAPACE, EMBOSSED 'AEGIS' FLANKS, ARM, MAST & CARGO HOPPER
    //    (Lifts smoothly in Exploded View)
    // =========================================================================

    // Front Elevated Deck
    const frontDeck = regMesh(new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.32, 2.65),
      materials.petgArmor
    ));
    frontDeck.position.set(1.28, 1.57, 0);
    frontDeck.castShadow = true; frontDeck.receiveShadow = true;
    upperShellGroup.add(frontDeck);

    // Recessed Cargo Hopper Bed (Template Images 1, 3, 4)
    const cargoHopperGroup = new THREE.Group();
    cargoHopperGroup.position.set(-0.75, 1.45, 0);

    const hopperFloor = regMesh(new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.12, 2.45), materials.darkAnodized));
    hopperFloor.receiveShadow = true;
    cargoHopperGroup.add(hopperFloor);

    // Hopper Perimeter Walls
    const wallL = regMesh(new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.62, 0.10), materials.petgArmor));
    wallL.position.set(0, 0.31, 1.20);
    const wallR = regMesh(new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.62, 0.10), materials.petgArmor));
    wallR.position.set(0, 0.31, -1.20);
    const wallBack = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.62, 2.45), materials.petgArmor));
    wallBack.position.set(-1.38, 0.31, 0);
    const wallFront = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.62, 2.45), materials.petgArmor));
    wallFront.position.set(1.38, 0.31, 0);

    // Top Blue Anodized Guide Rails
    const railL = regMesh(new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.06, 0.08), materials.blueAnodized));
    railL.position.set(0, 0.63, 1.20);
    const railR = regMesh(new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.06, 0.08), materials.blueAnodized));
    railR.position.set(0, 0.63, -1.20);
    cargoHopperGroup.add(wallL, wallR, wallBack, wallFront, railL, railR);

    // Standardized NASA HUNCH Lunar Logistics Container
    const containerMesh = regMesh(new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.88, 1.95), materials.cargoEnclosure));
    containerMesh.position.set(0, 0.48, 0);
    containerMesh.castShadow = true; containerMesh.receiveShadow = true;
    const containerBand = regMesh(new THREE.Mesh(new THREE.BoxGeometry(2.27, 0.18, 1.97), materials.blueAnodized));
    containerBand.position.set(0, 0.48, 0);
    const containerLatch = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.28), materials.amberGlow));
    containerLatch.position.set(1.14, 0.48, 0);
    cargoHopperGroup.add(containerMesh, containerBand, containerLatch);
    upperShellGroup.add(cargoHopperGroup);

    // 3D EMBOSSED 'AEGIS' LETTERING ON BOTH FLANKS (Template Image 1)
    function createLetter(char, mat) {
      const g = new THREE.Group();
      const d = 0.08, w = 0.08, H = 0.48, W = 0.32;
      const bar = (bx, by, bw, bh) => {
        const m = regMesh(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d), mat));
        m.position.set(bx, by, 0);
        g.add(m);
        return m;
      };
      if (char === 'A') {
        bar(-W/2 + w/2, 0, w, H); bar(W/2 - w/2, 0, w, H);
        bar(0, H/2 - w/2, W, w); bar(0, 0, W, w);
      } else if (char === 'E') {
        bar(-W/2 + w/2, 0, w, H); bar(0, H/2 - w/2, W, w);
        bar(-0.02, 0, W * 0.72, w); bar(0, -H/2 + w/2, W, w);
      } else if (char === 'G') {
        bar(-W/2 + w/2, 0, w, H); bar(0, H/2 - w/2, W, w);
        bar(0, -H/2 + w/2, W, w); bar(W/2 - w/2, -H/4 + w/4, w, H/2);
        bar(0.04, 0, W/2, w);
      } else if (char === 'I') {
        bar(0, 0, w * 1.2, H); bar(0, H/2 - w/2, W * 0.7, w);
        bar(0, -H/2 + w/2, W * 0.7, w);
      } else if (char === 'S') {
        bar(0, H/2 - w/2, W, w); bar(-W/2 + w/2, H/4, w, H/2);
        bar(0, 0, W, w); bar(W/2 - w/2, -H/4, w, H/2);
        bar(0, -H/2 + w/2, W, w);
      }
      return g;
    }

    function createAegisBadge(isLeft) {
      const g = new THREE.Group();
      const plaque = regMesh(new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.62, 0.08), materials.blueAnodized));
      g.add(plaque);
      const innerPlate = regMesh(new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.54, 0.09), materials.darkAnodized));
      g.add(innerPlate);

      const letters = ['A', 'E', 'G', 'I', 'S'];
      const startX = -0.80, spacing = 0.40;
      letters.forEach((char, idx) => {
        const lMesh = createLetter(char, materials.cyanGlow);
        lMesh.position.set(startX + idx * spacing, 0, 0.06);
        g.add(lMesh);
      });

      const zPos = isLeft ? 1.36 : -1.36;
      g.position.set(0, 1.88, zPos);
      if (!isLeft) g.rotation.y = Math.PI;
      return g;
    }

    upperShellGroup.add(createAegisBadge(true));
    upperShellGroup.add(createAegisBadge(false));

    // ARTICULATED ROBOTIC ARM ON FRONT-LEFT DECK (Template Images 1, 2, 5)
    const armGroup = new THREE.Group();
    armGroup.position.set(1.42, 1.73, 0.62);

    // Cylindrical Base Turntable
    const armBase = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 24), materials.darkAnodized));
    armBase.position.y = 0.08;
    armGroup.add(armBase);

    // Spherical Shoulder Ball Joint (Template Images 1, 2, 5)
    const shoulderBall = regMesh(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 20), materials.titaniumBumper));
    shoulderBall.position.set(0, 0.26, 0);
    armGroup.add(shoulderBall);

    // Upper Boom Link angled forward and upward
    const upperBoom = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.35, 16), materials.petgArmor));
    upperBoom.position.set(0.38, 0.82, 0);
    upperBoom.rotation.z = -0.58;
    armGroup.add(upperBoom);

    // Shoulder Linear Actuator Cylinder
    const actuatorCyl = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.85, 16), materials.titaniumBumper));
    actuatorCyl.position.set(0.18, 0.68, 0.14);
    actuatorCyl.rotation.z = -0.42;
    armGroup.add(actuatorCyl);

    // Elbow Hinge Joint
    const elbowJoint = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 16).rotateX(Math.PI / 2), materials.brassInsert));
    elbowJoint.position.set(0.72, 1.38, 0);
    armGroup.add(elbowJoint);

    // Forearm Link angled downward
    const forearm = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.15, 16), materials.petgArmor));
    forearm.position.set(1.08, 0.95, 0);
    forearm.rotation.z = 0.72;
    armGroup.add(forearm);

    // Wrist Hub & Two-Pronged Gripper Fork Claw (Template Images 1, 2, 5)
    const wrist = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.18, 16).rotateX(Math.PI / 2), materials.titaniumBumper));
    wrist.position.set(1.42, 0.52, 0);
    armGroup.add(wrist);

    const clawBar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 0.65), materials.titaniumBumper));
    clawBar.position.set(1.42, 0.52, 0);
    armGroup.add(clawBar);

    [-0.28, 0.28].forEach(pz => {
      const prong = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.08), materials.blueAnodized));
      prong.position.set(1.62, 0.46, pz);
      prong.rotation.z = -0.22;
      armGroup.add(prong);
    });

    upperShellGroup.add(armGroup);

    // PERCEPTION MAST ON FRONT-RIGHT DECK (Template Images 1, 2)
    const mastGroup = new THREE.Group();
    mastGroup.position.set(1.42, 1.73, -0.62);

    const mastPillar = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 1.35, 20), materials.petgArmor));
    mastPillar.position.y = 0.68;
    mastGroup.add(mastPillar);

    const mastRing = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 24), materials.blueAnodized));
    mastRing.position.y = 1.35;
    mastGroup.add(mastRing);

    // Spinning EC Buying YDLIDAR X2L 360° Turret
    const lidarPuck = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.18, 24), materials.darkAnodized));
    lidarPuck.position.y = 1.48;
    const lidarEye = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16).rotateZ(Math.PI / 2), materials.sensorOptics));
    lidarEye.position.set(0.16, 0, 0);
    lidarPuck.add(lidarEye);
    mastGroup.add(lidarPuck);

    // Arducam Navigation Camera on Mast
    const mastCamPcb = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.20), materials.arducamPcb));
    mastCamPcb.position.set(0.12, 1.25, 0);
    const mastCamLens = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16).rotateZ(Math.PI / 2), materials.sensorOptics));
    mastCamLens.position.set(0.16, 1.25, 0);
    mastGroup.add(mastCamPcb, mastCamLens);

    upperShellGroup.add(mastGroup);

    // =========================================================================
    // 5. VIEWPORT CONTROLS & CAMERA PRESETS
    // =========================================================================
    let isWireframe = false;
    let isExploded = false;

    const btnWireframe = document.getElementById('btn-wireframe');
    const btnExplode = document.getElementById('btn-explode');
    const btnResetCam = document.getElementById('btn-reset-cam');

    const camPresetBtns = document.querySelectorAll('.cam-preset-btn');
    const setCamActive = (activeView) => {
      camPresetBtns.forEach(b => {
        const isActive = (b.dataset.view === activeView);
        b.className = 'cam-preset-btn px-2.5 py-1 rounded transition-colors ' +
          (isActive ? 'bg-white/10 text-white font-medium shadow-sm' : 'hover:text-white text-slate-400');
      });
    };
    setCamActive('iso');

    camPresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        setCamActive(view);
        if (view === 'iso') {
          camera.position.set(10, 6.5, 11);
          controls.target.set(0, 1.2, 0);
        } else if (view === 'top') {
          camera.position.set(0, 15, 0.01);
          controls.target.set(0, 1.2, 0);
        } else if (view === 'side') {
          camera.position.set(0, 2.0, 12);
          controls.target.set(0, 1.2, 0);
        } else if (view === 'front') {
          camera.position.set(12, 2.0, 0);
          controls.target.set(0, 1.2, 0);
        } else if (view === 'bottom') {
          camera.position.set(0, -9.5, 0.01);
          controls.target.set(0, 0.8, 0);
        }
        controls.update();
      });
    });

    if (btnWireframe) {
      btnWireframe.addEventListener('click', () => {
        isWireframe = !isWireframe;
        inspectableMeshes.forEach(mesh => {
          if (mesh.material) {
            mesh.material.wireframe = isWireframe;
            mesh.material.needsUpdate = true;
          }
        });
        btnWireframe.textContent = isWireframe ? 'Wireframe: ON' : 'Wireframe: OFF';
        btnWireframe.classList.toggle('text-blue-400', isWireframe);
      });
    }

    if (btnExplode) {
      btnExplode.addEventListener('click', () => {
        isExploded = !isExploded;
        btnExplode.textContent = isExploded ? 'Assembly: Exploded' : 'Assembly: Nominal';
        btnExplode.classList.toggle('text-blue-400', isExploded);
      });
    }

    if (btnResetCam) {
      btnResetCam.addEventListener('click', () => {
        camera.position.set(10, 6.5, 11);
        controls.target.set(0, 1.2, 0);
        controls.update();
        if (typeof setCamActive === 'function') setCamActive('iso');
      });
    }

    // Subsystem Engineering Dossier
    const subsystemData = {
      chassis: {
        title: 'Polymaker Black PETG Chassis & Internal Electronics',
        lead: 'Ahrav, Sacheth & Harshan // Mechanical, CAD & Autonomy',
        desc: '3D-printed stealth-black Polymaker PETG armored shell with M3/M4 brass heat-set inserts, 6x 3007 (30x30x7mm) brushless cooling fans, GOLDENMATE 12V 10Ah LiFePO4 battery (IP67 BMS), SANOOV Raspberry Pi 5 4GB with Active Cooler, Arduino Uno REV3 (ATmega328P), and YRDZXG 12V/24V-to-5V 5A Buck Converter. Toggle Exploded View to inspect internals.'
      },
      locomotion: {
        title: '6x Greartisan 100RPM Drive & Underside Axles',
        lead: 'Ahrav & Harshan // Drivetrain & Locomotion',
        desc: 'Continuous transverse tubular axles with central mounting clamps (Template Image 5) and vertical drop yokes driven by 6 independent Greartisan 12V 100RPM 37mm gear motors with brass hex couplers and deep-chevron TPU/PETG lunar tires.'
      },
      cargobay: {
        title: 'Recessed Cargo Hopper Bed & Robotic Arm',
        lead: 'Sacheth & Ahrav // 3D Design & Assembly',
        desc: 'Recessed cargo hopper with perimeter retention walls and blue anodized guide rails locking the standardized NASA HUNCH lunar container, paired with the front deck articulated robotic arm and two-pronged gripper claw.'
      },
      avionics: {
        title: 'EC Buying YDLIDAR X2L 360° & Dual Arducam Suite',
        lead: 'Harshan // Autonomous Software & AI Vision Lead',
        desc: '360-degree YDLIDAR X2L optical laser scanner turret mounted on perception mast paired with forward stereo perception aperture and navigation cameras feeding the onboard neural autonomy stack.'
      }
    };

    const subBtns = document.querySelectorAll('.subsystem-select-btn');
    const subTitle = document.getElementById('cad-subsystem-title');
    const subLead = document.getElementById('cad-subsystem-lead');
    const subDesc = document.getElementById('cad-subsystem-desc');

    subBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const subKey = btn.dataset.subsystem;
        subBtns.forEach(b => {
          b.className = 'subsystem-select-btn px-3 py-2 text-left rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent transition-colors';
        });
        btn.className = 'subsystem-select-btn px-3 py-2 text-left rounded-lg text-xs font-medium text-white bg-slate-800 border border-slate-700 transition-colors';

        if (subsystemData[subKey]) {
          subTitle.textContent = subsystemData[subKey].title;
          subLead.textContent = subsystemData[subKey].lead;
          subDesc.textContent = subsystemData[subKey].desc;
        }

        if (subKey === 'chassis') {
          isExploded = true;
          if (btnExplode) { btnExplode.textContent = 'Assembly: Exploded'; btnExplode.classList.add('text-blue-400'); }
          controls.target.set(0, 1.4, 0);
        } else if (subKey === 'locomotion') {
          controls.target.set(0, 0.6, 1.2);
        } else if (subKey === 'cargobay') {
          controls.target.set(-0.7, 1.8, 0);
        } else if (subKey === 'avionics') {
          controls.target.set(1.4, 2.2, 0);
        }
        controls.update();
      });
    });

    // Window Resize
    window.addEventListener('resize', () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight, false);
    });

    // Render & Animation Loop
    let clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (lidarPuck) {
        lidarPuck.rotation.y += 4.5 * delta;
      }
      fanRotors.forEach(r => { r.rotation.z += 18.0 * delta; });

      // Smooth Exploded Animation (Lifts upper carapace to expose internal avionics bay)
      const targetExplodeY = isExploded ? 1.65 : 0;
      upperShellGroup.position.y += (targetExplodeY - upperShellGroup.position.y) * 0.08;

      controls.update();
      renderer.render(scene, camera);
    }

    animate();
  }

  // --- 2. LUNAR SURFACE ROUTE SIMULATION ---
  const simToggleBtn = document.getElementById('btn-sim-toggle');
  const simResetBtn = document.getElementById('btn-sim-reset');
  const simMarker = document.getElementById('rover-sim-marker');
  const simProgressBar = document.getElementById('sim-progress-bar');
  const simDistText = document.getElementById('sim-dist-text');
  const simPctText = document.getElementById('sim-pct-text');
  const metricSpeed = document.getElementById('metric-speed');
  const metricSlope = document.getElementById('metric-slope');
  const metricEta = document.getElementById('metric-eta');

  let isSimRunning = false;
  let simProgress = 0;
  let simAnimId = null;
  const TOTAL_DISTANCE = 850;

  const startX = 60, startY = 170;
  const midX = 360, midY = 145;
  const endX = 740, endY = 140;

  const updateSimUI = () => {
    const currentMeters = Math.round(simProgress * TOTAL_DISTANCE);
    const pct = Math.round(simProgress * 100);

    if (simProgressBar) simProgressBar.style.width = `${pct}%`;
    if (simDistText) simDistText.textContent = `${currentMeters} m`;
    if (simPctText) simPctText.textContent = `${pct}%`;

    let currX, currY;
    if (simProgress <= 0.5) {
      const t = simProgress * 2;
      currX = startX + (midX - startX) * t;
      currY = startY + (midY - startY) * t - Math.sin(t * Math.PI) * 20;
    } else {
      const t = (simProgress - 0.5) * 2;
      currX = midX + (endX - midX) * t;
      currY = midY + (endY - midY) * t + Math.sin(t * Math.PI) * 10;
    }

    if (simMarker) {
      simMarker.setAttribute('transform', `translate(${currX}, ${currY})`);
    }

    if (simProgress === 0) {
      if (metricSpeed) metricSpeed.textContent = '0.0 km/h';
      if (metricSlope) metricSlope.textContent = '+1.8°';
      if (metricEta) metricEta.textContent = '--:--';
    } else if (simProgress < 0.98) {
      const speed = (5.2 + Math.sin(simProgress * 15) * 0.6).toFixed(1);
      if (metricSpeed) metricSpeed.textContent = `${speed} km/h`;

      if (simProgress > 0.3 && simProgress < 0.45) {
        if (metricSlope) metricSlope.textContent = '+6.4° (Crater Margin)';
      } else {
        if (metricSlope) metricSlope.textContent = '+2.1°';
      }

      const remainingSecs = Math.max(0, Math.round((1 - simProgress) * 580));
      const mins = Math.floor(remainingSecs / 60);
      const secs = remainingSecs % 60;
      if (metricEta) metricEta.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    } else {
      if (metricSpeed) metricSpeed.textContent = '0.0 km/h (Docked)';
      if (metricSlope) metricSlope.textContent = '0.0°';
      if (metricEta) metricEta.textContent = '00:00';
    }
  };

  const simStep = () => {
    if (!isSimRunning) return;
    simProgress += 0.002;
    if (simProgress >= 1) {
      simProgress = 1;
      isSimRunning = false;
      if (simToggleBtn) simToggleBtn.textContent = 'Transit Complete';
    }
    updateSimUI();
    if (isSimRunning) {
      simAnimId = requestAnimationFrame(simStep);
    }
  };

  if (simToggleBtn) {
    simToggleBtn.addEventListener('click', () => {
      if (simProgress >= 1) simProgress = 0;
      isSimRunning = !isSimRunning;
      simToggleBtn.textContent = isSimRunning ? 'Pause Simulation' : 'Resume Simulation';
      if (isSimRunning) simStep();
      else cancelAnimationFrame(simAnimId);
    });
  }

  if (simResetBtn) {
    simResetBtn.addEventListener('click', () => {
      isSimRunning = false;
      simProgress = 0;
      cancelAnimationFrame(simAnimId);
      if (simToggleBtn) simToggleBtn.textContent = 'Start Simulation';
      updateSimUI();
    });
  }

  // --- 3. PAYLOAD MASS & ENERGY CALCULATOR ---
  const cargoCheckboxes = document.querySelectorAll('.cargo-checkbox');
  const calcMassEarth = document.getElementById('calc-mass-earth');
  const calcWeightLunar = document.getElementById('calc-weight-lunar');
  const calcCapacityPct = document.getElementById('calc-capacity-pct');
  const calcCapacityBar = document.getElementById('calc-capacity-bar');
  const calcCogOffset = document.getElementById('calc-cog-offset');
  const calcPowerEst = document.getElementById('calc-power-est');

  const updateCalculator = () => {
    let totalEarthKg = 0;
    let totalEnergyKwh = 0;
    let count = 0;

    cargoCheckboxes.forEach(cb => {
      if (cb.checked) {
        totalEarthKg += parseFloat(cb.dataset.mass || 0);
        totalEnergyKwh += parseFloat(cb.dataset.power || 0);
        count++;
      }
    });

    const lunarGravity = 1.622; // m/s^2
    const lunarWeightN = (totalEarthKg * lunarGravity).toFixed(1);
    const lunarMassKg = (totalEarthKg / 6).toFixed(1);
    const maxCapacity = 500;
    const capacityPct = Math.min(100, (totalEarthKg / maxCapacity) * 100).toFixed(1);

    if (calcMassEarth) calcMassEarth.textContent = `${totalEarthKg.toFixed(1)} kg`;
    if (calcWeightLunar) calcWeightLunar.textContent = `${lunarMassKg} kg (${lunarWeightN} N)`;
    if (calcCapacityPct) calcCapacityPct.textContent = `${capacityPct}%`;
    if (calcCapacityBar) calcCapacityBar.style.width = `${capacityPct}%`;
    if (calcPowerEst) calcPowerEst.textContent = `${(totalEnergyKwh + 1.2).toFixed(1)} kWh`;

    if (calcCogOffset) {
      if (totalEarthKg > maxCapacity) {
        calcCogOffset.textContent = 'Exceeds Structural Envelope';
        calcCogOffset.className = 'font-mono text-sm text-red-400 font-semibold';
      } else if (totalEarthKg === 0) {
        calcCogOffset.textContent = 'Neutral (0.0 cm)';
        calcCogOffset.className = 'font-mono text-sm text-slate-400';
      } else {
        calcCogOffset.textContent = `+${(0.6 + count * 0.4).toFixed(1)} cm (Within Margin)`;
        calcCogOffset.className = 'font-mono text-sm text-emerald-400 font-medium';
      }
    }
  };

  cargoCheckboxes.forEach(cb => cb.addEventListener('change', updateCalculator));
  updateCalculator();

  // Mode Selection
  document.querySelectorAll('.mode-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-switch-btn').forEach(b => {
        b.className = 'mode-switch-btn px-2.5 py-1 text-xs font-medium rounded text-slate-400 hover:text-white transition-colors';
      });
      btn.className = 'mode-switch-btn px-2.5 py-1 text-xs font-medium rounded bg-blue-600 text-white transition-colors';
    });
  });

});
