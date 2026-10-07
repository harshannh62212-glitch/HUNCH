# Autonomy scenario checklist

Run before judge demos or after changing `viewer.html` nav code.

## Automated

```bash
cd /Users/harshan/Hunch/Hunch/nasa-llaso-cad
python3 run_nav_scenarios.py
```

In-browser pit corridors (4 routes through crater fields):

```
http://127.0.0.1:8002/viewer.html?selftest=pits
```

Or in the console: `runPitCorridorSelfTest()` — expect **4/4 passed**, no `inBowl`, `minClear ≥ 0.35m`.

## Manual (viewer.html)

| # | Scenario | Pass criteria |
|---|----------|----------------|
| 1 | Quick mission | **QUICK MISSION** engages nav; rover moves; no immediate crash |
| 2 | Pit guard | Click goal across large crater; path detours; rover never sits in bowl |
| 3 | Steep slope | Goal on steep cell; A* blocks or snaps goal to safe ring |
| 4 | LLM assist | With Ollama up, tight corridor triggers advisory; without Ollama, classical nav continues |
| 5 | Layer mutex | **ENGAGE AI NAV** disengages neural; neural disengages AI nav |
| 7 | RTH park | **RTH** stores rover inside bay; **DOCKED & CHARGING**; door closes |
| 8 | Undock + mission | While docked, **QUICK MISSION** or map click → door opens, fast exit, mission starts |
| 9 | Telemetry | **LOG TELEMETRY** → drive 30s → **EXPORT CSV** produces valid columns |

## Autonomy layers (priority high → low)

1. **Safety supervisor** — reverse escape, pit/terrain block, impact speed limit  
2. **Planner** — A* on lidar map + terrain cost  
3. **Controller** — path tracking + vision / LLM bias (assist only)  
4. **Neural OR LLM** — never both active with classical stack  
