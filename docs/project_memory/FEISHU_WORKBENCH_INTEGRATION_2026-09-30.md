# Feishu Main-Workbench Integration

Checked 2026-09-30. User corrected read-only scope: integrate lookup, confirmed local contact fill, separate follow-up creation, owned-record update and exact cleanup in the main product.

Later 0.1.59 update adds reviewed current-maintainer role assignment on creation and strict owner readback; see [binding evidence](FEISHU_MAINTAINER_BINDING_2026-09-30.md). No real person/role query or role write acceptance yet.

Later delivery review: native main window now shows connection success and no Feishu error code. Credential-entry gate has a visible positive result; actual lookup/fill/CRUD acceptance and final-artifact launch remain pending. User requests a default connection; persistent reconnect is not implemented and scope clarification is pending. See [delivery gates](DELIVERY_GATES_2026-09-30.md). Do not interpret absence of a success label as proof no operation ever occurred; it is only this inspection's visible result.

## Implemented

- Main-memory plugin authentication and same-target live field mapping; renderer/preload/main wiring in Review/Outreach. No credential persistence, Cookie reuse, raw provider errors or automatic retries.
- Exact platform plus displayed Xiaohongshu account-number lookup. Contacts remain proposals until manual source/type confirmation; fresh local conflict checks precede saving. Explicit email/phone labels round trip, and successful fill supplies the follow-up draft without overwriting a manually edited draft.
- One selected creator per operation, not unattended whole-batch sync. Follow-up creation is separate from the source library record. Only allowlisted business fields and live option IDs are writable; missing contact/unsupported required fields block creation. Placeholder and invitation-only mapping remain unaccepted.
- Test marker and unique batch accompany first creation. A private manifest is persisted before dispatch. Update/delete require exact manifest ownership, target, marker, batch and fresh full-record stamp. Uncertain results block retry and expose read-only reconciliation.
- Current previews and single-use confirmation tokens guard writes. Clear-field updates, workflow progression, general role editing, attachments, comments, outreach and production mode are not implemented/authorized by this feature. Reviewed current-maintainer creation is the only added role operation.
- Only the main renderer's main frame can invoke these ten IPC methods (including readonly person inspection); embedded websites/child frames are rejected.

## Evidence

- 98 focused Feishu Node tests passed, including production-module mocked CRUD, failures and IPC sender restrictions. Complete package pretest/test chain passed. These fixtures are not real API acceptance.
- Isolated source UI tests passed at 400/650/950 px, including confirmed-fill-to-draft, stale-preview rejection and no horizontal overflow. Existing resource-export UI regression passed.
- Local Windows dir builds succeeded with existing bundled backend and Python runtime. Final artifact: `desktop-app/dist-feishu-0.1.57-final/win-unpacked/`; ASAR version 0.1.57, source matches main/preload/contact/workbench/view modules, top-level tests/scripts/prior builds excluded. ASAR SHA256: `3c6c966a046c1516961e0dccbeda6a51e2b95d1f41aaddd4152da0793d1da1aa` (recheck after rebuilding).
- Native UI verified an earlier 0.1.57 test build at `dist-feishu-0.1.57/win-unpacked`: actual ASAR URL, visible version, Service Normal and new Feishu connection panel. This running build predates the final draft-carry UI correction. The final directory is verified by package inspection, not yet opened in the native UI.
- Installed 0.1.55 remains unchanged. Initial bare-path launch reopened it; explicit `process:<absolute EXE>` launched the intended test artifact. Never count launcher completion as version evidence.
- Operator input was detected while attempting to close the test window. Closure was not executed; safe status-only reread showed disconnected. Preserve the entered form, do not extract credentials or close it blindly. Process identity query through CIM was denied; no owner identity claim from that query.

## Pending Live Gates

1. Human completes the main software's connection form with fresh credentials (not the independent diagnostic window); inspect only safe outcome fields, not credential values.
2. Verify a real product lookup, explicit local fill and persisted result on one approved creator. The earlier independent diagnostic positive sample does not satisfy this gate.
3. Confirm target defaults/notifications, markability and actual cleanup capability before creating. Human reviews exact fields for one marked object; create and read back, update chosen fields and read back, then obtain current exact cleanup confirmation and verify deletion.
4. Final artifact native UI/installed EXE and clean-machine acceptance remain separate. No installer, installation, Git commit/push, real Feishu write, data cleanup or outreach occurred in this implementation turn.

Official contracts inspected: [create](https://project.feishu.cn/b/helpcenter/1p8d7djs/6c8et3fg), [update](https://project.feishu.cn/b/helpcenter/1p8d7djs/3e73r2k5), [delete](https://project.feishu.cn/b/helpcenter/1p8d7djs/2f5xepox), [query](https://project.feishu.cn/b/helpcenter/1p8d7djs/r9jxqxnd), [field formats](https://project.feishu.cn/b/helpcenter/1p8d7djs/1tj6ggll). Recheck external contracts and target defaults before live writes; delete documentation does not promise restoration. A pre-write stamp check is not an atomic server-side compare-and-swap.
