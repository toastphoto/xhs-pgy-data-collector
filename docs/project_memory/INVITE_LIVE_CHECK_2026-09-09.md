# Installed Invitation Check: 2026-09-09

## Verdict

FAILED. This is an actual installed-app, logged-in PGY observation, not an intercepted page fixture. No final invitation send was clicked. Business code was not modified during this check.

## Checked Facts

- Installed executable metadata: `0.1.55.0`; visible UI: `v0.1.55`. Installed and packaged ASAR SHA-256 matched: `DA6416973F3070814B85DF06DD7380D8BE0E1A639F55251DFBEB0293B5B647E3`.
- The operator manually completed authentication and account-role selection. The invitation workspace showed an agency subaccount; the software's invitation-account check reported logged in. The separate collection workspace exposed a different account role. This does not replace a full cookie-isolation audit.
- Current selected collection result originally had 30 rows and no complete invitation fields. Another existing six-row result contained an old explicit no-send test template. No real contact detail was invented or copied into PGY.
- `Invitation account open` displayed the correct real creator detail page, but the software reported that the invitation page had changed or was still loading.
- Manual entry from that creator's invitation dialog reached the real detailed form, including brand selection, contact method, product, introduction, and date range. No final form submit was clicked.
- Software `Prepare invitation` repeated the creator-navigation failure. Retrying after the creator page stabilized opened the real detailed invitation form automatically, then failed with the same context-change error before verified fill/readback completed.
- A real two-recipient batch was started through the installed application's normal confirmation. It failed preparing recipient 1 with the same creator-navigation error and displayed handled `0/2`. The stop control then displayed `Batch invitation stopped`. Recipient 2 was not prepared, and no send-ready or successful-send result was observed.
- At the end, the stop state remained visible and temporary selections were cleared back to `0/6`. The six-row result remains open for inspection; no rows were deleted.
- Dragging the main separator from its exposed top edge changed the renderer workbench width, but the native browser did not align with that edge. A visible blank gap remained. The exact renderer zoom/DPI cause was not instrumented.

## Diagnosis Boundaries

- Login failure and high batch count do not explain this reproduction: login detection passed, and a two-person batch failed at its first navigation.
- The code path to investigate first is `loadPgyInviteOperationUrl`, `notePgyInviteNavigation`, `assertPgyInviteContext`, and the permitted entry-to-form transition in `desktop-app/main.js`.
- A late same-route SPA navigation after the navigation permit is cleared is a hypothesis, not a recorded event trace. Capture sanitized event kinds, relative timing, normalized route class, loading flag and ownership generation before naming the exact cause. Never log full creator URLs, account identifiers or request payloads.
- Do not bypass the guard, ignore ownership changes or extend every timeout blindly. Unexpected creator/form changes, login/risk pages and post-dispatch uncertainty must still stop execution.
- The original brand/date readback complaint remains unaccepted: this run hit an earlier blocker. The saved test brand and date range also require operator review before a positive fill test; a historical test template is not an approved business invitation.

## Next Acceptance Gate

1. Reproduce and fix the verified navigation false rejection with diagnostics and focused regressions; preserve recipient and navigation ownership checks.
2. Check renderer zoom and native BrowserView bounds together across default/non-default zoom, resize, divider drag and reload.
3. Upgrade and recheck the actual installed artifact, then repeat real creator-to-form preparation across two recipients. Obtain a current approved template for any real contact-data entry.
4. Stop before each final send unless the operator specifically confirms that recipient and content. Preparation success alone cannot be called batch-send acceptance.

No creator names, account identifiers, contact values, raw URLs, screenshots, browser profiles or cookies belong in this record. All runtime, remote and login observations are dated and require recheck.

## Local Verification

- Re-ran `desktop-app/tests/pgy_invite_ipc.test.js`: all 41 VM IPC regressions passed. They do not cover the observed live-platform failure and are not evidence that it is fixed.
- Ran `scripts/verify_project_memory.py`: passed using the bundled Python executable because `python` is not on the current shell PATH.
