# The Hunch

NASA HUNCH LLASO monorepo — external cargo transport robot (AEGIS-V1), lunar surface simulator, AMR dashboard, and logistics tooling.

Autonomous lunar surface logistics and payload transport engineered for **NASA HUNCH LLASO Project 2** (Rocket to Base Supply Building).

## Mission Overview
- **Mission Status**: `PLANNING`
- **Subsystem Engineers**:
  - **Sacheth** — Avionics & Systems Lead
  - **Ahrav** — Mechanical Design & Locomotion Lead
  - **Harshan** — Autonomous Software & AI Lead
- **Key Features**:
  - Product site in a Mac App Store layout (`index.html`, light + dark) with a live 3D preview of the rover and the dock
  - Rover CAD (`Hunch/nasa-llaso-cad/rover_model.html`): arm pick & place, drive test, battery hot-swap bay, PETG / flight finish
  - Dock station CAD (`Hunch/nasa-llaso-cad/dock-station-cad.html`): full autonomous docking cycle with clamps, scissor-lift coupler and opener-driven door
  - LLASO simulator (`Hunch/nasa-llaso-cad/viewer.html`): autopilot, LiDAR + A*, dock, logistics
  - Shared motion library (`js/motion.js`): minimum-jerk / spring / accel-limited motion for every animation

## Quick start
```bash
cd Hunch/nasa-llaso-cad && python3 serve.py 8002
# http://127.0.0.1:8002/launcher.html
```

Agents & humans: see [`AGENTS.md`](AGENTS.md), [`.agents/AGENT_INDEX.md`](.agents/AGENT_INDEX.md), [`HANDOFF.md`](HANDOFF.md).

## Deployment on Vercel
```bash
npx vercel
```
Production: [aegisv1.vercel.app](https://aegisv1.vercel.app) (project name in `vercel.json`).

## GitHub
GitHub repo: **`harshannh62212-glitch/HUNCH`** — see [`.github/REPOSITORY.md`](.github/REPOSITORY.md).

## Map of this vault
Start here. Each line links to a document and says when to read it.

### Project guides
- [AGENTS.md](AGENTS.md): shared rules and team/codebase layout for agents and humans
- [CLAUDE.md](CLAUDE.md): file-access rules for Claude
- [HANDOFF.md](HANDOFF.md): handoff notes and current state
- [.agents/AGENT_INDEX.md](.agents/AGENT_INDEX.md): task-to-file map for agents
- [.github/REPOSITORY.md](.github/REPOSITORY.md): GitHub repo details

### AEGIS-V1 / LLASO CAD and simulator (`Hunch/nasa-llaso-cad`)
- [Project README](Hunch/nasa-llaso-cad/README.md): overview and setup
- [Engineering validation runbook](Hunch/nasa-llaso-cad/engineering_validation_runbook.md): how to validate the design
- [Scenarios](Hunch/nasa-llaso-cad/scenarios.md): simulation scenarios
- [Review package](Hunch/nasa-llaso-cad/review/INDEX.md): judge criteria, evidence and demo materials
- [Pi-top scripts](Hunch/nasa-llaso-cad/scripts/pitop/README.md): pi-top helper scripts

### AMR tracked rover (`Hunch/nasa-hunch-rover`)
- [Hardware specification](Hunch/nasa-hunch-rover/cad_model/hardware_specification_sheet.md): mass, motors, electronics
- [Onboard software](Hunch/nasa-hunch-rover/onboard/README.md): onboard setup

### Other
- [CoppeliaBot](Hunch/coppeliabot/README.md): CoppeliaSim bot project
- [NAS specs](nas_192.168.1.27_specs.md): testbed server hardware and services

### Notes and templates
- [Engineering log template](Templates/Engineering%20log.md): daily log (Obsidian's daily note uses it; notes land in `Notes/Daily/`)
- [Test record template](Templates/Test%20record.md): one page per bench or sim test
- [CAD, dock and website upgrades (v3.1)](Hunch/nasa-llaso-cad/review/docs/cad-motion-upgrades.md): what changed on 2026-10-25 and what to upgrade next
