# Decisions

## 2026-06-29: Repository-local memory is authoritative for handoff

- Decision: Use `AGENTS.md` plus `docs/project_memory/` as the first-read context for future helper threads.
- Why: The project has multiple historical directories and prior chat context can be stale. Repository-local memory makes handoff explicit and auditable.
- Impact: New threads should recover context from files, then recheck volatile environment state.
- Reevaluate when: The repo is split, renamed, or moved to a different maintenance workflow.

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
