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
| 3 | Pick up and secure a pod | Partial: no stability scoring | `pickupCargo` |
| 4 | Transport over terrain | Met | `js/terrain.js`, `js/rover_dynamics.js` |
| 5 | Deliver and place | Partial: no pass/fail on placement error | `dropCargo` |
| 6 | Full logistics cycle | Partial: stats not exported | `startMission`, `missionStats` |
| 7 | 2 km route | Gap | field is about 160 m across |
| 8 | Three cargo systems | Gap | only the 4x2 ft pod exists |
| 9 | Two robots | Gap | one rover only |
| 10 | Something goes wrong | Gap | only a dock sensor-blackout test hook |
| 11 | AI logistics manager | Gap | queue is first-in-first-out |
| 12 | Unrequested capability | Met | solar garage dock, rocket resupply fleet, start-up landing |

Also open: dust-exclusion seal behavior, habitat display of the rover camera, tipping gate.

Plan and order of work: see the project plan; update this table as each gap closes.
