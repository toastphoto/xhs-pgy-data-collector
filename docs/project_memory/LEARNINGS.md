# Learnings

Record the mistake, the correct practice, and the reusable impact. Do not include secrets, private data, or long chat excerpts.

## 2026-07-27: Treat The Local Repository As The Codex Project

- Pitfall: acknowledging a delegated chat thread did not establish durable repository-level context.
- Correct practice: use the actual repository as the project root, check `git status --short --branch`, and read repository memory before conclusions or edits.
- Reusable impact: future threads recover from repository files and live checks instead of prior chat assumptions.

## 2026-07-27: Do Not Assume API Configuration Exists

- Pitfall: provider configuration may be absent, private, ignored, or stored only in local files such as `.env` or `ai_config.json`.
- Correct practice: inspect templates and code paths, never invent or print credentials, and mark local API state as "needs recheck" unless verified in the current thread.
- Reusable impact: configuration claims remain evidence-based without exposing private information.

## 2026-07-27: Verify Runtime Availability Before Using Bare Commands

- Pitfall: bare `python` and `npm` were not available on this Windows `PATH`, so commands failed before project code ran.
- Correct practice: check the project environment first; in Codex Desktop, use the bundled runtimes when appropriate. Missing project dependencies still require the normal project install process.
- Reusable impact: distinguish a missing command runtime from a failing project test and report partial verification accurately.

## 2026-07-27: Platform Packaging Evidence Does Not Transfer

- Pitfall: the macOS DMG and its acceptance results do not prove the configured Windows NSIS target is usable.
- Correct practice: build the Python backend with Windows PyInstaller, package it into a Windows Electron installer, and run Windows-native installation, startup, backend, path, and export checks.
- Reusable impact: label artifacts and acceptance by operating system and architecture.

## 2026-07-27: Mirror The Application's Readiness Fallback

- Pitfall: the first packaged-backend smoke test treated `/api/desktop/health` returning 404 as failure even though the Electron app intentionally falls back to `/api/config`.
- Correct practice: test the same readiness sequence as production code, and print process logs before classifying a startup failure.
- Reusable impact: distinguish an optional endpoint from an unhealthy packaged service.

## 2026-07-28: An Incomplete Range Must Not Be A Successful Candidate Import

- Pitfall: the pagination loop silently stopped when the next control or response was missing, returned `ok: true`, and merged the available slice. A request for ranks 35-50 therefore appeared successful with only ranks 35-40.
- Correct practice: distinguish next-control, response-timeout, page-mismatch, duplicate-page, risk-stop, and incomplete-range outcomes. Keep partial rows temporary and merge only after the full requested rank range is confirmed.
- Reusable impact: every bounded multi-page workflow must define completion evidence and fail closed instead of treating loop termination as success.

## 2026-07-28: The Active Browser Tab Must Never Define The Automation Target

- Pitfall: a single mutable BrowserView made email navigation erase the PGY page; simply changing that variable on tab switches would make collection and recording run against whichever tab happened to be active.
- Correct practice: bind automation to a protected role tab, keep mail in a separate session, validate recording event senders, and lock user navigation while automation holds the collection page.
- Reusable impact: future XHS or manual tabs can be added only through explicit role-based targets and operation locks, not by reusing an active-tab global.

## 2026-07-28: A Packaged GUI Cannot Assume Stdout Stays Open

- Pitfall: the first rebuilt `win-unpacked` app forwarded backend output through `console.log`; its launching process had already closed the pipe, so an `EPIPE` crashed the Electron main process.
- Correct practice: guard main-process output streams and detach packaged backend stdio from the parent console. Verify the artifact by launching it the same way an end user will, not only from a persistent terminal.
- Reusable impact: Windows GUI acceptance now includes a no-console launch, visible backend-ready state, graceful close, and port-release check.

## 2026-07-31: A Built Feature Is Not An Installed Feature

- Pitfall: the tab implementation was validated only in `win-unpacked`, while the user's desktop and start-menu launchers still opened the July 27 installation with no tab code. The generated shortcuts also pointed at a nonexistent sandbox-user path.
- Correct practice: inspect the real installed ASAR and launcher targets, give every shipped fix a distinct visible version, then verify the installed UI from the same shortcut the operator uses.
- Reusable impact: source, directory build, installer file, installed executable, and user launcher are separate acceptance stages and must not be collapsed into one claim.

## 2026-07-31: Visible Page Numbers Are Supporting Evidence

- Pitfall: a new PGY list response could arrive with different creators, but the reader rejected it solely because the live pagination DOM did not expose the expected active-page style.
- Correct practice: prefer sanitized in-memory response page metadata and ordered creator fingerprints; use a narrowly detected numeric active-page control as supporting evidence, and keep rejecting response-page conflicts or duplicate creator pages.
- Reusable impact: changing third-party DOM styling no longer creates a false page-mismatch, while incomplete or duplicate ranges still fail closed.

## 2026-08-03: Search Defaults Are Not Manual Review State

- Pitfall: normalized PGY search rows carried a default `candidate` status, so a repeated search could overwrite an operator's selected/excluded decision even when empty-value merge protection existed.
- Correct practice: classify fields by ownership. Refresh public search facts such as name and metrics, but explicitly preserve manual status, priority, exclusion reason, and notes for an existing candidate.
- Reusable impact: every import/refresh merge must distinguish source-owned facts from operator-owned decisions and test that distinction directly.

## 2026-08-03: A Healthy Port Is Not The Current Backend

- Pitfall: accepting any healthy response from port 8010 can attach the desktop UI to a stale process from an older build or another launch.
- Correct practice: generate a per-launch token, pass it to the packaged backend, require the matching token and protocol version at readiness, and keep Electron single-instance.
- Reusable impact: packaged-service checks now prove process ownership and compatibility, not merely that something is listening.

## 2026-08-03: Opening Mail Must Not Start Collection

- Pitfall: the enterprise-mail handoff button could silently begin missing-contact enrichment before opening mail, combining a visible navigation action with an unexpected platform-reading operation.
- Correct practice: keep `补采已选达人联系方式` as a separate confirmed action. `打开企业邮箱` may use already-reviewed email data and open the mailbox, but it must not start XHS enrichment.
- Reusable impact: UI commands with different risk, latency, or data effects remain separate and explicitly named.

## 2026-08-04: Test The User's Event Order, Not Only The Happy Timing

- Pitfall: response-cache tests covered a command opening before the PGY list response arrived. The real operator order was the reverse: wait for the list to render, then click the instruction. The valid first-page response was deliberately discarded, so both first-15 and first-50 reads failed at rank 0.
- Correct practice: write regression tests around observable user event order. Preserve a sanitized same-navigation snapshot for the already-rendered page, then open a scoped command window for subsequent pagination responses.
- Reusable impact: asynchronous UI tests must cover events arriving before, during, and after the user command; timing assumptions are part of the product contract, not an implementation detail.

## 2026-08-05: Do Not Override An Unambiguous Visible Page

- Pitfall: the app preferred a recursively found response `currentPage` and filtered out disabled pagination controls, so an unrelated pager could override a visibly highlighted page 1 and the disabled previous arrow.
- Correct practice: visible active-page and boundary-control state define the operator's current page; response metadata must belong to the selected candidate-list branch and can only corroborate or raise a conflict.
- Reusable impact: third-party UI automation must preserve evidence provenance instead of treating every similarly named field as the same concept.

## 2026-08-05: Back Navigation Is Not State Preservation

- Pitfall: creator-detail and XHS pages reused the protected collection BrowserView, destroying PGY filter, page, history, and scroll state; renderer-only scroll restoration could not fix the browser state loss.
- Correct practice: isolate collection, detail/XHS, and mail in explicit role tabs, and bind automation to those roles rather than the active tab.
- Reusable impact: preserve valuable third-party page state structurally before adding best-effort UI restoration.

## 2026-08-05: A Fixed Delay Is Not Page Readiness

- Pitfall: one DOM read after a fixed delay raced SPA rendering and classified partial profiles as unavailable or contact-free.
- Correct practice: poll within a strict timeout, require the canonical target URL and stable visible profile snapshots, and stop immediately on login or risk evidence.
- Reusable impact: asynchronous page readers need testable readiness states and stability evidence, not larger sleep constants.

## 2026-08-05: A Visible List Is Not Yet A Ranked Page Anchor

- Pitfall: the UI clearly showed creators on page 1, but the reader required a page-tagged network snapshot before it would accept those rows. It therefore failed at rank 0 and never reached page 2, even though a first-50 request necessarily spans several roughly 20-row pages.
- Correct practice: define ranks globally, bind sanitized response rows to the visible page with ordered creator identities, and use current-page React/Vue component data as a read-only fallback. Turn the page only after the current page has a verified identity.
- Reusable impact: third-party paginated readers must separate four facts: visible page number, visible row identity, response provenance, and global rank continuity. None may be silently substituted for another.

## 2026-08-06: Equal Counts Can Still Be A False Calibration

- Pitfall: the row selector and nickname selector both targeted `div.kol-info_detail`. Both returned 20 elements, so count equality passed even though every "nickname" contained location and tags.
- Correct practice: treat the repeated field and repeated container as different selector types, reject row/name equality, and inspect ordered nickname samples rather than counts alone.
- Reusable impact: structural calibration must validate meaning and scope, not only cardinality.

## 2026-08-06: The Nearest Pagination Ancestor May Be The Wrong Root

- Pitfall: `closest([class*=pagination])` stopped at the small `d-pagination-goto` input wrapper, while the numbered controls lived in a higher semantic pagination root with an intermediate layout wrapper.
- Correct practice: walk ancestors, require at least two distinct numeric pages, and prefer a semantic pagination/pager ancestor before a generic number-sequence wrapper. Preserve regex backslashes when this logic is emitted from a JavaScript template literal.
- Reusable impact: third-party controls should be identified by required behavior across the whole subtree, not by the first class-name match.

## 2026-08-06: Windows ASAR Paths Must Use Windows Separators

- Pitfall: an installed-package inspection used `renderer/state/...` with `/`, causing `extractFile` to report a missing `.mjs` file even though the ASAR listing contained it.
- Correct practice: inspect `listPackage` first and use `renderer\\state\\...` for nested paths on Windows before declaring an artifact incomplete.
- Reusable impact: package-inspection tooling errors must be ruled out before rebuilding or rejecting a release.

## 2026-08-06: A Control Click Is Not An Effective State

- Pitfall: pause and stop buttons acknowledged the command but gave no reliable indication of whether the current navigation/read/write had actually reached a safe halt.
- Correct practice: expose `pause requested`, `paused`, `stop requested`, and `stopped` separately; make waits interruptible and switch to the effective state only at a defined safe point.
- Reusable impact: every long-running operator workflow needs an observable state machine, not optimistic button text.

## 2026-08-06: Activating A Tab Is Not Returning To The Filtered Result

- Pitfall: the collection role tab could itself be left on a creator detail page, so merely activating it did not restore the PGY creator list or its filters.
- Correct practice: restore a matching creator-result entry from that BrowserView's history, and treat fresh navigation as a degraded fallback that requires filter/page recheck.
- Reusable impact: navigation recovery must prove the destination state, not only the selected tab identity.

## 2026-08-06: Generic Contact Failure Text Prevents Diagnosis

- Pitfall: the review flow reduced PGY page-load, missing profile link, XHS readiness, login, risk, and timeout outcomes to the same `补采失败` label.
- Correct practice: persist a stable failure code and human-readable reason per creator, poll asynchronous pages to stable evidence, and reuse previously resolved profile URLs.
- Reusable impact: retries can be targeted, field reports become actionable, and genuine missing public contact is not confused with a technical failure.

## 2026-08-06: Calibration Needs A Visible Next Step

- Pitfall: even when selector mechanics were correct, a first-time operator could not tell what had been calibrated, what remained, or that first-50 accuracy also required a cross-page verification.
- Correct practice: show the current calibration step, the next action, and the two required verification stages in the interface while keeping selector internals out of the normal workflow.
- Reusable impact: expert-only recovery tools become usable without weakening validation criteria.

## 2026-08-10: Unit Tests And Negative Samples Do Not Validate Contact Enrichment

- Pitfall: the enrichment code looked correct in tests, but the first real logged-in batch classified fully loaded profiles as loading and reused one creator's profile URL for other rows. Three not-public profiles also could not prove that email parsing worked end to end.
- Correct practice: inspect the actual loaded DOM, verify per-row PGY/XHS identity, distinguish the document/profile loader from nested feed loaders, and finish with an installed-app positive sample plus not-public samples. Persist only sanitized outcome counts and codes.
- Reusable impact: contact enrichment is accepted only when navigation, readiness, parsing, persistence, and UI status all work together on real visible pages without cross-row leakage.

## 2026-08-10: First-50 Does Not Prove A Direct Range

- Pitfall: treating a successful global first-50 command as sufficient evidence that a direct rank 35-50 command uses the same global offsets and continuation boundary correctly.
- Correct practice: run both commands independently on the installed app and verify page composition, the rank-40 manual checkpoint, enforced cooldown, latest-segment uniqueness, deduplicated total membership, and restoration to page 1.
- Reusable impact: accept each natural-language range shape on its own control path; shared pagination code is supporting evidence, not end-to-end proof.
