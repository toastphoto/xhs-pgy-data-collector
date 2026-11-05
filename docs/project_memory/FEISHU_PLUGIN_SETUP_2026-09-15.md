# Feishu Test Plugin Setup

Date: 2026-09-15. Real in-app browser UI, not a fixture or API acceptance.

## Authorization And Result

- User confirmed no existing plugin and authorized one marked test plugin, after checking cleanup, with only metadata/creator read permissions. No secret access, business writes, publication or installation.
- Created exactly one plugin with a visible `[AI测试]` prefix and batch suffix in its initial name. The name fits the observed 30-character limit. Application Management subsequently showed it as `待上线`.
- Exact name, batch and object URL are in the local Git-ignored `tmp/feishu/` manifest. `git check-ignore` confirmed the existing `/tmp/` rule; local file ACLs were inspected. No credentials or creator data are stored there or in this report.
- The plugin's `删除插件` control exists and is enabled. It was not clicked; deletion was not tested or authorized. No credentials were read or copied, and no collaborator or owner was changed.

## Cleanup Evidence

[Official create/manage documentation](https://project.feishu.cn/b/helpcenter/1p8d7djs/49k1ojm9#beb918f3) states that only the plugin owner can delete it, using the bottom of Basic Information and a confirmation dialog. If installed, the relevant space administrators must uninstall it first.

This run did not publish or install the plugin. Before any later cleanup, recheck the exact manifest object, marker/batch, current ownership, installation and outside modifications; obtain deletion confirmation at action time. Work-item deletion and GitHub/GitLab integration removal are different operations and are not cleanup evidence for this object.

## Actual Permission Boundary

- `获取工作项实例信息` has identifier `work_item:work_item.v2.info:read` and still shows `未开通`.
- Its `查看 API` list includes both `获取创建工作项元数据` and `获取指定的工作项资源库列表（单空间-复杂传参）`. Separate space-configuration read permissions are not needed merely for these two interfaces.
- The same indivisible group also lists work-item details, cross-space list APIs, operation records and attachment download. Do not describe this grant as permission for only two endpoints. Restrict the actual data range and client calls; explain the full group before enabling it.
- No read/write/delete permission was obtained or requested through the grant buttons. No API was called.

## Blocker And Next Step

Opening `选择数据范围` showed `暂无数据`; the UI explicitly says `仅支持选择插件负责人管理的空间`. After explicit approval for the exact read-only space-menu investigation, the space list showed the intended space with two other administrators. Enabling `我管理的空间` returned `暂未找到符合的空间`; the filter was then restored unchecked. This confirms the current plugin owner can access, but does not manage, the intended space under the product's own management filter. The empty debug-scope selector now has role evidence behind it, rather than a login or requirements guess. No space was selected.

An owner change was initially proposed for debug access, but is not the only supported route. The user instead asked whether the plugin was finished and could be released for administrator review. Prefer preparing a clearly labeled, restricted enterprise test authorization version and verifying its installation/data-authorization flow before defaulting to owner transfer. This is a proposed route, not a completed release or unconditional publication authorization: the user's publication request was conditional on readiness, and readiness is not met. Reuse this plugin, preserve the AI-test marker and cleanup plan, and confirm the precise recipient, permissions and visibility at the relevant authorization step. No owner change, role elevation, credentials, writes, publication or installation occurred.

## Publication Readiness Check

- Read-only opened Plugin Publishing and its Create Version dialog, inspected the artifact dropdown, then canceled the dialog. No version was created, submitted, shared or published.
- The main publication page exposed Create Version and a disabled install-by-link switch. It also reported a network error; absence of rendered version entries is not reliable proof of server history.
- The version dialog requires a version number, Chinese version description and artifact selection. The artifact dropdown explicitly offers `无（不涉及前端工程时可选择此项）`. An API-only integration does not require inventing a frontend artifact just to publish.
- Enterprise Plugin, public/specified-space usage choices, and publish/do-not-publish-to-store choices are present. The store-publish radio was initially selected. Do not submit these defaults without explicitly bounded visibility; public/store visibility is not the intended internal-test scope.
- The dialog showed no permission changes, and Basic Information still displayed a warning. Current read permission remains unenabled from the preceding verified check; no grant was made in this investigation. The warning does not identify every missing field by itself.
- Source symbol search found the metadata reader referenced only by its module/tests, not the main process or UI. It remains an unwired preparation module; creator lookup, enrichment, confirmed creation and cleanup are not a completed live integration.
- Distinguish three gates: app identity/authorization configuration, administrator approval plus installation/data authorization, and working-software acceptance. A restricted test authorization version can precede end-to-end acceptance, but must not be described as a finished feature. The exact review recipient/workflow has not yet been observed; no administrator was notified.

## Authorized Role Verification

- The user's latest explicit approval covered opening the named space menu and viewing current role/configuration entries only.
- The space switcher menu itself also had an empty list, but its visible `查看空间列表` action led to a readable list containing the one accessible target space. An empty switcher is not proof of no accessible spaces.
- The list exposed two named space administrators, both different from the plugin owner. Names remain in the authenticated UI, not this versioned report.
- The management filter returned no matching space; unchecking it restored the view. No creator detail, configuration edit, grant, collaborator change or ownership transfer occurred.
- The space list was retained for the user's review, and the existing plugin tab retained for continuation. No new plugin was created. Role and scope remain volatile and must be checked after an authorized ownership change.

## Earlier Read-only Investigation

- The user challenged the premature administrator handoff and asked to continue. Business requirements were already sufficient; missing technical evidence is not a requirements gap.
- The known project URL initially redirected to the marketing homepage. Its normal Enter Platform button completed the site's login transition without requesting credentials. The signed-in workbench exposed the intended space, and the visible account identity matched the plugin owner. This rules out a different-account explanation for this check, not every authorization issue.
- Dismissed the nonbinding new-navigation tour and expanded navigation. No creator record was opened or changed.
- Browser safety review rejected clicking the generic space-title control because it could enter private business data and was not verified as a management control. Read-only DOM inspection found no explicit management role/label. Do not retry the rejected action through coordinates, a guessed URL or a private API. Exact read-only menu/role-inspection approval was requested; the space role remains unverified.
- Unaffected plugin-page refresh succeeded. Playwright clicks reported a location error; the documented AX Expand action then opened the real data-range selector, which still displayed no data. All listed interface permissions remained not enabled. Distinguish the locator error from the eventual verified empty result.
- No new plugin, role change, grant, publication, installation, credential access or business write occurred in this follow-up. Navigation expansion/tour dismissal are not permission changes. Recheck roles and scope after the next authorized step rather than requesting another login.

## Subsequent Basic-Info And Scope Preparation

- User continued the proposed internal-test preparation. Preserved the existing plugin name and batch. Saved a short description explicitly limiting the purpose to test/read-only contact enrichment and disclosing the lack of live API acceptance; selected the API authorization category. Both values survived an actual reload.
- Plugin Details is required. Multiple documented browser input methods made the intended AI-test description visible, but it returned empty after reload. No visible save/confirm control was found for that field. The persistence failure is unresolved; do not call it saved or assume a proven site-side cause. Do not capture the entire Basic Information page, which also contains credentials.
- Opened Create Version without submitting. Chose specified-space usage; the real dropdown contained the intended target space and accepted its selection. Set the store option to do not publish with a keyboard action and read back checked=true. The dialog was canceled, so no version/draft object or lasting release visibility was created. Public/store defaults must be changed again when preparing a real version.
- Revisited Permissions: work_item:work_item.v2.info:read still says not enabled. No grant button was pressed. Basic icon validity, final release prerequisites, actual review recipient/workflow and installation/data authorization remain unverified.
- Proposed administrator-review scope: one visibly marked internal test app, intended space only, no store listing; request the broader work-item read group with its details/attachment/record-reading capability disclosed. Client implementation is restricted to metadata and creator lookup, with no work-item creation, edits, deletes, workflow moves or outreach. Permission enablement and release/install remain distinct approval gates.
- The browser remains on Permissions for continuation. No secrets were read, no administrator notified, and no version, installation or business record was created. Only the existing test app's short description/category changed externally; local changes are documentation and the ignored test-object manifest.

## Overall Acceptance Limits

Browser login and plugin creation are verified; application authentication, live field metadata, creator lookup, contact enrichment and create/cleanup APIs are still unverified. Only memory and the ignored manifest changed locally in this step; no business code, package, commit, push or release. Repository states were rechecked: entry is uncommitted master; source is dirty main, ahead of cached origin/main by two, without fetch. Services, installed version and upstream freshness need recheck.
