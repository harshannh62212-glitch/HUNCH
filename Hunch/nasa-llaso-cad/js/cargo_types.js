/**
 * Mission 8: one rover, three cargo systems.
 * Every cargo type carries the same universal grapple bail, so the arm and the
 * lock work unchanged. What adapts is the cradle: its clamp span and saddle shape.
 * Dimensions are scaled to fit the 2 x 2 ft rover bay and, just as important, the arm's reach:
 * every type is about as tall as the pod (about 16 cm) so the arm can set it on the intake table. The cylinder and container are
 * generic concept stand-ins, not vendor specifications.
 * Pure logic (no THREE), so tools/cargo_types_test.js can run it in Node.
 */
(function (root) {
  var LB = 0.45359237;
  var G_MOON = 1.622;

  // Full-scale references and the scale used for the prototype.
  var TYPES = {
    pod: {
      id: 'pod', label: 'Cargo canister', shape: 'canister',
      fullM: [1.04, 0.60, 0.60], scale: 4, massKg: 5 * LB,
      note: 'Pressure-vessel canister (1.04 m x 0.60 m dia, domed ends, top grapple knob, side trunnions) at 1:4'
    },
    cylinder: {
      id: 'cylinder', label: 'Cylindrical cargo module', shape: 'cylinder',
      fullM: [4.5, 3.0, 3.0], scale: 18, massKg: 2.5,
      note: 'Cylindrical module concept (4.5 m x 3 m dia) at 1:18, lying on its side'
    },
    container: {
      id: 'container', label: '20 ft shipping container', shape: 'box',
      fullM: [6.058, 2.438, 2.591], scale: 16, massKg: 3.0,
      note: 'ISO 20 ft container at 1:16'
    }
  };

  // Rover cradle envelope (the 2 x 2 ft deck) and what its clamps can do.
  var BAY = { lengthM: 0.62, widthM: 0.30, heightM: 0.32, maxKg: 3.2, clampMinM: 0.12, clampMaxM: 0.34 };
  // Universal grapple interface, identical on every type.
  var BAIL = { spanM: 0.14, rodRadiusM: 0.0075, riseM: 0.045 };

  function get(id) {
    var t = TYPES[id];
    if (!t) return null;
    var d = t.fullM.map(function (v) { return v / t.scale; });
    return {
      id: t.id, label: t.label, shape: t.shape, note: t.note, massKg: t.massKg,
      lengthM: d[0], widthM: d[1], heightM: d[2], bail: BAIL
    };
  }
  function ids() { return Object.keys(TYPES); }

  /** Clamp span and saddle needed to hold a type. Cylinders get a V saddle so they cannot roll. */
  function cradleFor(id) {
    var t = get(id);
    if (!t) return null;
    var span = t.widthM + 0.01;   // 5 mm each side
    return {
      type: id,
      clampSpanM: +span.toFixed(3),
      saddle: (t.shape === 'cylinder' || t.shape === 'canister') ? 'vee' : 'flat',
      reachable: span >= BAY.clampMinM && span <= BAY.clampMaxM
    };
  }

  /** Does the type fit the bay envelope and mass limit? Lists each reason it does not. */
  function fits(id) {
    var t = get(id), c = cradleFor(id), why = [];
    if (!t) return { fits: false, reasons: ['unknown type'] };
    if (t.lengthM > BAY.lengthM) why.push('too long (' + (t.lengthM * 100).toFixed(0) + ' cm)');
    if (t.widthM > BAY.widthM) why.push('too wide (' + (t.widthM * 100).toFixed(0) + ' cm)');
    if (t.heightM > BAY.heightM) why.push('too tall (' + (t.heightM * 100).toFixed(0) + ' cm)');
    if (t.massKg > BAY.maxKg) why.push('too heavy (' + t.massKg.toFixed(2) + ' kg)');
    if (!c.reachable) why.push('clamp cannot reach span');
    return { fits: why.length === 0, reasons: why };
  }

  /** Static lateral-accel margin (m/s^2) before tipping, for a cargo sitting on the deck. */
  function tipMargin(id, rover) {
    var t = get(id);
    var hCom = rover.comHeightM * (rover.massKg / (rover.massKg + t.massKg)) +
               (rover.deckHeightM + t.heightM / 2) * (t.massKg / (rover.massKg + t.massKg));
    return (rover.halfTrackM / hCom) * G_MOON;
  }

  /** Cycle through types for a mixed manifest. */
  function pick(mode, index) {
    if (mode === 'mixed') return ids()[index % ids().length];
    return TYPES[mode] ? mode : 'pod';
  }

  root.NASA_Cargo = { TYPES: TYPES, BAY: BAY, BAIL: BAIL, get: get, ids: ids, cradleFor: cradleFor, fits: fits, tipMargin: tipMargin, pick: pick, mode: 'pod' };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NASA_Cargo;
})(typeof window !== 'undefined' ? window : globalThis);
