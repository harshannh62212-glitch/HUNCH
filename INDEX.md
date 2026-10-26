---
title: "Hunch vault index"
date: 2026-10-26
tags: [index]
---
# Hunch vault index

Read this first. Open only the note you need; do not scan the tree. This folder is also an Obsidian vault (`.obsidian/`), so every link below is a relative markdown link.

## Start here

- [Handoff](HANDOFF.md): what we built, how it connects, how to run and deploy
- [Agent commands](AGENTS.md): day-to-day commands
- [README](README.md): public overview
- [Agent navigation map](.agents/AGENT_INDEX.md): where things live before grepping

## LLASO Project 2 (rover, dock, review package)

- [CAD and sim README](Hunch/nasa-llaso-cad/README.md)
- [Review package index](Hunch/nasa-llaso-cad/review/INDEX.md)
- [Review docs index](Hunch/nasa-llaso-cad/review/docs/INDEX.md): dock design, terrain and soil, runtime energy, FMEA, test plan
- [Engineering validation runbook](Hunch/nasa-llaso-cad/engineering_validation_runbook.md)
- [Scenarios](Hunch/nasa-llaso-cad/scenarios.md)

## Code map (Hunch/nasa-llaso-cad/js)

| File | Role |
| :--- | :--- |
| `autonomy_stack.js` | Autonomy and navigation stack |
| `dock_station.js` | Solar garage dock controller |
| `fusion_rover.js`, `nav_corridor_fusion.js` | Rover sensor fusion and corridor nav |
| `lunar_logistics.js` | Cargo logistics and rocket resupply |
| `rover_dynamics.js`, `rover_sensors.js`, `rover_bom.js` | Rover physics, sensors, BOM |
| `terrain.js`, `soil_tracks.js` | Terrain and soil track model |
| `motion.js`, `studio.js`, `telemetry_export.js` | Motion, studio view, telemetry export |
| `intro_landing.js` | Start-up powered-descent rover delivery (skip with Space, `?intro=0`) |
| `mission_scoring.js` | Tip gate, pod stability, dust-seal state machine, mission report (Missions 3, 5, 6) |
| `cargo_types.js` | Pod, cylinder, container and the adaptive cradle (Mission 8) |
| `faults.js`, `faults_ui.js` | Fault injection, diagnostics, operator decisions (Mission 10) |
| `dispatcher.js`, `dispatcher_ui.js` | Priority dispatcher and plan panel (Mission 11) |
| `supply_route.js` | Scaled 2 km supply route with hazard zones (Mission 7) |
| `coop_core.js`, `coop.js` | Second rover, status bus, collision avoidance, route clearing (Mission 9) |
| `habitat_display.js`, `supervisor_ui.js` | Crew monitor with rover camera; pause, abort, approve |

Commands typed in the rover box: `dispatch`, `urgent <item>`, `fault <name>`, `cargo <type>`, `route`, `team`, `pause`, `resume`, `approval on|off`, `approve`. Mission status table: [Mission coverage](Hunch/nasa-llaso-cad/review/docs/mission-coverage.md).

Main viewer: `Hunch/nasa-llaso-cad/viewer.html` (large; grep it, never read it whole).

## Notes

- `Notes/Daily/`: daily engineering log
- `Templates/`: engineering log and test record templates

## Keeping this useful

When you add or rename a doc, add one line here. Record decisions in a dated note under `Notes/Daily/` so the next session reads a short note instead of the code.
