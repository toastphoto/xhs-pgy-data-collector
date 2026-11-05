# Learnings

Weekly disposition2026-10-26: the resolved release-tester harness entry is fully absorbed in AGENTS and DECISIONS `2026-10-26: Verify The Tester And Its Side Effects`; original text/evidence/closure scope are in [archive](archive/2026-10-26.md). Recovery rules were promoted but the entry below remains: installed/live acceptance is not closed. All other unresolved entries are retained; no product tests or account operations ran during this review.

- 2026-10-23: A restored paused queue has no running loop; a stop request alone cannot finish it. Test restore->stop without Resume and verify no navigation, preserved output, persisted unlock and next start. Finalization must remain retryable across task-state/cooldown write failures and restarts. Recovery is a top-level action, not a hidden history search. Native screenshot review caught inherited grid layout despite passing click tests; use the actual shipped CSS and verify text/button geometry. See [receipt](TASK_RECOVERY_2026-10-23.md).

- 2026-10-19：风险证据必须区分原始返回字段、字段类型、归一化布尔及脚本停止类别；!!转换丢失结构信息，不能单凭真值声称平台实际风控。预定入口不证明已提交页面类型，断言后未执行的截图不能补作历史证据。

- 2026-10-19：启动失败可能只产生error/close而无exit；无PID失败与仍拥有存活树的停止失败必须分开处理。旧error也需引用/代次检查。监管器收到stop后taskkill挂起，与主进程丢失stop消息是不同边界；重试前确认原助手退出，验证互斥及自动恢复次数上限。

- 2026-10-19：刷新恢复不排除应用导航拦截；真实首开必须检查will-navigate是否被自身取消。账号回退例外须绑定具体操作/页面及已验证公共路径，不能放开达人/表单稳定锁。打包期间冻结被打包源码；否则ASAR统计与写入尺寸可不一致，需全档案读出比对阻断交付。

- 2026-10-19：Start-Process存活至工具返回不证明跨任务存活；交互交接需独立调度父链和持久退出日志。调度与执行进程Roaming文件可见性不同，须回读实际文件，不迁移profile来掩盖。沙箱preload禁止本地require；保留沙箱并在真实Electron验证隐私过滤。

## Coexist QA validation 2026-10-19

- Playwright launcher PID can differ from Electron main PID; verify the actual owned main before crash tests. IPC supervision plus parent-liveness and exact spawned-child-tree cleanup must prove port release, not merely call kill.
- BrowserWindow titles may be overwritten after document load; stable QA labeling needs the title-update boundary. Native tests must await actual BrowserView attachment and saved selection readback.
- PowerShell subprocess output needs explicit UTF-8 before comparing Chinese registry names; empty filtered arrays are not preservation evidence. Compare with original UTF-8 snapshots. NSIS custom /D tests failed while default-path install/uninstall/reinstall passed; keep the failure and bounded route, do not claim all install options.

Weekly disposition2026-10-19: brand-selection rules fully absorbed into AGENTS/DECISIONS; the verified0.1.105 entry is preserved in [archive](archive/2026-10-19.md). Native0.1.106/107 lessons are promoted as bounded artifact rules but retained below because installed/IME/live gates remain open. No accounts or business code touched.

## Splitter preference and compact navigation 2026-10-16

Pointer-move previews must commit through the same normalized path as keyboard edits on pointer end/cancel/lost capture/blur. Persist preference separately from viewport clamps, including reload while narrow. Hidden navigation labels require explicit stable accessible names and icon hints in both media-query and container-compact paths. Validate real pointer interactions on exact artifacts; pure geometry tests missed the stale preference. NSIS same appId/shortcuts/uninstall keys mean a different install directory alone is not safe isolation.

## Native workspace 0.1.106 candidate 2026-10-16

- Same version/HEAD does not identify a dirty Windows worktree. Freeze file hashes and compare installed ASAR; keep unshipped UI separate from business repairs. Native screenshots through Playwright omit BrowserViews; deliver separate actual view capture rather than composing an apparent desktop screenshot. Package metadata transforms are expected, but runtime name/version/main/dependencies and all assets must still match.

## R3 targeted fixes 2026-10-16

- A width clamp applied only during drag/render misses dynamic shrink. Observe actual workspace size without rebuilding reading nodes; verify drag then shrink, enlarge, hide/show and zoom. Preview must share export scope; bulk completion must match every created simulation record. Current package version must be reread before calling a requested baseline current.

- 2026-10-16: A real Electron executable against intercepted fixture pages is NOT a real-account invitation test. User explicitly corrected the acceptance framing. State separately: VM/source, local native fixture, exact artifact, installed live preparation, final send. BrowserView30.5.1 removes contents asynchronously; post-destroy null checks alone do not safely detach native ownerWindow. Pre-destruction detach and exact identity retirement passed native cycles; retain failed reconstruction runs and recheck internal will-destroy behavior on upgrades. See BROWSER_VIEW_LIFECYCLE_2026-10-16.md.

- 2026-10-16: Core embedded browser must remain explicit in IA prototypes. Offline interactive state is not native session evidence. All batch entry routes must share invalidation; filters reconcile inspector; excluded selection requires separate exact-object confirmation. Review scope stays prototype-only before direction approval.

## 2026-10-15: Do Not Turn A Timing Workaround Into An Account Dependency

- A user click that precedes success may have supplied time, not required account state. Reproduce the main-frame boundary; own bounded exact-target waiting instead of navigating protected search or copying cookies. A different successful sample does not disprove an unrecorded user failure.
- Brand search needs asynchronous waiting and an explicit candidate choice, not a guessed first row. Extract and click from the same popup scope, support direct-text LI, and collapse nested popup roots without merging separate menus. Confirmed canonical brand resumes the same batch; changed/stopped contexts cannot.
- Keep concurrent UI changes separate from a targeted repair artifact. Verify intentional old-UI/new-runtime packaging against both baselines; do not claim every source file equals the package or silently switch branches.

## 2026-10-15: Unsent Batch Advance Is Not Manual Send Completion

- Separate stop/restart preparation checks do not prove same-batch progress. Never use manual-next, which marks contacted, to imitate unsent continuity. Add explicit unsent bookkeeping, preserve selection/followup, and keep unknown-send review independent.
- Test the actual prepared payload location (`draft.prepared`), not an always-absent top-level token. Attempt stale dispatch after locks release, not only while busy. Cumulative confirmation-count tests must include new batch starts or compare phase-relative deltas.

## 2026-10-15: Exercise Actual Electron Actions And Late Commits

- Browser `prompt()` is unsupported in Electron. A successful web fixture does not prove template-new/copy works in the desktop app; exercise both actual buttons. Use the existing inline name editor with unique defaults, not a new unsupported browser dialog.
- `loadURL` resolution and a target-document commit are separate evidence. A missing commit may still be queued even when the loading flag is false. Wait within the shared navigation deadline; never treat URL equality alone as readiness or retry sends. Live event timing remains unproven until inspected in the repaired installed version.
- User explicitly allows simulated unsent PGY templates: choose a real selectable public brand and clearly marked test content/synthetic contact instead of requiring user business values again. This is not permission to insert fake required data into Feishu production records.
- Visible-error checks must use visible text, not script-inclusive `textContent`; scope tests to the PGY manager instead of all three hidden channel panels.

## 2026-10-15: A Failed Call Must Not Make The Next Click Less Safe

- The original no-commit check was per-operation; next open skipped it on URL equality. Persist actual document proof across calls and test failure then repeated open/direct prepare, not just the first failure.
- A timeout timer alone does not stop late successful results after an event-loop delay. Check absolute deadlines before and after reads and directly before recovery. Native tests must inject the second creator in the renderer's real batch advance, not only standalone IPC. See [evidence](INVITE_DOCUMENT_RECOVERY_2026-10-15.md).

## 2026-10-15: Production Enrichment Is Not An AI Cleanup Rebase

- Compare only intended cloud fields and identity, not original actors, clocks or unrelated workflow. Exclude unrelated roles from supplementation search review. Keep both local source checks, with cloud comparison last; acknowledge remaining non-atomic remote race.
- Create the durable operation identity at preview. Recover lost execute replies by exact entryId plus recordId, not nickname/empty batch; retain unknown and do not retry. A new completed supplementation must not freeze later untouched source fields. See [review fixes and candidate](FEISHU_ENRICHMENT_2026-10-15.md).

## 2026-10-15: Preview Fields Alone Do Not Prove Enrichment Export

- Audit review map, renderer projection and final workbook schema separately. Raw contact existed locally but was omitted at both export stages.
- A row-wide dirty flag freezes unrelated enriched fields. Preserve manual edits per field; keep submitted payloads immutable. Review-only flags must not invalidate cloud previews, while real payload changes must. See [review](ENRICHMENT_PROPAGATION_2026-10-15.md).

## 2026-10-15: Fast Fill Does Not Test Continued Typing During Autosave

- A fill-only test missed the500ms save callback remounting the editor; slow real key input reproduced only the first character surviving. Assert node/focus identity and saved final payload, not just initial field text; test failure and composition events too.
- Suppressing every save repaint introduced stale channel lists and batch controls. Limit suppression to active composer focus, revalidate action targets and update revoked controls locally. Independent review caught both issues before delivery. Add DOM query support to VM fixtures instead of bypassing production save checks. See [receipt](COMPOSER_INPUT_LAYOUT_2026-10-15.md).

## 2026-10-15: A Blank First Page Is Not A Logged-In Search Starting Point

- Earlier native3 direct/3 batch tests started the first creator from an inert search page, while departing history was injected only into later creator/form transitions. That missed the first-creator defect now reported on installed0.1.89. Add the actual search start->target load->old history->target commit order and assert its event occurred.
- Controlled native0189 red reproduces the exact diagnostic;75 source regressions pass after the narrow repair. Do not call isolated reproduction a complete live-account diagnosis or opening a creator a successful safe preparation. Search-source authorization ends before business reads/clicks. See [receipt](INVITE_SEARCH_HANDOFF_2026-10-15.md).

## 2026-10-15: Test Real Scroll Geometry And Frame Ordering

- Fixed offsetTop mocks missed ancestor-coordinate drift. Add moved-parent/border tests and real100-row rendering. Independent review caught a separate double-RAF overwrite; execute the real recovery block with manual movement between frames.
- One new assertion incorrectly required identical raw scrollTop after a preceding card grew; compare visible row/offset instead. Final scoped/full/package checks pass; no real sending or installation. See [receipt](INVITE_SCROLL_REPAIR_2026-10-15.md).

## 2026-10-15: Separate Optional Empty Data From Invalid Data And Test Ownership

- Removing AI prefixes alone destroys the test cleanup contract. Add explicit production mode, keep old marked records unchanged, and guard all test mutation/archive paths by mode, not by a convincing title.
- Allowing empty contacts must not admit nonempty placeholders or turn off every mandatory check. User declined cloud configuration changes; unknown/required metadata remains a clearly reported limitation, not a hidden workaround.
- A mode change that clears a checkbox is insufficient: its detached callback can still restore approval, including after changing back. Bind the callback to its render mode and epoch, and add red/green stale-event tests.
- New regressions initially called verifyOwnedExistence instead of verifyOwnedAbsence and previewed a null cloud state before render. Fix fixture setup and rerun rather than reuse earlier green counts. Final scoped15/full7/42 and independent review pass; cloud date compatibility remains unverified. See [receipt](FEISHU_PRODUCTION_2026-10-15.md).

## 2026-10-15: Repeat The Real Navigation Order, Not Only The First Happy Path

- Basic48 IPC and ordinary native page tests missed an old-document event during the next creator load. Add the exact first-prepare -> next-load -> old-history-update -> target-commit sequence; assert both the reported red diagnostic and later correct recipients. New-document bootstrap coverage alone is insufficient.
- Preserve the source/target/commit distinction through form entry too; do not erase a pinned form on source cleanup or promote an aborted uncommitted load.59 final IPC/full7/42 pass; installed live acceptance remains separate. See [receipt](INVITE_NAVIGATION_HANDOFF_2026-10-15.md).
- Native instrumentation must assert its injected event really occurred and capture console errors.0/6 events were initially misattributed to timer suspension; actual console evidence showed inline-handler document.URL shadowing the URL constructor. Use window.URL in inline handlers. A transient rerender can detach a screenshot target after completed business assertions; photograph the stable fixture page, without weakening business checks.

## 2026-10-15: Diagnose The Actual Copied Input Before Machine Or Permission Claims

- Colleague copied plain fields and reported FEISHU_CONFIG_INVALID; human then confirmed omitted User Key. Encrypted local-file portability and plugin grants were not the observed cause. Ask for safe error text and field presence, never actual secrets. Fix the missing field in the current installed version before requiring another upgrade.
- Source0.1.87 now names invalid fields and whitelisted connection stages, preserving privacy and authorization checks.340 fixture tests/full7/42 pass, not colleague live acceptance; no0.1.87 artifact exists. See [checkpoint](FEISHU_CONFIG_COPY_2026-10-15.md).

## 2026-10-14: Role Return Order Is Not Assignment Identity

- Final installed0.1.86 passed all three exact manual DELETE/absence checks and archive/restart persistence without retries or legacy rebasing. This closes that scoped failure, not broad update/default/role-binding acceptance. File audit retained8 entries; actual picker empty before and after restart. Keep that positive evidence distinct from earlier fixtures/pending installation.

- Independent review found the first helper/test wrongly called legal unassigned owners:null malformed, contradicting the existing creation regression. Preserve explicit null, sort arrays only; test null-positive and null->[] rejection separately. Final reread clear; intermediate0186 package withheld, final333/full7/42 pass, installed acceptance still pending.

- Actual0.1.85 manual DELETE failed before dispatch with FEISHU_REMOTE_CHANGED. Two exact readonly previews independently showed equal role/owner sets in different order; generic JSON array equality can reject unchanged assignments. This is evidence of response permutation, not proof that every stamp mismatch has that cause.
- Normalize only supported typed role sets in the fresh manual-cleanup review; retain unknown/ordered arrays, extra metadata, changed ownership, clocks and workflow checks. Never alter old stamped baselines to absorb a current read. Red/green permutation plus malformed/duplicate and changed-data counterexamples are required.
- Post-delete fixture queries legitimately receive no object. Guard the test mutation callback against null instead of interpreting its own crash as product unknown outcome.332/full7/42 pass; actual repaired DELETE remains pending. See [live receipt](FEISHU_TARGET_RECORD_CLEANUP_2026-10-14.md).

## 2026-10-14: A Crowded Target Picker Needs A Real Lifecycle

- Human found that retained dropdown history could not be removed. A selector and readonly absence button do not form a usable deletion lifecycle. Add separate discoverable actions for exact cloud-test cleanup and local terminal-history visibility; do not label hiding as deletion.
- Historical baseline failure must not force pretending current data proves its original state. Separate a narrowly reviewed current DELETE from automatic baseline-based mutation, with exact ownership/current-version checks and no update authority. Unknown default metadata remains unproved; manual preview is not DELETE acceptance.
- Actual0.1.85 archive hid five entries while preserving all eight audit entries; current manual preview passed, final cloud confirmation pending. Preserve this boundary in handoffs, not the superseded human-page cleanup request. See [current evidence](FEISHU_TARGET_RECORD_CLEANUP_2026-10-14.md).

## 2026-10-14: Self-Imposed Equality Blocked Normal CRUD

- Human questioned whether creation/update timestamp equality was an official requirement. It was an application rule. Actual new0.1.79 test produced TIMESTAMPS_UNEQUAL after successful field/maintainer readback. Do not infer external edits or missing API permissions from normal initialization time differences; require ownership/content evidence and compare the record version at mutation time instead.
- Actual0.1.80 disproved the follow-up ordered-time assumption with TIMESTAMPS_REVERSED. Source0.1.81 removes all initialization audit-clock comparisons; do not replace one unproved invariant with another. Actual0.1.81 then exposed initial workflow refusal; exact0.1.82 readonly diagnostic identified omitted history despite affirmative initial/unarchived flags. Source0.1.83 permits omitted history under those flags while preserving changed/nonempty-state guards. Three exact tests remain retained; software update/DELETE is not accepted yet.
- Diagnose all relevant safe predicate categories readonly before creating more tests. Current snapshot evidence is not first-readback evidence; one bounded reviewer caught misleading wording and another caught an obsolete negative fixture. Final351/full7/42 pass, but cannot substitute for installed/live acceptance. Browser binding timed out twice, stopped without bypass or permission diagnosis.

## 2026-10-14: Installed Choice And Original Backfill Accepted

- Actual0.1.79 twice restored the chosen member/connection without input, with approvals unchecked. Explicit later preview after more than five minutes required no reselection; five rows completed. Three reviewed unclassified contacts applied after >5min review and remained raw3/typed0 in the file and restarted UI. This closes those specific pending installed gates, not cloud assignment/CRUD or typed enrichment.
- Native accessibility indexes can become stale on expiry-driven rerender; recover by fresh observation rather than interpreting the automation error as an app/permission failure. One focused retry after window activation succeeded; do not replay input without checking its outcome.
- Aggregate persistence checks must use the canonical store's reviewRows property. PowerShell @($null).Count can misleadingly report1 when the wrong rows property was queried; inspect safe property names and reread the actual collection before claiming a save failed. Corrected count was5/raw3/typed0, matching the UI.

## 2026-10-14: Stable Identity Does Not Preserve Preview Authority

- Review exposed three reproduced gaps: rotating authority left another surface's preview enabled; late single prepare survived confirmation ABA; failed history bypassed preview revocation. Red tests reproduced each. Clear every cached plan before preserving outcomes, bind exact operator/revision/confirmations after await, retain history separately. Nine new renderer cases/full tests pass; installed acceptance pending.
- Builder normalizes package.json: byte-check app source assets, structurally verify packaged identity/version/main/dependencies. Do not mistake metadata normalization for missing code or skip its verification.

## 2026-10-14: Revocation Must Also Clear Misleading Display

- Installed0.1.78 real retest passed four eligible member selections/local confirmations. On editing the name, selected identity was revoked but old deadline/confirmed-status text remained visible until search. Clear or explicitly distinguish stale history from current state at revocation; no surviving authority was observed. UX repair remains pending, not absorbed as a completed fix.

## 2026-10-14: Live One-Millisecond Skew And Choice-Lifetime Confusion

- Diagnostic0.1.77 captured1ms positive skew in real selection despite the isolated2000-sample probe finding none. Zero-tolerance cross-process comparison blocked a valid returned identity; use bounded remaining duration with conservative request-start clocks, never claim the isolated probe disproves a live intermittent failure.
- Independent review exposed stale selection ABA, journal-save crossing expiry, two-sample readiness and reversible readiness-only clock rejection. Capture selection revision/target, freeze/bind once, recheck after synchronous persistence, and latch a single sampled rejection. Final289 source tests/full chains pass, not installed0.1.78 acceptance.
- User correctly separated a stable chosen name from a temporary write approval. Do not present our five-minute inspection design as a platform name-expiry requirement. That product redesign remains pending beyond the timing patch.

## 2026-10-14: Generic Timing Errors Do Not Establish Clock Skew

- Installed invalid-deadline error combines missing, malformed and future-time predicates. Source proving a1ms zero-tolerance counterexample is not proof of the live cause; isolated2000-sample main/renderer probe had no future result. Capture finite predicate codes in the normal UI before loosening anything, never raw operator/credential replies.
- Diagnostic0.1.77 source/bundle passes, not installed at this checkpoint. Keep action-time upgrade, actual predicate capture and repaired live acceptance separate; cleanup origin evidence is an independent guard, not a timing workaround.
- Docked developer tools can clamp the live workspace width without restoring the previous preferred width on close. Prefer an isolated fixture or a normal bounded diagnostic display. Native range set_value did not restore it; do not claim recovery from an input call or keep repeating unreliable coordinate actions. Current761/sidebar267, previous1159/sidebar267; layout follow-up remains separate.

## 2026-10-14: Existing Assignments Are Not The Current Eligible Picker

- Human corrected the test pool: verify names against the target project's actual selectable current-maintainer list. The prior live-library samples only proved past/displayed assignment, not current eligibility. Downgrade that coverage instead of silently treating it as authorization evidence.
- Current backend name search checks project scope, activation and role uniqueness, but those predicates alone do not prove the complete selectable range. Do not conflate eligible assignment with plugin/API actor operation permissions, or hide observed deadline failures behind an unproved permission explanation.

## 2026-10-13: One Maintainer Cannot Prove Team Readiness

- Human corrected the single-name acceptance gap. Real current-library member lookups and readonly role inspection4/4 succeeded, but three selections immediately failed deadline validation, including the former baseline. Unit cases and an earlier successful record cannot override this installed result.
- Select member samples from the live target library; old supplied roster names can produce no usable matches without proving permission failure or inactive membership. Keep name matching, scoped role/member verification, local confirmation and cloud attribution readback as independent gates.
- Invalid timing, normal lease expiry and platform permission errors must not be conflated. Capture only safe predicate diagnostics before identifying a cause; do not relax TTL to compensate. Checkbox confirmation also needs consistent recent-operation status. No live write was performed in this test.

## 2026-10-13: Real Batch Review Exposed Expiry And Identity Gaps

- Independent review caught missing stored-account identity, reversible confirmation ABA and detached row objects. Bind feishuAccountNumber as well as creator identity, require current list membership and a monotonic review revocation revision. Rechecking a canceled confirmation must not resume an old callback.
- Shared-reference row fixtures hid real adapter behavior: exports updates its review map, but each render copies merged rows. Before awaiting local save, mark only this patch's expected identity projection as pending; do not mistake it for manual identity drift. After save (including rollback), result reporting may observe either the pre-save or expected copied projection, while pre-write scope checks remain strict. Cover pending render, stop, failure rollback and stale snapshots with the real adapter/separate map; source126 passes and independent scoped counterexamples are green, not installed acceptance.
- Raw preservation must begin in response classification, not just store/export. classifyContact trimmed generic values before any raw save. Red exact-literal response test drove value:raw for unclassified contacts only; empty/status and explicit typed normalization keep their prior behavior. Include reader/preview regressions in the normal pretest chain.

- Real0.1.75 three-row and reduced two-row confirmation expired; store readback showed0 raw and0 typed saves. Repeating the same manual review did not advance acceptance. Reproduce, retain failure evidence, and repair the review/read lease mismatch without relaxing cloud ownership or TTL.
- Confirmation-time readonly refresh must compare the exact reviewed candidate and bind original query identity across initial save, refresh and apply awaits. A red fixture showed creatorUrl/xhsId changes before confirmation could otherwise become a fresh lookup for the wrong row. Invalidate same-row identity changes, not just creatorName/run changes.
- A local variable named currentRow shadowed the selected row ID, suppressing the selected draft update after batch save. Use localRow for the object and test both automatic draft refresh and preservation of manually entered values. All new source cases pass; installation evidence remains separate.

## 2026-10-13: Feedback Must Be Tested Across Real Projections

- An explicit current-page instruction lost its origin and silently navigated to page1. Keep origin separate from relative rank, carry it through checkpoints, and prove later-page runs separately from global-rank runs.
- A page click can succeed before its execution context rejects. Record possible navigation before dispatch; failure recovery must independently recheck risk and stop on a failed safety read. New eight-case reader regressions include late risk with a missing response and click-then-rejection. Initial six green tests missed both counterexamples.
- Cancellation is also navigation: the first candidate artifact was withheld when checkpoint cancel lacked a fresh safety gate. A later readonly counterexample shows that clearing its session before an await can let another operation start, after which global-window cleanup closes the new operation. Acquire the mutex before the first await and close only the captured old command window. Three candidate entries repaired; lifecycle11/origin9 and complete chains pass. Final candidate is rebuilt separately; installed acceptance is still pending.
- Adding raw fields to the review store is insufficient: contact_sheet preview projection initially dropped them, hiding existing values from fresh conflict checks. The final renderer save adapter also lacked a raw conflict guard. Both red counterexamples now pass; retain unchanged values/provenance through every projection and test actual restart separately.
- Native UI snapshots immediately after an action may contain stale accessibility labels while the visible state has changed. Reobserve before taking another indexed action or claiming a saved count. Actual two-export workbook comparison confirms144 vs145 columns; a success toast alone does not.
- Readonly review found resource risk exceptions swallowed before a subsequent tab click, failed safety reads allowed, and unhandled initial blank-page cancellation. Repair/test before packaging. Ordinary nickname substrings and business-navigation ERR_ABORTED readiness are distinct unresolved findings, not proof that the historical screenshot was misclassified.

## 2026-10-13: Raw Contact And First-Readback Diagnostics

- User explicitly chose unclassified raw contact preservation. A generic team contact must not become WeChat/phone/email from its visual shape; generic cloud write/readback is not typed local backfill acceptance.
- Actual0.1.73 three-row create/readback succeeded, but all three cleanup checks reported only CREATE_ORIGIN_UNVERIFIED. That combines actor and timestamp predicates; no first raw response was retained, so the specific cause is unknown. Improve future first-readback enum-only diagnostics without storing identities/raw payloads, relaxing guards or retroactively supplying old baselines. Source predicates are not necessarily guarantees made by the platform.
- Nested contact-list scroll was lost on source/type changes and unrelated global rerenders. Preserve reading position under exact run/epoch/list ownership, not write authority; late scroll callbacks must not mutate a replacement batch. Source repair/Chrome regression pass; installed regression pending.
- Safe backend diagnostics must reach the accepted record identity in repeated history refreshes, not remain hidden in the journal. Display only whitelisted translations, preserve unknown legacy causes and avoid asking for cleanup on already-deleted history. Backend142/renderer108Chrome and full chains pass; four-file repair is newer than installed0.1.73, not yet packaged.

## 2026-10-13: Installed History Is Not Just Unknown Recovery

- Known entry/record IDs outrank name+batch. Reject conflicts even if another ID matches; only uniquely matched identity-missing unknown recovery may use labels, and known account conflicts remain uncertain. Test at least two renders and refresh retirement, not only initial display.
- Match guards fail when callers project away recordId/account/target. Carry complete stored/returned identity through reconciliation, verify explicit target even with an empty local record list, retain newly resolved IDs across rerenders and use the acceptance result to avoid a false success message. Independent counterexamples drove the source repair; renderer101Chrome passes, repaired installation remains UNVERIFIED. Never rebuild an old cleanup baseline from these display fields.
- Check every caller, not just the first history button. The row and standalone reconciliation paths still accepted before validation; red cases reproduced misleading success/row state. All three callers now consume acceptance and preserve unknown on rejected replies, with after-await scope guards. Renderer103Chrome, full chains and independent44-case matrix pass; repaired installation remains UNVERIFIED.

- Installed refresh restored unknown/external-absence entries but omitted persisted verified entries, including cleanup-blocked submissions. Journal/selector still held them, so do not call this installation data loss. Restore scoped submitted identity and status without granting mutation or inventing old missing maintainer/account fields. Independent fixture reproduced the omission; installed repair remains UNVERIFIED.
- The batch source label was initially misread as account metadata; it actually contains the original contact value. Verify the code/data contract before asserting a missing-data bug. Full selected-value display can improve review ergonomics, but no UI convenience permits guessing contact type.
- A stop click arriving after5/5 completion does not prove cancellation. Record that boundary explicitly; do not rerun aggressively or call completion stopped.

## 2026-10-12: Release Audit Persistence And Async Identity

- Run/request identity alone cannot detect same-run edits during an approval query. Capture approval input signature and edit generation, discard obsolete checks, and retain newer pending/failed-save hints. A second independent reviewer reproduced this UI false-positive despite the backend already rejecting stale fingerprints; source30 tests pass, installed gate remains open.

- A settled failed autosave is still dirty work. Retain failure state and edits until explicit successful persistence; switching must flush edits added during a pending save before clearing the old run.
- Only a direct ENOENT read establishes absence. Permission/JSON/shape failures must not become an empty document or allow overwrite. Validate originals and use exclusive same-directory temp plus rename; never delete another save's colliding temp.
- Matching run paths is insufficient after A ->B ->A or two overlapping refreshes. Bind every asynchronous load/preview/export/import/contact result and status update to run generation and operation identity. Final independent review caught an older preview reducing a newer two-row review to one row; add red regressions before rebuilding a held candidate.
- Reading preferences, focus and caret are separate from write authority. Preserve them on own rerenders without renewing approvals or reviving stale DOM handlers.
- Revoke in-memory authority before persistence on disconnect/forget. Storage failure or busy state cannot leave old actions live; distinguish confirmed revocation from unknown transport outcome and warn that failed storage can restore an old saved connection after restart.
- Historical2026-10-12 price rule was superseded by the explicit2026-10-16 user decision: `暂未报价`/`暂无报价`/`未报价` now map to0. Missing/paused-order values keep omission semantics; unknown/compound prices are not zeroed and existing quotes are not automatically cleared. See DECISIONS and INVITE_BRAND_REAL_ACCEPTANCE_2026-10-16.md. Original release acceptance limits in this entry remain historical, not newly tested.

## 2026-10-10: Readonly Retirement Is Separate From Mutation Eligibility

Weekly disposition2026-10-12: reusable readonly/mutation separation, first-readback safe diagnostics and native-option fixture rules are now in AGENTS/DECISIONS. Keep this whole entry: candidate installation, live category and software cleanup remain unverified. No baseline reconstruction or live retest occurred during memory review.

- A verified record blocked from mutation was also disabled in the target selector, hiding legitimate exact readonly external-absence retirement after separately approved normal web cleanup. Permit only verified exact-owned selection for readonly checks; update/delete stay disabled and handler-guarded. Deletion on the normal website is not software DELETE acceptance, and the journal requires its own readonly retirement.
- Rendering a disabled button is insufficient. Captured create handlers could switch mode before dispatch or while awaiting local save. Capture mode, target, record and connection, reject stale scope before dispatch and after awaits, and retain backend guards. New counterexamples failed before repair; renderer89 with Chrome passes afterward. Candidate0.1.71, not yet installed.
- Chrome option.disabled and :disabled are the native checks. Playwright isDisabled retargets an option nested in a label to its enabled select; minimal standalone repro verified this discrepancy. Use native state plus real keyboard navigation, not a weakened assertion. Programmatic selectOption can select disabled options and is not a human-interaction oracle.
- Cleanup rejection diagnostics may persist only a fixed safe enum from the FIRST readback. Do not include private response/audit/person/field values, fill missing old diagnostics from later detail, rebase old stamps or relax eligibility. Live category and software cleanup remain UNVERIFIED.

## 2026-10-10: Live creation success does not prove cleanup eligibility

- Installed normal create passed sent-field/maintainer readback but cleanupBlocked remained true with no stamp. The journal did not persist first-readback predicate reasons, so later investigation cannot distinguish audit/workflow/default-field rejection. Missing journal evidence is not evidence that remote fields were missing.
- Keep the exact new test object for user inspection; do not recreate, retry, rebase or delete it to manufacture acceptance. Add sanitized first-readback rejection categories in a future scoped repair, with no private bodies or guard relaxation. UNRESOLVED: actual rejection category and software cleanup acceptance.

## 2026-10-10: First Create Readback Is Not Automatically An Owned Cleanup Baseline

- Bounded review reproduced a successful normal-create readback accepting matching sent fields while another actor had modified an unsent field. It saved that snapshot as an owned baseline and allowed DELETE. The existing unknown-create cleanup block did not cover this happy-path window. Hold positive live writes until this is repaired and regressed; never make cleanup green by adopting the current record.
- Repair must use a real contract rather than an invented fixture. Official WorkItemStatus has state_key, explicit initial/archive flags and state audit/history; the earlier fixture-only state key and empty statuses are not evidence. Static metadata cannot predict dynamic new-record timestamps. Use strict explicit API initial evidence plus actor/time and typed non-written-data checks, leaving missing/contradictory evidence cleanup-blocked. Source128/128 and fixture positives do not prove live eligibility.
- Actual installed0.1.69 history expansion was lost when refreshing; isolated review also reproduced settings expansion loss. Preserve session-only reading preferences separately from connection/result status and short-lived write authority. Reading-state preservation must not renew permissions or plans.
- A fresh native window binding needs screenshot-backed geometry before coordinate/index input. Two helper geometry errors recovered by fresh returned window/snapshot; they do not establish an application failure. Always inspect refreshed state before retrying an action.

## 2026-10-10: Check Live Error Envelopes And Actual Button Handlers

- A deleted exact record can use HTTP400/API30005, not only a successful HTTP envelope with API30005. Reproduced in installed readonly preview; detail-specific classification now has strict rejection and no-retry regression coverage. Do not generalize HTTP400 or absorb old mismatched snapshots.
- Changing refreshRecords to accept a predicate made run(refreshRecords) receive an operation-context object and throw. Exercise the actual history refresh button, not only direct function calls; wrap and validate current scope after await. The added button regression failed before repair and passed after.
- Connection edits must immediately disable existing DOM actions as well as their memory/handler guards. Test without forcing a rerender; the new readonly action stayed visually enabled until this direct input-event regression found it.

## 2026-10-10: Recovery Is Not Permission To Persist Private Page Evidence

Native Chrome URL-confidence safety stop ended the prior turn; do not switch controllers in that turn to bypass it. A later authorized continuation recovered the selected IAB through documented APIs, not terminal/CDP or security changes. Old-test UI history only shows its initial creation, but does not reconstruct a missing full v1 baseline; automatic mutation remains blocked. An attempted unredacted screenshot persistence was rejected for private contact content. Do not retry another path; use safe aggregate evidence and the exact user-confirmed cleanup scope instead. Browser-readable, installed-dedup success and deletion acceptance remain separate facts.

## 2026-10-10: Do Not Attest Cleanup Merely To Enable Readonly Testing

Actual0.1.67 saved connection and real person lookup passed; two-row real team-library query finished2/2 with both matched, unclassified contact review retained and no application. This is lookup evidence ONLY, not cloud dedup/new creation/cleanup. Cloud preview incorrectly shares the cleanup/notification attestation; do not check it while the old cleanup baseline remains unresolved. Source0.1.68 separates deferred readonly preparation and fresh execution approval without touching legacy journal baselines.

Independent review reproduced a single-create stale callback after delayed save/revoked approval. Red test first, then captured-plan plus safety/configuration rechecks close it; revocation/recheck cannot revive single or batch writes. Backend11 new regressions and renderer4 new regressions pass; installation/live repair acceptance is still open. Do not erase the older cleanup gate or manufacture more cloud objects while claiming it passed. Use CHROME_PATH for the existing browser fixture; absent Playwright downloaded browser does not require an installation.

## 2026-10-10: Live Predicate Diagnosis And Legacy Baseline Limits

Installed0.1.66 two-row preview identified page1/record3 OTHER_OWNERS_NULL; the prior speculation about missing maintainer was not the established cause. Limit the repair to explicit null in non-target roles, never skip the record or duplicate-role check. Red tests and independent audit retain same-owner/later-page blocking. Source0.1.67 fixes this; real installed acceptance remains open.

Independent fixtures also reproduced recordStamp object-key drift. Version new canonical baselines rather than silently change an old irreversible hash or adopt today's record. Actual old-object preview still fails FEISHU_REMOTE_CHANGED; no delete or actual-change diagnosis. Error copy must report baseline mismatch, not claim a person changed data. Keep this unresolved gate. Installed0.1.66 disclosure and authority-expiry repairs now passed live; earlier pending-install statements below are historical.

## 2026-10-10: Cleanup Disclosure Is Independent From Creator Selection

Actual installed cleanup tab/list refresh/target selection hid the whole operation area when no creator was selected. A summary open state derived from current creator selection was being overwritten on every render. Keep disclosure preference separately, reset on run changes, ignore events from replaced panels and retain existing mutation guards. Real-DOM regression then exposed delayed native toggle losing a manual collapse if a status render followed immediately; capture summary click state synchronously, including keyboard activation, rather than add a wait. Red tests preceded fixes;52 renderer/full Feishu177, Chrome three-width100-row and packaged geometry checks pass. Candidate0.1.66 is not installed yet; live repair acceptance remains open.

The old journal-owned test object's actual READ-ONLY cleanup preview returned FEISHU_REMOTE_CHANGED. No deletion or override occurred. Do not presume the user changed the record or weaken the stamp check: exact stored/current metadata and representation cause remain unverified. Retain this gate until evidence establishes the cause and a scoped approved cleanup succeeds.

## 2026-10-10: Visible Confirmation Must Expire With Its Authority

Installed real cloud preview rejected an expired maintainer lease while the renderer still showed the name and checked confirmation as valid. Re-selecting explicitly restored the query, proving expiry was distinct from connection failure. Source now derives the bounded deadline from checkedAt, shows its estimated validity, clears confirmation and plans at expiry/backend rejection, stops before later rows and preserves an already dispatched result/name/draft/history. Missing, invalid and future timestamps fail closed; no silent authority renewal. Seven regressions and a safe-diagnostic renderer test pass. Installed repair acceptance remains pending, not a delivered fix.

Real duplicate preview also blocked a legacy account even though the first visible matching record had a different nonempty current maintainer. The exact failed API predicate is not yet established; do not infer missing permissions/empty ownership or weaken guards. Added whitelist-only first-failure reason and response ordinal diagnostics, no actual type strings, IDs, contacts, roles or response bodies. Complete ownership shape/positive batch/write-readback/cleanup remain unresolved. Installation0.1.65 subsequently succeeded after one bounded authorized same-path retry; old installation-timeout observations below are historical.

## 2026-10-10: Real CSS Grid Geometry Is Part Of Native Layout Contract

Packaged zoom1.25 test failed despite nine geometry unit tests passing. Independent isolated measurement proved implicit auto grid column expanded body to1282.5CSSpx while viewport was1107CSSpx, so renderer and main chose different console widths and BrowserView overlapped by185DIP. Explicit app grid-template-columns:minmax(0,1fr) alone fixed all three packaged zoom assertions and preserved splitter/reload behavior. Do not increase tolerance, add sleeps or weaken main clamp to hide it. App-control approval timeout during subsequent authorized installation is not successful installation or Feishu permission failure; recheck installed ASAR and current windows, never bypass the gate. Installed/live acceptance remains unresolved.

## 2026-10-09: Whole-Flow Review Finds Bugs That Green Component Tests Miss

Independent review reproduced stale single-contact apply after identity edits, mutable-row result attribution, hidden unknowns after removing rows/reconnecting, ambiguous old-owner results and silent expired clicks. Source fixes include epoch/token/confirmation guards, immutable submission history, journal recovery, original-owner labels and expiry feedback. Follow-up red tests exposed uncheck/recheck authority revival, failed pre-query save retaining old lookup, and duplicate ID-less unknown history; all now pass.42 renderer tests/full Feishu130 and isolated Chrome100-row UI pass. Backend repairs preserve original business identity/type and unknown-update baseline, recheck expiry, read current ownership and refuse unproven cleanup. Do not deliver older candidate hashes after changes. Fixture account query mutation contradicted navigation contract; repaired fixture retains context guards. Packaged zoom1.25 geometry failure remains unresolved, so source-green does not imply artifact-ready. Installed/live gates remain open; retain until fully absorbed with evidence.

## 2026-10-09: Local Anti-Replay Is Not Remote Business Dedup

Review exposed two opposite defects: same account/maintainer in another local row could prepare again, while a different maintainer on the same row was blocked. Tests reproduced first; source now uses business identity in the durable journal and paged remote role-owner checks at prepare and dispatch, with fresh post-read row/authority guards. Current cloud prepare also cleared all other plans; independently bounded, expiring row plans now preserve earlier reviewed rows. This is not a delivered bulk cloud UI. Keep failures for missing role, partial pages, late duplicate, unknown earlier write and data/session/TTL changes. Existing green regressions did not cover the new rule. Installer/live quote/bulk/cleanup gates remain open; retain this unresolved acceptance status.

## 2026-10-09: Semantic Role Fingerprints Must Ignore Object Key Order Only

Actual installed preview failed FEISHU_OPERATOR_CHANGED twice before dispatch. Initial commentary guessed expiry; accurate code/source review corrected that claim. JSON.stringify of the entire role object treated nested object key order as an authority change. Regression reproduced the guard failure before the narrow fix: canonicalize object keys recursively, retain every value and array order. Separate configuration-change cases still block prepare/execute without writes.74 focused/full existing tests pass; approved0.1.64 preserved-data installation and actual preview/create/field+maintainer readback pass. Never solve this by omitting role/security values, sorting meaningful arrays, weakening fresh validation or retrying uncertain creates. Read exact error before attributing expiry/permissions. Cloud object retained for latest user inspection; precise deletion and other acceptance gates remain open. See dated role report; keep until weekly evidence extraction.

## 2026-10-09: Multi-Select Needs Independent Preview And Persistence Semantics

User correction exposed one-by-one backfill UX. Existing main lookup cleared every previous preview, so merely adding checkboxes would leave earlier rows unusable. Retain bounded independent run/row/session tokens while re-querying invalidates that row. Local apply also mutated in-memory review before save; failure left a patch that a later batch save could accidentally persist. Roll back only unchanged patch fields, preserve concurrent edits and count success only after persistence. Multi-selection must retain identity, source/type/conflict and stop-state guards. Regression and source UI checks pass; actual installed batch acceptance is still unverified. Keep this entry until evidence is consolidated by weekly review.

## 2026-10-09: Compile The Generated Resource Script And Verify Identity

Live installed collection reported success while returning an unrelated account nickname. The resource-delta template's new profile regex lost escaping, failed page-script compilation and was swallowed into an empty delta. Top-level JS syntax tests missed it. Compile the actual generated scripts for every tab, assert scoped creator name/account/profile independently, and propagate syntax failures instead of quietly saving template fallback identity. Existing AGENTS regex rule already applies; source fix/regressions pass, installed retest remains open. A result count does not prove correct identity. Missing opt-in targets are not empty results, and cached run lists must refresh when handing off a new run. Preserve distinct PGY/XHS ID namespaces; verify scoped live provenance rather than deriving links by presumed ID equality. Do not record real sample values or treat offline tests as installed acceptance.

## 2026-10-09: Installed Update Closes The Dated Read-Only Role Blocker

After the new administrator-update report, initial bound console still showed cached0.0.1; one explicit reload showed intended-space0.0.2/update10:11. Actual saved main-software connection then returned one person and passed role validation after explicit choice. Supersede yesterday's pending-install/role401 conclusions, not every business gate; do not keep asking for an already completed upgrade or credential reentry. Preserve conflicting/historical evidence without projecting it onto the new state. Contact application, cloud assignment/CRUD/cleanup and final UX remain unaccepted. Existing learning entries stay until weekly extraction; this is a real read-only pass, not proof of every grant or the sole causal mechanism.

## 2026-10-08: Session Status Is Not A Remote Permission Refresh

User challenged repeating0.0.1 after reporting an upgrade. Installed-ASAR review proves the desktop uses plugin identity/type0 without a cloud version parameter; Check Connection uses api.status(), not forced authentication exchange on an unexpired session. Correct the earlier reexchange claim. Human update report, developer release table, installation statistics, token exchange and endpoint success are separate evidence; conflicting statistics do not justify accusing the user of not updating. Fresh original-console log confirms person success/role10301, not a local version lock. Keep upgrade/effective-scope diagnosis unresolved until exact installed entry and relevant live request are verified. No token/credential extraction, rotation or repeated failure loop as a workaround.

## 2026-10-08: Public Usage Is Not Necessarily External Marketplace Publication

Earlier treated Public as incompatible with all internal tests without checking plugin type and separate store controls. User challenged that assumption; official publishing docs distinguish tenant-only enterprise plugins from market plugins, and live UI exposes Public usage separately from store publication. Correct approach: verify all three axes, disclose widened enterprise installation range and obtain precise approval rather than rejecting or silently broadening. User explicitly approved enterprise-public/non-store17, now released as0.0.2 with independent share-list proof; intended-space installation remains0.0.1. Do not equate published permissions with installed/token/business success. Keep this entry until weekly extraction; role10301 and full acceptance remain unresolved.

## 2026-10-08: Version Change Lists Are Not Released Permission Snapshots

Earlier assumed a published version's Add14 detail meant those grants were effective. Original released share page now lists only three CRUD groups, while both existing details and Create Version show Add14; console enables17. Withdraw the prior inference and preserve this discrepancy until a bounded release/update and real role read prove effectiveness. Do not resolve it by publishing all14: configuration/user edits, deletion, comment/view powers exceed current main-software needs. Minimum proposed addition is user read/basic configuration read, with precise confirmation before narrowing12 pending groups and scoped publication. The create form was canceled. Generic pending banners, current checkboxes, version-change lists and installation counters are different evidence layers. No business/auth repair is accepted yet.

## 2026-10-08: Plugin Authentication Is Not A Proven Administrator Requirement

User corrected the detour toward personal administrator access. Source already uses released-plugin type0/p- authentication, not a user token. An empty managed-space list is not evidence that flow_roles requires administrator rights; withdraw that prerequisite and do not substitute identities. Official docs distinguish plugin scopes, installed version and user resource rights, so neither blanket actor-independence nor administrator necessity is established. flow_roles is outside x-auth-mode's applicable list. Re-exchanging during the two-hour token lifetime may return the same token; a successful reconnect is not proof of new-token scope. Null target metadata in a denied log is not proof of missing request parameters. Local bounded numeric error diagnostics now pass 60 focused tests, but remain uninstalled and do not fix the live 10301. Keep role/assignment and business gates unresolved, with endpoint-specific evidence as the next step.

## 2026-10-08: Read Actual Released Scope Before Diagnosing A Missing Grant

Earlier missing-role-permission hypothesis was contradicted by live developer, published-version and target-installation evidence: basic configuration read covers flow_roles and is in installed 0.0.1. Generic pending-change banners and historical narrow grants cannot establish current omissions. Server log returned 10301, not just an undifferentiated 401; effective actor/token access remains unresolved. Non-2xx early rejection in request() drops numeric API diagnostics, a verified uncorrected omission. Inventory current scope/version, obtain safe numeric server evidence and investigate access before adding permissions; do not bypass authentication. A help overlay also intercepted clicks: close the actual obstruction and verify dialogs disappear before navigating. Keep this entry and the role gate open; no business fix or cloud write.

## 2026-10-08: Positive Person Search Does Not Grant Role Configuration Reads

Actual installed main software found one eligible match for the user-supplied full name, but explicit selection then failed at maintainer_roles with HTTP 401. Official role-query documentation places this endpoint in a separate Process Roles permission category; previous work-item read/write/delete scope evidence is not proof that it is authorized. Method/path match official docs/SDK. Exact plugin/category grant, released/installed scope and API-actor authorization remain unverified; retain this entry. Before requesting access, inventory every endpoint's actual permission group and disclose its full bundled powers. Never bypass strict auth, invent IDs or request credential reentry merely because this separate stage fails. A queued page-open request is not a visible backend inspection.

Weekly disposition 2026-10-08: connection preservation, explicit maintainer choice and independent acceptance gates are now in AGENTS; normal-shutdown encryption-test rationale is in the October 8 DECISIONS entry. This is partial rule absorption, not closure: saved-profile upgrade, positive member/role/contact, previous HTTP cause and live writes/cleanup remain unverified. All active entries are retained; no archive or removal was performed. Evidence is in FEISHU_CONNECTION_PERSISTENCE_2026-09-30.md and FEISHU_ACCEPTANCE_2026-10-08.md. Tool capture/transport failures still do not establish platform denial.

## 2026-09-30: Default Connection Does Not Mean Only A Default URL

User had already requested remembered connection; temporary sessions cleared on each upgrade forced repeated entry. Implement local encrypted persistence and prove restart/upgrade behavior instead of scheduling another auth-only test. Old cleared memory cannot retroactively become saved configuration. Installed 0.1.62 genuine-account normal restart subsequently passed without text input/reconnect clicks: connected/saved/27 fields. Upgrade after a saved profile is still a separate unverified case. Keep for weekly rule extraction; do not recover credentials from chat, process memory or unrelated browser storage or ask for another fill when current saved connection is verified.

Windows encryption test must use normal app.quit: app.exit can prevent Local State flush, so a same-profile second process may fail decrypt despite initial encryption succeeding. Initial native test crash and decrypt failure were not evidence that Feishu credentials/permissions were wrong. Also inspect actual backend runtime paths; python312.dll lives under content-analyzer-backend/_internal, not a guessed backend directory.

## 2026-09-30: Business Assignment Must Not Become Actor Identity Verification

User corrected mandatory reading of the interface actor's name and a self-confirmation checkbox. The required field is the manually chosen current maintainer, not account authentication. Keep API actor and assignee separate; resolve the chosen dropdown option to a stable member key, never write plain names or default to the actor. New source supports explicit name search/choice with fresh role/member/readback checks. Real member search and assignment acceptance remain pending; keep this entry until tested, and do not treat a removed old gate as proof the previous HTTP failure is fixed.

## 2026-09-30: A Connected Schema Does Not Accept Person Reads

Installed 0.1.59 reported 27 fields after human reconnect, yet the real person/role action failed with FEISHU_HTTP_ERROR. Numeric HTTP status already survived backend sanitization but the renderer hid it, and the operation lacked a read-stage tag. Added allowlisted stage/numeric diagnostics with no raw transport payload; targeted/full offline regressions pass, diagnostic 0.1.60 installer prepared but not installed. Exact live cause and person assignment remain unresolved; do not infer permission/login failure or claim the workflow works. Keep the operator's freshly entered session until a coordinated upgrade.

Sandbox shortcut inspection returned a remapped sandbox user path; readonly desktop-session inspection confirmed both real shortcuts target the normal installed EXE. Verify environment visibility before declaring an installation defect. Immediate native action snapshots can precede the resulting render; use a later bounded readback rather than repeating a click.

## 2026-09-30: Verify Role Defaults And The Actual Bundled Runtime

The previous create path used role_mode:0. Official create docs confirm it does not use unprovided role defaults; this is not equivalent to preserving unrelated roles. New maintainer creation uses mode1 plus one explicit role and strict owner readback. Live effects/default notifications remain unverified; retain this entry until acceptance.

An artifact check guessed python311.dll and failed; a targeted file inventory found the actual bundled python312.dll, then source/package/runtime verification passed. Discover runtime filenames from the build rather than inferring a missing dependency from a guessed version. A fixture also aliased a request array into its simulated response and mutated the recorded request when adding default roles; use independent response copies to test wire payloads.

## 2026-09-30: Hidden Operations And Stale UI Authority

New native screenshots were not covered by the handoff entry's old ignore patterns. Added an exact UI-audit directory pattern and checked the three files. Verify each new evidence path with git check-ignore; an artifacts directory name is not a privacy guarantee.

Actual native inspection found folded create/update/cleanup operations and bright disabled controls. Renderer review found run changes retained record/account/safety state. Use visible operation modes and reset row-dependent drafts/confirmations on run changes without clearing the session. Four focused renderer tests now cover these transitions. New visual and real-workflow acceptance remain pending; retain this entry. Current running artifact must not be closed/overwritten merely to show a UI patch while the operator has entered credentials.

## 2026-09-30: Do Not Shrink Full Integration To A Read Probe

User explicitly expects lookup/local fill/new follow-up/update/delete in the main software. Stage risky writes behind precise confirmation instead of silently omitting them. Source/fixture/native package/live API/installed acceptance are separate gates. New main integration and fixtures exist, but real write/readback/cleanup remains unaccepted; retain this entry.

An explicit-contact round trip exposed a missing email/phone label parser, and local fill initially left the new follow-up contact draft empty. Test the complete data handoff, not isolated endpoint replies. Launching by a bare EXE path reopened the installed old version; verify actual UI version and ASAR URL, then use explicit process path. If operator input interrupts automation, reobserve safely and preserve entered credentials rather than closing blindly.

## 2026-09-30: Probe Acceptance Is Not Main-Product Integration

The user challenged whether the main software was connected and requested a real test. Actual installed UI and ASAR show 0.1.55 and no Feishu contact entry; source 0.1.56 is also unwired. Separate independent API probe, main/preload/renderer integration and installed artifact gates. Verify actual EXE path/visible version/ASAR instead of asking for credentials again to mask missing implementation. Integration remains unfinished; retain this learning.

## 2026-09-30: Visible IDs May Contain Invisible Text Differences

10:06 update: corrected real query returned one identity-reviewed candidate in manual_review, not an automatic WeChat proposal. Single-sample read/preview passes; the running older GUI did not persist the LF-variant flag, so the aggregate is not raw-value proof. Product confirmation/application and broader data quality remain pending; retain this entry.

Real search returned zero while the known record's DOM account number contained one terminal LF. This suggests a specific text mismatch, not proven API causality. Query only canonical and observed LF variants with exact platform binding and response checks; preserve conflicts rather than broadening to fuzzy search or rewriting records. A separate summary bug marked empty results identityVerified=true; now only matched, reviewed records can set it. 80 Node/13 Python regressions pass; real positive query still pending, so retain this learning.

## 2026-09-30: A Self-Consistent Fixture Can Still Contradict The API

10:06 update: a real official query now returned one identity-reviewed creator and a local manual-type preview. Query/preview is accepted for this sample; product integration/local application and writes are still unaccepted. Keep the remaining gate explicit rather than repeating an obsolete no-real-query claim.

The contact preview accepted scalar select values and its offline fixture repeated that assumption. Official field-format documentation specifies label/value objects; search operands are option-ID lists. Parser and fixtures now use documented objects, reject scalar/label-only/conflicting values, and resolve the option through same-type live meta. Consolidate auth/metadata/single-sample preview into one credential entry, not repeated credential-only tests. Real contact query and product integration remain unaccepted; retain this entry until that gate is evidenced.

Last reviewed: 2026-10-08 (partial consolidation above; unresolved entries retained).

All entries recorded through 2026-09-02 were reviewed. Stable, reusable rules were consolidated into `AGENTS.md`; architectural and product rationale remains in `DECISIONS.md`. The absorbed entries were removed after this review.

Record new material mistakes or user corrections below. Keep each entry concise and include the pitfall, correct practice, and reusable impact. Do not include secrets, private data, account state, or long chat excerpts.

## 2026-09-15: Plugin Ownership, Scopes And Browser Targets

- Required-field correction: earlier troubleshooting focused on rich-text persistence before checking every required field. Current safe DOM inspection also confirmed the required icon upload is empty. Inventory all required controls first and resolve independent blockers; a missing icon is not proof of the editor failure's cause. A true single-key test also failed to persist, so do not label this merely a paste issue. A local SVG is prepared, not uploaded or visually accepted.
- September 23 follow-up: Batch Acquire directly enabled the three approved groups without another modal. Obtain exact scope approval before clicking acquisition controls; do not assume the next screen is only a draft. Verify persisted status and distinguish enabled plugin groups from installed/data-authorized/live-tested software. Adjacent autosaving name/description fields also need separate readback: the first short-description write reverted while the name persisted; a standalone write plus blur and reload verified the final values.
Weekly disposition, September 21: reusable permission, distinct-scope and persistence rules are now in AGENTS and the September 21 DECISIONS entry. Keep this entire entry active: rich-details saving, access approval and live integration are unresolved. Consolidating a rule does not close its acceptance gap; no log entries were removed in this review.

- Persistence lesson: text visible in a rich editor is not saved configuration. In this run the short description/category survived reload, while plugin details did not. Record these separately and stop repeating equivalent fill/reload loops; the exact cause remains unproven. Input success, no toast error, and a valid category are not evidence that all required fields are complete.
- Release-scope lesson: the intended space was available in Create Version even though owner-managed debug scopes were empty. Draft selection is not publication. A radio click errored and left neither store option selected; keyboard selection plus checked-state readback verified the draft choice before canceling. Re-select and verify at actual submission.
- Tooling lesson: slow browser calls accumulated beyond the invocation limit and reset bindings. Keep slow actions in small batches; recover documented browser handles and inspect safe fields, not whole credential-bearing pages.
- Pitfall: treating work-item deletion or an integration's uninstall guide as proof that a self-built plugin is cleanable. Read the exact object lifecycle first; plugin deletion is owner-only and requires prior uninstall if installed.
- Permission lesson: the metadata and creator search endpoints belong to one broader work-item read group, not two endpoint-specific grants. An empty data-range selector with an owner-managed-space restriction is an eligibility clue, not evidence of logout. Do not request unrelated configuration/write access to get past it.
- Browser lesson: clicking a plugin in the app list opens a new tab. If the next navigation locator is absent, inspect the tab inventory before waiting/retrying in the old tab. Avoid basic-info snapshots because that page contains credentials; inspect navigation and specific safe controls only.
- Local tooling lesson: app upgrades change the bundled codex.exe directory. Resolve the current executable with Get-Command instead of reusing an old hashed path. A stale helper failure did not create the manifest or change the external plugin.
- State: one marked, unpublished plugin exists; bounded data scope and all API access remain pending. See [setup evidence](FEISHU_PLUGIN_SETUP_2026-09-15.md).
- User correction: the business request was already clear. Do not turn an unverified technical restriction into a requirements question or an immediate administrator handoff. Establish account identity, refresh scope, and inspect actual role evidence before concluding a role change is required.
- Follow-up: the workbench is accessible with the matching account and the refreshed scope dropdown is empty, but safety review rejected the generic space-menu click. Request that exact read-only scope and preserve the unverified-role boundary; do not bypass the rejection. A separate plugin-dropdown locator error was resolved with the documented AX Expand action, not by weakening safety checks.
- Authorized follow-up: the user granted the exact menu read; Space List then showed the target's two other administrators, and My Managed Spaces returned no match. Only now is the owner/space-role mismatch established. An empty space switcher did not mean zero accessible spaces. Restrict any proposed fix to the test plugin, with recipient/ownership approval and cleanup responsibility, not a silent broad space-admin grant.
- Publication correction: owner transfer addresses the debug-space limitation but is not a prerequisite for all integrations. The real Create Version dialog allows no frontend artifact for API-only use and supports enterprise/specified-space publication. Verify an internal-test approval/install route before defaulting to transferring ownership. Registration is not completed software, but authorization setup need not wait for impossible pre-authorization live tests. Label readiness honestly and do not submit public/store defaults or treat a conditional "publish when finished" request as unconditional approval.

## 2026-09-14: Verify Visible Navigation In Narrow Browser Panels

- Pitfall: a DOM snapshot listed a resource-library item in the collapsed navigation, but clicking it did not leave the workbench. Tool completion was not navigation evidence.
- Correct practice: inspect the visible panel, expand navigation using its labeled control, then verify the resulting resource page. A generic inventory fetch failure is not proof of logout or Feishu denial; a direct documented tab inventory remained available.
- Later read-only evidence: a visible icon-only create button opened the real form; target identifiers matched the form prefix, UI fields were inspected, then canceled. A hidden text span did not imply the parent button or permission was missing. API authorization, conditional validation and cleanup remain unverified.
- Field/menu lesson: contacts had no required marker in the current form despite the meeting assumption; a disabled delete-node menu was not work-item deletion. Distinguish UI required markers from API conditions, and workflow nodes from records before judging permissions.
- Doc-navigation lesson: some rich reference/menu clicks left the URL unchanged. Use the observed reference URL or a real search-result link, then verify the article title; do not count a successful click call as having read the linked article.
- Open Platform follow-up: an obvious /open-platform guess redirected to the workbench; do not keep guessing route variants. The actual avatar-menu link opened /openapp/home and Application Management linked to /openapp/list. All/no-data is account-scoped evidence, not proof that the tenant has no plugins. Do not create or change permissions under read-only authorization.

## 2026-09-14: Trace Export Selection Through To A Reopened Workbook

- Pitfall: the resource action ignored checkboxes, automatically pruned explicitly selected empty columns, and returned success before ExcelJS finished writing. Exact-name-only mapping also missed stored summary values already shown during review.
- Correct practice: share one export action, retain selected headers, use only documented field fallbacks, preserve zero, and reopen the generated XLSX to assert headers and values. Test rejected writes, stale selections and repeated clicks.
- Test correction: ExcelJS uses `instanceof Array`; a host library receiving VM-realm arrays can produce empty rows in the fixture. Execute the extracted production exporter in the library's realm, rather than changing business logic to compensate for the test harness.
- Boundary: the colleague's original raw results were not provided. Empty stored measurements remain empty; do not claim the repair recovers data that was never collected. Source/browser fixtures are not installed-app acceptance.

## 2026-09-10: Test Failure Paths And Units, Not Only The Happy Path

- Pitfall: the recoverable navigation-error branch bypassed the new quiet window, and the deadline started only after awaiting an unbounded load. Review reproduced both independently.
- Correct practice: bound the entire owned load, handle late completion without reviving drafts, and use one readiness gate for normal and recoverable loads. Cover changed targets, reloads and dispatch uncertainty as counterexamples.
- Pitfall: renderer CSS coordinates were interpreted as native DIP. Keep persisted CSS widths unchanged and convert all shared edges using trusted renderer zoom; verify non-default zoom on the installed app.
- Tooling correction: normalize ASAR entry paths with `path.normalize` on Windows before concluding a file is missing. Compare source bytes for code, but compare runtime fields structurally for the builder-transformed package manifest. Do not auto-reinstall an npm-lock checkout just because a newer pnpm runner requests it.
- Evidence boundary: both isolated Electron entrypoints exited before producing current page-test results. Record this as unverified, not a pass or a proven application defect. No current real-account success was observed.

## 2026-09-09: Isolated Fixtures Did Not Prove Live Invitation Readiness

- Pitfall: an installed build passed isolated Electron fixtures but rejected legitimate navigation on real logged-in PGY pages, including a two-recipient batch before its first preparation completed.
- Correct practice: maintain separate fixture, installed-artifact and live-platform verdicts. Log sanitized navigation event timing before modifying ownership guards; test actual SPA transitions and non-default renderer zoom/native bounds together.
- Reusable impact: a visible correct destination with a software failure is a failed acceptance, not an account-login explanation. No successful single manual website action proves software preparation or batch sending. See `INVITE_LIVE_CHECK_2026-09-09.md`.

## 2026-09-08: Establish The Failing Path Before Patching Readback

- Pitfall: calling a screenshot a confirmed date-format regression, assuming manual website success proved the software's single-send path, and adding fallbacks to stale field attributes before reproduction.
- Correct practice: clarify the actual clicked control, trace shared call paths, reproduce the original script failure, and test changed/empty fields as counterexamples. Read only current scoped form state; a missing field and a changed field need distinct errors.
- Reusable impact: batch tests must exercise the page verifier and asynchronous operation ownership, not only mock every platform call as successful. See `INVITE_REVIEW_2026-09-08.md`.

## 2026-09-08: Electron Load Completion Has Multiple Signals

- Pitfall: the new guard assumed `await loadURL()` implied `isLoadingMainFrame() === false`; a real isolated Electron flow proved `did-finish-load` can precede `did-stop-loading`.
- Correct practice: wait a bounded time for loading to settle while continuously preserving page identity and ownership. Test timeout, replacement and navigation as well as the happy path.
- Reusable impact: VM regression success alone does not prove Electron event ordering. Select the actual renderer rather than an `about:blank` BrowserView in Playwright tests, then test the packaged executable separately.

## 2026-09-04: Existing Splitter Code Can Still Be Functionally Missing

- Pitfall: treating the presence of `mousedown` listeners as proof that pane resizing still worked. The hit area was nearly invisible, limits disagreed across CSS and JavaScript, startup discarded the user's width, and a drag toward the native BrowserView could leave the renderer's mouse-event surface.
- Correct practice: use Pointer Events with pointer capture, make the separator visibly discoverable, share tested layout limits, persist only normalized widths, and re-clamp them after window resizing.
- Reusable impact: dynamic Electron acceptance must drag both separators in both directions, adjust one by keyboard, reload the renderer, and verify geometry plus stored/ARIA values. Source inspection alone is not acceptance.

## 2026-09-07: Do Not Describe An Aligned Workflow As An Implemented Control

- Pitfall: Product alignment was summarized without leading with the fact that the requested batch button did not yet exist, so the user reasonably interpreted the description as a delivered interface.
- Correct practice: Separate `agreed behavior`, `implemented source`, `packaged artifact`, and `installed/live-validated behavior` in every status report. Name missing controls directly.
- Reusable impact: Never let a precise future-state description imply current availability.

## 2026-09-07: Conditional UI Requires A Real Rerender Test

- Pitfall: Channel-specific append conditions were correct in source, but the existing tab handler only toggled composer panels and did not rerender the lower action surface.
- Correct practice: When a state variable controls DOM construction, update the store or otherwise rerender that subtree on state change. Test the actual visible button set after every tab transition.
- Reusable impact: Source-contract assertions are insufficient for stateful renderer changes; pair them with an interaction-level visibility check.

## 2026-09-08: Reload Acceptance Must Wait For Layout Initialization

- Pitfall: reading splitter geometry immediately after `page.reload()` captured the static CSS default before the module bootstrap restored persisted widths, producing a false regression.
- Correct practice: wait for the packaged version marker and initialized splitter ARIA values, then assert geometry and persisted storage agree.
- Reusable impact: asynchronous renderer bootstrap is part of acceptance timing; an early DOM snapshot is not final application state.


## 2026-10-15: Preserve Functions Without Freezing The Old Layout

- User correction: the first UI redesign retained the same long pages and changed visual styling; it did not meet the requested workflow reconstruction and wasted review effort.
- Rule: function preservation means mapping each existing action/state/safety contract to a discoverable destination, not preserving old page structure or order. Research relevant real product interactions and diagnose current screenshots before implementing the new task flow.
- Next step: deliver a clickable fake-data prototype and full destination map, distinguish interactive states from low-fidelity maintenance tools, and obtain layout/workflow review before business integration. Source tests for a skin change do not establish IA acceptance. See IA_PROTOTYPE_2026-10-15.md.
