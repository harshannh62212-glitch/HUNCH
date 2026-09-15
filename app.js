// NASA HUNCH LLASO-02 // External Cargo Transport Robot
// Engineering & Interactive Mission Controller

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- AUDIO SYNTHESIZER (Web Audio API for UI Beeps/Hums) ---
  let audioContext = null;
  let audioEnabled = true;

  const initAudio = () => {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    }
  };

  const playBeep = (freq = 880, type = 'sine', duration = 0.08) => {
    if (!audioEnabled) return;
    try {
      initAudio();
      if (!audioContext) return;
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioContext.currentTime);
      gain.gain.setValueAtTime(0.04, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + duration);
    } catch (e) {
      console.warn('Audio feedback error', e);
    }
  };

  const audioToggleBtn = document.getElementById('audio-toggle-btn');
  const audioIcon = document.getElementById('audio-icon');
  const audioLabel = document.getElementById('audio-label');

  if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      if (audioEnabled) {
        audioLabel.textContent = 'FX ON';
        audioToggleBtn.classList.remove('text-slate-500', 'border-slate-800');
        audioToggleBtn.classList.add('text-slate-300', 'border-slate-700');
        playBeep(1200, 'sine', 0.1);
      } else {
        audioLabel.textContent = 'FX OFF';
        audioToggleBtn.classList.remove('text-slate-300', 'border-slate-700');
        audioToggleBtn.classList.add('text-slate-500', 'border-slate-800');
      }
    });
  }

  // Add click sound to all interactive buttons
  document.querySelectorAll('button, a, input[type="checkbox"]').forEach(el => {
    el.addEventListener('click', () => playBeep(650, 'triangle', 0.05));
  });

  // --- 1. THREE.JS 3D ROBOT CAD VIEWER ---
  const canvas = document.getElementById('rover-canvas');
  if (canvas && window.THREE) {
    initThreeJSRover(canvas);
  }

  function initThreeJSRover(canvasEl) {
    const container = canvasEl.parentElement;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070e);
    scene.fog = new THREE.FogExp2(0x05070e, 0.035);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(11, 7, 13);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
      alpha: false
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Orbit Controls
    const controls = new THREE.OrbitControls(camera, canvasEl);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.02; // prevent going below lunar surface
    controls.minDistance = 5;
    controls.maxDistance = 35;
    controls.target.set(0, 1.2, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
    sunLight.position.set(15, 25, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.camera.left = -10;
    sunLight.shadow.camera.right = 10;
    sunLight.shadow.camera.top = 10;
    sunLight.shadow.camera.bottom = -10;
    scene.add(sunLight);

    // Subtle blue rim light from opposite angle
    const rimLight = new THREE.DirectionalLight(0x00f0ff, 0.9);
    rimLight.position.set(-15, 10, -15);
    scene.add(rimLight);

    // Lunar Ground Plane
    const groundGeo = new THREE.CylinderGeometry(18, 18, 0.4, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Surface Grid Wire
    const gridHelper = new THREE.GridHelper(36, 36, 0x00f0ff, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Robot Root Group & Subsystem Groups
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    const chassisGroup = new THREE.Group();
    const wheelsGroup = new THREE.Group();
    const cargoGroup = new THREE.Group();
    const lidarGroup = new THREE.Group();
    robotGroup.add(chassisGroup);
    robotGroup.add(wheelsGroup);
    robotGroup.add(cargoGroup);
    robotGroup.add(lidarGroup);

    // Material definitions
    const materials = {
      chassisDark: new THREE.MeshStandardMaterial({
        color: 0x172033,
        roughness: 0.4,
        metalness: 0.7
      }),
      titaniumBumper: new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.25,
        metalness: 0.85
      }),
      cyanGlow: new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.8,
        roughness: 0.2
      }),
      wheelTitanium: new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.5,
        metalness: 0.85
      }),
      cargoContainer: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.3,
        metalness: 0.4
      }),
      cargoAccents: new THREE.MeshStandardMaterial({
        color: 0x0b3d91,
        roughness: 0.3,
        metalness: 0.5
      }),
      amberAlert: new THREE.MeshStandardMaterial({
        color: 0xffb800,
        emissive: 0xffb800,
        emissiveIntensity: 0.6
      }),
      solarCell: new THREE.MeshStandardMaterial({
        color: 0x082f49,
        roughness: 0.1,
        metalness: 0.95
      })
    };

    // Store all standard meshes for wireframe toggle
    const allMeshes = [];

    // --- 1. CHASSIS BUILDING ---
    // Main base body
    const mainBodyGeo = new THREE.BoxGeometry(4.6, 0.7, 2.8);
    const mainBody = new THREE.Mesh(mainBodyGeo, materials.chassisDark);
    mainBody.position.y = 1.3;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    chassisGroup.add(mainBody);
    allMeshes.push(mainBody);

    // Front wedge bumper
    const bumperGeo = new THREE.BoxGeometry(0.5, 0.6, 2.9);
    const frontBumper = new THREE.Mesh(bumperGeo, materials.titaniumBumper);
    frontBumper.position.set(2.4, 1.3, 0);
    frontBumper.castShadow = true;
    chassisGroup.add(frontBumper);
    allMeshes.push(frontBumper);

    // Rear bumper
    const rearBumper = new THREE.Mesh(bumperGeo, materials.titaniumBumper);
    rearBumper.position.set(-2.4, 1.3, 0);
    rearBumper.castShadow = true;
    chassisGroup.add(rearBumper);
    allMeshes.push(rearBumper);

    // Skid plates / Underbelly
    const skidGeo = new THREE.BoxGeometry(4.4, 0.15, 2.5);
    const skidPlate = new THREE.Mesh(skidGeo, materials.titaniumBumper);
    skidPlate.position.y = 0.9;
    skidPlate.castShadow = true;
    chassisGroup.add(skidPlate);
    allMeshes.push(skidPlate);

    // Chassis Side Neon Telemetry Strip
    const stripGeo = new THREE.BoxGeometry(4.0, 0.06, 0.05);
    const stripL = new THREE.Mesh(stripGeo, materials.cyanGlow);
    stripL.position.set(0, 1.3, 1.42);
    const stripR = new THREE.Mesh(stripGeo, materials.cyanGlow);
    stripR.position.set(0, 1.3, -1.42);
    chassisGroup.add(stripL, stripR);
    allMeshes.push(stripL, stripR);

    // --- 2. ROCKER-BOGIE WHEELS & SUSPENSION (6 Wheels) ---
    const wheelMeshes = [];
    const wheelPositions = [
      { x: 2.1, z: 1.85 },  // Front Left
      { x: 0.0, z: 1.95 },  // Mid Left
      { x: -2.1, z: 1.85 }, // Rear Left
      { x: 2.1, z: -1.85 }, // Front Right
      { x: 0.0, z: -1.95 }, // Mid Right
      { x: -2.1, z: -1.85 } // Rear Right
    ];

    wheelPositions.forEach((pos, idx) => {
      const wheelAssembly = new THREE.Group();
      wheelAssembly.position.set(pos.x, 0.7, pos.z);

      // Wheel cylinder (compliant mesh design)
      const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 32);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheel = new THREE.Mesh(wheelGeo, materials.wheelTitanium);
      wheel.castShadow = true;
      wheel.receiveShadow = true;
      wheelAssembly.add(wheel);
      allMeshes.push(wheel);
      wheelMeshes.push(wheel);

      // Hub Cap & Motor housing
      const hubGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.54, 16);
      hubGeo.rotateZ(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeo, materials.chassisDark);
      wheelAssembly.add(hub);
      allMeshes.push(hub);

      // Wheel Rim Glow Accent
      const rimRingGeo = new THREE.TorusGeometry(0.68, 0.03, 8, 32);
      rimRingGeo.rotateY(Math.PI / 2);
      const rim = new THREE.Mesh(rimRingGeo, materials.cyanGlow);
      wheelAssembly.add(rim);
      allMeshes.push(rim);

      // Rocker Strut linking to chassis
      const strutGeo = new THREE.BoxGeometry(0.15, 0.7, 0.15);
      const strut = new THREE.Mesh(strutGeo, materials.titaniumBumper);
      const zDir = pos.z > 0 ? -1 : 1;
      strut.position.set(0, 0.35, zDir * 0.25);
      strut.rotation.x = zDir * 0.3;
      strut.castShadow = true;
      wheelAssembly.add(strut);
      allMeshes.push(strut);

      wheelsGroup.add(wheelAssembly);
    });

    // --- 3. CARGO BED & PAYLOAD CONTAINER ---
    // Roller bed deck
    const bedGeo = new THREE.BoxGeometry(3.6, 0.15, 2.2);
    const cargoBed = new THREE.Mesh(bedGeo, materials.titaniumBumper);
    cargoBed.position.set(-0.3, 1.7, 0);
    cargoBed.castShadow = true;
    cargoGroup.add(cargoBed);
    allMeshes.push(cargoBed);

    // Bed Rails
    const railGeo = new THREE.BoxGeometry(3.6, 0.3, 0.1);
    const railL = new THREE.Mesh(railGeo, materials.chassisDark);
    railL.position.set(-0.3, 1.85, 1.1);
    const railR = new THREE.Mesh(railGeo, materials.chassisDark);
    railR.position.set(-0.3, 1.85, -1.1);
    cargoGroup.add(railL, railR);
    allMeshes.push(railL, railR);

    // Standard HUNCH Lunar Payload Box
    const containerGeo = new THREE.BoxGeometry(2.6, 1.3, 1.9);
    const payloadContainer = new THREE.Mesh(containerGeo, materials.cargoContainer);
    payloadContainer.position.set(-0.3, 2.45, 0);
    payloadContainer.castShadow = true;
    payloadContainer.receiveShadow = true;
    cargoGroup.add(payloadContainer);
    allMeshes.push(payloadContainer);

    // Container Stripes / NASA HUNCH Accent Bands
    const stripeGeo = new THREE.BoxGeometry(2.64, 0.3, 1.94);
    const containerStripe = new THREE.Mesh(stripeGeo, materials.cargoAccents);
    containerStripe.position.set(-0.3, 2.45, 0);
    cargoGroup.add(containerStripe);
    allMeshes.push(containerStripe);

    // Container Latch Clamp
    const clampGeo = new THREE.BoxGeometry(0.2, 0.4, 2.0);
    const clampFront = new THREE.Mesh(clampGeo, materials.amberAlert);
    clampFront.position.set(1.05, 2.3, 0);
    const clampRear = new THREE.Mesh(clampGeo, materials.amberAlert);
    clampRear.position.set(-1.65, 2.3, 0);
    cargoGroup.add(clampFront, clampRear);
    allMeshes.push(clampFront, clampRear);

    // --- 4. SENSOR MAST, LIDAR, & COMMUNICATIONS ---
    // Mast vertical pillar
    const mastGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.6, 16);
    const mast = new THREE.Mesh(mastGeo, materials.titaniumBumper);
    mast.position.set(1.7, 2.4, 0);
    mast.castShadow = true;
    lidarGroup.add(mast);
    allMeshes.push(mast);

    // Pan-tilt sensor head
    const headGeo = new THREE.BoxGeometry(0.4, 0.3, 0.7);
    const sensorHead = new THREE.Mesh(headGeo, materials.chassisDark);
    sensorHead.position.set(1.7, 3.2, 0);
    sensorHead.castShadow = true;
    lidarGroup.add(sensorHead);
    allMeshes.push(sensorHead);

    // Stereo camera lenses (Dual cyan circles)
    const lensGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 16);
    lensGeo.rotateZ(Math.PI / 2);
    const lensL = new THREE.Mesh(lensGeo, materials.cyanGlow);
    lensL.position.set(1.9, 3.2, 0.2);
    const lensR = new THREE.Mesh(lensGeo, materials.cyanGlow);
    lensR.position.set(1.9, 3.2, -0.2);
    lidarGroup.add(lensL, lensR);
    allMeshes.push(lensL, lensR);

    // Rotating 360-Degree LIDAR Puck
    const lidarPuckGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.22, 24);
    const lidarPuck = new THREE.Mesh(lidarPuckGeo, materials.chassisDark);
    lidarPuck.position.set(1.7, 3.45, 0);
    lidarGroup.add(lidarPuck);
    allMeshes.push(lidarPuck);

    // LIDAR scanning ring
    const lidarRingGeo = new THREE.TorusGeometry(0.19, 0.02, 8, 24);
    lidarRingGeo.rotateX(Math.PI / 2);
    const lidarRing = new THREE.Mesh(lidarRingGeo, materials.cyanGlow);
    lidarPuck.add(lidarRing);
    allMeshes.push(lidarRing);

    // High Gain Antenna Dish (Targeting Earth)
    const dishGeo = new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5);
    const dish = new THREE.Mesh(dishGeo, materials.titaniumBumper);
    dish.position.set(-1.8, 2.8, -0.9);
    dish.rotation.x = -Math.PI / 3;
    dish.rotation.z = Math.PI / 5;
    dish.castShadow = true;
    lidarGroup.add(dish);
    allMeshes.push(dish);

    // --- CONTROLS & INTERACTION LOGIC ---
    let isWireframe = false;
    let isExploded = false;
    const btnWireframe = document.getElementById('btn-wireframe');
    const btnExplode = document.getElementById('btn-explode');
    const btnResetCam = document.getElementById('btn-reset-cam');

    // Wireframe Toggle
    if (btnWireframe) {
      btnWireframe.addEventListener('click', () => {
        isWireframe = !isWireframe;
        allMeshes.forEach(mesh => {
          if (mesh.material) {
            mesh.material.wireframe = isWireframe;
          }
        });
        btnWireframe.innerHTML = `<i data-lucide="box" class="w-3.5 h-3.5"></i><span>Wireframe: ${isWireframe ? 'ON' : 'OFF'}</span>`;
        if (window.lucide) window.lucide.createIcons();
        if (isWireframe) {
          btnWireframe.classList.add('border-cyan', 'text-cyan');
        } else {
          btnWireframe.classList.remove('border-cyan', 'text-cyan');
        }
      });
    }

    // Exploded View Toggle
    if (btnExplode) {
      btnExplode.addEventListener('click', () => {
        isExploded = !isExploded;
        btnExplode.innerHTML = `<i data-lucide="layers" class="w-3.5 h-3.5"></i><span>Exploded View: ${isExploded ? 'ON' : 'OFF'}</span>`;
        if (window.lucide) window.lucide.createIcons();
        if (isExploded) {
          btnExplode.classList.add('border-cyan', 'text-cyan');
        } else {
          btnExplode.classList.remove('border-cyan', 'text-cyan');
        }
      });
    }

    // Reset Camera Button
    if (btnResetCam) {
      btnResetCam.addEventListener('click', () => {
        camera.position.set(11, 7, 13);
        controls.target.set(0, 1.2, 0);
        controls.update();
      });
    }

    // Subsystem Selection & Highlights
    const partDescriptions = {
      chassis: {
        tag: 'CHASSIS & LOWER FRAME',
        desc: 'Reinforced carbon-composite & titanium truss frame with high-yield bumper geometry engineered to shield batteries against high-velocity lunar ejecta.'
      },
      wheels: {
        tag: 'ROCKER-BOGIE LOCOMOTION',
        desc: 'Passive 6-wheel articulated rocker-bogie mechanism with titanium compliant spring tires providing zero-slip traction across jagged lunar craters.'
      },
      cargobay: {
        tag: 'CARGO DOCKING BED',
        desc: 'Dual-rail roller bed with high-retention magnetic lock clamps designed to secure up to 500 kg standard NASA HUNCH lunar supply containers.'
      },
      lidar: {
        tag: 'PERCEPTION & AVIONICS MAST',
        desc: 'High-frequency rotating flash LIDAR + stereoscopic hazard cameras providing real-time 3D depth point clouds for autonomous lunar SLAM navigation.'
      }
    };

    const partButtons = document.querySelectorAll('.part-btn');
    const activePartTag = document.getElementById('active-part-tag');
    const partDescription = document.getElementById('part-description');

    partButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const part = btn.dataset.part;
        partButtons.forEach(b => {
          b.className = 'part-btn px-2 py-1 rounded text-left border border-slate-700 bg-space-850 text-slate-300 hover:text-white';
        });
        btn.className = 'part-btn px-2 py-1 rounded text-left border border-cyan/40 bg-cyan/15 text-cyan hover:bg-cyan/20';

        if (partDescriptions[part]) {
          activePartTag.textContent = partDescriptions[part].tag;
          partDescription.textContent = partDescriptions[part].desc;
        }

        // Camera focus transition
        if (part === 'chassis') {
          controls.target.set(0, 1.2, 0);
        } else if (part === 'wheels') {
          controls.target.set(0, 0.7, 1.2);
        } else if (part === 'cargobay') {
          controls.target.set(-0.3, 2.2, 0);
        } else if (part === 'lidar') {
          controls.target.set(1.7, 3.2, 0);
        }
        controls.update();
      });
    });

    // Resize handler
    window.addEventListener('resize', () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // Animation Loop
    let clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Rotate LIDAR puck continuously
      if (lidarPuck) {
        lidarPuck.rotation.y += 2.5 * delta;
      }

      // Exploded View Lerping
      const targetCargoY = isExploded ? 1.6 : 0;
      const targetLidarY = isExploded ? 0.8 : 0;
      const targetLidarX = isExploded ? 0.6 : 0;
      const targetWheelsZ = isExploded ? 0.6 : 0;

      cargoGroup.position.y += (targetCargoY - cargoGroup.position.y) * 0.1;
      lidarGroup.position.y += (targetLidarY - lidarGroup.position.y) * 0.1;
      lidarGroup.position.x += (targetLidarX - lidarGroup.position.x) * 0.1;

      // Subtle float oscillation
      robotGroup.position.y = Math.sin(elapsed * 1.5) * 0.03;

      controls.update();
      renderer.render(scene, camera);
    }

    animate();
  }

  // --- 2. LUNAR SURFACE ROUTE SIMULATOR ---
  const simToggleBtn = document.getElementById('btn-sim-toggle');
  const simResetBtn = document.getElementById('btn-sim-reset');
  const simIcon = document.getElementById('sim-icon');
  const simBtnText = document.getElementById('sim-btn-text');

  const roverMarker = document.getElementById('rover-sim-marker');
  const simProgressBar = document.getElementById('sim-progress-bar');
  const simDistText = document.getElementById('sim-dist-text');
  const simPctText = document.getElementById('sim-pct-text');

  const metricSpeed = document.getElementById('metric-speed');
  const metricSlope = document.getElementById('metric-slope');
  const metricHazard = document.getElementById('metric-hazard');
  const metricEta = document.getElementById('metric-eta');

  const wp1 = document.getElementById('wp-1');
  const wp2 = document.getElementById('wp-2');
  const wp3 = document.getElementById('wp-3');

  let isSimRunning = false;
  let simProgress = 0; // 0 to 1
  let simAnimId = null;
  const TOTAL_DISTANCE_METERS = 850;

  // SVG Waypoint coordinates along path
  const startX = 60, startY = 170;
  const midX = 360, midY = 145;
  const endX = 740, endY = 140;

  const updateSimUI = () => {
    // Current meters
    const currentMeters = Math.round(simProgress * TOTAL_DISTANCE_METERS);
    const pct = Math.round(simProgress * 100);

    simProgressBar.style.width = `${pct}%`;
    simDistText.textContent = `${currentMeters} m / ${TOTAL_DISTANCE_METERS} m`;
    simPctText.textContent = `${pct}%`;

    // Position marker along bezier path roughly
    let currX, currY;
    if (simProgress <= 0.5) {
      const t = simProgress * 2;
      currX = startX + (midX - startX) * t;
      currY = startY + (midY - startY) * t - Math.sin(t * Math.PI) * 20;
    } else {
      const t = (simProgress - 0.5) * 2;
      currX = midX + (endX - midX) * t;
      currY = midY + (endY - midY) * t + Math.sin(t * Math.PI) * 10;
    }

    if (roverMarker) {
      roverMarker.setAttribute('transform', `translate(${currX}, ${currY})`);
    }

    // Dynamic metrics based on progress
    if (simProgress === 0) {
      metricSpeed.textContent = '0.0 km/h';
      metricSlope.textContent = '+2.4° (Nominal)';
      metricHazard.textContent = 'CLEAR (> 60m)';
      metricHazard.className = 'text-emerald-400 font-bold';
      metricEta.textContent = '--:--';
    } else if (simProgress < 0.98) {
      metricSpeed.textContent = (4.8 + Math.sin(simProgress * 20) * 0.7).toFixed(1) + ' km/h';

      // Approaching Crater 14-B hazard zone
      if (simProgress > 0.28 && simProgress < 0.45) {
        metricSlope.textContent = '+8.1° (Ascent Ridge)';
        metricHazard.textContent = 'CAUTION: Crater 14-B (22m)';
        metricHazard.className = 'text-amber-400 font-bold animate-pulse';
      } else if (simProgress > 0.58 && simProgress < 0.75) {
        metricSlope.textContent = '-3.6° (Descent Flank)';
        metricHazard.textContent = 'AVOIDING: Boulder Field';
        metricHazard.className = 'text-amber-300 font-bold';
      } else {
        metricSlope.textContent = '+1.8° (Nominal)';
        metricHazard.textContent = 'CLEAR (> 50m)';
        metricHazard.className = 'text-emerald-400 font-bold';
      }

      const remainingSeconds = Math.max(0, Math.round((1 - simProgress) * 640));
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      metricEta.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      metricSpeed.textContent = '0.0 km/h (Docked)';
      metricSlope.textContent = '0.0° (Pad Level)';
      metricHazard.textContent = 'AIRLOCK DOCKED';
      metricHazard.className = 'text-emerald-400 font-bold';
      metricEta.textContent = '00:00';
    }

    // Waypoint status highlights
    if (simProgress < 0.1) {
      wp1.className = 'p-2 rounded bg-cyan/10 border border-cyan/30 text-cyan flex justify-between items-center';
      wp2.className = 'p-2 rounded bg-space-900 border border-slate-800 text-slate-400 flex justify-between items-center';
      wp3.className = 'p-2 rounded bg-space-900 border border-slate-800 text-slate-400 flex justify-between items-center';
    } else if (simProgress < 0.85) {
      wp1.className = 'p-2 rounded bg-space-900 border border-slate-800 text-slate-400 flex justify-between items-center';
      wp2.className = 'p-2 rounded bg-amber-400/10 border border-amber-400/40 text-amber-300 flex justify-between items-center';
      wp3.className = 'p-2 rounded bg-space-900 border border-slate-800 text-slate-400 flex justify-between items-center';
    } else {
      wp1.className = 'p-2 rounded bg-space-900 border border-slate-800 text-slate-400 flex justify-between items-center';
      wp2.className = 'p-2 rounded bg-space-900 border border-slate-800 text-slate-400 flex justify-between items-center';
      wp3.className = 'p-2 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex justify-between items-center';
    }
  };

  const simStep = () => {
    if (!isSimRunning) return;
    simProgress += 0.0018;
    if (simProgress >= 1) {
      simProgress = 1;
      isSimRunning = false;
      simBtnText.textContent = 'TRANSIT COMPLETE';
      simIcon.setAttribute('data-lucide', 'check-circle');
      if (window.lucide) window.lucide.createIcons();
    }
    updateSimUI();
    if (isSimRunning) {
      simAnimId = requestAnimationFrame(simStep);
    }
  };

  if (simToggleBtn) {
    simToggleBtn.addEventListener('click', () => {
      if (simProgress >= 1) {
        simProgress = 0;
      }
      isSimRunning = !isSimRunning;
      if (isSimRunning) {
        simBtnText.textContent = 'PAUSE SIM';
        simIcon.setAttribute('data-lucide', 'pause');
        simStep();
      } else {
        simBtnText.textContent = 'RESUME SIM';
        simIcon.setAttribute('data-lucide', 'play');
        cancelAnimationFrame(simAnimId);
      }
      if (window.lucide) window.lucide.createIcons();
    });
  }

  if (simResetBtn) {
    simResetBtn.addEventListener('click', () => {
      isSimRunning = false;
      simProgress = 0;
      cancelAnimationFrame(simAnimId);
      simBtnText.textContent = 'START TRANSIT SIM';
      simIcon.setAttribute('data-lucide', 'play');
      if (window.lucide) window.lucide.createIcons();
      updateSimUI();
    });
  }

  // --- 3. CARGO BAY PAYLOAD & DYNAMICS CALCULATOR ---
  const cargoCheckboxes = document.querySelectorAll('.cargo-checkbox');
  const calcEarthMass = document.getElementById('calc-earth-mass');
  const calcLunarWeight = document.getElementById('calc-lunar-weight');
  const calcPct = document.getElementById('calc-pct');
  const calcCapacityBar = document.getElementById('calc-capacity-bar');
  const calcStatusBadge = document.getElementById('calc-status-badge');
  const calcCog = document.getElementById('calc-cog');
  const calcPower = document.getElementById('calc-power');

  const updateCargoCalculator = () => {
    let totalEarthKg = 0;
    let totalPowerKwh = 0;
    let selectedCount = 0;

    cargoCheckboxes.forEach(cb => {
      if (cb.checked) {
        totalEarthKg += parseFloat(cb.dataset.mass || 0);
        totalPowerKwh += parseFloat(cb.dataset.power || 0);
        selectedCount++;
      }
    });

    const lunarGravityFactor = 1.62; // m/s^2 (Earth is 9.80665)
    const lunarEquivalentKg = totalEarthKg / 6;
    const lunarNewtons = totalEarthKg * lunarGravityFactor;
    const maxCapacityKg = 500;
    const capacityPct = Math.min(100, ((totalEarthKg / maxCapacityKg) * 100)).toFixed(1);

    calcEarthMass.textContent = `${totalEarthKg.toFixed(1)} kg`;
    calcLunarWeight.textContent = `${lunarEquivalentKg.toFixed(1)} kg (${lunarNewtons.toFixed(1)} N)`;
    calcPct.textContent = `${capacityPct}%`;
    calcCapacityBar.style.width = `${capacityPct}%`;
    calcPower.textContent = `${(totalPowerKwh + 1.2).toFixed(1)} kWh`;

    // Status styling
    if (totalEarthKg > maxCapacityKg) {
      calcStatusBadge.textContent = 'OVERLOAD HAZARD';
      calcStatusBadge.className = 'text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold';
      calcCapacityBar.className = 'bg-rose-500 h-full transition-all duration-300';
      calcCog.textContent = 'UNSTABLE (Critical CoG shift)';
      calcCog.className = 'text-rose-400 font-bold';
    } else if (totalEarthKg === 0) {
      calcStatusBadge.textContent = 'EMPTY BAY';
      calcStatusBadge.className = 'text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold';
      calcCapacityBar.className = 'bg-slate-700 h-full transition-all duration-300';
      calcCog.textContent = '0.0 cm (Neutral)';
      calcCog.className = 'text-slate-400 font-bold';
    } else {
      calcStatusBadge.textContent = 'BALANCED';
      calcStatusBadge.className = 'text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold';
      calcCapacityBar.className = 'bg-gradient-to-r from-cyan to-amber-400 h-full transition-all duration-300';
      calcCog.textContent = `+${(0.8 + selectedCount * 0.4).toFixed(1)} cm (Optimal)`;
      calcCog.className = 'text-emerald-400 font-bold';
    }
  };

  cargoCheckboxes.forEach(cb => {
    cb.addEventListener('change', updateCargoCalculator);
  });
  updateCargoCalculator();

  // --- 4. OPERATING MODE SELECTOR ---
  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => {
        b.className = 'mode-btn px-2 py-1 text-[11px] rounded bg-space-850 border border-slate-700 text-slate-400 hover:text-white';
      });
      btn.className = 'mode-btn px-2 py-1 text-[11px] rounded bg-cyan/20 border border-cyan text-cyan font-bold';
    });
  });

  // --- 5. BACKGROUND TELEMETRY FLICKER SIMULATION ---
  const telemetryBatteryText = document.getElementById('telemetry-battery-text');
  const telemetryDustText = document.getElementById('telemetry-dust-text');

  setInterval(() => {
    if (telemetryBatteryText) {
      const base = 98.4;
      const jitter = (Math.random() * 0.08 - 0.04).toFixed(2);
      telemetryBatteryText.textContent = `${(base + parseFloat(jitter)).toFixed(2)}%`;
    }
    if (telemetryDustText) {
      const dustVal = (0.04 + Math.random() * 0.015).toFixed(3);
      telemetryDustText.textContent = `${dustVal} mg/m²`;
    }
  }, 3500);

});
