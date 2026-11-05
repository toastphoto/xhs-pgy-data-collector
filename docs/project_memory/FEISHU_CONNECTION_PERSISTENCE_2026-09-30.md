# Feishu Connection Persistence

## Requirement And Root Cause

User explicitly requires default remembered connection across restarts/upgrades, not just a default page URL. Previous workbench had session-only credentials and before-quit memory clearing, with no credential store. Old cleared values cannot be recovered from that implementation; do not ask for repeated auth-only runs or invent/reuse an outdated secret.

## Implementation (0.1.62)

- Main-process Electron safeStorage encrypts the five connection fields into userData/feishu_sync/connection.bin. Atomic replacement; no plaintext fallback, renderer credential readback, source secrets, packaged credentials or saved API tokens.
- Successful explicit connection remembers by default. Startup restores authentication/metadata only; token expiry can refresh credentials but clears old business previews/person authority. No automatic business writes or retry of uncertain writes.
- Disconnect retains the encrypted profile and pauses automatic connection. Explicit saved-profile reconnect resumes it. Forget deletes only that connection file after UI confirmation, not the test journal/browser cookies/runs/templates.
- Saved actor/target must match before an existing session is reused. Automatic restoration failure retains the file and exposes an explicit retry; it does not loop in the background.
- Windows encryption is local-user protection, not protection from other programs running as the same user. Encryption state depends on the unchanged Electron userData profile; do not move/delete Local State or profiles during upgrades.

## Verified 2026-09-30

- 55 focused store/workbench/renderer/IPC tests passed, including restart, actor mismatch, suspend/forget, failures and expired write-approval rejection. All 47 existing package script commands passed; PGY safety audit passed.
- Actual Electron 30.5.1 Windows safeStorage encrypted fictional config in one process and decrypted it in another with the same isolated profile; suspend/forget and absence of plaintext passed. Test initially used app.exit, causing unflushed encryption state/native exit problems; normal app.quit passed. No real credentials were used.
- Source Chrome/Playwright fictional UI regressions passed widths 950/650/400 plus saved-connection restoration without filling, disconnect/reconnect/forget. No real Feishu business requests; saved-state 650px screenshot inspected.
- NSIS 0.1.62 built and installed normally (exit 0). Five runtime files match source; installed ASAR matches built ASAR, version 0.1.62, bundled _internal/python312.dll verified. Native installed UI shows v0.1.62/service normal and remembered-connection checkbox; existing result selector loaded.
- Installer SHA256: e4c9db27efbf1d04346a1a71641ab36370b1d8793535d19c9bed6b6044a28bd5.
- Initial post-install UI had no saved connection because the prior version never persisted it. This initial pending state is superseded by the real restart acceptance below; old cleared values were not recovered.

## Real Installed Restart Acceptance (2026-09-30)

- User reported configuration entered. Read-only native status of the actual installed 0.1.62 main window confirmed connected, 27 fields and saved local connection before closing.
- Closed normally with Alt+F4 and verified the old window disappeared (an immediate inventory was stale; later inventory was empty). Read-only file check confirmed the exact encrypted connection file exists/nonempty after exit; no file contents/decryption/credentials printed.
- Relaunched the actual installed executable. New window identity and visible 0.1.62/service-normal state confirmed a genuine new main process/window rather than a stale rendered session.
- Entered Review/Outreach without any text input, connection-button click or credential copying. Automatic authentication/schema restoration returned connected, saved local connection, 27 fields and zero visible FEISHU error codes. No fictitious transport or page used for this gate.
- Accepted: genuine-account normal restart restoration in the installed main software. Not accepted by this test: upgrade AFTER a saved profile, cross-computer migration, person/role query, contact application, cloud CRUD, invitations or full UX delivery. No such business operations, commit/push/build/install/config edits occurred in this follow-up. Actual credential values were not read/exposed.

## Next Gate

Keep the verified connection/profile intact and recheck actual window/version/status without exposing credentials before further work. Continue the existing manual-maintainer and marked CRUD acceptance, with exact write/cleanup confirmation and notification-safety checks. Do not repeat credential entry or use this restart result as proof those business gates passed.
