# Bitable Foundation - 2026-11-05

## Baseline

- Original source checkpoint `1ee6711` is pushed and remote-read verified on `design/toast-2-native-01105`. New worktree/branch: `xhs-pgy-data-collector-bitable` / `codex/feishu-bitable`. Remote main and original user data untouched.
- Installed ASAR was read-only checked:0.1.113,62191331 bytes, SHA256 `a75131da999ab3b9180f892cf14f519381ec5f23686bb5fd73e02322e5f7325e`.
- Installed/source comparison of main, preload, browser preload, lib JS and renderer JS/MJS/CSS/HTML:65 byte-identical files,6 different,0 installed-only. Differences: main.js, browser_preload.js, renderer/app.js, renderer/index.html, renderer/state/workspace_layout.mjs, lib/browser_layout.js. This comparison is not a full artifact inventory or live acceptance. Keep existing source changes, require new regression/installed acceptance.

## Implemented Foundation Only

- Immutable Bitable package identity/version0.2.0-bitable.1; separate installer/app/shortcut identity, userData/session/crash directories and backend port28010/data roots. Reject redirect to the original profile. Installation coexistence remains untested.
- No Project workbench/connection/maintainer store initialization. All18 old Project IPC methods reject in this edition; main-renderer sender checks remain. Renderer only mounts Project UI after explicit Project edition identification. Bitable UI is not wired yet.
- Pasted Base link or explicit Base/table IDs; Wiki node distinguished for later authorized resolution. Drop view/tracking parameters, require selection for missing table, reject lookalike hosts/credential-bearing links.
- Fixed-origin official API client: paginated field/search reads, serialized batch create/update, caller-owned UUID idempotency, no automatic write retry, unknown-outcome reporting, safe numeric errors and record-count/ID checks. Token provider is injected; no credential setup or real network calls in tests. Single-client serialization is not cross-computer uniqueness.
- Selected-only data projection preserves text XHS numbers, blank contacts, unclassified contact values, explicit unquoted0 versus missing quote. Requires provenance for profile links; nickname is not a merge key. Duplicate selected identities surface conflicts. Supplementation never empties cloud contacts or silently overwrites followup/person fields.
- Release tester adds Bitable source checks, exact artifact edition identity and separate live-Bitable/coexistence gates. Old Project manual receipts cannot release this edition.

## Verification

-22 foundation tests plus2 existing Project IPC tests passed.14 release-tester self-tests passed in the normal-user environment; initial sandbox Python temporary-directory permission failures were not product failures and checks were not relaxed.
- Complete source/fixture rerun `tmp/release-tests/20261105-112939-dc8da310/report.json`:66 passed,0 failed,4 exact-artifact checks blocked because no installer was supplied;6 installed/live/manual gates pending. First run `20261105-112426-e380bc12` retained with61 passed/5 failed/4 blocked; dependencies and fixture causes are recorded in LEARNINGS. No installer built, no profile copied, no login/collection/invitation/cloud mutation.
- Worktree dependencies use a Git-ignored junction to the existing same-Windows source node_modules. No dependency installation or cross-OS copying. Source checks are not a fresh-lockfile installation or packaged runtime acceptance.

## Remaining Before Delivery

One-time authorization and team ownership; standard table template and actual field schema; all collected field coverage (initial projection is not all145 export fields); persisted target/mapping; explicit sync selection UI; durable batch queue and result reconciliation; stable identity aliases when previously absent XHS number appears; maintainer mapping/followup; contact backfill; test cleanup; multi-client policy. Then exact Windows artifact/install and real selected table round trip. No claim of completed Bitable sync.

Official protocol references (read2026-11-05):
- [Create batch model](https://github.com/larksuite/oapi-sdk-python/blob/v2_main/lark_oapi/api/bitable/v1/model/batch_create_app_table_record_request.py)
- [Update batch model](https://github.com/larksuite/oapi-sdk-python/blob/v2_main/lark_oapi/api/bitable/v1/model/batch_update_app_table_record_request.py)
- [Search model](https://github.com/larksuite/oapi-sdk-python/blob/v2_main/lark_oapi/api/bitable/v1/model/search_app_table_record_request.py)
- [Field pagination model](https://github.com/larksuite/oapi-sdk-python/blob/v2_main/lark_oapi/api/bitable/v1/model/list_app_table_field_request.py)

Official docs HTML repeatedly lacked readable bodies; SDK request/body models were verified instead. This establishes protocol shape, not current tenant permissions or actual table compatibility.
