# Invitation Review: 2026-09-08

Scope: Windows 0.1.54 invitation preparation, final readback, batch queue, and the unfinished local patch. Base commit: `0342968`. User clarification: manual submission in the PGY website works; software single-recipient submission was not independently confirmed.

## Findings And Evidence

| Priority | Defect | Reproduction / impact |
| --- | --- | --- |
| P1 | Field reading depended on viewport visibility and disappearing placeholder text. | Old emitted script fails on an unchanged local form after scrolling to its final button. Labels/fields must remain readable offscreen; missing selectors are not proof of changed data. Exact current PGY DOM still needs live recheck. |
| P1 | Unfinished patch accepted stale attributes, ancestor date text, or unselected brand text. | A changed or empty field could match its prior HTML value. Replace that fallback with current field values and scoped, rendered brand selection; retain exact non-date comparison. |
| P1 | Batch replies were applied to mutable current batch/recipient state. | Mocked delayed sends plus template changes/restart can update the wrong recipient. Bind every operation to its original run, recipient, revision and batch. |
| P1 | Main-process preparation had no exclusive operation ownership. | Mocked overlapping preparation and creator navigation can misattribute a form to the prior creator. Guard before awaiting and verify page identity/generation. |
| P1 | Final click used coordinates after asynchronous verification without rechecking navigation. | Mocked navigation during readback can move the page before dispatch. Check the same WebContents, form and navigation generation immediately before input. |
| P1 | Post-click inspection exceptions were reported as retryable send failures. | Mocked inspection exception after one click returns a failure although submission may have occurred. Preserve uncertainty and require outcome review. |
| P2 | Start, stop and exceptions did not consistently settle queue state. | Mocked double-start, late replies after stop, and rejected preparation produce overlap or stuck states. Reject duplicate operations and settle the owning operation only. |
| P2 | Success detection matched substrings anywhere in page text. | `未发送成功` could be treated as success. Accept only a rendered, exact success status; other results remain unconfirmed. |

## Verification Boundary

- Tests use fictional creators and local fixtures or mocked IPC. No real invitation is sent by these tests.
- DOM regression exercises actual Electron rendering, scrolling, date-hint removal, current-value changes, stale attributes, unselected/hidden brand text, overlays, and prepare-to-verify continuity.
- IPC and queue tests exercise delayed/rejected promises, target changes, duplicate attempts, template edits and requested/effective stop states.
- Packaging, installed version, current login, platform DOM and real send outcomes must be recorded separately after verification. Do not infer live acceptance from these fixtures.

## Local Result: Windows 0.1.55

- All 42 desktop test commands plus renderer syntax passed; this includes 41 IPC regressions and 45 batch regressions. PGY safety audit passed.
- All 16 real Electron DOM fixture scenarios passed against both source and the packaged ASAR module.
- Source and packaged executables each passed two direct IPC recipient flows plus a separate two-recipient run from the real renderer batch button. Preparation dispatched no sends, each confirmation dispatched one local click, the queue completed `2/2`, and replayed confirmation tokens were rejected.
- Isolated packaged splitter acceptance: sidebar `250 -> 317`, main `996 -> 933`, keyboard `933 -> 913`, both persisted widths restored after reload. Six relevant ASAR source files match the checkout byte-for-byte; tests and build outputs are excluded. The bundled backend includes `python312.dll` and was reused unchanged.
- Integration caught and repaired a guard regression: `loadURL()` resolves before `isLoadingMainFrame()` necessarily clears. The bounded settle wait retains identity checks and fails closed on timeout.
- Installer: `desktop-app/dist/小红书相关信息采集工具-0.1.55-windows-x64-setup.exe`, 109,712,698 bytes. SHA-256: `34939872C90D5113F38EE10BA131B3C45DBFA12DAE2C74956D86E71FE04D5411`.
- ASAR SHA-256: `DA6416973F3070814B85DF06DD7380D8BE0E1A639F55251DFBEB0293B5B647E3`. Installer is unsigned. Installed metadata still reports `0.1.54.0`; 0.1.55 installation and real-account form/send validation remain pending. No real send, commit, push or Release upload in this review.
- Final memory verification and safety audit passed. MVP readiness reports `pass=32 fail=0 block=1 warn=0`; the formal sanitized live-validation record is still absent, so this is a trial repair build, not full-product acceptance.
