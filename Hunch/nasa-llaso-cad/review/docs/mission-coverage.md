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
| 7 | 2 km route | Gap | field is about 160 m across |
| 8 | Three cargo systems | Gap | only the 4x2 ft pod exists |
| 9 | Two robots | Gap | one rover only |
| 10 | Something goes wrong | Gap | only a dock sensor-blackout test hook |
| 11 | AI logistics manager | Gap | queue is first-in-first-out |
| 12 | Unrequested capability | Met | solar garage dock, rocket resupply fleet, start-up landing |

Also open: habitat display of the rover camera; a regolith-simulant test of the real dust seal (the sim collar is a state machine, not a physical test). Measured in one sim run: placement error 9.6 cm against the 10 cm limit, so the margin is thin. Docking alignment is slow (several minutes of sim time) and worth tuning.

Plan and order of work: see the project plan; update this table as each gap closes.
