# AGENTS.md

## Project

Xiaohongshu Pugongying Data Collector is a conservative desktop data collection tool for Xiaohongshu/Pugongying creator information. The main product is an Electron desktop app that embeds a real browser, keeps login/manual intervention in the operator's hands, runs creator URL batches serially, saves evidence, exports Excel tables, and can sync collected runs into a local SQLite/KB layer for analysis.

## Main Paths

- Current Windows repository root: `C:\Users\feibo\Documents\Codex\2026-06-25\s\projects\xhs-pgy-data-collector`
- Main product line: `desktop-app/`
- Compatibility backend/reference crawler: `content-analyzer/`
- Product/spec notes: `docs/`
- Feishu workflow schema: `docs/intranet/feishu-workflow-schema.md`
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
5. Read `docs/project_memory/LEARNINGS.md`.
6. Read `docs/project_memory/UX_REDESIGN_PLAN.md` before UI/product-workbench changes.
7. Read `docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md` before changing collection speed, batch size, browser automation, proxy/headless behavior, or risk-control handling.
8. Read `docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md` before claiming real-account safety validation is complete.
9. Read `docs/project_memory/MVP_ACCEPTANCE_PLAN.md` before claiming the app is a usable or delivered MVP.
10. Recheck `git status --branch --short`, current branch, and whether services/ports are running.
11. Re-run the smallest relevant verification before changing code, usually `cd desktop-app && npm test`.
12. Confirm whether ignored local data files are present before touching import/export flows.

## Boundaries

- Do not delete or move local data files, run outputs, cookies, browser profiles, or task sheets unless the user explicitly asks.
- Do not commit `.env`, cookies, browser session data, logs, `runs/`, database files, real creator links, or task spreadsheets.
- Do not add real API keys, secrets, account identifiers, cookies, or private creator lists to docs or tests.
- Do not bypass platform login, captcha, risk control, or rate limits. Keep the product aligned with manual-login, low-concurrency operation.
- Natural-language candidate intake, result pagination, and collection must all preserve the PGY-only boundary, the hard 50-creator ceiling, serial jittered waits, batch cooldown, and immediate stop on login/captcha/risk/frequent-operation prompts.
- Accept each ranked candidate command by its own visible cross-page run. A successful `前50位` run does not prove a direct `35-50位` run; both must preserve global order, the manual rank-40 checkpoint, deduplication, and return to the protected result page.
- Do not generate an executable XiaoMiFeng file or trigger any external send unless the current recipient/channel/message fingerprint has an approved human approval record. Any execution-content change invalidates approval.
- Do not assume the legacy Python backend is the main product; verify whether a requested change belongs in `desktop-app/` first.
- Do not treat service/port/branch/auth status in memory as permanent fact. Recheck before acting.
- Do not claim an installed Windows feature from source or `win-unpacked` evidence. Verify the actual installed executable, shortcut target, visible version, and installed UI.
- Do not let repeated PGY search results overwrite operator-owned candidate status, priority, exclusion reason, or notes. Merge public search fields separately from manual review fields.
- Candidate intake must work when the PGY result page loads before the operator clicks the instruction. Reuse only a sanitized response snapshot from the same BrowserView navigation context; never loosen this into an unscoped stale-response cache.
- Treat the visible PGY paginator as the primary current-page evidence. A highlighted numeric page or disabled previous control can confirm page 1; response metadata is fallback/cross-check evidence and must not override conflicting visible pagination.
- Candidate calibration must keep the repeated creator row, repeated nickname field, and semantic pagination root as three distinct selectors. Reject row/name selector equality, and require a read-only live `page 1 -> page 2 -> page 1` validation before claiming ranked pagination works.
- JavaScript emitted from Electron template literals must preserve regex backslashes in the generated page script. Add a regression or live-script check whenever pagination or picker regexes change.
- Interpret candidate ranks globally across the ordered result set, not relative to one page. `first 50` must continue through as many verified result pages as the current page size requires, while preserving the 50-creator run ceiling.
- A sanitized candidate response without trustworthy page metadata may be bound to the current page only when the visible paginator matches and multiple visible creator names match in order. Current-page React/Vue component rows are an allowed read-only fallback; never click the next page without a verified current-page anchor.
- Never navigate the protected collection tab to creator-detail, Xiaohongshu, or mail pages. Use explicit role tabs so PGY filters, page number, browser history, and scroll position survive the round trip.
- XHS contact reads must confirm the canonical target profile and stable visible snapshots while giving login/risk signals priority. A fixed sleep followed by one DOM read is not sufficient readiness evidence.
- Bind every XHS profile to the current PGY creator through provenance. PGY `blogger-detail` IDs and XHS `user/profile` IDs are different namespaces and must not be assumed equal. Accept a new profile only from the scoped XHS entry on the verified current PGY detail page, persist that source creator URL, and reuse it only for the same normalized PGY creator. Legacy same-ID rows may be reused conservatively; page-wide links remain invalid evidence.
- Do not claim XHS contact enrichment is accepted from unit tests or not-public samples alone. Run a logged-in, low-frequency installed-app check that includes at least one public-contact positive sample and records only sanitized aggregate outcomes.
- Long-running collection and contact jobs must expose requested versus effective control states. `pause requested` is not `paused`, and `stop requested` is not `stopped`; only mark the action effective at an interruption-safe point.
- Returning to PGY results must restore the protected collection tab and prefer its matching navigation-history entry. If only a fresh result URL can be opened, warn that filters, page number, and scroll position need operator recheck.
- Persist per-creator contact-enrichment outcome codes and readable failure messages. Do not collapse page-load, missing-profile-link, login, risk, timeout, and not-public outcomes into one generic failure.
- Calibration UX must always show the operator's current step and next verification action. Ranked collection is not calibrated until field/container selectors and a read-only cross-page round trip both pass.
- Do not treat a listening backend port as process identity. Packaged startup must verify the per-launch instance token and protocol version, and the desktop app must remain single-instance.
- Do not start Xiaohongshu enrichment as a side effect of opening enterprise mail. Contact enrichment and mail handoff are separate, explicit operator actions.

## Memory Update Rules

- Update `docs/project_memory/ACTIVE_CONTEXT.md` when current goals, environment state, or next steps change.
- Update `docs/project_memory/DECISIONS.md` when a meaningful architectural/product/security decision is made.
- Update `docs/project_memory/HANDOFF_TEMPLATE.md` only when the handoff workflow itself changes.
- Update `docs/project_memory/LEARNINGS.md` after a material Codex mistake or user correction.
- Keep memory concise enough for a new AI/helper thread to read in 1-3 minutes.
