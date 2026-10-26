// Run: node tools/dispatcher_test.js
const D = require('../js/dispatcher.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const one = [{ id: 'A1', socWh: 50, availableS: 0 }];

const reqs = D.demoRequests(0);
const p = D.plan(reqs, one, { nowS: 0 });
ok(p.order[0] === 'D5' && p.order[1] === 'D4', 'emergency repair first, then life support: ' + p.order.join(','));
ok(p.order.indexOf('D1') === p.order.length - 1, 'routine supplies go last');
ok(p.order.indexOf('D3') < p.order.indexOf('D2'), 'battery with a deadline beats unscheduled science');
ok(p.trips[0].route === 'direct-regolith' && p.trips.at(-1).route === 'haul-road', 'urgent trip goes direct, routine trip takes the haul road');
ok(p.trips.every(t => t.items.every(i => i.reason.length > 0)), 'every item carries a reason');
ok(p.trips.every((t, i) => i === 0 || t.startS >= p.trips[i - 1].etaS), 'one robot: trips never overlap');

// Deadline pressure can overtake a higher base category.
const dl = D.plan([
  { id: 'S', item: 'Science kit', category: 'science', massKg: 2, deadlineS: 100 },
  { id: 'B', item: 'Batteries', category: 'battery', massKg: 2 }
], one, { nowS: 0 });
ok(dl.order[0] === 'S', 'an overdue science request outranks plain batteries');

// Two robots finish sooner than one.
const two = [{ id: 'A1', socWh: 50 }, { id: 'A2', socWh: 50 }];
const p2 = D.plan(reqs, two, { nowS: 0 });
const end = pl => Math.max(...pl.trips.map(t => t.etaS));
ok(end(p2) < end(p), 'two robots finish earlier: ' + end(p2) + ' s vs ' + end(p) + ' s');
ok(new Set(p2.trips.map(t => t.robot)).size === 2, 'work is split across both robots');

// Blocked haul road forces the direct route for everything.
const blocked = D.plan(reqs, one, { nowS: 0, haulBlocked: true });
ok(blocked.trips.every(t => t.route === 'direct-regolith'), 'blocked road: every trip goes direct');

// Low battery inserts a charge window.
const low = D.plan(reqs, [{ id: 'A1', socWh: 9, availableS: 0 }], { nowS: 0 });
ok(low.trips[0].chargeFirst && low.trips[0].startS >= D.DEFAULTS.chargeS, 'low battery: charge first, then start');

// Tray batching keeps within the mass cap.
ok(p.trips.every(t => t.items.reduce((a, i) => a + i.massKg, 0) <= D.DEFAULTS.trayCapKg + 1e-9 && t.items.length <= D.DEFAULTS.trayMaxItems), 'trips respect tray mass and item limits');
ok(D.plan([], one, {}).trips.length === 0, 'empty request list');
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
