---
title: CAD, dock and website upgrades (v3.1)
date: 2026-10-25
tags: [cad, dock, animation, website, design-review]
aliases: [Motion upgrades, v3.1 upgrades]
---
# CAD, dock and website upgrades (v3.1)

What changed in the rover CAD, the dock station and the public site on 2026-10-25, why, and what to upgrade next. Read this before touching `js/motion.js`, `js/dock_station.js` (3D part), `js/fusion_rover.js` or the two CAD pages.

## 1. The motion rules (why the animations looked artificial)

The old pages moved everything at a constant rate or with an exponential lerp (`x += (target - x) * k * dt`). A constant rate starts and stops with a jolt; an exponential lerp starts at full speed and crawls at the end. Real hardware does neither. Everything now goes through `js/motion.js` (`window.NASA_Motion`):

| Primitive | Used for | Behaviour |
|---|---|---|
| `Actuator` (quintic) | lid, cover, clamp jaws, coupler, lidar spin-up | minimum-jerk move (zero velocity and acceleration at both ends); retargeting mid-move keeps position, velocity and acceleration continuous; optional compliance spring for a small settle |
| `Axis` | rover drive, garage-door opener, route marker on the site | velocity + acceleration limited, filtered acceleration (soft jerk), brakes on the v² = 2ad curve with lag compensation; tested: no overshoot at any frame rate |
| `ViaPath` | arm pick and place | joint-space quintics through via points with continuous velocity, stopping only where a stop is real (grasp, release) |
| `Spring` | body pitch and heave, door bounce, pogo-pin seat, jaw-pad squash, louvers | damped second-order follower, sub-stepped |
| `CameraRig` (`js/studio.js`) | every camera preset | moves along the orbit sphere with a min-jerk profile; duration scales with how far the view turns |

Rules of thumb:

- Motors: min-jerk, never linear. Peak speed is about 1.875 × the average, so size durations from the peak (`Actuator.duration`).
- Contact: add a transient (pads squash, pogo pins compress, a door hits its stop and bounces once).
- Heat and bimetal parts are slow: louvers swing over seconds, heater glow fades.
- Vehicles: wheels roll by distance travelled (`roll(d)`, 0.10 m radius), the body dives under braking and squats under throttle, pitch comes from where the wheels touch the ground.
- Idle turntable eases in after a pause and stops the moment the user touches the view.

## 2. What changed

### Rover CAD (`rover_model.html`, `js/fusion_rover.js`)

- New page layout (macOS inspector style) and studio lighting with a procedural environment map, so metal reads as metal.
- Demos: load or unload a pod with the arm (top-down grasp, turret swings over the hood), drive test (accelerate, cruise, brake, wheels rolling, suspension working), battery hot-swap bay (cam latches, gravity drop door with a damped stop, sled slides out), avionics lid on a gas strut, service cover.
- Finish switch: flight white thermal paint or the prototype's black PETG.
- Model: wrist-pitch knuckle added (the sim leaves `wrist.rotation.z = 0`); `roverRig` exposes `roll`, `setTravel`, `updateShocks`, `setFinish`.
- **Bug fixed:** the charge-bridge front legs (x = −0.10) intruded about 4.5 mm into both pod slots. Legs moved to x = −0.115, cross rails shortened. `tools/cad_model_check.js` now checks both slots and the current arm lengths: 21/21 pass.

### Dock station (`dock-station-cad.html`, `js/dock_station.js`)

- Clamp arms: fixed-length barrels with sliding rods (the old cylinders stretched with `scale`), a lead screw that spins with jaw speed, a nut that rides it, pad squash on contact.
- Coupler: a 3-stage scissor lift replaces the stretching column; the head only floats sideways near the pad; pogo pins seat with a small dip; magnet rings glow as the hall array locks on; the status LED breathes while charging.
- Door: opener-driven (`rig.drive(target, dt)`, about 3.5 s, soft start and stop) with a torsion drum that turns, a trolley on a rigid drawbar, a lintel, a courtesy light and an amber motion beacon. `rig.set()` still works for scripted poses.
- Page: full docking cycle (depart, reverse out, approach with a lateral correction, square up at the gate, enter, capture, latch, charge, door closes), wheel roll, ramp pitch from wheel contact, roof cutaway that fades, 4 PV panels, hazard-stripe ramp, step list that tracks the state.
- Controller is unchanged: `tools/dock_controller_test.js` 300/300.

### Simulator (`viewer.html`)

- Loads `js/motion.js`; the hangar door uses `dockDoorRig.drive()` (it used to open 80 % in about 0.4 s).
- Wheel spin used a 0.09 m radius; the rolling radius is 0.10 m, so wheels spun 11 % fast. Fixed, including the rpm readout.
- Dampers were re-aimed upside down relative to how they were built (body at the wheel end). Fixed.

### Website (`index.html`, `app.js`, `styles.css`)

- Rebuilt as a Mac App Store product page: sidebar, app icon, info strip, live 3D preview (embeds the CAD pages with `?embed=1`), screenshot shelf, What's New, Version History, team, Information grid, light and dark mode.
- **Bugs fixed:** links to `127.0.0.1` (dead for every visitor), `lucide@latest` (unpinned script), the Tailwind play CDN in production, "lunar mass = mass ÷ 6" (mass does not change; the page now shows weight in newtons and its Earth-feel), a fake centre-of-gravity number (now computed from bay positions), BOM claims that disagreed with `rover_bom.js` (rocker-bogie, Pi 5, 10 Ah).
- Added `.vercelignore` so the deploy carries the site and the CAD pages but not the virtualenv, logs, checkpoints or backups.

## 3. Open questions for the team

1. **Dock PV (resolved Oct 2026):** the code's 4 × 70 W panels (266 W bus) are the configuration of record; the dock BOM was updated to match. The website should be checked against it.
2. **Website status:** the site still says *Planning · Phase 1*. With the CAD, dock and simulator running, Phase 2 may be the honest label.
3. **Night survival (resolved Oct 2026):** the code's 1280 Wh buffer covers about 488 h at 2.1 W, which beats the 354 h night. Remaining risk: LiFePO4 cannot charge below 0 °C, so the code now blocks charging when the warm box is cold; confirm the heated box on hardware.

## 4. Next upgrades (in priority order)

1. **Sim arm motion** (`js/lunar_logistics.js`): it plays one quintic per waypoint and stops at every one. Swap `playTraj` for `NASA_Motion.ViaPath` and keep the gripper level with the new wrist joint (the CAD page already does both).
2. **Dock swap robot:** the pack swap is a 25 s timer. Model the gantry that meets the rover's battery sled so the swap is visible in the dock CAD and the sim.
3. **Door safety:** add a photo-eye and an obstruction reverse to the door state (real openers must have one; judges will ask).
4. **Draw calls:** the rover is several hundred small meshes. Merge static parts per material (`BufferGeometryUtils.mergeBufferGeometries`) for weaker laptops and the website embed.
5. **Louvers from temperature:** drive louver angle from the thermal model instead of a day/night switch.
6. **Exploded view** on the rover page with staggered min-jerk offsets per subsystem.
7. **Ramp transition:** the dock entry ramp has a sharp crease at both ends; a short radius would remove the pitch kick on hardware too.

## 5. How to check after a change

```bash
cd Hunch/nasa-llaso-cad
node tools/cad_model_check.js         # geometry: 21 checks
node tools/dock_controller_test.js 300 # dock controller with a mock plant
python3 serve.py 8002                  # then open rover_model.html, dock-station-cad.html, viewer.html?selftest=dock&n=5
```

Related: [Dock station design](dock-station-design.md) · [Runtime and energy analysis](runtime-energy-analysis.md) · [Test plan](test-plan.md)
