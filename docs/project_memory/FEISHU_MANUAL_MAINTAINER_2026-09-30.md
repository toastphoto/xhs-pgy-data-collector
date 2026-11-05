# Manual Current-Maintainer Selection

## Requirement And Boundary

User corrected mandatory actor-name reading/self-confirmation: the software user enters a business maintainer's name and chooses the corresponding Feishu people option. The supplied screenshot shows the current-maintainer people dropdown; it does not authorize editing that existing record.

API actor and business assignee are independent. Do not default to the connected User Key, write a name string into role_owners, or copy a matched library record's maintainer. Existing team records remain read-only sources for lookup/local contact fill; ordinary updates do not reassign them.

## Source 0.1.61

- Renderer: full-name input, explicit search, unselected candidate dropdown, assignment confirmation, create preview. Editing the name/connection or switching batches clears stale selection/authority. No mandatory actor identity read or self-confirmation.
- Main: POST user/search scoped to the connected project and explicitly entered full name; exact display-name matching, activated users only, bounded 50-result validation. Same-name users need distinct account labels; otherwise stop without selecting anyone. No organization sweep, pagination, automatic retries or permission changes.
- Stable member keys stay in main-process session memory; UI receives opaque candidate tokens and minimal labels, not email/out_id/credentials. Fresh member/account-label/role checks precede preview and dispatch. The legacy internal inspectOperator IPC now requires a user-selected candidate token, never implicitly queries the actor.
- Preserve one explicit maintainer role, role_mode:1, strict ownership readback/reconciliation, first-create AI-test marker/batch and exact private manifest. Unknown write outcomes cannot auto-retry.

Official primary references reviewed: [SDK API implementation](https://github.com/larksuite/project-oapi-sdk-golang/blob/main/service/user/api.go) confirms POST user/search; [official SDK types](https://pkg.go.dev/github.com/larksuite/project-oapi-sdk-golang/service/user) give project_key/query and returned member key/name/status. Public help-page/browser fetch attempts failed; this is not evidence of account or API permission failure. Real member search/role eligibility is still unaccepted.

## Verified Locally

- 44 focused workbench/renderer/IPC tests; 124 Feishu non-UI tests; all 47 package pretest/test commands pass; PGY safety audit passes.
- Source-only Playwright fixture passes at 950/650/400 widths with no horizontal overflow/page errors; screenshot 650 visually inspected. This is layout/control regression, not real Feishu CRUD acceptance. Reused bundled Playwright via NODE_PATH and existing Chrome; installed no dependencies.
- Normal Windows NSIS 0.1.61 package built. ASAR version and five affected runtime files match source; bundled python312.dll present. Package was NOT installed/launched; current connected window not closed. No credentials copied, external records changed, invitations sent, commit or push.
- Artifact: desktop-app/dist-feishu-0.1.61/小红书相关信息采集工具-0.1.61-windows-x64-setup.exe
- Installer SHA256: 2723954e8fb3dd150ee51d3269d05f87fe7f1de25ef3175219b944f57b5e5729
- ASAR SHA256: 90d4edf82ef09786165b49a8bad9598da590d886cdb1987e3e0289d00eefab11

## Next Gate / Recheck

User requested actual acceptance after the prepared installer. Normal NSIS upgrade to 0.1.61 returned exit 0. Installed ASAR matches the package SHA256 above and reports 0.1.61; python312.dll present. Explicit installed EXE launch and native UI show v0.1.61/service normal. Backend health reports ok/protocol_version 1 and an instance identity; readonly process-path check confirms the installed resources/content-analyzer-backend executable. Health keys are snake_case; do not infer missing identity from guessed camelCase property names.

Native Review page loaded an existing run selector and the unconnected main-product Feishu form with blank credential inputs. This is an observed startup state, not a full preservation check of every datum or a cookie/login acceptance. Old window closed normally for upgrade; no credentials copied, data deleted or real Feishu mutations performed. A safe blank-form screenshot is in the Git-ignored local entry evidence directory. The separate probe window was not used to claim main-product acceptance.

Await human reconnection in the main product and the intended maintainer name. Recheck actual session/backend, search permission and target role eligibility, then test explicit selection. Separately authorize first-create marked follow-up, readback, edit and exact cleanup only after default-notification effects and cleanup capability are confirmed. Do not claim the old 0.1.59 HTTP fault resolved simply because its mandatory actor-read action was removed. Final user/developer UX acceptance remains after complete real-flow acceptance.
