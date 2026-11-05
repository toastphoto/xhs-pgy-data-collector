# Windows Installation And Live Feishu Check

Checked 2026-09-30. User requested installation followed by actual software testing. This is partial installed acceptance with a reproduced live blocker, not full workflow acceptance.

## Installed 0.1.59

- Built NSIS using existing dependencies: `desktop-app/dist-feishu-0.1.59/小红书相关信息采集工具-0.1.59-windows-x64-setup.exe`. Normal silent upgrade to the existing local Programs installation; no profile/Cookie/data copy or removal.
- Actual installed EXE, desktop/start-menu shortcut targets, visible `v0.1.59` and installed ASAR verified. Before the subsequent diagnostic source edits, main/preload/workbench/view/CSS matched installed ASAR. SHA256: `146fe5c1aa74e0c35a68126bb60d4d8977c4d75789398ce3f65885199bd9d73c`.
- Bundled Python 3.12 confirmed. Port 8010 belongs to the installed `xhs-pgy-backend.exe`, not the source backend; readonly desktop health returned ok, protocol 1 and instance identity present. The token itself was not logged.
- Native UI service normal; previous run remains selectable. Actual main splitter drag changed 960 to 809; sidebar drag changed 220 to 269. Final observed layout was 227/809, not an exact restoration of the earlier widths; recheck before future UI work.
- User manually reconnected Feishu and logged into PGY. Installed UI reported connected, 27 fields and no write; PGY search page was actually visible. Earlier unauthenticated landing page is superseded by this later observation, not evidence of deleted Cookies.
- Clicking `读取操作人姓名` caused a real `FEISHU_HTTP_ERROR`, with maintainer still unconfirmed. Existing renderer hid numeric HTTP status, and the combined person/role operation did not identify which read failed. Do not attribute this to permissions, login or an invalid route without fresh stage-specific evidence.
- Both official user-query and role-config documentation were reread through the in-app browser; request methods/paths agree with source. Documentation agreement does not establish live endpoint acceptance.

## Diagnostic 0.1.60 Prepared, Not Installed

- Backend returns only allowlisted `operator_query`/`maintainer_roles` stage plus safe numeric HTTP/API code; renderer displays those diagnostics without raw response, URLs or credentials. No new API destination, permission or retry introduced.
- Three focused regressions cover person/role HTTP failures, retained lookup connection and private/malformed diagnostic filtering. Targeted 40 tests pass; all 47 package pretest/test commands pass; 120 Feishu non-UI tests and PGY safety audit pass. Package scripts were run sequentially with the existing Node runtime because npm is not available on PATH; no dependency installation.
- NSIS: `desktop-app/dist-feishu-0.1.60/小红书相关信息采集工具-0.1.60-windows-x64-setup.exe`, SHA256 `82fb057465a1164ee093ee01c3afd8abe55ec8d45bb1e70ce36a688de835da95`.
- ASAR SHA256 `2f77e036024a3f8ff23f241f5639d5f29e66f1c5526ecbaf7390563c28eb8333`; version/five source matches/bundled Python checks pass. This is artifact evidence only.
- Current connected 0.1.59 preserved while requesting a coordinated diagnostic upgrade; no automatic closure of the freshly entered session. Upgrade will end the in-memory Feishu connection and requires human reconnect, not credential copying.

## Next Gate

After upgrade consent, install 0.1.60 normally, recheck actual artifact and run one person read after human reconnect. Diagnose the exact failing stage/status without guessing permissions. Then test exact creator lookup, confirmed local fill/persistence, human self-confirmation and separately approved marked create/readback/update/cleanup. Check notifications and cleanup ability before any write. Final UX audit follows all agreed real chains, not these smoke tests.

No remote write/delete, invitation send, commit, push or Release upload. Safe native screenshot is Git-ignored in the local handoff entry under `artifacts/feishu/ui-audit-install-20260930/installed-0.1.59.png`; ignore verified before saving. Windows, service/login state, timestamps, artifacts and hashes must be rechecked.
