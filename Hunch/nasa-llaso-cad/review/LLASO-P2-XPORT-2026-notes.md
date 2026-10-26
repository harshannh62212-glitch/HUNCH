---
title: "LLASO-P2-XPORT-2026 notes"
date: 2026-10-24
tags: [review]
---
# LLASO-P2-XPORT-2026 notes

NASA HUNCH 2026-27, Project 2. Move landed cargo from the pad to the habitat supply building and dock it, with no EVA on the nominal run. Earth demo can be a scaled module inside a 24 inch cube. Our sim rover is already that scale: a 2 ft × 2 ft, 6-wheel robot with a battery model and AI NAV.

The deliverable is a prototype or a high-fidelity sim that shows navigation and docking. PDR target is Missions 1–6. Missions 7–12 are CDR extras, not the minimum.

## What the robot must do

- Carry a scaled module mass in 1/6 g. Official loads are a ~40 ft module, a possible 20 ft container, and 4 ft × 2 ft Astrobotic pods. Shapes can be cylinders or boxes.
- Cross unprepared regolith. The pad is far from the habitat because of plume blast (storyboard: about 2 km, scaled on the course).
- Dock to a dust-exclusion port about 1–2 m across, sealed before the hatch opens. The sim stand-in is pushing the robot square against a flat airlock face.
- Run on its own, with a human override.
- Use solar plus battery. We model a 20 Ah / 256 Wh LiFePO4 pack under the aft cargo deck (rear bogie ballast) and four energy modes.
- Coordinate module orientation with the Project 3 team so the hatch faces the port.

## Mission order

1. Leave the landing zone: start, stop, turn, reverse, reach staging, do not hit the lander or cargo.
2. Find a pod and line up for pickup without a human moving either body.
3. Pick up and lock one 4 ft × 2 ft pod. It stays put through start, stop, turn, and rough ground.
4. Carry it to the habitat through rocks, slopes, and turns.
5. Place it in a marked receiving zone. Do not drop it beside the building.
6. Full cycle: assignment, acquire, haul, deliver, return. Record time, distance, energy, and placement error.

Later, if 1–6 are solid: scaled 2 km autonomy, three cargo interfaces, two-robot teamwork, a surprise fault, an AI dispatcher, and one capability NASA did not ask for.

## Status

See [Mission coverage](docs/mission-coverage.md) for the current state of each mission. The sim now opens with a rocket-delivered rover landing (`js/intro_landing.js`; skip with Space, disable with `?intro=0`).
