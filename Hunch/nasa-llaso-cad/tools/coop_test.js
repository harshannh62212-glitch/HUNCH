// Run: node tools/coop_test.js
const C = require('../js/coop_core.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

// Bus
const bus = C.createBus();
bus.publish('AEGIS-1', { x: 0, z: 0, yaw: 0, task: 'hauling', cargo: 'SECURE', next: 'Deliver at airlock', priority: 2 }, 0);
bus.publish('AEGIS-2', { x: 10, z: 0, yaw: Math.PI, task: 'GO', cargo: 'EMPTY', next: 'Drive to the boulder', priority: 1 }, 0);
ok(bus.all(1).length === 2 && bus.all(1).every(r => !r.stale), 'both robots visible on the bus');
ok(bus.all(5).every(r => r.stale), 'silent robots go stale after 2 s');
bus.publish('AEGIS-2', { x: 10, z: 0, yaw: Math.PI, task: 'PUSH', cargo: 'EMPTY', next: 'Push', priority: 1 }, 6);
ok(bus.log().length === 3, 'bus log records task changes only');

// Collision avoidance
const a = { id: 'A', x: 0, z: 0, yaw: 0, priority: 2 };
const bAhead = { id: 'B', x: 8, z: 0, yaw: Math.PI, priority: 1 };
ok(C.safeSpeedScale(a, bAhead).scale === 1, 'far robot ahead: full speed');
ok(C.safeSpeedScale(a, { ...bAhead, x: 4 }).scale > 0 && C.safeSpeedScale(a, { ...bAhead, x: 4 }).scale < 1, 'inside the slow band: slowing');
ok(C.safeSpeedScale(a, { ...bAhead, x: 2 }).scale === 0, 'inside the stop band: holding');
ok(C.safeSpeedScale(a, { x: -3, z: 0, id: 'B', yaw: 0, priority: 1 }).scale === 1, 'robot behind does not block');
const low = { id: 'L', x: 0, z: 0, yaw: 0, priority: 1 }, high = { id: 'H', x: 0, z: 0, yaw: Math.PI, priority: 2 };
const lowView = C.safeSpeedScale({ ...low }, { ...high, x: 3.6 }), highView = C.safeSpeedScale({ ...high, x: 3.6, yaw: Math.PI }, { ...low, x: 0 });
ok(lowView.scale < 1, 'low priority robot yields at 3.6 m: ' + lowView.scale.toFixed(2));
ok(highView.scale === 1 || highView.scale > lowView.scale, 'high priority robot keeps more speed: ' + highView.scale.toFixed(2));
ok(C.safeSpeedScale(a, { ...bAhead, x: 1.0 }).scale === 0, 'nearly touching always stops');

// Kinematic driver reaches a target and does not overshoot wildly.
let pose = { x: 0, z: 0, yaw: 0 };
for (let i = 0; i < 4000; i++) { const s = C.stepKin(pose, 20, -10, 0.05, {}); pose = s; if (s.dist < 0.3) break; }
ok(Math.hypot(pose.x - 20, pose.z + 10) < 0.5, 'driver reaches the target: (' + pose.x.toFixed(1) + ', ' + pose.z.toFixed(1) + ')');
ok(C.stepKin({ x: 0, z: 0, yaw: 0 }, 5, 0, 0.1, { scale: 0 }).speed === 0, 'scale 0 means no motion');

// Clear task: go, push, report, return, done.
const task = C.createClearTask({ x: 10, z: 5 }, { x: 1, z: 0 }, { x: 0, z: 0 }, { pushM: 6, pushS: 6 });
pose = { x: 0, z: 10, yaw: 0 };
const events = []; let rock = { x: 10, z: 5 }, ticks = 0;
while (task.state() !== 'DONE' && ticks < 20000) {
  const o = task.step(pose, 0.05); ticks++;
  if (o.event) events.push(o.event);
  if (o.rockPos) rock = o.rockPos;
  if (o.target) pose = C.stepKin(pose, o.target.x, o.target.z, 0.05, { scale: o.scale });
}
ok(task.state() === 'DONE', 'clear task finishes after ' + (ticks * 0.05).toFixed(0) + ' s');
ok(events.join(',') === 'at-rock,route-clear,parked', 'events in order: ' + events.join(','));
ok(Math.abs(rock.z - 11) < 0.01 && Math.abs(rock.x - 10) < 0.01, 'boulder pushed 6 m sideways out of the corridor: (' + rock.x.toFixed(1) + ', ' + rock.z.toFixed(1) + ')');
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
