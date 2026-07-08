# content-analyzer compatibility backend

This directory is the legacy Python/FastAPI compatibility backend used by the
Electron desktop app. It is not the current product surface for Pugongying
collection.

Current product direction lives in `../desktop-app/`:

- visible Electron BrowserView
- manual login and manual Pugongying search
- low-frequency serial creator collection
- small batches
- pause on login, captcha, safety-verification, or frequent-operation pages
- local evidence and quality reports for operator review

For the durable safety boundary, read:

- `../docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md`
- `../docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md`

## Safe Defaults

The backend now defaults to local and compatibility-safe behavior:

```env
API_HOST=127.0.0.1
API_PORT=8010
ENABLE_LEGACY_CRAWL_API=false
ALLOW_STEALTH_EVASION=false
USE_PROXY=false
HEADLESS=false
```

Normal team operation should keep these defaults.

The old `/api/crawl/start` and `/api/prelogin/*` routes are disabled unless
`ENABLE_LEGACY_CRAWL_API=true` is explicitly set. That compatibility mode is
for isolated troubleshooting only and must be re-evaluated against
`../docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md` before use.

## What Not To Do

Do not use this backend to add or document production behavior based on:

- stealth webdriver patches
- browser-fingerprint spoofing
- proxy rotation
- random User-Agent evasion
- headless batch crawling
- captcha/risk-control bypass
- cookie/session manipulation as a product workflow
- higher concurrency or speed-first scraping

These patterns increase operational and compliance risk and are outside the
current product boundary.

## Run Locally

The Electron app normally starts this backend automatically. For a manual local
check:

```bash
python main.py
```

Then verify the running safety posture from the repository root:

```bash
python scripts/probe_pgy_runtime_safety.py
```

Expected normal result:

- `/api/config` reports `use_proxy=false`, `headless=false`, and
  `legacy_crawl_api_enabled=false`
- `/api/crawl/start` returns HTTP 403
- `/` shows the disabled legacy-collection notice

## Validation

After any backend, crawl-route, browser-automation, proxy/headless, or
risk-control change, run from the repository root:

```bash
python scripts/audit_pgy_safety.py
python scripts/probe_pgy_runtime_safety.py
```

Static and runtime checks are not enough to claim live platform safety. Before
team use, complete the sanitized real-account validation described in
`../docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md`.
