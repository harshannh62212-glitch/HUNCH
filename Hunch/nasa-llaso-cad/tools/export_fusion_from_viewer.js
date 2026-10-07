/**
 * Paste into Fusion share page console after model loads (NOP_VIEWER ready).
 * Posts OBJ parts to local serve.py: python3 serve.py 8002
 */
(function exportFusionRover() {
  var v = window.NOP_VIEWER;
  if (!v || !v.model) {
    console.error('NOP_VIEWER not ready');
    return;
  }
  var tree = v.model.getInstanceTree();
  var fl = v.model.getFragmentList();
  var MM = 0.001;
  var API = 'http://127.0.0.1:8002/api/mesh_export';

  function mat4() {
    var e = new Array(16);
    for (var i = 0; i < 16; i++) e[i] = 0;
    e[0] = e[5] = e[10] = e[15] = 1;
    return { elements: e };
  }

  function xform(m, x, y, z) {
    var e = m.elements;
    var wx = e[0] * x + e[4] * y + e[8] * z + e[12];
    var wy = e[1] * x + e[5] * y + e[9] * z + e[13];
    var wz = e[2] * x + e[6] * y + e[10] * z + e[14];
    return { x: wx * MM, y: wz * MM, z: -wy * MM };
  }

  function safeName(name) {
    return (name || 'part').replace(/[^\w.-]+/g, '_').replace(/^NASA_Hunch_Robot_?/, '') || 'part';
  }

  function exportNode(dbId, name) {
    var frags = [];
    tree.enumNodeFragments(dbId, function (fid) {
      frags.push(fid);
    }, false);
    if (!frags.length) return null;
    var lines = ['# ' + name, 'o ' + safeName(name)];
    var min = { x: 1e9, y: 1e9, z: 1e9 };
    var max = { x: -1e9, y: -1e9, z: -1e9 };
    var vcount = 0;
    frags.forEach(function (fid) {
      var g = fl.getGeometry(fid);
      if (!g || !g.vb || !g.ib) return;
      var wm = mat4();
      fl.getWorldMatrix(fid, wm);
      var stride = g.vbstride;
      var vb = g.vb;
      var ib = g.ib;
      for (var i = 0; i < ib.length; i += 3) {
        function vert(idx) {
          var o = idx * stride;
          return xform(wm, vb[o], vb[o + 1], vb[o + 2]);
        }
        var a = vert(ib[i]);
        var b = vert(ib[i + 1]);
        var c = vert(ib[i + 2]);
        [a, b, c].forEach(function (p) {
          min.x = Math.min(min.x, p.x);
          min.y = Math.min(min.y, p.y);
          min.z = Math.min(min.z, p.z);
          max.x = Math.max(max.x, p.x);
          max.y = Math.max(max.y, p.y);
          max.z = Math.max(max.z, p.z);
        });
        lines.push('v ' + a.x + ' ' + a.y + ' ' + a.z);
        lines.push('v ' + b.x + ' ' + b.y + ' ' + b.z);
        lines.push('v ' + c.x + ' ' + c.y + ' ' + c.z);
        var base = vcount;
        lines.push('f ' + (base + 1) + ' ' + (base + 2) + ' ' + (base + 3));
        vcount += 3;
      }
    });
    if (vcount < 3) return null;
    var cx = (min.x + max.x) * 0.5;
    var cy = (min.y + max.y) * 0.5;
    var cz = (min.z + max.z) * 0.5;
    return {
      name: safeName(name),
      obj: lines.join('\n'),
      bounds: {
        min: min,
        max: max,
        center: { x: cx, y: cy, z: cz },
        size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
      },
    };
  }

  var manifest = { parts: [], exportedAt: new Date().toISOString() };
  var root = tree.getRootId();

  function walk(id) {
    var name = tree.getNodeName(id);
    var kids = [];
    tree.enumNodeChildren(id, function (cid) {
      kids.push(cid);
    }, false);
    if (!kids.length) {
      var part = exportNode(id, name);
      if (part) manifest.parts.push(part);
      return;
    }
    kids.forEach(walk);
  }
  walk(root);

  var cx = 0;
  var cy = 0;
  var cz = 0;
  manifest.parts.forEach(function (p) {
    cx += p.bounds.center.x;
    cy += p.bounds.center.y;
    cz += p.bounds.center.z;
  });
  if (manifest.parts.length) {
    cx /= manifest.parts.length;
    cy /= manifest.parts.length;
    cz /= manifest.parts.length;
  }
  manifest.modelCenter = { x: cx, y: cy, z: cz };

  function post(path, body) {
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path, body: body }),
    });
  }

  var chain = Promise.resolve();
  manifest.parts.forEach(function (p) {
    chain = chain.then(function () {
      return post('meshes/fusion_rover/' + p.name + '.obj', p.obj);
    });
  });
  return chain
    .then(function () {
      return post(
        'meshes/fusion_rover/manifest.json',
        JSON.stringify(manifest, null, 2)
      );
    })
    .then(function () {
      console.log('Exported', manifest.parts.length, 'parts to meshes/fusion_rover/');
      return { count: manifest.parts.length, names: manifest.parts.map(function (p) { return p.name; }) };
    });
})();
