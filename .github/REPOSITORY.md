# GitHub repositories (dual mirrors)

Local workspace: `/Users/harshan/Hunch` (single source of truth). **Push both remotes** when publishing.

| Remote | Owner / slug | URL |
|--------|----------------|-----|
| **`origin`** | `harshannh62212-glitch` / **HUNCH** | https://github.com/harshannh62212-glitch/HUNCH |
| **`chat-app`** | `harshannh62212-glitch` / **chat-app** | https://github.com/harshannh62212-glitch/chat-app |

## Routine push (both)

```bash
cd /Users/harshan/Hunch
./scripts/push-github-both.sh
```

Or manually:

```bash
git push origin main
git push chat-app main
```

## Remotes setup (one-time)

```bash
git remote add origin https://github.com/harshannh62212-glitch/HUNCH.git
git remote add chat-app https://github.com/harshannh62212-glitch/chat-app.git
git remote -v
```

## Sync other machines

Clone or pull from either mirror; prefer **HUNCH** as the canonical name. Keep both updated from this Mac when you sync.

## Excludes

Respect `.gitignore` (e.g. `logs/`, `node_modules/`, `.venv/`, `*.pth`). Do not use rsync or folder copies — GitHub only.
