# Installed Brand Preparation Acceptance, 2026-10-16

## Result

Installed Windows 0.1.105 passed a real logged-in PGY two-recipient batch. Started once from the batch button; no collection-account viewing, per-recipient open, stop/restart, manual web brand click or final send. Partial brand query produced software-side candidates; explicitly chose the canonical brand, continued recipient one, used the unsent-next action and automatically prepared recipient two with the same exact brand. Independently inspected the actual selected brand after search dismissal and the contact/product/intro/date fields. Finished with the unsent-complete action: processed2/2, prepared-unsent2, confirmed-success0, manual0, skipped0. Original five-row list/two selections, pending-contact state, saved default templates and connection retained. Test draft is still selected; it is not a production message.

Only preparation is accepted. No real sending or Feishu cloud mutation this turn. Other machines, arbitrary brands and larger real batches are not proven.

## Actual Failures And Repairs

- 0.1.97 showed ready while displaying brand search text; dismissing search revealed no selection. 0.1.98 repeatedly reopened the picker because the real search retained its initial placeholder. 0.1.99 omitted visible custom options. These failures are not acceptance.
- 0.1.100/101 falsely showed readiness while the actual committed choice was a suffix brand. Substring selectors matched plural option wrappers; their center landed on a different row. Native zoom was measured as1, not assumed to be the cause.
- 0.1.102 deepest-node filtering also removed valid rows containing empty avatar/ID nodes. Filter named candidates before excluding wrappers. 0.1.103 had only isolated smoke coverage and was not installed.
- 0.1.104 selected the correct brand but looped until select-brand timeout: a former search input was still considered active. In0.1.105 reject only rendered editable focused search, not hidden/readonly former inputs; leave search using trusted Tab instead of clicking a possibly overlapping popup. Correct brand and both real preparations then passed.
- Keep popup association, exact full name, current recipient/document binding and send approval. Do not guess the first result or weaken final-send checks. Search echo is not committed selection evidence.

## Additional User Rule

Explicit `暂未报价`, `暂无报价`, `未报价` map to numeric0 for either platform quote; text schema receives string0. Shared conversion covers creation/bulk rows/supplementation. Empty/missing/paused-order values retain prior omission behavior; malformed prices and ranges are not silently zeroed. Five quote tests plus187 workbench tests passed, including new zero-price create/readback; this is local service coverage, not a new cloud write.

## Artifact And Checks

- Installer: `desktop-app/dist-invite-selection-01105-final/小红书相关信息采集工具-0.1.105-windows-x64-setup.exe`,109726667bytes, unsigned.
- Installer SHA256: `c4d28c9eba07080fd2459b6a20f4e22ce0053316737fe781cae7ceb91610a3a4`.
- Installed and candidate ASAR SHA256: `38d1ae79bddd7f88214ef6c9571db8a24a1198859a2206d3671eff93f5385960`. Silent installer exit0; actual UI0.1.105/service normal. Account login retained.
- Stage preserves delivered UI rather than shipping concurrent experimental UI.72 non-package/non-dependency runtime assets matched stage; main/invite/quote modules matched source;115 backend files identical and Python312 runtime present.
- Final configured pretest7/test42 passed;106 invitation IPC cases and24 DOM cases passed. Exact0.1.105 local brand smoke `pgy-invite-flow-3aHhRB` passed with one option click/zero sends. Full exact0.1.102 native receipt `hzJKaA` covers six destruction cycles, batches, input, scroll, splitters and zoom; it does not prove0.1.105 real behavior.
- Final0.1.105 full native receipt `pgy-invite-flow-JIvlPH/result.json` PASS: six background-destruction/recreation cycles, singleton runtime errors, three consecutive direct preparations, same-batch brand choice, three unsent-next preparations, three fictional sends/replay checks, template input/save,100-row scroll unchanged, splitters/reload and three layout zooms. Local-only isolated profile; fictional sends are not real-account sends.
- Source/entry memory verification PASS; entry verifier8 tests PASS; PGY safety audit and git diff check PASS (only line-ending warnings). Installed quote module was independently executed locally and mapped both platform fields from explicit unquoted to0. No new Feishu cloud-write acceptance is claimed.
- No commit, push or Release upload. Recheck version/hash/authentication/branch/pages on every continuation. Branch observed `design/toast-2-task-flow-prototype`; unrelated staged/unstaged work preserved.
