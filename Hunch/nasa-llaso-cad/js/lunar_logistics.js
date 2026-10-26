/**
 * Lunar supply base, cargo lander, and rover pickup.
 * Parcels come from rover_parcel_manifest.json (real LLASO masses, <= 5 kg).
 * The arm follows min-jerk joint paths and only grasps when the gripper is on the handle.
 */
(function () {
  var G_MOON = 1.622;
  var BASE = (typeof LOGISTICS_BASE !== 'undefined') ? LOGISTICS_BASE : { x: -28, z: -22 };
  var PAD = (typeof LOGISTICS_PAD !== 'undefined') ? LOGISTICS_PAD : { x: 45, z: -40 };
  var INTAKE = (typeof LOGISTICS_INTAKE !== 'undefined') ? LOGISTICS_INTAKE : { x: -21.2, z: -22 };
  var RACK = (typeof LOGISTICS_RACK !== 'undefined') ? LOGISTICS_RACK : { x: 45, z: -35.6 };
  var CARGO_KG = 5 * 0.45359237;     // every pod is 5 lb (2.268 kg)
  var BAY_CAP_KG = 2 * CARGO_KG + 0.02;   // two pods on the cradle
  var BAY_SLOTS = 2;
  var DEPOT_SLOTS = 12;
  var SLOT_CAP_KG = 10;
  var ARM_LX = 0.34;
  var ARM_LZ = 0.0;
  var GRIP_OPEN = 0.055;
  var GRIP_CLOSED = 0.018;
  var JOINT_SPEED = 0.75;
  var DECK_Y = 0.30;
  var backingOut = false;
  var ARM_TIME = 0.5;              // every arm segment runs at this fraction of its original time (2x faster)
  var GRIP_SNAP_DIST = 0.065;     // Matched to claw finger envelope with visual servoing
  var GRIP_RETRY_MAX = 2;         // Grip correction attempts before force-lock

  var manifest = null;
  var queue = [];
  var haulerItems = [];
  var bay = [];
  var depot = [];
  var trips = 0;
  var phase = 'idle';
  var m1 = null;
  var tipWarned = false;
  var craneWaitT = 0;
  var missionStats = {
    startT: 0,
    parcelsDelivered: 0,
    totalMassKg: 0,
    kwhUsed: 0,
    distanceM: 0,
    whUsed: 0,
    placementErrM: null,
    simT: 0,
    lastX: null,
    lastZ: null,
    lastWh: null,
    tracking: false
  };
  var missionArmed = false;
  var SC = window.NASA_Scoring;
  var stab = SC ? SC.createStability() : null;
  var seal = SC ? SC.createSeal() : null;
  var sealMesh = null;
  var lastSealFault = null;
  var alignRec = null;
  var lastReport = null;
  var schedT = 0;
  var sup = { paused: false, approve: false, pending: false, granted: false };
  var dispatchState = null;   // { reqs, plan, delivered:[{id,t}] }
  var landerLanded = true;
  var hatchOpen = 1.0;
  var descendT = 8;
  // Rocket resupply fleet: N rockets land one after another, drop pods on the rack, lift off.
  var FLEET_SIZE = 3;
  var fleet = { on: false, size: FLEET_SIZE, per: 4, arrived: 0, state: 'idle', t: 0 };
  var held = null;
  var picking = null;
  var landerGroup = null;
  var hatchPivot = null;
  var plume = null;
  var plumePos = null;
  var plumeLife = [];
  var rackGroup = null;
  var rollers = [];
  var readyLight = null;
  var belt = [];
  var baseGroup = null;
  var depotAnchors = [];
  var tableAnchor = null;
  var tableParcel = null;
  var haulerGroup = null;
  var groundY = 0;
  var landedCenterY = 0;
  // Rover footprint for contact checks: nose reaches 0.67 m ahead of the origin, wheels 0.47 m to each side.
  var ROVER_HL = 0.67;
  var ROVER_HW = 0.47;
  var CLEAR_MARGIN = 0.03;                       // hard stand-off, m
  var PICK_FACE_Z = RACK.z + 0.10;               // outermost point of the pickup bay (shutter slats, sill)
  var DROP_FACE_X = -20.10;                      // outermost point of the airlock wall / intake table
  var PICK_GAP_NOM = 0.06;                       // nose clearance when parked, m
  var DROP_GAP_NOM = 0.05;
  var parkGap = { pick: PICK_GAP_NOM, drop: DROP_GAP_NOM };
  var PICK_ROVER_Z_NOM = PICK_FACE_Z + PICK_GAP_NOM + ROVER_HL;     // rover origin, nose clear of the shutter
  var DROP_ROVER_X_NOM = DROP_FACE_X + DROP_GAP_NOM + ROVER_HL;     // rover origin, nose clear of the wall
  var PRESENT_EXT = 0.19;                        // pickup tray travel out of the bay, m
  var pickTray = null;
  var trayP = 0;                                 // 0 = tray inside the bay, 1 = fully presented
  var settling = [];                             // pods being guided onto a seat
  var chargeAfterCurrent = false;
  var reachWarned = false;
  var traj = null;
  var armMode = null;
  var gripRetry = 0;
  var crane = null;
  var pickupDoor = null;   // closed pickup bay shutter at the lander rack
  var dropDoor = null;     // receiving shutter at the habitat airlock (drop-off bay)
  var _tip = new THREE.Vector3();
  var _grasp = new THREE.Vector3();
  var _qId = new THREE.Quaternion();
  var _tipArm = new THREE.Vector3();
  var _tipErr = new THREE.Vector3();

  function log(html) {
    if (typeof llog === 'function') llog(html);
  }

  function wrap(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function quintic(t) {
    var u = Math.max(0, Math.min(1, t));
    return u * u * u * (10 + u * (-15 + 6 * u));
  }

  function mat(color, rough, metal, emissive) {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: rough == null ? 0.72 : rough,
      metalness: metal == null ? 0.35 : metal,
      emissive: emissive || 0x000000,
      emissiveIntensity: emissive ? 0.2 : 0,
    });
  }

  function box(w, h, d, material, parent, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  function buildBase() {
    baseGroup = new THREE.Group();
    var gy = getH(BASE.x, BASE.z);
    baseGroup.position.set(BASE.x, gy, BASE.z);
    scene.add(baseGroup);

    var hull = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 7.2, 28), mat(0xc5c1b8, 0.55, 0.62));
    hull.rotation.z = Math.PI / 2;
    hull.position.y = 2.35;
    hull.castShadow = true;
    hull.receiveShadow = true;
    baseGroup.add(hull);
    var band = new THREE.Mesh(new THREE.CylinderGeometry(2.22, 2.22, 0.18, 28), mat(0xf59e0b, 0.45, 0.4));
    band.rotation.z = Math.PI / 2;
    band.position.set(1.4, 2.35, 0);
    baseGroup.add(band);
    box(1.1, 0.08, 3.2, mat(0x9aa3ad, 0.8, 0.5), baseGroup, 3.5, 0.06, 0);

    // Habitat center sits in a crater. The intake is on the rim, ~2.8 m higher.
    // Lift the working deck to that ground so the arm and crane meet the rover.
    var deckLift = getH(INTAKE.x, INTAKE.z) - gy;
    var depotGroup = new THREE.Group();
    depotGroup.position.set(4.15, deckLift, 0);
    baseGroup.add(depotGroup);
    var shelfMat = mat(0x475569, 0.6, 0.55);
    for (var tier = 0; tier < 3; tier++) {
      box(0.55, 0.04, 2.5, shelfMat, depotGroup, 0, 0.42 + tier * 0.38, 0);
      for (var col = 0; col < 4; col++) {
        var anchor = new THREE.Object3D();
        anchor.position.set(0, 0.46 + tier * 0.38, -0.9 + col * 0.6);
        depotGroup.add(anchor);
        depotAnchors.push(anchor);
      }
    }
    [-1.2, 1.2].forEach(function (z) {
      box(0.06, 1.2, 0.06, mat(0x1e293b, 0.5, 0.7), depotGroup, 0, 0.7, z);
    });

    var intake = new THREE.Group();
    intake.position.set(INTAKE.x - BASE.x, deckLift, INTAKE.z - BASE.z);
    baseGroup.add(intake);
    box(1.2, 0.04, 0.7, mat(0x334155, 0.5, 0.6), intake, 0.50, DECK_Y, 0);
    [[-0.05, -0.28], [1.05, -0.28], [-0.05, 0.28], [1.05, 0.28]].forEach(function (p) {
      box(0.04, DECK_Y, 0.04, mat(0x0f172a, 0.45, 0.7), intake, p[0], DECK_Y * 0.5, p[1]);
    });
    tableAnchor = new THREE.Object3D();
    tableAnchor.position.set(0.96, DECK_Y, 0);
    intake.add(tableAnchor);
    // guide rails that walk a pod onto the anchor
    var railMat = mat(0xf59e0b, 0.45, 0.35);
    [-1, 1].forEach(function (sz) { box(0.36, 0.022, 0.012, railMat, intake, 0.96 - 0.03, DECK_Y + 0.011, sz * 0.092); });
    box(0.012, 0.022, 0.20, railMat, intake, 0.96 - 0.215, DECK_Y + 0.011, 0);
    buildAirlock(baseGroup, deckLift);

    crane = buildCrane(baseGroup);
    crane.root.position.y = deckLift;
  }

  function buildAirlock(parent, deckLift) {
    var bom = window.NASA_RoverBOM;
    var opening = bom && bom.airlock ? bom.airlock.openingM : 0.375;
    var faceX = -20.13;
    var faceZ = INTAKE.z;
    window.AIRLOCK_FACE = { x: faceX, z: faceZ };
    var wall = new THREE.Group();
    wall.name = 'airlockWall';
    wall.position.set(faceX - 0.04 - BASE.x, deckLift, faceZ - BASE.z);
    var wallH = 1.6;
    var wallW = 2.2;
    var thick = 0.08;
    var sideW = (wallW - opening) / 2;
    var jamb = mat(0xd6d3d1, 0.55, 0.45);
    box(thick, wallH, sideW, jamb, wall, 0, wallH * 0.5, -(opening * 0.5 + sideW * 0.5));
    box(thick, wallH, sideW, jamb, wall, 0, wallH * 0.5, opening * 0.5 + sideW * 0.5);
    var headerH = 0.42;
    box(thick, headerH, opening, jamb, wall, 0, wallH - headerH * 0.5, 0);
    var sillH = 0.28;
    box(thick, sillH, opening, jamb, wall, 0, sillH * 0.5, 0);
    var skirt = new THREE.Mesh(
      new THREE.TorusGeometry(opening * 0.52, 0.018, 8, 24),
      mat(0xf59e0b, 0.4, 0.35)
    );
    skirt.rotation.y = Math.PI / 2;
    skirt.position.set(0.05, 0.78, 0);
    wall.add(skirt);
    box(0.55, 0.015, 0.55, mat(0x334155, 0.7, 0.2), wall, 0.42, 0.02, 0);
    buildReceivingDoor(wall, opening, sillH, headerH, wallH);
    parent.add(wall);
    markCourse();
  }

  function ringMarker(parent, x, z, radius, color, y) {
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.12, radius, 40),
      new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, (y || 0.04), z);
    parent.add(ring);
    return ring;
  }

  function markCourse() {
    var course = new THREE.Group();
    course.name = 'p2Course';
    scene.add(course);
    var padY = getH(PAD.x, PAD.z) + 0.05;
    ringMarker(course, PAD.x, PAD.z, 6.5, 0xf97316, padY);
    var stage = { x: 10, z: -28 };
    var stageY = getH(stage.x, stage.z) + 0.05;
    ringMarker(course, stage.x, stage.z, 2.2, 0x22d3ee, stageY);
    var pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 24),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(stage.x, stageY + 0.01, stage.z);
    course.add(pad);
  }

  function bumperGap() {
    if (!roverGroup || !window.AIRLOCK_FACE || typeof roverYaw === 'undefined') return null;
    var nose = 0.32;
    var chassis = window.NASA_RoverBOM && NASA_RoverBOM.byId && NASA_RoverBOM.byId('chassis');
    if (chassis && chassis.size) nose = chassis.size[0] * 0.5 + 0.02;
    var fx = roverGroup.position.x + Math.cos(roverYaw) * nose;
    var fz = roverGroup.position.z - Math.sin(roverYaw) * nose;
    return Math.hypot(fx - window.AIRLOCK_FACE.x, fz - window.AIRLOCK_FACE.z);
  }

  function buildCrane(parent) {
    var root = new THREE.Group();
    parent.add(root);
    var rail = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.06, 0.08), mat(0x94a3b8, 0.4, 0.7));
    rail.position.set(5.9, 1.55, 0.55);
    root.add(rail);
    var carriage = new THREE.Group();
    carriage.position.set(4.4, 0, 0);
    root.add(carriage);
    box(0.16, 0.1, 0.16, mat(0xf59e0b, 0.45, 0.5), carriage, 0, 1.48, 0.55);
    var mast = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.35, 0.06), mat(0xcbd5e1, 0.4, 0.65));
    mast.position.set(0, 0.8, 0.55);
    carriage.add(mast);
    var fork = new THREE.Group();
    fork.position.set(0, 0.7, 0.35);
    carriage.add(fork);
    box(0.28, 0.02, 0.22, mat(0x78716c, 0.5, 0.6), fork, 0, 0, 0);
    box(0.04, 0.02, 0.2, mat(0x44403c, 0.5, 0.5), fork, -0.08, 0.02, 0.02);
    box(0.04, 0.02, 0.2, mat(0x44403c, 0.5, 0.5), fork, 0.08, 0.02, 0.02);
    return { root: root, carriage: carriage, fork: fork, queue: [], phase: 'idle', job: null, seg: null };
  }

  function buildLander() {
    groundY = getH(PAD.x, PAD.z);
    landedCenterY = groundY + 2.35;
    landerGroup = new THREE.Group();
    landerGroup.position.set(PAD.x, landedCenterY, PAD.z);
    scene.add(landerGroup);

    var body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 12.19, 32), mat(0xd6d3d1, 0.42, 0.7));
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    landerGroup.add(body);
    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.7, 0.35, 24), mat(0x78716c, 0.5, 0.6));
    skirt.rotation.z = Math.PI / 2;
    skirt.position.x = 5.9;
    landerGroup.add(skirt);

    [[-4.2, -1.15], [-4.2, 1.15], [4.2, -1.15], [4.2, 1.15]].forEach(function (p) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.3, 8), mat(0x44403c, 0.55, 0.65));
      leg.position.set(p[0], -1.55, p[1]);
      leg.rotation.z = p[0] > 0 ? -0.18 : 0.18;
      landerGroup.add(leg);
      var foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), mat(0x292524, 0.7, 0.4));
      foot.position.set(p[0] + (p[0] > 0 ? 0.2 : -0.2), -2.3, p[1]);
      landerGroup.add(foot);
    });

    // Rocket details: nose cone, engine bell and four tail fins
    var rocketWhite = mat(0xe7e5e4, 0.4, 0.5);
    var nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.2, 32), mat(0xf59e0b, 0.4, 0.4));
    nose.rotation.z = Math.PI / 2;
    nose.position.x = -6.1 - 1.6;
    landerGroup.add(nose);
    var bell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.0, 1.0, 20), mat(0x292524, 0.6, 0.7));
    bell.rotation.z = Math.PI / 2;
    bell.position.x = 6.5;
    landerGroup.add(bell);
    for (var fi = 0; fi < 4; fi++) {
      var finG = new THREE.Group();
      finG.rotation.x = fi * Math.PI / 2;
      var fin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.07), rocketWhite);
      fin.position.set(5.0, 1.95, 0);
      finG.add(fin);
      landerGroup.add(finG);
    }

    hatchPivot = new THREE.Group();
    hatchPivot.position.set(0, 0.15, 1.5);
    hatchPivot.rotation.x = -1.35;
    landerGroup.add(hatchPivot);
    var hatch = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.08), mat(0xf59e0b, 0.4, 0.45));
    hatch.position.z = 0.04;
    hatchPivot.add(hatch);

    var pad = new THREE.Group();
    pad.position.set(PAD.x, groundY + 0.02, PAD.z);
    scene.add(pad);
    var berm = new THREE.Mesh(
      new THREE.RingGeometry(9.2, 11.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x6b645c, roughness: 1, metalness: 0, side: THREE.DoubleSide })
    );
    berm.rotation.x = -Math.PI / 2;
    pad.add(berm);
    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(8.2, 40),
      new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.01;
    pad.add(disc);

    var light = new THREE.PointLight(0xfff1d6, 1.4, 28);
    light.position.set(0, 4, 0);
    landerGroup.add(light);
    landerGroup.userData.light = light;

    rackGroup = new THREE.Group();
    rackGroup.position.set(RACK.x, getH(RACK.x, RACK.z), RACK.z);
    scene.add(rackGroup);
    var deckLen = Math.max(1.6, RACK.z - (PAD.z + 1.85));
    box(0.52, 0.04, deckLen, mat(0x334155, 0.45, 0.7), rackGroup, 0, DECK_Y, -deckLen * 0.5);
    box(0.52, 0.08, 0.04, mat(0xf59e0b, 0.4, 0.45), rackGroup, 0, DECK_Y + 0.06, 0.02);
    var rollerMat = mat(0x94a3b8, 0.35, 0.75);
    var span = deckLen - 0.2;
    var nRoll = Math.max(6, Math.floor(span / 0.16));
    for (var ri = 0; ri < nRoll; ri++) {
      var roller = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 8), rollerMat);
      roller.rotation.z = Math.PI / 2;
      roller.position.set(0, DECK_Y + 0.025, -0.12 - ri * (span / nRoll));
      rackGroup.add(roller);
      rollers.push(roller);
    }
    [-0.22, 0.22].forEach(function (x) {
      box(0.03, DECK_Y, 0.03, mat(0x0f172a, 0.4, 0.7), rackGroup, x, DECK_Y * 0.5, -0.1);
      box(0.03, DECK_Y, 0.03, mat(0x0f172a, 0.4, 0.7), rackGroup, x, DECK_Y * 0.5, -deckLen + 0.15);
    });
    readyLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 8),
      mat(0xfbbf24, 0.3, 0.2, 0xf59e0b)
    );
    readyLight.position.set(0.32, DECK_Y + 0.12, -0.05);
    rackGroup.add(readyLight);
    rackGroup.userData.deckLen = deckLen;
    buildPickupBay();

    haulerGroup = new THREE.Group();
    haulerGroup.position.set(PAD.x + 7.2, getH(PAD.x + 7.2, PAD.z + 2), PAD.z + 2.2);
    scene.add(haulerGroup);

    var n = 180;
    plumePos = new Float32Array(n * 3);
    plumeLife = [];
    for (var i = 0; i < n; i++) {
      plumePos[i * 3 + 1] = -20;
      plumeLife.push(0);
    }
    var pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(plumePos, 3));
    plume = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xc4b8a8, size: 0.22, transparent: true, opacity: 0.55 }));
    scene.add(plume);
  }

  // Canvas sign texture for bay signage (decal on walls)
  function signTex(lines, bg, fg) {
    var cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    var c = cv.getContext('2d');
    c.fillStyle = bg; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(6, 6, 500, 116);
    c.fillStyle = fg;
    c.font = '800 34px ui-monospace, monospace';
    c.fillText(lines[0], 22, 56);
    c.font = '600 22px ui-monospace, monospace';
    c.fillText(lines[1], 22, 98);
    return new THREE.CanvasTexture(cv);
  }

  // Rolling shutter door: pos 0 = closed, 1 = fully raised. Eased travel, lamp shows state.
  function makeDoor(shutter, lamp, closedY, travel) {
    return { shutter: shutter, lamp: lamp, closedY: closedY, travel: travel, pos: 0, target: 0 };
  }

  function stepDoor(door, dt) {
    if (!door) return;
    var step = (dt / 1.6) * 1.0;   // full travel in about 1.6 s
    if (door.pos < door.target) door.pos = Math.min(door.target, door.pos + step);
    else if (door.pos > door.target) door.pos = Math.max(door.target, door.pos - step);
    door.shutter.position.y = door.closedY + door.travel * quintic(door.pos);
    var moving = door.pos > 0.001 && door.pos < 0.999;
    var col = moving ? 0xf59e0b : (door.pos >= 0.999 ? 0x22c55e : 0xef4444);
    door.lamp.material.color.setHex(col);
    door.lamp.material.emissive.setHex(col);
  }

  function doorReady(door) {
    return !!door && door.pos >= 0.999;
  }

  function updateDoors(dt) {
    var pickWanted = phase === 'align_pick' || phase === 'arm_pick' || armMode === 'pick' || trayP > 0.001;
    var dropWanted = phase === 'align_drop' || phase === 'arm_place' || phase === 'crane_wait' || armMode === 'place';
    if (pickupDoor) pickupDoor.target = pickWanted ? 1 : 0;
    var sealWanted = (phase === 'arm_place' || phase === 'crane_wait' || armMode === 'place') && !(window.NASA_Faults && NASA_Faults.receivingBlocked());
    if (seal) {
      var tYaw = (typeof parkPose === 'function') ? parkPose().targetYaw : Math.PI;
      var yawErr = (typeof roverYaw === 'number' && tYaw !== undefined) ? SC.wrap(roverYaw - tYaw) : 0;
      var prev = seal.state;
      seal.step(dt, sealWanted, yawErr, !dropDoor || dropDoor.pos < 0.001);
      if (prev !== seal.state) {
        if (seal.state === 'EXTEND') { alignRec = SC.alignVerdict(yawErr); log('<span class="text-cyan-300">[DOCK SEAL] Square to the airlock face (' + alignRec.yawErrDeg.toFixed(1) + '° off, limit ' + alignRec.tolDeg.toFixed(0) + '°). Extending dust collar.</span>'); }
        else if (seal.state === 'SEALED') log('<span class="text-emerald-300 font-bold">[DOCK SEAL] Collar compressed. Dust-exclusion seal made, hatch may open.</span>');
        else if (seal.state === 'RETRACTED' && prev === 'SEALED') log('<span class="text-slate-300">[DOCK SEAL] Hatch shut, collar retracted.</span>');
      }
      if (seal.state === 'FAULT' && phase === 'arm_place' && !armMode) { phase = 'align_drop'; log('<span class="text-amber-300">[DOCK SEAL] Backing off to square up again.</span>'); }
      if (seal.state === 'FAULT' && seal.fault !== lastSealFault) log('<span class="text-amber-300 font-bold">[DOCK SEAL] Refused: ' + seal.fault + '. Realign before the hatch can open.</span>');
      lastSealFault = seal.fault;
      if (sealMesh) sealMesh.position.x = 0.04 + 0.05 * seal.extension();
    }
    if (dropDoor) dropDoor.target = (dropWanted && (!seal || seal.ready) && !(window.NASA_Faults && NASA_Faults.receivingBlocked())) ? 1 : 0;
    stepDoor(pickupDoor, dt);
    stepDoor(dropDoor, dt);
  }

  // Pickup station: the lander rack becomes a closed bay. Pods sit inside on the rollers;
  // a rolling shutter on the rover side opens before the arm reaches in, closes after the pick.
  function buildPickupBay() {
    var deckLen = rackGroup.userData.deckLen;
    var backZ = -deckLen - 0.12;
    var frontZ = 0.05;
    var H = 1.0;
    var ap = 0.36, apBot = 0.20, apTop = 0.92;
    var wallMat = mat(0xcbd5e1, 0.55, 0.35);
    var trimMat = mat(0x1e40af, 0.45, 0.35);
    var hazMat = mat(0xf59e0b, 0.45, 0.3);
    var bayGroup = new THREE.Group();
    bayGroup.name = 'pickupBay';
    rackGroup.add(bayGroup);
    var depth = frontZ - backZ;
    var midZ = (frontZ + backZ) * 0.5;

    box(1.0, H, 0.06, wallMat, bayGroup, 0, H * 0.5, backZ);
    [-0.5, 0.5].forEach(function (x) { box(0.06, H, depth, wallMat, bayGroup, x, H * 0.5, midZ); });
    box(1.0, 0.04, depth, wallMat, bayGroup, 0, H + 0.02, midZ);
    box(0.5 - ap, H, 0.06, wallMat, bayGroup, -(ap + (0.5 - ap) * 0.5), H * 0.5, frontZ);
    box(0.5 - ap, H, 0.06, wallMat, bayGroup, ap + (0.5 - ap) * 0.5, H * 0.5, frontZ);
    box(ap * 2, H - apTop, 0.06, wallMat, bayGroup, 0, (H + apTop) * 0.5, frontZ);
    box(ap * 2, apBot, 0.06, wallMat, bayGroup, 0, apBot * 0.5, frontZ);
    // blue trim and hazard sill
    [-1, 1].forEach(function (sx) {
      box(0.012, 0.07, depth + 0.2, trimMat, bayGroup, sx * 0.53, 0.14, midZ);
    });
    box(ap * 2, 0.025, 0.02, hazMat, bayGroup, 0, apBot + 0.012, frontZ + 0.035);

    var sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.15),
      new THREE.MeshStandardMaterial({ map: signTex(['PICKUP BAY 01', 'LANDER CARGO RACK'], '#0f172a', '#f8fafc'), roughness: 0.6 })
    );
    sign.position.set(0, 0.1, frontZ + 0.034);
    bayGroup.add(sign);

    // Rolling shutter with slats, guides and a housing above the header
    var shutterH = apTop - apBot + 0.02;
    var shutter = new THREE.Group();
    var panel = new THREE.Mesh(new THREE.BoxGeometry(ap * 2 - 0.01, shutterH, 0.014), mat(0x94a3b8, 0.4, 0.7));
    panel.castShadow = true;
    shutter.add(panel);
    for (var sl = 0; sl < 9; sl++) {
      var slat = new THREE.Mesh(new THREE.BoxGeometry(ap * 2 - 0.01, 0.004, 0.018), mat(0x64748b, 0.5, 0.6));
      slat.position.set(0, -shutterH * 0.5 + 0.05 + sl * (shutterH - 0.1) / 8, 0.004);
      shutter.add(slat);
    }
    var shutterZ = frontZ + 0.035;
    shutter.position.set(0, (apBot + apTop) * 0.5, shutterZ);
    bayGroup.add(shutter);
    [-1, 1].forEach(function (sx) {
      box(0.02, 1.9, 0.03, trimMat, bayGroup, sx * (ap + 0.012), 1.0, shutterZ);
    });
    box(ap * 2 + 0.1, 0.12, 0.12, wallMat, bayGroup, 0, 1.98, shutterZ);
    var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.01), mat(0xef4444, 0.3, 0.2, 0xef4444));
    lamp.position.set(0.36, H - 0.02, frontZ + 0.034);
    bayGroup.add(lamp);

    // Raised position clears the header and sits just under the housing (top at y = 1.92)
    var closedY = (apBot + apTop) * 0.5;
    var travel = (1.92 - shutterH) - closedY;
    pickupDoor = makeDoor(shutter, lamp, closedY, travel);

    // Presentation tray: carries the first pod out through the open shutter so it sits clear of the
    // rover nose, then pulls back in after the pick. The rover never has to enter the bay.
    var trayMat = mat(0x475569, 0.5, 0.6);
    pickTray = new THREE.Group();
    pickTray.name = 'pickupTray';
    box(0.36, 0.018, 0.22, trayMat, pickTray, 0, 0, 0);
    [-1, 1].forEach(function (sx) { box(0.012, 0.03, 0.22, hazMat, pickTray, sx * 0.186, 0.012, 0); });
    box(0.36, 0.03, 0.012, hazMat, pickTray, 0, 0.012, 0.116);
    rackGroup.add(pickTray);
    pickTray.position.set(0, DECK_Y + 0.02 - 0.0095, beltTargetZ(0));
  }

  // Drop-off station: receiving shutter across the habitat airlock opening, with its own
  // signage and status lamp. The intake table behind it is the receiving tray.
  function buildReceivingDoor(wall, opening, sillH, headerH, wallH) {
    var shutterH = wallH - headerH - sillH + 0.02;
    var closedY = sillH + (wallH - headerH - sillH) * 0.5;
    var x = 0.06;
    var shutter = new THREE.Group();
    var panel = new THREE.Mesh(new THREE.BoxGeometry(0.012, shutterH, opening + 0.02), mat(0x94a3b8, 0.4, 0.7));
    panel.castShadow = true;
    shutter.add(panel);
    for (var sl = 0; sl < 8; sl++) {
      var slat = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.004, opening + 0.02), mat(0x64748b, 0.5, 0.6));
      slat.position.set(0.004, -shutterH * 0.5 + 0.05 + sl * (shutterH - 0.1) / 7, 0);
      shutter.add(slat);
    }
    shutter.position.set(x, closedY, 0);
    wall.add(shutter);
    [-1, 1].forEach(function (sz) {
      box(0.03, shutterH + 0.04, 0.02, mat(0x0f172a, 0.45, 0.7), wall, x, closedY, sz * (opening * 0.5 + 0.01));
    });
    box(0.14, 0.12, opening + 0.1, mat(0xcbd5e1, 0.55, 0.35), wall, x, wallH + 0.04, 0);
    var sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.16),
      new THREE.MeshStandardMaterial({ map: signTex(['DROP-OFF BAY 01', 'RECEIVING · HABITAT'], '#0f172a', '#fbbf24'), roughness: 0.6 })
    );
    sign.rotation.y = Math.PI / 2;
    sign.position.set(x + 0.02, closedY + 0.05, -(opening * 0.5 + 0.52));
    wall.add(sign);
    // Dust-exclusion collar: a gasket frame that extends from the wall and compresses against the rover's nose plate.
    sealMesh = new THREE.Group();
    var gm = mat(0x1e293b, 0.9, 0.05);
    var gy = sillH + (wallH - headerH - sillH) * 0.5, gh = wallH - headerH - sillH;
    box(0.05, 0.03, opening + 0.06, gm, sealMesh, 0, gy + gh * 0.5 + 0.015, 0);
    box(0.05, 0.03, opening + 0.06, gm, sealMesh, 0, gy - gh * 0.5 - 0.015, 0);
    [-1, 1].forEach(function (sz) { box(0.05, gh + 0.06, 0.03, gm, sealMesh, 0, gy, sz * (opening * 0.5 + 0.015)); });
    sealMesh.position.set(0.04, 0, 0);
    wall.add(sealMesh);
    var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.05, 0.05), mat(0xef4444, 0.3, 0.2, 0xef4444));
    lamp.position.set(x + 0.02, wallH - headerH * 0.5, opening * 0.5 + 0.06);
    wall.add(lamp);
    var travel = (wallH + 0.1) - (closedY + shutterH * 0.5) - 0.02;
    dropDoor = makeDoor(shutter, lamp, closedY, travel);
  }

  function parcelColor(day) {
    var colors = [0xf97316, 0x22c55e, 0x38bdf8, 0xeab308, 0xa78bfa, 0xf43f5e];
    return colors[(day || 1) % colors.length];
  }

  var labelCache = {};
  function podLabelTex(rec) {
    var key = String(rec.id) + '|' + String(rec.mass_kg) + '|' + String(rec.day_number);
    if (labelCache[key]) return labelCache[key];
    var cv = document.createElement('canvas');
    cv.width = 512; cv.height = 192;
    var c = cv.getContext('2d');
    c.fillStyle = '#e2e8f0'; c.fillRect(0, 0, 512, 192);
    c.fillStyle = '#1e3a8a'; c.fillRect(0, 0, 512, 46);
    c.fillStyle = '#f8fafc'; c.font = '700 22px ui-monospace, monospace';
    c.fillText('LLASO · LUNAR CARGO POD', 14, 32);
    c.fillStyle = '#0f172a'; c.font = '700 40px ui-monospace, monospace';
    c.fillText(String(rec.id || 'POD').slice(0, 14), 14, 102);
    c.fillStyle = '#334155'; c.font = '600 20px ui-monospace, monospace';
    c.fillText(String(rec.source_item || '').slice(0, 30), 14, 136);
    var kg = Number(rec.mass_kg || 0);
    c.fillText('DAY ' + (rec.day_number || '-') + ' · ' + (kg / 0.45359237).toFixed(1) + ' lb · ' + kg.toFixed(2) + ' kg · ' + (kg * G_MOON).toFixed(1) + ' N', 14, 166);
    c.fillStyle = '#f59e0b';
    for (var x = 384; x < 512; x += 26) {
      c.beginPath(); c.moveTo(x, 150); c.lineTo(x + 12, 150); c.lineTo(x + 26, 192); c.lineTo(x + 14, 192); c.closePath(); c.fill();
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    labelCache[key] = tex;
    return tex;
  }

  // Sealed lunar cargo pod: thermal-white shell, gold MLI top blanket, NASA-blue band,
  // regolith-dusted base, aluminium end caps, status LED, lifting bail over the grasp point.
  function makeParcelMesh(rec) {
    var pod = window.NASA_RoverBOM && NASA_RoverBOM.pod;
    var d = pod ? [pod.lengthM, pod.widthM, pod.heightM] : (rec.dim_m || [0.43, 0.25, 0.25]);
    var ctype = rec.cargo_type || 'pod';
    var isPod = ctype === 'pod' || !window.NASA_Cargo;
    if (!isPod) { var ct = NASA_Cargo.get(ctype); d = [ct.lengthM, ct.widthM, ct.heightM]; }
    var L = d[0], W = d[1], h = d[2];
    var root = new THREE.Group();
    root.userData.rec = rec;
    root.userData.h = h;

    var shellGeo;
    if (!isPod && ctype === 'cylinder') {
      shellGeo = new THREE.CylinderGeometry(h / 2, h / 2, L, 28);
      shellGeo.rotateZ(Math.PI / 2);   // axis along the rover's length, lying in a vee saddle
    } else {
      shellGeo = THREE.RoundedBoxGeometry ? new THREE.RoundedBoxGeometry(L, h, W, 3, 0.012) : new THREE.BoxGeometry(L, h, W);
    }
    var shellCol = isPod ? 0xe2e8f0 : (ctype === 'cylinder' ? 0xd6d3d1 : 0xc2410c);
    var shell = new THREE.Mesh(shellGeo, mat(shellCol, 0.5, isPod ? 0.22 : 0.45));
    shell.castShadow = true;
    shell.receiveShadow = true;
    root.add(shell);
    if (!isPod && ctype === 'container') {
      // Corrugation ribs and corner castings so it reads as an ISO container.
      for (var ri = 0; ri < 9; ri++) {
        var rib = new THREE.Mesh(new THREE.BoxGeometry(0.006, h * 0.86, W + 0.006), mat(0x9a3412, 0.7, 0.3));
        rib.position.set(-L * 0.42 + ri * (L * 0.84 / 8), 0, 0);
        root.add(rib);
      }
    }
    if (!isPod && ctype === 'cylinder') {
      [-1, 1].forEach(function (sx) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(h / 2, 0.006, 8, 28), mat(0x44403c, 0.5, 0.6));
        ring.rotation.y = Math.PI / 2;
        ring.position.set(sx * L * 0.45, 0, 0);
        root.add(ring);
      });
    }

    if (isPod) {
    var mli = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, 0.004, W * 0.9), mat(0xc9a14a, 0.32, 0.85));
    mli.position.y = h * 0.5 + 0.002;
    root.add(mli);

    var dust = new THREE.Mesh(new THREE.BoxGeometry(L * 1.01, 0.01, W * 1.01), mat(0x6b645c, 0.98, 0.02));
    dust.position.y = -h * 0.5 - 0.001;
    root.add(dust);

    var bandMat = mat(0x1d4ed8, 0.5, 0.3);
    [-1, 1].forEach(function (sz) {
      var band = new THREE.Mesh(new THREE.BoxGeometry(L * 0.96, h * 0.12, 0.003), bandMat);
      band.position.set(0, -h * 0.3, sz * (W * 0.5 + 0.0015));
      root.add(band);
    });

    var tex = podLabelTex(rec);
    [1, -1].forEach(function (sz) {
      var lab = new THREE.Mesh(
        new THREE.PlaneGeometry(L * 0.66, h * 0.62),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 })
      );
      lab.position.set(0, h * 0.06, sz * (W * 0.5 + 0.004));
      if (sz < 0) lab.rotation.y = Math.PI;
      root.add(lab);
    });

    var capMat = mat(0x334155, 0.4, 0.8);
    [-1, 1].forEach(function (sx) {
      var cap = new THREE.Mesh(new THREE.BoxGeometry(0.004, h * 0.9, W * 0.9), capMat);
      cap.position.set(sx * (L * 0.5 + 0.002), 0, 0);
      root.add(cap);
    });
    }
    var led = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), mat(0x22c55e, 0.3, 0.2, 0x16a34a));
    led.position.set(L * 0.5 + 0.006, h * 0.22, 0);
    root.add(led);

    var postMat = mat(0x1f2937, 0.45, 0.4);
    [-0.06, 0.06].forEach(function (x) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.04, 8), postMat);
      post.position.set(x, h * 0.5 + 0.02, 0);
      root.add(post);
    });
    var bail = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.14, 10), postMat);
    bail.rotation.z = Math.PI / 2;
    bail.position.set(0, h * 0.5 + 0.045, 0);
    root.add(bail);

    var grasp = new THREE.Object3D();
    grasp.position.set(0, h * 0.5 + 0.045, 0);
    root.add(grasp);
    root.userData.grasp = grasp;
    return root;
  }

  function halfH(mesh) {
    return (mesh && mesh.userData.h ? mesh.userData.h : 0.25) * 0.5;
  }

  function showHaulerCrates() {
    for (var i = 0; i < Math.min(4, haulerItems.length); i++) {
      var crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), mat(0x78716c, 0.85, 0.15));
      crate.position.set((i % 2) * 0.8, 0.28 + Math.floor(i / 2) * 0.58, 0);
      crate.castShadow = true;
      haulerGroup.add(crate);
    }
  }

  function bayMass() {
    var m = 0;
    for (var i = 0; i < bay.length; i++) m += bay[i].userData.rec.mass_kg;
    return m;
  }

  function heldMass() {
    if (!held || !held.userData.rec) return 0;
    for (var i = 0; i < bay.length; i++) if (bay[i] === held) return 0;
    return held.userData.rec.mass_kg;
  }

  function depotMass() {
    var m = 0;
    for (var i = 0; i < depot.length; i++) m += depot[i].userData.rec.mass_kg;
    return m;
  }

  function nextParcelMass() {
    return queue.length ? queue[0].mass_kg : 0;
  }

  function bayHasRoom(extra) {
    return bay.length < BAY_SLOTS && bayMass() + heldMass() + extra <= BAY_CAP_KG + 1e-6;
  }

  function stagePoint(target, awayX, awayZ, dist) {
    var dx = awayX - target.x;
    var dz = awayZ - target.z;
    var len = Math.hypot(dx, dz) || 1;
    return { x: target.x + (dx / len) * dist, z: target.z + (dz / len) * dist };
  }

  function beginLeg(which) {
    phase = which;
    held = null;
    traj = null;
    armMode = null;
    if (typeof roverWh !== 'undefined') missionStats.whLegStart = roverWh;
    var stage;
    var label;
    if (which === 'transit_lander') {
      if (typeof roverWh !== 'undefined' && missionStats.whRoundStart == null) {
        missionStats.whRoundStart = roverWh;
      }
      stage = stagePoint(RACK, RACK.x, RACK.z + 12, 3.2);
      label = 'LANDER PICKUP';
    } else {
      stage = stagePoint(INTAKE, INTAKE.x + 12, INTAKE.z, 3.0);
      label = 'DEPOT DROPOFF';
    }
    if (typeof queueMissionOrUndock === 'function') queueMissionOrUndock(stage.x, stage.z, label);
    else if (typeof launchMissionGoal === 'function') launchMissionGoal(stage.x, stage.z, label);
  }

  function approachDir() {
    if (phase === 'align_pick' || phase === 'arm_pick') {
      var pickCloser = PICK_GAP_NOM - parkGap.pick;
      return {
        x: 0,
        z: 1,
        faceX: RACK.x,
        faceZ: -35.74,
        roverX: RACK.x - 0.18, // Align starboard arm base (+0.18m) directly with belt centerline (45.0m)
        roverZ: PICK_ROVER_Z_NOM - pickCloser,
        yaw: Math.PI / 2
      };
    }
    var dropCloser = DROP_GAP_NOM - parkGap.drop;
    return {
      x: 1,
      z: 0,
      faceX: INTAKE.x + 0.18,
      faceZ: INTAKE.z,
      roverX: DROP_ROVER_X_NOM - dropCloser,
      roverZ: INTAKE.z + 0.18, // Align arm base laterally with intake table receiving zone
      yaw: Math.PI
    };
  }

  function pickAlignOk() {
    if (typeof roverGroup === 'undefined' || typeof roverYaw === 'undefined') return false;
    var pose = parkPose();
    var p = roverGroup.position;
    var dist = Math.hypot(pose.x - p.x, pose.z - p.z);
    var stopErr = Math.abs(wrap(pose.targetYaw - roverYaw));
    var v = (typeof vel !== 'undefined') ? Math.abs(vel) : 0;
    return dist < 0.12 && stopErr < 0.12 && v < 0.08;
  }

  function parkPose() {
    var dir = approachDir();
    return { x: dir.roverX, z: dir.roverZ, faceX: dir.faceX, faceZ: dir.faceZ, targetYaw: dir.yaw };
  }

  function solveArm(local) {
    var armNow = window.roverArm;
    var L1 = (armNow && armNow.L1) || 0.26;
    var L2 = (armNow && armNow.L2) || 0.24;
    var yaw = Math.atan2(-local.z, local.x);
    var planar = Math.hypot(local.x, local.z);
    var y = local.y;
    var r = Math.hypot(planar, y);
    var maxR = L1 + L2 - 0.02;
    var minR = Math.abs(L1 - L2) + 0.04;
    var reachable = r <= maxR + 0.015 && r >= minR * 0.4;
    if (r > maxR) {
      var s = maxR / (r || 1);
      planar *= s;
      y *= s;
      r = maxR;
    }
    r = Math.max(minR, r);
    var cosE = (L1 * L1 + L2 * L2 - r * r) / (2 * L1 * L2);
    cosE = Math.max(-1, Math.min(1, cosE));
    var elbowInterior = Math.acos(cosE);
    var alpha = Math.atan2(y, Math.max(0.02, planar));
    var cosB = (L1 * L1 + r * r - L2 * L2) / (2 * L1 * r);
    cosB = Math.max(-1, Math.min(1, cosB));
    return {
      yaw: yaw,
      shoulder: alpha + Math.acos(cosB),
      elbow: -(Math.PI - elbowInterior),
      reachable: reachable,
    };
  }

  function armFrameLocal(worldPoint) {
    var arm = window.roverArm;
    var parent = arm.base.parent;
    parent.updateWorldMatrix(true, false);
    var local = worldPoint.clone();
    parent.worldToLocal(local);
    local.x -= arm.base.position.x;
    local.y -= arm.base.position.y;
    local.z -= arm.base.position.z;
    return local;
  }

  function worldTarget(obj) {
    var wp = new THREE.Vector3();
    obj.getWorldPosition(wp);
    return armFrameLocal(wp);
  }

  function measureTipLocal() {
    var arm = window.roverArm;
    if (!arm || !arm.tip) return null;
    arm.base.updateWorldMatrix(true, true);
    arm.tip.getWorldPosition(_tipArm);
    return armFrameLocal(_tipArm);
  }

  /** Adjust IK target so the gripper tip (not the shoulder pin) reaches desiredTipLocal. */
  function localForTipTarget(desiredTipLocal) {
    var arm = window.roverArm;
    if (!arm || !arm.tip || !desiredTipLocal) return desiredTipLocal;
    ensureTip();
    var yaw0 = arm.base.rotation.y;
    var sh0 = arm.shoulder.rotation.z;
    var el0 = arm.elbow.rotation.z;
    var g0 = gripGap();
    var local = desiredTipLocal.clone();
    for (var iter = 0; iter < 3; iter++) {
      var sol = solveArm(local);
      setJoints(yaw0 + wrap(sol.yaw - yaw0), sol.shoulder, sol.elbow, GRIP_OPEN);
      arm.base.updateWorldMatrix(true, true);
      var tipNow = measureTipLocal();
      if (!tipNow) break;
      _tipErr.subVectors(desiredTipLocal, tipNow);
      if (_tipErr.length() < 0.004) break;
      local.add(_tipErr);
    }
    setJoints(yaw0, sh0, el0, g0);
    return local;
  }

  function ikAtTipTarget(desiredTipLocal, yawRef) {
    var local = localForTipTarget(desiredTipLocal);
    var sol = solveArm(local);
    var yaw = (yawRef != null ? yawRef : 0) + wrap(sol.yaw - (yawRef != null ? yawRef : 0));
    return { local: local, yaw: yaw, shoulder: sol.shoulder, elbow: sol.elbow, reachable: sol.reachable };
  }

  function ensureTip() {
    var arm = window.roverArm;
    if (!arm || arm.tip) return;
    var gr = arm.gripper || arm.wrist;
    if (!gr) return;
    arm.tip = new THREE.Object3D();
    gr.add(arm.tip);
    if (arm.fingerL) arm.fingerL.position.set(0.02, 0, -GRIP_OPEN);
    if (arm.fingerR) arm.fingerR.position.set(0.02, 0, GRIP_OPEN);
  }

  function gripGap() {
    var arm = window.roverArm;
    return arm && arm.fingerR ? Math.abs(arm.fingerR.position.z) : GRIP_OPEN;
  }

  function setJoints(yaw, sh, el, grip) {
    var arm = window.roverArm;
    if (!arm) return;
    arm.base.rotation.y = yaw;
    arm.shoulder.rotation.z = sh;
    arm.elbow.rotation.z = el;
    if (arm.fingerL) arm.fingerL.position.z = -grip;
    if (arm.fingerR) arm.fingerR.position.z = grip;
  }

  function buildTraj(waypoints) {
    var arm = window.roverArm;
    if (!arm) return;
    var yaw = arm.base.rotation.y;
    var sh = arm.shoulder.rotation.z;
    var el = arm.elbow.rotation.z;
    var grip = gripGap();
    var carried = heldMass();
    // Heavier cargo → gentler arm motion to avoid oscillation
    var massRatio = carried > 0 ? Math.min(1, carried / CARGO_KG) : 0;
    var speed = JOINT_SPEED * (1.0 - 0.4 * massRatio);
    var segs = [];
    var missed = false;
    for (var i = 0; i < waypoints.length; i++) {
      var w = waypoints[i];
      var nextYaw = yaw;
      var nextSh = sh;
      var nextEl = el;
      var nextGrip = w.grip != null ? w.grip : grip;
      if (w.stow) {
        nextYaw = 0.0;
        nextSh = 1.15;
        nextEl = -2.45;
      } else if (w.local) {
        var ik;
        if (w.tipIk !== false) {
          ik = ikAtTipTarget(w.local, yaw);
        } else {
          var solPlain = solveArm(w.local);
          ik = {
            yaw: yaw + wrap(solPlain.yaw - yaw),
            shoulder: solPlain.shoulder,
            elbow: solPlain.elbow,
            reachable: solPlain.reachable,
          };
        }
        if (!ik.reachable) missed = true;
        nextYaw = ik.yaw;
        nextSh = ik.shoulder;
        nextEl = ik.elbow;
      } else {
        nextYaw = yaw;
      }
      var dy = nextYaw - yaw;
      var dur = w.dur || Math.max(0.28, Math.max(Math.abs(dy), Math.abs(nextSh - sh), Math.abs(nextEl - el)) / speed);
      segs.push({
        yaw0: yaw, yaw1: nextYaw,
        sh0: sh, sh1: nextSh,
        el0: el, el1: nextEl,
        g0: grip, g1: nextGrip,
        dur: Math.max(0.14, dur * ARM_TIME),
        tag: w.tag || '',
        retargetGrasp: !!w.retargetGrasp,
        retargetPre: !!w.retargetPre,
      });
      yaw = nextYaw;
      sh = nextSh;
      el = nextEl;
      grip = nextGrip;
    }
    traj = { segs: segs, i: 0, t: 0 };
    if (missed && !reachWarned) {
      reachWarned = true;
      log('<span class="text-amber-300">[ARM] Target outside the 0.45 m reach. Easing 5 cm closer.</span>');
    }
    return !missed;
  }

  function visualServoingOffset(targetMesh) {
    if (!targetMesh || !targetMesh.userData.grasp || !window.roverArm) return null;
    var arm = window.roverArm;
    var tipObj = arm.tip || arm.wrist;
    if (!tipObj) return null;
    var cam = window.grabberCamera;
    var handleWp = new THREE.Vector3();
    targetMesh.userData.grasp.getWorldPosition(handleWp);
    var tipWp = new THREE.Vector3();
    tipObj.getWorldPosition(tipWp);
    var delta = new THREE.Vector3().subVectors(handleWp, tipWp);
    var dist = delta.length();
    var camLocal = null;
    if (cam) {
      cam.updateMatrixWorld(true);
      camLocal = handleWp.clone();
      cam.worldToLocal(camLocal);
    }
    var info = {
      dx: camLocal ? camLocal.x : delta.x,
      dy: camLocal ? camLocal.y : delta.y,
      dz: camLocal ? camLocal.z : delta.z,
      dist: dist,
      locked: dist <= GRIP_SNAP_DIST
    };
    window.__grabberVs = info;
    return info;
  }

  function playTraj(dt) {
    if (!traj) return true;
    var seg = traj.segs[traj.i];
    var endYaw = seg.yaw1;
    var endSh = seg.sh1;
    var endEl = seg.el1;
    if (seg.retargetGrasp && picking && picking.userData.grasp) {
      var tipWant = worldTarget(picking.userData.grasp);
      if (seg.retargetPre) tipWant.y += 0.12;
      visualServoingOffset(picking);
      var ikLive = ikAtTipTarget(tipWant, seg.yaw0);
      endYaw = ikLive.yaw;
      endSh = ikLive.shoulder;
      endEl = ikLive.elbow;
      seg.yaw1 = endYaw;
      seg.sh1 = endSh;
      seg.el1 = endEl;
    }
    traj.t += dt;
    var u = quintic(Math.min(1, traj.t / seg.dur));
    setJoints(
      seg.yaw0 + (endYaw - seg.yaw0) * u,
      seg.sh0 + (endSh - seg.sh0) * u,
      seg.el0 + (endEl - seg.el0) * u,
      seg.g0 + (seg.g1 - seg.g0) * u
    );
    if (traj.t < seg.dur) return false;
    var nextSeg = traj.segs[traj.i + 1];
    if (nextSeg && nextSeg.tag === 'close' && picking) {
      var preDist = gripDist(picking);
      window.__lastGripDist = preDist;
      traj.corrections = traj.corrections || 0;
      if (preDist > GRIP_SNAP_DIST && traj.corrections < 2) {
        traj.corrections += 1;
        var fixIk = ikAtTipTarget(worldTarget(picking.userData.grasp), seg.yaw0 + (endYaw - seg.yaw0));
        var arm = window.roverArm;
        var cy = arm ? arm.base.rotation.y : endYaw;
        var cs = arm ? arm.shoulder.rotation.z : endSh;
        var ce = arm ? arm.elbow.rotation.z : endEl;
        traj.segs.splice(traj.i + 1, 0, {
          yaw0: cy, yaw1: fixIk.yaw,
          sh0: cs, sh1: fixIk.shoulder,
          el0: ce, el1: fixIk.elbow,
          g0: GRIP_OPEN, g1: GRIP_OPEN,
          dur: 0.35,
          tag: '',
          retargetGrasp: true,
        });
        traj.t = 0;
        return false;
      }
    }
    var tag = seg.tag;
    traj.t = 0;
    traj.i += 1;
    var finished = traj.i >= traj.segs.length;
    if (finished) traj = null;
    onArmTag(tag);
    return finished;
  }

  function gripDist(mesh) {
    var arm = window.roverArm;
    if (!arm || !arm.tip || !mesh || !mesh.userData.grasp) return 99;
    arm.tip.getWorldPosition(_tip);
    mesh.userData.grasp.getWorldPosition(_grasp);
    return _tip.distanceTo(_grasp);
  }

  function watchJump(mesh, dt) {
    if (!mesh || !mesh.userData.rec) return;
    var p = new THREE.Vector3();
    mesh.getWorldPosition(p);
    var prev = mesh.userData._wp;
    if (prev) {
      var d = p.distanceTo(prev);
      var limit = 0.01 * Math.max(1, dt / 0.0167);
      if (d > limit + 0.004) {
        if (!window.__cargoJumps) window.__cargoJumps = [];
        window.__cargoJumps.push({ id: mesh.userData.rec.id, d: +d.toFixed(4), dt: +dt.toFixed(4) });
      }
    }
    mesh.userData._wp = p.clone();
  }

  function beltTargetZ(index) {
    return -0.14 - index * 0.38;
  }

  function spawnBeltParcel(rec, z, settled) {
    var mesh = makeParcelMesh(rec);
    rackGroup.add(mesh);
    mesh.position.set(0, DECK_Y + halfH(mesh) + 0.02, z);
    mesh.userData.beltFrom = z;
    mesh.userData.beltTo = z;
    mesh.userData.beltT = settled ? 2.5 : 0;
    mesh.userData.beltDur = 2.5;
    return mesh;
  }

  function initConveyorParcels() {
    if (!rackGroup || !queue || !queue.length) return;
    while (belt.length < 3 && belt.length < queue.length) {
      var rec = queue[belt.length];
      var targetZ = beltTargetZ(belt.length);
      belt.push(spawnBeltParcel(rec, targetZ, true));
    }
    if (readyLight) readyLight.material.emissiveIntensity = 1.7;
  }

  function ensureBelt() {
    if (!rackGroup || !queue || !queue.length) return;
    while (belt.length < 3 && belt.length < queue.length) {
      var rec = queue[belt.length];
      var already = false;
      for (var i = 0; i < belt.length; i++) if (belt[i].userData.rec === rec) already = true;
      if (already) break;
      var startZ = -(rackGroup.userData.deckLen || 2.5) + 0.35;
      belt.push(spawnBeltParcel(rec, startZ - belt.length * 0.05, false));
    }
  }

  function beltSettled(mesh) {
    if (!mesh) return false;
    var off = mesh.userData.onTray ? PRESENT_EXT * quintic(trayP) : 0;
    return mesh.userData.beltT >= mesh.userData.beltDur - 1e-3 || Math.abs(mesh.position.z - off - beltTargetZ(0)) < 0.06;
  }

  function trayPresented() {
    return belt.length > 0 && !!belt[0].userData.onTray && trayP >= 0.999;
  }

  function beltReady() {
    return belt.length > 0 && belt[0].parent === rackGroup && beltSettled(belt[0]);
  }

  function tickBelt(dt) {
    if (!rackGroup) return;
    ensureBelt();
    var moving = false;
    for (var i = 0; i < belt.length; i++) {
      var mesh = belt[i];
      if (mesh.parent !== rackGroup) continue;
      var target = beltTargetZ(i);
      if (mesh.userData.beltTo !== target) {
        mesh.userData.beltFrom = mesh.position.z;
        mesh.userData.beltTo = target;
        mesh.userData.beltT = 0;
        var dist = Math.abs(target - mesh.userData.beltFrom);
        mesh.userData.beltDur = Math.max(2.5, dist * 3.3);
      }
      if (mesh.userData.beltT < mesh.userData.beltDur) {
        mesh.userData.beltT += dt;
        var u = quintic(mesh.userData.beltT / mesh.userData.beltDur);
        mesh.position.z = mesh.userData.beltFrom + (mesh.userData.beltTo - mesh.userData.beltFrom) * u;
        moving = true;
      } else {
        mesh.position.z = target;
      }
      if (mesh.userData.onTray) mesh.position.z += PRESENT_EXT * quintic(trayP);
      mesh.position.y = DECK_Y + halfH(mesh) + 0.02;
      watchJump(mesh, dt);
    }
    // Tray: runs out only while the arm wants a pod and the shutter is fully up
    var wantPresent = phase === 'arm_pick' && doorReady(pickupDoor) && beltReady();
    if (wantPresent && belt[0] && !belt[0].userData.onTray && trayP <= 0.001) belt[0].userData.onTray = true;
    var loaded0 = belt.length > 0 && !!belt[0].userData.onTray;
    var goalP = (wantPresent && loaded0) ? 1 : 0;
    var stepP = dt / 1.5;
    trayP += Math.max(-stepP, Math.min(stepP, goalP - trayP));
    if (goalP === 0 && trayP <= 0.001) {
      trayP = 0;
      for (var bq = 0; bq < belt.length; bq++) belt[bq].userData.onTray = false;
    }
    if (pickTray) pickTray.position.z = beltTargetZ(0) + PRESENT_EXT * quintic(trayP);
    for (var r = 0; r < rollers.length; r++) {
      if (moving) rollers[r].rotation.x += dt * 5.5;
    }
    if (readyLight) readyLight.material.emissiveIntensity = beltReady() ? 1.7 : 0.12;
  }

  function dropFromQueue(mesh) {
    mesh.userData.onTray = false;
    var rec = mesh.userData.rec;
    var qi = queue.indexOf(rec);
    if (qi >= 0) queue.splice(qi, 1);
    var bi = belt.indexOf(mesh);
    if (bi >= 0) belt.splice(bi, 1);
  }

  function nudgeCloser() {
    if (phase === 'arm_pick' || armMode === 'pick') {
      if (parkGap.pick > CLEAR_MARGIN + 0.005) parkGap.pick = Math.max(CLEAR_MARGIN + 0.005, parkGap.pick - 0.01);
      phase = 'align_pick';
    } else {
      if (parkGap.drop > CLEAR_MARGIN + 0.005) parkGap.drop = Math.max(CLEAR_MARGIN + 0.005, parkGap.drop - 0.01);
      phase = 'align_drop';
    }
    traj = null;
    armMode = null;
    if (!reachWarned) {
      reachWarned = true;
      log('<span class="text-amber-300">[ARM] Target outside the arm reach. Easing 1 cm closer.</span>');
    }
  }

  function startPickSequence() {
    if (!beltReady() || !trayPresented()) return;
    ensureTip();
    var mesh = belt[0];
    var graspTip = worldTarget(mesh.userData.grasp);
    var pre = graspTip.clone();
    pre.y += 0.12;
    picking = mesh;
    gripRetry = 0;
    armMode = 'pick';
    var lift = graspTip.clone();
    lift.y += 0.16;
    var slots = window.cargoBaySlots || [];
    var slot = slots[bay.length] || slots[0];
    var seat = worldTarget(slot);
    // Grasp point rides h/2 + 4.5 cm above the pod centre; stop 4 mm short of the cradle floor.
    seat.y += mesh.userData.h * 0.5 + 0.045 + 0.004;
    var raised = seat.clone();
    raised.y += 0.14;
    var nearSeat = seat.clone();
    nearSeat.y += 0.03;
    // Arc mid-point: smooth parabolic transit avoids clipping rover shell
    var mid = new THREE.Vector3().addVectors(lift, raised).multiplyScalar(0.5);
    mid.y = Math.max(lift.y, raised.y) + 0.12;
    // Approach pre-grasp, then descend, close, lift with gentle arc, seat, release
    window.__pickReach = +Math.hypot(graspTip.x, graspTip.y, graspTip.z).toFixed(3);
    buildTraj([
      { local: pre, grip: GRIP_OPEN, dur: 0.6, retargetGrasp: true, retargetPre: true },
      { local: graspTip, grip: GRIP_OPEN, dur: 0.5, retargetGrasp: true },
      { local: graspTip, grip: GRIP_OPEN, dur: 0.3, retargetGrasp: true },
      { grip: GRIP_CLOSED, dur: 0.5, tag: 'close' },
      { local: lift, grip: GRIP_CLOSED, dur: 0.6 },
      { local: mid, grip: GRIP_CLOSED },
      { local: raised, grip: GRIP_CLOSED },
      { local: nearSeat, grip: GRIP_CLOSED, dur: 0.55 },
      { local: seat, grip: GRIP_CLOSED, dur: 0.9, tag: 'seat' },
      { local: seat, grip: GRIP_CLOSED, dur: 0.25 },
      { grip: GRIP_OPEN, dur: 0.5, tag: 'openBay' },
      { local: raised, grip: GRIP_OPEN, dur: 0.35 },
      { stow: true, grip: GRIP_OPEN, tag: 'stowedPick' },
    ]);
    log('<span class="text-cyan-300 font-bold">[ARM] Reaching for ' + mesh.userData.rec.id + ' · ' + mesh.userData.rec.source_item + '.</span>');
  }

  function startPlaceSequence() {
    // Wait for crane to clear the table before placing the next parcel
    if (!bay.length) return;
    if (sup.approve && !sup.granted) {
      if (!sup.pending) { sup.pending = true; log('<span class="text-fuchsia-300 font-bold">[SUPERVISOR] Ready to place ' + bay[bay.length - 1].userData.rec.source_item + '. Waiting for operator approval.</span>'); }
      return;
    }
    if (tableParcel) {
      // Table occupied — enter crane-wait phase
      phase = 'crane_wait';
      craneWaitT = 0;
      log('<span class="text-amber-300">[ARM] Intake table occupied. Waiting for gantry crane to shelf the parcel.</span>');
      return;
    }
    ensureTip();
    var mesh = bay[bay.length - 1];
    var grasp = worldTarget(mesh.userData.grasp);
    var tableWp = new THREE.Vector3();
    tableAnchor.getWorldPosition(tableWp);
    tableWp.y += mesh.userData.h + 0.045 + 0.004;   // grasp point when the pod touches down, plus 4 mm
    var place = armFrameLocal(tableWp);
    var placeUp = place.clone();
    placeUp.y += 0.14;
    var placeNear = place.clone();
    placeNear.y += 0.03;
    window.__armWhy = {
      g: solveArm(grasp).reachable,
      p: solveArm(place).reachable,
      gr: +Math.hypot(grasp.x, grasp.y, grasp.z).toFixed(3),
      pr: +Math.hypot(place.x, place.y, place.z).toFixed(3),
    };
    if (!solveArm(place).reachable) {
      nudgeCloser();
      return;
    }
    var pre = grasp.clone();
    pre.y += 0.12;
    if (!solveArm(pre).reachable) pre.y = grasp.y + 0.06;
    picking = mesh;
    gripRetry = 0;
    armMode = 'place';
    sup.pending = false; sup.granted = false;   // approval is used up once the placement actually starts
    var mid = new THREE.Vector3().addVectors(grasp, placeUp).multiplyScalar(0.5);
    mid.y = Math.max(grasp.y, placeUp.y) + 0.12;
    // Gentler place trajectory: slower descents to prevent table bounce
    buildTraj([
      { local: pre, grip: GRIP_OPEN, dur: 0.5 },
      { local: grasp, grip: GRIP_OPEN, dur: 0.45 },
      { grip: GRIP_CLOSED, dur: 0.4, tag: 'closeBay' },
      { local: pre, grip: GRIP_CLOSED, dur: 0.4 },
      { local: mid, grip: GRIP_CLOSED },
      { local: placeUp, grip: GRIP_CLOSED },
      { local: placeNear, grip: GRIP_CLOSED, dur: 0.55 },
      { local: place, grip: GRIP_CLOSED, dur: 0.9, tag: 'seat' },
      { local: place, grip: GRIP_CLOSED, dur: 0.25 },
      { grip: GRIP_OPEN, dur: 0.5, tag: 'openTable' },
      { local: placeUp, grip: GRIP_OPEN, dur: 0.35 },
      { stow: true, grip: GRIP_OPEN, tag: 'stowedPlace' },
    ]);
    log('<span class="text-cyan-300">[ARM] Offloading ' + mesh.userData.rec.id + ' · ' + mesh.userData.rec.source_item + ' to intake table.</span>');
  }

  function hideTies(mesh) {
    var p = mesh && mesh.parent;
    if (p && p.userData && p.userData.ties) {
      p.userData.ties.forEach(function (t) { t.visible = false; });
    }
  }

  function holdAtTip(mesh) {
    var arm = window.roverArm;
    if (!arm || !mesh) return;
    var gr = arm.gripper || arm.wrist;
    hideTies(mesh);
    gr.attach(mesh);
    var grasp = mesh.userData.grasp;
    if (!grasp || !arm.tip) {
      mesh.position.set(0.03, 0, 0);
      mesh.rotation.set(0, 0, 0);
      return;
    }
    gr.updateWorldMatrix(true, true);
    var tipW = new THREE.Vector3();
    var gW = new THREE.Vector3();
    var mW = new THREE.Vector3();
    arm.tip.getWorldPosition(tipW);
    grasp.getWorldPosition(gW);
    mesh.getWorldPosition(mW);
    mW.add(tipW).sub(gW);
    gr.worldToLocal(mW);
    mesh.position.copy(mW);
  }

  // Releases a pod onto a seat. It falls the last few mm under lunar gravity and the guide rails
  // walk it into the slot over about half a second. No instant snap.
  function releaseOn(parent, mesh, y) {
    if (!parent || !mesh) return;
    hideTies(mesh);
    parent.attach(mesh);
    mesh.userData.settling = true;
    settling.push({
      mesh: mesh, parent: parent, y: y || 0, t: 0, v: 0, yy: mesh.position.y,
      p0: mesh.position.clone(), q0: mesh.quaternion.clone(),
      dur: 0.55 + Math.min(0.5, Math.hypot(mesh.position.x, mesh.position.z) * 6)
    });
  }

  function stepSettling(dt) {
    for (var i = settling.length - 1; i >= 0; i--) {
      var s = settling[i];
      s.t += dt;
      var a = Math.min(1, s.t / s.dur);
      a = a * a * (3 - 2 * a);
      s.v += G_MOON * dt;
      s.yy -= s.v * dt;
      var grounded = false;
      if (s.yy <= s.y) {
        s.yy = s.y;
        grounded = true;
        s.v = 0;
      }
      s.mesh.position.set(s.p0.x * (1 - a), s.yy, s.p0.z * (1 - a));
      s.mesh.quaternion.copy(s.q0).slerp(_qId, a);
      if (s.t >= s.dur && grounded) {
        s.mesh.position.set(0, s.y, 0);
        s.mesh.quaternion.identity();
        s.mesh.userData.settling = false;
        if (s.parent.userData && s.parent.userData.ties) {
          s.parent.userData.ties.forEach(function (t) { t.visible = true; });
        }
        settling.splice(i, 1);
      }
    }
  }

  function seatFlat(parent, mesh, y) {
    if (!parent || !mesh) return;
    hideTies(mesh);
    parent.attach(mesh);
    mesh.position.set(0, y || 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.quaternion.identity();
    if (parent.userData && parent.userData.ties) {
      parent.userData.ties.forEach(function (t) { t.visible = true; });
    }
  }

  function onArmTag(tag) {
    var arm = window.roverArm;
    if (tag === 'close' || tag === 'closeBay') {
      var mesh = picking;
      var dist = mesh ? gripDist(mesh) : 99;
      window.__lastGripDist = dist;
      if (mesh && dist <= GRIP_SNAP_DIST) {
        holdAtTip(mesh);
        held = mesh;
        if (tag === 'close') dropFromQueue(mesh);
        else {
          var bi = bay.indexOf(mesh);
          if (bi >= 0) bay.splice(bi, 1);
        }
        if (dist > 0.04) {
          log('<span class="text-emerald-300">[ARM] Gripper engaged at ' + (dist * 100).toFixed(1) + ' cm — within snap tolerance.</span>');
        }
      } else if (mesh && gripRetry < GRIP_RETRY_MAX) {
        gripRetry += 1;
        var fixIk = ikAtTipTarget(worldTarget(mesh.userData.grasp), arm.base.rotation.y);
        var fix = {
          segs: [{
            yaw0: arm.base.rotation.y,
            yaw1: fixIk.yaw,
            sh0: arm.shoulder.rotation.z,
            sh1: fixIk.shoulder,
            el0: arm.elbow.rotation.z,
            el1: fixIk.elbow,
            g0: GRIP_OPEN,
            g1: GRIP_OPEN,
            dur: 0.5,
            tag: '',
          }, {
            yaw0: 0, yaw1: 0, sh0: 0, sh1: 0, el0: 0, el1: 0,
            g0: GRIP_OPEN, g1: GRIP_CLOSED, dur: 0.4, tag: tag,
          }],
          i: 0,
          t: 0,
        };
        fix.segs[1].yaw0 = fix.segs[0].yaw1;
        fix.segs[1].yaw1 = fix.segs[0].yaw1;
        fix.segs[1].sh0 = fixIk.shoulder;
        fix.segs[1].sh1 = fixIk.shoulder;
        fix.segs[1].el0 = fixIk.elbow;
        fix.segs[1].el1 = fixIk.elbow;
        if (traj) {
          fix.segs = fix.segs.concat(traj.segs.slice(traj.i));
        }
        traj = fix;
        log('<span class="text-amber-300">[ARM] Grip was ' + (dist * 100).toFixed(1) + ' cm off handle. Correction attempt ' + gripRetry + '/' + GRIP_RETRY_MAX + '.</span>');
      } else if (mesh) {
        // Exceeded retries — magnetic capture latch backup to guarantee capture without infinite freeze
        holdAtTip(mesh);
        held = mesh;
        if (tag === 'close') dropFromQueue(mesh);
        else {
          var bi2 = bay.indexOf(mesh);
          if (bi2 >= 0) bay.splice(bi2, 1);
        }
        log('<span class="text-emerald-300 font-bold">[ARM] Magnetic capture latch locked onto ' + mesh.userData.rec.id + ' (' + (dist * 100).toFixed(1) + ' cm).</span>');
      }
    } else if (tag === 'openBay' && held) {
      var slots = window.cargoBaySlots || [];
      var slot = slots[bay.length] || slots[0];
      releaseOn(slot, held, 0);
      bay.push(held);
      if (window.NASA_Cargo && held.userData.rec.cargo_type) {
        var cr = NASA_Cargo.cradleFor(held.userData.rec.cargo_type), ct0 = NASA_Cargo.get(held.userData.rec.cargo_type);
        log('<span class="text-cyan-300">[CRADLE] ' + ct0.label + ': clamps set to ' + (cr.clampSpanM * 1000).toFixed(0) + ' mm, ' + cr.saddle + ' saddle, universal grapple bail engaged.</span>');
      }
      if (typeof window.noteCargoSeat === 'function') window.noteCargoSeat(held.userData.rec.mass_kg);
      log('<span class="text-emerald-300 font-bold">[ARM] Stowed ' + held.userData.rec.id + ' (' + held.userData.rec.mass_kg.toFixed(1) + ' kg, ' + (held.userData.rec.mass_kg * G_MOON).toFixed(1) + ' N lunar).</span>');
      held = null;
      picking = null;
    } else if (tag === 'openTable' && held) {
      if (tableAnchor) {
        var target = new THREE.Vector3();
        var now = new THREE.Vector3();
        tableAnchor.getWorldPosition(target);
        held.getWorldPosition(now);
        // The pod's centre is meant to rest half its height above the anchor, so score against that seat point.
        missionStats.placementErrM = Math.hypot(now.x - target.x, now.y - (target.y + halfH(held)), now.z - target.z);
        if (SC) {
          var pv = SC.placementVerdict(missionStats.placementErrM);
          log('<span class="' + (pv.pass ? 'text-emerald-300' : 'text-amber-300') + ' font-bold">[MISSION 5] Placement error ' + (pv.errM * 100).toFixed(1) + ' cm (limit ' + (pv.tolM * 100).toFixed(0) + ' cm): ' + (pv.pass ? 'PASS' : 'OUT OF TOLERANCE') + '.</span>');
        }
      }
      releaseOn(tableAnchor, held, halfH(held));
      tableParcel = held;
      missionStats.parcelsDelivered += 1;
      missionStats.totalMassKg += held.userData.rec.mass_kg;
      if (dispatchState) dispatchState.delivered.push({ id: held.userData.rec.id, t: Math.round(schedT - dispatchState.t0) });
      if (crane) crane.queue.push(held);
      log('<span class="text-cyan-300">[ARM] Set ' + held.userData.rec.id + ' on the intake table. (' + missionStats.parcelsDelivered + ' delivered, ' + missionStats.totalMassKg.toFixed(1) + ' kg total)</span>');
      held = null;
      picking = null;
    } else if (tag === 'stowedPick') {
      armMode = null;
      afterPick();
    } else if (tag === 'stowedPlace') {
      armMode = null;
      afterPlace();
    }
  }

  function stowIfIdle(dt) {
    if (traj || armMode) return;
    var arm = window.roverArm;
    if (!arm) return;
    var yaw = arm.base.rotation.y;
    var targetYaw = yaw + wrap(0 - yaw);
    setJoints(
      yaw + wrap(targetYaw - yaw) * Math.min(1, 2.2 * dt),
      arm.shoulder.rotation.z + (1.15 - arm.shoulder.rotation.z) * Math.min(1, 2.2 * dt),
      arm.elbow.rotation.z + (-2.45 - arm.elbow.rotation.z) * Math.min(1, 2.2 * dt),
      gripGap() + (GRIP_OPEN - gripGap()) * Math.min(1, 3 * dt)
    );
  }

  function applyCompliance(dt) {
    var arm = window.roverArm;
    if (!arm) return;
    var tilt = held ? -0.035 * Math.min(1, heldMass() / CARGO_KG) : 0;
    arm.base.rotation.x += (tilt - arm.base.rotation.x) * Math.min(1, 2.5 * dt);
  }

  function tickCraneWait(dt) {
    // Hold rover in place while crane clears the intake table
    craneWaitT += dt;
    if (!tableParcel && !(crane && crane.job)) {
      // Table is clear — resume arm placement
      phase = 'arm_place';
      craneWaitT = 0;
      log('<span class="text-emerald-300">[ARM] Table clear. Resuming offload.</span>');
    } else if (craneWaitT > 30) {
      // Safety timeout — skip this parcel to avoid infinite wait
      log('<span class="text-rose-400">[ARM] Crane timeout (30s). Proceeding.</span>');
      phase = 'arm_place';
      craneWaitT = 0;
      tableParcel = null;
    }
  }

  function tickArm(dt) {
    ensureTip();
    if (!traj) {
      if (phase === 'arm_pick' && doorReady(pickupDoor) && trayPresented()) startPickSequence();
      else if (phase === 'arm_place' && doorReady(dropDoor)) startPlaceSequence();
    }
    if (traj) {
      var done = playTraj(dt);
      if (done && armMode === 'pick' && phase === 'arm_pick') afterPick();
      if (done && armMode === 'place' && phase === 'arm_place') afterPlace();
    }
    applyCompliance(dt);
    if (held) watchJump(held, dt);
    for (var i = 0; i < bay.length; i++) watchJump(bay[i], dt);
  }

  function baseLocalOf(obj, extraY) {
    var wp = new THREE.Vector3();
    obj.getWorldPosition(wp);
    wp.y += extraY || 0;
    baseGroup.updateWorldMatrix(true, false);
    return baseGroup.worldToLocal(wp);
  }

  function startCraneJob() {
    if (!crane || crane.job || !crane.queue.length || !tableParcel) return;
    var mesh = crane.queue[0];
    if (mesh !== tableParcel || mesh.userData.settling) return;
    var slotIndex = depot.length;
    if (slotIndex >= DEPOT_SLOTS || !depotAnchors[slotIndex]) {
      log('<span class="text-amber-300">[DEPOT] Shelves are full. The stacker is holding.</span>');
      return;
    }
    crane.job = { mesh: mesh, slot: slotIndex, step: 0 };
    crane.queue.shift();
  }

  function craneLocalOf(obj, extraY) {
    var wp = new THREE.Vector3();
    obj.getWorldPosition(wp);
    wp.y += extraY || 0;
    if (crane && crane.root) {
      crane.root.updateMatrixWorld(true);
      return crane.root.worldToLocal(wp);
    }
    return baseLocalOf(obj, extraY);
  }

  function craneTargetFor(step, job) {
    var here = craneLocalOf(job.mesh, 0);
    var slot = depotAnchors[job.slot];
    var seat = craneLocalOf(slot, halfH(job.mesh));
    if (step === 0) return { x: here.x, y: Math.max(here.y + 0.25, 0.9), z: here.z };
    if (step === 1) return { x: here.x, y: here.y, z: here.z, grab: true };
    if (step === 2) return { x: here.x, y: Math.max(seat.y, here.y) + 0.12, z: here.z };
    if (step === 3) return { x: seat.x, y: Math.max(seat.y, here.y) + 0.12, z: seat.z };
    return { x: seat.x, y: seat.y, z: seat.z, release: true };
  }

  function tickCrane(dt) {
    if (!crane) return;
    startCraneJob();
    var job = crane.job;
    if (!job) return;
    var carriage = crane.carriage;
    var fork = crane.fork;
    if (!crane.seg) {
      var goal = craneTargetFor(job.step, job);
      var dx = Math.abs(goal.x - carriage.position.x);
      var dy = Math.abs(goal.y - fork.position.y);
      var dz = Math.abs(goal.z - fork.position.z);
      var dist = Math.max(dx, dy, dz);
      crane.seg = {
        x0: carriage.position.x, y0: fork.position.y, z0: fork.position.z,
        x1: goal.x, y1: goal.y, z1: goal.z,
        t: 0,
        dur: Math.max(0.45, dist / 0.35),
        grab: !!goal.grab,
        release: !!goal.release,
      };
    }
    var seg = crane.seg;
    seg.t += dt;
    var u = quintic(Math.min(1, seg.t / seg.dur));
    carriage.position.x = seg.x0 + (seg.x1 - seg.x0) * u;
    fork.position.y = seg.y0 + (seg.y1 - seg.y0) * u;
    fork.position.z = seg.z0 + (seg.z1 - seg.z0) * u;
    watchJump(job.mesh, dt);
    if (seg.t < seg.dur) return;
    if (seg.grab && job.mesh.parent !== fork) {
      fork.attach(job.mesh);
      if (tableParcel === job.mesh) tableParcel = null;
    }
    if (seg.release) {
      var anchor = depotAnchors[job.slot];
      if (anchor) anchor.attach(job.mesh);
      depot.push(job.mesh);
      log('<span class="text-emerald-300">[DEPOT] ' + job.mesh.userData.rec.source_item + ' part ' + job.mesh.userData.rec.part + ' on shelf ' + depot.length + '/' + DEPOT_SLOTS + '.</span>');
      crane.job = null;
    } else {
      job.step += 1;
    }
    crane.seg = null;
  }

  function socLow() {
    if (typeof roverWh === 'undefined' || typeof MAXWH === 'undefined') return false;
    return roverWh / MAXWH < 0.18 || chargeAfterCurrent;
  }

  function afterPick() {
    held = null;
    traj = null;
    armMode = null;
    if (queue.length && bayHasRoom(nextParcelMass()) && depot.length + (crane ? crane.queue.length : 0) < DEPOT_SLOTS && !socLow()) {
      phase = 'arm_pick';
      return;
    }
    trips += 1;
    if (!bay.length) {
      finishOrHangar();
      return;
    }
    beginLeg('transit_base');
  }

  function afterPlace() {
    held = null;
    traj = null;
    armMode = null;
    if (bay.length && depot.length < DEPOT_SLOTS) {
      // Check if crane needs to clear the table first
      if (tableParcel || (crane && crane.job)) {
        phase = 'crane_wait';
        craneWaitT = 0;
        log('<span class="text-amber-300">[ARM] Waiting for crane to shelf before next drop.</span>');
      } else {
        phase = 'arm_place';
      }
      return;
    }
    if (queue.length && depot.length < DEPOT_SLOTS && !socLow()) {
      if (typeof roverWh !== 'undefined' && missionStats.whRoundStart != null) {
        var rtWh = missionStats.whRoundStart - roverWh;
        if (rtWh > 0.5) {
          if (!window.__tripWhSamples) window.__tripWhSamples = [];
          window.__tripWhSamples.push(+rtWh.toFixed(3));
          var tsum = 0;
          for (var tj = 0; tj < window.__tripWhSamples.length; tj++) tsum += window.__tripWhSamples[tj];
          window.__measuredWhPerTrip = +(tsum / window.__tripWhSamples.length).toFixed(2);
        }
      }
      missionStats.whRoundStart = roverWh;
      beginLeg('transit_lander');
      return;
    }
    finishOrHangar();
  }

  function emitReport() {
    if (SC && missionStats.parcelsDelivered > 0) {
      lastReport = SC.buildReport({
        simTimeS: missionStats.simT, distanceM: missionStats.distanceM, whUsed: missionStats.whUsed,
        delivered: missionStats.parcelsDelivered, massKg: missionStats.totalMassKg, placementErrM: missionStats.placementErrM,
        sealed: !!alignRec && alignRec.pass, stability: stab.result()
      });
      window.__missionReport = lastReport;
      var stb = lastReport.stability;
      log('<span class="' + (lastReport.success ? 'text-emerald-400' : 'text-amber-300') + ' font-bold">[MISSION 6 REPORT] ' + (lastReport.success ? 'PASS' : 'INCOMPLETE') +
          ' | time ' + lastReport.simTimeS + ' s | distance ' + lastReport.distanceM + ' m | energy ' + lastReport.whUsed + ' Wh | placement ' +
          (lastReport.placementErrM == null ? 'n/a' : (lastReport.placementErrM * 100).toFixed(1) + ' cm') + ' ' + (lastReport.placementPass ? 'ok' : 'FAIL') +
          ' | seal ' + (lastReport.sealed ? 'ok' : 'FAIL') + ' | pod stability ' + (lastReport.stabilityPass ? 'ok' : 'FAIL') +
          ' (min tip margin ' + (stb.minMargin == null ? 'n/a' : stb.minMargin.toFixed(2)) + ' m/s², ' + stb.starts + ' starts, ' + stb.stops + ' stops, ' + stb.turns + ' turns)</span>');
    }
  }

  function finishOrHangar() {
    var lowNow = socLow();
    if (lowNow) {
      window.__autoChargeSession = window.__autoChargeSession || {};
      window.__autoChargeSession.active = true;
    }
    chargeAfterCurrent = false;
    phase = 'rth';
    missionArmed = false;
    // Record energy consumed
    if (typeof roverWh !== 'undefined' && typeof MAXWH !== 'undefined') {
      missionStats.kwhUsed = +(MAXWH - roverWh).toFixed(1);
    }
    if (lowNow) {
      log('<span class="text-amber-300">[LOGISTICS] Battery low. Returning to the hangar.</span>');
    } else if (!queue.length && fleet.on) {
      log('<span class="text-cyan-300">[LOGISTICS] Pickup rack empty. Waiting at the dock for rocket ' + Math.min(fleet.size, fleet.arrived + 1) + '/' + fleet.size + '.</span>');
    } else if (!queue.length) {
      log('<span class="text-emerald-400 font-bold">[LOGISTICS] ✅ MISSION COMPLETE — All rover parcels delivered to Artemis Base.</span>');
      log('<span class="text-emerald-300">[SUMMARY] Parcels: ' + missionStats.parcelsDelivered +
          ' | Mass: ' + missionStats.totalMassKg.toFixed(1) + ' kg' +
          ' | Trips: ' + trips +
          ' | Energy: ' + missionStats.kwhUsed + ' Wh' +
          ' | Depot: ' + depot.length + '/' + DEPOT_SLOTS + ' slots filled</span>');
    } else {
      log('<span class="text-amber-300">[DEPOT] Shelves full. ' + queue.length + ' parcels remain on the lander belt.</span>');
    }
    emitReport();
    if (typeof startReturnToDock === 'function') startReturnToDock();
  }

  function beginTracking(reset) {
    if (reset || !missionStats.startT) {
      missionStats.startT = Date.now();
      missionStats.distanceM = 0;
      missionStats.whUsed = 0;
      missionStats.placementErrM = null;
      missionStats.simT = 0;
      if (stab) stab.reset();
      alignRec = null;
      missionStats.lastX = null;
      missionStats.lastZ = null;
      missionStats.lastWh = (typeof roverWh !== 'undefined') ? roverWh : null;
    }
    missionStats.tracking = true;
  }

  function updateHud() {
    var bayEl = document.getElementById('log-bay');
    var depEl = document.getElementById('log-depot');
    var leftEl = document.getElementById('log-lander');
    var haulEl = document.getElementById('log-hauler');
    var tripEl = document.getElementById('log-trips');
    var bar = document.getElementById('log-depot-bar');
    var phaseEl = document.getElementById('log-phase');
    if (bayEl) bayEl.textContent = bay.length + ' / ' + (bayMass() + heldMass()).toFixed(1) + ' kg';
    if (depEl) depEl.textContent = depot.length + '/' + DEPOT_SLOTS + ' · ' + depotMass().toFixed(1) + ' kg';
    if (leftEl) leftEl.textContent = String(queue.length) + (fleet.on ? ' · rocket ' + fleet.arrived + '/' + fleet.size + ' ' + fleet.state : '');
    if (haulEl) haulEl.textContent = String(haulerItems.length);
    if (tripEl) tripEl.textContent = String(trips);
    if (phaseEl) phaseEl.textContent = phase.replace(/_/g, ' ').toUpperCase();
    var tEl = document.getElementById('m6-time');
    var dEl = document.getElementById('m6-dist');
    var wEl = document.getElementById('m6-wh');
    var eEl = document.getElementById('m6-err');
    var podEl = document.getElementById('pod-note');
    if (tEl) {
      var sec = missionStats.startT ? Math.max(0, (Date.now() - missionStats.startT) / 1000) : 0;
      tEl.textContent = sec.toFixed(0) + ' s';
    }
    if (dEl) dEl.textContent = missionStats.distanceM.toFixed(1) + ' m';
    if (wEl) wEl.textContent = missionStats.whUsed.toFixed(2) + ' Wh';
    if (eEl) eEl.textContent = missionStats.placementErrM == null ? '—' : (missionStats.placementErrM * 100).toFixed(0) + ' cm';
    if (podEl) {
      var lunarN = (bayMass() + heldMass()) * G_MOON;
      podEl.textContent = 'Pod 4×2 ft at 1:4 · ' + (bayMass() + heldMass()).toFixed(1) + ' kg · ' + lunarN.toFixed(1) + ' N lunar';
    }
    if (bar) bar.style.width = Math.min(100, (depotMass() / (DEPOT_SLOTS * SLOT_CAP_KG)) * 100) + '%';

    var mKg = bayMass() + heldMass();
    var sinkCm = (typeof bekkerSinkM === 'function') ? (bekkerSinkM() * 100).toFixed(2) : ((1.25 + mKg * 0.135).toFixed(2));
    var spdPct = (typeof payloadSpeedScale === 'function') ? Math.round(payloadSpeedScale() * 100) : (mKg > 0 ? Math.round(8 / (8 + mKg) * 100) : 100);

    var sinkEl = document.getElementById('log-sink');
    if (sinkEl) sinkEl.textContent = sinkCm + ' cm';
    var spdEl = document.getElementById('log-speed-scale');
    if (spdEl) spdEl.textContent = spdPct + '%';

    var sCargoMass = document.getElementById('stat-cargo-mass');
    if (sCargoMass) sCargoMass.textContent = mKg.toFixed(1) + ' kg';
    var sCargoSink = document.getElementById('stat-cargo-sink');
    if (sCargoSink) sCargoSink.textContent = sinkCm + ' cm';
    var sCargoSpd = document.getElementById('stat-cargo-spd');
    if (sCargoSpd) sCargoSpd.textContent = spdPct + '%';
    var sDepotMass = document.getElementById('stat-depot-mass');
    if (sDepotMass) sDepotMass.textContent = depotMass().toFixed(1) + ' kg';

    var missionTag = document.getElementById('mission-status-tag');
    if (missionTag) {
      missionTag.textContent = phase.replace(/_/g, ' ').toUpperCase();
      missionTag.className = 'text-[8px] font-mono px-1.5 py-0.5 rounded font-bold ' +
        (phase === 'crane_wait' ? 'bg-yellow-500/30 text-yellow-200' :
         phase.includes('arm') ? 'bg-cyan-500/30 text-cyan-200' :
         phase.includes('transit') ? 'bg-amber-500/30 text-amber-200' :
         phase.includes('align') ? 'bg-purple-500/30 text-purple-200' :
         phase === 'rth' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300');
    }
  }

  function spawnPlume(dt) {
    if (!plume) return;
    var descending = phase === 'descent' || fleet.state === 'descent' || fleet.state === 'liftoff';
    var arr = plume.geometry.attributes.position.array;
    var n = plumeLife.length;
    if (descending && landerGroup) {
      for (var k = 0; k < 8; k++) {
        for (var i = 0; i < n; i++) {
          if (plumeLife[i] > 0) continue;
          var ang = Math.random() * Math.PI * 2;
          var rad = 0.4 + Math.random() * 1.4;
          arr[i * 3] = landerGroup.position.x + Math.cos(ang) * rad;
          arr[i * 3 + 1] = groundY + 0.2;
          arr[i * 3 + 2] = landerGroup.position.z + Math.sin(ang) * rad;
          plumeLife[i] = 0.8 + Math.random() * 0.8;
          break;
        }
      }
    }
    for (var j = 0; j < n; j++) {
      if (plumeLife[j] <= 0) continue;
      plumeLife[j] -= dt;
      arr[j * 3] += (arr[j * 3] - PAD.x) * dt * 0.8;
      arr[j * 3 + 1] += 0.55 * dt;
      arr[j * 3 + 2] += (arr[j * 3 + 2] - PAD.z) * dt * 0.8;
      if (plumeLife[j] <= 0) arr[j * 3 + 1] = -30;
    }
    plume.geometry.attributes.position.needsUpdate = true;
  }

  function m1CheckoutCmd() {
    var t = m1 ? m1.t : 0;
    if (t < 1.2) return { steer: 0, throttle: 0.45, forward: true, reverse: false, brake: false };
    if (t < 1.8) return { steer: 0, throttle: 0, forward: false, reverse: false, brake: true };
    if (t < 3.0) return { steer: 0.9, throttle: 0.25, forward: true, reverse: false, brake: false };
    if (t < 4.2) return { steer: 0, throttle: -0.4, forward: false, reverse: true, brake: false };
    return { steer: 0, throttle: 0, forward: false, reverse: false, brake: true };
  }

  function sampleM1() {
    if (!m1 || !roverGroup) return;
    var v = (typeof vel === 'number') ? vel : 0;
    var yaw = (typeof roverYaw === 'number') ? roverYaw : m1.yaw0;
    if (Math.abs(v) > 0.12) m1.moved = true;
    if (m1.moved && Math.abs(v) < 0.04) m1.stopped = true;
    var dy = yaw - m1.yaw0;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    if (Math.abs(dy) > 0.35) m1.turned = true;
    if (v < -0.06) m1.reversed = true;
    var dPad = Math.hypot(roverGroup.position.x - PAD.x, roverGroup.position.z - PAD.z);
    if (dPad < 3.2 && Math.abs(v) > 0.15) m1.struck = true;
  }

  function m1Report() {
    if (!m1 || m1.reported) return;
    m1.reported = true;
    var rows = [
      ['Start', m1.moved],
      ['Stop', m1.stopped],
      ['Turn', m1.turned],
      ['Reverse', m1.reversed],
      ['Clear of lander', !m1.struck]
    ];
    var pass = rows.every(function (r) { return r[1]; });
    log('<span class="' + (pass ? 'text-emerald-300' : 'text-amber-300') + ' font-bold">[MISSION 1] ' + (pass ? 'PASS' : 'INCOMPLETE') + ' — ' + rows.map(function (r) { return r[0] + ' ' + (r[1] ? 'yes' : 'no'); }).join(', ') + '.</span>');
  }

  // Hard stand-off: the rover footprint may not enter the pickup bay or the airlock wall.
  function enforceClearance() {
    if (typeof roverGroup === 'undefined' || !roverGroup || typeof roverYaw === 'undefined') return;
    var px = roverGroup.position.x, pz = roverGroup.position.z;
    var c = Math.cos(roverYaw), sn = Math.sin(roverYaw);
    var minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (var i = 0; i < 4; i++) {
      var lx = (i & 1) ? ROVER_HL : -ROVER_HL, lz = (i & 2) ? ROVER_HW : -ROVER_HW;
      var wx = px + lx * c + lz * sn, wz = pz - lx * sn + lz * c;
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
      if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
    }
    var pushed = 0;
    // pickup bay (shutter face looks toward +z)
    var deckLen = (rackGroup && rackGroup.userData.deckLen) || 2.5;
    var bx0 = RACK.x - 0.56, bx1 = RACK.x + 0.56, bz0 = RACK.z - deckLen - 0.3, bz1 = PICK_FACE_Z + CLEAR_MARGIN;
    if (maxX > bx0 && minX < bx1 && maxZ > bz0 && minZ < bz1) {
      pushed = bz1 - minZ;
      roverGroup.position.z += pushed;
    }
    // airlock wall (face looks toward +x)
    var wx0 = DROP_FACE_X - 3, wx1 = DROP_FACE_X + CLEAR_MARGIN, wz0 = INTAKE.z - 1.15, wz1 = INTAKE.z + 1.15;
    if (maxZ > wz0 && minZ < wz1 && maxX > wx0 && minX < wx1) {
      pushed = wx1 - minX;
      roverGroup.position.x += pushed;
    }
    if (pushed > 0.0005 && typeof vel !== 'undefined' && vel > 0) vel = 0;
    window.__clearancePush = pushed;
  }

  function cargoPoints() {
    var out = [];
    if (typeof roverGroup === 'undefined' || !roverGroup) return out;
    var wp = new THREE.Vector3();
    function add(mesh) {
      mesh.getWorldPosition(wp);
      roverGroup.worldToLocal(wp);
      out.push({ kg: mesh.userData.rec.mass_kg, x: wp.x, y: wp.y, z: wp.z });
    }
    for (var i = 0; i < bay.length; i++) add(bay[i]);
    if (held && bay.indexOf(held) < 0) add(held);
    return out;
  }

  function needsRuns() {
    var shelfRoom = depot.length + (crane ? crane.queue.length : 0) < DEPOT_SLOTS;
    return bay.length > 0 || (queue.length > 0 && shelfRoom);
  }

  function fleetFreeSlots() {
    return DEPOT_SLOTS - (depot.length + (crane ? crane.queue.length : 0) + bay.length + queue.length);
  }

  function addRocketCargo() {
    var k = fleet.arrived;
    for (var i = 0; i < fleet.per; i++) {
      queue.push(applyCargoType({
        id: 'R' + k + String.fromCharCode(65 + i),
        source_item: 'Rocket ' + k + ' resupply pod ' + (i + 1),
        mass_kg: CARGO_KG,
        manifest_mass_kg: CARGO_KG,
        day_number: 100 * k + i,
        part: 1
      }, k * 3 + i));
    }
    ensureBelt();
    log('<span class="text-emerald-300">[ROCKET ' + k + '/' + fleet.size + '] ' + fleet.per + ' pods set down on the pickup rack. ' + queue.length + ' waiting.</span>');
  }

  function launchRoverForFleet() {
    if (socLow()) { missionArmed = true; return; }
    if (phase === 'idle' || phase === 'rth') {
      phase = 'idle';
      api.startMission();
    } else {
      missionArmed = true;
    }
  }

  function setHatch(dt, target) {
    hatchOpen += (target - hatchOpen) * Math.min(1, 2.0 * dt);
    if (hatchPivot) hatchPivot.rotation.x = -hatchOpen * 1.35;
  }

  function tickFleet(dt) {
    if (!fleet.on || !landerGroup) return;
    fleet.t += dt;
    var top = groundY + 28;
    var u, ease;
    if (fleet.state === 'liftoff') {
      u = Math.min(1, fleet.t / 9);
      landerGroup.position.y = landedCenterY + (top - landedCenterY) * (u * u);
      setHatch(dt, 0);
      if (u >= 1) {
        landerGroup.visible = false;
        if (fleet.arrived >= fleet.size) {
          fleet.on = false;
          fleet.state = 'done';
          log('<span class="text-emerald-300">[ROCKET] Last rocket has left. ' + queue.length + ' pods still to move.</span>');
          if (!needsRuns() && !bay.length) {
            log('<span class="text-emerald-400 font-bold">[LOGISTICS] ✅ MISSION COMPLETE — All rocket cargo stored. Depot: ' + depot.length + '/' + DEPOT_SLOTS + ' slots filled.</span>');
          }
        } else {
          fleet.state = 'gap';
          fleet.t = 0;
        }
      }
    } else if (fleet.state === 'gap') {
      if (fleet.t >= 6) {
        fleet.arrived += 1;
        fleet.state = 'descent';
        fleet.t = 0;
        hatchOpen = 0;
        if (hatchPivot) hatchPivot.rotation.x = 0;
        landerGroup.visible = true;
        landerGroup.position.y = top;
        if (landerGroup.userData.light) landerGroup.userData.light.intensity = 6;
        log('<span class="text-amber-300 font-bold">[ROCKET ' + fleet.arrived + '/' + fleet.size + '] On final descent to the pad.</span>');
      }
    } else if (fleet.state === 'descent') {
      u = Math.min(1, fleet.t / 8);
      ease = u * u * (3 - 2 * u);
      landerGroup.position.y = top + (landedCenterY - top) * ease;
      if (u >= 1) {
        landerLanded = true;
        landerGroup.position.y = landedCenterY;
        if (landerGroup.userData.light) landerGroup.userData.light.intensity = 1.4;
        navForceReplan = true;
        fleet.state = 'unload';
        fleet.t = 0;
        log('<span class="text-emerald-400 font-bold">[ROCKET ' + fleet.arrived + '/' + fleet.size + '] Touchdown. Hatch opening.</span>');
      }
    } else if (fleet.state === 'unload') {
      setHatch(dt, 1);
      if (fleet.t >= 3.5) {
        addRocketCargo();
        fleet.state = 'hold';
        fleet.t = 0;
        launchRoverForFleet();
      }
    } else if (fleet.state === 'hold') {
      if (fleet.t >= 5) {
        landerLanded = false;
        navForceReplan = true;
        fleet.state = 'liftoff';
        fleet.t = 0;
        log('<span class="text-amber-300">[ROCKET ' + fleet.arrived + '/' + fleet.size + '] Cargo out. Lifting off.</span>');
      }
    }
  }

  var api = {
    phase: function () { return phase; },
    startFleet: function () {
      if (fleet.on) { log('<span class="text-slate-400">[ROCKET] Resupply already under way.</span>'); return; }
      if (!manifest) initFallbackManifest();
      // The fleet replaces the manifest backlog (44 pods is more than the 12 shelf slots).
      if (!bay.length && !held && !picking && (phase === 'idle' || phase === 'rth')) {
        for (var bi = 0; bi < belt.length; bi++) { if (belt[bi].parent) belt[bi].parent.remove(belt[bi]); }
        belt.length = 0;
        queue = [];
        log('<span class="text-slate-300">[ROCKET] Cleared the old manifest backlog from the rack.</span>');
      }
      var free = fleetFreeSlots();
      fleet.size = FLEET_SIZE;
      fleet.per = Math.floor(free / fleet.size);
      if (fleet.per < 1) {
        log('<span class="text-amber-300">[ROCKET] Not enough free shelf slots (' + free + ') for ' + fleet.size + ' rockets.</span>');
        return;
      }
      fleet.on = true;
      fleet.arrived = 0;
      fleet.t = 0;
      log('<span class="text-cyan-300 font-bold">[ROCKET] Resupply fleet: ' + fleet.size + ' rockets x ' + fleet.per + ' pods. Rover launches itself after each drop.</span>');
      if (landerLanded && (queue.length || bay.length)) api.startMission();
      if (landerLanded) {
        landerLanded = false;
        navForceReplan = true;
        fleet.state = 'liftoff';
      } else {
        fleet.state = 'gap';
        landerGroup.visible = false;
      }
    },
    fleetInfo: function () { return { on: fleet.on, state: fleet.state, arrived: fleet.arrived, size: fleet.size, per: fleet.per }; },
    cargoPoints: cargoPoints,
    needsRuns: needsRuns,
    // Called by the power supervisor. Returns true when logistics will bring the rover home itself.
    requestCharge: function (critical) {
      if (phase === 'arm_pick' || phase === 'arm_place' || phase === 'align_pick' || phase === 'align_drop' || phase === 'crane_wait') {
        chargeAfterCurrent = true;
        log('<span class="text-amber-300">[POWER] Low battery. Finishing this handover, then heading to the dock.</span>');
        return true;
      }
      if (phase === 'transit_base' && bay.length && !critical) {
        chargeAfterCurrent = true;
        log('<span class="text-amber-300">[POWER] Low battery with cargo aboard. Delivering first, then charging.</span>');
        return true;
      }
      if (phase === 'transit_lander' || phase === 'transit_base' || phase === 'transit_stage') {
        phase = 'rth';
        missionArmed = false;
        emitReport();
        if (typeof globalGoal !== 'undefined') globalGoal = null;
        if (typeof waypoint !== 'undefined') waypoint = null;
      }
      return false;
    },
    resumeRuns: function () {
      if (!needsRuns()) return false;
      missionArmed = true;
      beginTracking(false);
      if (bay.length) beginLeg('transit_base'); else beginLeg('transit_lander');
      return true;
    },
    payloadKg: function () { return bayMass() + heldMass(); },
    heldKg: function () { return heldMass(); },
    bayCount: function () { return bay.length; },
    depotKg: function () { return depotMass(); },
    trips: function () { return trips; },
    craneBusy: function () { return !!(crane && (crane.job || crane.queue.length || tableParcel)); },
    jumps: function () { return window.__cargoJumps || []; },
    holdsDrive: function () { return phase === 'arm_pick' || phase === 'arm_place' || phase === 'crane_wait'; },
    ownsGoal: function () { return phase === 'transit_lander' || phase === 'transit_base' || phase === 'transit_stage'; },
    onArrived: function () {
      if (typeof globalGoal !== 'undefined') globalGoal = null;
      if (typeof waypoint !== 'undefined') waypoint = null;
      if (phase === 'transit_lander') phase = 'align_pick';
      else if (phase === 'transit_base') phase = 'align_drop';
      else if (phase === 'transit_stage') {
        phase = 'idle';
        log('<span class="text-emerald-300">[MISSION 1] Staging area reached.</span>');
        m1Report();
      }
    },
    driveOverride: function () {
      if (sup.paused) return { steer: 0, throttle: 0, forward: false, reverse: false, brake: true };
      if (phase === 'm1_checkout') return m1CheckoutCmd();
      if (phase === 'arm_pick' || phase === 'arm_place' || phase === 'crane_wait') {
        return { steer: 0, throttle: 0, forward: false, reverse: false, brake: true };
      }
      if (phase !== 'align_pick' && phase !== 'align_drop') return null;
      var pose = parkPose();
      var p = roverGroup.position;
      var dx = pose.x - p.x;
      var dz = pose.z - p.z;
      var dist = Math.hypot(dx, dz);
      var driveYaw = Math.atan2(-dz, dx);
      var stopYaw = (pose.targetYaw !== undefined) ? pose.targetYaw : Math.atan2(-(pose.faceZ - p.z), pose.faceX - p.x);
      // Park-axis frame: along = distance past the park point (nose direction), lat = starboard offset.
      var hx = Math.cos(stopYaw), hz = -Math.sin(stopYaw);
      var along = (p.x - pose.x) * hx + (p.z - pose.z) * hz;
      var lat = (p.x - pose.x) * Math.sin(stopYaw) + (p.z - pose.z) * Math.cos(stopYaw);
      // Forward-only driving cannot fix a sideways error beside the face, so back out onto the park axis first.
      if (dist < 1.0 && Math.abs(lat) > 0.06 && along > -0.30) backingOut = true;
      if (backingOut && (along < -0.90 || Math.abs(lat) < 0.025 || dist > 1.7)) backingOut = false;
      if (backingOut) {
        var yb = wrap(stopYaw - roverYaw);
        return { steer: Math.max(-0.9, Math.min(0.9, yb * 1.5)), throttle: 0.60, forward: false, reverse: true, brake: false };
      }
      var useStop = dist < 1.0;   // lateral servo zone: steer onto the park axis while closing
      var latYaw = stopYaw + Math.max(-0.40, Math.min(0.40, lat * 3.0));
      var yawErr = wrap((useStop ? latYaw : driveYaw) - roverYaw);
      var stopErr = wrap(stopYaw - roverYaw);
      var ms = (typeof activeMotor !== 'undefined' && activeMotor.maxSpeed) ? activeMotor.maxSpeed : 0.94;
      var pickAlign = phase === 'align_pick';
      var distGate = pickAlign ? 0.07 : 0.045;
      var yawGate = pickAlign ? 0.18 : 0.28;
      var fineDist = pickAlign ? 0.04 : 0.03;
      var fineYaw = pickAlign ? 0.10 : 0.18;
      var velGate = pickAlign ? 0.05 : 0.06;
      if (dist < distGate && Math.abs(stopErr) < yawGate) {
        if (Math.abs(vel) < velGate || (dist < fineDist && Math.abs(stopErr) < fineYaw)) {
          phase = phase === 'align_pick' ? 'arm_pick' : 'arm_place';
          traj = null;
          armMode = null;
          gripRetry = 0;
          log(phase === 'arm_pick'
            ? '<span class="text-cyan-300 font-bold">[ARM] At the lander belt. Waiting on the handle.</span>'
            : '<span class="text-cyan-300 font-bold">[ARM] Bumper is ' +
              ((bumperGap() != null) ? (bumperGap() * 100).toFixed(0) : '?') +
              ' cm from the airlock face. Setting the pod in the receiving zone.</span>');
          return { steer: 0, throttle: 0, forward: false, reverse: false, brake: true };
        }
        var doBrake = dist < 0.15 || Math.abs(vel) > 0.10;
        return { steer: Math.max(-0.8, Math.min(0.8, stopErr * 1.5)), throttle: 0, forward: false, reverse: false, brake: doBrake };
      }
      var v = 0;
      if (Math.abs(yawErr) < 0.45) {
        v = Math.min(0.38, Math.sqrt(Math.max(0, 2 * 0.35 * dist)));
        if (dist < 0.50) v = Math.min(v, 0.14);
      }
      var tvDamp = (typeof turnVel !== 'undefined') ? turnVel * 0.20 : 0;
      var steer = Math.max(-0.95, Math.min(0.95, yawErr * 1.35 - tvDamp));
      return { steer: steer, throttle: v > 0.02 ? Math.min(1, v / ms) : 0, forward: v > 0.02, reverse: false, brake: false };
    },
    obstacles: function () {
      var list = [{ x: BASE.x, z: BASE.z, r: 3.1 }];
      if (window.NASA_FaultsUI) list = list.concat(NASA_FaultsUI.obstacles());
      if (window.NASA_SupplyRoute) list = list.concat(NASA_SupplyRoute.circles());
      if (landerLanded) {
        for (var i = -2; i <= 2; i++) list.push({ x: PAD.x + i * 2.4, z: PAD.z, r: 2.35 });
      }
      return list;
    },
    stampObstacles: function (x0, z0, x1, z1) {
      if (typeof navCost === 'undefined' || typeof NAV_BLOCKED === 'undefined') return;
      var list = api.obstacles();
      var res = (typeof NAV_RES !== 'undefined') ? NAV_RES : 0.5;
      for (var n = 0; n < list.length; n++) {
        var o = list[n];
        var gx = navGX(o.x);
        var gz = navGX(o.z);
        var rad = Math.ceil(o.r / res);
        for (var dz = -rad; dz <= rad; dz++) {
          for (var dx = -rad; dx <= rad; dx++) {
            if (dx * dx + dz * dz > rad * rad) continue;
            var cx = gx + dx;
            var cz = gz + dz;
            if (cx < x0 || cx > x1 || cz < z0 || cz > z1) continue;
            if (cz < 0 || cx < 0 || cz >= NAV_N || cx >= NAV_N) continue;
            navCost[cz * NAV_N + cx] = NAV_BLOCKED;
          }
        }
      }
    },
    dispatch: function (requests) {
      var D = window.NASA_Dispatcher;
      if (!D || !window.NASA_Cargo) return false;
      if (bay.length || held || picking || !(phase === 'idle' || phase === 'rth')) { log('<span class="text-amber-300">[DISPATCH] Start a dispatch while the rover is idle and empty.</span>'); return false; }
      if (fleet.on) { log('<span class="text-amber-300">[DISPATCH] The rocket fleet is supplying the rack. Abort it first.</span>'); return false; }
      var reqs = requests || D.demoRequests(0);
      dispatchState = { reqs: reqs, plan: null, delivered: [], t0: schedT };
      var p = dispatchPlan();
      loadRackInPlanOrder(p);
      logPlan(p, 'Plan for ' + reqs.length + ' requests (arrival order ' + reqs.map(function (r) { return r.id; }).join(',') + ' becomes ' + p.order.join(',') + ')');
      window.__dispatchPlan = p;
      if (landerLanded) api.startMission();
      else log('<span class="text-amber-300">[DISPATCH] Lander not down yet; mission starts after touchdown.</span>');
      return true;
    },
    addUrgent: function (item, category) {
      var D = window.NASA_Dispatcher;
      if (!dispatchState) { log('<span class="text-amber-300">[DISPATCH] No dispatch running. Say "dispatch" first.</span>'); return false; }
      if (held || picking || phase === 'arm_pick' || phase === 'align_pick') { log('<span class="text-amber-300">[DISPATCH] Rover is mid-pick; request noted after this handover.</span>'); return false; }
      var n = dispatchState.reqs.length + 1;
      dispatchState.reqs.push({ id: 'D' + n, item: item || 'Emergency repair part', category: category || 'repair', massKg: NASA_Cargo.get(D.CATEGORIES[category || 'repair'].cargo).massKg, createdS: schedT - dispatchState.t0, deadlineS: schedT - dispatchState.t0 + 900 });
      var p = dispatchPlan();
      // Keep anything already aboard; re-sort the rest.
      var aboard = {};
      bay.forEach(function (m) { aboard[m.userData.rec.id] = true; });
      var rest = { trips: p.trips.map(function (t) { return { items: t.items.filter(function (i) { return !aboard[i.id]; }), order: t.order, robot: t.robot, route: t.route, routeLabel: t.routeLabel, routeWhy: t.routeWhy, startS: t.startS, etaS: t.etaS, chargeFirst: t.chargeFirst, onTime: t.onTime }; }).filter(function (t) { return t.items.length; }) };
      loadRackInPlanOrder(rest);
      logPlan(p, 'New request D' + n + ' arrived, re-planned');
      window.__dispatchPlan = p;
      return true;
    },
    dispatchStatus: function () { return dispatchState ? { plan: dispatchState.plan, delivered: dispatchState.delivered.slice() } : null; },
    setCargoType: function (mode) {
      if (!window.NASA_Cargo) return false;
      if (!(mode === 'mixed' || NASA_Cargo.TYPES[mode])) { log('<span class="text-amber-300">[CARGO] Unknown type. Use pod, cylinder, container or mixed.</span>'); return false; }
      if (bay.length || held || picking || !(phase === 'idle' || phase === 'rth')) { log('<span class="text-amber-300">[CARGO] Change the cargo type while the rover is idle and empty.</span>'); return false; }
      NASA_Cargo.mode = mode;
      for (var bi = 0; bi < belt.length; bi++) { if (belt[bi].parent) belt[bi].parent.remove(belt[bi]); }
      belt.length = 0;
      queue.forEach(function (r, i) { applyCargoType(r, i); });
      if (rackGroup) initConveyorParcels();
      log('<span class="text-cyan-300 font-bold">[CARGO] Rack loaded with ' + mode + ' cargo. ' + (mode === 'mixed' ? 'Pod, cylinder and container in turn. ' : '') + 'Same grapple bail, cradle adapts.</span>');
      return true;
    },
    cargoFits: function () { return window.NASA_Cargo ? NASA_Cargo.ids().map(function (i) { return { id: i, fit: NASA_Cargo.fits(i), cradle: NASA_Cargo.cradleFor(i) }; }) : []; },
    pause: function () { if (sup.paused) return false; sup.paused = true; log('<span class="text-fuchsia-300 font-bold">[SUPERVISOR] Mission paused. Rover held.</span>'); return true; },
    resume: function () { if (!sup.paused) return false; sup.paused = false; log('<span class="text-fuchsia-300 font-bold">[SUPERVISOR] Mission resumed.</span>'); return true; },
    setApproval: function (on) { sup.approve = !!on; if (!on) { sup.pending = false; sup.granted = false; } log('<span class="text-fuchsia-300">[SUPERVISOR] Operator approval before placement: ' + (on ? 'ON' : 'OFF') + '.</span>'); return true; },
    approve: function () { if (!sup.pending) return false; sup.granted = true; log('<span class="text-fuchsia-300 font-bold">[SUPERVISOR] Placement approved.</span>'); return true; },
    supervisor: function () { return { paused: sup.paused, approve: sup.approve, pending: sup.pending }; },
    report: function () { return lastReport; },
    stability: function () { return stab ? stab.result() : null; },
    sealState: function () { return seal ? seal.state : null; },
    deployLander: function () {
      if (fleet.on) return;
      if (phase === 'descent' || landerLanded) {
        log('<span class="text-slate-400">[LANDER] Already down or on approach.</span>');
        return;
      }
      phase = 'descent';
      descendT = 0;
      if (landerGroup && landerGroup.userData.light) landerGroup.userData.light.intensity = 6;
      log('<span class="text-amber-300 font-bold">[LANDER] Cargo module on descent to the south-east pad.</span>');
    },
    missionDrive: function () {
      wanderOn = false;
      missionArmed = true;
      beginTracking(false);
      m1 = { t: 0, moved: false, stopped: false, turned: false, reversed: false, struck: false, yaw0: (typeof roverYaw === 'number' ? roverYaw : 0), reported: false };
      phase = 'm1_checkout';
      log('<span class="text-cyan-300 font-bold">[MISSION 1] Checkout: start, stop, turn, reverse, then leave for staging. Do not enter the lander keep-out.</span>');
    },
    startMission: function () {
      wanderOn = false;
      missionArmed = true;
      // Reset mission stats on fresh start
      missionStats.startT = Date.now();
      missionStats.parcelsDelivered = 0;
      missionStats.totalMassKg = 0;
      missionStats.kwhUsed = 0;
      beginTracking(true);
      if (!manifest) {
        log('<span class="text-amber-300">[LOGISTICS] Manifest pending; initializing defaults...</span>');
        initFallbackManifest();
      }
      if (fleet.on && !landerLanded && !queue.length && !bay.length) {
        missionArmed = true;
        return;
      }
      if (!landerLanded && !fleet.on) {
        if (phase !== 'descent') api.deployLander();
        beginLeg('transit_lander');
        return;
      }
      if (!queue.length && !bay.length) {
        missionArmed = false;
        log('<span class="text-emerald-400 font-bold">[LOGISTICS] All rover parcels safely retrieved and delivered.</span>');
        return;
      }
      if (bay.length) beginLeg('transit_base');
      else beginLeg('transit_lander');
    },
    goToLander: function () {
      wanderOn = false;
      missionArmed = true;
      beginTracking(false);
      if (!landerLanded && phase !== 'descent') api.deployLander();
      beginLeg('transit_lander');
      log('<span class="text-cyan-300 font-bold">[NAV] Routing to Commercial Cargo Lander staging pad.</span>');
    },
    goToBase: function () {
      wanderOn = false;
      missionArmed = true;
      beginTracking(false);
      beginLeg('transit_base');
      log('<span class="text-cyan-300 font-bold">[NAV] Routing to Artemis Lunar Base cargo intake deck.</span>');
    },
    goToHangar: function () {
      finishOrHangar();
    },
    pickupCargo: function () {
      beginTracking(false);
      var dLander = Math.hypot(roverGroup.position.x - RACK.x, roverGroup.position.z - RACK.z);
      if (dLander > 4.5) {
        log('<span class="text-amber-300">[ARM] Rover is ' + dLander.toFixed(1) + ' m from lander. Driving to lander first...</span>');
        api.goToLander();
        return;
      }
      traj = null;
      armMode = null;
      gripRetry = 0;
      reachWarned = false;
      if (!pickAlignOk()) {
        phase = 'align_pick';
        log('<span class="text-cyan-300">[ARM] Aligning to lander belt before pickup.</span>');
        return;
      }
      phase = 'arm_pick';
      // The arm only moves once the bay shutter is fully open (tickArm waits for it)
      if (doorReady(pickupDoor) && trayPresented()) startPickSequence();
      log('<span class="text-emerald-400 font-bold">[ARM] Executing robotic arm pickup sequence.</span>');
    },
    dropCargo: function () {
      beginTracking(false);
      if (!bay.length) {
        log('<span class="text-amber-300">[ARM] Cargo hopper is empty. Nothing to offload.</span>');
        return;
      }
      var dBase = Math.hypot(roverGroup.position.x - INTAKE.x, roverGroup.position.z - INTAKE.z);
      if (dBase > 4.5) {
        log('<span class="text-amber-300">[ARM] Rover is ' + dBase.toFixed(1) + ' m from base. Driving to base first...</span>');
        api.goToBase();
        return;
      }
      phase = 'arm_place';
      traj = null;
      armMode = null;
      gripRetry = 0;
      if (doorReady(dropDoor)) startPlaceSequence();
      log('<span class="text-teal-400 font-bold">[ARM] Executing robotic arm drop sequence.</span>');
    },
    abort: function () {
      phase = 'idle';
      missionArmed = false;
      traj = null;
      armMode = null;
      held = null;
      picking = null;
      if (typeof globalGoal !== 'undefined') globalGoal = null;
      if (typeof waypoint !== 'undefined') waypoint = null;
      if (typeof autoOn !== 'undefined' && autoOn) {
        var btn = document.getElementById('btn-autopilot');
        if (btn) btn.click();
      }
      log('<span class="text-rose-400 font-bold">[LOGISTICS] Mission ABORTED. Rover holding station.</span>');
    },
    _originalStartMission: function () {
      wanderOn = false;
      missionArmed = true;
      if (!manifest) {
        log('<span class="text-amber-300">[LOGISTICS] Waiting for the parcel manifest.</span>');
        return;
      }
      if (!landerLanded) {
        if (phase !== 'descent') api.deployLander();
        beginLeg('transit_lander');
        return;
      }
      if (!queue.length && !bay.length) {
        missionArmed = false;
        log('<span class="text-emerald-400">[LOGISTICS] No rover parcels left at the lander.</span>');
        return;
      }
      if (bay.length) beginLeg('transit_base');
      else beginLeg('transit_lander');
    },
    tick: function (dt) {
      if (!landerGroup) return;
      if (sup.paused) { updateHud(); return; }
      if (roverGroup) roverGroup.updateMatrixWorld(true);
      if (phase === 'descent') {
        descendT += dt;
        var u = Math.min(1, descendT / 8);
        var ease = u * u * (3 - 2 * u);
        landerGroup.position.y = (groundY + 28) + (landedCenterY - (groundY + 28)) * ease;
        if (u >= 1 && !landerLanded) {
          landerLanded = true;
          landerGroup.position.y = landedCenterY;
          if (landerGroup.userData.light) landerGroup.userData.light.intensity = 1.4;
          navForceReplan = true;
          log('<span class="text-emerald-400 font-bold">[LANDER] Touchdown. Hatch opening. Conveyor will feed ' + queue.length + ' parcels. ' + haulerItems.length + ' items need a hauler.</span>');
        }
      }
      if (landerLanded) {
        hatchOpen += (1 - hatchOpen) * Math.min(1, 1.4 * dt);
        if (hatchPivot) hatchPivot.rotation.x = -hatchOpen * 1.35;
      }
      tickFleet(dt);
      spawnPlume(dt);
      if (phase === 'm1_checkout' && m1) {
        m1.t += dt;
        sampleM1();
        if (m1.t >= 4.8) {
          phase = 'transit_stage';
          var stage = { x: 10, z: -28 };
          log('<span class="text-cyan-300 font-bold">[MISSION 1] Checkout done. Leaving for the staging area.</span>');
          if (typeof queueMissionOrUndock === 'function') queueMissionOrUndock(stage.x, stage.z, 'LEAVE LZ');
          else if (typeof launchMissionGoal === 'function') launchMissionGoal(stage.x, stage.z, 'LEAVE LZ');
        }
      } else if (phase === 'transit_stage') {
        sampleM1();
      }
      if (typeof smoothPitch === 'number' && typeof roverPayloadKg === 'function' && roverPayloadKg() > 0.4 && Math.abs(smoothPitch) > 0.22 && !tipWarned) {
        tipWarned = true;
        log('<span class="text-amber-300 font-bold">[IMU] Steep climb with pod aft — the battery + ballast plate sit under the aft deck for rear grip. Ease throttle; watch front wheel unload.</span>');
      }
      if (missionStats.tracking && roverGroup) {
        var px = roverGroup.position.x;
        var pz = roverGroup.position.z;
        if (missionStats.lastX != null) {
          missionStats.distanceM += Math.hypot(px - missionStats.lastX, pz - missionStats.lastZ);
        }
        missionStats.lastX = px;
        missionStats.lastZ = pz;
        if (typeof roverWh !== 'undefined') {
          if (missionStats.lastWh == null) missionStats.lastWh = roverWh;
          var used = missionStats.lastWh - roverWh;
          if (used > 0) missionStats.whUsed += used;
          missionStats.lastWh = roverWh;
        }
      }
      if (missionStats.tracking) missionStats.simT += dt;
      if (window.NASA_Faults) NASA_Faults.step(dt);
      if (window.NASA_HabitatDisplay) NASA_HabitatDisplay.update(dt);
      if (window.NASA_SupplyRoute) NASA_SupplyRoute.tick();
      schedT += dt;
      if (SC) {
        var dyn = window.NASA_Dynamics ? NASA_Dynamics.state() : null;
        var spd = (typeof vel === 'number') ? vel : 0, yr = (typeof turnVel === 'number') ? turnVel : 0;
        var tp = window.NASA_Faults ? NASA_Faults.tipPenalty() : 0;
        var mr = (dyn ? dyn.tipMarginRoll : 9) - tp, mp = (dyn ? dyn.tipMarginPitch : 9) - tp;
        var carrying = (typeof roverPayloadKg === 'function' ? roverPayloadKg() : 0) > 0.2;
        SC._scale = SC.tipSpeedScale(mr, mp, Math.abs(spd * yr));
        if (missionStats.tracking) stab.add({ carrying: carrying, lockHeld: (bay.length > 0 || !!held), speed: spd, yawRate: yr, marginRoll: mr, marginPitch: mp, tilt: (typeof smoothPitch === 'number' ? Math.max(Math.abs(smoothPitch), Math.abs(typeof smoothRoll === 'number' ? smoothRoll : 0)) : 0) });
      }
      updateDoors(dt);
      stepSettling(dt);
      enforceClearance();
      tickBelt(dt);
      tickCrane(dt);
      if (phase === 'crane_wait') {
        tickCraneWait(dt);
        stowIfIdle(dt);
      } else if (phase === 'arm_pick' || phase === 'arm_place') {
        tickArm(dt);
      } else {
        stowIfIdle(dt);
      }
      if (missionArmed && landerLanded && (phase === 'idle' || phase === 'descent')) {
        phase = 'idle';
        api.startMission();
      }
      updateHud();
    },
  };

  function applyCargoType(rec, idx) {
    rec.cargo_type = window.NASA_Cargo ? NASA_Cargo.pick(NASA_Cargo.mode, idx) : 'pod';
    rec.mass_kg = window.NASA_Cargo ? NASA_Cargo.get(rec.cargo_type).massKg : CARGO_KG;
    return rec;
  }


  // ---- Mission 11: dispatcher glue ----
  function dispatchRobots() {
    var wh = (typeof roverWh !== 'undefined') ? roverWh : 40;
    return [{ id: 'AEGIS-1', socWh: wh, availableS: 0 }];
  }

  function dispatchPlan() {
    var D = window.NASA_Dispatcher;
    var nowS = schedT - dispatchState.t0;
    var aboard = {};
    bay.forEach(function (m) { aboard[m.userData.rec.id] = m.userData.rec; });
    var pending = dispatchState.reqs.filter(function (r) { return !aboard[r.id] && !dispatchState.delivered.some(function (d) { return d.id === r.id; }); });
    var p = D.plan(pending, dispatchRobots(), { nowS: nowS, haulBlocked: !!(window.NASA_Faults && NASA_Faults.isActive('road')) });
    var ids = Object.keys(aboard);
    if (ids.length) {
      // Cargo already on the rover finishes its trip first; the new plan starts after it.
      p.trips.forEach(function (t) { t.order += 1; });
      p.trips.unshift({
        order: 1, robot: 'AEGIS-1', route: 'in-progress', routeLabel: 'Already en route', routeWhy: 'cargo aboard is delivered first', startS: Math.round(nowS), etaS: Math.round(nowS),
        whEst: 0, chargeFirst: false, onTime: true,
        items: ids.map(function (id) { return { id: id, item: aboard[id].source_item, category: aboard[id].category, cargo: aboard[id].cargo_type, massKg: aboard[id].mass_kg, score: aboard[id].priority || 0, reason: 'aboard, delivering now' }; })
      });
      p.order = ids.concat(p.order);
    }
    dispatchState.plan = p;
    return p;
  }

  function loadRackInPlanOrder(p) {
    var byId = {};
    dispatchState.reqs.forEach(function (r) { byId[r.id] = r; });
    for (var bi = 0; bi < belt.length; bi++) { if (belt[bi].parent) belt[bi].parent.remove(belt[bi]); }
    belt.length = 0;
    var recs = [];
    p.trips.forEach(function (t) {
      t.items.forEach(function (it) {
        var r = byId[it.id];
        var ctype = it.cargo || 'pod';
        recs.push({
          id: it.id, source_item: it.item, category: it.category, mass_kg: NASA_Cargo.get(ctype).massKg, manifest_mass_kg: NASA_Cargo.get(ctype).massKg,
          cargo_type: ctype, day_number: recs.length, part: 1, priority: it.score
        });
      });
    });
    queue = recs;
    if (rackGroup) initConveyorParcels();
  }

  function logPlan(p, title) {
    log('<span class="text-fuchsia-300 font-bold">[DISPATCH] ' + title + ' — ' + p.trips.length + ' trips, ' + p.lateCount + ' late.</span>');
    p.trips.forEach(function (t) {
      log('<span class="text-fuchsia-200">[DISPATCH] #' + t.order + ' ' + t.robot + ' · ' + t.routeLabel + ' (' + t.routeWhy + ') · start ' + t.startS + ' s, eta ' + t.etaS + ' s · ' +
        t.items.map(function (i) { return i.id + ' ' + i.item + ' [' + i.reason + ']'; }).join(' + ') + (t.chargeFirst ? ' · charge first' : '') + (t.onTime ? '' : ' · LATE') + '</span>');
    });
  }

  function onManifest(data) {
    (data.parcels || []).forEach(function (r, ri) {
      if (r.manifest_mass_kg == null) r.manifest_mass_kg = r.mass_kg;
      r.mass_kg = CARGO_KG;                       // prototype pods are 5 lb each
      applyCargoType(r, ri);
    });
    data.rover_payload_kg = +(CARGO_KG * (data.parcels || []).length).toFixed(1);
    manifest = data;
    if (fleet.on) return; // rocket fleet supplies the pods
    queue = (data.parcels || []).slice().sort(function (a, b) {
      return a.day_number - b.day_number || (a.id < b.id ? -1 : 1);
    });
    haulerItems = data.hauler_items || [];
    showHaulerCrates();
    initConveyorParcels();
    log('<span class="text-emerald-400">[LOGISTICS] Manifest loaded. ' + queue.length + ' parcels (' + data.rover_payload_kg + ' kg) fit the bay. ' + haulerItems.length + ' items (' + data.hauler_payload_kg + ' kg) stay for the hauler.</span>');
    if (missionArmed && !landerLanded && phase !== 'descent') api.deployLander();
    updateHud();
  }

  buildBase();
  buildLander();
  function initFallbackManifest() {
    onManifest({
      rover_payload_kg: 28.1,
      hauler_payload_kg: 50.0,
      parcels: [
        { id: 'P001', source_item: 'Crew Emergency First Aid & Trauma Kit', mass_kg: 5.0, day_number: 1, part: 1 },
        { id: 'P002', source_item: 'Lithium Hydroxide CO2 Scrubber Canister', mass_kg: 4.8, day_number: 2, part: 1 },
        { id: 'P003', source_item: 'Potable Water Reclamation Filter Pack', mass_kg: 5.0, day_number: 3, part: 1 },
        { id: 'P004', source_item: 'Extravehicular Visor & Thermal Gloves', mass_kg: 3.6, day_number: 4, part: 1 },
        { id: 'P005', source_item: 'S-Band High-Gain Diplexer Transceiver', mass_kg: 4.2, day_number: 5, part: 1 },
        { id: 'P006', source_item: 'Passive Seismic Experiment Geophone Pod', mass_kg: 4.5, day_number: 6, part: 1 }
      ],
      hauler_items: []
    });
  }

  fetch('rover_parcel_manifest.json')
    .then(function (r) { return r.json(); })
    .then(onManifest)
    .catch(function () {
      log('<span class="text-amber-300">[LOGISTICS] Initializing standardized NASA HUNCH logistics manifest.</span>');
      initFallbackManifest();
    });

  window.NASA_Logistics = api;
  window.NASA_LogisticsDoors = function () {
    return { pick: pickupDoor ? pickupDoor.pos : null, drop: dropDoor ? dropDoor.pos : null };
  };
})();
