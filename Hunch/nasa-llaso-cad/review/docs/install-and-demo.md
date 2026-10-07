# Install & Demo Instructions (Judges / Mentors)

## A. Simulation (no hardware)

```bash
cd /Users/harshan/Hunch/Hunch/nasa-llaso-cad
python3 serve.py 8002
```

Open:

- **Review packet:** http://127.0.0.1:8002/review/
- **Autopilot sim:** http://127.0.0.1:8002/viewer.html (AI nav unchanged)
- **Cargo preset:** http://127.0.0.1:8002/viewer.html?mission=cargo

Optional CAD twin:

```bash
cd ../nasa-hunch-rover/cad_model && python3 -m http.server 8003 --bind 127.0.0.1
```

## B. React mission dashboard

```bash
cd ../nasa-hunch-rover && npm install && npm run dev
```

## C. Production mission control

https://aegisv1.vercel.app

## D. Record judge videos (3 min prototype + 3 min team)

1. Screen-record QUICK MISSION with telemetry HUD visible.
2. Screen-record walkthrough of `review/trifold.html` + live prototype if available.
3. Save as `review/media/prototype-demo.mp4` and `review/media/team-presentation.mp4`.
4. QR codes on tri-fold update automatically when served from port 8002.
