# Invitation Document Recovery

## Report And Evidence

User reports that collection-view, invitation-view and prepare must be clicked manually for each creator, whereas batch preparation fails on the next creator with the missing-target-load message. These are not three required human approvals: batch and individual preparation use the same openCreator then prepare calls. Collection viewing uses another account partition and is not an invitation prerequisite.

The reported message is emitted when loadURL resolves without a recorded document commit. It does not establish the live current URL or explain every platform redirect. A new VM red test reproduced the exact error for a resolved load at the correct creator URL with only same-document navigation. Independent review also reproduced a second-call bypass: the old guard forgot the failure and accepted URL equality on the next open/prepare without any commit.

Readonly installed0.1.92 observation in this turn: app had no open window, launched existing installation; switched composer mode to PGY and opened one creator without template fill or send. The invitation view ended on the public login landing page. Human login requested. This local account state is not proof of the teammate's cause. No authentication automated, no real form filled/sent or Feishu mutation.

## Source 0.1.93

- Actual document commits create WebContents-bound creator-document proof. New-document start, route change and view replacement invalidate it. URL equality cannot revive it across calls. Direct prepare requires proof before entry controls.
- Only a normal resolved explicit creator load, exact target/default HTTPS origin, idle main frame and unchanged context can attempt one preparation-only reload after risk inspection. Must then observe real document commit and stable target. Abort/network failure, other target, account/form/submitted operations and send never get this recovery.
- Risk reads have an8-second bound, shared with the navigation25-second deadline during recovery. Check absolute time before/after read and before reload; late results cannot resume. Reload waits at most8seconds within the remaining navigation budget. These bounds do not claim to limit every later entry/fill script.
- Recovery failure retains the no-proof state; clicking again cannot prepare stale DOM. Unknown send results and single-use confirmations retain existing protection. View buttons remain optional; tooltips state this without adding steps.

## Verification

IPC88/88 and account-isolation regression pass. Updated old static tests to require the new proof-aware condition and preserved context assertions, rather than treating code shape as behavior. Full configured test chains and final artifact native receipt are recorded in ACTIVE_CONTEXT.

Independent review closed the cross-call bypass, hanging risk read and subsequent deadline gaps. Reviewer independently ran88 IPC tests and account isolation; no remaining blocker in that bounded scope.

Candidate native fixture passed direct and renderer-batch second-creator fault injection using a real Electron history event followed by real reload/commit. All fixture PGY traffic is locally intercepted and all recipients fictional; this proves recovery logic, not the original live platform event sequence. Intermediate candidate is not the deliverable. Final package/real-account gates remain distinct.

## Final Artifact And Remaining Live Gate

- Final full configured chains: pretest7/7 and test42/42 PASS; PGY safety audit PASS. Final package unchanged native rerun PASS at temporary `pgy-invite-flow-cwbp2Q/result.json`:3 direct/3 renderer-batch, second-recipient no-commit injection and real reload/commit, replay rejection,100-row list8298/outer1814 unchanged, slow typing/persistence/order, splitters/restart and zoom0.75/1/1.25. No real invitation was sent. Earlier final runs failed zoom alignment and page-closed respectively; no proven cause, retained as unresolved environment/test interference evidence, not silently erased by the successful rerun. Main-renderer Playwright screenshots do not capture native BrowserView pixels.
- Deliverable: `desktop-app/dist-invite-document-0193-final/小红书相关信息采集工具-0.1.93-windows-x64-setup.exe`;109721428 bytes; SHA256 `86cf3439d8f10b1526af366903be5c674d13d9d962b1cdcb8fe2ee08a9ef6c94`. ASAR62167497 bytes/SHA256 `7a7591177ee6b4b836f729536eb130409f4d507864adb50912e8c2231d785477`;72 application assets and115 bundled backend files match, Python runtime included, unsigned. Candidate directory is withheld. No installation/commit/push/Release.
- Human logged into the installed0.1.92 invitation account. One coordinate action selected collection viewing instead of the intended invitation button; switched to explicit accessibility controls and did not treat it as a successful invitation test. First actual invitation open from the logged-in home returned `open-creator/unexpected-navigation/start:document/phase:before-commit/source:other`, although the invitation tab eventually contained the correct creator. Second and third explicit invitation opens succeeded without collection viewing. No event URL was captured; the home-cleanup explanation is unproven, and this error is not yet covered by the exact-target/no-commit recovery claim. Do not broaden same-domain navigation permission on this evidence alone.
- Local invitation brand/product/contact/date were empty. No real entry form was filled, no template values invented, no real send or Feishu write. Final installed0.1.93 real-template preparation remains NEED RECHECK after human upgrade; retain all accounts, runs and templates. Human previously chose self-install, not an automatic upgrade.

## Installed Prepare-Only Preflight

2026-10-15 subsequent user reports upgrade and explicitly requests real batch preparation without final send. Installed ASAR SHA256 now matches the final0.1.93 artifact exactly; unique installed native window and visible version0.1.93 verified. Existing five-row run retained. Entered the actual review workbench via accessibility controls. Template brand/product/disclosed contact and both dates are still empty, so no valid real preparation has been dispatched. Asked user to complete that one template; do not confuse this with reentering account credentials. No new business code, installation, real form fill/send, Feishu action, commit or push in this preflight.

Code review also verifies a prepare-only acceptance constraint: batch awaits confirmation after the first prepared recipient. The `已在右侧处理，下一位` action records manual completion and marks the local row as contacted; it is not a neutral unsent skip. Do not use it during a no-send test to claim continuous batch success. Stop/restart tests and per-row preparation are separate evidence; a neutral prepare-only advance would need an explicit implementation and regression, not direct runtime mutation or fake completion.
