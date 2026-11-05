# Windows Release Audit: 2026-10-12

## Objective And Boundary

Release only after critical workflows pass in the actual final installation, with no unresolved high-risk findings and explicit residual risks. Zero future defects cannot be guaranteed. The previous delivery goal remains unfinished; do not close it merely to create another goal. No invitations, existing-real-record changes, automatic test deletion, commit, push or Release upload.

Developer review covers data persistence, asynchronous run identity, authorization revocation, uncertainty, import/export and packaging. Operator review covers actual navigation, independent panes, protected search return, readable control states, editing and recovery. Private screenshots are transient tool observations, not saved evidence; a complete durable screenshot audit is not claimed.

## Current Evidence

| Gate | Result | Evidence / Limit |
| --- | --- | --- |
| Branch and workspace | Checked | Dirty main, ahead2 of cached origin/main; preserve existing staged/untracked work, no fetch |
| Source regression | Pass | Final full pretest/test chains pass after F11; review30 including Chrome100-row editing, backend136, renderer91, main contact scope4/review IPC3 and quotes4 pass. Final independent focused3 plus signature/edit-back/blocked-edit probes found no new scoped P1/P2 |
| Final candidate artifact | Pass, isolated |0.1.72 ten source/ASAR modules match; bundled backend EXE/Python312 DLL match existing build; native pointer/keyboard divider/reload and zoom0.75/1/1.25 alignment pass in DNS-blocked isolated profile, not real-account acceptance |
| Actual installation | Gap | Actual ASAR0.1.70; candidate source0.1.72. Repairs are not installed; final preserved-data upgrade needs its own action-time approval |
| Backend process | Observed | Existing backend process listens on local8010; this alone is not per-launch health attestation |
| Actual pane resizing | Pass, bounded | Both native dividers dragged independently in both directions; not final-package zoom/restart acceptance |
| Actual team lookup | Pass, readonly | Fresh five-row query completed5/5 in installed0.1.70; no application or cloud creation |
| Calibration interface / live round trip | Pass, bounded | Actual0.1.70 current page20 rows/20 names, then page1 ->2 ->1 verified20/20 and20 detail IDs; saved live validation, final page1 returned. Does not prove ranked35-50 or full50 intake |
| Protected search return | Pass, bounded | Actual return control selected existing protected collection tab; fresh final screenshot confirmed loaded PGY search. Arbitrary filter combinations not retested |
| OS encrypted connection | Pass, isolated | Existing cross-process safeStorage fixture passed with fictional data in its temporary profile after authorized sandbox-isolation retry. Not actual installed upgrade/restart acceptance |
| Cloud create/readback/cleanup | Pending | Prior single-row evidence does not prove positive bulk writes or software DELETE. Previously deleted tests must not be deleted again |
| Strict MVP checker | Blocked | pass32/fail0/block1: missing sanitized live-validation record; checker does not cover all new Feishu gates |
| Colleague/clean-machine distribution | Pending | Signing/SmartScreen, clean-machine installation and colleague workflow are separate gates |

## Reproduced Findings And Repair Scope

| ID | Priority | Finding | Source status |
| --- | --- | --- | --- |
| F1 | P1 | Settled autosave failure can be forgotten at run switch, discarding manual edits | Source regression passes: dirty state survives failures, explicit successful save required before unsafe switch |
| F2 | P1 | Broken review JSON becomes empty state and refresh can overwrite it | Source regression passes: only direct ENOENT permits empty state, bounded read errors, validate before atomic temp/rename save; no actual Windows ACL fault injection |
| F3 | P2 | Export chooses the current run after waiting for another run's save | Source regression passes: captured run/generation, rows/settings snapshot and stale DOM guard |
| F4 | P2 | Workbook import claims saved success despite failed persistence | Source regression passes: verified save result, retained dirty edits and late-picker scope guard |
| F5 | P2 | Late XHS contact event can apply/save against another run with the same rowId | Source regression passes: UUID/run/generation progress and final/control scope, active-task switch gate |
| F6 | P2 | Autosave rerender collapses contact editing and interrupts focus | Source Chrome100-row regression passes: session reading/focus/caret preserved separately from authority |
| F7 | P2 | Disconnect/forget storage failure leaves old session/write authority live | Backend136/renderer91 and independent review pass: immediate revocation even on busy/storage error; failed persistence may restore saved connection after process restart |
| F8 | P2 | Explicit invalid review target silently falls back to the first run | Main IPC3 red ->3 green; invalid supplied target rejected, canonical response scope and safe errors retained |
| F9 | P2 | Known unavailable quote text is rejected as an invalid price | Exact paused-orders text recognized as unavailable/null, not zero; quotes4 pass, update cannot clear an existing price |
| F10 | P2 | Old preview in A ->B ->A, or overlapping same-run refresh, can overwrite and save newer rows | Source regression and independent review pass: run generation/request serial checked at load, preview, save-status and approval await boundaries. New29 review tests include late load; pre-fix counterexample dropped2 rows to1 |
| F11 | P2 | Editing during pending approval restores an old check and clears a newer failed-save hint | Source red ->green regression: capture edit generation and approval input signature; discard obsolete checks and prevent preview finalization from clearing newer status. Backend already rechecks fingerprint; this was misleading UI, not an authorization bypass |

These are isolated source counterexamples, not claims of new real-data loss. Only fictional fixtures were used for failure injection. No real broken file was repaired, overwritten or deleted.

Earlier0.1.72 builds were withheld when F10 and F11 appeared. The intermediate SHA256cb729b228886e0a16be457f00ff8bb7054d3f650d0470a01ce3b2e53630aacb3 is NOT the final candidate. Final installer at desktop-app/dist-release-audit-0172 is109695525 bytes/SHA2568bc75ab4d98cd3250c15ea46b3f50d3d331ca526e299f185541f7dbcc8511916. Version text alone cannot distinguish held artifacts. Final independent F11 review passed; source fixes do not close installed/live/distribution gates. Installation approval requested, not answered at this checkpoint; no installation/cloud mutation/invitation/commit/push/Release occurred.

## Next Acceptance

1. Obtain exact preserved-data upgrade confirmation and verify actual installation; retain saved connections, profiles, lists and templates. Verify final hash above before launch.
2. Verify positive marked batch writes/readbacks only after genuine contacts/quotes, exact scope and action-time approval. Unavailable quotes are not zero; unknown results never auto-retry. Cleanup is last and separately approved. Retire already-deleted owned objects through readonly absence checks, never a second DELETE.
3. Complete current collection/pagination/contact/import/export/restart/stop evidence and report remaining distribution limitations before delivery. Do not fill a passing live-validation record from old counts or fixtures.
