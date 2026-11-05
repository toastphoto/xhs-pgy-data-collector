# Feishu Current-Maintainer Binding

Checked 2026-09-30. Source/package version 0.1.59. This is local implementation and fixture/package evidence, not real person-assignment acceptance.

## Contract And Scope

- Official [user query](https://project.feishu.cn/b/helpcenter/1p8d7djs/xqbea3rp): POST `/open_api/user/query`, only the connected User Key in `user_keys`; require one exact returned key, a nonempty name and `activated` status. Do not search the directory or return email/out_id/avatar/private keys to the renderer.
- Official [role query](https://project.feishu.cn/b/helpcenter/1p8d7djs/2s90fy0i): GET `/open_api/:project_key/flow_roles/:work_item_type_key`. Resolve exactly one role named `现维护经纪人`, using its live `id`, not a display name or the separate multi_user business field. Duplicate names/IDs fail closed.
- Official [create](https://project.feishu.cn/b/helpcenter/1p8d7djs/6c8et3fg): supply `role_owners` with one `{role, owners}` assignment and `role_mode:1` so unprovided roles use configuration defaults. The previous `role_mode:0` did not preserve those defaults. No general role editing or configuration writes added.
- Readonly `inspectOperator` is separate from connection/contact lookup; denied user/role queries do not disable the existing contact path. Manual confirmation of a fetched name is review, NOT proof of account ownership or an OAuth login. Per-colleague authenticated identity remains a separate delivery/security gate.

## Implemented Guards

- Main/preload/view use a session-bound opaque person token with a five-minute review lifetime. The renderer displays the fetched name, requires a self-confirmation checkbox and includes the person in write preview/final confirmation. Editing connection keys, refresh, disconnect or expiry clears UI authority.
- Creation requires the token/checkbox in the backend. Refresh live user/role information at prepare and immediately before dispatch; changed identity/configuration blocks writing. No arbitrary person from renderer input may become an owner.
- Only new follow-ups receive this binding; contact lookup/fill never changes team records, and ordinary updates do not reassign the maintainer. Other roles are not copied from a library match or overwritten.
- Private manifest retains the exact expected assignment before dispatch. Readback requires exactly one matching role and one expected owner; other default roles may coexist. Missing/extra/duplicate/wrong ownership stays unknown and read-only reconciliation applies the same checks. No automatic create retry or corrective role write.
- All writes remain prelaunch marked test objects with exact confirmation. Auto-notifications/default role effects, markability and cleanup must be verified before live creation.

## Evidence And Pending Gates

- 116 focused Feishu Node tests passed; full existing package pretest/test chain and PGY safety audit passed. Four new renderer regressions and ten backend cases cover confirmation, key edits, privacy, permissions, expiry, live drift and role readback. They use fixtures, not a live Feishu service.
- Updated Playwright fixture for person controls; not executed. Current visual regression still awaits explicit approval, so no layout/screenshot acceptance claim.
- Separate Windows dir build: `desktop-app/dist-feishu-0.1.59/win-unpacked/`. Version, five source/ASAR matches, excluded test/script/build trees, bundled backend and Python 3.12 passed. ASAR SHA256: `146fe5c1aa74e0c35a68126bb60d4d8977c4d75789398ce3f65885199bd9d73c`; recheck after rebuilding.
- Not launched/installed; no NSIS installer, commit, push, permission change, real user/role query, remote write/cleanup or invitation send in this turn. Previously connected 0.1.57 window and installed 0.1.55 were not touched; their current status requires recheck.
- Next: coordinated switch to this artifact without losing the old entered connection, human credential entry, real exact person/role read, then separately approve one marked create/readback/update/cleanup. Verify person scope and default notifications before that write, not after.
