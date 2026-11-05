# Invitation Repair: 2026-09-10

## Scope And Review

Continued from the failed installed 0.1.55 check in `INVITE_LIVE_CHECK_2026-09-09.md`. One delegated agent implemented/tested zoom geometry; another independently reviewed navigation guards. Parent integrated repairs, regression tests and packaging. Branch `main`, HEAD `0342968`, dirty checkout; no fetch, commit, push or Release upload.

- Owned creator/form navigation may finish canonical same-document bootstrap before reads. Settling requires 750 ms quiet within 3 seconds; the complete URL load is bounded by 25 seconds. A timeout stops the load and releases ownership without authorizing a late draft.
- Review caught an aborted-load fallback that skipped settling and an unbounded `loadURL` await; both now have focused regressions. Other network failures are not promoted to success.
- Full reload, wrong creator/form, page replacement, post-read navigation and uncertain submission retain fail-closed behavior. Sanitized context-change errors identify operation/reason/event type.
- BrowserView geometry converts CSS coordinates using trusted main-renderer zoom. Stored widths, account partitions, collection/calibration policy and final send confirmation are unchanged.

## Verified Locally

- All 42 desktop test commands plus renderer syntax and 9 layout cases passed. Includes 47 VM IPC and 45 renderer batch regressions. Layout covers 0.75, 1 and 1.25 zoom, resize, narrow windows, persistence and invalid inputs.
- Used bundled Node with the existing dependency tree. Bundled pnpm 11 attempted an automatic dependency reinstall initially; it was aborted without purging modules. Reran with `pnpm_config_verify_deps_before_run=warn` and pre/post scripts enabled. This does not claim a fresh dependency installation.
- PGY safety audit passed. Both Electron DOM and full flow entrypoints failed before producing page-test outcomes; Playwright reported process exit 1 before launch completed. Enabling network access did not resolve it. The cause is not established. New real-Electron bootstrap/zoom cases remain unverified.
- Built NSIS x64 using the existing unchanged PyInstaller backend, not a backend rebuild. Its executable and `python312.dll` matched the prior packaged copies; all 115 backend files match the newly packaged resources byte-for-byte. Project-memory verification and `git diff --check` also passed.
- Packaged ASAR matches eight key source files byte-for-byte; runtime manifest version/name/main/dependencies match. Test/script/prior build directories are excluded. Installed EXE metadata remains 0.1.55.0, not this artifact.

## Artifact

- Installer: `desktop-app/dist/小红书相关信息采集工具-0.1.56-windows-x64-setup.exe`
- Size: 109,712,483 bytes; unsigned.
- SHA-256: `FC9786B6C440F139229A063886581E945F7F19F0AEDEBEF27EE786D727BBD395`
- ASAR SHA-256: `D4BA8820E2E68A6734AD4560A8C60E498A5B2F3E93972922D236809F1DAB65C3`
- Recheck these values after any rebuild. Build command: `node node_modules/electron-builder/out/cli/cli.js --win nsis --x64 --publish never` from `desktop-app`.

## Still Required

Install with operator confirmation; compare installed version and ASAR. Recheck both account roles without copying credentials. Use the real PGY page to verify creator navigation, detailed form entry, current brand/date/contact readback, a two-recipient queue and effective stop. Stop before final sending unless that exact action is separately confirmed. Repeat splitter alignment at operator zoom. No real invitations were sent today. The last real-account verdict remains FAILED, not silently replaced by this build.
