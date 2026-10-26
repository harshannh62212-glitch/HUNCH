/**
 * Browser side of Mission 10: the FAULTS panel, the boulder that blocks the road,
 * and the hooks that connect injected faults to the simulator. Needs js/faults.js.
 */
(function () {
  var F = window.NASA_Faults;
  if (!F) return;
  var rocks = [];
  var panel = null, listEl = null, opEl = null, histEl = null, open = false;

  function say(html) { if (typeof llog === 'function') llog(html); }

  function dropRock() {
    var yaw = (typeof roverYaw === 'number') ? roverYaw : 0;
    var x = roverGroup.position.x + Math.cos(yaw) * 5, z = roverGroup.position.z - Math.sin(yaw) * 5;
    var g = new THREE.Group();
    var m = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95, metalness: 0.05 });
    [[0, 0, 0, 0.8], [0.6, 0, 0.3, 0.5], [-0.5, 0, -0.35, 0.55]].forEach(function (b) {
      var r = new THREE.Mesh(new THREE.IcosahedronGeometry(b[3], 1), m);
      r.position.set(b[0], b[3] * 0.6, b[2]); r.castShadow = true; g.add(r);
    });
    g.position.set(x, getH(x, z), z);
    scene.add(g);
    rocks.push({ mesh: g, x: x, z: z, r: 1.7, aside: false });
    if (typeof navForceReplan !== 'undefined') navForceReplan = true;
  }
  function clearRocks() {
    // A boulder that a robot pushed out of the corridor stays where it is as scenery.
    rocks = rocks.filter(function (r) { if (r.aside) return true; scene.remove(r.mesh); return false; });
    if (typeof navForceReplan !== 'undefined') navForceReplan = true;
  }

  F.hooks({
    log: function (e) {
      var col = e.state === 'CLEARED' || e.state === 'LINK RESTORED' ? 'text-emerald-300' : (e.severity === 'ALERT' ? 'text-rose-300' : 'text-amber-300');
      say('<span class="' + col + ' font-bold">[FAULT ' + e.t + 's] ' + e.label + ' — ' + e.state + '. ' + e.detail + ' ' + e.action + '</span>');
      render();
    },
    say: function (t) { say('<span class="text-amber-300">[FAULT] ' + t + '</span>'); },
    onInject: function (id) {
      if (id === 'road') dropRock();
      if (id === 'battery' && typeof roverWh !== 'undefined' && typeof MAXWH !== 'undefined') roverWh = Math.min(roverWh, 0.17 * MAXWH);
      if (id === 'comms') say('<span class="text-amber-300">[LINK] Signal dropped.</span>');
      render();
    },
    onClear: function (id) { if (id === 'road') clearRocks(); render(); },
    context: function (id) {
      if (id === 'battery' && typeof roverWh !== 'undefined' && typeof MAXWH !== 'undefined') return { soc: +(100 * roverWh / MAXWH).toFixed(0) };
      if (id === 'road' && rocks[0]) return { obstacleAt: [+rocks[0].x.toFixed(1), +rocks[0].z.toFixed(1)] };
      return null;
    },
    onDetect: function (id) {
      if (id === 'road' && window.NASA_Coop) NASA_Coop.onRoadBlocked();
      if (id === 'battery' && window.NASA_Logistics) NASA_Logistics.requestCharge();
      render();
    },
    onDecide: function (id, choice) {
      if (id === 'receiving' && choice === 'return' && window.NASA_Logistics) NASA_Logistics.goToHangar();
    }
  });

  window.NASA_FaultsUI = {
    obstacles: function () { return rocks.filter(function (r) { return !r.aside; }).map(function (r) { return { x: r.x, z: r.z, r: r.r }; }); },
    blockingRock: function () { for (var i = 0; i < rocks.length; i++) if (!rocks[i].aside) return { x: rocks[i].x, z: rocks[i].z, i: i }; return null; },
    moveRock: function (i, x, z) { var r = rocks[i]; if (!r) return; r.x = x; r.z = z; r.mesh.position.set(x, getH(x, z), z); },
    markAside: function (i) { if (rocks[i]) rocks[i].aside = true; if (typeof navForceReplan !== 'undefined') navForceReplan = true; }
  };

  function btn(label, fn, color) {
    var b = document.createElement('button');
    b.textContent = label; b.type = 'button';
    b.style.cssText = 'padding:3px 6px;margin:2px;border:1px solid ' + (color || '#475569') + ';background:#0f172a;color:#e2e8f0;border-radius:4px;font:10px ui-monospace,monospace;cursor:pointer';
    b.onclick = fn;
    return b;
  }

  function render() {
    if (!panel) return;
    listEl.innerHTML = '';
    opEl.innerHTML = '';
    var act = F.active();
    act.forEach(function (a) {
      var row = document.createElement('div');
      row.style.cssText = 'font:10px ui-monospace,monospace;color:' + (a.mode === 'operator' ? '#fda4af' : '#fcd34d') + ';margin:2px 0';
      row.textContent = a.label + ': ' + a.state;
      listEl.appendChild(row);
    });
    if (!act.length) listEl.innerHTML = '<div style="font:10px ui-monospace,monospace;color:#94a3b8">No active faults.</div>';
    F.needsOperator().forEach(function (id) {
      var h = document.createElement('div');
      h.style.cssText = 'font:10px ui-monospace,monospace;color:#fda4af;margin-top:4px';
      h.textContent = 'OPERATOR DECISION for ' + F.DEFS[id].label + ':';
      opEl.appendChild(h);
      opEl.appendChild(btn('RETRY', function () { F.decide(id, 'retry'); }, '#22c55e'));
      opEl.appendChild(btn('RETURN TO DOCK', function () { F.decide(id, 'return'); }, '#f59e0b'));
    });
    var hist = F.history().slice(-4).reverse();
    histEl.innerHTML = hist.map(function (e) { return '<div style="font:9px ui-monospace,monospace;color:#94a3b8">' + e.t + 's ' + e.label + ': ' + e.state + '</div>'; }).join('');
  }

  function build() {
    var wrap = document.createElement('div');
    wrap.id = 'fault-ui';
    wrap.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:8px;z-index:40;width:300px;text-align:center';
    var toggle = btn('FAULTS ▸', function () { open = !open; panel.style.display = open ? 'block' : 'none'; toggle.textContent = open ? 'FAULTS ▾' : 'FAULTS ▸'; render(); }, '#f43f5e');
    wrap.appendChild(toggle);
    panel = document.createElement('div');
    panel.style.cssText = 'display:none;margin-top:4px;padding:6px;background:rgba(2,6,23,.92);border:1px solid #334155;border-radius:6px';
    var inj = document.createElement('div');
    Object.keys(F.DEFS).forEach(function (id) {
      inj.appendChild(btn(F.DEFS[id].label, function () { F.inject(id); }, '#f59e0b'));
    });
    inj.appendChild(btn('Clear all', function () { F.clearAll(); }, '#22c55e'));
    panel.appendChild(inj);
    listEl = document.createElement('div'); listEl.style.marginTop = '6px'; panel.appendChild(listEl);
    opEl = document.createElement('div'); panel.appendChild(opEl);
    histEl = document.createElement('div'); histEl.style.marginTop = '6px'; panel.appendChild(histEl);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
