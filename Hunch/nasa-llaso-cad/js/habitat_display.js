/**
 * Crew monitor on the habitat wall beside the airlock. It shows the rover's mast camera
 * so crew can watch the approach without going outside (no EVA). Updated about 5 times a second.
 * Call NASA_HabitatDisplay.update(dt) every frame (the logistics tick does this).
 */
(function () {
  var rt = null, screen = null, group = null, acc = 0, built = false, label = null;
  var FPS = 5;

  function labelTex(text, sub) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 96;
    var x = c.getContext('2d');
    x.fillStyle = '#0f172a'; x.fillRect(0, 0, 512, 96);
    x.fillStyle = '#fbbf24'; x.font = 'bold 34px monospace'; x.fillText(text, 16, 40);
    x.fillStyle = '#94a3b8'; x.font = '24px monospace'; x.fillText(sub, 16, 76);
    return new THREE.CanvasTexture(c);
  }

  function build() {
    var wall = scene.getObjectByName('airlockWall');
    if (!wall) return false;
    var wp = new THREE.Vector3(); wall.getWorldPosition(wp);
    rt = new THREE.WebGLRenderTarget(256, 192);
    group = new THREE.Group();
    // Mounted on the +x face of the wall, on the jamb to the left of the airlock opening.
    group.position.set(wp.x + 0.05, wp.y + 1.12, wp.z - 0.66);
    group.rotation.y = Math.PI / 2;
    var frame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.04), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.6 }));
    group.add(frame);
    screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.375), new THREE.MeshBasicMaterial({ map: rt.texture }));
    screen.position.z = 0.022;
    group.add(screen);
    label = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.094), new THREE.MeshBasicMaterial({ map: labelTex('CREW MONITOR', 'ROVER MASTCAM - LIVE') }));
    label.position.set(0, 0.28, 0.022);
    group.add(label);
    scene.add(group);
    built = true;
    return true;
  }

  window.NASA_HabitatDisplay = {
    update: function (dt) {
      if (!built && !build()) return;
      acc += dt;
      if (acc < 1 / FPS) return;
      acc = 0;
      if (typeof piCamera === 'undefined' || typeof renderer === 'undefined') return;
      screen.visible = false; label.visible = false;
      var prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(scene, piCamera);
      renderer.setRenderTarget(prev);
      screen.visible = true; label.visible = true;
    },
    built: function () { return built; },
    object: function () { return group; }
  };
})();
