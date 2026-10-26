---
title: Terrain, tyre tracks and soil physics
date: 2026-10-25
tags: [simulator, terrain, soil, physics, moon]
aliases: [Lunar terrain, Soil model, Tread marks]
---
# Terrain, tyre tracks and soil physics

How the simulator's ground is built and what it does to the rover. Code: `js/terrain.js` (height field, craters, soil maps), `js/soil_tracks.js` (tread imprints and compaction memory), hooks in `viewer.html`.

## 1. Terrain calibrated to the Moon

One height field (160 m x 160 m, 0.33 m cells) feeds the render mesh, the wheels, the lidar rays and the planner.

| Quantity | Model | Reference value |
|---|---|---|
| Crater size-frequency | Cumulative N(>D) = SAT x 1.54 / D^2 per km^2 (D in km), SAT = 3 % of geometric saturation, D from 1 to 26 m; about 930 craters of 1 m or larger, 63 of 4 m or larger in the placement area | Equilibrium population below ~100 m diameter: Trask 1971, Gault 1970, Xiao and Werner 2015 |
| Depth / diameter | 0.18 (fresh) to 0.05 (degraded), median about 0.1 | Pike 1977: 0.196 fresh simple craters |
| Rim crest height | about 0.04 D | Pike 1977 |
| Median slope at 5 m baseline | 4.2 deg | Mare 3 to 5 deg (LOLA, Rosenburg et al. 2011) |
| Wrinkle ridges | 40 m wide, 2 m high, flank slope 5 deg | Real ridges: flanks of 1 to 5 deg |
| Hills (mission mounds) | 16 to 20 m wide, 1.4 to 1.6 m high, slope up to 10 deg | Blocky ejecta mounds |
| Albedo | Highland about 0.18, mare basalt about 0.08, fresh ejecta and rays up to 0.3 | Lunar regolith 0.07 to 0.2 |

`NASA_Terrain.population` exposes SAT, the diameter range and `expected(dmin, dmax)`, so a test can compare the placed craters against the law.

Craters that matter to the rover: crisp ones (D of 4 m or more with d/D of 0.11 or more) go into `smallCraters` and the planner treats their bowls as no-go; degraded dishes (`oldCraters`) and 1 to 4 m pits (`microCraters`) are drivable.

Known limits: boulders are placed by the viewer, not from a rock size-frequency law; where small craters overlap, 1 m-scale slopes can reach about 49 deg (real walls stop near 35 deg).

## 2. Tyre tracks

Each wheel imprints the tread it really has: 0.076 m wide, 16 chevron grouser lugs skewed +/-0.18 rad in alternation. One lug imprint is stamped per lug pitch of ground travel (2 pi x 0.10 / 16 = 39 mm), with a compaction band and edge berms between them. Stamps sit on the exact triangle of the rendered terrain mesh. A ring buffer keeps the newest 48 000 lug and 24 000 band stamps (about 300 m of six-wheel path). No imprint on poured pads, the dock floor or its ramp.

## 3. Soil physics

A 0.08 m grid remembers rolling passes (compaction c, 0 to 1, +0.2 per pass). It feeds back into the vehicle:

| Effect | Formula | Why |
|---|---|---|
| Sinkage | z = z0 x (1 - 0.55 c) | A compacted bed has a larger bearing modulus (Bekker) |
| Slip sinkage | z x (1 + 0.6 x slip) | A spinning wheel digs in |
| Rolling resistance | Rr x (1 - 0.30 c) | Less soil to displace |
| Grip | mu x (1 + 0.05 c) | Compacted regolith has higher shear strength |

A six-wheel rover rolls its middle and rear wheels in the front wheel's track, so one drive already compacts the line to c = 0.4 to 0.6. The terrain readout in the HUD shows the mean compaction under the wheels (`c` followed by a percentage).

## 4. Checks

```bash
node tools/cad_model_check.js
node /tmp/terr_stats.js js/terrain.js   # slope percentiles, crater counts, d/D (script kept with the terrain session)
```

Related: [Dock station design](dock-station-design.md) · [CAD and motion upgrades](cad-motion-upgrades.md)
