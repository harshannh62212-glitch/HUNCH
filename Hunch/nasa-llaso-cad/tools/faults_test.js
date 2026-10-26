// Run: node tools/faults_test.js
const F = require('../js/faults.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const log = [], calls = [];
F.hooks({ log: e => log.push(e), onInject: id => calls.push('inj:' + id), onClear: id => calls.push('clr:' + id), onDetect: id => calls.push('det:' + id), onDecide: (id, c) => calls.push('dec:' + id + ':' + c), context: id => id === 'battery' ? { soc: 17 } : null });

ok(F.find('lidar') === 'sensor' && F.find('soc') === 'battery' && F.find('nonsense') === null, 'fault names resolve');
F.inject('wheel');
ok(F.speedScale() === 1, 'no speed effect before detection');
F.step(0.5); ok(F.active()[0].state === 'DETECTING', 'still detecting at 0.5 s');
F.step(0.6);
ok(F.active()[0].state === 'AUTO RESPONSE' && F.speedScale() === 0.55, 'wheel fault detected, limp mode 55 %');
ok(log.length === 1 && log[0].action.length > 0, 'diagnostic carries a response');
F.inject('sensor'); F.step(1.1);
ok(F.speedScale() === 0.4, 'worst fault sets the speed');
F.clearAll(); ok(F.speedScale() === 1 && F.active().length === 0, 'clear restores speed');

F.reset(); log.length = 0;
F.inject('battery'); F.step(1.1);
ok(log[0].soc === 17 && calls.includes('det:battery'), 'battery diagnostic includes SoC and triggers the charge response');

F.reset();
F.inject('cargo'); F.step(1.1);
ok(F.tipPenalty() === 0.8 && F.speedScale() === 0.6, 'shifted cargo cuts tip margin and speed');
F.clearAll();

F.reset(); calls.length = 0;
F.inject('comms'); F.step(1.1);
ok(!F.commsUp(), 'comms down blocks commands');
F.step(19); ok(F.commsUp() && F.history().some(h => h.state === 'LINK RESTORED'), 'link restored after 20 s with a report');

F.reset(); calls.length = 0;
F.inject('receiving');
ok(F.receivingBlocked() && !F.decide('receiving', 'retry'), 'no decision accepted before detection');
F.step(1.1);
ok(F.needsOperator().includes('receiving'), 'receiving fault waits for the operator');
ok(F.decide('receiving', 'return') && calls.includes('dec:receiving:return') && !F.receivingBlocked(), 'operator decision clears it');
ok(!F.inject('nope'), 'unknown fault id rejected');
ok(F.inject('road') && !F.inject('road'), 'same fault cannot be injected twice');
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
