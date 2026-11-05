# Browser View Lifecycle Repair, 2026-10-16

## Scope And Findings

User screenshots show raw `isDestroyed` TypeErrors in `invites:openCreator` and `browser:activateTab`, plus repeated error panels consuming workbench columns. These are program errors, not evidence that invitation approval rules are too strict. Teammate version is unverified; user replied only that it should be this version. Feishu CHECK_TIME_EXPIRED is a separate workflow.

Native isolated Electron30.5.1 reproduces an absent BrowserView.webContents after actual WebContents destruction. Old guards dereference it; background views participate in every layout calculation. Electron30.5.1 BrowserWindow.removeBrowserView also accesses BrowserView.ownerWindow, which dereferences contents. Cleanup only after destroyed can therefore fail to detach the native view and poison later reconstruction.

Source changes: safe live-contents checks in factories/activation/layout/interaction locks; identity-checked retirement; internal registry discard independent of protected user close; detach before deliberate destruction. The version-pinned internal will-destroy event detaches unexpected teardown before contents disappear; destroyed remains a fallback. Clear invitation draft/document proof and invalidate captured operations; never rebind old send authority to a replacement. No session/profile deletion, cookie copying, sending or retrying unknown sends.

Runtime errors now update one dismissible fixed notice outside the workbench flex layout. Startup and runtime errors are distinguished; no npm installation instructions for end users. Concurrent experimental UI branch/assets are preserved, not approved for shipping with this fix.

Upstream implementation evidence, recheck on Electron upgrades:
- https://github.com/electron/electron/blob/v30.5.1/lib/browser/api/browser-view.ts
- https://github.com/electron/electron/blob/v30.5.1/lib/browser/api/browser-window.ts
- https://github.com/electron/electron/blob/v30.5.1/shell/browser/api/electron_api_web_contents.cc

## Evidence And Limits

- 105 invitation IPC VM cases passed, including absent contents, late old-view events, operation destruction and old-token rejection. Complete configured pretest7/test42 commands passed. Resource blank-page VM fixtures needed the real helper dependencies after refactoring.
- Native local-only receipt `pgy-invite-flow-SwCnSc/result.json` passed six actual background destructions plus invitation close/recreate cycles, singleton/dismissible error notice with unchanged console width/children, three direct preparations, three same-batch unsent preparations, three fictional sends/replay protection, splitters/reload/three zoom factors.
- Earlier gpRPIq failed by inspecting contents before asynchronous destruction completed. 0mqh09/jBHUQ8/eohUq5/2A4dEy/gE2pLx/7Kc8QN/XUaosP failed during later reconstruction; XUaosP recorded native exit4294930435. Waiting or deferred post-destroy cleanup alone did not fix it. SwCnSc passed only after adding pre-destruction detach. Diagnostic logging and extra sleep were subsequently removed; final artifact regression is still required.
- All pages in these native tests are local intercepted fixtures with a fresh temporary profile and blocked external DNS. They demonstrate program behavior, not real PGY brand selection, sending, teammate-machine recovery or production acceptance.
- Installed ASAR was independently read today: version0.1.95,62169693bytes. Source still0.1.96 with unshipped local fixes. No new installer, installation, Git commit/push or real account action this turn.

## Next Gate

Package only the known delivered UI plus narrowly scoped fixes, preserving separate experimental UI work. Verify the exact artifact, then obtain upgrade approval and validate consecutive real-recipient preparation in the installed app without final send. Real brand choice and teammates' exact versions remain open. User explicitly challenged fixture-only validation: never label it real-account acceptance.
