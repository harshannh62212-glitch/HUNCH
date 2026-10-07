# Test Plan — Simulation, Bench, and Review Demos

**Revision:** 2026-09-28  
**Scope:** Validation evidence for NASA HUNCH reviews. **AI nav code paths are not modified** by this plan; tests exercise existing behavior.

## 1. Simulation tests (digital twin)

| Test ID | Procedure | Pass criteria | Evidence |
|---------|-----------|---------------|----------|
| SIM-01 | `python3 run_nav_scenarios.py` | Exit 0; pit bowl + safe snap logic | `review/test-results/nav_geometry_regression.txt` |
| SIM-02 | Viewer → LOG TELEMETRY → QUICK MISSION → CSV EXPORT | Metrics within band: motor_cmd_frac correlates to ≤35 kg·cm sizing | `review/test-results/rover_telemetry_*.csv` (archetype until replaced) |
| SIM-03 | `python3 extract_sim_metrics.py <csv> -o sim_summary.json` | JSON summary generated | `review/test-results/sim_summary.json` |
| SIM-04 | `?selftest=pits` in viewer | Console pit regression table | Screenshot in engineering deck |
| SIM-05 | CARGO RUN preset (`launcher.html`) | Completes pallet approach without terrain block | Live demo / video |

Runbook detail: `engineering_validation_runbook.md`.

## 2. Bench tests (hardware — Pi / rover)

| Test ID | Script | Pass criteria | Evidence |
|---------|--------|---------------|----------|
| HW-01 | `bench/pwm_channel_test.py` (wheels up) | Clean PWM ramp, no driver fault | Log in engineering notebook |
| HW-02 | `bench/sensor_pipeline_stress.py` | Sensor stream stable under load | Log in engineering notebook |
| HW-03 | 25° incline crawl | Sustained motion, <12 A aggregate | FMEA NCR-002 verification text |
| HW-04 | Stall cycle (150×) | No MCU brownout | FMEA NCR-001 |

## 3. Review demonstration tests

| Test ID | Audience | Procedure |
|---------|----------|-----------|
| REV-01 | PDR/CDR mentors | Tri-fold + live sim + Q&A on constraints |
| REV-02 | FDR Houston | Physical prototype + QR videos + brochure |

## 4. Regeneration

```bash
cd Hunch/nasa-llaso-cad
python3 generate_hunch_review_bundle.py
```

Replace archetype CSV with a fresh export from the sim after each major demo.
