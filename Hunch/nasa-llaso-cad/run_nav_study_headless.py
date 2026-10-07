#!/usr/bin/env python3
"""
One-hour (or NAV_STUDY_MINUTES) autopilot wander study — no Cursor required.

Starts serve.py, headless Chrome on viewer.html?endurance=N, syncs logs to the
Latitude 5290 (via nav_study_sync.sh), then writes analyze_nav_study report.
"""
from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOG = ROOT / "nav_study.jsonl"
PORT = int(os.environ.get("NAV_STUDY_PORT", "8002"))
MINUTES = float(os.environ.get("NAV_STUDY_MINUTES", "60"))


def find_chrome() -> str | None:
    for p in (
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        shutil.which("google-chrome"),
        shutil.which("chromium"),
    ):
        if p and Path(p).is_file():
            return p
    return None


def has_finish(path: Path, run_id: int | None) -> bool:
    if not path.is_file() or path.stat().st_size == 0:
        return False
    try:
        lines = path.read_text().splitlines()
    except OSError:
        return False
    for line in reversed(lines[-40:]):
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        if rec.get("kind") != "finish":
            continue
        if run_id is None or rec.get("run") == run_id:
            return True
    return False


def latest_run_id(path: Path) -> int | None:
    if not path.is_file():
        return None
    rid = None
    for line in path.read_text().splitlines():
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        if rec.get("kind") == "start" and rec.get("run"):
            rid = rec["run"]
    return rid


def server_up(port: int) -> bool:
    import urllib.request

    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/viewer.html", timeout=2) as r:
            return r.status == 200
    except OSError:
        return False


def main() -> int:
    run_stamp = time.strftime("%Y%m%d_%H%M%S")
    logs_dir = ROOT / "logs"
    logs_dir.mkdir(exist_ok=True)
    run_log = logs_dir / f"nav_study_{run_stamp}.log"

    def log(msg: str) -> None:
        line = f"[{time.strftime('%H:%M:%S')}] {msg}\n"
        sys.stdout.write(line)
        sys.stdout.flush()
        with run_log.open("a") as f:
            f.write(line)

    if LOG.exists() and LOG.stat().st_size > 0:
        archive = ROOT / f"nav_study_{run_stamp}_pre.jsonl"
        shutil.copy2(LOG, archive)
        LOG.write_text("")
        log(f"archived previous log to {archive.name}")

    chrome = find_chrome()
    if not chrome:
        log("ERROR: Install Google Chrome for headless WebGL sim.")
        return 1

    server: subprocess.Popen | None = None
    if server_up(PORT):
        log(f"Reusing existing sim server on port {PORT}")
    else:
        server = subprocess.Popen(
            [sys.executable, "serve.py", str(PORT)],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        time.sleep(0.8)
        if server.poll() is not None:
            err = server.stderr.read().decode() if server.stderr else ""
            log(f"ERROR: serve.py failed: {err}")
            return 1

    sync = subprocess.Popen(
        ["bash", str(ROOT / "nav_study_sync.sh")],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    url = f"http://127.0.0.1:{PORT}/viewer.html?endurance={int(MINUTES)}"
    browser: subprocess.Popen | None = None
    if sys.platform == "darwin":
        profile = logs_dir / "chrome_nav_study_profile"
        profile.mkdir(parents=True, exist_ok=True)
        log(f"Opening background Chrome app window: {url}")
        subprocess.Popen(
            [
                "open",
                "-g",
                "-na",
                "Google Chrome",
                "--args",
                f"--user-data-dir={profile}",
                f"--app={url}",
                "--disable-background-timer-throttling",
                "--disable-renderer-backgrounding",
            ]
        )
    else:
        log(f"Opening headless browser: {url}")
        browser = subprocess.Popen(
            [
                chrome,
                "--headless=new",
                "--disable-dev-shm-usage",
                "--window-size=1400,900",
                url,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    wall_limit = int(MINUTES * 60 + 25 * 60)
    deadline = time.time() + wall_limit
    run_id: int | None = None

    try:
        while time.time() < deadline:
            if browser is not None and browser.poll() is not None:
                log("WARNING: headless browser exited early")
                time.sleep(5)
            if run_id is None:
                run_id = latest_run_id(LOG)
            if has_finish(LOG, run_id):
                log("Finish event seen in nav_study.jsonl")
                break
            time.sleep(15)
        else:
            log("TIMEOUT waiting for finish — analyzing partial log")

        report_md = ROOT / f"nav_study_report_{run_stamp}.md"
        report_json = ROOT / f"nav_study_report_{run_stamp}.json"
        subprocess.run(
            [
                sys.executable,
                str(ROOT / "analyze_nav_study.py"),
                str(LOG),
                "-o",
                str(report_md),
                "--json",
                str(report_json),
            ],
            cwd=ROOT,
            check=False,
        )
        log(f"Report: {report_md.name}")

        rsync = subprocess.run(
            [
                "rsync",
                "-az",
                "-e",
                "ssh -o BatchMode=yes -o ConnectTimeout=12",
                str(LOG),
                str(ROOT / "rover_actions.log"),
                str(report_md),
                str(report_json),
                "harshan@100.122.117.6:/home/harshan/hunch_telemetry_sync/",
            ],
            capture_output=True,
            text=True,
        )
        if rsync.returncode == 0:
            log("Synced log + report to Latitude 5290 (hunch_telemetry_sync)")
        else:
            log(f"rsync note: {rsync.stderr.strip() or rsync.stdout.strip()}")
    finally:
        for proc in (browser, sync, server):
            if proc is not None and proc.poll() is None:
                proc.send_signal(signal.SIGTERM)
        time.sleep(1)

    log("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
