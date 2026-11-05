# Decisions

## 2026-11-05: Separate Bitable Edition, Explicit Selected Sync

User requests a separate Bitable branch, preserving the Project edition and unrelated product functionality. User confirmed selecting creators in the software before batch synchronization; neither collection nor later enrichment automatically writes cloud data. Preserve local results and independent invitation/export selection. New edition must not initialize/restore the old Project connection; do not reuse Project credentials or roles as Bitable credentials/person IDs. No silent old-cloud migration or profile copying. Detailed schema, independent package identity, authorization, concurrency and acceptance proposals remain in [the plan](BITABLE_BRANCH_PLAN_2026-11-05.md), not implemented facts. Reevaluate when sync scope, team concurrency, baseline or authorization is decided; no business code or branch was changed in this planning turn.

## 2026-10-26: Verify The Tester And Its Side Effects

- Native process exit0 requires a completed-stage assertion. Required skips must be detected in both TAP `# skipped` and Node spec `ℹ skipped` output. Inspect Python entrypoints before choosing direct execution or unittest discovery; renderer fixtures must import current dependencies (including `enhanceWorkspace`) and select the intended workflow tab, not remove new behavior to make old fixtures pass.
- Inspect the actual 7za view of an NSIS installer: it may expose the payload directly or an outer `$PLUGINSDIR/app-64.7z`. Support both layouts without inferring missing files from a single assumed structure. Preserve failed reports, repair harness causes and create a new complete run; never edit an old failure into success.
- Evidence: [tester receipt](RELEASE_TESTER_2026-10-23.md) and the retained local report `tmp/release-tests/20261023-151927-f25120e0/report.json` were reread on October26: historical69 automatic groups passed, five installed/live gates pending, delivery blocked. This review did not rerun product tests or establish current release readiness. Reevaluate after test-runner, archive-tool, dependency, UI workflow or runtime changes.
- A script named safety probe is not necessarily read-only. Static inspection confirms `probe_pgy_runtime_safety.py` defaults to port8010 and posts to `/api/crawl/start` even after config assertion failures; `prepare_pgy_live_validation.py` invokes it. Keep both out of memory reviews/default automatic discovery. Running them requires separately authorized side effects and an isolated target; expected403 is not a no-write guarantee. Reevaluate if these scripts' behavior changes.

## 2026-10-26: Recovery Must Be Stoppable Without A Worker

- A restored paused queue has no active loop to consume a stop request. Accept recovery only when Stop without Resume preserves completed output, persists terminal state before releasing the active-run boundary, and allows later new collection under the existing cooldown. Persistence failures and restarts must remain recoverable/retryable; do not discard data or relax collection limits to unlock the UI.
- Make the old task discoverable at the task entry, not only through history. Exercise the actual recovery controls and shipped CSS at relevant window widths; passing clicks did not catch an inherited grid squeezing text/buttons. Evidence: [recovery receipt](TASK_RECOVERY_2026-10-23.md), including the failed candidate and corrected exact-artifact checks. Reevaluate after runner persistence, task UI or packaging changes. Installed/live acceptance is still separate, so the recovery learning remains active.

2026-10-23：用户要求每改版经过统一测试器。采用源码/精确包内运行/安装/真实业务分层门槛，白名单离线回归，必需跳过不算通过；精确安装包、源码与证据哈希绑定，不按版本号或旧记录日期自动放行。`deliver` 仅在全门槛通过后复制全新交付目录，原打包命令仍只产候选。测试器不默认安装、登录、发信或写云端。新增产品功能、平台DOM/安装渠道/测试运行时变化时扩展清单并重评；不能承诺零bug。详见[使用规则](../RELEASE_TESTER.md)。

2026-10-19：本轮用户明确授权固定105/112本机数据备份与升级回退，允许在私有用户目录保管正式数据恢复点，不含QA迁移、云端写入或发送。先离线复制并校验恢复试读，平台风险标记优先停；112遇风险后已回退105，人工核实后再继续既有授权范围，不据本地服务通过宣称登录/业务通过。

2026-10-19：邀约账号入口回退仅绑定当前open-account/check-login操作、account许可和已验证HTTPS公共首页（承载登录界面，无userinfo/query/hash）。其他路径须另行核实，不能放开达人/表单/发送稳定锁；导航代次和准备凭证失效继续生效。验证分别记录独立未登录首开与真实默认QA登录保留，见源design/native-workspace-01110。

## 2026-10-19: Explicit Local Coexist QA Channel

- Owner requested progress without waiting solely for an external VM. A build-time-only QA channel may run on this host only after appId/exe/GUID/menu/uninstall/userData/session/single-instance/backend-port/data roots and owned process cleanup are separately verified. A different directory alone remains insufficient. No account/runtime switch or production-profile copy.
- QA installer/uninstaller must refuse a live or unknown QA process result instead of force-killing the shared QA main/supervisor image; exact running-refusal and closed install/uninstall cycles were verified.
- Normal package behavior stays behind absence of QA buildFlavor. QA installation results do not authorize or prove formal upgrade installation, real login, IME or live unsent preparation. Default-path QA NSIS cycle passed; custom /D path did not and is not the delivered acceptance route. See [precise scope](../../design/native-workspace-01108/HANDOFF-QA-01108.md).

## 2026-10-19: Brand Selection Requires A Committed Named Option

- Keep candidate extraction and click inside the same associated popup. Class substring matches may include plural list wrappers: exclude wrappers containing named child options, but do not discard a valid row just because it has empty avatar or ID-only children.
- Search text, even a readonly echo, is not selection evidence. Verify the actual committed value after search dismissal. Only a rendered editable active search can block that readback; hidden/readonly former inputs cannot. Keep exact brand/recipient binding and final-send approval.
- Evidence: installed0.1.105 real two-person unsent batch passed after0.1.97-104 live failures; see [receipt](INVITE_BRAND_REAL_ACCEPTANCE_2026-10-16.md). If a regression fixture omits a required nickname, fix the fixture rather than weakening business requirements.
- Reevaluate on PGY picker DOM/interaction changes. Two preparations do not prove real sending, all brands, larger batches or other machines. Original failed evidence is retained.

## 2026-10-19: Artifact Identity And Installer Isolation Are Separate

- Version and HEAD alone cannot identify a dirty worktree. Freeze runtime file hashes, compare exact ASAR contents and distinguish delivered UI overlays from experimental source. Renderer-only screenshots do not prove native BrowserView pixels; label separate captures instead of composing apparent native evidence.
- A different NSIS destination is not isolation when appId, shortcuts and uninstall keys are shared. Verify a separate test OS/account and shared process/port behavior before installation; do not create environments or change accounts during memory maintenance.
- Evidence and limits: [0.1.107 handoff](../../design/native-workspace-01107/HANDOFF-01107.md) and [final materials](../../design/native-workspace-01107/FINAL-INSTALL-01107.md). Exact candidate checks passed, but installation/service/real IME/system DPI/login/live preparation remain open. Reevaluate on installer identity or packaging changes.

## 2026-10-19: Persist Layout Preference, Not A Temporary Clamp

- Commit final normalized drag values on pointer end/cancel/lost capture/blur through the same path as keyboard changes. Keep preferred width separate from viewport clamps, including narrow-window reload.
- Compact navigation needs stable accessible names and hints in both media-query and container-compact paths. Verify actual pointer/reload/zoom and native boundaries on the exact artifact, not only geometry functions.
- Evidence:0.1.106 red and0.1.107 exact23-check green in the linked native handoff. This is artifact-level evidence only; installed/IME/live gates remain unresolved. Reevaluate when layout persistence, compact modes or Electron scaling changes.

## 2026-10-16: Explicit Unquoted Platform Prices Become Zero

- User explicitly requested `暂未报价` default0, not a blocked row. Normalize that and equivalent `暂无报价`/`未报价` in the shared quote parser for image/video, creation/bulk and supplementation; preserve numeric versus text field types.
- This does not authorize clearing existing data automatically or treating missing/paused/malformed values as zero. Preview touched fields and preserve existing dispatch/readback rules. Reevaluate if the platform adds other explicit availability states. See [acceptance](INVITE_BRAND_REAL_ACCEPTANCE_2026-10-16.md).

## 2026-10-15: Brand Search Is Asynchronous And Ambiguity Needs A Choice

- Preparation owns bounded waiting for a committed but loading exact target; do not introduce collection-account viewing or cookie copying as an invitation prerequisite. The original user incident still requires real evidence.
- Exact brand names auto-select after search results arrive. Nonexact results pause without sending or ending the batch; operator selects a canonical candidate, which is freshly prepared and reused for later batch recipients. Do not guess the first row or treat entered search text as selected brand evidence.
- Scope extraction and click to the same associated popup, support direct-text option nodes, merge nested root matches but reject separate ambiguous roots. Stop/edit/replacement revokes pending choices. See [candidate and verification](INVITE_BRAND_WAIT_2026-10-15.md).

## 2026-10-15: Same-Batch Unsent Progress Is Separate From Contact Completion

- Add explicit unsent-next/final-complete only after successful preparation, preserving batch identity, cooldown and human final-send boundary. Do not require stopping/restarting to preview consecutive creators.
- Never treat preparation as sent/manual completion: retain checkbox/followup, drop renderer prepared-send payload, count prepared-unsent separately. Unknown send results still require outcome review; failed preparation cannot be relabeled as prepared.
- Two real consecutive preparations were accepted in installed0.1.95; final send was forbidden and untested. Reevaluate if multi-tab draft retention or unattended prepare-only batches are requested. See [receipt](INVITE_UNSENT_BATCH_2026-10-15.md).

## 2026-10-15: Creator Preparation Owns Its Bounded Recovery

- Collection viewing is optional, not an invitation warm-up requirement. Keep separate partitions; preparation/batch owns opening and waiting. Never solve this by copying cookies or requiring users to repeat three clicks.
- Carry actual document proof across calls; a failed load cannot be accepted next time merely because the address matches. One exact-target, normal-resolved creator reload can recover before preparation, only after bounded risk reads; aborts and sends never auto-retry.
- Human send confirmation and unknown-outcome protection remain. Review the live navigation evidence if the actual state does not meet the exact recovery condition; do not expand to same-domain navigation guesses. See [receipt](INVITE_DOCUMENT_RECOVERY_2026-10-15.md).

## 2026-10-15: Production Enrichment Uses Field Deltas, Not Test Ownership

- User approved existing-record supplementation without excessive gates. Use independent `enrich`, exact platform/account/maintainer matching, selected-row batch preview/confirmation and targeted readback.
- Compare only touched cloud fields before writing; creator/updater/timestamps, unrelated notes, display name and workflow are not an enrichment approval baseline. Blank values do not erase data; contacts append. Preserve original contact date and assignment.
- Exact pending unknown records require readonly resolution, not re-dispatch. Test mutation/cleanup authority remains separate. See [scope and remaining live gates](FEISHU_ENRICHMENT_2026-10-15.md).

## 2026-10-15: Save Feedback Must Not Replace The Focused Composer

- Keep invitation/review before Feishu handoff. Update save status in place while the composer owns focus, including errors; preserve ordinary derived refresh elsewhere. Do not stop saving or hide failure to retain focus.
- Recompute execution recipients and validate run/channel at action time. Template changes revoke old drafts and batch confirmation through local control updates, never by waiting for an autosave repaint.
- Reevaluate if the renderer adopts keyed components or other background rerenders must preserve active composition. Current fix proves autosave continuity, not every possible native IME/background transition. See [evidence](COMPOSER_INPUT_LAYOUT_2026-10-15.md).

## 2026-10-15: Initial Search Departure Is Not Target Authorization

- Explicit creator loads may capture the exact invitation search route as a departing source, in addition to creator/form identities. Allow query/hash updates only while that document remains current before commit/settling. Do not change the general navigation key or account settling policy.
- Recipient selection remains persisted-row based and target commit/read/risk/send checks remain independent. Search query changes cannot authorize a recipient; missing commit still fails. Reevaluate with sanitized event phase/source evidence if another starting route is reported, not a blanket same-domain exception. See [receipt](INVITE_SEARCH_HANDOFF_2026-10-15.md).

## 2026-10-15: Scroll Anchors Belong To The Scroll Owner

- Use list-relative card geometry, not ancestor-relative offsetTop. Preserve stable row/visible offset; ignore retired-node scroll events and let newer manual scrolling cancel pending frame recovery.
- Growing preceding cards can legitimately change raw scrollTop. Reevaluate geometry/scaling if transforms or virtualization are added. See [evidence](INVITE_SCROLL_REPAIR_2026-10-15.md).

## 2026-10-15: Production Creation Is Not Renamed Test Ownership

- Human approved nickname-only formal creation and automatic contact-establishment time, but explicitly declined Feishu configuration changes. Default new UI to production, retain explicit marked test mode, and never retroactively strip test provenance.
- Bind production to the same platform/account/maintainer dedup key. Persist explicit mode; exclude production from every test mutation/cleanup/history path. No acknowledged ID means no nickname-only reconciliation or blind retry.
- Generate the recognized date field immediately before dispatch and verify numeric millisecond readback. Empty contact is separate from placeholder validity: omit only for known optional metadata, keep required_mode1 and all other mandatory checks. Unknown date precision is a live acceptance gate, not grounds for timezone guesses or loose comparison.
- Reevaluate when the platform provides documented date precision or field-specific required-check control, or production editing/deletion becomes an explicitly scoped requirement. See [evidence](FEISHU_PRODUCTION_2026-10-15.md).

## 2026-10-15: Invitation Navigation Has A Departing-Document Phase

- A new load request does not prove the old document has exited. Exact local Electron red evidence reproduced the second-creator failure when old-form history changed before target commit. Track commit and a captured canonical source; permit only its same-document updates during owned creator/form handoffs, never during reads/sends or after commit/settling.
- Retain the pinned target form across source cleanup. Explicit load completion/ERR_ABORTED needs actual commit, not URL coincidence. Preserve all wrong-target, snapshot, risk, timeout and approval guards. Reevaluate with sanitized live phase evidence if the platform navigation contract changes; no blanket in-page exception. See [receipt](INVITE_NAVIGATION_HANDOFF_2026-10-15.md).

## 2026-10-14: Current Cleanup Approval Is Not An Initial Baseline

- Unassigned role owners may be explicit null under the existing supported contract. Preserve null in manual fingerprints; normalize only arrays. Missing owners reject, and null versus [] remains a real representation change. Independent review's rejection counterexample drove the final0.1.86 repair.

- Actual readonly role arrays permuted with identical assignments. Fresh manual DELETE reviews normalize only the typed role_owners role/owner sets, rejecting ambiguous/malformed collections and preserving all other fields, array order and audit changes. Existing v1/v2 stored baselines stay strict and are never restamped; current cleanup approval is independent of update authority. Source0.1.86 tests pass, installed/live reacceptance pending.

- Keep cloud DELETE distinct from hiding terminal dropdown history. Local archive validates exact target/entry identities and deletion or external-absence evidence, sets visibility only, preserves audit and sends no cloud request. Actual0.1.85 archived five entries without reducing the eight-entry manifest.
- A verified, acknowledged own AI-test object with an old blocked baseline may receive a separate manual DELETE preview, not general mutation authority. Require exact creator, target, marker/batch, sent values, maintainer and explicit initial workflow; expose the full current fields and changed updater to the reviewer. Obtain fresh exact-object approval, recheck the complete current version and persist a separate review receipt. Never replace the original baseline, grant update, accept unknown creation, or silently retry an unknown DELETE.
- Scope is cleanup of journal-owned test objects, not deleting or modifying old real records. Actual final0.1.86 passed three separate manual DELETE/exact-absence runs, archive3 and normal-restart empty-picker persistence; audit8 entries retained and no authority restored. This does not accept update or automatic initialization proof. Reevaluate on platform lifecycle semantics or actual cleanup failure. See [receipt](FEISHU_TARGET_RECORD_CLEANUP_2026-10-14.md).

## 2026-10-14: Initialization Times Do Not Prove An External Edit

- Actual authorized0.1.79 rejected TIMESTAMPS_UNEQUAL; actual0.1.80 then rejected TIMESTAMPS_REVERSED. Equality and ordering were both unsupported application assumptions. Source0.1.81+ uses audit timestamps only for positive integer shape, never initialization ownership/intervention inference; retain actor, acknowledged identity, marker, fields/owners, initial state/default checks and later record-version comparisons.
- Actual0.1.82 readonly workflow diagnostic showed only HISTORY_MISSING alongside explicit initial/unarchived flags and valid status audit. Source0.1.83 accepts an omitted history property under those affirmative conditions; present nonempty/malformed history stays rejected. Missing optional evidence is not affirmative evidence of advancement. Current diagnostics must not be presented as first-readback evidence or unlock historical blocked records.
- No elapsed-time tolerance or clock-based ownership inference. Do not grant legacy blocked objects a fresh baseline from current data. Reevaluate on live repaired baseline/CRUD evidence; source tests and old create success do not close software DELETE or current-maintainer binding gates. See [captured repair](FEISHU_CRUD_REPAIR_2026-10-14.md).

## 2026-10-14: Name Choice Is Not Temporary Mutation Authority

- Human questioned why a person's name needs a time check. Keep exact project member identity and explicit assignee choice separate from fresh action/preview authority. A name does not expire; a selected member must not silently change, while a stale preview must not submit after an identity, role, target or data change.
- Live CHECK_TIME_FUTURE1ms is an application timing false rejection, not a Feishu permission requirement. The five-minute inspection lease was our design, not a documented platform rule about names. Source0.1.78 removes cross-process wall comparisons with a conservative request-start/remaining-duration bound; backend expiry and other guards remain intact.
- Persisted-choice and preparation-time revalidation are separate from0.1.78. Source0.1.79 implements them with a separate encrypted target/actor-scoped preference, no saved approvals, and exact identity/role revalidation on explicit preview. Only choice survives expiry/restart; plans/tokens do not. Actual0.1.79 twice restored the same preference and connection; explicit readonly batch preview after more than five minutes succeeded without person reselection. See [scope and evidence](FEISHU_MAINTAINER_CHOICE_2026-10-14.md). Reevaluate on target/member/role changes; cloud mutation and other members remain independent gates.

## 2026-10-14: Maintainer Samples Must Be Eligible In The Target

- Human restricted positive acceptance to people appearing in the connected project's actual selectable `现维护经纪人` range. Verify the exact project, work-item type, role/field and unique member identity before testing attribution. General name search, activation status, existing assignments and old roster screenshots cannot establish current selectable eligibility.
- Keep eligible assignee, authenticated API actor/plugin permissions and review validity separate. Name matching is not an authorization proof; people outside the verified range are not positive samples, and missing matches do not authorize broader permission requests. This refines sampling, not a claim that the current implementation already enforces the complete eligible range.
- Retain earlier timing failures as observations; do not count unverified samples as eligible coverage or reclassify frontend invalid-deadline errors as permission denials. Reevaluate when project member ranges, role rules or platform metadata change; reread live eligibility before new marked test writes.

## 2026-10-13: Batch Review Time Is Not A Fresh Read Lease

- Installed0.1.75 manual batch review repeatedly exceeded a five-minute read-preview lease; restarting the query discarded all source/type choices. Do not extend TTL or infer contact type to compensate.
- After explicit local batch confirmation, serially re-query each selected account and require exactly the reviewed record/value/kind/identity variant. Apply only with the new token while run, creator, account, selection and approval remain unchanged. Changed sources, incomplete reads, stop and connection changes cannot authorize a local write. Existing local conflicts/backend TTL and separate cloud/maintainer authority stay strict.
- This renewal applies only to readonly contact previews for the approved local values; it never renews a cloud write plan or role confirmation. Actual0.1.79 applied three explicitly unclassified originals after manual review exceeded five minutes; file and restarted UI preserved raw3/typed0. Reevaluate when contact response semantics, review identity or lease policy changes; typed enrichment remains separate.

## 2026-10-13: Explicit Current Page Origin

- Historical feedback expects an instruction naming the current page to begin there. Preserve unqualified global ranks, but parse explicit current-page wording as a separate origin and require a verified visible paginator. Carry the origin through renderer/IPC/page reader/manual checkpoint and show the starting page in results. Conflicting current-page/first-page wording is rejected.
- Same ordered-page evidence, single-batch limit and rank40 manual cooldown apply. Failed reads restore their original page even when a clicked next page has not yet passed validation; risk stops perform no recovery navigation. Source behavioral regressions pass; installed acceptance is pending at this checkpoint.
- Reevaluate when command semantics, page metadata or current-page UI changes. This is a new explicit scope, not permission to reinterpret unqualified global ranks or bypass risk checks.
## 2026-10-13: Unclassified Contact Is Not A Typed Contact

- Human explicitly selected preservation of the original generic contact value. Do not infer WeChat, phone or email, or claim classified local backfill acceptance from generic cloud field success.
- The authorized installed three-record cloud test used unchanged returned values only in generic contact fields. Missing contacts remained rejected. Reevaluate classification only with explicit source metadata or operator review; retain source evidence and keep typed application separate.
- New source permits an explicit unclassified choice to save contactRaw/contactRawSource/contactRawCollectedAt, separate from typed fields. Reject different existing originals; preserve literal whitespace/newlines. Only an empty typed contact draft may fall back to the raw original for generic Feishu creation. Preview and renderer adapters must retain the same fields. Source tests pass; the repaired installed round trip remains pending.

## 2026-10-12: Readonly Retirement Does Not Grant Mutation Authority

- Decision: permit exact readonly external-absence checks for unique verified journal-owned records even when cleanup eligibility is blocked. Keep update/delete disabled and handler-guarded; selection alone grants no mutation. Capture mode, connection, target and entry identity, checking before dispatch and after awaits, including obsolete create handlers after local save.
- Reason/evidence: the selector hid legitimate readonly retirement after independently approved normal-page deletion; red regressions also reproduced stale handlers crossing into mutation. Source repair and isolated Chrome/native keyboard coverage are documented in [batch evidence](FEISHU_BATCH_SCALE_2026-10-10.md). Source passing is not installed/live acceptance or application DELETE.
- Decision: save only whitelisted rejection categories from the FIRST cleanup eligibility readback, never private response/audit/person/field values. Unknown old reasons remain unknown; later detail cannot supply a new stamp or relax ownership. Missing diagnostic evidence does not establish missing remote fields, an actor edit or insufficient permissions.
- Impact: journal selection, readonly retirement, mutation callbacks and safe diagnostics. Keep pending installation, live rejection-category and software-cleanup gates open. Reevaluate on exact-detail absence semantics, journal schema or platform audit/workflow contract changes; preserve legacy baselines and independent creation/readback/cleanup gates.

## 2026-10-12: Native Option State Is The Browser Fixture Oracle

- A minimal Chrome reproduction showed Playwright isDisabled retargeting an option nested in a label to its enabled select. Check native option.disabled and :disabled plus keyboard navigation; programmatic selectOption may select disabled options and does not prove human selectability.
- This changes fixture interpretation, not application permissions. Evidence is the dated LEARNINGS entry and blocked-readonly real-Chrome regression. Recheck when browser/automation versions change rather than generalizing the discrepancy to other controls.

## 2026-10-10: Successful Create Readback Does Not Prove Cleanup Ownership

- Sent-field and maintainer readback may be verified while cleanup eligibility stays blocked. Normal create, like unknown reconciliation, must not adopt a first-observed snapshot containing unproven external data as its cleanup baseline.
- Require explicit API actor creation/update origin, identical valid audit times, official explicit initial workflow flags/state/history and matching workflow audit, expected sent values, and supported typed metadata defaults or allowed empty fields. Missing evidence or unexpected data/roles/status sets cleanupBlocked with no cleanup stamp. Static metadata must not be required to predict dynamic creation timestamps. Preserve legacy v1 and unknown protections.
- Preserve session-only target-scoped reading preferences independently of authority. Refresh/reconcile/run changes may retain history/settings visibility, never renew a maintainer lease, restore a write plan or persist credentials.
- Reevaluate only with verified live platform origin/default/workflow contracts. Current live official initial-workflow shape and software-cleanup acceptance remain unverified; do not claim automatic cleanup from fixture positives. See [dated review](FEISHU_CREATE_PROVENANCE_2026-10-10.md).

## 2026-10-10: External Absence Is Not Baseline Approval Or A Repeated Delete

- Live exact legacy-test detail returned HTTP400 with numeric API30005 after separately approved normal-page deletion. Missing-record handling accepts only API30005 or HTTP400/API30005 in exact detail-read paths, not general HTTP errors, search results or mutation dispatch outcomes. Permissions, timeout, malformed replies and other statuses remain uncertain.
- Add explicit readonly verifyOwnedAbsence for one unique verified journal entry, exact entryId/recordId/current target and persisted AI title/batch. Recheck session, generation and unchanged entry after awaits. Save a cloned latest journal only after clear absence; keep identity and legacy hash, with externalAbsenceVerified provenance. No DELETE, baseline adoption or retirement of unknown results; these still use reconciliation.
- UI distinguishes externally absent from software-cleaned records, removes retired mutation selection, invalidates old plans and refreshes submission history. Expiry invalidates unsubmitted previews/counts/errors and gives recovery locally; original submitted/unknown identities and results remain. No automatic authority renewal.
- Reevaluate on API status/error semantics or journal schema change. Source/fixture passing does not prove installed persistence or marked positive cloud batch/quote readback. Canonical key order tolerance never permits changed values, owner, time or writer.

## 2026-10-10: Readonly Batch Preview Defers, Never Assumes, Write Approval

- Installed0.1.67 blocked readonly cloud dedup unless the cleanup/notification safety attestation was checked. Keep the attestation unchecked when cleanup is unverified. Explicit boolean deferred preparation still validates values, person, scope, complete dedup and short-lived plan; it creates no remote record or journal entry.
- Internally bind deferred approval to the plan. Executing that plan requires exact fresh safetyConfirmed=true before journal/network business work; a denied token is consumed. Original legacy preparation and update/delete gates remain unchanged. The UI permits readonly preview without the write checkbox; checking it preserves current reviewed plans, revoking it invalidates them. Final confirmation, saved-row/person recheck, repeat dedup and unknown-result protection remain mandatory.
- Check captured plan identity and safety/configuration again after a single-create save await. Revoking then rechecking cannot revive the old operation; batch revisions also cannot be revived. Red regression and independent review established the prior single-path stale callback and its repair, not a live cloud mutation.
- Reevaluate when approval transport or action ownership changes. Source/fixture passing is not installed/live acceptance, cleanup capability, atomic multi-computer dedup or notification suppression.

## 2026-10-10: Separate Target Ownership From Unassigned Roles And Version Record Stamps

- Live duplicate lookup rejected a third record because an unrelated role had explicit null owners. Only that non-target null representation is accepted; role IDs/uniqueness, complete pagination/scope/account/platform and the unique nonempty target maintainer remain mandatory. Missing/malformed owners are not generalized to empty; another role never substitutes for current maintainer.
- New verified record baselines use version2 recursive object-key canonicalization, preserving every value and array order, timestamps, writer and field types. Old unversioned baselines stay strict version1; do not upgrade an unmatched digest using the current record. Ephemeral preview stamps use version2 only after the persisted ownership check succeeds.
- Reevaluate on platform schema changes. Current old test cleanup mismatch has no original full snapshot, so representation drift cannot be distinguished from real changes and automatic cleanup remains blocked. Source tests are not proof of a live cleanup or batch write.

## 2026-10-09: Notification Permission Is Not Invitation Or Unrestricted Cleanup

- User explicitly permits Feishu new-record notifications; reviewed create UI states that impact rather than asserting no notifications. No invitation or software node advancement; cloud record scope still previewed and confirmed.
- Unknown-result reconciliation must not adopt external unedited fields/roles/status or enable cleanup without no-intervention evidence. Such create records can read back successfully while remaining cleanup-blocked and visibly unavailable for automatic mutation. Never loosen protection merely to make a test cleanup green.
- Reevaluate notifications before production or new workflows; exact cloud cleanup remains action-time scoped. Read-before-create is not an atomic cross-computer uniqueness guarantee.

## 2026-10-09: Bulk Cloud Writes Retain Submitted Identity And Uncertainty

- Bulk creation is distinct from local library contact backfill. Common maintainer/source apply to a frozen selected queue; each row has an independent expiring preview and a final eligible-only confirmation. No automatic dispatch after preparing. Stop waits for the current bounded write/readback then prevents the next row.
- Results belong to the submitted account/name/maintainer snapshot, not a mutable current list position. Preserve a separate submission history and recover journal unknowns on connection restore; show original ownership after personnel changes. Unknowns expose read-only reconciliation, never automatic repeat creates.
- Platform quote inputs accept exact yuan values only; blank is missing, not zero. Only unique configured number/text platform fields are allowed, never nonreported costs/rebates. Live metadata/type/unit/readback remains a release gate, not proved by the UI label.
- Editing identity cancels old query authority at click and dispatch, not just cosmetic confirmation. Expired previews disable new controls and give feedback for stale clicks. Reevaluate on schema/API limits and live acceptance; source/fixtures are not a delivered installer. See [goal report](FEISHU_BULK_SYNC_2026-10-09.md).

## 2026-10-09: Business Dedup Includes Current Maintainer

- User confirms same homepage account/same current maintainer skips new registration, different maintainer permits another record. Scope by project/type/platform; nickname and quotes are not identity keys. Registration does not prove invitation success.
- Compare stable selected member identities in the confirmed maintainer role, not API actor/name text. Ownerless, malformed and partial results block writing; never turn query failure into no match.
- Recheck exact remote matches immediately before dispatch, preserve local unknown-result journal guards, and allow bounded independent row previews without weakening expiry/person refresh/single-use checks. Client checks alone do not guarantee atomic dedup across computers.
- Source milestone/tests complete, not installed acceptance or bulk UI. Reevaluate if business permits multiple contracts per same maintainer/account or platform schema/concurrency changes. See [goal report](FEISHU_BULK_SYNC_2026-10-09.md).

## 2026-10-09: Batch Lookup Is Reviewed Local Backfill, Not Bulk Cloud Mutation

- Use explicit multi-selection, exact homepage account-number confirmation and the existing serialized single-row API. Keep a 50-row ceiling, short-lived independent run/row previews, source/type review and fresh identity/contact guards. Never auto-apply on selection or query, guess a conflicting source, replace local values or widen endpoints/permissions for batching.
- One confirmation applies only checked eligible local patches and reports per-row persistence. Stop is effective after the current bounded operation/save. Roll back failed local patches without undoing newer operator edits, so later saves cannot silently persist reported failures.
- This affects the Team Library Backfill UI and local review store, not existing Feishu records or test-cloud write approvals. Reevaluate on API limits, identity/schema changes, persistence conflicts and real batch acceptance. Source/fixture tests pass; installed/live acceptance remains open. See [evidence](FEISHU_BATCH_BACKFILL_2026-10-09.md).

## 2026-10-08: Explicit Enterprise-Public Non-Store Release

- After the blank specified-space selector blocked verification, user proposed Public and explicitly confirmed the disclosed enterprise-wide/non-store release of EXISTING17 groups. This supersedes the single-space plan below, not all future permissions or unrestricted business operations.
- Verified enterprise plugin and store publication are separate controls; official documentation bounds enterprise plugins to their tenant. Do not conflate Public usage with market distribution, and never choose it just because it is a default or a selector failed. Wider installation scope still requires exact approval.
- October8 observation:0.0.2 Published/share lists17 but target installation still0.0.1. October9 reloaded statistics now confirm installed0.0.2 and real maintainer/role lookup passes. Publication, installation/data authorization, effective interface permissions and business acceptance remain separate; assignment/CRUD/cleanup are not proved by this lookup. Keep endpoint allowlists, marked test-only writes, human previews and exact cleanup.
- Reevaluate least privilege and distribution before production, adding capabilities or other recipients. Current main flow does not require all attached mutation rights; their availability is not permission to use them. See [dated evidence](FEISHU_ACCEPTANCE_2026-10-08.md).

## 2026-10-08: Bounded Existing Permission Set At User Request

- User rejects the proposed five-group minimum after the fourteen-addition powers were shown, requesting all available rights for future use. Limit this choice to the original test plugin's CURRENT seventeen groups and original specified-space/internal/non-store release, not arbitrary future permissions, public sharing or the newer identity. This is a release plan/consent, NOT a completed release or business-action authorization.
- Broader configuration/user/comment/view mutation rights are not necessary for the current main flow and carry risk. Keep client endpoint allowlists, human previews, marked test-only writes, no changes to real existing records and exact approved cleanup; grant availability must not trigger implementation/use automatically.
- Reevaluate least privilege before production or scope/recipient changes; new powers need separate precise approval. Empty target labels are not safe release evidence: the prepared 0.0.2 is unsubmitted pending destination verification. See [current evidence](FEISHU_ACCEPTANCE_2026-10-08.md).

## 2026-10-08: Preserve Connection And Separate Acceptance Evidence

- Weekly consolidation promotes the authorized encrypted-connection and manual-maintainer rules into AGENTS. Do not interpret a missing business sample as a reason to request credentials again, or silently replace the chosen maintainer with the API actor.
- Cross-process encryption tests must use normal app.quit with the same isolated profile and retain Local State; app.exit can skip state flush. The recorded Windows test failed with forced exit and passed after normal shutdown. This is a persistence-test requirement, not a Feishu-permission diagnosis. See [evidence](FEISHU_CONNECTION_PERSISTENCE_2026-09-30.md).
- [Installed evidence](FEISHU_ACCEPTANCE_2026-10-08.md) separately accepts restored schema and an empty-manifest guard. Negative person-search evidence does not accept a real member/role; no local cleanup object does not establish cloud deletion capability. Preserve write, notification and action-time confirmation gates.
- Scope is repository guidance/test methodology only. Reevaluate on encryption/profile lifecycle changes or contradictory live evidence. Saved-profile upgrades, positive person/role/contact and live CRUD remain open; their learning entries are retained. This weekly review performed no account operation or new live acceptance.

## 2026-09-30: Remember The Authorized Connection Locally

- Explicit user correction supersedes the historical session-only/no-persistence design: remember successful Feishu connection by default, encrypt only in the local user's Electron safeStorage, restore authentication/schema without repeating entry.
- Never embed actual credentials in source or installers, expose them back to renderer, fall back to plaintext, persist API tokens or auto-run business writes. Disconnect retains the profile while pausing automatic restore; forget deletes the exact config only after confirmation. Preserve Electron userData/Local State during upgrade.
- Failed restore must not silently loop or overwrite the saved profile. Authentication renewal invalidates business confirmation. API actor remains distinct from the manually selected maintainer.
- Reevaluate on encryption availability, profile/account migration, rotation or permission changes. Genuine-account normal installed-app restart was verified on 2026-09-30 without typing or reconnect clicks (connected/saved/27 fields); saved-profile upgrade and CRUD remain separate gates. See [evidence](FEISHU_CONNECTION_PERSISTENCE_2026-09-30.md).

## 2026-09-30: Manually Choose The Current Maintainer

- User correction supersedes mandatory connected-actor name lookup/self-confirmation below. Let the user enter a maintainer's full name and explicitly choose the matching Feishu person; connection User Key remains solely the API actor and need not equal the business assignee.
- Search only that name in the connected project using the official user/search contract. Keep stable person keys in main-process session memory; expose opaque candidate tokens and minimal labels. Reject indistinguishable same-name candidates; never default to the first candidate, even with a single result.
- New-follow-up preview, short-lived choice authority, fresh member/role checks, role_owners injection and strict readback remain required. Lookup/update do not reassign existing team records. Typed names are not authentication or ordinary text role values.
- Reevaluate on live search/role eligibility or permission evidence and schema drift. Local tests and packaging do not establish actual assignment or full CRUD acceptance. See [manual-selection evidence](FEISHU_MANUAL_MAINTAINER_2026-09-30.md).

## 2026-09-30: Review And Read Back The Current-Maintainer Role

Historical actor-selection default superseded by the manual-selection decision above; the remaining write/readback boundaries still apply.

- Resolve the exact connected user and unique live maintainer role separately from contact lookup; do not treat user details as proof of account ownership. Require manual person confirmation and bind create authority to the session/target/live snapshot.
- Set only the maintainer on new follow-ups using role_owners and role_mode:1; preserve other default roles, never mutate a matched library record or silently reassign during an ordinary update.
- Include owner readback in success and uncertain-result reconciliation; record creation alone cannot establish assignment success. Missing/ambiguous/changed/inactive identities fail closed without broad searches or automatic correction.
- Official contracts and local regressions support implementation, not real acceptance. Reevaluate after user/role permission checks, authenticated per-colleague identity design, target notification/default configuration or API drift. See [evidence](FEISHU_MAINTAINER_BINDING_2026-09-30.md).

## 2026-09-30: Current Maintainer Is A Business Assignment, Not The API Actor

Historical per-colleague/default-to-actor proposal superseded by explicit user-selected business assignment above.

- Confirmed requirement: the user's intended person field is `现维护经纪人`, not created_by/updated_by. Each colleague needs their own operator identity; proposed new-follow-up assignment defaults to that colleague after explicit identity review.
- Boundary: lookup/local contact fill must not overwrite the existing team's maintainer or copy that assignment into a new follow-up. Assignment and API actor remain separate concepts; a supplied User Key/name is not proof of account ownership.
- Mapping evidence: current real create form shows `现维护经纪人` as a role-bound control and again inside `角色与人员`; `商务经纪/达人运营` is a separate control. The saved 27-field metadata contains role_owners rather than a standalone same-named field. Do not alias the multi_user business field, write plain display names, change the creator role or hardcode a person/role key. Verify API role configuration and write/readback format before implementing assignment.
- Evidence limit: initial browser reads timed out; a longer bounded read succeeded and the unfilled create form was inspected then canceled without saving. Role UI semantics are verified, but current-user identity and API role assignment/write acceptance are not; no permissions changed.

## 2026-09-30: Explicit Feishu Operations And Run-Scoped Authority

- Decision: keep create/update/test cleanup as visible mode tabs; clear identity, target and safety checks when changing runs, preserving only the connection session.
- Reason: actual native UI hid operations and showed disabled controls as actionable; stale per-run confirmation is misleading even when backend ownership checks remain effective.
- Scope: renderer layout/state and existing status IPC only; no relaxed mutation guards, persistent credentials or automatic sync.
- Reevaluate: after current visual/new-artifact/real-workflow acceptance or an approved batch synchronization design. Do not infer real CRUD acceptance from mode-switch tests.

## 2026-09-30: Full Main-Product Flow With Separate Record Ownership

- Decision: connect lookup, confirmed local fill, new follow-up, update and cleanup in the main product; library matches supply data but never become automatic mutation targets. Same creator in a different run may produce a separately confirmed follow-up; duplicate/uncertain submission for the same run/row is blocked.
- Reason: user corrected a read-only scope reduction. Existing library data must not be overwritten merely because it matched.
- Scope: single-creator test-mode actions, current preview/confirmation, first-create marker/batch and durable private manifest. Only verified software-created records may update/delete; remote changes halt mutation. Credential session is ephemeral and official API transport is bounded without retry.
- Reevaluate: actual target schema/default automation or live API evidence contradicts the prepared contracts; explicit production/batch scope approval. Offline tests, a diagnostic hit and dir packaging do not establish live CRUD or installed delivery. See [evidence](FEISHU_WORKBENCH_INTEGRATION_2026-09-30.md).

## 2026-09-30: Bound Legacy Account-Number LF Compatibility

- Decision: the single-creator diagnostic queries platform AND an OR of two exact identity texts (canonical account number, canonical plus one terminal LF). Response identities must belong to that set; do not trim arbitrary whitespace or change leading zeros. Preserve conflicts across both variants.
- Evidence: a real canonical query returned zero while the corresponding visible record has one terminal LF in its account-number DOM text. API raw value and causality await real repro; compatibility is not live acceptance.
- Scope: opt-in pure-query mapping, enabled by the local diagnostic; no fuzzy/nickname/contains lookup, retries, full-library scan or record cleanup. Empty results cannot claim identity verification.
- Reassess: contradictory live API evidence, index/scope mismatch or another documented legacy format. Diagnose instead of widening by guesswork.

## 2026-09-30: Resolve Contact Lookup From The Target's Live Metadata

- Decision: resolve unique exact business field names/types and the scoped Xiaohongshu option label/value from the same target work-item type's meta. Read select responses as objects, query option IDs as lists. Reject ambiguous/disabled/missing options; do not guess codes or widen configuration permissions.
- Reason: official metadata and field-format documentation establish these contracts; the earlier scalar fixture was wrong. Existing confirmed account-number semantics remain unchanged.
- Scope: one-shot local read-only query/preview; token remains in memory for that run only, private contacts display locally while persisted evidence excludes values/identities/record IDs. No product sync or write acceptance implied.
- Reassess: actual API schema/response contradicts documentation or target configuration changes; stop and inspect bounded evidence rather than guessing fallback identities.

## 2026-09-28: Match Visible XHS Account Numbers

- User confirmed the Feishu XHS ID field contains the profile's displayed account number, not its internal URL ID.
- Treat it as text, preserving leading zeros. Require exact platform plus account number; no nickname or PGY/profile-ID fallback.
- The read client uses one bounded official search request, returns proposals only, and performs no writes or automatic pagination/retries.
- Reevaluate individual legacy records if live evidence reveals mixed namespaces. Actual platform option/readback mapping remains unverified; offline tests are not live acceptance.

Last reviewed: 2026-09-23 (approved plugin grants verified; no business API call).

## 2026-09-23: Prepare CRUD Permissions Without Authorizing Real-Record Writes

- Applied update: user confirmed the complete disclosed groups; exactly those three were enabled through Batch Acquire and survived reload. Corrected and reload-verified the test name/description while preserving marker/batch. Scope approval is complete for these groups; publication, data authorization and actual business operations are separate and remain pending. See the applied result in the review below.
- User decision: include create, update and delete along with the previously discussed read permission. Supersedes the read-only target configuration, not the unwired read-only module's existing implementation boundary.
- Evidence: the [live permission review](FEISHU_PERMISSION_REVIEW_2026-09-23.md) found create inside the broad write group; that group also covers workflow changes, attachments and other operations. The delete group also covers attachments, subtasks and work logs. All three groups remain not enabled.
- Impact: disclose these extra platform powers before action-time grant confirmation; request no unrelated management/configuration groups. Scope data separately through administrator authorization. Any eventual writes require the existing AI-test marker, exact manifest and operation-specific approval; granting deletion is not permission to delete real records.
- Reevaluate when the user confirms the actual bundled groups, the platform changes grouping, or production operation scope is explicitly approved. Rename the old read-only test identity after expansion, preserve its marker/batch, and do not claim client enforcement or live CRUD until implemented and verified.

## 2026-09-21: Separate Feishu Authorization Setup From Product Acceptance

- Consolidated decision: prepare any approved internal test through explicit gates for identity/configuration, actual permission group, specified-space release without store listing, administrator installation/data authorization, and live client acceptance. Do not default to owner transfer or infer permission from a request to publish when ready.
- Evidence: the [September 15 real UI report](FEISHU_PLUGIN_SETUP_2026-09-15.md) found an empty owner-managed debug selector but a selectable target space in the release form. It also showed a broader indivisible read group and unsafe-for-this-test public/store defaults. These are dated observations, not fresh account checks or completed release approval.
- Impact: disclose the full read group, constrain actual data and client calls, and confirm each consequential action. API-only test setup need not invent a frontend artifact. Reopen or reload required configuration to distinguish persisted values from editor-only text; keep credential-bearing page inspection scoped.
- Open gates: details persistence, read-group approval, publication, installation and real API acceptance remain unresolved. No grant, transfer, release or implementation change is authorized by this memory review.
- Reevaluate when the platform permission grouping or release/debug workflow changes, or a fresh authorized live check supplies contradictory evidence. Preserve the latest failed acceptance until a matching successful check replaces it.

## 2026-09-14: Keep Metadata Preparation Read-Only And Unwired

- Decision: introduce a standalone main-process metadata reader, with a fixed official origin, explicit target/credentials, strict plugin-mode user permissions, bounded reads, no redirects and no retries. Preserve old envelope behavior.
- Why: target keys and browser login do not supply API authorization; offline preparation must not silently enable writes or reuse account Cookies. Error payloads can expose secrets and cannot be forwarded verbatim.
- Boundary: this is tested source preparation, not a configured credential store, live metadata response, sync button or creation/cleanup permission. See [evidence](FEISHU_METADATA_READER_2026-09-14.md).
- Reevaluate once real authorized metadata and secure per-user credential setup are available, before application wiring or support for additional hosts.

## 2026-09-14: Mark And Bound All Prelaunch Feishu Test Writes

- User decision: every prelaunch test object must be visibly marked AI test and removable after testing. Apply the [prelaunch policy](FEISHU_PRELAUNCH_TEST_POLICY.md) before real writes.
- Implementation boundary: marker and unique batch accompany creation; retain an exact protected manifest. No tests modify real records, and cleanup requires destination/manifest/marker/batch agreement, a preview and action-time confirmation.
- Reevaluate only on explicit production approval. UI marker candidates and the official deletion endpoint were inspected; actual marking/deletion capability and API authorization remain unverified. Documented policy is not an implemented write guard or permission to create/send/delete.

## 2026-09-14: One Resource Export With Explicit Column Semantics

- Decision: the top resource action exports the checked columns; settings live directly below it in a collapsed section. Explicit selections preserve even empty headers, while omitted selections retain legacy default pruning. Invalid/empty explicit selections fail instead of exporting everything.
- Why: the previous top action ignored checks, both paths pruned unavailable fields, and the resource mapper missed documented summary/metric aliases. Preserve numeric zero; never infer structured metrics from freeform outreach notes or invent missing measurements.
- Impact: await the workbook writer before reporting success; freeze run/columns per request, prevent repeated clicks, and expose retryable column-load failures. No change to raw-detail/contact exports, account partitions, collection/calibration or invitation send gates.
- Reevaluate when: raw collection schemas or the resource-column contract change. Real XLSX round trips and isolated DOM tests do not establish installed-app or colleague-data acceptance.

## 2026-09-10: Bound Owned Navigation And Convert Native Geometry

- Decision: only the current operation's canonical creator/form may finish same-document initialization inside a 750 ms quiet window, bounded by 3 seconds of settling and 25 seconds for the full owned URL load. Recoverable aborted loads use the same gate; other load errors fail. Full reloads, different targets and any navigation after reads still invalidate preparation. Diagnostics contain operation/reason/event type, not account or creator data.
- Why: immediate post-load checks can reject initialization; the old error fallback skipped readiness, and a never-resolving load held the operation lock indefinitely. These gaps are reproduced locally; the precise live platform trace remains unconfirmed.
- Impact: no change to account partitions, protected collection page, per-recipient confirmation, strict current-field readback, or uncertain-send reconciliation. Width persistence stays CSS pixels; main-process BrowserView rectangles use only the trusted renderer zoom, never a supplied zoom/device scale.
- Reevaluate when: real installed acceptance provides contradictory event/geometry evidence, PGY changes its route identity, or Electron changes navigation/zoom behavior. A built installer is not live acceptance.

## 2026-09-08: Current Form Evidence And Owned Invitation Operations

- Decision: prepare and send share one current-value reader; only calendar-valid equivalent dates normalize. Every pending operation owns its immutable recipient/template context, WebContents and navigation generation. After input dispatch, an unreadable outcome remains unconfirmed until the operator reconciles it.
- Why: offscreen labels and replaced hints produced false changes, stale-value fallbacks could approve the wrong content, and delayed replies could attach to another recipient or invite a duplicate retry.
- Impact: conservative serial preparation, explicit per-recipient send confirmation, distinct unreadable/changed diagnostics, operation-specific busy/stop states, and independent DOM/IPC/batch/artifact fixtures. Account partitions and collection/calibration logic remain unchanged.
- Reevaluate when: platform form semantics or Electron navigation lifecycle changes. Real-account acceptance remains separate from synthetic fixture success.

## 2026-09-02: Preserve Successful Batch Position And Reuse The Mail Workspace

- Decision: after a complete ranked candidate read, keep the manual PGY BrowserView on the last confirmed page; restore the start page only for incomplete, canceled, or safety-stopped work. Keep Tencent Mail in one non-closable `persist:mail_default` BrowserView and reuse its current allowlisted URL for later batches, loading the home page only when the workspace is new or outside the approved mail domains.
- Why: returning every successful read to page 1 makes continuation batches error-prone, and persistent cookies alone do not preserve an authenticated in-page state when the app destroys or reloads the page for every batch.
- Impact: a first-30 read can continue from page 2, and repeated email handoffs retain the current mailbox page without performing any compose, recipient-fill, or send action. Platform login expiry and risk prompts still require manual handling.
- Reevaluate when: PGY changes pagination semantics, Tencent changes its authenticated domains or session model, or Electron replaces BrowserView. Outcome-specific recovery and the human send boundary remain mandatory.

## 2026-08-26: Calibration Success Requires Data Readiness, Not Only DOM Structure

- Decision: keep paginator and creator-row calibration as structural evidence, but report overall success only after both page 2 and the restored page 1 expose complete ID-bearing creator snapshots. Candidate-like response scopes may coexist until one snapshot matches the full visible nickname order; only then is that scope locked. A missing snapshot may trigger one current-page control click, never a full page reload or blind page turn.
- Why: the same calibrated selectors could pass on one computer while response timing selected an unrelated recommendation endpoint on another. DOM success did not prove that the DevTools response body was captured, parsed, and matched to the visible list.
- Impact: operators see `数据未就绪` without being told to recalibrate working selectors, and diagnostics distinguish debugger, loading, body, JSON, schema, and cache failures. Cross-page verification cannot turn green on structure alone.
- Reevaluate when: PGY provides a stable approved list API or response schema. Any replacement must still bind data to visible page identity and ordered creator evidence before collection.

## 2026-06-29: Repository-local memory is authoritative for handoff

- Decision: Use `AGENTS.md` plus `docs/project_memory/` as the first-read context for future helper threads.
- Why: The project has multiple historical directories and prior chat context can be stale. Repository-local memory makes handoff explicit and auditable.
- Impact: New threads should recover context from files, then recheck volatile environment state.
- Reevaluate when: The repo is split, renamed, or moved to a different maintenance workflow.

## 2026-08-21: Keep Historical Calibration Evidence Without Reusing It As Current Proof

- Decision: persist only a sanitized prior cross-page record: verification time, page-one/page-two counts, and restoration to page 1. After restart, show `上次成功，需复验`; require a fresh current-page pass before enabling cross-page validation. If returning to results falls back to the generic creator plaza, stop validation until the operator rechecks filters and page.
- Why: `0.1.45` loaded saved selectors but discarded the validated UI state, so the established calibration experience looked reverted. It also allowed cross-page validation to continue after opening a generic fallback page, which could test the wrong result set.
- Impact: saved selectors remain `已完成`, prior evidence remains visible and auditable, and only current-session page plus cross-page proof becomes `校准成功`. Selector changes invalidate the saved historical evidence.
- Reevaluate when: PGY exposes a stable query identity that can prove the exact filter set across restarts. Historical success must never silently become current proof.

## 2026-08-20: Treat Invitation Entry And Detailed Form As Separate Contracts

- Decision: Model the creator-page invitation dialog as navigation and option selection only. Treat `/solar/pre-trade/invite-form` as the structured draft contract, and treat only its bottom `发起邀约` control as the final representational action.
- Why: The two layers reuse the same button label but have different effects. Live inspection of the detailed route proved that brand, contact, product, cooperation introduction, and dates exist only after the first-layer action.
- Impact: Preparation may traverse the first layer, fill the detailed form, and read every value back. Final send requires an exact recipient, unchanged form URL and values, a short-lived single-use token, and action-time human confirmation.
- Reevaluate when: PGY changes either route or exposes an approved invitation API. Revalidate both layers independently; never infer the second-layer schema from the first dialog.

## 2026-08-19: Keep Account Role Switching Fixed And Reassert The Foreground View

- Decision: Keep the browser tab strip and a compact `采集页 / 邀约账号` role switch outside the scrolling workbench. After an awaited creator-page load, activate the intended role BrowserView again before reporting success.
- Why: Live testing showed that a role action could update the row state while the previously visible BrowserView remained in front, and long workbench scrolling could remove the only visible tab controls.
- Impact: Collection, invitation, detail, mail, and background automation views retain their existing partitions and attachment rules. This change affects foreground presentation only; it does not copy cookies, retarget automation, or add an invitation send path.
- Reevaluate when: Electron replaces `BrowserView`, the app adopts a different window/tab host, or background capture no longer depends on attached full-size views.

## 2026-08-19: Invitation Work Uses A Separate Account Partition And A Human Send Gate

- Decision: use a dedicated `persist:pgy_invite` BrowserView for the invitation account. Creator pages may be opened only by passing a selected run and row id to the main process, which re-resolves the stored creator URL. The invitation address bar is read-only and role navigation is limited to the PGY HTTPS host. Automatic assistance ends at verified draft filling; the operator performs the final send.
- Why: another tab in `persist:pgy_default` would share cookies with collection, and a renderer-supplied URL would not prove that the creator came from the selected collected result. Automatic sending would also cross the existing human approval boundary before the real form contract is known.
- Impact: collection and invitation identities remain separate; fabricated URLs and arbitrary invitation-tab navigation fail closed; no `invites:send` IPC is allowed. Invitation calibration must target the fixed invitation BrowserView and must not reuse collection selectors as proof.
- Reevaluate when: PGY supplies an approved invitation API, the account model changes, or a separately reviewed structured approval contract explicitly includes every live invitation field and recipient.

## 2026-08-18: Separate Calibration Progress From Validation Success

- Decision: calibration actions use a consistent `开始校准` / `重新开始校准` and `校准这一步` / `重新校准` vocabulary. Each step keeps its stable number and separately displays its state. A saved selector is `已完成`; only successful current-page plus cross-page validation yields overall `校准成功`.
- Why: the former `OK` marker and mixed button labels conflated saved configuration with verified behavior, so operators could not tell whether calibration had started, completed, failed, or actually passed.
- Impact: the calibration view has explicit neutral, running, saved, success, and failure tones; failed validation remains visible with a readable reason. State resolvers and a renderer source contract protect the vocabulary and success boundary.
- Reevaluate when: calibration becomes a fully automatic single action. Even then, the UI must preserve distinct running, success, and failure evidence.

## 2026-08-18: Separate Paginator Discovery From Cross-Page Proof

- Decision: step 3 reports two distinct operations. Paginator discovery may briefly scroll the result pane to trigger lazy mounting, but it never clicks a page; it reports and saves current-page, visible-page, and control-count evidence. Cross-page validation separately reports its running state, enters page 2, confirms a changed creator order, returns to page 1, and reports both page counts.
- Why: the previous `重新校准` interaction caused unexplained visible movement and then showed only `已完成`, which did not prove whether the paginator was merely found or actually usable.
- Impact: the pagination step has persistent pending, locating, located, verifying, verified, and failed feedback. The cross-page button is disabled and labeled `验证中...` during the check.
- Reevaluate when: PGY provides a stable approved pagination API. The operator-visible distinction between discovery and behavioral proof must remain.

## Main product line is the Electron desktop app

- Decision: Treat `desktop-app/` as the main product path.
- Why: The desktop app embeds a real browser, supports manual login/intervention, batch tasks, evidence, export, SQLite/KB, and AI analysis. This matches the intended conservative Pugongying workflow better than the older standalone Python crawler.
- Impact: Most feature work should start in `desktop-app/`; `content-analyzer/` is compatibility/backend/reference unless a request clearly targets it.
- Reevaluate when: The backend is fully replaced, the desktop app is split, or a web/intranet service becomes the primary product.

## Keep collection conservative and operator-controlled

- Decision: Maintain manual login, serial/low-concurrency collection, and pause-for-intervention behavior.
- Why: Pugongying/Xiaohongshu pages may involve login, risk controls, and changing DOM. Human-in-the-loop collection is safer and more maintainable than aggressive automation.
- Impact: Avoid captcha/risk-control bypasses, high-concurrency crawling, or hidden account/session manipulation.
- Reevaluate when: An official API or approved data source replaces browser-based collection.

## 2026-08-05: Visible pagination defines the current PGY page

- Decision: Use the visible active numeric page or disabled previous control as primary current-page evidence. Candidate-list response metadata is fallback and cross-check evidence only.
- Why: A third-party response can contain multiple unrelated pagers, while the visible paginator describes the page the operator is actually viewing.
- Impact: A response/DOM conflict cannot force a false page-1 redirect or silently import candidates. Payload page extraction stays local to the selected candidate-list branch, and unresolved conflicts fail closed.
- Reevaluate when: PGY removes visible pagination or an official API supplies a single authoritative page identity.

## 2026-08-05: Detail and XHS work use a dedicated role tab

- Decision: Keep the collection BrowserView protected and route creator-detail resolution, XHS login/profile reads, enrichment, and mail to separate explicit role tabs.
- Why: Browser back navigation and renderer rerender recovery cannot reliably reconstruct PGY filters, page number, history, and scroll after the collection page has been replaced.
- Impact: Automation targets explicit BrowserViews instead of the active tab. The collection tab survives round trips unchanged; renderer list state is restored independently by run/filter context and creator anchor.
- Reevaluate when: The desktop browser architecture changes to a different multi-view model with equivalent role isolation.

## 2026-08-05: XHS readiness requires stable target-page evidence

- Decision: Classify XHS profile reads from canonical target URL, login/risk signals, document/profile evidence, and consecutive stable visible snapshots; parse only the resulting public contact snapshot.
- Why: A fixed delay followed by one DOM read races SPA rendering and creates both missed emails and false profile failures.
- Impact: Bounded polling may wait longer on slow pages, but it does not reload repeatedly, bypass login/risk prompts, or treat a skeleton/profile mismatch as success.
- Reevaluate when: XHS exposes a stable approved structured source for public profile contacts.

## Do not commit real runtime data

- Decision: Keep cookies, `.env`, task sheets, real creator links, runs, logs, and local databases out of Git.
- Why: These can contain private account/session data or business-sensitive creator lists.
- Impact: Tests and docs must use sanitized examples only. `.gitignore` excludes local input/output files.
- Reevaluate when: A safe synthetic fixture set is created and explicitly reviewed for publication.

## Quality and path-safety checks are part of baseline reliability

- Decision: Keep `quality_report.json`, `task_state.json`, and guarded path opening as baseline behavior.
- Why: Operators need to inspect missing fields/failure pages, and renderer-to-main path opening is a high-power boundary.
- Impact: Future changes should preserve or extend tests for `lib/quality_report.js` and `lib/path_guard.js`.
- Reevaluate when: A broader permission model or run dashboard replaces these primitives.

## 2026-06-29: External Automa plugin is product reference, not main architecture

- Decision: Keep the Electron app as the main product and use the external Automa/Feishu "creator signing Copilot" mainly as a workflow/product reference.
- Why: The external plugin test version had difficult installation, slow page-by-page automation, and opaque bundled code/workflows. The current app is more suitable for controlled collection, evidence, quality reports, exports, and long-term maintainability.
- Impact: Borrow concepts such as signing tasks, search criteria, creator list, detail table, contact status, execution records, reset/retry flows, and Feishu Base collaboration. Do not rebuild the main product around a browser extension.
- Reevaluate when: The supplier provides maintainable source/workflow JSON, official APIs become available, or a plugin-only workflow proves faster and simpler in production.

## 2026-06-29: Signing/search task context becomes a first-class model

- Decision: Add a dedicated signing/search task model for task name, channels, contact plan, and filter criteria instead of treating batch collection as only a URL list.
- Why: The target workflow is closer to "create task -> search/filter -> collect -> quality check -> export/sync -> contact tracking" than a raw crawler queue.
- Impact: New task-related features should extend `desktop-app/lib/signing_task.js` and keep business context in run metadata before adding more UI or Feishu sync.
- Reevaluate when: The workbench adopts a different domain model or moves task state fully into Lark Base.

## 2026-06-29: Persist task templates and execution records locally first

- Decision: Store signing/search task templates and recent execution records under Electron `userData/signing_tasks/`.
- Why: This gives operators reusable task setup and a lightweight run history without committing business data or requiring Feishu Base before the local workflow is stable.
- Impact: The task page can load/save/delete task templates, show recent run records, summarize quality reports, and open run directories. Future Feishu sync should treat this local state as the source to map from, not replace it prematurely.
- Reevaluate when: Team collaboration needs require Lark Base as the primary task database.

## 2026-06-30: Treat external RPA tools as action executors, not the product core

- Decision: Keep the Electron app as the product cockpit and system of record. Use Automa Hosted and XiaoMiFeng WeChat RPA only as replaceable action executors behind explicit input/output contracts.
- Why: The Feishu manuals describe a useful complete signing chain, but the actual implementation depends on many moving parts: Chrome extension setup, hosted workflow IDs, local backend, WeChat RPA activation, local DB paths, browser permissions, and scheduled jobs. XiaoMiFeng is a packaged Windows RPA app, not maintainable source, and RPA is inherently slower and more fragile than structured data flows.
- Impact: Product work should prioritize local task/creator/execution models, quality reporting, Excel/template compatibility, and result import before deeper automation. Vendor tools should be integrated through adapters and evidence-based sync, not by making their UI or local DB the source of truth.
- Reevaluate when: A vendor provides stable APIs/source/workflow exports and versioning, or a field test proves an external executor is reliable enough to own a larger part of the workflow.

## 2026-06-30: Do not build a Chrome extension path

- Decision: Do not develop a Chrome browser plugin for this product. Keep the near-term focus on Pugongying creator discovery, creator review/filtering, and contact-list/Excel generation inside the Electron app.
- Why: The user wants the workflow to be easy to operate and not over-complicated. The vendor Chrome/Automa route adds installation and maintenance burden, while the current business value is mainly in finding suitable creators and producing a usable contact table.
- Impact: References to Automa should remain product/process context only. New implementation work should target the Electron app's Pugongying flow, selected-creator contact table, and optional XiaoMiFeng-compatible Excel export.
- Reevaluate when: The user explicitly changes direction toward a browser plugin or an official browser-extension requirement appears.

## 2026-06-30: Start contact-list support as reviewable Excel export, not direct RPA control

- Decision: Implement the first contact-list feature as a reviewable export flow generated from local run results. Let operators preview creators, select/exclude them, add priority/contact/notes/exclusion reason, then export a human-reviewable `建联表` and a separate selected-only `小蜜蜂导入表`.
- Why: The user wants an easy workflow centered on Pugongying discovery and contact-list preparation. Excel is useful immediately, can be handed to XiaoMiFeng or future WeChat AI tools, and avoids binding the product to fragile RPA internals.
- Impact: Next improvements should focus on persisting per-run review state, cleaner contact fields, and real template mapping. Do not write directly into XiaoMiFeng databases until a stable schema and version policy are verified.
- Reevaluate when: A real XiaoMiFeng import template/result export is available, or the team chooses a different downstream contact executor.

## 2026-06-30: Persist contact review state locally per run

- Decision: Store contact review rows and contact-table defaults in Electron `userData/contact_reviews/`, keyed by run directory name.
- Why: Operators need to revisit a run without losing selected/excluded status, priority, contact info, notes, and exclusion reasons. Keeping it in userData preserves local workflow state without committing business review data to Git.
- Impact: The export page can autosave review edits and reload them before regenerating preview/export files. Future sync/import work should treat this local review state as the source for contact-table decisions.
- Reevaluate when: Review state moves to Lark Base or another team collaboration database.

## 2026-06-30: Improve discovery through assisted manual flow, not hidden automation

- Decision: Add lightweight Pugongying discovery helpers in the task page: open the creator plaza, copy a search checklist from task criteria, and add the current embedded-browser creator page to the candidate queue.
- Why: The requested direction is easier operation around Pugongying discovery, without Chrome plugins or over-complicated RPA. Assisted manual intake keeps the operator in control while reducing repeated copy/paste work.
- Impact: Future discovery work should keep this pattern: make candidate intake and pre-run checks smoother before adding deeper automation.
- Reevaluate when: An official API or a stable, approved search data source becomes available.

## 2026-06-30: Use pre-run checks to reduce operator mistakes

- Decision: Before starting collection, show candidate count, note coverage, template status, criteria count, Pugongying login status, and a confirmation summary with warnings.
- Why: The simplified product depends on operator-controlled collection. Explicit pre-run checks reduce empty queues, missing templates, forgotten criteria, and unconfirmed login state without hiding platform risk controls.
- Impact: Future run-start improvements should remain transparent and manual-friendly; do not convert login/risk-control handling into bypass automation.
- Reevaluate when: Collection is driven by an approved API or a different official data source.

## 2026-06-30: Save candidate queues inside signing tasks

- Decision: Store the current candidate creator queue with saved signing/search tasks, including normalized Pugongying URLs, creator labels, notes, status, priority, and exclusion reason.
- Why: In the target workflow, a task is more than filter criteria. Operators may spend real time discovering and curating a candidate pool before collection; that work should be recoverable.
- Impact: Future task persistence changes should preserve candidate data in `desktop-app/lib/signing_task.js` and keep it in Electron `userData/signing_tasks/`, not in the repository.
- Reevaluate when: Candidate pools move to Lark Base/Sheets or another shared task database.

## 2026-06-30: Let candidate decisions seed contact review

- Decision: Carry candidate status, priority, exclusion reason, and note into run metadata, then use those fields as default values when building the contact-review preview.
- Why: Discovery and review are not separate worlds. If an operator already marked a creator as priority or excluded before collection, the contact-list review should reuse that judgment instead of asking them to decide again.
- Impact: `desktop-app/lib/task_runner.js` should preserve candidate metadata in `meta.json`; `desktop-app/lib/contact_sheet.js` should let saved per-run review edits override candidate defaults.
- Reevaluate when: Candidate/review state moves to a shared database or a different canonical creator table.

## 2026-06-30: Make candidate triage batch-oriented

- Decision: Add status filtering, current-view URL copy, and batch selected/candidate/excluded actions to the task-page candidate queue.
- Why: The intended workflow may involve dozens or hundreds of creators. Per-row editing alone is too slow for initial discovery and screening.
- Impact: Future candidate-pool work should continue to operate on the current filtered set and keep actions explicit before collection starts.
- Reevaluate when: Candidate triage moves to a dedicated table/database view or a shared Lark Base workflow.

## 2026-06-30: Collect only the intended candidate scope

- Decision: Add a saved collection-scope setting for task runs: active candidates by default, selected-only when needed, or all candidates for exceptional cases.
- Why: Once operators can exclude creators during discovery, the collection runner should not waste time visiting excluded creators unless the operator explicitly asks for all candidates.
- Impact: The task page should run only the selected scope, while keeping excluded candidate metadata in saved tasks and run metadata for later contact-review defaults and auditability.
- Reevaluate when: Candidate states are replaced by a richer pipeline/status model or collection is driven by an official API.

## 2026-06-30: Support pre-collection candidate review export

- Decision: Add a candidate pre-screening Excel export before collection, with a `候选初筛表` sheet and a `筛选条件` sheet.
- Why: The simplified workflow benefits from quick teammate/client confirmation before spending time on browser collection, especially when candidate pools are large.
- Impact: Keep this export independent from post-run contact sheets. It should reflect task criteria, candidate status, priority, exclusion reason, and current collection scope without requiring a run directory.
- Reevaluate when: Candidate review moves to Lark Base/Sheets or a shared database view.

## 2026-06-30: Treat candidate Excel as a round-trip collaboration format

- Decision: Parse candidate screening Excel files back into the candidate queue, including status, priority, exclusion reason, and notes. Provide separate replace-import and merge-import actions.
- Why: If teammates edit the pre-collection workbook, operators should be able to import those decisions instead of manually copying them back into the app.
- Impact: `desktop-app/lib/pgy_excel.js` owns Excel-to-candidate parsing; `desktop-app/main.js` should not grow a second parser. Future import changes should keep exported `候选初筛表` files round-trippable, and merge-import should update by normalized Pugongying URL without dropping unrelated candidates.
- Reevaluate when: Candidate review moves from Excel to Lark Base/Sheets or another shared system.

## 2026-06-30: Warn about unsaved candidate changes

- Decision: Show an explicit warning when candidate queue or collection-scope edits have not been saved into the current signing/search task.
- Why: Candidate triage can involve teammate Excel merges and batch edits. Operators should not assume those local UI changes are durable until they save the task.
- Impact: Candidate mutations in `desktop-app/renderer/views/tasks.js` should set the dirty flag; successful task save or loading a saved task should clear it. Start-run confirmation should include a warning when the dirty flag is set.
- Reevaluate when: Candidate state autosaves to a local database or shared task store.

## 2026-06-30: Make contact-review persistence visible

- Decision: Keep contact-review autosave, but show save status and add a manual "保存复核" action in the results export page.
- Why: Contact review is run-level business state. Operators need visible confidence that selection, contact fields, priorities, and notes have been persisted before exporting or leaving the page.
- Impact: `desktop-app/renderer/views/exports.js` should update save status around autosave/manual save; `desktop-app/lib/contact_review_store.js` remains the run-level persistence store.
- Reevaluate when: Contact review state moves to a shared database or gets a stronger transactional save model.

## 2026-06-30: Treat contact-review Excel as a run-level round-trip format

- Decision: Allow exported/edited `建联表` workbooks to be imported back into the current run's contact review state by matching Pugongying URL.
- Why: Teammates may review contact choices, priorities, reasons, and contact info in Excel. Operators need a way to merge those edits back before exporting the final contact workbook.
- Impact: `desktop-app/lib/contact_review_excel.js` owns Excel-to-review parsing; import updates only run-level review state under `userData/contact_reviews/` and does not mutate raw collection output. The UI should report unmatched row examples so operators can detect wrong run/table mismatches.
- Reevaluate when: Contact review moves to Lark Base/Sheets or a shared database workflow.

## 2026-06-30: Keep XiaoMiFeng export action-ready

- Decision: Only put selected creators with a WeChat ID or phone number into `小蜜蜂导入表`; put selected creators missing contact info into a separate `待补联系方式` sheet.
- Why: XiaoMiFeng or a later WeChat AI executor should receive rows it can actually process. Mixing missing-contact rows into the executor sheet creates noisy failures and unclear operator responsibility.
- Impact: `desktop-app/lib/contact_sheet.js` exports three sheets: `建联表`, `小蜜蜂导入表`, and `待补联系方式`. Review/import flows should continue to use `建联表` as the human-editable source and regenerate executor-ready rows from saved review state.
- Reevaluate when: The downstream executor supports searching/filling contacts by itself, or the team adopts a different required import template.

## 2026-07-02: Treat contact channels as export routes, not automatic sending

- Decision: Model `蒲公英邀约`, `微信建联`, and `邮件建联` as explicit contact execution channels in the review/export workflow. The app may route selected creators into separate workbook sheets and store per-creator channel/contact fields, but it should not auto-send emails, auto-click Pugongying invite forms, or operate WeChat directly in the main product path.
- Why: The external signing Copilot screenshots show useful channel separation and status tracking, while the user's workflow still prioritizes easy operation, conservative Pugongying handling, and optional downstream RPA. Export-first routing gives immediate business value without binding the app to fragile RPA execution.
- Impact: `desktop-app/lib/contact_sheet.js`, `desktop-app/lib/contact_review_store.js`, `desktop-app/lib/contact_review_excel.js`, and `desktop-app/renderer/views/exports.js` should preserve contact channel, email, WeChat/phone, and round-trip import behavior. `小蜜蜂导入表` remains only one downstream route; `蒲公英邀约表`, `邮件建联表`, and `待补联系方式` should stay reviewable and human-controlled.
- Reevaluate when: The team approves an email sending policy/API, a stable Pugongying invite automation contract exists, or XiaoMiFeng/WeChat AI provides a tested import/result format.

## 2026-07-20: Make email export additive when an address is available

- Decision: Include every selected creator with a non-empty email in `邮件建联表`, regardless of the creator's primary contact channel. Keep the primary-channel row, such as `蒲公英邀约表`, at the same time.
- Why: An available email is an additional executable contact option, not a reason to remove the creator from the already approved Pugongying route. Exclusive routing hid collected contact data from the email handoff sheet.
- Impact: Email and Pugongying workbook counts may overlap. `邮件建联表` remains a reviewable candidate list and does not authorize or trigger sending; all actual sending still requires current human confirmation.
- Reevaluate when: The product introduces explicit per-creator multi-channel enable/disable controls or a team-wide deduplication policy for parallel outreach.

## 2026-07-07: Define MVP acceptance before calling the app delivered

- Decision: Add an explicit MVP acceptance plan and readiness checker. Static/local readiness, safety posture, real-account validation, and operator workbook trial must be treated as separate gates.
- Why: The app has substantial workflow code, but it is still a half-finished internal tool until real workflow validation proves it can be used by operators. A checklist prevents vague claims like "done" when only local tests pass.
- Impact: Use `docs/project_memory/MVP_ACCEPTANCE_PLAN.md` and `scripts/check_mvp_readiness.py` before describing the product as usable or delivered. The script may report static checks as passing while still blocking on missing sanitized live validation.
- Reevaluate when: A formal QA process, CI pipeline, or shared product acceptance tracker replaces this repository-local readiness gate.

## 2026-06-30: Make missing-contact completion round-trippable

- Decision: Treat `待补联系方式` as an editable completion sheet, not only a warning sheet. Include blank WeChat/phone columns and import it alongside `建联表`, merging rows by normalized Pugongying URL.
- Why: The practical workflow may be "export review workbook -> teammate fills missing contacts -> import back -> regenerate XiaoMiFeng-ready rows". Requiring manual copyback would break that loop.
- Impact: `desktop-app/lib/contact_review_excel.js` should preserve multi-sheet import behavior. Future workbook changes must keep `蒲公英链接` stable enough for matching.
- Reevaluate when: Contact completion moves to a shared database, or the downstream executor can enrich missing contact fields automatically.

## 2026-06-30: Track follow-up state in the contact review pool

- Decision: Add `跟进状态` to run-level contact review state, the review UI, exported `建联表`, and imported review workbooks; allow review-page filtering and batch updates by status.
- Why: A useful contact table is not only a one-time export; operators need to track and manage whether a creator is pending contact, contacted, accepted, rejected, needs follow-up, or should not be contacted.
- Impact: `desktop-app/lib/contact_review_store.js`, `desktop-app/lib/contact_sheet.js`, `desktop-app/lib/contact_review_excel.js`, and `desktop-app/renderer/views/exports.js` should preserve this field. `小蜜蜂导入表` remains executor-focused and does not become the source of follow-up truth.
- Reevaluate when: Follow-up tracking moves to Lark Base/Sheets or another shared CRM-like system.

## 2026-06-30: Put contact-workbook overview first

- Decision: Add `建联概览` as the first sheet in contact workbook exports.
- Why: Operators and teammates should see the run-level shape immediately: total creators, selected/excluded, XiaoMiFeng-ready rows, pending-contact rows, and follow-up-status distribution.
- Impact: `desktop-app/lib/contact_sheet.js` now exports four sheets: `建联概览`, `建联表`, `小蜜蜂导入表`, and `待补联系方式`. Import continues to target the editable detail sheets, not the overview sheet.
- Reevaluate when: The workbook is replaced by Lark Base/Sheets dashboards or a different downstream reporting format.

## 2026-06-30: Support both imported-list and Pugongying-search sources

- Decision: Add a task source mode for `已有达人表/链接`, `蒲公英搜索发现`, and `导入 + 搜索`.
- Why: The product needs two real entry paths: collecting known creators from an uploaded table, and discovering creators by logging into Pugongying and using its search/filter conditions before adding candidates.
- Impact: `desktop-app/lib/signing_task.js`, `desktop-app/renderer/views/tasks.js`, and `desktop-app/lib/candidate_sheet.js` should preserve source mode. Pugongying search remains manual-login and operator-controlled; do not bypass platform search/risk controls.
- Reevaluate when: Pugongying provides a stable approved search API or an exportable search-result table.

## 2026-07-02: Treat Pugongying search filters as a search recipe, not per-creator clicking

- Decision: In the `找达人` flow, prefer reading the current visible Pugongying search result page into the candidate pool after the operator manually chooses filters on the right. Capture a lightweight snapshot of the visible filter structure/options with the intake. Keep `加入当前达人` as a single-detail-page fallback.
- Why: The real Pugongying `找博主` page has many filter groups such as cooperation goal, match profile, data performance, platform recommendations, and exclusions. Requiring operators to click into every creator first is slow and does not preserve how the search was produced. Capturing the search page makes the workflow closer to "define search recipe -> review visible results -> collect selected creators."
- Impact: `desktop-app/main.js` exposes `pgy:extractSearchCandidates`; `desktop-app/preload.js` exposes it to the renderer; `desktop-app/renderer/views/tasks.js` adds `读取当前结果` as the main search-page intake action. This does not auto-click filters or paginate; those should remain separate, explicit future steps.
- Reevaluate when: We add a stable filter-recipe model that maps natural-language briefs to Pugongying filter choices, or if live Pugongying DOM changes make visible-result intake unreliable.

## 2026-07-01: Redesign the workbench from information architecture downward

- Decision: Treat the left-side Electron UI redesign as a whole-workbench product redesign, not isolated page cosmetics. Use `docs/project_memory/UX_REDESIGN_PLAN.md` as the blueprint before UI changes.
- Why: The current UI grew from iterative feature additions and exposes too many advanced controls at once. The user needs a readable, high-aesthetic, easy-to-operate workflow around finding creators, reviewing them, and exporting contact tables.
- Impact: UI work should follow progressive disclosure, importance/frequency ordering, conditional bulk actions, and list/detail patterns. `采集规则`, `selector`, `transform`, `录制回放`, AI config, and other low-frequency tools should default to hidden or toolbox/advanced views. Main flows should be `开始`, `找达人`, and `复核建联`.
- Reevaluate when: The app migrates to React/Vue, a shared database replaces local workflow state, or user testing shows a different primary workflow.

## 2026-07-01: Build a lightweight native component layer before React/Vue migration

- Decision: Keep the near-term UI in native JS but extract reusable workbench components in `desktop-app/renderer/ui/components.js`.
- Why: The current app does not have a React/Vue build pipeline, and the business flow is still being refined. A lightweight component layer lets the team improve UX and stabilize component boundaries without introducing two competing render/state systems.
- Impact: New UI should prefer reusable primitives such as page intros, notices, action rows, advanced sections, metric cards, entity lists, bulk action bars, and detail panels. These component concepts should be easy to map to React/Vue later.
- Reevaluate when: The workflow is stable enough to justify a full renderer migration to React/Vue and a component library such as Ant Design, MUI, Tabler-inspired components, or TanStack Table.

## 2026-07-01: Use annotation-style calibration for page picking

- Decision: Shape `采集校准` around a Codex-like browser annotation pattern, but implement it locally instead of depending on any Codex private annotation API. Operators choose a business field, enter webpage annotation mode, move the mouse over the embedded browser, and click the currently highlighted area to save it into the existing rule template. A full-page numbered candidate list remains as a backup, not the default interaction.
- Why: Operators should not need to understand selector, DOM, or transform concepts. "Mark the thing you want to collect" is easier to learn and better matches the product promise of teaching the system once, then running automatically.
- Impact: Keep the existing template JSON and extraction pipeline, but make mouse-follow browser annotation the primary entry. Avoid showing all candidate boxes at once in the default flow because dense Pugongying pages become unreadable. Low-level rule editing remains available only in the uncommon maintenance section.
- Reevaluate when: Real Pugongying pages make element-level candidate scoring unreliable, or when area selection/screenshot-based extraction becomes necessary.

## 2026-07-02: Treat Codex browser annotations as UX reference, not integration API

- Decision: After checking the official Codex in-app browser documentation, use Browser comments / Annotation mode only as a product reference. The desktop app should not depend on a Codex-private annotation surface. The local BrowserView annotation flow should provide the operator-facing pieces we need: field label, current-area highlight, hover preview, and click-to-save. Numbered page blocks are useful only as a backup list view.
- Why: Codex annotations are documented for giving Codex visual feedback on pages inside Codex, especially local previews. They are not documented as an SDK that another Electron app can embed. Local implementation keeps this tool self-contained and avoids coupling the product to Codex UI internals.
- Impact: `desktop-app/main.js` owns the injected BrowserView overlay; `desktop-app/renderer/views/templates.js` owns the operator flow. Keep technical selector data hidden in the uncommon rule-file area.
- Reevaluate when: OpenAI publishes an official embeddable browser-annotation API, or when the project migrates to React/Vue and this overlay becomes a reusable component.

## 2026-07-01: Anti-bot safety means conservative operation, not stealth evasion

- Decision: Treat anti-bot/risk-control safety as a compliance and reliability boundary. The product should use visible BrowserView operation, manual login/search, serial low-frequency collection, small batches, and manual pauses on risk pages. Do not add stealth webdriver patches, browser-fingerprint spoofing, proxy rotation, random user-agent evasion, headless batch crawling, captcha bypass, or high concurrency to the product path.
- Why: The user wants the tool to be usable without causing avoidable platform-risk issues. Evasion techniques increase legal/operational risk and conflict with the existing boundary against bypassing login, captcha, risk control, or rate limits.
- Impact: `desktop-app/lib/task_runner.js` now enforces conservative waits and a 50-creator normal batch ceiling; `pgy:checkLogin` reports risk-control text so the queue can pause; old `content-analyzer/` stealth behavior is disabled unless an explicit research environment variable is set. Future speed or automation work must first pass `docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md`.
- Reevaluate when: Pugongying provides an official API/export path, legal/product policy changes, or real-account validation shows the current conservative limits are still too aggressive.

## 2026-07-02: Enforce cooldown between PGY collection batches

- Decision: Add a hard 5-minute cooldown after a completed task queue before another valid PGY batch can start. Expand visible risk-text detection to include human verification, drag-slider, access-abnormal, login-expired, busy/retry, English security-check, and rate-limit phrases.
- Why: Serial per-creator waits reduce intra-batch speed, but immediate batch-after-batch starts still look machine-like and can increase platform risk. Broader risk text should bias toward pausing for manual review rather than continuing through a risk-control page.
- Impact: `desktop-app/lib/task_runner.js` exports `SAFE_RUN_COOLDOWN_MS` and returns `PGY_RUN_COOLDOWN` for immediate restarts. `desktop-app/main.js`, `desktop-app/renderer/views/tasks.js`, `desktop-app/tests/task_runner_safety.test.js`, and `scripts/audit_pgy_safety.py` now treat cooldown and broader risk hints as safety invariants.
- Reevaluate when: Sanitized live validation proves 5 minutes is still too aggressive or too restrictive for real operator workflow, or if an official Pugongying export/API path replaces browser-based collection.

## 2026-07-02: Keep PGY visible-risk detection testable

- Decision: Move PGY visible-risk phrases and matching helpers into `desktop-app/lib/pgy_risk.js`, and require `desktop-app/tests/pgy_risk.test.js` in the normal `npm test` chain. `main.js` should consume the shared snippet builder instead of owning untested duplicated risk arrays.
- Why: Risk-control wording is volatile. A testable module makes it safer to add new visible prompts and prevents future refactors from silently weakening the pause-on-risk behavior.
- Impact: Risk phrase changes should happen in `desktop-app/lib/pgy_risk.js`; update `desktop-app/tests/pgy_risk.test.js` and `scripts/audit_pgy_safety.py` with any new safety-critical patterns.
- Reevaluate when: BrowserView risk detection becomes a separate preload script, or live validation shows visible text matching is too weak and needs screenshot/OCR or structured page-state checks.

## 2026-07-02: Restrict automated task URLs to Pugongying

- Decision: Batch collection tasks may only run URLs under `pgy.xiaohongshu.com`. Non-PGY URLs are rejected with `PGY_TASK_URL_NOT_ALLOWED`. Direct current-page extraction also requires the BrowserView to be on `pgy.xiaohongshu.com`; otherwise it returns `PGY_CURRENT_URL_NOT_ALLOWED`. Recording capture and replay are both PGY-scoped: starting recording outside PGY is rejected, non-PGY navigation/click/input actions are not stored, and replay navigation/click/input automation stops outside PGY with `PGY_REPLAY_URL_NOT_ALLOWED`. Page-calibration annotation entrypoints (`pgy:pickElement`, `pgy:scanPageBlocks`, and `pgy:suggestNoteCardSelector`) also require the current BrowserView page to be PGY before injecting overlays or selector-suggestion scripts.
- Why: The product is a Pugongying workbench, not a generic browser automation tool. A strict task URL boundary lowers accidental automation risk when operators paste/import the wrong link and keeps anti-risk reasoning scoped to the platform being validated.
- Impact: `desktop-app/lib/task_runner.js` exports `ALLOWED_TASK_HOSTS`, `normalizeTaskUrl`, and `isAllowedTaskUrl`; `desktop-app/main.js` uses the same guard before direct extraction, recording capture, replay actions, and page-calibration annotation scripts; `desktop-app/tests/task_runner_safety.test.js` and `scripts/audit_pgy_safety.py` protect this boundary. XHS links can still exist as reference/export fields, but automated extraction/replay/recording/calibration should use PGY pages.
- Reevaluate when: The product explicitly adds a separate Xiaohongshu-native collection flow with its own safety audit and live validation protocol.

## 2026-07-01: Legacy crawler switches must not bypass the safety gate

- Decision: Legacy `content-analyzer/` proxy, random User-Agent, headless, and nonstandard Selenium browser flags must all require `ALLOW_STEALTH_EVASION=true`, even when called through constructor parameters such as `use_proxy=True` or `headless=True`.
- Why: Although the Electron app is the product mainline, old crawler utilities remain in the repository and could be accidentally reused. Parameter-level bypasses make the safety posture look stronger than it really is.
- Impact: `BaseCrawler`, `BrowserEngine`, `EnhancedBrowserEngine`, and `helpers.py` are now covered by `scripts/audit_pgy_safety.py` so proxy/headless/random-UA/nonstandard-browser-flag behavior cannot quietly become default behavior again.
- Reevaluate when: The legacy compatibility layer is deleted, or an approved API/export path replaces browser-based collection.

## 2026-07-01: Legacy FastAPI crawl routes are disabled by default

- Decision: Disable `/api/crawl/start` and `/api/prelogin/*` unless `ENABLE_LEGACY_CRAWL_API=true` is explicitly set. When enabled, cap the old route with `LEGACY_CRAWL_MAX_URLS` and `LEGACY_CRAWL_MAX_CONTENTS`.
- Why: The Electron BrowserView task runner is the safer product path. The old FastAPI crawler/prelogin routes run a separate Selenium-style flow and could bypass the newer batch, timing, and risk-page guardrails if left open by default.
- Impact: The desktop app can still use `/api/config` for backend status, but old crawl/prelogin API calls fail closed in normal operation. Compatibility testing must be an intentional environment choice and should not be represented as the normal product mode. The backend root page also shows a disabled legacy-collection notice while this mode is off.
- Reevaluate when: The old backend is removed, or a formally approved API/export path replaces browser-based collection.

## 2026-07-02: Backend defaults to local-only exposure

- Decision: Default `content-analyzer` to `API_HOST=127.0.0.1` instead of `0.0.0.0`.
- Why: The backend is launched as a local companion for the Electron app. Exposing it to the LAN by default increases the chance that old compatibility routes or local data surfaces are accessed outside the intended operator-controlled workflow.
- Impact: Standalone backend runs are local by default; operators can still override `API_HOST` intentionally for a controlled test environment.
- Reevaluate when: The backend becomes a hardened multi-user intranet service with authentication, deployment policy, and official data-access boundaries.

## 2026-07-02: Direct-call paths must obey the conservative PGY safety posture

- Decision: Treat hidden/direct invocation paths as part of the product safety boundary. Legacy task payloads using `presetKey: "fast"` now normalize to `standard`, and direct `pgy:extractCurrentMultiPage` calls keep a conservative tab-wait floor and disabled note-card click completion unless a local research switch explicitly enables it.
- Why: Hiding fast or advanced behavior in the UI is not enough. Renderer IPC, saved tasks, or future helper code could otherwise bypass the conservative queue settings and create a faster or clickier workflow than operators see.
- Impact: `desktop-app/lib/task_runner.js`, `desktop-app/main.js`, `desktop-app/tests/task_runner_safety.test.js`, and `scripts/audit_pgy_safety.py` must preserve these direct-call invariants. The normal team workflow should not use `PGY_ALLOW_NOTE_CLICK_RESOLVE=true`.
- Reevaluate when: A validated official export/API path exists, or live Pugongying validation shows a different safe calibration approach is needed.

## 2026-07-02: Legacy documentation must not advertise evasion patterns

- Decision: Replace old `content-analyzer/` crawler README and security notes with compatibility/deprecation documentation that points to the current Electron BrowserView safety boundary.
- Why: Code defaults are not enough if documentation still tells future maintainers to use fingerprint spoofing, proxy rotation, headless mode, speed tuning, cookie/session reuse, or account-risk workarounds. Those notes can quietly pull the product back toward a crawler/evasion posture.
- Impact: `content-analyzer/README.md`, `content-analyzer/docs/SECURITY_IMPROVEMENTS.md`, and `scripts/audit_pgy_safety.py` now treat docs as part of the anti-bot safety surface. Future docs may describe legacy internals, but must not recommend those patterns for normal team operation.
- Reevaluate when: The legacy backend is removed, or the team intentionally creates a separate research-only branch with different documented boundaries.

## 2026-07-02: Live validation records must include local safety prechecks

- Decision: Upgrade Pugongying live-validation records to schema v2 and add `scripts/prepare_pgy_live_validation.py` as the preferred entry. A passing record must include current branch/worktree note, Electron/backend PIDs, successful static safety audit, and successful running-backend safety probe before real-account batch evidence.
- Why: Real-account testing is the only evidence that can support "safe enough for normal internal use", but it must be tied to the actual build and process that was tested. Otherwise a later thread could confuse static code safety with live platform validation.
- Impact: `scripts/validate_pgy_live_validation.py` now requires precheck fields; `docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md`, `AGENTS.md`, and handoff docs point operators to the preparer script. Completed validation JSON should still stay out of git if it contains local run references or private notes.
- Reevaluate when: The app gets an in-app safety validation wizard or the team adopts a shared, privacy-safe QA system.

## 2026-07-15: Phase 1 stops at approved execution-file generation

- Decision: Implement backend status recovery, strict XiaoMiFeng export, Feishu record/event contracts, and fingerprinted human approval first. Reserve `append_send_event` and `append_reply_event`, but do not implement result ingestion or reply tracking yet.
- Why: The operator wants the preparation and control plane validated before deciding whether to build downstream result handling.
- Impact: Feishu remains the intended task/status system of record; local approval records include a pending Feishu sync envelope. No external send may happen without explicit approval, and a changed recipient/message/executor payload invalidates that approval.
- Reevaluate when: The phase-1 build passes visual acceptance, a sanitized XiaoMiFeng import test, and the actual Feishu Base/table field mapping is available.

## 2026-07-20: Enrich public Xiaohongshu contacts as a separate review step

- Decision: Reuse the reviewed PGY creator rows and add a visible, serial Xiaohongshu profile pass for public email, WeChat ID, and phone extraction. Login stays manual; login/risk prompts pause the job and are never bypassed.
- Why: The first 50-person PGY workbook contained no actionable email or WeChat values, while some creators publish business contact details on their Xiaohongshu profiles.
- Impact: Enrichment fills only empty fields, does not auto-switch outreach channels, and invalidates stale execution approval when recipients change. Persist only parsed contacts, a query-free profile URL, source, timestamp, and status; do not persist full bios.
- Reevaluate when: A 3-5 creator live trial shows unstable profile resolution, unacceptable platform risk, or the page structure/policy changes.

## 2026-07-21: Keep the six-step flow inside the existing safety envelope

- Decision: The operator manually filters PGY, then uses a natural-language first-N instruction to populate candidates. Candidate intake may read additional result pages and a completed PGY run may continue into visible public-XHS-contact enrichment, but all such operations retain the PGY-only boundary, 50-person hard ceiling, serial jittered waits, batch cooldown, and immediate stop on login/captcha/risk/frequent-operation prompts. Actual outreach always requires current human approval.
- Why: The operator wants less manual candidate handling and explicitly requires the existing risk-control features to remain. Product simplification must not weaken platform or communication safeguards.
- Impact: Natural language does not click PGY filters. Response parsing keeps only normalized public creator fields in memory and never persists raw response bodies or authentication material. Send/result/reply integrations remain outside this iteration.
- Reevaluate when: An official PGY export/API is available and passes a new safety review. Do not lower the 50-person ceiling, risk-stop behavior, or human send approval as an ordinary UX optimization.

## 2026-07-22: Email handoff is manual opt-in and copy/paste only

- Decision: Contact-review checkboxes default to empty. Only creators explicitly checked by the operator may enter email preparation. The app may enrich missing public emails, show a copyable address list, and open the official Tencent enterprise-mail site; it must not click compose, fill recipients, or send.
- Why: The operator wants explicit creator-by-creator choice and a visible, reviewable handoff. Manual copy/paste avoids unintended recipient preparation and keeps mailbox actions under direct human control.
- Impact: Legacy auto-selected review rows migrate once to unselected state. The UI no longer reports the whole-list email count or exposes recipient-prefill IPC. Login, compose, paste, content/attachment review, and send remain human actions. Existing PGY/XHS batch limits and risk-stop behavior still apply to contact enrichment.
- Reevaluate when: The team adopts a reviewed official mail API or a different approved workflow. Default-empty selection and human send confirmation remain mandatory.

## 2026-07-22: XHS enrichment stops on multilingual risk signals and uses periodic cooldowns

- Decision: Treat the Xiaohongshu captcha URL and Chinese/English security or request-frequency text as immediate stop signals. Reject a new enrichment batch when the current XHS page is already risk-blocked, disable retry in the review UI, and pause for 35-60 seconds after every five completed profiles.
- Why: A live security-verification page used English request-frequency wording. The previous Chinese-only detector misclassified nine such pages as ordinary profile failures and continued requesting.
- Impact: Enrichment is slower but fails closed on known XHS risk pages. Risk detection stays in a shared, unit-tested module and is enforced by the safety audit. Operators wait for natural recovery, then check login and restart with a small batch; the app does not refresh, solve, or bypass verification.
- Reevaluate when: An official API replaces browser visits or sanitized live validation shows the cooldown should be more conservative. Immediate stop and no verification bypass remain mandatory.

## 2026-07-23: Separate candidate rank position from safe batch size

- Decision: Natural-language candidate intake supports both first-N and explicit A-B rank ranges through rank 100. The rank endpoint is only a list position; each intake segment and actual collection run remains capped at 50 creators. The latest successful instruction becomes an explicit `latest_segment` collection scope while the full candidate pool continues to accumulate.
- Why: Operators need to continue with later creators after finishing an earlier batch. Treating “through rank 70” as “collect 70 people at once” would block valid segmented work or tempt a safety-limit increase.
- Impact: Range pagination begins from the first result page, is bounded to 10 pages, checks PGY risk before every page turn, uses conservative waits, and does not restore the page after a risk signal. Saved tasks and candidate exports preserve the latest segment. Actual outreach approval rules are unchanged.
- Reevaluate when: The current PGY page size or pagination controls change, a live rank-range test cannot preserve ordering, or an official export/API becomes available. Do not raise the 50-person run ceiling or weaken risk-stop behavior as part of ordinary range support.

## 2026-07-23: Never embed real AI secrets in desktop packages

- Decision: DMG and application bundles may include a placeholder `.env.example`, but must exclude real `.env` files and common private variants. Desktop AI credentials remain operator-supplied settings stored in the Mac user-data directory.
- Why: DMG, app resources, and ASAR archives are extractable; embedding a shared API key would disclose it to every recipient and make rotation and access control unreliable.
- Impact: Same-Mac upgrades retain the existing local AI configuration. A new Mac or user profile must configure the provider, endpoint, model, and key in the app before AI analysis works. Packaging checks must confirm no private environment file is present.
- Reevaluate when: The product adopts a managed secret service, OS keychain integration, or a server-side AI gateway with per-user authentication. Do not put a real key into a distributable package.

## 2026-07-24: Mac and Windows require separate artifacts and acceptance

- Decision: The current Apple Silicon DMG is only a Mac artifact. Windows requires its own installer and backend executable, followed by Windows-native validation of login, collection, risk stops, workbook export, and local configuration.
- Why: Windows cannot run a DMG or an arm64 Mac application, and the current backend packaging script is macOS-specific. A configured Electron NSIS target is not evidence that a usable Windows release exists.
- Impact: Distribution notes must identify platform and architecture. Mac acceptance results must not be reused as Windows acceptance evidence, and an untested cross-compiled file must not be described as deliverable.
- Reevaluate when: A Windows build passes regression testing on the target company device and Windows version.

## 2026-07-27: Package The Windows Backend As PyInstaller Onedir

- Decision: build the compatibility FastAPI backend natively on Windows with PyInstaller `--onedir`, embed it in the Electron resources, and produce an x64 NSIS installer. Packaged Electron resolves `xhs-pgy-backend.exe` on Windows and must fail clearly if it is absent instead of falling back to a system Python installation.
- Why: Windows cannot run the macOS backend binary, and target users should not need Node, Python, or project dependencies. `--onedir` starts faster and has more predictable resource paths than a self-extracting `--onefile` backend.
- Impact: Windows builds require a local `content-analyzer/.venv` installed from `requirements_packaging_win.txt`. Backend build output is excluded from the copied source tree and added once as a dedicated resource. Windows release claims require native artifact and installation evidence.
- Reevaluate when: the compatibility backend is replaced by a Node service, a smaller dedicated desktop backend is introduced, or another packaging system provides equivalent local-only startup and resource guarantees.

## 2026-07-28: Treat Every 40 Ranks As A Manual Candidate Checkpoint

- Decision: Candidate paging that must cross rank 40 or 80 pauses for at least 90 seconds and requires an explicit user continue. Partial rows remain in memory and are not merged until the complete requested range is verified. Continue fails closed if the collection tab, URL, page number, page anchors, cache window, or risk state changed.
- Why: The former reader silently stopped after 40 rows when the next control or response was not confirmed, then returned `ok: true`; a rank 35-50 request therefore merged only ranks 35-40. A sleep alone would hide the failure without proving page continuity or safety.
- Impact: Rank-range intake is slower and may require a user click, but incomplete, duplicate, stale, or risk-blocked pages cannot be presented as a complete result. The existing rank-100 locator boundary and 50-person intake/run ceilings remain unchanged. Ninety seconds is a conservative engineering default, not an official platform value or a risk guarantee.
- Reevaluate when: Sanitized visible tests establish a more conservative pause, the PGY pagination structure changes, or an official export/API replaces page turning. Manual continue, risk recheck, and no partial auto-merge remain the default safety posture.

## 2026-07-28: Separate Visible Browser Tabs From The Collection Target

- Decision: Keep one protected `collection` BrowserView as the only target for PGY automation and recording. Open Tencent enterprise mail in a separate closable `mail` BrowserView with its own persistent Electron session and no recording preload. Active-tab navigation controls operate only on the visible tab, while automation always resolves the fixed collection view.
- Why: Reassigning the global collection target to the active tab would allow email or another page to receive extraction, replay, or recorded actions. The prior single-view email handoff also destroyed PGY history and made returning to collection awkward.
- Impact: Users can switch between collection and enterprise mail after automation finishes. Automation locks tab switching, toolbar navigation, and collection-page pointer input; task manual-intervention pauses restore pointer input without changing the fixed collection identity. Recording actions are accepted only from the collection webContents sender.
- Reevaluate when: XHS contact enrichment is moved to its own role tab or ordinary user-created tabs are added. Any expansion must preserve fixed-role targeting, session boundaries, sender validation, and automation leases.

## 2026-07-28: Packaged GUI Logging Must Not Depend On A Parent Console

- Decision: Install process stdout/stderr error guards at Electron main-process startup and spawn the packaged backend with ignored stdio. Development mode may still pipe backend logs to its terminal.
- Why: Launching `win-unpacked` from a short-lived parent process left Electron with a closed output pipe. Backend log forwarding then raised an uncaught `EPIPE` and opened a main-process error dialog even though the backend executable itself was valid.
- Impact: Distributed GUI startup no longer depends on a console remaining attached. Backend operational data must be written through its configured user-data log directory or surfaced through structured status events, not assumed to be available on stdout.
- Reevaluate when: A durable file logger or Windows event-log integration replaces the current logging path. A GUI package must still tolerate absent or closed standard streams.

## 2026-07-31: Confirm Candidate Page Changes From Response Evidence First

- Decision: identify a PGY candidate page primarily from in-memory list-response page metadata and the ordered creator URL fingerprint. Treat a narrowly matched numeric active-page DOM control as secondary evidence. When returning to page 1, use a visible page control first and the visible jump input as a fallback.
- Why: the PGY response had changed in the reported failure, but the active-page CSS/DOM marker was not recognized. Requiring that marker as the only proof created a false failure after a real page turn.
- Impact: an unknown DOM page number may proceed only when the response fingerprint changes and new unique creators appear. An explicit response-page conflict, duplicate fingerprint, missing response, or risk signal still fails without merging partial candidates.
- Reevaluate when: PGY removes stable page metadata from its list responses, response ordering becomes unstable, or a sanitized live fixture shows the response-page parser is ambiguous.

## 2026-07-31: Windows Builds Need Distinct Visible Versions

- Decision: increment the desktop version for the pagination/tab delivery and show it in the top bar. Installed acceptance must inspect the installed ASAR, shortcut target, visible version, and tab UI.
- Why: the July 27 and July 28 artifacts both used `0.1.0`, so an operator could not tell that their installed app predated the tab work.
- Impact: this correction ships as `0.1.1`; future Windows fixes must not overwrite the same version number while claiming a different installed behavior.
- Reevaluate when: an automatic updater or richer build-information panel provides a stronger release identity.

## 2026-08-03: Scope Candidate Response Evidence To One Instruction

- Decision: Open a candidate-response command window when an intake instruction starts, accept only candidate-shaped list responses inside that window, and reject page-number conflicts, duplicate fingerprints, or any overlap between adjacent pages.
- Why: A process-wide response cache can accidentally consume an old or unrelated response, while partial page overlap makes rank ordering ambiguous even if some creators are new.
- Impact: Initial visible-page rows seed the command window, checkpoint state retains only sanitized page evidence, and no partial range is merged until the complete requested range is proven.
- Reevaluate when: PGY changes the list-response contract or an official export/API replaces visible pagination. Instruction scoping and fail-closed completion evidence remain required.

## 2026-08-03: Recover Unfinished Runs Instead Of Starting Over Silently

- Decision: Persist schema-v2 task state with an active run identity, expose honest pending-pause/skip states, and require explicit recovery when an unfinished run exists. A new run is rejected until the old run is recovered or deliberately resolved.
- Why: Process crashes or renderer failures must not make an active queue look finished, clear the cooldown owner, or allow an accidental overlapping run.
- Impact: Task-runner persistence failures are visible, run-loop failures preserve recovery state, and renderer controls describe when pause/skip can actually take effect.
- Reevaluate when: A transactional queue service replaces local JSON state. Explicit unfinished-run ownership and no overlapping automation remain mandatory.

## 2026-08-03: Ship Both Installer And Self-Contained Portable Windows Builds

- Decision: Release Windows x64 as both NSIS installer and portable executable, with the same bundled Electron and PyInstaller onedir backend. Enforce one Electron instance and verify backend ownership with a per-launch token plus protocol version.
- Why: Colleagues may not have Python, Node, or project dependencies, and a stale process listening on port 8010 is not evidence that the current desktop launch owns a compatible backend.
- Impact: Windows recipients can run either artifact without installing language runtimes. Release acceptance checks both artifact hashes, visible version, backend identity, second-launch behavior, and backend cleanup.
- Reevaluate when: The backend moves in-process, a signed managed installer is adopted, or automatic updates replace manual distribution. Do not fall back to a target machine's system Python.

## 2026-08-04: Seed Candidate Reads From The Same Navigation Context

- Decision: Capture candidate-shaped PGY responses continuously as sanitized creator rows, tag them with the protected collection BrowserView ID and main-navigation epoch, and seed a new instruction only from a matching context. Keep later page responses inside the explicit command window.
- Why: Real operators wait for the result list to load before clicking the instruction. Requiring the first response to arrive after the click discarded the valid page-one response and produced a stable rank-0 failure, while restoring a process-wide cache would reintroduce stale-response risk.
- Impact: Page-loaded-before-command is now a tested sequence. No response body, header, cookie, token, or query string is retained; cross-navigation snapshots cannot seed a command, and page conflicts, duplicate pages, overlap, incomplete ranges, and risk signals still fail without merging.
- Reevaluate when: PGY changes its response structure, Electron replaces BrowserView, or an official export/API is available. Same-context proof and sanitized-only storage remain required.

## 2026-08-05: Bind Global Rank Pages To Visible Creator Identity

- Decision: Treat first-N and A-B candidate instructions as global ordered ranks across the paginated result set. If a sanitized same-navigation response lacks trustworthy page metadata, accept it only when the visible paginator matches the expected page and multiple visible creator names match the response in order. If no usable response exists, current-page Vue or React component rows may provide the same read-only page evidence.
- Why: The live first page contained about 20 creators, so first 50 necessarily spans pages 1-3. The reader failed before turning the page because a rendered list was not equivalent to a page-tagged network snapshot; simply clicking next would have made rank continuity unprovable.
- Impact: The bounded pagination loop continues until the requested global endpoint is present, rather than assuming one page contains 50. Every page still needs visible page identity, a new ordered fingerprint, no adjacent-page overlap, and no risk signal. Partial rows remain temporary and are never merged as success.
- Reevaluate when: PGY changes its virtual-list/component implementation, creator names are no longer visible or sufficiently distinctive, page size becomes unstable within one search, or an official export/API replaces page reading. Never replace page identity with blind next-page clicks.

## 2026-08-06: Calibrate Fields And Containers As Different Structures

- Decision: store three distinct search-result selectors: a repeated creator-row container, a repeated nickname field, and the semantic pagination root. The picker returns an exact click path, a same-field selector, and a repeated-container selector; nickname calibration uses the field selector, row calibration uses the container selector, and identical row/name selectors are invalid. Ranked paging requires a read-only live `page 1 -> page 2 -> page 1` validation.
- Why: row and nickname counts could both equal 20 when both selectors targeted the whole row, producing a false pass while names included location and tags. The pagination picker could also stop at the small `d-pagination-goto` wrapper instead of the root containing multiple numeric pages.
- Impact: calibration now proves nickname order separately from row count and page identity. A stale broad template fails closed before cross-page reading, while the validated template can locate all 20 nicknames and the full paginator without hardcoding one clicked row.
- Reevaluate when: PGY changes the creator-row or pagination DOM, the list becomes virtualized with fewer mounted nickname nodes, or an official ordered export/API replaces DOM calibration. Do not relax selector separation merely to recover a matching count.

## 2026-08-06: Model Long-Running Controls As Requested And Effective States

- Decision: represent pause and stop as two-stage transitions for creator collection and contact enrichment. The renderer shows the request immediately, but the backend declares `paused` or `stopped` only after reaching an interruption-safe point.
- Why: an IPC acknowledgement proves that a click was received, not that navigation, extraction, or persistence has stopped. Presenting it as effective creates false operator confidence and can cause overlapping work.
- Impact: waits and cooldowns are interruptible, in-flight writes remain atomic, a stopped queue is explicitly resolved as skipped, and stopped runs do not silently advance to the next workflow.
- Reevaluate when: the jobs move to a transactional worker that can atomically suspend and resume individual operations. Honest transitional states remain mandatory.

## 2026-08-06: Return To Results By Restoring Browser History

- Decision: the explicit return action activates the protected collection tab and searches its navigation history for the PGY creator-result route. A fresh result URL is only a warned fallback.
- Why: activating a role tab does not restore filters when that same BrowserView was navigated to a detail page. Blindly opening a default URL can silently discard page, filter, history, and scroll context.
- Impact: task, contact, and calibration views share one recoverable return command and reject it while automation owns the browser. Operators are told to recheck filters when exact history restoration is impossible.
- Reevaluate when: creator detail navigation is fully isolated from the collection BrowserView in every path, or PGY provides a stable serializable search-state contract.

## 2026-08-06: Preserve Contact-Enrichment Diagnostics Per Creator

- Decision: store a normalized enrichment outcome code and readable error alongside each creator, and prefer a previously saved XHS profile URL before resolving it through PGY again.
- Why: a single `补采失败` label hides whether the cause is page readiness, missing PGY-to-XHS link, login, risk control, timeout, or a genuinely non-public contact. Without this evidence, repeated retries are blind.
- Impact: the review UI exposes actionable failure categories, retries avoid unnecessary PGY navigation where possible, and not-public remains distinct from technical failure.
- Reevaluate when: an official profile-link/contact API replaces visible-page reading. Outcome provenance and operator-readable diagnostics remain required.

## 2026-08-10: Bind XHS Profiles To PGY Creator Identity

Status: superseded on 2026-08-12 because field evidence disproved the shared-route-ID assumption. Keep this entry as history; use the provenance decision below.

- Decision: resolve an XHS profile only after the PGY creator-detail identity region is stable, derive the canonical profile route from that creator-detail identity, and accept a saved profile URL only when the two route identities match. Page-wide links and visible-ID click navigation are not identity evidence.
- Why: a live batch reused the first creator's saved profile URL for later rows because the resolver trusted prior state and scanned unrelated page links. The visible XHS-ID anchor also had no stable `href`, so click navigation was not a reliable mapping contract.
- Impact: a cross-creator URL is rejected before reading or persistence; current live rows resolve deterministically without destroying the protected collection tab. Profile readiness ignores unrelated nested feed loaders only after stable profile identity is visible. Contact review prefers the selected candidate name over broad account/company headings.
- Reevaluate when: PGY stops using the creator-detail route identity as the XHS profile route identity, or an official creator mapping API becomes available. Any replacement still needs per-row association proof and a real positive/negative installed-app test.

## 2026-08-12: Bind Cross-Platform Profiles By Provenance, Not Route-ID Equality

- Decision: treat PGY `blogger-detail` IDs and XHS `user/profile` IDs as different namespaces. Accept a profile only from the scoped XHS entry on the verified current PGY creator page, then persist the normalized PGY source URL beside the profile URL. Reuse requires the same source URL; legacy rows without provenance may use the old exact-ID condition only as a conservative compatibility path.
- Why: field rows opened the correct XHS profile while the two route IDs differed, so equality rejected valid profiles. Removing all checks would be worse because a stale or page-wide link could silently attach one creator's contact to another.
- Impact: derived XHS URLs and page-wide-link resolution are removed from the active resolver; successful and profile-unavailable outcomes preserve source provenance through renderer state and review storage.
- Reevaluate when: PGY exposes an official stable mapping identifier or API. Any replacement must still prove per-row association and pass installed positive, negative, and cross-row leakage tests.

## 2026-08-12: Require Full Visible-Page Identity Before Ranked Pagination

- Decision: calibrated candidate snapshots must match the complete visible nickname sequence. A creator row may obtain one unique detail URL from a bounded parent card; duplicate, missing, or ambiguous URL mappings reject the DOM page. Revalidate visible page number and complete order immediately before each next-page click.
- Why: matching only the first five names can accept a stale response whose later ranks differ, while requiring links inside the nickname region rejects valid rendered cards. Either defect breaks global ranks even when page 1 is visibly present.
- Impact: stale first-five collisions and changed-page clicks fail closed; checkpoint resume retains only sanitized nickname-plus-URL anchors needed for the same verification.
- Reevaluate when: PGY virtualizes a partial page or provides an official ordered export. Full global-rank evidence remains mandatory.

## 2026-08-12: Preserve A Completed Visible Page Across Candidate Commands

- Decision: after a candidate command completes normally, promote its current-page response to a passive same-navigation snapshot only when the visible page number and complete calibrated nickname order still match the exact response fingerprint and sequence. Do not promote failed, canceled, risk-stopped, or paused commands.
- Why: command-window isolation correctly prevented cross-command leakage, but made a second command fail on an unchanged visible page because PGY emitted no new list response. Blindly reusing any old command response would reintroduce stale-page risk.
- Impact: repeated reads can seed from the last visibly verified page without refreshing PGY, while navigation, page, order, and source-context changes still fail closed. UI failures include a stable code for field diagnosis.
- Reevaluate when: PGY provides stable row URLs directly in the visible DOM or an official ordered export endpoint eliminates response-cache dependence.

Update on 2026-08-12: exact navigation-context equality was too strict after a verified page-turn/restore cycle. A new command may inspect recent sanitized snapshots owned by the same BrowserView across navigation epochs, but may adopt one only after current visible page number and the complete calibrated nickname order reauthorize the exact fingerprint. Same-window ownership is a candidate filter, not sufficient identity proof.

## 2026-08-12: Login Checks Must Inspect An XHS Page

- Decision: when the dedicated contact tab is blank or on another host, `检测登录` first opens the XHS explore page in that same isolated session and only then evaluates login, risk, and visible-page evidence.
- Why: `about:blank` proves nothing about authentication. Reporting it as logged out contradicted the still-valid session and sent the operator toward unnecessary re-login attempts.
- Impact: the check becomes a useful one-click diagnostic while XHS login modals and risk pages still stop enrichment. The contact tab remains isolated from the protected PGY result tab.
- Reevaluate when: XHS provides a stable session API or the dedicated tab is replaced. Never infer account state from a non-XHS page.
## 2026-08-12: Separate Manual Search From Automatic Collection

- Decision: Keep `采集页` as the operator's stable PGY search and verification workspace. Lazily create a protected `自动采集` BrowserView when a main task starts or recovers, and bind task navigation, login checks, and extraction exclusively to that view.
- Why: A return button cannot preserve a search result's exact filter, page, and scroll state after the same BrowserView has navigated through creator details. This was a responsibility conflict, not a history-navigation bug.
- Impact: Both views share the authenticated `persist:pgy_default` session but keep independent page history and scroll. Registered BrowserViews stay attached at full bounds and tab activation changes z-order rather than detaching inactive views, so background capture and DOM work continue. Operators may switch back to the search page during a task; the automatic page remains input-locked while running and becomes available for manual intervention when paused.
- Reevaluate when: Electron BrowserView is replaced, the platform provides a stable official API/export, or concurrent same-session pages cause verified platform behavior problems. The manual search workspace must never again be used as the main task runner's navigation target.

## 2026-08-13: Give The Candidate Queue Its Own Scroll Viewport

- Decision: cap the visible candidate queue height and make that queue the scroll owner. Expose a wide native scrollbar, top/bottom icon controls, keyboard focus, and same-filter scroll-position restoration.
- Why: an unbounded 100-plus-card queue forced operators to wheel through the entire task page and made the browser-style drag handle hard to find. Faster wheel scrolling does not solve direct positioning.
- Impact: operators can drag directly to any depth without moving the surrounding workflow; candidate edits and status rerenders retain the current queue position. Search/status filter changes intentionally reset the queue to the top because they create a different result set.
- Reevaluate when: candidate counts grow enough to require virtualization. Any virtualized replacement must preserve direct drag positioning, stable rank identity, keyboard access, and rerender restoration.

## 2026-08-18: Reveal Lazy Pagination Before Declaring Calibration Failure

- Decision: when pagination inspection is incomplete, first perform a bounded read-only reveal of the document and large internal scroll containers, wait for PGY to mount the paginator, then rediscover it without trusting the saved selector. Save step 3 only with a proven current page and at least two numeric page controls. Cross-page validation prefers the explicit page-2 control and uses the next arrow only as a fallback.
- Why: the field page contained a valid paginator, but PGY did not always mount it until the result container reached the bottom or a page control was used. The old one-shot DOM query misclassified timing as a broken page structure.
- Impact: first-use calibration no longer requires a hidden manual page click, while stale selectors, single-page results, unknown current pages, and incomplete paginator structures still fail closed.
- Reevaluate when: PGY stops lazy-mounting the paginator, exposes a stable result API, or changes the list to a virtualization model where scrolling to the bottom unloads required nickname evidence. Do not replace this with blind page clicks.

## 2026-08-19: Prepare Invitations With Readback And A Single-Use Send Gate

- Decision: resolve the creator from persisted run data, prepare only the structured PGY fields in the isolated invitation partition, read every selection back, and issue a short-lived single-use token before exposing `确认发送`. Revalidate the row, URL, token, fingerprint, form state, and final button immediately before one click.
- Why: opening the correct creator and dialog does not prove that the template was accepted or that the account may send. A renderer-only confirmation could also be replayed against a changed row or form.
- Impact: final invitation sending remains impossible until preparation has proven the exact recipient and structured fields and the operator confirms at action time. A failed preparation cannot be promoted to send-ready state.
- Reevaluate when: PGY provides an official invitation API or materially changes the invitation schema. Recipient and action-time confirmation remain mandatory.

## 2026-08-19: Treat PGY Invitation Copy As Structured Fields, Not Free Text

- Decision: map the fixed in-app template only to live PGY controls that exist: cooperation goal, cooperation mode, contact method, and future explicitly detected labeled fields. Keep the free-text invitation message export-only while the live first dialog has no matching input.
- Why: claiming that a saved paragraph was copied into a form with no text field would be false. Live dialogs also vary by creator and account; live invitations may require an e-commerce shop.
- Impact: unsupported fields are reported instead of silently discarded. `permission denied`, unavailable cooperation types, missing shop requirements, and DOM-selection failures are separate outcomes.
- Reevaluate when: a live PGY dialog exposes a stable labeled message field, shop selection is added to the fixed template, or an official schema becomes available.

## 2026-08-25: Keep Cross-Page Identity Stable And Bind Fallback Names To Semantic Rows

- Decision: always label the workflow action `验证跨页`; when current-page evidence is missing, disable it and show the exact prerequisite beside it. If a saved row selector no longer repeats, rebuild visible order from the calibrated nickname selector only when every visible nickname maps one-to-one to a native table row, or every visible nickname maps to one unique allowlisted PGY creator-detail URL.
- Why: relabeling the locked action as `先验证本页` made a delivered capability appear removed. Separately, treating a stale CSS row selector as the only row proof caused false failures even when visible nicknames still belonged to distinct semantic table rows. Real PGY rows do not always expose detail links, so URL-only fallback is insufficient.
- Impact: operators can always see where cross-page verification lives and why it is locked. PGY wrapper-class changes no longer force immediate manual recalibration, while missing, ambiguous, or duplicate creator links still reject the page and prevent ranked pagination.
- Reevaluate when: PGY removes visible creator-detail URLs, virtualizes only a partial nickname set, or provides an official ordered export. Do not weaken the complete visible-order requirement.

## 2026-09-01: Require Strong Page Markers And Bounded Nickname Identity

- Decision: determine the active PGY page only from exact ARIA or strong class tokens, never from a weak background token that may remain after navigation. Bind each response nickname to the complete visible order by exact equality or by a whitespace-bounded prefix of the calibrated creator information block.
- Why: PGY retained the prior page's light-background token after page two became active, while the saved nickname selector now included location and tags after the nickname. The first defect misreported page two as page one and prevented restoration; the second rejected all valid ID-bearing rows.
- Impact: page transitions and restoration use the actual selected control, current creator information blocks can authorize sanitized response rows, and unbounded prefix collisions still fail. Successful candidate capture also clears stale response failures; only known list routes may report schema mismatch.
- Reevaluate when: PGY changes its selected-page tokens, nickname ceases to lead the calibrated information block, virtualizes partial rows, or provides an official ordered export. Complete ordered identity and fail-closed collision handling remain required.

## 2026-09-04: Treat Splitters As Persistent Workspace Controls

- Decision: implement both vertical splitters with Pointer Events and pointer capture, give them a visible 14 px hit area, and persist only clamped console/sidebar widths in renderer local storage. Keep the browser at least 320 px, the console at least 620 px, the content area at least 360 px, and re-clamp both renderer and native BrowserView bounds after window resizing.
- Why: the old code still existed, but a 10 px transparent mouse-only target, conflicting CSS/JavaScript limits, and unconditional startup reset made the feature unreliable and made successful dragging disappear on restart.
- Impact: operators can resize the sidebar, middle workbench, and browser allocation by mouse, pointer, or keyboard; double-click restores defaults; the next launch restores the prior usable layout. Collection, calibration, account partitions, and automation selectors remain outside this change.
- Reevaluate when: Electron BrowserView is replaced, the minimum supported window width changes, or a product redesign introduces additional horizontal panes. Any replacement must retain direct manipulation, keyboard access, bounded widths, and reload persistence.

## 2026-09-07: Separate Outreach Composers And Keep Personal Templates Local

- Decision: Show only the fields belonging to the selected WeChat, email, or PGY invitation method. Store each operator's reusable template library in local renderer storage, while keeping the selected method, project name, and generated batch drafts in the run review record. Template edits affect only the current draft until explicitly saved; deletion requires confirmation and cannot remove the last template.
- Why: One mixed form made channel selection meaningless and encouraged accidental edits across unrelated workflows. Personal phrasing and contact details differ by operator, so fixed global templates are the wrong ownership model.
- Impact: WeChat and email resolve `{{项目名称}}` from one brand-project field, PGY retains its structured platform fields, and all three channels support add, edit/rename, duplicate, set-default, and delete without changing existing human send confirmation gates.
- Reevaluate when: templates must follow a user across computers or be centrally governed. At that point add an explicit personal/team scope and Feishu-backed synchronization; do not silently turn personal templates into shared mutable data.

## 2026-09-07: Scope Actions By Channel And Batch PGY Preparation Only

- Decision: Bind each visible selection to the active outreach channel and render only that channel's execution controls. Implement PGY batch work as a frozen serial queue that automates creator opening and verified form preparation, but requires a fresh human confirmation before every final send.
- Why: A mixed action bar makes it unclear whether selected creators will go to WeChat, email, or PGY. Repeating navigation and form preparation is mechanical work, while the final invitation is an external business action that must remain recipient-specific and reviewable.
- Impact: WeChat exposes only XiaoMiFeng actions, email exposes only mail handoff/copy actions, and PGY exposes account checks plus the batch queue. The start path cannot send; ambiguous outcomes stop progression, handled rows leave the next batch, content edits invalidate the queue, and a five-second interval separates confirmed items.
- Reevaluate when: PGY offers an official invitation API with recipient-level idempotency and auditable approval callbacks. Per-recipient human approval remains required unless the user explicitly changes that product boundary and the platform permits it.
