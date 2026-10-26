#!/usr/bin/env node
/* Headless checks for both CAD models (rover + dock station) — no browser or three.js needed.
 *   node tools/cad_model_check.js
 * Builds js/fusion_rover.js and js/dock_station.js on a tiny THREE stub (tools/three_shim.js), then checks:
 *   - the simulator contract of the rover (handles the sim / logistics code relies on)
 *   - rover envelope, charge-pad height, cargo slot vs. pod guides / charge bridge clearances
 *   - arm reach (same IK as js/lunar_logistics.js) to the cargo slot and to ground pick-ups
 *   - docked fit: nose vs. hard-stop bumper, wheels/fenders vs. closed clamp bars, coupler pogos vs. pad
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
  const arm = window.roverArm;
  check('6 wheels + wheelGroups with lowerEye/localPos', wheels.length === 6 && wheelGroups.length === 6 && wheelGroups.every(w => w.lowerEye && w.localPos && w.group && w.tire));
  check('6 shock links with rest length', (window.shockLinks || []).length === 6 && window.shockLinks.every(l => l.rest > 0.05 && l.upper && l.lower));
  check('arm handles (base/shoulder/elbow/wrist/fingers/tip, L1=0.34, L2=0.30)', arm && arm.base && arm.shoulder && arm.elbow && arm.wrist && arm.fingerL && arm.fingerR && arm.tip && arm.L1 === 0.34 && arm.L2 === 0.30);
  check('upperShellGroup origin at y=0 (sim drives its y for EXPLODE)', window.upperShellGroup && window.upperShellGroup.position.y === 0);
  check('lid, cargo lid, lidar head, 2 headlights, CoM marker, cargo slot', window.avLidGroup && window.cargoLidGroup && window.lidarHead && window.headlights.length === 2 && window.comMarkerGroup && (window.cargoBaySlots || []).length >= 1);
  check('fingers start open (fingerL.z<0<fingerR.z)', arm.fingerL.position.z < 0 && arm.fingerR.position.z > 0);

  // ---------- envelope + pad
  const tris = worldTris(root);
  const bb = bbox(tris);
  check('wheels touch ground (lowest point ≈ -0.01)', Math.abs(bb.y0 + 0.01) < 0.004, 'y0=' + bb.y0.toFixed(3));
  check('overall width ≤ 0.80 m (dock clamps close to ±0.425)', bb.z1 - bb.z0 <= 0.80, 'width=' + (bb.z1 - bb.z0).toFixed(3));
  check('nose ≤ 0.65 m ahead of centre (dock bumper gap)', bb.x1 <= 0.65, 'nose=' + bb.x1.toFixed(3));
  const copper = bbox(tris, t => t.c === 0xc27a2c);
  check('charge pad contacts at x≈-0.22, top ≈ 0.35 (dock coupler contact height)', Math.abs((copper.x0 + copper.x1) / 2 + 0.22) < 0.01 && copper.y1 > 0.343 && copper.y1 < 0.356, 'top=' + copper.y1.toFixed(3));

  // ---------- cargo slot clearances (pod 0.305 long in X, 0.152 wide, 0.152 tall)
  // two slots side by side (z = ±0.125); check each pod volume
  const slots = window.cargoBaySlots.map(o => o.getWorldPosition(new S.V3()));
  const slot = slots[0];
  check('pod sits on the cradle floor', Math.abs(slot.y - 0.076 - 0.186) < 0.004, 'pod bottom=' + (slot.y - 0.076).toFixed(3));
  let hitsAll = [];
  slots.forEach(function (sp) {
    const pod = { x0: sp.x - 0.1525, x1: sp.x + 0.1525, z0: sp.z - 0.076, z1: sp.z + 0.076, y0: sp.y - 0.076, y1: sp.y + 0.076 + 0.046 };
    const inter = (t) => { const b = bbox([t]); return b.x1 > pod.x0 + 0.001 && b.x0 < pod.x1 - 0.001 && b.z1 > pod.z0 + 0.001 && b.z0 < pod.z1 - 0.001 && b.y1 > pod.y0 + 0.002 && b.y0 < pod.y1; };
    const hits = tris.filter(inter).filter(t => { const b = bbox([t]); return !(b.y1 <= pod.y0 + 0.012 && b.y0 >= pod.y0 - 0.02) && !t.hidden; }); // ignore the floor/tie strips under the pod
    if (process.env.HITS) hits.slice(0, 6).forEach(t => console.log('  hit', t.c.toString(16), JSON.stringify(bbox([t]))));
    hitsAll = hitsAll.concat(hits);
  });
  check('nothing intrudes into either pod volume (guides, bridge, clamps)', hitsAll.length === 0, hitsAll.length + ' triangles');

  // ---------- arm reach (logistics IK)
  const L1 = arm.L1, L2 = arm.L2, bp = arm.base.position;
  function solve(l) { const yaw = Math.atan2(-l.z, l.x); let pl = Math.hypot(l.x, l.z), y = l.y, r = Math.hypot(pl, y); const mx = L1 + L2 - 0.02, mn = Math.abs(L1 - L2) + 0.04; const ok = r <= mx + 0.015; if (r > mx) { const s = mx / r; pl *= s; y *= s; r = mx; } r = Math.max(mn, r); let cE = (L1 * L1 + L2 * L2 - r * r) / (2 * L1 * L2); cE = Math.max(-1, Math.min(1, cE)); let cB = (L1 * L1 + r * r - L2 * L2) / (2 * L1 * r); cB = Math.max(-1, Math.min(1, cB)); return { yaw, sh: Math.atan2(y, Math.max(0.02, pl)) + Math.acos(cB), el: -(Math.PI - Math.acos(cE)), ok }; }
  function tipL() { const v = arm.tip.getWorldPosition(new S.V3()); return { x: v.x - bp.x, y: v.y - bp.y, z: v.z - bp.z }; }
  function ik(w) { let l = { ...w }, s; for (let i = 0; i < 4; i++) { s = solve(l); arm.base.rotation.y = s.yaw; arm.shoulder.rotation.z = s.sh; arm.elbow.rotation.z = s.el; const t = tipL(); l = { x: l.x + w.x - t.x, y: l.y + w.y - t.y, z: l.z + w.z - t.z }; } const t = tipL(); return { err: Math.hypot(w.x - t.x, w.y - t.y, w.z - t.z), ok: s.ok }; }
  const seat = ik({ x: slot.x - bp.x, y: slot.y + 0.076 + 0.01 - bp.y, z: slot.z - bp.z });
  check('arm reaches the cargo slot seat', seat.ok && seat.err < 0.005, (seat.err * 1000).toFixed(1) + ' mm');
  const hy = -0.01 + 0.1524 + 0.038 + 0.01;
  [[0.80, 0.0], [0.70, 0.30], [0.45, 0.50], [0.70, -0.15]].forEach(p => { const r = ik({ x: p[0] - bp.x, y: hy - bp.y, z: p[1] - bp.z }); check('arm reaches a ground pod handle at (' + p + ')', r.ok && r.err < 0.005, (r.err * 1000).toFixed(1) + ' mm'); });
  arm.base.rotation.y = 0; arm.shoulder.rotation.z = 1.15; arm.elbow.rotation.z = -2.15;

  // ---------- docked fit (dock-local frame: rover yawed 180°, centre at PARK_ALONG, root 0.01 above the 0.08 floor)
  const C = D.C, park = C.PARK_ALONG;
  const docked = tris.map(t => ({ ...t, v: t.v.map(v => [park - v[0], v[1] + 0.09, -v[2]]) }));
  const dbb = bbox(docked);
  const bumperFace = -1.903 + 0.07;  // dock-station-cad.html hard stop at x = -1.903 (0.14 thick), about 5 mm nose gap
  check('nose clears the hard-stop bumper face', dbb.x0 > bumperFace, 'gap=' + ((dbb.x0 - bumperFace) * 1000).toFixed(0) + ' mm');
  const clampInner = 0.425 - 0.009 - 0.0036;   // closed jaw inner face 0.425, rubber pad face 9 mm in (dock_station.js), minus ~3.6 mm PETG thermal growth per side (60e-6/K x 0.78 m x 150 K / 2 / 2)
  const span = bbox(docked, t => { const b = bbox([t]); return b.y1 > 0.135 && b.y0 < 0.265 && b.x1 > park - 0.75 && b.x0 < park + 0.75; });
  check('wheels/fenders clear the closed clamp bars (bar band y 0.135–0.265)', Math.max(span.z1, -span.z0) < clampInner, 'half-width=' + Math.max(span.z1, -span.z0).toFixed(3) + ' vs ' + clampInner.toFixed(3));
  const padTop = 0.09 + copper.y1, pogoBottom = (0.09 + 0.338) + 0.062 - 0.04 - 0.015;
  check('coupler pogos land on the pad (1–8 mm compression)', padTop - pogoBottom > 0.001 && padTop - pogoBottom < 0.008, ((padTop - pogoBottom) * 1000).toFixed(1) + ' mm');

  // ---------- coupler really lands on the rover pad (builds the dock hardware and runs its update())
  const dock = new S.Obj(); const M = (c) => ({ color: c, metalness: 0.2, roughness: 0.5 });
  D.reset(); D.build(THREE, dock, { bay: M(0x8fa1b3), bayDark: M(0x18222d), bayTrim: M(0xcbd5e1), hazard: M(0xe0a800), copper: M(0xf59e0b) });
  const rv = new S.Obj(); dock.add(rv); rv.position.set(park, 0.09, 0); rv.rotation.set(0, Math.PI, 0);
  const padObj = new S.Obj(); padObj.position.set(-0.22, 0.338, 0); rv.add(padObj);
  const st = D.state(); st.arm = 0; st.coupler = 1; st.latched = true; st.contactsLive = true;
  for (let i = 0; i < 40; i++) D.update(0.05, 'DOCKED', padObj);
  const headTris = []; S.walk(dock, S.mat4(), headTris);
  const hb = bbox(headTris, t => t.c === 0x1f2937), pw = padObj.getWorldPosition(new S.V3());
  check('coupler head is centred over the rover pad', Math.abs((hb.x0 + hb.x1) / 2 - pw.x) < 0.01 && Math.abs((hb.z0 + hb.z1) / 2 - pw.z) < 0.01,
        'head x=' + ((hb.x0 + hb.x1) / 2).toFixed(3) + ' pad x=' + pw.x.toFixed(3));

  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
});
