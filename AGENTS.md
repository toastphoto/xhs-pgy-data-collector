# AGENTS.md

## Project

Xiaohongshu Pugongying Data Collector is a conservative desktop data collection tool for Xiaohongshu/Pugongying creator information. The main product is an Electron desktop app that embeds a real browser, keeps login/manual intervention in the operator's hands, runs creator URL batches serially, saves evidence, exports Excel tables, and can sync collected runs into a local SQLite/KB layer for analysis.

## Main Paths

- Current Windows checkout: `C:\Users\feibo\Documents\Codex\2026-06-25\s\projects\xhs-pgy-data-collector`
- Mac checkout: `/Users/jingjing/Documents/Codex/2026-06-03/new-chat/product/xhs-pgy-data-collector` (needs recheck before Mac work)
- Main product line: `desktop-app/`
- Compatibility backend/reference crawler: `content-analyzer/`
- Product/spec notes: `docs/`
- Feishu workflow schema: `docs/intranet/feishu-workflow-schema.md`
- Project workflow skill: `skills/pgy-desktop-workflow/`
- Project memory: `docs/project_memory/`
- UX redesign blueprint: `docs/project_memory/UX_REDESIGN_PLAN.md`
- Pugongying anti-bot/risk-control safety audit: `docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md`
- Pugongying live safety validation protocol: `docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md`
- MVP acceptance plan: `docs/project_memory/MVP_ACCEPTANCE_PLAN.md`

Checked on 2026-09-08: Windows branch `main`, HEAD `0342968`, with uncommitted Windows layout and invitation repairs. This is a dated observation, not a branch-switch instruction. Live remote state, authentication, services, ports, installed artifacts, and external pages all need recheck before use.

## Run And Verify

```bash
cd desktop-app
npm install
npm test
npm run dev
```

Invitation regression: `npm run test:invite-dom` uses isolated local Electron pages. `node tests/pgy_invite_flow.electron.test.js` additionally requires Playwright available via `NODE_PATH`; it tests fictional recipients, the real batch UI, IPC and splitters. Set `PGY_APP_EXE` to the packaged executable to test the artifact. Never point these fixtures at an operator profile.

The Electron app normally starts the legacy Python backend from `../content-analyzer/main.py` on `127.0.0.1:8010`. If Electron install hangs on binary download, use the mirror instructions in `desktop-app/README.md`.

Project-memory validation:

```bash
python scripts/verify_project_memory.py
```

Pugongying collection safety audit:

```bash
python scripts/audit_pgy_safety.py
```

Running-backend safety probe (NOT read-only; explicit authorization and an isolated target required):

`probe_pgy_runtime_safety.py` sends `POST /api/crawl/start`, even when earlier config assertions have failed. Expecting rejection is not proof that no collection can start. `prepare_pgy_live_validation.py` invokes the same probe. Do not run either during memory reviews or default automated verification; inspect the target and side effects first.

```bash
python scripts/probe_pgy_runtime_safety.py
```

Authorized live-record preparation (first command has the probe side effects above); offline record checkers follow:

```bash
python scripts/prepare_pgy_live_validation.py --output tmp/pgy_live_validation_YYYYMMDD.json
python scripts/validate_pgy_live_validation.py --print-template
python scripts/validate_pgy_live_validation.py tmp/pgy_live_validation_YYYYMMDD.json
python scripts/test_pgy_live_validation.py
```

MVP readiness checker:

```bash
python scripts/check_mvp_readiness.py
python scripts/check_mvp_readiness.py --run-commands
python scripts/check_mvp_readiness.py --strict
```

## New Thread Checklist

1. Read this file first.
2. Read `docs/project_memory/ACTIVE_CONTEXT.md`.
3. Read `docs/project_memory/DECISIONS.md`.
4. Read `docs/project_memory/HANDOFF_TEMPLATE.md`.
5. Read `docs/project_memory/LEARNINGS.md`.
6. Read `docs/project_memory/UX_REDESIGN_PLAN.md` before UI/product-workbench changes.
7. Read `docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md` before changing collection speed, batch size, browser automation, proxy/headless behavior, or risk-control handling.
8. Read `docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md` before claiming real-account safety validation is complete.
9. Read `docs/project_memory/MVP_ACCEPTANCE_PLAN.md` before claiming the app is a usable or delivered MVP.
10. Recheck `git status --branch --short`, current branch, and whether services/ports are running.
11. Re-run the smallest relevant verification before changing code, usually `cd desktop-app && npm test`.
12. Confirm whether ignored local data files are present before touching import/export flows.

## Boundaries

- Production supplementation is explicitly approved through the independent `enrich` delta workflow: match exact account/platform/maintainer, preview touched fields and read back; do not require creator/updater/timestamp/workflow equality. It never grants test deletion rights. See [enrichment](docs/project_memory/FEISHU_ENRICHMENT_2026-10-15.md).

- Explicitly approved production creation uses nickname-only titles and dispatch-time contact-establishment dates; keep it separate from marked AI tests. Production entries cannot enter the test mutation/cleanup lifecycle. Empty contacts never justify disabling all cloud mandatory checks or inserting placeholders. See [production creation](docs/project_memory/FEISHU_PRODUCTION_2026-10-15.md); source/fixture success is not installed or cloud acceptance.
- Before explicit production approval, every Feishu test write must carry a visible `[AI测试]` marker and a unique batch id at creation. Verify markability and cleanup capability before any write; never test updates on existing real business records. Follow [Feishu prelaunch policy](docs/project_memory/FEISHU_PRELAUNCH_TEST_POLICY.md).
- Keep a protected, Git-ignored manifest of exact test objects. Cleanup must match the manifest, destination, marker and batch; preview the scope and obtain action-time confirmation before deletion. Never mass-delete by a name substring or treat test mode as permission to send real outreach.
- Treat Feishu plugin identity/configuration, permission grant, bounded release, administrator installation/data authorization, and live software acceptance as separate gates. A test app or canceled version form is not a delivered integration; never submit public/store defaults for an internal test.
- Explain the actual platform permission group before requesting access: metadata/creator lookup may share broader detail, record and attachment-reading capabilities. Restrict data scope and client calls; do not add unrelated configuration/write permissions to bypass a blocked read setup.
- Verify owner-managed debug scope and specified-space release scope independently. An empty selector does not prove logout, missing requirements or a need to transfer ownership. Any role/owner change requires its own approval and cleanup responsibility.
- Verify saved configuration by rereading the field after leaving the editor or reloading. Visible text, a successful input call or no error toast is insufficient. Inspect only safe fields on credential-bearing pages; stop equivalent input/reload loops when persistence repeatedly fails and preserve the unresolved result.
- Do not delete or move local data files, run outputs, cookies, browser profiles, or task sheets unless the user explicitly asks.
- Do not commit `.env`, cookies, browser session data, logs, `runs/`, database files, real creator links, or task spreadsheets.
- Do not add real API keys, secrets, account identifiers, cookies, or private creator lists to docs or tests.
- Feishu remembers a successful authorized connection by default using local Electron safeStorage, never plaintext or packaged credentials. Preserve userData/Local State; restore authentication/schema only, not business actions. Check the saved connection before requesting reentry; disconnect retains it, explicit confirmed forget affects only the connection file. See [connection decision](docs/project_memory/DECISIONS.md).
- The API actor is not the current maintainer. Use the operator's entered full name and explicit live dropdown choice, never a plain-name role write, first match or actor default. Verify unique role/member identity and read back assignment on new records; lookup must not reassign old team records.
- Accept Feishu gates independently: schema/normal restart, negative person search, positive person/role, contact application, cloud writes and exact cleanup. A no-match query or empty local manifest cannot prove assignment or deletion permission. See [dated acceptance](docs/project_memory/FEISHU_ACCEPTANCE_2026-10-08.md).
- Readonly previews must not require a false cleanup/notification attestation. Deferred preparation binds fresh execution approval to its internal plan; revoke stale callbacks and recheck captured plan/safety after every pre-dispatch await. Checking again cannot revive a revoked operation.
- Selecting a mutation-blocked journal record alone grants no mutation authority. Exact readonly absence checks remain independent. Explicit manual cleanup may authorize DELETE only after verifying the acknowledged own AI-test object, creator, target, sent content, maintainer and initial workflow, showing its current fields, and receiving fresh exact-object approval. Compare the full current version again before dispatch; never rebuild its original baseline or grant update authority. Normal-page deletion is not software DELETE acceptance. See [target-record cleanup](docs/project_memory/FEISHU_TARGET_RECORD_CLEANUP_2026-10-14.md).
- Removing deleted dropdown history is local visibility only: require exact journal identities and verified terminal deletion/absence, preserve the protected audit entries, and never dispatch another cloud DELETE. Unknown or retained objects cannot be archived as deleted.
- Persist cleanup rejection diagnostics only as whitelisted categories from the first readback. Never infer a missing reason from later details, rebuild an old cleanup baseline, expose private payloads or relax ownership checks. See the readonly-retirement decision in `docs/project_memory/DECISIONS.md`.
- Do not bypass platform login, captcha, risk control, or rate limits. Keep the product aligned with manual-login, low-concurrency operation.
- Natural-language candidate intake, result pagination, and collection must all preserve the PGY-only boundary, the hard 50-creator ceiling, serial jittered waits, batch cooldown, and immediate stop on login/captcha/risk/frequent-operation prompts.
- Accept each ranked candidate command by its own visible cross-page run. A successful `前50位` run does not prove a direct `35-50位` run; both must preserve global order, the manual rank-40 checkpoint, deduplication, and return to the protected result page.
- Do not generate an executable XiaoMiFeng file or trigger any external send unless the current recipient/channel/message fingerprint has an approved human approval record. Any execution-content change invalidates approval.
- Do not assume the legacy Python backend is the main product; verify whether a requested change belongs in `desktop-app/` first.
- Do not treat service/port/branch/auth status in memory as permanent fact. Recheck before acting.
- Do not claim an installed Windows feature from source or `win-unpacked` evidence. Verify the actual installed executable, shortcut target, visible version, and installed UI.
- Do not let repeated PGY search results overwrite operator-owned candidate status, priority, exclusion reason, or notes. Merge public search fields separately from manual review fields.
- Candidate intake must work when the PGY result page loads before the operator clicks the instruction. Reuse only a sanitized response snapshot from the same BrowserView navigation context; never loosen this into an unscoped stale-response cache.
- Treat the visible PGY paginator as the primary current-page evidence. A highlighted numeric page or disabled previous control can confirm page 1; response metadata is fallback/cross-check evidence and must not override conflicting visible pagination.
- Candidate calibration must keep the repeated creator row, repeated nickname field, and semantic pagination root as three distinct selectors. Reject row/name selector equality, and require a read-only live `page 1 -> page 2 -> page 1` validation before claiming ranked pagination works.
- JavaScript emitted from Electron template literals must preserve regex backslashes in the generated page script. Add a regression or live-script check whenever pagination or picker regexes change.
- Unqualified candidate ranks are global across the ordered result set. Explicit current-page wording starts counting from the verified visible page and may continue onto subsequent pages; preserve that origin through manual checkpoints and incomplete-read recovery. Both modes keep the 50-creator run ceiling, rank-40 cooldown and ordered page verification. Never silently reset a current-page command to page1.
- A sanitized candidate response without trustworthy page metadata may be bound to the current page only when the visible paginator matches and multiple visible creator names match in order. Current-page React/Vue component rows are an allowed read-only fallback; never click the next page without a verified current-page anchor.
- Never navigate the protected collection tab to creator-detail, Xiaohongshu, or mail pages. Use explicit role tabs so PGY filters, page number, browser history, and scroll position survive the round trip.
- XHS contact reads must confirm the canonical target profile and stable visible snapshots while giving login/risk signals priority. A fixed sleep followed by one DOM read is not sufficient readiness evidence.
- Bind every XHS profile to the current PGY creator through provenance. PGY `blogger-detail` IDs and XHS `user/profile` IDs are different namespaces and must not be assumed equal. Accept a new profile only from the scoped XHS entry on the verified current PGY detail page, persist that source creator URL, and reuse it only for the same normalized PGY creator. Legacy same-ID rows may be reused conservatively; page-wide links remain invalid evidence.
- Do not claim XHS contact enrichment is accepted from unit tests or not-public samples alone. Run a logged-in, low-frequency installed-app check that includes at least one public-contact positive sample and records only sanitized aggregate outcomes.
- Long-running collection and contact jobs must expose requested versus effective control states. `pause requested` is not `paused`, and `stop requested` is not `stopped`; only mark the action effective at an interruption-safe point.
- Returning to PGY results must restore the protected collection tab and prefer its matching navigation-history entry. If only a fresh result URL can be opened, warn that filters, page number, and scroll position need operator recheck.
- Persist per-creator contact-enrichment outcome codes and readable failure messages. Do not collapse page-load, missing-profile-link, login, risk, timeout, and not-public outcomes into one generic failure.
- Calibration UX must always show the operator's current step and next verification action. Ranked collection is not calibrated until field/container selectors and a read-only cross-page round trip both pass.
- Do not treat a listening backend port as process identity. Packaged startup must verify the per-launch instance token and protocol version, and the desktop app must remain single-instance.
- Do not start Xiaohongshu enrichment as a side effect of opening enterprise mail. Contact enrichment and mail handoff are separate, explicit operator actions.
- Treat successful continuation and failed recovery as different outcomes: a complete ranked read keeps the last verified page, an incomplete or canceled read restores the known start page, and a risk stop performs no extra navigation.
- A persistent partition alone does not preserve an authenticated workspace. Reuse the same allowlisted WebContents across batches, load its entry URL only when new or invalid, and leave platform expiry or verification to the operator.
- Resolve the active PGY page only from exact ARIA state or strong selected-page class tokens. Weak appearance tokens are insufficient; response nicknames may match a calibrated information block only by exact equality or a whitespace-bounded prefix across the complete visible order.
- Keep DOM calibration, response-data readiness, and historical validation as separate states. A prior successful selector or cross-page record becomes `需复验` after restart and cannot authorize current collection by itself.
- Crossing from an embedded BrowserView to a renderer-owned input requires both trusted renderer/webContents focus and DOM focus. A focus ring alone does not prove keyboard or IME ownership.
- Test Electron features across the complete renderer, preload, IPC, main-process, persistence, and installed-artifact path. Exercise the user's real event order and immediate repetition; do not attach a second CDP client while production response capture owns `webContents.debugger`.
- Packaging acceptance is platform-specific and must inspect the actual installed app, launcher, visible version, ASAR contents, bundled runtime, and service ownership. Exclude prior build outputs and never infer an installed result from source or an unpacked directory.
- Bind progress and busy indicators to the exact operation they describe. Preserve requested versus effective states and do not let a page-wide loading flag claim that calibration, pause, stop, or send has completed.
- Invitation readback must use current scoped DOM values, including rendered offscreen fields, never stale attributes or unselected search text. Bind asynchronous work to its run, recipient and navigation generation; uncertainty after dispatch requires human outcome review before retry.
- Brand option class substrings may match plural wrappers. Click only a named actual option in its associated popup; ignore empty avatar/ID decoration, verify committed value after search dismissal, and do not let hidden/readonly former search inputs block it. See [real preparation evidence](docs/project_memory/INVITE_BRAND_REAL_ACCEPTANCE_2026-10-16.md).
- A version/HEAD does not identify a dirty worktree: bind release evidence to file hashes and exact ASAR deltas. Changing an NSIS install directory does not isolate shared appId/shortcuts/uninstall keys; require a separately verified test environment before treating another install as safe isolation. See [native handoff](design/native-workspace-01107/HANDOFF-01107.md).
- Invitation handoff tests must include departing-document history updates before target commit, not only new-page bootstrap. Limit source exceptions to owned pre-read creator/form transitions; retain target pinning, require commit for explicit loads, and keep read/send snapshots strict. See [handoff evidence](docs/project_memory/INVITE_NAVIGATION_HANDOFF_2026-10-15.md).

## Per-Version Release Gate

- A restored paused queue may have no running loop. Recovery acceptance must exercise Stop without Resume, preserve results and cooldown, verify durable unlock/restart/new-start, and cover persistence failures. Check shipped layout as well as clicks; keep installed/live acceptance separate. See the 2026-10-26 decisions.
- A native child exit code of zero is insufficient without its completed-stage evidence. Recognize required skips in both TAP and spec output; inspect archive layout and actual test entrypoints/dependencies instead of weakening product behavior for a fixture. Preserve failed runs. See the 2026-10-26 decisions.
- Every delivery candidate must run [the release tester](docs/RELEASE_TESTER.md) against its exact Windows setup EXE. `dist:win` only builds a candidate; it is not acceptance. Use `scripts/release_tester.py deliver` for the approved handoff directory; pending/failed gates must not be presented as delivered.
- Keep source, exact extracted artifact, installed upgrade and real-account evidence separate. Required skipped tests or missing dependencies block acceptance. Do not inherit fixture-shortening flags, select an old live record by filename, or run real-account/probe/install scripts through automatic discovery.
- Bind evidence to source/test file hashes and installer/payload hashes. Re-run after code or artifact changes. The automated suite uses synthetic profiles; live account operations and installation retain their own authorization boundaries.

## Memory Update Rules

### Windows Handoff Bridge

This source checkout remains the authority for implementation and detailed validation records. On this Windows workstation, also read the [local handoff entry](C:/Users/feibo/Documents/ChatGPT/小红书蒲公英工具/AGENTS.md) and [weekly memory review steps](C:/Users/feibo/Documents/ChatGPT/小红书蒲公英工具/docs/project_memory/WEEKLY_REVIEW.md) before memory reviews, including existing scheduled runs that start here. Sync only concise, dated summaries to that entry; do not duplicate or migrate the source tree. These local links are optional on other computers; a missing entry is not permission to create a second business checkout. Confirm write permissions before editing either location.

### Record Ownership

- Update `docs/project_memory/ACTIVE_CONTEXT.md` when current goals, environment state, or next steps change.
- Update `docs/project_memory/DECISIONS.md` when a meaningful architectural/product/security decision is made.
- Update `docs/project_memory/HANDOFF_TEMPLATE.md` only when the handoff workflow itself changes.
- Update `docs/project_memory/LEARNINGS.md` after a material Codex mistake or user correction.
- Keep memory concise enough for a new AI/helper thread to read in 1-3 minutes.
