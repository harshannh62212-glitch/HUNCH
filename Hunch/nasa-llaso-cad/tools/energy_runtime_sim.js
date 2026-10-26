#!/usr/bin/env node
/* Rover energy / runtime / dock-charge study (headless).
 *   node tools/energy_runtime_sim.js            -> table on stdout
 *   node tools/energy_runtime_sim.js --md       -> markdown report
 * Uses js/rover_bom.js computePowerDraw() (the same model the simulator uses) and js/dock_station.js charge law.
 * Assumptions (change in A below):  5 Ah x 12.8 V LiFePO4 = 64 Wh nameplate, derated 20 % for ageing and cold;
 * 25 % SoC floor (reserve for retries); 80 % start; dock beside the habitat; charger 64 W CC (5 A) with taper above
 * 90 % SoC; 94 % charge efficiency; dock bus 266 W PV minus 5 W standby; swap takes 25 s; a 3 min dock cycle
 * (approach, door, latch, depart) is added to every sortie; terrain factor on drive power. */
'use strict';
var path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'js', 'rover_bom.js'));
var B = global.NASA_RoverBOM;
var Dock = require(path.join(__dirname, '..', 'js', 'dock_station.js'));
var Cd = Dock.C;

var A = {
  PACK_AH: 5, PACK_V: 12.8, FLOOR: 0.25, DERATE: 0.80, DOCK_CYCLE_S: 180, START_SOC: 0.80, RESUME_SOC: 0.80,
  CHG_W: Cd.CHARGE_W_CC, CHG_EFF: 0.94, TAPER_FROM: 0.90,
  PV_W: Cd.PV_BUS_W, STANDBY_W: Cd.STANDBY_W, DOCK_LEG_M: 20, PICK_S: 45, PLACE_S: 45, SWAP_S: 25,
  PAYLOAD_MASS_RATIO: 1.25, TERRAIN: 1.15, SWAP_MIN_DELTA: 0.15
};
A.CAP = A.PACK_AH * A.PACK_V * A.DERATE;              // 51.2 Wh usable

function profile(modeId) {
  B.setPowerMode(modeId);
  var m = B.getPowerMode(), v = m.transitSpeedCap;
  var P = function (o) { return B.computePowerDraw(o).totalW; };
  return {
    id: modeId, v: v,
    empty: P({ throttle: 0.55, vel: v, massRatio: 1, logisticsTransit: true, navActive: true }) * A.TERRAIN,
    loaded: P({ throttle: 0.6, vel: v, massRatio: A.PAYLOAD_MASS_RATIO, logisticsTransit: true, navActive: true }) * A.TERRAIN,
    arm: P({ throttle: 0, vel: 0, massRatio: A.PAYLOAD_MASS_RATIO, armMoving: true, visionActive: true, navActive: true }),
    idle: P({ throttle: 0, vel: 0, massRatio: 1, navActive: false })
  };
}

/* charge power into a pack at state of charge soc (0..1), from the dock charger */
function chgW(soc) { var t = 1 - Math.max(0, Math.min(1, (soc - A.TAPER_FROM) / (1 - A.TAPER_FROM))) * 0.88; return A.CHG_W * t; }
function chargeTime(s0, s1) {                          // seconds to go s0 -> s1 at the pack (efficiency applied)
  var soc = s0, t = 0, dt = 1;
  while (soc < s1 && t < 1e6) { soc += chgW(soc) * A.CHG_EFF * dt / 3600 / A.CAP; t += dt; }
  return t;
}

/* Energy + time of one segment */
function seg(p, kind, metres) { var t = metres / p.v; return { t: t, wh: p[kind] * t / 3600 }; }

/* One sortie from the dock: dock -> lander -> [pick, carry, place, (return empty)] x n -> dock.  Returns costs. */
function sortieCost(p, L, n) {
  var wh = 0, t = 0, add = function (s) { wh += s.wh; t += s.t; };
  add(seg(p, 'empty', L + A.DOCK_LEG_M));               // dock -> lander (dock sits beside the habitat)
  for (var i = 0; i < n; i++) {
    t += A.PICK_S; wh += p.arm * A.PICK_S / 3600;
    add(seg(p, 'loaded', L));
    t += A.PLACE_S; wh += p.arm * A.PLACE_S / 3600;
    if (i < n - 1) add(seg(p, 'empty', L));             // back to the lander for the next pod
  }
  add(seg(p, 'empty', A.DOCK_LEG_M));                   // habitat -> dock
  t += A.DOCK_CYCLE_S; wh += p.idle * A.DOCK_CYCLE_S / 3600;   // dock approach, door, latch, depart
  return { wh: wh, t: t };
}

function maxRuns(p, L, startSoc) {
  var usable = (startSoc - A.FLOOR) * A.CAP, n = 0;
  while (sortieCost(p, L, n + 1).wh <= usable && n < 500) n++;
  return n;
}

/* sustained operation over `hours` of daylight, 1 s steps */
function sustained(p, L, hours, twoPacks) {
  var dt = 1, T = hours * 3600, t = 0, done = 0, sorties = 0;
  var rover = A.START_SOC * A.CAP, spare = twoPacks ? A.CAP : 0;
  var log = { chargeWait: 0, swaps: 0 }, pvEnergy = 0;
  while (t < T) {
    var n = maxRuns(p, L, rover / A.CAP);
    if (n < 1) {                                        // need a swap / charge
      if (twoPacks && spare / A.CAP >= A.RESUME_SOC) {
        var tmp = rover; rover = spare; spare = tmp; log.swaps++;
        var s = A.SWAP_S; for (var k = 0; k < s; k++) { spare = Math.min(A.CAP, spare + chgW(spare / A.CAP) * A.CHG_EFF / 3600); } t += s; continue;
      }
    }
    if (n >= 1 && rover / A.CAP >= A.RESUME_SOC - 1e-9) {          // depart: run the whole sortie (charging the spare meanwhile)
      var c = sortieCost(p, L, n);
      var steps = Math.ceil(c.t);
      for (var j = 0; j < steps && twoPacks; j++) spare = Math.min(A.CAP, spare + chgW(spare / A.CAP) * A.CHG_EFF * 1 / 3600);
      rover -= c.wh; t += c.t; done += n; sorties++;
      continue;
    }
    // in dock: charge the rover pack in place; the spare tops up from whatever budget is left
    var roverW = chgW(rover / A.CAP);
    var avail = Math.max(0, A.PV_W - A.STANDBY_W - roverW / A.CHG_EFF);
    rover = Math.min(A.CAP, rover + roverW * A.CHG_EFF * dt / 3600);
    if (twoPacks) { var sw = Math.min(chgW(spare / A.CAP), avail); spare = Math.min(A.CAP, spare + sw * A.CHG_EFF * dt / 3600); }
    log.chargeWait += dt; t += dt;
  }
  return { delivered: done, sorties: sorties, perHour: done / (Math.min(t, T) / 3600), swaps: log.swaps, waitH: log.chargeWait / 3600 };
}

function run() {
  var out = { assumptions: A, modes: [], charge: {}, sustained: [] };
  out.charge = {
    rover_18_to_80_min: chargeTime(A.FLOOR, 0.80) / 60,
    rover_18_to_100_min: chargeTime(A.FLOOR, 1.0) / 60,
    pack_0_to_100_min: chargeTime(0.0, 1.0) / 60,
    pack_0_to_80_min: chargeTime(0.0, 0.8) / 60,
    cc_phase_w_at_pack: A.CHG_W * A.CHG_EFF,
    spare_full_from_floor_with_pv_limit_min: chargeTime(A.FLOOR, 1.0) / 60
  };
  [135, 2000].forEach(function (L) {
    ['range', 'eco', 'balance', 'boost'].forEach(function (id) {
      var p = profile(id), n80 = maxRuns(p, L, 0.80), n100 = maxRuns(p, L, 1.0);
      var one = sortieCost(p, L, 1);
      var row = { L: L, mode: id, v: p.v, cruiseEmptyW: p.empty, cruiseLoadedW: p.loaded, whPerDelivery: sortieCost(p, L, 3).wh - sortieCost(p, L, 2).wh,
        oneDeliverySortieWh: one.wh, oneDeliveryMin: one.t / 60, runsAt80: n80, runsAt100: n100,
        sortieMinAt80: n80 ? sortieCost(p, L, n80).t / 60 : null, sortieWhAt80: n80 ? sortieCost(p, L, n80).wh : null,
        oneWayLoadedWh: seg(p, 'loaded', L).wh };
      out.modes.push(row);
    });
  });
  var p = profile('eco');
  [8].forEach(function (h) {
    out.sustained.push({ hours: h, L: 135, mode: 'eco', single: sustained(p, 135, h, false), dual: sustained(p, 135, h, true) });
    out.sustained.push({ hours: h, L: 135, mode: 'boost', single: sustained(profile('boost'), 135, h, false), dual: sustained(profile('boost'), 135, h, true) });
  });
  return out;
}

function fmt(x, d) { return (x == null) ? '—' : x.toFixed(d == null ? 1 : d); }
function print(r, md) {
  var L = [];
  var c = r.charge;
  L.push('Assumptions: ' + A.PACK_AH + ' Ah x ' + A.PACK_V + ' V = ' + fmt(A.CAP, 0) + ' Wh pack, floor ' + A.FLOOR * 100 + ' % (' + fmt(A.CAP * A.FLOOR, 1) + ' Wh), start ' + A.START_SOC * 100 + ' %, charger ' + A.CHG_W + ' W CC (' + fmt(c.cc_phase_w_at_pack, 1) + ' W into pack), PV bus ' + A.PV_W + ' W.');
  L.push('');
  L.push('CHARGE TIMES (in dock, daylight)');
  L.push('  rover or spare pack  ' + Math.round(A.FLOOR*100) + '% -> 80% : ' + fmt(c.rover_18_to_80_min, 0) + ' min');
  L.push('  rover or spare pack  ' + Math.round(A.FLOOR*100) + '% -> 100%: ' + fmt(c.rover_18_to_100_min, 0) + ' min');
  L.push('  empty 0% -> 80% / 100%          : ' + fmt(c.pack_0_to_80_min, 0) + ' / ' + fmt(c.pack_0_to_100_min, 0) + ' min');
  L.push('');
  L.push('CARGO RUNS PER CHARGE (one run = pick up, carry, place; dock beside habitat)');
  L.push(['route', 'mode', 'v m/s', 'W empty', 'W loaded', 'Wh/delivery', 'runs@80%', 'runs@100%', 'sortie min@80%', 'one-way loaded Wh'].join(' | '));
  r.modes.forEach(function (m) {
    L.push([m.L + ' m', m.mode, fmt(m.v, 2), fmt(m.cruiseEmptyW, 1), fmt(m.cruiseLoadedW, 1), fmt(m.whPerDelivery, 2), m.runsAt80, m.runsAt100, fmt(m.sortieMinAt80, 0), fmt(m.oneWayLoadedWh, 1)].join(' | '));
  });
  L.push('');
  L.push('SUSTAINED 8 h OF DAYLIGHT (135 m route)');
  r.sustained.forEach(function (s) {
    L.push('  ' + s.mode + ': single pack ' + s.single.delivered + ' deliveries (' + fmt(s.single.perHour, 1) + '/h, waits ' + fmt(s.single.waitH, 1) + ' h);  with swap pack ' + s.dual.delivered + ' (' + fmt(s.dual.perHour, 1) + '/h, ' + s.dual.swaps + ' swaps, waits ' + fmt(s.dual.waitH, 1) + ' h)');
  });
  console.log(L.join('\n'));
}

if (require.main === module) { var r = run(); if (process.argv.indexOf('--json') >= 0) console.log(JSON.stringify(r, null, 1)); else print(r); }
module.exports = { run: run, A: A, chargeTime: chargeTime, maxRuns: maxRuns, profile: profile, sortieCost: sortieCost, sustained: sustained };
