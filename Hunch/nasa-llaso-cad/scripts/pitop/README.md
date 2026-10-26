---
title: "pi-top 4 — LLASO simulator bring-up (saved plan)"
date: 2026-10-24
tags: [llaso, sim, pitop]
---
# pi-top 4 — LLASO simulator bring-up (saved plan)

When you have a **pi-top 4** (Raspberry Pi 4, typically 4 GB RAM), use this folder to run the same NASA HUNCH LLASO CAD simulator you use on the Mac. No rsync: clone from **GitHub** on the Pi.

## What runs where

| Machine | Role |
|--------|------|
| **pi-top 4** | `serve.py` + Chromium → `viewer.html`; classical nav + optional **small** Ollama model |
| **Mac** | Training (`train_rover_imitation.py`), heavy Ollama (`hunch-rover-nav:latest` 7B), NAS battery scripts |

Do **not** expect the 7B nav model on 4 GB Pi RAM. Use `qwen2.5:1.5b` (or similar) for dodge/assist only, or run with LLM off.

## One-time setup on the Pi

```bash
sudo apt update
sudo apt install -y git python3 chromium-browser

git clone https://github.com/harshannh62212-glitch/HUNCH.git
cd HUNCH/Hunch/nasa-llaso-cad

# Optional: local LLM (lightweight)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:1.5b
```

## Every session

From the repo on the Pi:

```bash
cd HUNCH/Hunch/nasa-llaso-cad
./scripts/pitop/run.sh
```

Or manually:

```bash
python3 serve.py 8002
# Then open http://127.0.0.1:8002/viewer.html in Chromium
```

## `run.sh` behavior

- Starts `serve.py` on port **8002** (telemetry → `rover_actions.log`, battery API if enabled).
- Opens Chromium in kiosk-friendly flags (GPU/WebGL; disable unnecessary sandbox issues on some Pi images).
- Assumes cwd is `nasa-llaso-cad` (script cd's there from repo layout).

## Network / Ollama

- Viewer resolves Ollama via `NASA_Autonomy.resolveOllamaBase()` (localhost first).
- On Pi: Ollama at `http://127.0.0.1:11434`.
- On Mac during dev: same sim; Pi can use Mac Ollama only if you explicitly point URL and firewall allows it (not required for bring-up).

## After `git pull` on the Pi

```bash
cd HUNCH && git pull
cd Hunch/nasa-llaso-cad && ./scripts/pitop/run.sh
```

## Agent handoff

- Task map: `.agents/AGENT_INDEX.md` → **pi-top 4 bring-up**
- Cursor plan (if present): `.cursor/plans/pi-top_4_transfer_*.plan.md`
- When the user says they have the pi-top: run this README + `run.sh`; verify WebGL and energy modes in HUD; pull `qwen2.5:1.5b` if LLM assist is wanted.

## Hardware note

pi-top is a Pi 4 carrier (display, battery, GPIO). This sim is **software-in-the-loop** on the Pi screen—not motor control on pi-top GPIO unless you add a separate bridge later.
