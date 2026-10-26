---
title: "Mission coverage (LLASO-P2-XPORT-2026)"
date: 2026-10-26
tags: [review, missions]
---
# Mission coverage

Status of each HUNCH mission against the simulator. "Partial" means the code exists but is not yet scored or demonstrated end to end. Statuses come from a code review, not from a full run of every mission.

| # | Mission | Status | Where |
| :--- | :--- | :--- | :--- |
| 0 | Start-up rocket landing (added) | Done | `js/intro_landing.js`, hooked in `viewer.html` |
| 1 | First drive | Met | `missionDrive` in `js/lunar_logistics.js` |
| 2 | Find and approach cargo | Partial | `goToLander` |
| 3 | Pick up and secure a pod | Met in sim: stability tracked (starts, stops, turns, tip margin, tilt) and scored, tip gate slows the rover | `js/mission_scoring.js`, `pickupCargo` |
| 4 | Transport over terrain | Met | `js/terrain.js`, `js/rover_dynamics.js` |
| 5 | Deliver and place | Met in sim: placement error scored against 10 cm; dust collar must seal before the hatch opens | `dropCargo`, `buildReceivingDoor` |
| 6 | Full logistics cycle | Met in sim: report with sim time, distance, Wh, placement, seal, stability; included in the metrics JSON export | `emitReport` |
| 7 | 2 km route | Met in sim at 1:25 scale: from just outside the plume blast zone, AEGIS-1 drove itself 97.6 m (2.44 km scaled) to the habitat around the plume zone and 3 restricted zones, 0 zone violations, 1.2 m minimum clearance, 13.9° steepest grade (limit 20°). One run only. Zones are circles added to the route planner; the 2 km figure is scaled, not driven | `js/supply_route.js`, `tools/supply_route_test.js`; command `route` |
| 8 | Three cargo systems | Met in sim: pod, cylinder and 20 ft container (scaled to the arm's reach, about 16 cm tall) share one grapple bail; the cradle adapts clamp span and saddle; `cargo <type>` command. Each type was picked, carried and delivered once: placement error 9.5 cm (pod), 10.1 cm (cylinder, just outside the 10 cm limit), 9.9 cm (container) | `js/cargo_types.js` |
| 9 | Two robots | Met in sim, with limits: AEGIS-2 (a clone of the rover body with a simple kinematic driver, not the full terrain dynamics) shares a status bus with AEGIS-1 (position, task, cargo condition, next action), both slow or hold for each other, and AEGIS-2 clears a boulder that blocks AEGIS-1's route. One cooperative task; no payload transfer between the robots | `js/coop_core.js`, `js/coop.js`, `tools/coop_test.js`; command `team` |
| 10 | Something goes wrong | Met in sim: 7 injectable faults (FAULTS panel or `fault <name>`) with logged diagnostics, automatic responses and an operator RETRY/RETURN decision. Faults are injected; the responses change real sim behavior | `js/faults.js`, `js/faults_ui.js` |
| 11 | AI logistics manager | Met in sim for one rover: five requests with different priorities are ranked, grouped into trips, given a robot, a route and a start time, each with a stated reason; an urgent request re-plans mid-run. Rule-based scoring, not a learned model. The route is advisory because the onboard A* picks the exact path. Written for several robots, so it is ready for Mission 9 | `js/dispatcher.js`, `js/dispatcher_ui.js`, `tools/dispatcher_test.js` |
| 12 | Unrequested capability | Met | solar garage dock, rocket resupply fleet, start-up landing |

Done since: crew monitor on the habitat wall showing the rover mast camera (`js/habitat_display.js`) and supervisor pause, abort and approve-before-placement controls (`js/supervisor_ui.js`).

Still open: a regolith-simulant test of the real dust seal (the sim collar is a state machine, not a physical test). Measured in one sim run: placement error 9.6 cm against the 10 cm limit, so the margin is thin. Docking alignment is slow (several minutes of sim time) and worth tuning.

Plan and order of work: see the project plan; update this table as each gap closes.
