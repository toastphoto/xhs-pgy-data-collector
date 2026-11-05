# Release Tester - 2026-10-23

User requires a repeatable tester before every version is delivered. Implemented `scripts/release_tester.py` with Windows drag-and-drop launcher, explicit offline test plan, exact installer extraction, JSON/HTML/log evidence, manual acceptance records, hash revalidation and gated handoff copying. Usage and scope: [release tester](../RELEASE_TESTER.md).

## Verified

- Source branch rechecked `design/toast-2-native-01105`, package version112; existing dirty work retained. No product version bump/repackaging in this task. Artifact113 is the previous frozen105 hotfix, not current112 workspace UI/service code.
- Final run `tmp/release-tests/20261023-151927-f25120e0/report.json`: **69 automated command groups passed**, zero failed/skipped/pending automatic gates. Tester self-tests13 passed inside this run. Required browser cases executed using existing cached Chromium1228, not omitted for missing CHROME_PATH.
- Exact113 installer SHA256 `0e333577756f709a5a7fdb67f5b579a25d1850105f441bf5d843a7bfce77cf80`; extracted ASAR and all payload hashes recorded. Packaged backend launched/stopped twice on isolated local ports, verified instance identity/auth and disabled legacy crawl API; no crawl requests.
- Actual packaged Electron with fictional temporary profiles: old-task discover/restore/direct-stop, retained output, full process restart and new task; continuous invite preparation/brand choice/view destruction/typing/list and splitter checks passed. Intercepted fixture sends are not real invitations.
- `verify` on the final report returned2, correctly keeping delivery blocked for five pending installed/live gates. `deliver` likewise returned2 and did not create its destination. Report layout checked1280/390px with no document overflow; screenshots kept with report.
- Earlier diagnostic run `20261023-151249-66d71fe8` retained as failed: browser startup, stale renderer fixture, wrong Python test invocation and wrong NSIS extraction assumption. Corrected test harness/runner, not business validation rules; no old report edited into a pass.

## Boundaries / Next Step

Only tests, tooling, package script aliases and documentation changed for this task. No install, real account access, Feishu changes, invitation sending, commit, push or Release upload. Existing installer unchanged. Automated checks do not cover every product function or prove installation/real platform success; explicit exclusions and live scenarios are in the usage guide.

Before delivery: perform authorized install/live acceptance against this exact hash, add sanitized records, then `verify` and `deliver`. Existing app/runtime/account state was not revalidated. Changed source/tests/artifact invalidate this report; rerun instead of copying old approval. Test artifacts contain synthetic data only and remain local under ignored `tmp/release-tests`.
