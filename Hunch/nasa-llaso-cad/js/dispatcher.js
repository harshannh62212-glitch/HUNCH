/**
 * Mission 11: AI lunar logistics manager.
 * Given several cargo requests with different priorities, decide what moves first,
 * which robot takes it, which route to use and when the trip should start.
 * Pure logic (no THREE, no DOM) so tools/dispatcher_test.js can run it in Node.
 *
 * The score is a transparent rule set, not a trained model: category urgency, deadline
 * pressure, waiting time, and a small preference for light loads. Every step in the plan
 * carries a plain-language reason so a judge can see why the order came out as it did.
 */
(function (root) {
  var CATEGORIES = {
    repair:   { label: 'Emergency repair parts', base: 100, cargo: 'pod' },
    life:     { label: 'Life-support equipment', base: 90,  cargo: 'cylinder' },
    battery:  { label: 'Replacement batteries',  base: 70,  cargo: 'pod' },
    science:  { label: 'Scientific instruments', base: 50,  cargo: 'pod' },
    supplies: { label: 'Habitat supplies',       base: 30,  cargo: 'container' }
  };

  // Two ways across: the graded haul road, or straight over loose regolith.
  var ROUTES = {
    haul:   { id: 'haul-road',     label: 'Graded haul road', lengthFactor: 1.25, speedFactor: 1.00, energyFactor: 1.00 },
    direct: { id: 'direct-regolith', label: 'Direct over regolith', lengthFactor: 0.85, speedFactor: 0.75, energyFactor: 1.30 }
  };

  var DEFAULTS = { speedMps: 0.38, handlingS: 60, straightM: 68, whPerTrip: 2.4, reserveWh: 8, fullWh: 51, chargeS: 600, trayCapKg: 4.6, trayMaxItems: 2 };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /** Higher score moves first. Returns { score, parts } so the reasons can be printed. */
  function score(req, nowS) {
    var cat = CATEGORIES[req.category] || CATEGORIES.supplies;
    var parts = { base: cat.base, deadline: 0, aging: 0, mass: 0 };
    if (req.deadlineS != null) {
      var slack = req.deadlineS - nowS;
      parts.deadline = slack <= 0 ? 80 : clamp(60 * (1 - slack / 3600), 0, 60);
    }
    parts.aging = clamp(((nowS - (req.createdS || 0)) / 600) * 2, 0, 12);
    parts.mass = clamp(-(req.massKg || 0) * 0.5, -3, 0);
    return { score: parts.base + parts.deadline + parts.aging + parts.mass, parts: parts };
  }

  function reasonFor(req, s) {
    var cat = CATEGORIES[req.category] || CATEGORIES.supplies;
    var bits = [cat.label + ' (base ' + s.parts.base + ')'];
    if (s.parts.deadline > 0) bits.push('deadline pressure +' + s.parts.deadline.toFixed(0));
    if (s.parts.aging > 0.5) bits.push('waiting +' + s.parts.aging.toFixed(0));
    return bits.join(', ');
  }

  /** Pick the route for a trip. Emergencies take the fastest; others take the cheaper energy cost. */
  function chooseRoute(req, ctx) {
    var haulBlocked = !!ctx.haulBlocked;
    if (haulBlocked) return { route: ROUTES.direct, why: 'haul road blocked, going direct' };
    var urgent = (CATEGORIES[req.category] || {}).base >= 90;
    var tHaul = ROUTES.haul.lengthFactor / ROUTES.haul.speedFactor;
    var tDirect = ROUTES.direct.lengthFactor / ROUTES.direct.speedFactor;
    if (urgent && tDirect < tHaul) return { route: ROUTES.direct, why: 'urgent, fastest route' };
    return { route: ROUTES.haul, why: 'lowest energy, graded surface' };
  }

  /**
   * requests: [{ id, item, category, massKg, deadlineS?, createdS? }]
   * robots:   [{ id, availableS, socWh }]
   * ctx:      overrides for DEFAULTS plus { nowS, haulBlocked }
   * Returns { trips:[{order, robot, route, routeWhy, startS, etaS, whEst, items:[{id,item,reason}], onTime, chargeFirst}], ranking:[...] }
   */
  function plan(requests, robots, ctx) {
    var c = {}; for (var k in DEFAULTS) c[k] = DEFAULTS[k];
    ctx = ctx || {}; for (var k2 in ctx) c[k2] = ctx[k2];
    var nowS = c.nowS || 0;
    var ranked = requests.map(function (r) { var s = score(r, nowS); return { req: r, s: s }; })
      .sort(function (a, b) { return b.s.score - a.s.score || (a.req.id < b.req.id ? -1 : 1); });

    var fleet = robots.map(function (r) { return { id: r.id, t: Math.max(nowS, r.availableS || 0), wh: r.socWh }; });
    var trips = [], i = 0;
    while (i < ranked.length) {
      // Group the next requests into one tray load while mass and count allow.
      var group = [ranked[i]], mass = ranked[i].req.massKg || 0; i++;
      while (i < ranked.length && group.length < c.trayMaxItems && mass + (ranked[i].req.massKg || 0) <= c.trayCapKg &&
             (CATEGORIES[ranked[i].req.category] || {}).base >= (CATEGORIES[group[0].req.category] || {}).base - 30) {
        mass += ranked[i].req.massKg || 0; group.push(ranked[i]); i++;
      }
      var lead = group[0].req;
      var rt = chooseRoute(lead, c);
      var legS = (c.straightM * rt.route.lengthFactor) / (c.speedMps * rt.route.speedFactor);
      var durS = 2 * legS + c.handlingS * group.length;
      var whEst = c.whPerTrip * rt.route.energyFactor;

      // Robot that can finish this trip earliest.
      var best = null;
      fleet.forEach(function (f) {
        var needCharge = f.wh - whEst < c.reserveWh;
        var start = f.t + (needCharge ? c.chargeS : 0);
        if (!best || start < best.start) best = { f: f, start: start, needCharge: needCharge };
      });
      var f = best.f;
      var startS = best.start, etaS = startS + durS;
      f.wh = (best.needCharge ? c.fullWh : f.wh) - whEst;   // a dock charge window refills the pack first
      f.t = etaS;
      var late = group.some(function (g) { return g.req.deadlineS != null && etaS > g.req.deadlineS; });
      trips.push({
        order: trips.length + 1, robot: f.id, route: rt.route.id, routeLabel: rt.route.label, routeWhy: rt.why,
        startS: Math.round(startS), etaS: Math.round(etaS), whEst: +whEst.toFixed(1), chargeFirst: best.needCharge,
        onTime: !late,
        items: group.map(function (g) { return { id: g.req.id, item: g.req.item, category: g.req.category, cargo: g.req.cargo || (CATEGORIES[g.req.category] || {}).cargo, massKg: g.req.massKg, score: +g.s.score.toFixed(1), reason: reasonFor(g.req, g.s) }; })
      });
    }
    return {
      trips: trips,
      ranking: ranked.map(function (r) { return { id: r.req.id, score: +r.s.score.toFixed(1) }; }),
      order: [].concat.apply([], trips.map(function (t) { return t.items.map(function (i) { return i.id; }); })),
      lateCount: trips.filter(function (t) { return !t.onTime; }).length
    };
  }

  /** Five requests, one per category, in the order they happened to arrive (worst case for FIFO). */
  function demoRequests(nowS) {
    nowS = nowS || 0;
    return [
      { id: 'D1', item: 'Habitat consumables resupply',        category: 'supplies', massKg: 3.0, createdS: nowS - 1800 },
      { id: 'D2', item: 'Spectrometer for the geology team',  category: 'science',  massKg: 2.3, createdS: nowS - 1500 },
      { id: 'D3', item: 'Replacement battery packs',          category: 'battery',  massKg: 2.3, createdS: nowS - 1200, deadlineS: nowS + 2400 },
      { id: 'D4', item: 'Oxygen regeneration module',         category: 'life',     massKg: 2.5, createdS: nowS - 600,  deadlineS: nowS + 1500 },
      { id: 'D5', item: 'Pressure-seal repair kit',           category: 'repair',   massKg: 2.3, createdS: nowS - 60,   deadlineS: nowS + 1200 }
    ];
  }

  root.NASA_Dispatcher = { CATEGORIES: CATEGORIES, ROUTES: ROUTES, DEFAULTS: DEFAULTS, score: score, plan: plan, chooseRoute: chooseRoute, demoRequests: demoRequests };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NASA_Dispatcher;
})(typeof window !== 'undefined' ? window : globalThis);
