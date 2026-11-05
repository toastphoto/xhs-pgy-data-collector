# Contact Query Plan and Preview

## September 30 Main-App Test Failed

The user requested the actual desktop-app test. Computer Use launched the existing installed EXE under LocalAppData/Programs/content-analyzer-desktop and navigated to Review/Outreach. UI and same-folder ASAR package version are 0.1.55; no Feishu contact lookup is present in the UI or installed main/preload/review view. Source package is 0.1.56 but has no matching integration either. feishu_contracts only builds pending event envelopes, not network synchronization. Therefore the formal-app contact-lookup/backfill gate fails for missing implementation, not missing login. Do not repeat the independent credential probe as its acceptance.

This turn changes memory only, retains source/user data, does not query/write Feishu, send outreach, build or install. The existing app remains open at Review. Next: integrate safe credentials and read-only main/preload/UI provenance/conflict preview, then run a real product test. The preceding diagnostic's one-creator success remains a distinct passed gate.

## September 30 Acceptance At 10:06

Actual local summary and same-run target schema now show authenticated metadata and official search success: 27 fields, one identity-verified candidate, manual_review, zero automatic proposals, manualTypeReview true, no detected local/remote conflict. The user reports the visible preview works. This completes the single-creator read-only preview goal. Previous plain query was empty; corrected bounded-LF query produced a match, supporting effectiveness. The running older GUI did not persist the LF-variant flag, so do not infer the raw API identity value from this summary alone. Contacts and real IDs remain absent from versioned evidence.

Not accepted: whole-library quality, automatic contact-type classification, main/preload/renderer integration, local confirmation/application, Feishu record writes, outreach or installer release. Next: integrate read-only lookup/provenance/manual review in the existing workbench, then independently test marked writes only if authorized. This turn changes documentation only and does not rerun business tests. Earlier reports below remain dated history.

## September 30 Live Query Follow-Up

The real local result at 09:52 passed auth and metadata and executed search but returned zero candidates. Live metadata platform options are now evidenced. The corresponding existing record was read again through the browser; its visible account-number DOM text includes one terminal LF. Root cause is still a hypothesis until API reproduction. The diagnostic now uses platform AND (canonical exact identity OR canonical plus terminal LF), with matching response checks and no arbitrary trim/fuzzy query. Empty results no longer claim identityVerified. 80 complete Feishu Node and 13 Python tests passed; user is asked to rerun from the same window with only the cleared Secret refilled. No record updates, product integration or positive contact-query acceptance yet.

## September 30 Update

The sections below describe September 28's historical boundary. The confirmed identity is now the profile-visible XHS account number, not its URL ID. A local diagnostic workflow now exchanges credentials once, reads target-type meta, resolves exact fields and a unique enabled/scoped Xiaohongshu option, performs one official search and returns an ephemeral preview. The handoff GUI displays record provenance/type/conflicts without writing local creator data or Feishu. Schema and aggregate summary only are persisted; private preview/stdout must not be logged.

Official select output is a label/value object; filtering uses a list of value IDs. Corrected the original scalar-only parser and fixtures. Missing or ambiguous metadata stops before search. No field/all configuration permission added. Numeric API codes/status are retained without remote error text. 74 complete Feishu Node tests and 13 Python tests passed; 31 targeted query tests passed after diagnostic improvement. Real API query has not run, and product IPC/UI is not wired. Next gate: user enters fresh local credentials once, then inspect the timestamped aggregate result and the window's actual single-creator preview.

Additional official contracts read live:
- https://project.feishu.cn/b/helpcenter/1p8d7djs/2jhqmwhn
- https://project.feishu.cn/b/helpcenter/1p8d7djs/1tj6ggll

## Verified implementation boundary

Added lib/feishu_contact_preview.js and its test file in desktop-app. Pure functions only: no network client, credential handling, IPC, renderer integration, persistence or mutation. This is not a usable live contact lookup yet.

- Query plan requires explicitly confirmed identity namespace and platform option ID, schema-compatible field keys, exact nonblank identity, AND combination, first page capped at 50, and three selected fields only.
- No nickname query or PGY/XHS ID substitution. No fuzzy/empty query or automatic pagination.
- Response review checks business success, target scope, duplicate/unsafe record IDs, exact identity/platform readback and complete pagination. Unknown select value shapes fail closed until live field serialization is verified.
- Unlabelled contact strings/numbers and status placeholders require manual review. Labelled WeChat and email candidates remain proposals requiring confirmation. Preserve source record IDs; local nonempty values are never replaced. Multiple different values remain conflicts, not latest-wins.

## Evidence and next gate

52 focused offline Node tests pass (12 new preview cases and 40 auth/metadata/probe cases). Existing actual metadata success returned 27 fields; its private schema snapshot is in the local handoff workspace, excluded from Git. No actual contact search or business write occurred in this turn.

Read official pages live in browser:
- https://project.feishu.cn/b/helpcenter/1p8d7djs/19pti4e2
- https://project.feishu.cn/b/helpcenter/1p8d7djs/1l8il0l6

Documented search uses POST /open_api/:project_key/work_item/:work_item_type_key/search/params. Text/link equality uses string values; select filtering uses option ID lists, not labels. Request fields explicitly restrict projection. More than one page must not silently be treated as all matches.

Pending: confirm whether the team's XHS ID field stores the public account number or internal profile ID; obtain reviewed platform option ID and select readback shape; implement bounded official transport and UI preview, then run one explicitly selected real creator case. Do not request another credential-only test or claim contacts are matched from the schema test. No commit, push, build or install.
