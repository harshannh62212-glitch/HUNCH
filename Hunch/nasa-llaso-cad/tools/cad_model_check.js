#!/usr/bin/env node
/* Headless checks for both CAD models (rover + dock station) — no browser or three.js needed.
 *   node tools/cad_model_check.js
 * Builds js/fusion_rover.js and js/dock_station.js on a tiny THREE stub (tools/three_shim.js), then checks:
 *   - the simulator contract of the rover (handles the sim / logistics code relies on)
 *   - rover envelope, charge-pad height, cargo slot vs. pod guides / charge bridge clearances
 *   - arm reach (same IK as js/lunar_logistics.js) to the cargo slot and to ground pick-ups
 *   - rover v4: 24 in cube (stowed and with all modules steered), module sweep clearances, canister volumes
 *   - docked fit: nose vs. hard-stop bumper, wheel modules vs. closed clamp jaws, coupler pogos vs. pad
 */
'use strict';
const path = require('path');
const S = require('./three_shim.js');
const J = (p) => path.join(__dirname, '..', p);
require(J('js/rover_bom.js')); require(J('js/fusion_rover.js'));
const D = require(J('js/dock_station.js'));
let fails = 0, passes = 0;
function check(name, ok, info) { (ok ? passes++ : fails++); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  — ' + info : '')); }

function worldTris(root) { const out = []; S.walk(root, S.mat4(), out); return out; }
function bbox(tris, pred) {
  const b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
  tris.forEach(t => { if (pred && !pred(t)) return; t.v.forEach(v => { b.x0 = Math.min(b.x0, v[0]); b.x1 = Math.max(b.x1, v[0]); b.y0 = Math.min(b.y0, v[1]); b.y1 = Math.max(b.y1, v[1]); b.z0 = Math.min(b.z0, v[2]); b.z1 = Math.max(b.z1, v[2]); }); });
  return b;
}

const root = new S.Obj(); const wheels = [], wheelGroups = [];
NASA_FusionRover.init({ roverGroup: root, wheelGroups, wheels }).then(() => {
  // ---------- contract
  const arm = window.roverArm, G = window.ROVER_GEOM;
  check('6 wheels + wheelGroups with steer/lowerEye/localPos', wheels.length === 6 && wheelGroups.length === 6 && wheelGroups.every(w => w.lowerEye && w.localPos && w.group && w.tire && w.steer));
  check('6 coil-over links with rest length', (window.shockLinks || []).length === 6 && window.shockLinks.every(l => l.rest > 0.02 && l.upper && l.lower));
  check('arm handles + stow pose (L1=0.28, L2=0.25)', arm && arm.base && arm.shoulder && arm.elbow && arm.wrist && arm.fingerL && arm.fingerR && arm.tip && arm.L1 === 0.28 && arm.L2 === 0.25 && arm.stow);
  check('upperShellGroup origin at y=0 (sim drives its y for EXPLODE)', window.upperShellGroup && window.upperShellGroup.position.y === 0);
  check('lid, cargo lid, lidar head, 2 headlights, CoM marker, 2 cargo slots, battery bay', window.avLidGroup && window.cargoLidGroup && window.lidarHead && window.headlights.length === 2 && window.comMarkerGroup && (window.cargoBaySlots || []).length === 2 && window.batteryBay);
  check('fingers start open (fingerL.z<0<fingerR.z)', arm.fingerL.position.z < 0 && arm.fingerR.position.z > 0);

  // ---------- 24 in cube + ground contact
  const CUBE = 0.6096;
  const tris = worldTris(root);
  const bb = bbox(tris);
  check('wheels touch the ground (lowest point at y = 0)', Math.abs(bb.y0) < 0.004, 'y0=' + bb.y0.toFixed(3));
  check('length fits the 24 in cube (stowed)', bb.x1 - bb.x0 <= CUBE, 'L=' + (bb.x1 - bb.x0).toFixed(3));
  check('width fits the 24 in cube', bb.z1 - bb.z0 <= CUBE, 'W=' + (bb.z1 - bb.z0).toFixed(3));
  check('height fits the 24 in cube (top of lidar / stowed arm)', bb.y1 - bb.y0 <= CUBE, 'H=' + (bb.y1 - bb.y0).toFixed(3));
  // every module swept through a full 360-degree steer stays inside the cube and clear of its neighbours and the tub
  check('swept modules fit the cube (360 deg steer)', G.modX + G.sweepR <= CUBE / 2 && G.modZ + G.sweepR <= CUBE / 2, 'x ' + (G.modX + G.sweepR).toFixed(3) + ', z ' + (G.modZ + G.sweepR).toFixed(3));
  const fork = Math.hypot(G.wheelR, 0.036 + 0.003);
  check('module sweep radius covers the fork and tyre', fork <= G.sweepR + 1e-6, 'fork corner ' + fork.toFixed(3));
  check('neighbouring modules never touch while steering', G.modX > 2 * G.sweepR, 'pitch ' + G.modX + ' vs ' + (2 * G.sweepR).toFixed(3));
  check('belly tub clears the module sweep', 0.276 / 2 < G.modZ - G.sweepR, 'tub ' + (0.138).toFixed(3) + ' vs ' + (G.modZ - G.sweepR).toFixed(3));
  [0.4, 1.1, 2.0, 3.0].forEach(a => wheelGroups.forEach(w => { w.steer.rotation.y = a; }));
  const swept = bbox(worldTris(root));
  check('steered modules stay inside the cube', swept.z1 - swept.z0 <= CUBE && swept.x1 - swept.x0 <= CUBE, 'L ' + (swept.x1 - swept.x0).toFixed(3) + ' W ' + (swept.z1 - swept.z0).toFixed(3));
  wheelGroups.forEach(w => { w.steer.rotation.y = 0; });

  // ---------- charge pad
  const copper = bbox(tris, t => t.c === 0xc27a2c);
  check('charge pad contacts at x = pad.x, face 11 mm above the coupler reference', Math.abs((copper.x0 + copper.x1) / 2 - G.pad.x) < 0.01 && Math.abs(copper.y1 - (G.pad.y + 0.011)) < 0.002, 'face=' + copper.y1.toFixed(3));

  // ---------- canister volumes (0.26 long along rover Z, 0.15 dia) must be free of cradle / arm / structure
  const slots = window.cargoBaySlots.map(o => o.getWorldPosition(new S.V3()));
  check('canister seat: bottom 4 mm above the deck', Math.abs(slots[0].y - 0.075 - (G.deckY + 0.004)) < 0.002, 'bottom=' + (slots[0].y - 0.075).toFixed(3));
  let hitsAll = 0;
  slots.forEach(function (sp) {
    tris.forEach(function (t) {
      if (t.hidden) return;
      if (t.v.some(v => Math.hypot(v[0] - sp.x, v[1] - sp.y) < 0.075 - 0.003 && Math.abs(v[2] - sp.z) < 0.13 - 0.003)) hitsAll++;
    });
  });
  check('nothing intrudes into either canister volume', hitsAll === 0, hitsAll + ' triangles');
  check('the two canisters do not overlap', Math.abs(slots[0].x - slots[1].x) >= 0.15 + 0.004, 'pitch ' + Math.abs(slots[0].x - slots[1].x).toFixed(3));

  // ---------- arm reach (logistics IK)
  const L1 = arm.L1, L2 = arm.L2, bp = arm.base.position;
  function solve(l) { const yaw = Math.atan2(-l.z, l.x); let pl = Math.hypot(l.x, l.z), y = l.y, r = Math.hypot(pl, y); const mx = L1 + L2 - 0.02, mn = Math.abs(L1 - L2) + 0.04; const ok = r <= mx + 0.015; if (r > mx) { const s = mx / r; pl *= s; y *= s; r = mx; } r = Math.max(mn, r); let cE = (L1 * L1 + L2 * L2 - r * r) / (2 * L1 * L2); cE = Math.max(-1, Math.min(1, cE)); let cB = (L1 * L1 + r * r - L2 * L2) / (2 * L1 * r); cB = Math.max(-1, Math.min(1, cB)); return { yaw, sh: Math.atan2(y, Math.max(0.02, pl)) + Math.acos(cB), el: -(Math.PI - Math.acos(cE)), ok }; }
  function tipL() { const v = arm.tip.getWorldPosition(new S.V3()); return { x: v.x - bp.x, y: v.y - bp.y, z: v.z - bp.z }; }
  function ik(w) { let l = { ...w }, s; for (let i = 0; i < 4; i++) { s = solve(l); arm.base.rotation.y = s.yaw; arm.shoulder.rotation.z = s.sh; arm.elbow.rotation.z = s.el; const t = tipL(); l = { x: l.x + w.x - t.x, y: l.y + w.y - t.y, z: l.z + w.z - t.z }; } const t = tipL(); return { err: Math.hypot(w.x - t.x, w.y - t.y, w.z - t.z), ok: s.ok }; }
  slots.forEach((sp, k) => { const seat = ik({ x: sp.x - bp.x, y: sp.y + 0.075 + 0.045 - bp.y, z: sp.z - bp.z }); check('arm reaches the grapple knob in slot ' + (k + 1), seat.ok && seat.err < 0.005, (seat.err * 1000).toFixed(1) + ' mm'); });
  const hy = 0.15 + 0.045;
  [[0.45, 0.0], [0.40, 0.25], [0.35, -0.20]].forEach(p => { const r = ik({ x: p[0] - bp.x, y: hy - bp.y, z: p[1] - bp.z }); check('arm reaches a canister knob on the ground at (' + p + ')', r.ok && r.err < 0.005, (r.err * 1000).toFixed(1) + ' mm'); });
  arm.base.rotation.y = arm.stow.yaw; arm.shoulder.rotation.z = arm.stow.sh; arm.elbow.rotation.z = arm.stow.el;

  // ---------- docked fit (dock-local frame: rover yawed 180 deg, centre at PARK_ALONG, ground on the 0.08 floor)
  const C = D.C, park = C.PARK_ALONG, FLOOR = 0.08;
  const docked = tris.map(t => ({ ...t, v: t.v.map(v => [park - v[0], v[1] + FLOOR, -v[2]]) }));
  const dbb = bbox(docked);
  const bumperFace = -1.903 + 0.07;
  check('nose clears the hard-stop bumper face (2-10 mm)', dbb.x0 - bumperFace > 0.002 && dbb.x0 - bumperFace < 0.010, 'gap=' + ((dbb.x0 - bumperFace) * 1000).toFixed(1) + ' mm');
  const clampInner = 0.31 - 0.009 - 0.0025;   // closed jaw 0.31, rubber face 9 mm in, ~2.5 mm PETG thermal growth margin
  const span = bbox(docked, t => { const b = bbox([t]); return b.y1 > 0.135 && b.y0 < 0.265 && b.x1 > park - 0.25 && b.x0 < park + 0.25; });
  check('wheel modules clear the closed clamp jaws (jaw band y 0.135-0.265)', Math.max(span.z1, -span.z0) < clampInner, 'half-width=' + Math.max(span.z1, -span.z0).toFixed(3) + ' vs ' + clampInner.toFixed(3));
  const padTop = FLOOR + copper.y1, pogoBottom = (FLOOR + G.pad.y) + 0.062 - 0.04 - 0.015;
  check('coupler pogos land on the pad (1-8 mm compression)', padTop - pogoBottom > 0.001 && padTop - pogoBottom < 0.008, ((padTop - pogoBottom) * 1000).toFixed(1) + ' mm');

  const dock = new S.Obj(); const M = (c) => ({ color: c, metalness: 0.2, roughness: 0.5 });
  D.reset(); D.build(THREE, dock, { bay: M(0x8fa1b3), bayDark: M(0x18222d), bayTrim: M(0xcbd5e1), hazard: M(0xe0a800), copper: M(0xf59e0b) });
  const rv = new S.Obj(); dock.add(rv); rv.position.set(park, FLOOR, 0); rv.rotation.set(0, Math.PI, 0);
  const padObj = new S.Obj(); padObj.position.set(G.pad.x, G.pad.y, G.pad.z); rv.add(padObj);
  const st = D.state(); st.arm = 0; st.coupler = 1; st.latched = true; st.contactsLive = true;
  for (let i = 0; i < 40; i++) D.update(0.05, 'DOCKED', padObj);
  const headTris = []; S.walk(dock, S.mat4(), headTris);
  const hb = bbox(headTris, t => t.c === 0x1f2937), pw = padObj.getWorldPosition(new S.V3());
  check('coupler head is centred over the rover pad', Math.abs((hb.x0 + hb.x1) / 2 - pw.x) < 0.01 && Math.abs((hb.z0 + hb.z1) / 2 - pw.z) < 0.01,
        'head x=' + ((hb.x0 + hb.x1) / 2).toFixed(3) + ' pad x=' + pw.x.toFixed(3));

  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
});
