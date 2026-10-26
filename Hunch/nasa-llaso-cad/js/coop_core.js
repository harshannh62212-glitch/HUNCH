/**
 * Mission 9: two robots cooperating without humans.
 * Pure logic (no THREE, no DOM) so tools/coop_test.js can run it in Node:
 *   - a status bus: each robot publishes position, task, cargo condition and next action
 *   - collision avoidance by separation: the lower-priority robot yields
 *   - a simple kinematic driver for the second robot
 *   - the "clear the route" task: go to the boulder, push it out of the corridor, report, park
 */
(function (root) {
  var STALE_S = 2.0;
  var SEP = { stop: 2.2, slow: 5.0 };

  function createBus() {
    var latest = {}, log = [];
    return {
      publish: function (id, msg, nowS) {
        var m = {}; for (var k in msg) m[k] = msg[k];
        m.id = id; m.t = nowS;
        var prev = latest[id];
        latest[id] = m;
        if (!prev || prev.task !== m.task || prev.next !== m.next) log.push({ t: +nowS.toFixed(1), id: id, task: m.task, next: m.next });
      },
      get: function (id) { return latest[id] || null; },
      all: function (nowS) {
        return Object.keys(latest).map(function (id) {
          var m = latest[id];
          return { id: id, x: m.x, z: m.z, yaw: m.yaw, task: m.task, cargo: m.cargo, next: m.next, priority: m.priority, stale: nowS - m.t > STALE_S };
        });
      },
      log: function () { return log.slice(); }
    };
  }

  /**
   * Speed multiplier (0..1) for robot `me` given another robot `other` (both have x, z, yaw, priority).
   * Only robots ahead of me matter. The lower-priority robot gets the wider berth and yields first.
   */
  function safeSpeedScale(me, other) {
    if (!other) return { scale: 1, reason: 'clear' };
    var dx = other.x - me.x, dz = other.z - me.z, d = Math.hypot(dx, dz);
    var hx = Math.cos(me.yaw), hz = -Math.sin(me.yaw);
    var ahead = (dx * hx + dz * hz) / (d || 1);
    var margin = (me.priority < other.priority) ? 1.5 : 1.0;   // yield more readily
    var stop = SEP.stop * margin, slow = SEP.slow * margin;
    if (d < stop * 0.6) return { scale: 0, reason: 'too close (' + d.toFixed(1) + ' m)' };     // always stop when nearly touching
    if (ahead < 0.2) return { scale: 1, reason: 'other robot is not ahead' };
    if (d <= stop) return { scale: 0, reason: 'holding for ' + other.id + ' (' + d.toFixed(1) + ' m)' };
    if (d < slow) return { scale: (d - stop) / (slow - stop), reason: 'slowing for ' + other.id };
    return { scale: 1, reason: 'clear' };
  }

  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  /** Unicycle step toward (tx, tz). pose: {x,z,yaw}. Returns the new pose and distance left. */
  function stepKin(pose, tx, tz, dt, p) {
    p = p || {};
    var vMax = p.vMax || 0.8, wMax = p.wMax || 1.6, scale = p.scale == null ? 1 : p.scale;
    var dx = tx - pose.x, dz = tz - pose.z, dist = Math.hypot(dx, dz);
    var want = Math.atan2(-dz, dx);
    var err = wrap(want - pose.yaw);
    var w = Math.max(-wMax, Math.min(wMax, err * 2.5));
    var v = Math.abs(err) > 0.6 ? 0 : Math.min(vMax, dist * 1.2) * scale;
    var yaw = pose.yaw + w * dt;
    return { x: pose.x + Math.cos(yaw) * v * dt, z: pose.z - Math.sin(yaw) * v * dt, yaw: yaw, dist: dist, speed: v };
  }

  /**
   * Clear-the-route task. rock: {x,z}. corridor: unit vector (cx, cz) pointing along the blocked route.
   * The robot approaches from its current position, pushes the rock sideways (perpendicular to the corridor)
   * by `pushM`, then reports and parks. step() returns { target:{x,z}|null, scale, event, rockPos|null, state }.
   */
  function createClearTask(rock, corridor, park, opts) {
    opts = opts || {};
    var pushM = opts.pushM || 6, pushS = opts.pushS || 6;
    var px = -corridor.z, pz = corridor.x;      // perpendicular
    var st = { state: 'GO', t: 0, rock: { x: rock.x, z: rock.z }, from: { x: rock.x, z: rock.z } };
    var stand = { x: rock.x - px * 2.4, z: rock.z - pz * 2.4 };   // behind the rock, on the side opposite the push
    return {
      state: function () { return st.state; },
      standoff: function () { return stand; },
      step: function (pose, dt) {
        var out = { target: null, scale: 1, event: null, rockPos: null, state: st.state };
        if (st.state === 'GO') {
          out.target = stand;
          if (Math.hypot(pose.x - stand.x, pose.z - stand.z) < 0.35) { st.state = 'PUSH'; st.t = 0; out.event = 'at-rock'; }
        } else if (st.state === 'PUSH') {
          st.t += dt;
          var u = Math.min(1, st.t / pushS);
          st.rock = { x: st.from.x + px * pushM * u, z: st.from.z + pz * pushM * u };
          out.rockPos = st.rock;
          out.target = { x: stand.x + px * pushM * u, z: stand.z + pz * pushM * u };   // follow the rock
          out.scale = 0.5;
          if (u >= 1) { st.state = 'REPORT'; out.event = 'route-clear'; }
        } else if (st.state === 'REPORT') {
          st.state = 'RETURN';
          out.target = park;
        } else if (st.state === 'RETURN') {
          out.target = park;
          if (Math.hypot(pose.x - park.x, pose.z - park.z) < 0.5) { st.state = 'DONE'; out.event = 'parked'; }
        }
        out.state = st.state;
        return out;
      }
    };
  }

  var NEXT = {
    GO: 'Drive to the boulder', PUSH: 'Push the boulder out of the corridor', REPORT: 'Tell AEGIS-1 the route is clear', RETURN: 'Return to park', DONE: 'Standing by'
  };

  root.NASA_CoopCore = { SEP: SEP, createBus: createBus, safeSpeedScale: safeSpeedScale, stepKin: stepKin, createClearTask: createClearTask, NEXT: NEXT, wrap: wrap };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NASA_CoopCore;
})(typeof window !== 'undefined' ? window : globalThis);
