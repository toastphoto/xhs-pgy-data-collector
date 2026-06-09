---
name: pgy-desktop-workflow
description: Use this skill when improving or operating the local Electron desktop app for Xiaohongshu Pugongying data collection, including batch collection, template extraction, run evidence, Excel export, SQLite/KB sync, or MCP/Codex workflow automation for this project.
---

# PGY Desktop Workflow

## Scope

Use the `desktop-app` directory as the main product line. Treat `content-analyzer` and `content-analyzer-backup-*` as legacy references only.

## Default Workflow

1. Inspect `desktop-app/main.js`, `desktop-app/lib/`, and `desktop-app/renderer/views/` before changing behavior.
2. Keep collection conservative: manual login, serial queue, visible DOM extraction, pause for login/risk/failure, no captcha bypass, no high concurrency, no signed API reconstruction.
3. Preserve run evidence: every collection should keep raw JSON and evidence under the Electron `userData/runs/run_*` directory.
4. Prefer improving selectors, confidence metadata, validation, and export quality before adding new collection surface area.
5. After code changes, run `npm test` in `desktop-app`.

## Product Priorities

- Reliability: login-state checks, page-type checks, selector confidence, clear pause reasons, retry/skip safety.
- Operator UX: concise status cards, obvious next action, readable errors, one-click run folder and export.
- Data quality: field source, missing-field markers, normalized numbers/percentages, reproducible Excel exports.
- Team workflow: sync exported or normalized data to Lark Sheets/Base when the user asks for collaboration or shared resource libraries.

## Useful MCP / Skills

- Browser skill: verify local UI changes with screenshots after frontend work.
- Spreadsheets skill: improve generated Excel workbooks, formatting, charts, and analysis sheets.
- Lark Sheets/Base/Drive skills: publish cleaned results for team collaboration.
- GitHub skills: review, commit, PR, and CI workflows if the project is moved to GitHub.

## Validation Checklist

- `npm test` passes.
- Batch task page can parse/paste/import URLs and start only with a selected template.
- Pause/resume/skip-current controls match `TaskRunner.state.currentId`.
- Export still finds `raw_result.json` in direct and one-level subdirectories.
- README commands and default ports match code.
