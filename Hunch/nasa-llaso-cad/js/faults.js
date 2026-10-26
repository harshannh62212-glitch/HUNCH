/**
 * Mission 10: "Something goes wrong". A judge (or the team) injects a fault from the
 * FAULTS panel or with the command "fault <name>". The rover detects it, logs a structured
 * diagnostic, and either picks a safe automatic response or stops and asks the operator.
 * The faults are injected; the responses change real simulator behaviour (speed, route,
 * charging, the receiving hatch, command link). The core is pure so tools/faults_test.js can run it.
 */
(function (root) {
  var DETECT_S = 1.0;

  // mode: 'auto' = rover chooses a safe response; 'operator' = rover holds and waits for a decision.
  var DEFS = {
    road:      { label: 'Blocked road',            names: ['road', 'blocked', 'rock'],       mode: 'auto',     speed: 1,    tip: 0,   sev: 'WARN',
                 detail: 'Route ahead is blocked by a boulder.',                              action: 'Replanning a path around the obstacle.' },
    comms:     { label: 'Communications loss',     names: ['comms', 'link', 'communication'], mode: 'auto',     speed: 1,    tip: 0,   sev: 'WARN', autoClearS: 20,
                 detail: 'Habitat link lost. Operator commands are not being received.',     action: 'Continuing the cached plan autonomously; will report when the link returns.' },
    battery:   { label: 'Low battery',             names: ['battery', 'soc', 'power'],        mode: 'auto',     speed: 1,    tip: 0,   sev: 'WARN',
                 detail: 'State of charge dropped below the reserve limit.',                  action: 'Finish the handover, then return to the dock and charge.' },
    cargo:     { label: 'Shifted cargo',           names: ['cargo', 'shift', 'load'],         mode: 'auto',     speed: 0.6,  tip: 0.8, sev: 'WARN',
                 detail: 'Payload centre of mass moved sideways; rollover margin reduced.',   action: 'Limiting speed to 60 % and delivering carefully.' },
    wheel:     { label: 'Disabled wheel',          names: ['wheel', 'motor'],                 mode: 'auto',     speed: 0.55, tip: 0,   sev: 'WARN',
                 detail: 'One drive wheel is not responding.',                               action: 'Limp mode at 55 % speed on the remaining wheels.' },
    sensor:    { label: 'Sensor failure (LiDAR)',  names: ['sensor', 'lidar'],                mode: 'auto',     speed: 0.4,  tip: 0,   sev: 'WARN',
                 detail: 'Forward range sensor returns no data.',                            action: 'Creeping at 40 % speed on the cached map.' },
    receiving: { label: 'Receiving bay unavailable', names: ['receiving', 'bay', 'airlock', 'habitat'], mode: 'operator', speed: 1, tip: 0, sev: 'ALERT',
                 detail: 'Habitat reports the receiving bay is occupied. The hatch will not open.', action: 'Holding the cargo at the airlock. Operator decision needed: RETRY or RETURN.' }
  };

  var S = { active: {}, history: [], simT: 0, hooks: {} };

  function find(name) {
    var n = String(name || '').trim().toLowerCase();
    for (var id in DEFS) { if (id === n || DEFS[id].names.indexOf(n) >= 0) return id; }
    for (var k in DEFS) { if (DEFS[k].names.some(function (w) { return n.indexOf(w) >= 0; })) return k; }
    return null;
  }
  function note(entry) { S.history.push(entry); if (S.hooks.log) S.hooks.log(entry); }
  function stamp(id, state, extra) {
    var d = DEFS[id];
    var e = { t: +S.simT.toFixed(1), id: id, label: d.label, severity: d.sev, state: state, detail: d.detail, action: d.action };
    if (extra) for (var k in extra) e[k] = extra[k];
    return e;
  }

  var api = {
    DEFS: DEFS, find: find,
    hooks: function (h) { S.hooks = h || {}; },
    reset: function () { S.active = {}; S.history = []; S.simT = 0; },
    inject: function (id) {
      if (!DEFS[id] || S.active[id]) return false;
      S.active[id] = { t0: S.simT, state: 'DETECTING', announced: false };
      if (S.hooks.onInject) S.hooks.onInject(id);
      return true;
    },
    injectByName: function (name) {
      var id = find(name);
      if (!id) { if (S.hooks.say) S.hooks.say('Unknown fault. Try: ' + Object.keys(DEFS).join(', ')); return false; }
      return api.inject(id);
    },
    clear: function (id) {
      if (!S.active[id]) return false;
      delete S.active[id];
      if (S.hooks.onClear) S.hooks.onClear(id);
      note(stamp(id, 'CLEARED', { detail: DEFS[id].label + ' cleared.', action: 'Resuming the mission.' }));
      return true;
    },
    clearAll: function () { Object.keys(S.active).forEach(api.clear); },
    /** Operator decision for a fault that stopped the rover. */
    decide: function (id, choice) {
      var a = S.active[id];
      if (!a || DEFS[id].mode !== 'operator' || a.state !== 'AWAITING OPERATOR') return false;
      note(stamp(id, 'OPERATOR DECISION', { detail: 'Operator chose ' + choice.toUpperCase() + '.', action: choice === 'return' ? 'Returning to the dock with the cargo.' : 'Retrying the receiving bay.' }));
      if (S.hooks.onDecide) S.hooks.onDecide(id, choice);
      api.clear(id);
      return true;
    },
    step: function (dt) {
      S.simT += dt;
      Object.keys(S.active).forEach(function (id) {
        var a = S.active[id], d = DEFS[id];
        if (a.state === 'DETECTING' && S.simT - a.t0 >= DETECT_S) {
          a.state = d.mode === 'operator' ? 'AWAITING OPERATOR' : 'AUTO RESPONSE';
          note(stamp(id, a.state, S.hooks.context ? S.hooks.context(id) : null));
          if (S.hooks.onDetect) S.hooks.onDetect(id);
        }
        if (d.autoClearS && a.state !== 'DETECTING' && S.simT - a.t0 >= d.autoClearS) {
          api.clear(id);
          if (id === 'comms') note({ t: +S.simT.toFixed(1), id: id, label: d.label, severity: 'INFO', state: 'LINK RESTORED', detail: 'Habitat link is back.', action: 'Reporting status and queued diagnostics.' });
        }
      });
    },
    isActive: function (id) { return !!S.active[id]; },
    active: function () { return Object.keys(S.active).map(function (id) { return { id: id, label: DEFS[id].label, state: S.active[id].state, mode: DEFS[id].mode }; }); },
    history: function () { return S.history.slice(); },
    /** Combined speed multiplier from every active fault past detection. */
    speedScale: function () {
      var s = 1;
      Object.keys(S.active).forEach(function (id) { if (S.active[id].state !== 'DETECTING') s = Math.min(s, DEFS[id].speed); });
      return s;
    },
    tipPenalty: function () {
      var p = 0;
      Object.keys(S.active).forEach(function (id) { p += DEFS[id].tip; });
      return p;
    },
    commsUp: function () { return !S.active.comms; },
    receivingBlocked: function () { return !!S.active.receiving; },
    needsOperator: function () { return Object.keys(S.active).filter(function (id) { return S.active[id].state === 'AWAITING OPERATOR'; }); }
  };

  root.NASA_Faults = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
