# GitHub repository: **HUNCH**

| Field | Value |
|--------|--------|
| Owner | `harshannh62212-glitch` |
| Repo slug | **`HUNCH`** |
| Clone URL | `https://github.com/harshannh62212-glitch/HUNCH.git` |
| Web | https://github.com/harshannh62212-glitch/HUNCH |

Display title on GitHub can still be “The Hunch” in the description; the slug is `HUNCH`.

## Rename on GitHub (if still `chat-app`)

1. Open https://github.com/harshannh62212-glitch/chat-app/settings  
2. **Repository name** → `HUNCH` → **Rename**

GitHub redirects old `chat-app` URLs after rename.

## Local remote

```bash
cd /Users/nhharshan/Hunch
git remote set-url origin https://github.com/harshannh62212-glitch/HUNCH.git
git remote -v
```

## First push of the monorepo

Most rover/sim paths are still untracked locally. Stage deliberately; exclude `logs/`, large `*.pth` if needed (Git LFS or omit).

Sync other machines via **clone/pull from GitHub** only.

## Optional: GitHub CLI

```bash
brew install gh && gh auth login
gh repo rename HUNCH --repo harshannh62212-glitch/chat-app
```
