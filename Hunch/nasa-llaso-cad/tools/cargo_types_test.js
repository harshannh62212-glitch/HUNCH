// Run: node tools/cargo_types_test.js
const C = require('../js/cargo_types.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

ok(C.ids().length === 3, 'three cargo types');
ids = C.ids();
ids.forEach(i => ok(C.fits(i).fits, i + ' fits the bay'));
ok(Math.abs(C.get('pod').lengthM - 0.26) < 1e-9 && Math.abs(C.get('pod').heightM - 0.15) < 1e-9, 'pod is the 1:4 canister (0.26 m long, 0.15 m dia)');
ok(C.cradleFor('pod').saddle === 'vee', 'round canister rides a vee saddle');
ok(C.get('pod').massKg === 5 * 0.45359237, 'pod keeps its 5 lb mass');
ok(C.cradleFor('cylinder').saddle === 'vee' && C.cradleFor('container').saddle === 'flat', 'cylinder gets a vee saddle, container a flat one');
ok(ids.every(i => C.cradleFor(i).clampSpanM > C.get(i).widthM), 'clamp span clears each width');
ok(ids.every(i => C.get(i).bail.spanM === C.BAIL.spanM), 'every type shares the same grapple bail');
// A type too big for the bay is rejected with reasons.
C.TYPES.huge = { id: 'huge', label: 'Huge', shape: 'box', fullM: [6, 2.4, 2.6], scale: 4, massKg: 9, note: '' };
const f = C.fits('huge');
ok(!f.fits && f.reasons.length >= 3, 'oversize cargo rejected: ' + f.reasons.join(', '));
delete C.TYPES.huge;
const rover = { massKg: 6.8, comHeightM: 0.15, deckHeightM: 0.2, halfTrackM: 0.3 };
ok(C.tipMargin('container', rover) > 0.5, 'tallest cargo still above the 0.5 m/s2 tip limit: ' + C.tipMargin('container', rover).toFixed(2));
ok(C.pick('pod', 5) === 'pod' && C.pick('mixed', 0) === 'pod' && C.pick('mixed', 1) === 'cylinder' && C.pick('mixed', 2) === 'container' && C.pick('bogus', 0) === 'pod', 'pick modes');
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
