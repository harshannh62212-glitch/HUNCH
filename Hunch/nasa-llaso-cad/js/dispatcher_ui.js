/**
 * Panel for Mission 11: shows the dispatcher's plan (order, robot, route, start time, reason)
 * next to what the rover has actually delivered. Needs js/dispatcher.js and lunar_logistics.js.
 */
(function () {
  var panel = null, body = null, open = false, timer = null;

  function btn(label, fn, color) {
    var b = document.createElement('button');
    b.textContent = label; b.type = 'button';
    b.style.cssText = 'padding:3px 6px;margin:2px;border:1px solid ' + (color || '#475569') + ';background:#0f172a;color:#e2e8f0;border-radius:4px;font:10px ui-monospace,monospace;cursor:pointer';
    b.onclick = fn;
    return b;
  }
  function esc(t) { return String(t).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function render() {
    if (!body) return;
    var st = window.NASA_Logistics && NASA_Logistics.dispatchStatus && NASA_Logistics.dispatchStatus();
    if (!st || !st.plan) { body.innerHTML = '<div style="font:10px ui-monospace,monospace;color:#94a3b8">No plan yet. Press Run demo dispatch.</div>'; return; }
    var done = {};
    st.delivered.forEach(function (d) { done[d.id] = d.t; });
    var rows = st.plan.trips.map(function (t) {
      return '<div style="margin:4px 0;padding:3px;border-left:3px solid ' + (t.onTime ? '#22c55e' : '#f43f5e') + ';font:9px ui-monospace,monospace;color:#e2e8f0">' +
        '<b>#' + t.order + '</b> ' + esc(t.robot) + ' · ' + esc(t.routeLabel) + ' · start ' + t.startS + 's → eta ' + t.etaS + 's' + (t.chargeFirst ? ' · charge first' : '') + (t.onTime ? '' : ' · <span style="color:#fda4af">LATE</span>') +
        t.items.map(function (i) {
          return '<div style="color:#cbd5e1;margin-left:6px">' + (done[i.id] != null ? '✔ ' : '○ ') + esc(i.id) + ' ' + esc(i.item) + ' <span style="color:#94a3b8">(' + esc(i.reason) + ')</span>' + (done[i.id] != null ? ' <span style="color:#86efac">delivered at ' + done[i.id] + 's</span>' : '') + '</div>';
        }).join('') + '</div>';
    }).join('');
    body.innerHTML = rows + '<div style="font:9px ui-monospace,monospace;color:#94a3b8;margin-top:4px">Route is advisory: the onboard A* planner picks the exact path.</div>';
  }

  function build() {
    var wrap = document.createElement('div');
    wrap.id = 'dispatch-ui';
    wrap.style.cssText = 'position:fixed;left:calc(50% + 70px);bottom:8px;z-index:40;width:340px;text-align:left';
    var toggle = btn('DISPATCH ▸', function () {
      open = !open; panel.style.display = open ? 'block' : 'none'; toggle.textContent = open ? 'DISPATCH ▾' : 'DISPATCH ▸';
      if (open) { render(); timer = setInterval(render, 1000); } else clearInterval(timer);
    }, '#d946ef');
    wrap.appendChild(toggle);
    panel = document.createElement('div');
    panel.style.cssText = 'display:none;position:absolute;bottom:28px;left:0;width:340px;max-height:320px;overflow:auto;padding:6px;background:rgba(2,6,23,.94);border:1px solid #334155;border-radius:6px';
    var bar = document.createElement('div');
    bar.appendChild(btn('Run demo dispatch', function () { NASA_Logistics.dispatch(); setTimeout(render, 200); }, '#22c55e'));
    bar.appendChild(btn('Add urgent repair', function () { NASA_Logistics.addUrgent('Emergency repair part', 'repair'); setTimeout(render, 200); }, '#f43f5e'));
    panel.appendChild(bar);
    body = document.createElement('div'); panel.appendChild(body);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
