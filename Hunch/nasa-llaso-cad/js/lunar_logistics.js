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
  var BAY_CAP_KG = 10;
  var BAY_SLOTS = 2;
  var DEPOT_SLOTS = 12;
  var SLOT_CAP_KG = 10;
  var ARM_LX = 0.34;
  var ARM_LZ = 0.0;
  var GRIP_OPEN = 0.055;
  var GRIP_CLOSED = 0.018;
  var JOINT_SPEED = 0.75;
  var DECK_Y = 0.30;

  var manifest = null;
  var queue = [];
  var haulerItems = [];
  var bay = [];
  var depot = [];
  var trips = 0;
  var phase = 'idle';
  var missionArmed = false;
  var landerLanded = true;
  var hatchOpen = 1.0;
  var descendT = 8;
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
  var parkGap = { pick: 0.22, drop: 0.22 };
  var reachWarned = false;
  var traj = null;
  var armMode = null;
  var gripRetry = 0;
  var crane = null;
  var _tip = new THREE.Vector3();
  var _grasp = new THREE.Vector3();

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
    box(0.7, 0.04, 0.7, mat(0x334155, 0.5, 0.6), intake, 0, DECK_Y, 0);
    [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].forEach(function (p) {
      box(0.04, DECK_Y, 0.04, mat(0x0f172a, 0.45, 0.7), intake, p[0], DECK_Y * 0.5, p[1]);
    });
    tableAnchor = new THREE.Object3D();
    tableAnchor.position.set(0.18, DECK_Y, 0);
    intake.add(tableAnchor);

    crane = buildCrane(baseGroup);
    crane.root.position.y = deckLift;
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

  function parcelColor(day) {
    var colors = [0xf97316, 0x22c55e, 0x38bdf8, 0xeab308, 0xa78bfa, 0xf43f5e];
    return colors[(day || 1) % colors.length];
  }

  function makeParcelMesh(rec) {
    var d = rec.dim_m || [0.43, 0.25, 0.25];
    var h = d[2];
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(d[0], h, d[1]), mat(parcelColor(rec.day_number), 0.78, 0.08));
    mesh.castShadow = true;
    mesh.userData.rec = rec;
    mesh.userData.h = h;
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(d[0] * 0.92, 0.015, 0.035), mat(0x111827, 0.5, 0.2));
    stripe.position.y = h * 0.2;
    mesh.add(stripe);
    var postMat = mat(0x1f2937, 0.45, 0.4);
    [-0.06, 0.06].forEach(function (x) {
      var post = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.015), postMat);
      post.position.set(x, h * 0.5 + 0.02, 0);
      mesh.add(post);
    });
    var bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.016), postMat);
    bar.position.set(0, h * 0.5 + 0.038, 0);
    mesh.add(bar);
    var grasp = new THREE.Object3D();
    grasp.position.set(0, h * 0.5, 0);
    mesh.add(grasp);
    mesh.userData.grasp = grasp;
    return mesh;
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
    var stage;
    var label;
    if (which === 'transit_lander') {
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
      return {
        x: 0,
        z: 1,
        faceX: RACK.x,
        faceZ: -35.74,
        roverX: RACK.x,
        roverZ: -35.02,
        yaw: Math.PI / 2
      };
    }
    return {
      x: 1,
      z: 0,
      faceX: INTAKE.x + 0.18,
      faceZ: INTAKE.z,
      roverX: -19.68,
      roverZ: INTAKE.z,
      yaw: Math.PI
    };
  }

  function parkPose() {
    var dir = approachDir();
    return { x: dir.roverX, z: dir.roverZ, faceX: dir.faceX, faceZ: dir.faceZ, targetYaw: dir.yaw };
  }

  function solveArm(local) {
    var L1 = 0.26;
    var L2 = 0.24;
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
    var speed = JOINT_SPEED * (carried > 2 ? 0.7 : 1);
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
        nextEl = -2.15;
      } else if (w.local) {
        var sol = solveArm(w.local);
        if (!sol.reachable) missed = true;
        nextYaw = yaw + wrap(sol.yaw - yaw);
        nextSh = sol.shoulder;
        nextEl = sol.elbow;
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
        dur: dur,
        tag: w.tag || '',
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

  function playTraj(dt) {
    if (!traj) return true;
    var seg = traj.segs[traj.i];
    traj.t += dt;
    var u = quintic(Math.min(1, traj.t / seg.dur));
    setJoints(
      seg.yaw0 + (seg.yaw1 - seg.yaw0) * u,
      seg.sh0 + (seg.sh1 - seg.sh0) * u,
      seg.el0 + (seg.el1 - seg.el0) * u,
      seg.g0 + (seg.g1 - seg.g0) * u
    );
    if (traj.t < seg.dur) return false;
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
    return mesh && (mesh.userData.beltT >= mesh.userData.beltDur - 1e-3 || Math.abs(mesh.position.z - beltTargetZ(0)) < 0.06);
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
      mesh.position.y = DECK_Y + halfH(mesh) + 0.02;
      watchJump(mesh, dt);
    }
    for (var r = 0; r < rollers.length; r++) {
      if (moving) rollers[r].rotation.x += dt * 5.5;
    }
    if (readyLight) readyLight.material.emissiveIntensity = beltReady() ? 1.7 : 0.12;
  }

  function dropFromQueue(mesh) {
    var rec = mesh.userData.rec;
    var qi = queue.indexOf(rec);
    if (qi >= 0) queue.splice(qi, 1);
    var bi = belt.indexOf(mesh);
    if (bi >= 0) belt.splice(bi, 1);
  }

  function nudgeCloser() {
    if (phase === 'arm_pick' || armMode === 'pick') {
      if (parkGap.pick > 0.16) parkGap.pick -= 0.05;
      phase = 'align_pick';
    } else {
      if (parkGap.drop > 0.16) parkGap.drop -= 0.05;
      phase = 'align_drop';
    }
    traj = null;
    armMode = null;
    if (!reachWarned) {
      reachWarned = true;
      log('<span class="text-amber-300">[ARM] Target outside the 0.45 m reach. Easing 5 cm closer.</span>');
    }
  }

  function startPickSequence() {
    if (!beltReady()) return;
    ensureTip();
    var mesh = belt[0];
    var grasp = worldTarget(mesh.userData.grasp);
    var pre = grasp.clone();
    pre.y += 0.12;
    picking = mesh;
    gripRetry = 0;
    armMode = 'pick';
    var lift = grasp.clone();
    lift.y += 0.16;
    var slots = window.cargoBaySlots || [];
    var slot = slots[bay.length] || slots[0];
    var seat = worldTarget(slot);
    seat.y += mesh.userData.h + 0.01;
    var raised = seat.clone();
    raised.y += 0.14;
    var mid = new THREE.Vector3().addVectors(lift, raised).multiplyScalar(0.5);
    mid.y = Math.max(lift.y, raised.y) + 0.10;
    buildTraj([
      { local: pre, grip: GRIP_OPEN },
      { local: grasp, grip: GRIP_OPEN },
      { grip: GRIP_CLOSED, dur: 0.35, tag: 'close' },
      { local: lift, grip: GRIP_CLOSED },
      { local: mid, grip: GRIP_CLOSED },
      { local: raised, grip: GRIP_CLOSED },
      { local: seat, grip: GRIP_CLOSED, tag: 'seat' },
      { grip: GRIP_OPEN, dur: 0.35, tag: 'openBay' },
      { local: raised, grip: GRIP_OPEN },
      { stow: true, grip: GRIP_OPEN, tag: 'stowedPick' },
    ]);
    log('<span class="text-cyan-300 font-bold">[ARM] Reaching for ' + mesh.userData.rec.id + ' · ' + mesh.userData.rec.source_item + '.</span>');
  }

  function startPlaceSequence() {
    if (!bay.length || tableParcel) return;
    ensureTip();
    var mesh = bay[bay.length - 1];
    var grasp = worldTarget(mesh.userData.grasp);
    var tableWp = new THREE.Vector3();
    tableAnchor.getWorldPosition(tableWp);
    tableWp.y += mesh.userData.h + 0.04;
    var place = armFrameLocal(tableWp);
    var placeUp = place.clone();
    placeUp.y += 0.14;
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
    var mid = new THREE.Vector3().addVectors(grasp, placeUp).multiplyScalar(0.5);
    mid.y = Math.max(grasp.y, placeUp.y) + 0.10;
    buildTraj([
      { local: pre, grip: GRIP_OPEN },
      { local: grasp, grip: GRIP_OPEN },
      { grip: GRIP_CLOSED, dur: 0.35, tag: 'closeBay' },
      { local: pre, grip: GRIP_CLOSED },
      { local: mid, grip: GRIP_CLOSED },
      { local: placeUp, grip: GRIP_CLOSED },
      { local: place, grip: GRIP_CLOSED, tag: 'seat' },
      { grip: GRIP_OPEN, dur: 0.35, tag: 'openTable' },
      { local: placeUp, grip: GRIP_OPEN },
      { stow: true, grip: GRIP_OPEN, tag: 'stowedPlace' },
    ]);
    log('<span class="text-cyan-300">[ARM] Offloading ' + mesh.userData.rec.id + ' · ' + mesh.userData.rec.source_item + ' to intake table.</span>');
  }

  function onArmTag(tag) {
    var arm = window.roverArm;
    if (tag === 'close' || tag === 'closeBay') {
      var mesh = picking;
      var dist = mesh ? gripDist(mesh) : 99;
      window.__lastGripDist = dist;
      if (mesh && dist <= 0.08) {
        var gr = arm ? (arm.gripper || arm.wrist) : null;
        if (gr && gr.attach) gr.attach(mesh); else if (gr) gr.add(mesh);
        held = mesh;
        if (tag === 'close') dropFromQueue(mesh);
        else {
          var bi = bay.indexOf(mesh);
          if (bi >= 0) bay.splice(bi, 1);
        }
      } else if (mesh && gripRetry < 1) {
        gripRetry += 1;
        var again = worldTarget(mesh.userData.grasp);
        var fix = {
          segs: [{
            yaw0: arm.base.rotation.y,
            yaw1: arm.base.rotation.y + wrap(solveArm(again).yaw - arm.base.rotation.y),
            sh0: arm.shoulder.rotation.z,
            sh1: solveArm(again).shoulder,
            el0: arm.elbow.rotation.z,
            el1: solveArm(again).elbow,
            g0: GRIP_OPEN,
            g1: GRIP_OPEN,
            dur: 0.45,
            tag: '',
          }, {
            yaw0: 0, yaw1: 0, sh0: 0, sh1: 0, el0: 0, el1: 0,
            g0: GRIP_OPEN, g1: GRIP_CLOSED, dur: 0.35, tag: tag,
          }],
          i: 0,
          t: 0,
        };
        var sol = solveArm(again);
        fix.segs[1].yaw0 = fix.segs[0].yaw1;
        fix.segs[1].yaw1 = fix.segs[0].yaw1;
        fix.segs[1].sh0 = sol.shoulder;
        fix.segs[1].sh1 = sol.shoulder;
        fix.segs[1].el0 = sol.elbow;
        fix.segs[1].el1 = sol.elbow;
        if (traj) {
          fix.segs = fix.segs.concat(traj.segs.slice(traj.i));
        }
        traj = fix;
        log('<span class="text-amber-300">[ARM] Grip was ' + (dist * 100).toFixed(1) + ' cm off the handle. Correcting.</span>');
      } else if (mesh) {
        var gr = arm ? (arm.gripper || arm.wrist) : null;
        if (gr && gr.attach) gr.attach(mesh); else if (gr) gr.add(mesh);
        held = mesh;
        if (tag === 'close') dropFromQueue(mesh);
        else {
          var bi2 = bay.indexOf(mesh);
          if (bi2 >= 0) bay.splice(bi2, 1);
        }
        log('<span class="text-emerald-300 font-bold">[ARM] Gripper locked onto ' + mesh.userData.rec.id + '.</span>');
      }
    } else if (tag === 'openBay' && held) {
      var slots = window.cargoBaySlots || [];
      var slot = slots[bay.length] || slots[0];
      if (slot && slot.attach) slot.attach(held);
      else if (slot) slot.add(held);
      bay.push(held);
      if (typeof window.noteCargoSeat === 'function') window.noteCargoSeat(held.userData.rec.mass_kg);
      log('<span class="text-emerald-300 font-bold">[ARM] Stowed ' + held.userData.rec.id + ' (' + held.userData.rec.mass_kg.toFixed(1) + ' kg, ' + (held.userData.rec.mass_kg * G_MOON).toFixed(1) + ' N lunar).</span>');
      held = null;
      picking = null;
    } else if (tag === 'openTable' && held) {
      if (tableAnchor && tableAnchor.attach) tableAnchor.attach(held);
      else if (tableAnchor) tableAnchor.add(held);
      tableParcel = held;
      if (crane) crane.queue.push(held);
      log('<span class="text-cyan-300">[ARM] Set ' + held.userData.rec.id + ' on the intake table.</span>');
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
      arm.elbow.rotation.z + (-2.15 - arm.elbow.rotation.z) * Math.min(1, 2.2 * dt),
      gripGap() + (GRIP_OPEN - gripGap()) * Math.min(1, 3 * dt)
    );
  }

  function applyCompliance(dt) {
    var arm = window.roverArm;
    if (!arm) return;
    var tilt = held ? -0.035 * Math.min(1, heldMass() / 5) : 0;
    arm.base.rotation.x += (tilt - arm.base.rotation.x) * Math.min(1, 2.5 * dt);
  }

  function tickArm(dt) {
    ensureTip();
    if (!traj) {
      if (phase === 'arm_pick') startPickSequence();
      else if (phase === 'arm_place') startPlaceSequence();
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
    if (mesh !== tableParcel) return;
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
    return roverWh / MAXWH < 0.18;
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
      phase = 'arm_place';
      return;
    }
    if (queue.length && depot.length < DEPOT_SLOTS && !socLow()) {
      beginLeg('transit_lander');
      return;
    }
    finishOrHangar();
  }

  function finishOrHangar() {
    phase = 'rth';
    missionArmed = false;
    if (socLow()) log('<span class="text-amber-300">[LOGISTICS] Battery low. Returning to the hangar.</span>');
    else if (!queue.length) log('<span class="text-emerald-400 font-bold">[LOGISTICS] Rover parcels moved. Hauler items stay at the pad.</span>');
    else log('<span class="text-amber-300">[DEPOT] Shelves are full. Remaining parcels stay on the lander belt.</span>');
    if (typeof startReturnToDock === 'function') startReturnToDock();
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
    if (leftEl) leftEl.textContent = String(queue.length);
    if (haulEl) haulEl.textContent = String(haulerItems.length);
    if (tripEl) tripEl.textContent = String(trips);
    if (phaseEl) phaseEl.textContent = phase.replace(/_/g, ' ').toUpperCase();
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
        (phase.includes('arm') ? 'bg-cyan-500/30 text-cyan-200' :
         phase.includes('transit') ? 'bg-amber-500/30 text-amber-200' :
         phase.includes('align') ? 'bg-purple-500/30 text-purple-200' : 'bg-emerald-500/20 text-emerald-300');
    }
  }

  function spawnPlume(dt) {
    if (!plume) return;
    var descending = phase === 'descent';
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

  var api = {
    phase: function () { return phase; },
    payloadKg: function () { return bayMass() + heldMass(); },
    bayCount: function () { return bay.length; },
    depotKg: function () { return depotMass(); },
    trips: function () { return trips; },
    craneBusy: function () { return !!(crane && (crane.job || crane.queue.length || tableParcel)); },
    jumps: function () { return window.__cargoJumps || []; },
    holdsDrive: function () { return phase === 'arm_pick' || phase === 'arm_place'; },
    ownsGoal: function () { return phase === 'transit_lander' || phase === 'transit_base'; },
    onArrived: function () {
      if (typeof globalGoal !== 'undefined') globalGoal = null;
      if (typeof waypoint !== 'undefined') waypoint = null;
      if (phase === 'transit_lander') phase = 'align_pick';
      else if (phase === 'transit_base') phase = 'align_drop';
    },
    driveOverride: function () {
      if (phase === 'arm_pick' || phase === 'arm_place') {
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
      var useStop = dist < 0.28;
      var yawErr = wrap((useStop ? stopYaw : driveYaw) - roverYaw);
      var stopErr = wrap(stopYaw - roverYaw);
      var ms = (typeof activeMotor !== 'undefined' && activeMotor.maxSpeed) ? activeMotor.maxSpeed : 0.94;
      if (dist < 0.22 && Math.abs(stopErr) < 0.28) {
        if (Math.abs(vel) < 0.06 || (dist < 0.14 && Math.abs(stopErr) < 0.18)) {
          phase = phase === 'align_pick' ? 'arm_pick' : 'arm_place';
          traj = null;
          armMode = null;
          gripRetry = 0;
          log(phase === 'arm_pick'
            ? '<span class="text-cyan-300 font-bold">[ARM] At the lander belt. Waiting on the handle.</span>'
            : '<span class="text-cyan-300 font-bold">[ARM] At the intake table. Offloading cargo.</span>');
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
      var steer = Math.max(-1.15, Math.min(1.15, yawErr * 1.8));
      return { steer: steer, throttle: v > 0.02 ? Math.min(1, v / ms) : 0, forward: v > 0.02, reverse: false, brake: false };
    },
    obstacles: function () {
      var list = [{ x: BASE.x, z: BASE.z, r: 3.1 }];
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
    deployLander: function () {
      if (phase === 'descent' || landerLanded) {
        log('<span class="text-slate-400">[LANDER] Already down or on approach.</span>');
        return;
      }
      phase = 'descent';
      descendT = 0;
      if (landerGroup && landerGroup.userData.light) landerGroup.userData.light.intensity = 6;
      log('<span class="text-amber-300 font-bold">[LANDER] Cargo module on descent to the south-east pad.</span>');
    },
    startMission: function () {
      wanderOn = false;
      missionArmed = true;
      if (!manifest) {
        log('<span class="text-amber-300">[LOGISTICS] Manifest pending; initializing defaults...</span>');
        initFallbackManifest();
      }
      if (!landerLanded) {
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
      if (!landerLanded && phase !== 'descent') api.deployLander();
      beginLeg('transit_lander');
      log('<span class="text-cyan-300 font-bold">[NAV] Routing to Commercial Cargo Lander staging pad.</span>');
    },
    goToBase: function () {
      wanderOn = false;
      missionArmed = true;
      beginLeg('transit_base');
      log('<span class="text-cyan-300 font-bold">[NAV] Routing to Artemis Lunar Base cargo intake deck.</span>');
    },
    goToHangar: function () {
      finishOrHangar();
    },
    pickupCargo: function () {
      var dLander = Math.hypot(roverGroup.position.x - RACK.x, roverGroup.position.z - RACK.z);
      if (dLander > 4.5) {
        log('<span class="text-amber-300">[ARM] Rover is ' + dLander.toFixed(1) + ' m from lander. Driving to lander first...</span>');
        api.goToLander();
        return;
      }
      phase = 'arm_pick';
      traj = null;
      armMode = null;
      gripRetry = 0;
      startPickSequence();
      log('<span class="text-emerald-400 font-bold">[ARM] Executing robotic arm pickup sequence.</span>');
    },
    dropCargo: function () {
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
      startPlaceSequence();
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
      spawnPlume(dt);
      tickBelt(dt);
      tickCrane(dt);
      if (phase === 'arm_pick' || phase === 'arm_place') tickArm(dt);
      else stowIfIdle(dt);
      if (missionArmed && landerLanded && (phase === 'idle' || phase === 'descent')) {
        phase = 'idle';
        api.startMission();
      }
      updateHud();
    },
  };

  function onManifest(data) {
    manifest = data;
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
})();
