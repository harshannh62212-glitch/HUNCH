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

Main viewer: `Hunch/nasa-llaso-cad/viewer.html` (large; grep it, never read it whole).

## Notes

- `Notes/Daily/`: daily engineering log
- `Templates/`: engineering log and test record templates

## Keeping this useful

When you add or rename a doc, add one line here. Record decisions in a dated note under `Notes/Daily/` so the next session reads a short note instead of the code.
