// Run: node tools/mission_scoring_test.js
const S = require('../js/mission_scoring.js');
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); }

ok(S.tipSpeedScale(3, 3, 0) === 1, 'wide margin: full speed');
ok(Math.abs(S.tipSpeedScale(0.5, 3, 0) - 0.3) < 1e-9, 'margin at stop limit: 30 % speed');
ok(S.tipSpeedScale(0.75, 3, 0) > 0.3 && S.tipSpeedScale(0.75, 3, 0) < 1, 'between warn and stop: scaled');
ok(S.tipSpeedScale(2, 2, 1.5) === 0.7, 'high lateral accel: capped at 70 %');
ok(S.tipLevel(0.4, 3) === 'stop' && S.tipLevel(0.8, 3) === 'warn' && S.tipLevel(2, 2) === 'ok', 'tip levels');

// Stability: carry a pod through start, turn, stop.
const st = S.createStability();
const drive = (speed, yawRate) => st.add({ carrying: true, lockHeld: true, speed, yawRate, marginRoll: 2, marginPitch: 2.5, tilt: 0.1 });
drive(0, 0); drive(0.3, 0); drive(0.3, 0.4); drive(0.3, 0); drive(0, 0);
let r = st.result();
ok(r.starts === 1 && r.stops === 1 && r.turns === 1, 'start/stop/turn counted');
ok(r.pass, 'stable carry passes');
st.reset(); st.add({ carrying: true, lockHeld: false, speed: 0.3, yawRate: 0, marginRoll: 2, marginPitch: 2, tilt: 0 });
ok(!st.result().pass && st.result().lockLost, 'lost lock fails');
st.reset(); drive(0.3, 0); drive(0, 0);
ok(!st.result().pass && !st.result().exercised, 'no turn: not exercised, no pass');
st.reset(); st.add({ carrying: true, lockHeld: true, speed: 0.5, yawRate: 1.5, marginRoll: 1, marginPitch: 1, tilt: 0 });
ok(!st.result().pass, 'lateral accel over limit fails');

// Seal: needs squareness, passes through EXTEND and COMPRESS.
let seal = S.createSeal();
seal.step(0.1, true, 0.2, true);
ok(seal.state === 'FAULT' && /NOT SQUARE/.test(seal.fault), 'skewed rover is refused');
seal.step(0.1, true, 0.01, true);
ok(seal.state === 'EXTEND', 'square rover starts extending');
seal.step(1.3, true, 0, true); ok(seal.state === 'COMPRESS', 'then compresses');
seal.step(1.0, true, 0, true); ok(seal.ready, 'then sealed');
seal.step(0.1, false, 0, false); ok(seal.ready, 'stays sealed while door still open');
seal.step(0.1, false, 0, true); ok(seal.state === 'RETRACTED', 'retracts once the door is shut');

ok(S.placementVerdict(0.05).pass && !S.placementVerdict(0.2).pass && !S.placementVerdict(null).pass, 'placement verdicts');
ok(S.alignVerdict(0.02).pass && !S.alignVerdict(0.15).pass, 'alignment verdicts');

const good = S.buildReport({ simTimeS: 120.04, distanceM: 150.2, whUsed: 8.1, delivered: 1, massKg: 2.27, placementErrM: 0.04, sealed: true, stability: { pass: true } });
ok(good.success && good.simTimeS === 120, 'report: success case');
ok(!S.buildReport({ simTimeS: 1, distanceM: 1, whUsed: 1, delivered: 1, massKg: 1, placementErrM: 0.5, sealed: true, stability: { pass: true } }).success, 'report: bad placement fails');
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
