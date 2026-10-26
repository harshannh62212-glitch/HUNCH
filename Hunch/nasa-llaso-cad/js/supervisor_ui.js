/**
 * Supervisory controls: pause / resume, require operator approval before each placement,
 * and approve a waiting placement. Commands also work by text: pause, resume, approval on|off, approve.
 */
(function () {
  var panel = null, status = null, open = false, appr = null;
  function btn(label, fn, color) {
    var b = document.createElement('button');
    b.textContent = label; b.type = 'button';
    b.style.cssText = 'padding:3px 6px;margin:2px;border:1px solid ' + (color || '#475569') + ';background:#0f172a;color:#e2e8f0;border-radius:4px;font:10px ui-monospace,monospace;cursor:pointer';
    b.onclick = fn;
    return b;
  }
  function linkOk() {
    if (window.NASA_Faults && !NASA_Faults.commsUp()) { if (typeof llog === 'function') llog('<span class="text-rose-400 font-bold">[LINK DOWN] Supervisor command not delivered.</span>'); return false; }
    return true;
  }
  function render() {
    if (!status || !window.NASA_Logistics) return;
    var s = NASA_Logistics.supervisor();
    status.textContent = (s.paused ? 'PAUSED' : 'RUNNING') + ' · approval ' + (s.approve ? 'ON' : 'OFF') + (s.pending ? ' · WAITING FOR APPROVAL' : '');
    status.style.color = s.pending ? '#f0abfc' : (s.paused ? '#fcd34d' : '#86efac');
    appr.style.display = s.pending ? 'inline-block' : 'none';
  }
  function build() {
    var wrap = document.createElement('div');
    wrap.id = 'supervisor-ui';
    wrap.style.cssText = 'position:fixed;left:calc(50% - 175px);bottom:8px;z-index:40;width:100px';
    var toggle = btn('SUPERVISOR ▸', function () { open = !open; panel.style.display = open ? 'block' : 'none'; toggle.textContent = open ? 'SUPERVISOR ▾' : 'SUPERVISOR ▸'; render(); }, '#38bdf8');
    wrap.appendChild(toggle);
    panel = document.createElement('div');
    panel.style.cssText = 'display:none;position:absolute;bottom:28px;left:0;width:260px;padding:6px;background:rgba(2,6,23,.94);border:1px solid #334155;border-radius:6px';
    status = document.createElement('div'); status.style.cssText = 'font:10px ui-monospace,monospace;margin:2px'; panel.appendChild(status);
    panel.appendChild(btn('Pause', function () { if (linkOk()) NASA_Logistics.pause(); render(); }, '#f59e0b'));
    panel.appendChild(btn('Resume', function () { if (linkOk()) NASA_Logistics.resume(); render(); }, '#22c55e'));
    panel.appendChild(btn('Abort', function () { if (linkOk()) { NASA_Logistics.abort(); } render(); }, '#f43f5e'));
    panel.appendChild(btn('Toggle approval', function () { if (linkOk()) NASA_Logistics.setApproval(!NASA_Logistics.supervisor().approve); render(); }, '#a78bfa'));
    appr = btn('APPROVE PLACEMENT', function () { if (linkOk()) NASA_Logistics.approve(); render(); }, '#22c55e');
    appr.style.display = 'none'; panel.appendChild(appr);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    setInterval(render, 500);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
