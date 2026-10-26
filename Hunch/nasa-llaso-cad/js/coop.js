/**
 * Browser side of Mission 9: spawns the second rover (AEGIS-2), runs the status bus, applies
 * collision avoidance to both robots and runs the "clear the route" task when a boulder blocks AEGIS-1.
 * AEGIS-2 uses a simple kinematic driver, not the full terrain dynamics AEGIS-1 has.
 */
(function () {
  var C = window.NASA_CoopCore;
  if (!C) return;
  var PARK = { x: 8, z: 9 };
  var bus = C.createBus();
  var r2 = null, pose = null, task = null, simT = 0, pubT = 0, r1Scale = { scale: 1, reason: 'clear' }, r2Scale = { scale: 1, reason: 'clear' };
  var yOff = 0, panel = null, body = null, open = false, spawnedAt = 0, lastEvent = '';

  function say(h) { if (typeof llog === 'function') llog(h); }

  var NEXT1 = { idle: 'Wait for a request', transit_lander: 'Drive to the pickup rack', align_pick: 'Line up at the rack', arm_pick: 'Pick up the pod', transit_base: 'Carry to the habitat', align_drop: 'Line up at the airlock', arm_place: 'Place the cargo', crane_wait: 'Wait for the crane', rth: 'Return to the dock', m1_checkout: 'Run the first-drive checkout', transit_stage: 'Drive to staging' };

  function spawn() {
    if (r2) return;
    // Object3D.clone copies userData through JSON, and the rover's userData holds circular references,
    // so set it aside while cloning.
    var saved = [];
    roverGroup.traverse(function (o) { saved.push([o, o.userData]); o.userData = {}; });
    try { r2 = roverGroup.clone(true); } finally { saved.forEach(function (p) { p[0].userData = p[1]; }); }
    var kill = [];
    r2.traverse(function (o) { if (o.isLight || o.isCamera) kill.push(o); });
    kill.forEach(function (o) { if (o.parent) o.parent.remove(o); });
    yOff = roverGroup.position.y - getH(roverGroup.position.x, roverGroup.position.z);
    pose = { x: PARK.x, z: PARK.z, yaw: Math.PI / 2 };
    r2.position.set(pose.x, getH(pose.x, pose.z) + yOff, pose.z);
    r2.rotation.set(0, pose.yaw, 0);
    r2.scale.copy(roverGroup.scale);
    scene.add(r2);
    say('<span class="text-teal-300 font-bold">[TEAM] AEGIS-2 online at the park spot. Both robots now report to the shared status bus.</span>');
  }

  function cargoCond() {
    var kg = window.NASA_Logistics ? NASA_Logistics.payloadKg() : 0;
    if (!(kg > 0.2)) return 'EMPTY';
    var st = NASA_Logistics.stability && NASA_Logistics.stability();
    var penalty = window.NASA_Faults ? NASA_Faults.tipPenalty() : 0;
    return (penalty > 0 || (st && st.lockLost)) ? 'CHECK (shifted)' : 'SECURE ' + kg.toFixed(1) + ' kg';
  }

  function publish() {
    var yaw1 = (typeof roverYaw === 'number') ? roverYaw : 0;
    var ph = window.NASA_Logistics ? NASA_Logistics.phase() : 'idle';
    bus.publish('AEGIS-1', { x: roverGroup.position.x, z: roverGroup.position.z, yaw: yaw1, task: ph, cargo: cargoCond(), next: NEXT1[ph] || ph, priority: 2 }, simT);
    if (r2) {
      var s = task ? task.state() : 'DONE';
      bus.publish('AEGIS-2', { x: pose.x, z: pose.z, yaw: pose.yaw, task: task ? s : 'STANDBY', cargo: 'EMPTY', next: task ? C.NEXT[s] : 'Standing by', priority: 1 }, simT);
    }
  }

  function startClear() {
    var rock = window.NASA_FaultsUI && NASA_FaultsUI.blockingRock();
    if (!rock) return false;
    // The corridor runs along AEGIS-1's heading at the moment the boulder blocked it.
    var yaw = (typeof roverYaw === 'number') ? roverYaw : 0;
    var corridor = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    task = C.createClearTask(rock, corridor, PARK, { pushM: 6, pushS: 6 });
    task.rockIndex = rock.i;
    say('<span class="text-teal-300 font-bold">[TEAM] AEGIS-1 → AEGIS-2: route blocked by a boulder at (' + rock.x.toFixed(0) + ', ' + rock.z.toFixed(0) + '). AEGIS-2 is going to clear it.</span>');
    return true;
  }

  var api = window.NASA_Coop = {
    spawn: spawn,
    spawned: function () { return !!r2; },
    onRoadBlocked: function () { if (r2 && !task) startClear(); },
    demo: function () {
      spawn();
      if (window.NASA_Faults && !NASA_Faults.isActive('road')) NASA_Faults.inject('road');
      else if (!task) startClear();
      return true;
    },
    speedScale: function () { return r1Scale.scale; },
    status: function () { return bus.all(simT); },
    busLog: function () { return bus.log(); },
    task: function () { return task ? task.state() : null; },
    tick: function (dt) {
      simT += dt;
      if (!r2) return;
      // Collision avoidance in both directions (AEGIS-1 has the higher priority).
      var me1 = { x: roverGroup.position.x, z: roverGroup.position.z, yaw: (typeof roverYaw === 'number') ? roverYaw : 0, priority: 2, id: 'AEGIS-1' };
      var me2 = { x: pose.x, z: pose.z, yaw: pose.yaw, priority: 1, id: 'AEGIS-2' };
      r1Scale = C.safeSpeedScale(me1, me2);
      r2Scale = C.safeSpeedScale(me2, me1);
      if (task) {
        var o = task.step(pose, dt);
        if (o.rockPos && window.NASA_FaultsUI) NASA_FaultsUI.moveRock(task.rockIndex, o.rockPos.x, o.rockPos.z);
        if (o.event === 'route-clear') {
          NASA_FaultsUI.markAside(task.rockIndex);
          if (window.NASA_Faults) NASA_Faults.clear('road');
          say('<span class="text-teal-300 font-bold">[TEAM] AEGIS-2 → AEGIS-1: route clear. AEGIS-1 is replanning through the corridor.</span>');
        } else if (o.event === 'parked') {
          say('<span class="text-teal-300">[TEAM] AEGIS-2 parked and standing by.</span>');
          task = null;
        }
        if (o.target) pose = C.stepKin(pose, o.target.x, o.target.z, dt, { scale: o.state === 'PUSH' ? o.scale * r2Scale.scale : r2Scale.scale });
      }
      r2.position.set(pose.x, getH(pose.x, pose.z) + yOff, pose.z);
      r2.rotation.set(0, pose.yaw, 0);
      pubT += dt;
      if (pubT >= 0.5) { pubT = 0; publish(); }
    }
  };

  function btn(label, fn, color) {
    var b = document.createElement('button');
    b.textContent = label; b.type = 'button';
    b.style.cssText = 'padding:3px 6px;margin:2px;border:1px solid ' + (color || '#475569') + ';background:#0f172a;color:#e2e8f0;border-radius:4px;font:10px ui-monospace,monospace;cursor:pointer';
    b.onclick = fn;
    return b;
  }
  function render() {
    if (!body) return;
    var rows = api.status();
    if (!rows.length) { body.innerHTML = '<div style="font:10px ui-monospace,monospace;color:#94a3b8">AEGIS-2 not deployed. Press Deploy + clear route.</div>'; return; }
    body.innerHTML = rows.map(function (r) {
      return '<div style="font:10px ui-monospace,monospace;color:#e2e8f0;margin:3px 0;padding:3px;border-left:3px solid ' + (r.stale ? '#f43f5e' : '#22c55e') + '"><b>' + r.id + '</b> (' + r.x.toFixed(0) + ', ' + r.z.toFixed(0) + ')' + (r.stale ? ' <span style="color:#fda4af">NO SIGNAL</span>' : '') +
        '<br>task: ' + r.task + ' · cargo: ' + r.cargo + '<br>next: ' + r.next + '</div>';
    }).join('') + '<div style="font:9px ui-monospace,monospace;color:#94a3b8">AEGIS-1: ' + r1Scale.reason + ' · AEGIS-2: ' + r2Scale.reason + '</div>';
  }
  function build() {
    var wrap = document.createElement('div');
    wrap.id = 'coop-ui';
    wrap.style.cssText = 'position:fixed;left:calc(50% + 150px);bottom:8px;z-index:40;width:80px';
    var toggle = btn('ROVERS ▸', function () { open = !open; panel.style.display = open ? 'block' : 'none'; toggle.textContent = open ? 'ROVERS ▾' : 'ROVERS ▸'; render(); }, '#2dd4bf');
    wrap.appendChild(toggle);
    panel = document.createElement('div');
    panel.style.cssText = 'display:none;position:absolute;bottom:28px;right:0;width:300px;padding:6px;background:rgba(2,6,23,.94);border:1px solid #334155;border-radius:6px';
    panel.appendChild(btn('Deploy + clear route', function () { api.demo(); }, '#22c55e'));
    body = document.createElement('div'); panel.appendChild(body);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    setInterval(render, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
