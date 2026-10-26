// Run: node tools/supply_route_test.js
const R = require('../js/supply_route.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

ok(R.inside(45, -40, R.ZONES).id === 'plume', 'pad centre is inside the plume zone');
ok(R.inside(R.START.x, R.START.z, R.ZONES) === null, 'start is outside every zone');
ok(R.clearance(R.START.x, R.START.z, R.ZONES) > 5, 'start has clearance to the plume zone: ' + R.clearance(R.START.x, R.START.z, R.ZONES).toFixed(1) + ' m');
ok(Math.abs(R.slopeDeg(0, 1, 1) - 45) < 1e-9, 'slope maths');

// A clean 82 m run on flat ground around the zones.
const run = R.createRun(R.ZONES);
const wp = [[62, -48], [62, -20], [30, -12], [0, -14], [-18, -22]];
let len = 0;
for (let k = 0; k < wp.length - 1; k++) {
  const [a, b] = [wp[k], wp[k + 1]], n = 200;
  for (let i = 0; i <= n; i++) run.sample(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, 0);
}
let r = run.result();
ok(r.pass && r.zoneViolations.length === 0, 'path around the zones passes: ' + r.pathM + ' m = ' + r.scaledKm + ' km');
ok(r.longEnough && r.scaledKm >= 1.9, 'long enough to count as the 2 km course');

// Driving straight through the plume zone is a violation.
const bad = R.createRun(R.ZONES);
for (let i = 0; i <= 400; i++) bad.sample(62 - 80 * i / 400, -48 + 26 * i / 400, 0);
r = bad.result();
ok(!r.pass && r.zoneViolations.includes('plume'), 'straight line crosses the plume zone: ' + r.zoneViolations.join(','));

// A steep step is flagged.
const steep = R.createRun([]);
steep.sample(0, 0, 0); steep.sample(1, 0, 0.5);
ok(steep.result().steepSamples === 1 && steep.result().maxSlopeDeg > 20, 'steep ground flagged');

// Too short a run is reported honestly.
const short = R.createRun(R.ZONES);
for (let i = 0; i <= 50; i++) short.sample(62 - i * 0.5, -48, 0);
ok(!short.result().longEnough && !short.result().pass, 'a 25 m run is not the 2 km course');
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
