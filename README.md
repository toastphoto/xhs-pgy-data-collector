# Xiaohongshu Pugongying Data Collector

Electron desktop app for conservative Xiaohongshu/Pugongying creator data collection.

The main product line is `desktop-app`. The legacy Python/FastAPI backend in `content-analyzer` is kept because the desktop app can still launch it for compatibility.

## What It Does

- Opens Pugongying/Xiaohongshu in a real embedded Electron `BrowserView`
- Keeps login manual and persistent through the browser profile
- Runs batch creator URL collection as a serial queue
- Pauses for login, risk controls, or extraction failures so an operator can intervene
- Extracts visible DOM data into `runs/run_*` evidence folders
- Exports Excel resource tables and syncs local run data into SQLite/KB for AI analysis

## Quick Start

```bash
cd desktop-app
npm install
npm test
npm run dev
```

The desktop app starts the Python backend from `../content-analyzer/main.py` by default on `127.0.0.1:8010`.

## Repository Layout

- `desktop-app/`: main Electron desktop application
- `content-analyzer/`: legacy FastAPI backend and crawler reference
- `docs/`: product specs, implementation plans, and intranet API notes
- `skills/pgy-desktop-workflow/`: Codex workflow skill for future MCP/skill-driven operations

## Safety Notes

This repo intentionally excludes local cookies, `.env`, logs, runtime run data, uploaded task sheets, and real link lists. Keep actual creator lists and account session data local.

