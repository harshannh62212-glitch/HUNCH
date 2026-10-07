# NASA HUNCH Research Brief — LLASO Surface Logistics Rover

**Project ID:** `LLASO-P1-AMR-2026`  
**Problem:** Move external cargo and science payloads across lunar surface routes between a 40-ft logistics module and work sites, with autonomous hazard avoidance.

## Environment constraints (design drivers)

| Constraint | Value used in design | Where documented |
|------------|----------------------|------------------|
| Lunar gravity | \(g = 1.622\,\text{m/s}^2\) (1/6 Earth) | `hardware_specification_sheet.md`, root `app.js`, sim physics |
| Earth demo gravity | \(9.81\,\text{m/s}^2\) — motors sized for classroom test | Torque section in hardware spec |
| Max slope | \(25^\circ\) | Hardware spec, sim slope scenarios in runbook |
| Regolith friction model | \(\mu_{\text{track}} \approx 0.65\) | Hardware spec, sim traction cap |
| Gross mass | \(\approx 8\,\text{kg}\) | Hardware spec (not dashboard placeholder numbers) |
| Dust / thermal | Vented PETG + 304 mesh, driver heat spreading | FMEA NCR-003 in `review/docs/fmea-closure.md` |

## Mission requirements traceability

1. **Autonomous navigation** — LiDAR occupancy + path planning in digital twin (`nasa-llaso-cad/viewer.html`); JSON dodge contract in root `payload.json` for LLM assist layer.
2. **Logistics context** — Project 1 cargo module sim + LIFO manifest (`optimize_manifest.py`, `lunar_logistics_manifest.json`).
3. **Human oversight** — AEGIS-V1 dashboard (Vercel) + React mission UI (`nasa-hunch-rover`).

## Research sources (student packet)

- NASA HUNCH Design & Prototyping yearly plan (PDR/CDR expectations).
- Internal doc: `Lunar_Constraints_and_Sim_Flaws.pdf` (sim fidelity limits called out honestly).
- COTS study: `review/docs/cots-comparison.md`.

## Open sim fidelity items (transparency for judges)

Documented in `Lunar_Constraints_and_Sim_Flaws.pdf` — judges see that the team knows what the sim proves vs what requires hardware bench data.
