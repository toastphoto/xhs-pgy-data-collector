# AGENTS.md

## Project

Xiaohongshu Pugongying Data Collector is a conservative desktop data collection tool for Xiaohongshu/Pugongying creator information. The main product is an Electron desktop app that embeds a real browser, keeps login/manual intervention in the operator's hands, runs creator URL batches serially, saves evidence, exports Excel tables, and can sync collected runs into a local SQLite/KB layer for analysis.

## Main Paths

- Work from the repository root: `/Users/workstudio/Downloads/数据收集/xhs-pgy-data-collector`
- Main product line: `desktop-app/`
- Compatibility backend/reference crawler: `content-analyzer/`
- Product/spec notes: `docs/`
- Project workflow skill: `skills/pgy-desktop-workflow/`
- Project memory: `docs/project_memory/`
- UX redesign blueprint: `docs/project_memory/UX_REDESIGN_PLAN.md`
- Pugongying anti-bot/risk-control safety audit: `docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md`
- Pugongying live safety validation protocol: `docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md`
- MVP acceptance plan: `docs/project_memory/MVP_ACCEPTANCE_PLAN.md`

Current checked state on 2026-06-29: branch `main` was synced with `origin/main`, and ports `8010` and `8000` were not listening. Treat this as volatile: recheck at the start of each new thread.

## Run And Verify

```bash
cd desktop-app
npm install
npm test
npm run dev
```

The Electron app normally starts the legacy Python backend from `../content-analyzer/main.py` on `127.0.0.1:8010`. If Electron install hangs on binary download, use the mirror instructions in `desktop-app/README.md`.

Project-memory validation:

```bash
python scripts/verify_project_memory.py
```

Pugongying collection safety audit:

```bash
python scripts/audit_pgy_safety.py
```

Running-backend safety probe:

```bash
python scripts/probe_pgy_runtime_safety.py
```

Sanitized real-account validation record checker:

```bash
python scripts/prepare_pgy_live_validation.py --output tmp/pgy_live_validation_YYYYMMDD.json
python scripts/validate_pgy_live_validation.py --print-template
python scripts/validate_pgy_live_validation.py tmp/pgy_live_validation_YYYYMMDD.json
python scripts/test_pgy_live_validation.py
```

MVP readiness checker:

```bash
python scripts/check_mvp_readiness.py
python scripts/check_mvp_readiness.py --run-commands
python scripts/check_mvp_readiness.py --strict
```

## New Thread Checklist

1. Read this file first.
2. Read `docs/project_memory/ACTIVE_CONTEXT.md`.
3. Read `docs/project_memory/DECISIONS.md`.
4. Read `docs/project_memory/HANDOFF_TEMPLATE.md`.
5. Read `docs/project_memory/UX_REDESIGN_PLAN.md` before UI/product-workbench changes.
6. Read `docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md` before changing collection speed, batch size, browser automation, proxy/headless behavior, or risk-control handling.
7. Read `docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md` before claiming real-account safety validation is complete.
8. Read `docs/project_memory/MVP_ACCEPTANCE_PLAN.md` before claiming the app is a usable or delivered MVP.
9. Recheck `git status --branch --short`, current branch, and whether services/ports are running.
10. Re-run the smallest relevant verification before changing code, usually `cd desktop-app && npm test`.
11. Confirm whether ignored local data files are present before touching import/export flows.

## Boundaries

- Do not delete or move local data files, run outputs, cookies, browser profiles, or task sheets unless the user explicitly asks.
- Do not commit `.env`, cookies, browser session data, logs, `runs/`, database files, real creator links, or task spreadsheets.
- Do not add real API keys, secrets, account identifiers, cookies, or private creator lists to docs or tests.
- Do not bypass platform login, captcha, risk control, or rate limits. Keep the product aligned with manual-login, low-concurrency operation.
- Do not assume the legacy Python backend is the main product; verify whether a requested change belongs in `desktop-app/` first.
- Do not treat service/port/branch/auth status in memory as permanent fact. Recheck before acting.

## Memory Update Rules

- Update `docs/project_memory/ACTIVE_CONTEXT.md` when current goals, environment state, or next steps change.
- Update `docs/project_memory/DECISIONS.md` when a meaningful architectural/product/security decision is made.
- Update `docs/project_memory/HANDOFF_TEMPLATE.md` only when the handoff workflow itself changes.
- Keep memory concise enough for a new AI/helper thread to read in 1-3 minutes.
