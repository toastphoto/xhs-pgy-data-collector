# Deprecated Legacy Security Notes

This file intentionally no longer contains the older crawler-evasion notes.

The current Pugongying product safety direction is documented in:

- `../../docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md`
- `../../docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md`

Current direction:

- use the visible Electron BrowserView as the product path
- keep manual login and manual Pugongying search
- run creator collection serially and slowly
- keep batches small
- pause on login, captcha, safety-verification, or frequent-operation pages
- preserve local evidence and quality reports for operator review

Do not reintroduce the old ideas into the product path:

- stealth webdriver patches
- browser-fingerprint spoofing
- proxy rotation
- random User-Agent evasion
- headless batch crawling
- captcha/risk-control bypass
- cookie/session manipulation as a product workflow
- speed-first scraping or higher concurrency

If an isolated compatibility experiment needs any old Selenium route, first
read `../../docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md`, keep
`ENABLE_LEGACY_CRAWL_API=false` for normal operation, and record the reason for
any exception in project memory.
