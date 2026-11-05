# Persistent Maintainer Choice

## Scope

Source0.1.79 separates explicit member choice from a five-minute operation lease. Separate safeStorage-encrypted `feishu_sync/maintainer.bin` stores only name, exact member identity and role fingerprint, scoped to plugin/project/type/API actor. It does not rewrite `connection.bin` or persist tokens, approvals or plans. Restart restores preference, not confirmation or write authority. Editing name immediately clears old status/deadline and confirmation.

Readonly `refreshOperator` revalidates that exact member and role before explicit single/bulk preview. Failure cannot choose another person. Backend operator/plan expiry, dispatch checks, deduplication and cleanup ownership remain strict. Expiry retains selected identity and current-session attribution intent but invalidates unsubmitted previews; no background requests or writes. New task retains person, not plans. Saved preference is not proof of current eligibility or API permission.

Bounded review exposed three defects, each reproduced red then fixed: rotation must revoke every renderer preview; late single prepare must bind identity/approval revision; failed submission history must not exempt a new plan from revocation. Exact operator references, revisions and frozen choice reject stale/ABA callbacks. Final reread found no additional concrete blockers in this scope; reviewer did not run tests or inspect accounts.

## Verification

- Exact configured7 pretest/42 test commands PASS, Chrome enabled; comprehensive Feishu/reader group391 tests/no skips. Nine new stable-choice renderer cases plus backend/storage cases included.
- Final Chrome UI fixture PASS: expiry retains choice, explicit preview refreshes it, editing clears old display;950/650/400 screenshot checks without page overflow. Fictional fixture, not real-account proof.
- Windows safeStorage cross-process write/read PASS with fictional choice; connection file byte-unchanged. Initial sandbox run exited before main; authorized isolated retry passed. No production profile access.
- Candidate `desktop-app/dist-feishu-choice-0179/小红书相关信息采集工具-0.1.79-windows-x64-setup.exe`:109681495 bytes/SHA256ad0d3d3eac964ce86b65551fee47296187322b7a80704a6bd8a53488919706ab.68 app source files byte-match ASAR; package name/version/main/dependencies semantically match (builder normalizes metadata).115 backend files match existing validated build; Python312 DLL present. NotSigned.

## Installed Acceptance 2026-10-14

- Human explicitly approved preserved-data upgrade. Actual app displays0.1.79/service normal; whole installed ASAR SHA2569D197489BBE254A9A48B7A6D428F5B873F9C83AE521AE3F73370F04E49C9684B matches final candidate. Installer hash rechecked. The installer was launched and later found completed; individual wizard clicks were not independently observed.
- The previously eligible baseline member was uniquely found, explicitly chosen and saved. Two normal Alt+F4/relaunch cycles restored the same selected name and28-field connection without input/search. Attribution confirmation and cloud execution approval both restored unchecked; original five-row run retained. Encrypted preference exists; no real preference decryption or credential capture.
- First readonly batch preparation revalidated the restored member, processed5/5 and rejected all five missing contacts with FEISHU_CONTACT_REQUIRED, without a timing error.
- Real team query processed5/5:3 matched,2 absent. Three reviewed source records were explicitly classified as unclassified originals and applied together after more than five minutes of manual review. Pre-save serial rechecks succeeded3/3. The actual review file contains5 rows/raw3/typed0; after normal restart the same three originals appear in the generic contact draft and persisted file. This closes the positive unclassified batch application/restart gate; it does not prove typed WeChat/email/phone enrichment.
- More than five minutes after the first preparation, without another person search/selection, explicit second preparation succeeded5/5:3 ready for new records,2 missing-contact rejections,0 duplicate skips. All ready rows show the same chosen maintainer and the expected stored platform quotes; unavailable image quote remains absent. This proves expired action authority can refresh on the explicit preview while the chosen member is retained. It does not prove the same-owner duplicate skip combination or cloud assignment.
- Actual main divider dragged to a wider console and retained that width across normal restart. No production DevTools/CDP attachment was used. Safe final state: selected preference retained, both approval checkboxes unchecked, no selected batch or cached write plan, app running.

No cloud creates/updates/deletes, invitations, notifications, commits, pushes or Release in this upgrade acceptance. Full production approval remains open for live same-owner dedup/other-member assignment, software-owned update/DELETE provenance and clean-machine/signing gates. Earlier four-member0.1.78 readonly acceptance remains separate historical evidence.
