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
