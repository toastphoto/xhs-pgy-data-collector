# Invitation Navigation Handoff Repair

## Scope And Evidence

- Human reported first invitation works, later opens fail with `open-creator/unexpected-navigation/in-page:same-document`. No new final-send permission; real outreach excluded.
- Current checkout rechecked: main, dirty staged/unstaged/untracked changes preserved. Actual installed UI showed0.1.86/service normal. Only opened its independent invitation account tab; no real creator preparation/send or cloud changes. Current login/page readiness was not proved.
- Red VM and actual isolated Electron both reproduced the exact diagnostic: first fictional creator prepared/sent locally; next creator requested while the departing form updates its own history before the new document commits. Basic old48 tests passed without covering this sequence. This proves a product defect, not that every live occurrence has this sole cause.

## Repair

- Observe main-frame `did-navigate` commit separately from navigation start.
- During an owned creator load or trusted form-entry transition only, accept same-document updates to the captured departing creator/form identity while the current document is still that source. Stop this exception at commit or settling; never apply it to later reads or sends.
- A departing creator update cannot clear an already pinned form target. Wrong creator/form, reload, login/risk, generation/snapshot changes, view replacement, timeout and one-time confirmation checks remain enforced.
- An aborted or normally resolved explicit load without a document commit cannot become a successful open merely from its current URL.
- No timeout, account partition, final-send approval, retries, Cookie or Feishu connection policy relaxed. Earlier unpackaged0.1.87 Feishu configuration diagnostics remain included.

## Verification

- Final59 production-function VM IPC regressions PASS; full configured pretest7/7 and test42/42 PASS with isolated Chrome. Independent readonly review reran59 and normal/aborted no-commit counterexamples; no scoped blocker found.
- Original native red receipt: temporary `pgy-invite-flow-Brv3Wf/result.json`, first local creator success, second exact reported diagnostic. Original repaired creator-handoff native source run passed three direct plus three renderer-batch creators, single-use send checks and splitter/zoom/reload checks.
- Expanded form-event instrumentation initially failed its own coverage assertion (0/6 events), despite all six local flows completing. The synchronous variant then exposed console error `URL is not a constructor`: inline-handler scope resolved document.URL rather than window.URL. The earlier timer-suspension explanation was unverified and incorrect; use window.URL/window.history and collect fixture console errors. The fixture now updates old-page history synchronously before its window-open form transition. Do not count failed expanded runs as passes. A separate intermediate-package run failed an ephemeral element screenshot after completion; capture the stable page instead.
- Final packaged native receipt: temporary `pgy-invite-flow-bLfnsS/result.json`, exit0, version0.1.87/localOnly. Three direct and three renderer-batch fictional recipients prepared/confirmed locally, one local click each, tokens not replayable. Actual departing events observed:2 creator handoffs and6 form handoffs. Pointer/keyboard splitters, reload restoration and0.75/1/1.25 BrowserView alignment PASS. This closes the isolated packaged regression, not real-account installation acceptance.

## Final Artifact

- Use ONLY `desktop-app/dist-invite-handoff-0187-final/小红书相关信息采集工具-0.1.87-windows-x64-setup.exe`.
- 109704839 bytes; SHA256 `cf8d3d500767ffeedcca1376d40022923219d36f8bffb0e75be466afff0f94cd`.
- ASAR SHA256 `a7314137f3b93ff0a417718ced56df952a4fdbac0fa30d65da60004e59b3db41`;72 source/runtime metadata assets match (builder removes scripts/devDependencies/build from package.json);115 rebuilt backend files match, Python312 bundled. Unsigned.
- Intermediate `dist-invite-handoff-0187` is WITHHELD: it lacks the final form-handoff/no-commit repairs. Never install or hand it out.
- Human explicitly chose to install themselves. No installation, commit, push or Release upload performed. Real logged-in installed preparation and sending remain unaccepted; final sending needs fresh exact-recipient/content approval.

## Next Acceptance

After the human installs final0.1.87, verify actual installed version and ASAR, saved accounts/connection/data, then serially open and prepare at least three eligible creators without sending. Confirm second and third recipients/forms match their chosen rows and prior tokens cannot be reused. Stop on login/risk or unreadable pages; do not clear profiles or infer a permission problem from an empty page.
