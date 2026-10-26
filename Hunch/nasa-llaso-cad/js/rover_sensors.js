/*
 * Rover sensor suite (simulated, with noise) and the HUD panel that shows it.
 *
 *  IMU            3-axis accelerometer + 3-axis gyro, sampled from the real chassis motion.
 *                 Reports specific force in lunar g, Earth g equivalent, jerk and shock.
 *  Attitude       complementary filter (gyro + gravity vector). No magnetometer on the Moon, so
 *                 yaw comes from the gyro and slowly pulls toward a sun-sensor fix.
 *  Stabilisation  the sensor mast is leaned against the IMU roll/pitch estimate.
 *  Wheel sensors  encoder rpm, load cell (N), motor current from the drive force.
 *  Thermal        pack, driver, Pi, bay air, exhaust and six motor temperatures.
 *  Power          bus voltage, current, SoC, charge current.
 *  Arm / gripper  joint angles, shoulder torque, required clamp force for the held pod.
 *  Terrain        look-ahead slope and roughness, sinkage, slip.
 */
(function (global) {
  'use strict';
  var G = 1.622, G_EARTH = 9.80665, DEG = 180 / Math.PI;
  var R_WHEEL = 0.10;
  var WHEELS = ['FL', 'ML', 'BL', 'FR', 'MR', 'BR'];

  function gauss() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  var imu = {
    acc: [0, G, 0],             // specific force, body frame (x fwd, y up, z starboard), m/s^2
    gyro: [0, 0, 0],            // rad/s
    gMoon: 1, gEarth: G / G_EARTH, jerk: 0, shock: 0, vibRms: 0,
    accBias: [0.006, -0.004, 0.003], gyroBias: [0.0008, -0.0005, 0.0006],
    pitchEst: 0, rollEst: 0, yawEst: 0, yawErr: 0,
    pitchTrue: 0, rollTrue: 0,
    tilt: 0, ready: false
  };
  var prev = { q: null, y: 0, vy: 0, ay: 0, acc: null };
  var qInv = null, vTmp = null, qDelta = null;
  var gimbal = { x: 0, z: 0 };
  var out = { imu: imu, gimbal: gimbal, thermal: {}, power: {}, wheels: [], arm: {}, terrain: {}, alerts: [] };
  var panel = null, els = {}, lastDraw = 0, collapsed = false;

  function ensureTemps() {
    if (!qInv) { qInv = new THREE.Quaternion(); vTmp = new THREE.Vector3(); qDelta = new THREE.Quaternion(); }
  }

  function updateImu(c) {
    ensureTemps();
    var dt = clamp(c.dt, 0.004, 0.1);
    var q = c.quat;
    if (!prev.q) { prev.q = q.clone(); prev.y = c.pos.y; }
    // gyro from the quaternion step, in the body frame
    qDelta.copy(prev.q).invert().multiply(q);
    if (qDelta.w < 0) { qDelta.x = -qDelta.x; qDelta.y = -qDelta.y; qDelta.z = -qDelta.z; qDelta.w = -qDelta.w; }
    var w = [2 * qDelta.x / dt, 2 * qDelta.y / dt, 2 * qDelta.z / dt];
    prev.q.copy(q);
    // vertical acceleration of the chassis (low-passed second difference of height)
    var vy = (c.pos.y - prev.y) / dt;
    prev.y = c.pos.y;
    var ayRaw = (vy - prev.vy) / dt;
    prev.vy = vy;
    prev.ay += (clamp(ayRaw, -4, 4) - prev.ay) * Math.min(1, dt / 0.15);
    // world acceleration from the drive model
    var cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    var aLat = c.vel * c.yawRate;
    var ax = c.accel * cy + aLat * (-sy);
    var az = c.accel * (-sy) + aLat * (-cy);
    // terrain-induced vibration scales with speed and ground roughness
    var terr = c.terrain || { rough: 0, slope: 0 };
    var vib = gauss() * (0.04 + 7 * terr.rough) * Math.min(1, Math.abs(c.vel) / 0.45);
    vTmp.set(ax, prev.ay + G + vib, az);
    qInv.copy(q).invert();
    vTmp.applyQuaternion(qInv);
    var f = [vTmp.x, vTmp.y, vTmp.z];
    var noise = 0.014;
    for (var i = 0; i < 3; i++) {
      f[i] += imu.accBias[i] + gauss() * noise;
      w[i] += imu.gyroBias[i] + gauss() * 0.0012;
      imu.accBias[i] += gauss() * 0.00004;       // bias random walk
      imu.gyroBias[i] += gauss() * 0.000004;
    }
    var mag = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]);
    if (prev.acc) {
      var dj = Math.sqrt(Math.pow(f[0] - prev.acc[0], 2) + Math.pow(f[1] - prev.acc[1], 2) + Math.pow(f[2] - prev.acc[2], 2)) / dt;
      imu.jerk += (dj - imu.jerk) * Math.min(1, dt / 0.3);
    }
    prev.acc = f.slice();
    imu.acc = f;
    imu.gyro = w;
    imu.gMoon = mag / G;
    imu.gEarth = mag / G_EARTH;
    var dev = mag - G;
    imu.shock = Math.max(Math.abs(dev), imu.shock * Math.exp(-dt / 0.8));
    imu.vibRms = Math.sqrt(Math.max(0, imu.vibRms * imu.vibRms * (1 - Math.min(1, dt / 1.5)) + dev * dev * Math.min(1, dt / 1.5)));
    // attitude: complementary filter. gyro z = pitch rate, gyro x = -roll rate, gyro y = yaw rate
    // remove the motion terms the wheel odometry and gyro already explain (along-track accel, centripetal v*w)
    var fxg = f[0] - c.accel, fzg = f[2] + w[1] * c.vel;
    var pAcc = Math.atan2(fxg, Math.sqrt(f[1] * f[1] + fzg * fzg));
    var rAcc = Math.atan2(fzg, Math.sqrt(fxg * fxg + f[1] * f[1]));
    var trust = clamp(1 - Math.abs(mag - G) / (0.35 * G), 0, 1);
    var alpha = 0.02 * trust;
    if (!imu.ready) { imu.pitchEst = pAcc; imu.rollEst = rAcc; imu.yawEst = c.yaw; imu.ready = true; }
    imu.pitchEst = (1 - alpha) * (imu.pitchEst + w[2] * dt) + alpha * pAcc;
    imu.rollEst = (1 - alpha) * (imu.rollEst - w[0] * dt) + alpha * rAcc;
    imu.yawEst += w[1] * dt;
    var yerr = Math.atan2(Math.sin(c.yaw - imu.yawEst), Math.cos(c.yaw - imu.yawEst));
    imu.yawEst += yerr * Math.min(1, dt / 45);          // sun-sensor fix, ~45 s time constant
    imu.yawErr = yerr;
    imu.pitchTrue = c.pitch; imu.rollTrue = c.roll;
    imu.tilt = Math.acos(clamp(Math.cos(imu.pitchEst) * Math.cos(imu.rollEst), -1, 1));
  }

  function updateStabiliser(c) {
    var mast = global.sensorMastGroup;
    var k = Math.min(1, c.dt * 6);
    var tx = clamp(imu.rollEst * 0.85, -0.2, 0.2);
    var tz = clamp(-imu.pitchEst * 0.85, -0.2, 0.2);
    gimbal.x += (tx - gimbal.x) * k;
    gimbal.z += (tz - gimbal.z) * k;
    if (mast) { mast.rotation.x = gimbal.x; mast.rotation.z = gimbal.z; }
  }

  function updateWheels(c) {
    var d = c.dyn;
    var driveN = d ? d.massKg * Math.abs(c.driveAccel || 0) : 0;
    var sumN = 0, i;
    if (d) for (i = 0; i < 6; i++) sumN += d.loads[i];
    var rpm = (c.vel / R_WHEEL) * 60 / (2 * Math.PI);
    out.wheels = [];
    for (i = 0; i < 6; i++) {
      var N = d ? d.loads[i] : 0;
      var share = sumN > 1e-6 ? N / sumN : 1 / 6;
      var F = driveN * share;
      var cur = 0.18 + (F * R_WHEEL) / 0.30;
      out.wheels.push({
        id: WHEELS[i], loadN: N, loadFrac: d && d.totalN ? N / (d.totalN / 6) : 1,
        rpm: rpm * (1 + gauss() * 0.004), currentA: cur,
        gripN: d ? d.wheelGrip[i] : 0, slip: d ? d.slipRisk[i] : 0
      });
    }
  }

  function updateThermal(c) {
    var t = c.thermal;
    if (!t) return;
    var n = function (v) { return v + gauss() * 0.08; };
    out.thermal = {
      battery: n(t.batteryC), driver: n(t.driverC), pi: n(t.piChipC), bay: n(t.chamberC),
      exhaust: n(t.exhaustC), ambient: t.ambientC,
      motors: (t.motorsC || []).map(n), imuDie: n(t.chamberC + 3.2),
      status: t.status || 'NOMINAL', throttle: t.throttleFactor != null ? t.throttleFactor : 1,
      fanRpm: t.fanRpm
    };
  }

  function updatePower(c) {
    var soc = clamp(c.soc, 0, 1);
    var v = 11.0 + 2.5 * Math.pow(soc, 0.8) - 0.012 * c.drawW;
    var i = c.charging && c.charging.docked ? -(c.charging.chargeW / Math.max(10, v)) : c.drawW / Math.max(10, v);
    out.power = { busV: v, currentA: i, drawW: c.drawW, soc: soc, wh: c.wh, spares: c.spares, charging: !!(c.charging && c.charging.docked), chargeW: c.charging ? c.charging.chargeW : 0 };
  }

  function updateArm(c) {
    var a = c.arm;
    if (!a) return;
    var f = Math.sqrt(imu.acc[0] * imu.acc[0] + imu.acc[1] * imu.acc[1] + imu.acc[2] * imu.acc[2]);
    var held = c.heldKg || 0;
    var reachH = a.L1 * Math.cos(a.sh) + a.L2 * Math.cos(a.sh + a.el);
    var tau = (held * f * Math.abs(reachH + 0.03)) + 0.35 * f * Math.abs(0.5 * a.L1 * Math.cos(a.sh) + 0.5 * a.L2 * Math.cos(a.sh + a.el));
    // Parallel-jaw clamp: two pads, mu 0.75, safety factor 2 on the load seen in the gripper
    var clamp_ = held > 0 ? (held * f) / (2 * 0.75) * 2 : 0;
    out.arm = { yaw: a.yaw, sh: a.sh, el: a.el, jawMm: a.grip * 2000, shoulderNm: tau, clampN: clamp_, heldKg: held, loadG: f / G };
  }

  function updateTerrain(c) {
    var t = c.terrain || { slope: 0, rough: 0 };
    out.terrain = { slope: t.slope, rough: t.rough, sinkCm: c.sinkCm, slip: c.slipRatio };
  }

  function updateAlerts(c) {
    var a = [];
    var d = c.dyn;
    if (imu.tilt > 0.30) a.push('TILT ' + (imu.tilt * DEG).toFixed(0) + '°');
    if (imu.shock > 0.55 * G) a.push('SHOCK ' + (imu.shock / G).toFixed(2) + ' g');
    if (d && d.lifted > 0) a.push(d.lifted + ' WHEEL LIGHT');
    if (d && d.tipMarginRoll < 0.5) a.push('ROLLOVER MARGIN LOW');
    if (out.thermal.status && out.thermal.status !== 'NOMINAL' && out.thermal.status !== 'WARM') a.push('THERMAL ' + out.thermal.status);
    if (c.slipRatio > 0.95) a.push('WHEEL SLIP');
    out.alerts = a;
  }

  // ---------------- HUD ----------------
  function row(label, id, extra) {
    return '<div style="display:flex;justify-content:space-between;gap:6px"><span style="color:#64748b">' + label + '</span><span id="' + id + '" style="color:' + (extra || '#e2e8f0') + ';text-align:right">—</span></div>';
  }
  function head(t) {
    return '<div style="margin-top:6px;padding-top:4px;border-top:1px solid rgba(148,163,184,.25);color:#38bdf8;font-weight:700;letter-spacing:.06em">' + t + '</div>';
  }
  function buildPanel() {
    if (panel || typeof document === 'undefined') return;
    var host = document.getElementById('hud-panels') || document.body;
    panel = document.createElement('div');
    panel.id = 'sensor-panel';
    var floating = host.id === 'hud-panels' || host === document.body;
    panel.style.cssText = 'font:9px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;color:#e2e8f0;' +
      (floating ? 'position:absolute;right:284px;top:64px;width:240px;max-height:calc(100dvh - 76px);overflow:auto;z-index:11;padding:8px;background:rgba(2,6,23,.72);border:1px solid rgba(56,189,248,.28);border-radius:14px;pointer-events:auto' : 'padding-top:6px;border-top:1px solid rgba(148,163,184,.25)');
    var h = '<div id="sn-title" style="display:flex;justify-content:space-between;cursor:pointer;color:#7dd3fc;font-weight:700;letter-spacing:.08em"><span>SENSORS &amp; LOAD</span><span id="sn-toggle">▾</span></div><div id="sn-body">';
    h += head('MASS · LUNAR WEIGHT') + row('Rover', 'sn-m-rover') + row('Cargo', 'sn-m-cargo') + row('Total', 'sn-m-total') + row('Weight (g 1.622)', 'sn-m-w') + row('CoM x / h', 'sn-m-com');
    h += head('WHEEL LOAD · GRIP (N)');
    for (var i = 0; i < 6; i++) h += '<div style="display:flex;align-items:center;gap:4px"><span style="width:16px;color:#64748b">' + WHEELS[i] + '</span><div style="flex:1;height:5px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden"><div id="sn-wb' + i + '" style="height:100%;width:0;background:#34d399"></div></div><span id="sn-wv' + i + '" style="width:62px;text-align:right">—</span></div>';
    h += row('Grip limit', 'sn-grip') + row('Tip margin', 'sn-tip');
    h += head('IMU') + row('Accel x/y/z', 'sn-acc') + row('Gyro °/s', 'sn-gyro') + row('Force', 'sn-g') + row('Pitch / roll', 'sn-att') + row('Heading drift', 'sn-yaw') + row('Vibration', 'sn-vib') + row('Mast stabiliser', 'sn-stab');
    h += head('THERMAL °C') + row('Pack', 'sn-t-bat') + row('Driver / Pi', 'sn-t-dp') + row('Bay / exhaust', 'sn-t-be') + row('Motors', 'sn-t-mot') + row('State', 'sn-t-state');
    h += head('POWER') + row('Bus', 'sn-p-bus') + row('SoC / Wh', 'sn-p-soc') + row('Dock spares', 'sn-p-res') + row('Charge', 'sn-p-chg') + row('Energy mode', 'sn-p-mode');
    h += head('ARM · GRIPPER') + row('Joints °', 'sn-a-j') + row('Shoulder torque', 'sn-a-tau') + row('Clamp force', 'sn-a-clamp') + row('Jaw gap', 'sn-a-jaw');
    h += head('TERRAIN') + row('Ahead slope / rough', 'sn-r-ahead') + row('Sinkage / slip', 'sn-r-sink');
    h += '<div id="sn-alerts" style="margin-top:6px;color:#fca5a5;font-weight:700"></div></div>';
    panel.innerHTML = h;
    host.appendChild(panel);
    var title = panel.querySelector('#sn-title');
    title.onclick = function () {
      collapsed = !collapsed;
      document.getElementById('sn-body').style.display = collapsed ? 'none' : 'block';
      document.getElementById('sn-toggle').textContent = collapsed ? '▸' : '▾';
    };
    var ids = panel.querySelectorAll('[id]');
    for (var k = 0; k < ids.length; k++) els[ids[k].id] = ids[k];
  }
  function set(id, txt, color) {
    var e = els[id];
    if (!e) return;
    if (e.textContent !== txt) e.textContent = txt;
    if (color) e.style.color = color;
  }
  function f1(v) { return v.toFixed(1); }
  function f2(v) { return v.toFixed(2); }

  function draw(c) {
    if (!panel) buildPanel();
    var d = c.dyn, LB = 0.45359237;
    if (d) {
      set('sn-m-rover', f1(15) + ' lb · ' + f2(15 * LB) + ' kg');
      set('sn-m-cargo', f1(d.cargoKg / LB) + ' lb · ' + f2(d.cargoKg) + ' kg');
      set('sn-m-total', f1(d.massKg / LB) + ' lb · ' + f2(d.massKg) + ' kg');
      set('sn-m-w', f2(d.totalN) + ' N (' + f2(d.totalN / 4.4482) + ' lbf)');
      set('sn-m-com', (d.com.x * 100).toFixed(0) + ' / ' + (d.com.h * 100).toFixed(0) + ' cm');
      var mean = d.totalN / 6;
      for (var i = 0; i < 6; i++) {
        var N = d.loads[i], b = els['sn-wb' + i];
        if (b) { b.style.width = clamp(N / (2 * mean) * 100, 0, 100) + '%'; b.style.background = N < 0.4 * mean ? '#f87171' : (N > 1.6 * mean ? '#fbbf24' : '#34d399'); }
        set('sn-wv' + i, f2(N) + ' / ' + f2(d.wheelGrip[i]));
      }
      set('sn-grip', f2(d.gripN) + ' N · ' + f2(d.gripAccel) + ' m/s²');
      set('sn-tip', 'roll ' + f2(d.tipMarginRoll) + ' · pitch ' + f2(d.tipMarginPitch) + ' m/s²', d.tipMarginRoll < 0.5 ? '#f87171' : '#e2e8f0');
    }
    set('sn-acc', f2(imu.acc[0]) + ' ' + f2(imu.acc[1]) + ' ' + f2(imu.acc[2]));
    set('sn-gyro', (imu.gyro[0] * DEG).toFixed(1) + ' ' + (imu.gyro[1] * DEG).toFixed(1) + ' ' + (imu.gyro[2] * DEG).toFixed(1));
    set('sn-g', f2(imu.gMoon) + ' g(moon) · ' + (imu.gEarth).toFixed(3) + ' g(earth)');
    set('sn-att', (imu.pitchEst * DEG).toFixed(1) + '° / ' + (imu.rollEst * DEG).toFixed(1) + '°');
    set('sn-yaw', (imu.yawErr * DEG).toFixed(2) + '°');
    set('sn-vib', f2(imu.vibRms) + ' m/s² rms · shock ' + f2(imu.shock / G) + ' g');
    set('sn-stab', 'x ' + (gimbal.x * DEG).toFixed(1) + '° z ' + (gimbal.z * DEG).toFixed(1) + '°');
    var t = out.thermal;
    if (t && t.motors) {
      set('sn-t-bat', f1(t.battery) + (t.battery > 45 ? ' hot' : ''), t.battery > 45 ? '#fbbf24' : '#e2e8f0');
      set('sn-t-dp', f1(t.driver) + ' / ' + f1(t.pi));
      set('sn-t-be', f1(t.bay) + ' / ' + f1(t.exhaust));
      var mm = t.motors.map(function (v) { return v.toFixed(0); }).join(' ');
      set('sn-t-mot', mm);
      set('sn-t-state', t.status + (t.throttle < 1 ? ' · derate ' + (t.throttle * 100).toFixed(0) + '%' : ''), t.status === 'NOMINAL' ? '#34d399' : '#fbbf24');
    }
    var p = out.power;
    if (p) {
      set('sn-p-bus', f2(p.busV) + ' V · ' + f2(p.currentA) + ' A · ' + f1(p.drawW) + ' W');
      set('sn-p-soc', (p.soc * 100).toFixed(1) + '% · ' + f1(p.wh) + ' Wh');
      if (p.spares) set('sn-p-res', p.spares.map(function (w) { return (w / 64 * 100).toFixed(0) + '%'; }).join(' · '));
      set('sn-p-chg', p.charging ? f1(p.chargeW) + ' W in (time-lapse ×' + (c.timelapse || 1) + ')' : 'not docked', p.charging ? '#34d399' : '#64748b');
      set('sn-p-mode', (c.powerMode || '').toUpperCase() + (c.powerAuto ? ' · AUTO' : ' · MANUAL'));
    }
    var a = out.arm;
    if (a && a.yaw != null) {
      set('sn-a-j', (a.yaw * DEG).toFixed(0) + ' ' + (a.sh * DEG).toFixed(0) + ' ' + (a.el * DEG).toFixed(0));
      set('sn-a-tau', f2(a.shoulderNm) + ' N·m (load ' + f2(a.loadG) + ' g)');
      set('sn-a-clamp', a.heldKg > 0 ? f1(a.clampN) + ' N for ' + f2(a.heldKg) + ' kg' : 'open');
      set('sn-a-jaw', f1(a.jawMm) + ' mm');
    }
    var r = out.terrain;
    if (r) {
      set('sn-r-ahead', (r.slope * DEG).toFixed(1) + '° / ' + (r.rough * 100).toFixed(1) + ' cm');
      set('sn-r-sink', f1(r.sinkCm) + ' cm / ' + f2(r.slip));
    }
    var al = els['sn-alerts'];
    if (al) al.textContent = out.alerts.join(' · ');
  }

  function update(c) {
    updateImu(c);
    updateStabiliser(c);
    updateWheels(c);
    updateThermal(c);
    updatePower(c);
    updateArm(c);
    updateTerrain(c);
    updateAlerts(c);
    lastDraw += c.dt;
    if (lastDraw > 0.16) { lastDraw = 0; draw(c); }
    return out;
  }

  global.NASA_Sensors = {
    update: update,
    readings: function () { return out; },
    vibrationRms: function () { return imu.vibRms; },
    snapshot: function () {
      return {
        accel: imu.acc.slice(), gyro: imu.gyro.slice(), gMoon: imu.gMoon, pitchEst: imu.pitchEst, rollEst: imu.rollEst,
        yawErr: imu.yawErr, vibRms: imu.vibRms, shock: imu.shock, mastGimbal: [gimbal.x, gimbal.z],
        wheels: out.wheels, thermal: out.thermal, power: out.power, arm: out.arm, alerts: out.alerts
      };
    }
  };
})(window);
