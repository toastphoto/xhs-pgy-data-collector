# Pugongying Anti-Bot Safety Audit

Last reviewed: 2026-07-02.

## Position

This project should reduce platform-risk exposure through conservative, operator-controlled behavior. It must not become a stealth crawler.

Allowed direction:

- Use the visible Electron `BrowserView` as the main product path.
- Keep manual login, manual search, and human intervention for risk-control pages.
- Run creator collection serially with conservative delays.
- Stop when login, captcha, safety verification, or frequent-operation hints appear.
- Preserve evidence and quality reports for operator review.

Not allowed direction:

- Do not bypass captcha, login, risk control, or rate limits.
- Do not add stealth webdriver patches, browser-fingerprint spoofing, proxy rotation, or cookie/session manipulation to the main product.
- Do not increase concurrency for Pugongying collection.
- Do not treat "not detected" as a guarantee. Live platform risk is volatile and must be rechecked.

## Current Mainline Assessment

Main path checked: `desktop-app/`.

Lower-risk traits already present:

- Electron `BrowserView` is visible and uses a persistent browser profile.
- Collection is serial through `desktop-app/lib/task_runner.js`.
- Operators manually log in and can pause/resume/skip.
- The runner pauses when login is missing.
- The app stores local run evidence and quality reports.
- The task page performs pre-run login and candidate checks.

Risks found and reduced in this pass:

- Previous wait presets were too fast for a conservative workflow.
- The old "fast" preset could make navigation look automated.
- The runner had no single-batch safety ceiling.
- Login check did not explicitly detect visible risk-control text.
- Legacy `content-analyzer/` Selenium code contained webdriver hiding and random user-agent behavior.
- The bundled default template still enabled note-link click completion, so manual "test current creator page" could click page cards even though batch tasks disabled it.
- Recording replay was a low-frequency automatic navigation/click/input entry and did not explicitly stop on visible risk-control text.
- Hidden task payload fields could still weaken safety if called directly: `allowLargeBatch` could bypass the 50-creator ceiling, and `payload.options` could shorten tab waits or re-enable note-link click completion.
- Legacy compatibility utilities still exposed parameter-level bypasses: `BaseCrawler(use_proxy=True)` could bypass the global proxy gate, `BrowserEngine(headless=True)` could bypass the global headless gate, and `helpers.py` initialized random User-Agent/proxy helpers outside the static audit surface.
- Legacy Selenium browser engines still had some nonstandard browser flags or preferences enabled by default, such as disabling web security/site isolation or images, which can make a browser look less like a normal operator-driven session.
- The normal task UI still exposed a "faster" preset, which could nudge operators toward speed even if the preset remained capped and jittered.
- The legacy FastAPI backend still exposed `/api/crawl/start` and `/api/prelogin/*` as direct crawler/prelogin endpoints while the backend is launched with the Electron app. That created a bypass around the newer Electron BrowserView task runner safety rules.
- The legacy backend default host was still broad enough for standalone runs, and the root page could still show the old crawler UI even when the old API was disabled.
- The normal UI hid the faster preset, but direct task payloads could still request `presetKey: "fast"` and get a shorter internal wait profile.
- Direct `pgy:extractCurrentMultiPage` calls were looser than queued tasks: callers could request shorter tab waits or enable note-card click completion through options/template fields.
- Legacy `content-analyzer/README.md` and `content-analyzer/docs/SECURITY_IMPROVEMENTS.md` still described older crawler-evasion ideas such as fingerprint spoofing, proxy rotation, headless crawling, speed tuning, cookie handling, and account-risk workarounds.
- The live-validation record was manually fillable but did not force the operator to capture current branch/worktree, running Electron/backend PIDs, static safety audit, and runtime backend safety probe before real-account testing.
- Back-to-back batches were still possible immediately after a queue finished, which could create a machine-like cadence even when each individual batch was serial and delayed.
- Risk-control text detection covered basic captcha/safety words but missed common variants such as human verification, drag-slider prompts, access-abnormal pages, login-expired prompts, busy/retry pages, and English rate-limit text.
- Batch tasks accepted arbitrary `http(s)` URLs, which made the PGY workbench behave too much like a generic browser automation runner if an operator pasted or imported the wrong link.
- Direct "test current creator page" extraction could still run if the right-side BrowserView was on a non-PGY page, even after queued task URLs were allowlisted.
- Recording replay could still be used as an automatic navigation/click/input runner on non-PGY pages, bypassing the narrower batch/direct-extraction URL boundaries.
- Recording capture could still be started on non-PGY pages, which could save unrelated webpage clicks/inputs and make the tool look like a generic recorder rather than a Pugongying troubleshooting utility.
- Page-calibration annotation tools could inject overlays, scan page blocks, or suggest note-card selectors on non-PGY pages. Even though this is a setup helper rather than batch collection, leaving it unrestricted would make the app feel like a general webpage inspection/automation tool.

Changes made:

- `desktop-app/lib/task_runner.js`
  - Standard wait is now conservative and jittered.
  - The old `fast` preset is no longer an actual speed profile; legacy `presetKey: "fast"` payloads normalize to `standard`.
  - Single batch is capped at 50 creators by default.
  - Risk-control text from `pgy:checkLogin` pauses the queue for manual intervention.
  - Hidden large-batch bypass is removed; the 50-creator ceiling is unconditional in the task runner.
  - Payload options can make tab waits slower, but cannot shorten waits below the preset or re-enable note-link click completion.
  - A completed batch now starts a 5-minute cooldown. Immediate back-to-back starts are rejected with `PGY_RUN_COOLDOWN`.
  - Batch cooldown is persisted in the local runs directory as `.pgy_task_cooldown.json`, so restarting the Electron app does not clear the wait boundary.
  - Batch tasks now reject non-PGY task URLs with `PGY_TASK_URL_NOT_ALLOWED`; automated collection is limited to `pgy.xiaohongshu.com`.
- `desktop-app/renderer/views/tasks.js`
  - The pre-run panel now shows the recommended batch size, hard single-run ceiling, serial/random-delay behavior, and risk-page pause behavior before the operator starts collection.
  - The pre-run safety notice now tells operators to keep at least 5 minutes between batches and mentions broader risk hints such as human verification and access-abnormal pages.
  - The normal collection preset dropdown now exposes only `标准（保守）` and `更保守（更慢）`; speed-seeking presets are not shown in the operator flow.
- `desktop-app/main.js`
  - `pgy:checkLogin` now returns `riskDetected` and `riskText` for common captcha/safety/frequent-operation hints.
  - Risk detection now includes broader visible hints: human verification, identity verification, drag-slider prompts, access-abnormal pages, account/login-expired prompts, busy/retry pages, English verification/captcha/security-check text, and `too many requests`.
  - Direct `pgy:extractCurrentMultiPage` calls now reject non-PGY current pages with `PGY_CURRENT_URL_NOT_ALLOWED` before creating run output.
  - `pgyExtractCurrentMultiPage` rechecks risk-control text before extraction, after tab clicks, before optional note-link resolution, and before writing results. If risk text appears mid-run, extraction returns `PGY_RISK_DETECTED` so the queue pauses for manual intervention.
  - Direct extraction now keeps a conservative `PGY_MIN_TAB_WAIT_MS=2500` floor even when called outside the task runner.
  - Extraction keeps `resolveNoteUrlByClick=false` unless the explicit local research switch `PGY_ALLOW_NOTE_CLICK_RESOLVE=true` is set, and even then caps note-card click completion at a small limit.
  - Recording replay now checks risk-control text before and after navigation/click/input actions and stops with `PGY_RISK_DETECTED` instead of continuing automation.
  - Recording capture now uses the same PGY current-page guard: recording cannot start on a non-PGY page, and non-PGY navigation/click/input actions are ignored while recording is enabled.
  - Page-calibration annotation IPC entrypoints now use the same current-page PGY guard. `pgy:pickElement`, `pgy:scanPageBlocks`, and `pgy:suggestNoteCardSelector` return `PGY_CURRENT_URL_NOT_ALLOWED` before injecting page overlays or selector-suggestion scripts on non-PGY pages.
- `desktop-app/templates/default_pgy_v1.json`
  - Built-in `resolveNoteUrlByClick` is now `false`.
- `content-analyzer/app/utils/config.py`
  - Legacy browser defaults to visible mode (`HEADLESS=false`).
  - Stealth/evasion behavior is disabled unless `ALLOW_STEALTH_EVASION=true` is explicitly set.
- `content-analyzer/app/core/browser_engine.py`, `content-analyzer/app/core/enhanced_browser.py`, `content-analyzer/app/core/base_crawler.py`
  - Webdriver hiding and random user-agent behavior are gated behind `ALLOW_STEALTH_EVASION`.
- `content-analyzer/app/utils/helpers.py`
  - ProxyPool is inert unless `ALLOW_STEALTH_EVASION=true`.
  - Random User-Agent loading is lazy and returns a stable default UA unless `ALLOW_STEALTH_EVASION=true`.
  - `fake_useragent` is no longer imported during normal helper module import.
- `content-analyzer/app/core/base_crawler.py`
  - `use_proxy=True` can no longer bypass the explicit `ALLOW_STEALTH_EVASION` gate.
- `content-analyzer/app/core/browser_engine.py`
  - `headless=True` can no longer bypass the explicit `ALLOW_STEALTH_EVASION` gate.
  - Nonstandard Chrome flags that disable web security or site isolation are gated behind `ALLOW_STEALTH_EVASION`.
- `content-analyzer/app/core/enhanced_browser.py`
  - Nonstandard certificate/image-disabling behavior is gated behind `ALLOW_STEALTH_EVASION`.
- `content-analyzer/app/utils/config.py`
  - Added `ENABLE_LEGACY_CRAWL_API=false` by default, plus small-batch limits for old API compatibility mode.
  - `API_HOST` now defaults to `127.0.0.1` so standalone backend starts remain local by default.
- `content-analyzer/app/api/server.py`
  - `/api/crawl/start` and `/api/prelogin/*` now require `ENABLE_LEGACY_CRAWL_API=true`.
  - Even when explicitly enabled, old crawl tasks are capped by `LEGACY_CRAWL_MAX_URLS` and `LEGACY_CRAWL_MAX_CONTENTS`.
  - `/api/config` exposes whether the old crawl API is enabled, and the runtime config POST only echoes configuration instead of changing safety boundaries.
  - The root page shows a disabled legacy-collection notice while `ENABLE_LEGACY_CRAWL_API=false`, instead of loading the old crawler UI.
- `desktop-app/tests/task_runner_safety.test.js`
  - Guards the conservative wait floor, disabled note-link click completion, PGY task URL allowlist, 50-creator batch ceiling, in-memory and persisted 5-minute batch cooldown, no hidden large-batch bypass, legacy `fast` normalization to standard, no payload option bypass for click completion or shorter tab waits, pause-on-risk-page behavior before extraction, and pause-on-risk-page behavior reported from extraction.
- `scripts/audit_pgy_safety.py`
  - Static repository audit for the main anti-bot safety invariants: PGY task URL allowlist, direct current-page PGY guard, page-calibration annotation PGY guard, recording capture PGY guard, replay PGY URL guard, 50 creator ceiling with no hidden bypass, persisted 5-minute batch cooldown, conservative waits, jitter, legacy `fast` normalization to standard, no payload option bypass for click completion or shorter tab waits, direct extraction tab-wait floor, direct extraction note-click gate/cap, broader risk text detection, risk pause, extraction-time risk checks, disabled default note-link click completion, replay risk stops, UI safety notice, no visible speed-seeking preset, explicit gating for legacy stealth/proxy/headless/random-UA/nonstandard-browser-flag behavior, disabled-by-default legacy crawl/prelogin API routes, and legacy docs that no longer advertise old evasion guidance.
- `scripts/probe_pgy_runtime_safety.py`
  - Runtime probe for a running backend: checks proxy/headless off, legacy crawl API disabled, `/api/crawl/start` returns HTTP 403, and the root page shows the disabled legacy-collection notice.
- `scripts/prepare_pgy_live_validation.py`
  - Creates a sanitized schema-v2 live-validation JSON template with current branch/worktree note, Electron/backend PIDs, static safety audit result, and runtime backend safety probe result prefilled. This is the preferred starting point for real-account 3-5 and 10 creator validation.
- `scripts/validate_pgy_live_validation.py`
  - The live-validation schema is now v2 and requires precheck proof (`audit_pgy_safety_ok`, `runtime_probe_ok`, app process check, and git status check) before a completed record can pass. It also rejects placeholders, missing local timestamps, missing local evidence refs, ambiguous risk-stop methods, and private URL/secret shapes.
- `scripts/test_pgy_live_validation.py`
  - Focused tests ensure the validator accepts a sanitized completed record and rejects placeholder aliases, missing timing/evidence, ambiguous risk-stop methods, and private URL leaks.
- `content-analyzer/docs/SECURITY_IMPROVEMENTS.md`
  - Replaced the old evasion-oriented content with a deprecation notice that points to this audit and the live-validation protocol.
- `content-analyzer/README.md`
  - Replaced the old crawler README with a compatibility-backend README. It now documents the safe defaults (`API_HOST=127.0.0.1`, `ENABLE_LEGACY_CRAWL_API=false`, `ALLOW_STEALTH_EVASION=false`, `USE_PROXY=false`, `HEADLESS=false`) and tells operators to use `desktop-app/` as the product path.

## Current Score

- Product safety direction: 8/10.
- Mainline anti-risk posture: 7.8/10.
- Legacy compatibility layer posture after this pass: 6.8/10.
- Confidence that live Pugongying will never flag it: not claimable.

Why not higher:

- Live Pugongying DOM/risk behavior changes over time.
- The app still automates page navigation and DOM extraction after human-provided URLs.
- Legacy compatibility code still exists, though now more strongly gated and not the mainline.
- Real account behavior, search volume, and operator cadence matter as much as code.

## Required Live Validation

Before calling this safe enough for team use, recheck with a real account:

1. Open Pugongying manually in the Electron `BrowserView`.
2. Search and add 3-5 creators manually.
3. Run standard mode and confirm no risk-control page appears.
4. Run a 10-creator batch and inspect pauses, timing, and evidence.
5. Confirm the runner stops on login/captcha/safety verification pages.
6. Do not run large batches until the smaller validation is clean.

Record the result with `docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md` and validate the sanitized JSON with:

```bash
python3 scripts/validate_pgy_live_validation.py tmp/pgy_live_validation_YYYYMMDD.json
```

Do not commit the completed live-validation JSON if it contains run ids, evidence paths, or operator notes that could identify a private account or creator list.

## Required Static Validation

Run after every collection-speed, batch-size, browser-automation, proxy/headless, or risk-control change:

```bash
python scripts/audit_pgy_safety.py
```

Run against a started local backend when checking the live app process:

```bash
python scripts/probe_pgy_runtime_safety.py
```

## Operating Guidance

- Prefer batches of 10-30 creators for normal work.
- Use 50 as a hard single-run ceiling, not a target.
- Split larger candidate pools into multiple runs with breaks between them. The app enforces at least a 5-minute cooldown after a completed batch, including after app restart.
- Keep `resolveNoteUrlByClick=false` unless a specific low-risk need is validated.
- Do not use `PGY_ALLOW_NOTE_CLICK_RESOLVE=true` in normal team operation. It is only for isolated troubleshooting after risk review.
- Do not enable proxy rotation or stealth settings for production use.
- If a page shows verification, stop and let the operator handle it manually.

## Reevaluate When

- Pugongying changes login/risk-control behavior.
- The app adds search-result auto-pagination.
- The app adds background runs or scheduled runs.
- A teammate asks for larger batches, higher speed, proxies, headless mode, or stealth behavior.
- An official API or approved export path becomes available.
