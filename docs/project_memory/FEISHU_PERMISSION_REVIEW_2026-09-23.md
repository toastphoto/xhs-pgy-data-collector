# Feishu CRUD Permission Review

Date: 2026-09-23. Existing marked test plugin, real in-app browser permission UI. Three approved groups are now enabled; no business API call. Initial inspection history below is superseded by the applied result.

## Applied Result After Explicit Confirmation

- After the full read/write/delete group capabilities were disclosed, the user explicitly confirmed permission to acquire all three for the existing AI-test plugin. No additional consent question was needed for the same scope.
- Selected exactly the work-item read, write and delete rows. The UI showed Batch Acquire (3). Clicking it immediately enabled all three; there was no application-reason or pending-review dialog. Do not describe this as merely submitted for approval.
- Refreshed the page: all three rows still showed enabled and Remove Permission. The other listed groups remained not enabled. A later return to the permission route reconfirmed these exact three rows. Debug data scope stayed unselected; no owner, collaborator, space, user, settings, comments, view or installation scope was added.
- Corrected the plugin's old read-only name to a synchronization-test name and replaced its short description with a disclosure of work-item read/write/delete plus bundled workflow, attachment and subtask capabilities. The AI-test prefix and original batch suffix were retained. Actual reload confirmed both fields persisted; exact identity/history is in the ignored local manifest.
- The required rich-details field was still empty after reload. No repeated rich-editor fill loop was attempted. Basic details/release prerequisites, bounded publication, administrator installation/data authorization, credentials and live client integration remain outstanding. No release or installation was performed.
- No secret was read, no business API was called, no real record was modified/deleted, and no message was sent. Enabling these groups is not client implementation or production approval. Actual test writes/deletes still require the prelaunch safeguards and action-specific confirmation.
- A browser inventory approval timeout was retried once as the tool explicitly allowed; it succeeded before any grant. It was not a platform permission refusal.

## Subsequent Required-Field Investigation

- A single ordinary keyboard character appeared in Plugin Details, but disappeared after focusing a different field and reloading. This disproves a paste-only explanation for the observed symptom; it does not establish a server or editor root cause. The final field is empty again, with no saved test character claimed.
- Internationalization configuration contained only the enabled language selector; it was canceled unchanged. Preview did not produce a new tab or dialog, and the only visible alert remained the standard version-publication notice. Do not call preview complete or infer it failed for a proven validation reason.
- Inspected only safe form controls. Anonymous buttons outside the form included credential display/reset controls, which were not clicked. No separate detail-save control was found.
- Current required-label markers include icon, name, short description, category and details. Icon upload DOM contains only add/replace file inputs and an add guide, with no uploaded item/image. The icon is a separate confirmed missing requirement. Its causal relationship to detail persistence remains unproven.
- Prepared a local generic AI TEST SVG icon and accurate CRUD test-description draft under the handoff entry's artifacts/feishu directory. SVG is 256 by 256, 685 bytes, XML-validated with only svg/title/rect/text elements and no scripts or external references. No upload has occurred and visual rendering was not verified. Exact local asset path is in the ignored test manifest.
- Next action requires approval to upload that nonsensitive test icon to this existing test plugin. Then confirm persisted icon and retry details once against the now-complete icon prerequisite. Do not repeatedly type/reload while leaving a known required field empty; do not represent permission setup as publication.
- No business code, extra permission, credential, creator record, release or installation was changed. Basic information is retained for continuation. The three permission grants remain the previous verified state, not newly reapplied in this follow-up.

## User Request And Boundary

- The user approved the previously explained read request and explicitly asked for create, update and delete permissions too. Read-only is no longer the intended final permission configuration.
- This authorizes preparing those permission requests, not modifying existing real records, deleting data, advancing workflows, reading secrets, publishing to the store or declaring integration complete. The [prelaunch policy](FEISHU_PRELAUNCH_TEST_POLICY.md) still applies to actual test operations.
- Before any expanded grant, disclose the additional capabilities contained in the platform groups and obtain action-time confirmation. Target-space data authorization remains a separate administrator step; the debug selector is still unselected.

## Verified UI Scope

All three rows showed not enabled during the initial inspection before the explicit confirmation and grant above:

| Group | Identifier | Observed boundary |
| --- | --- | --- |
| Read work-item information | `work_item:work_item.v2.info:read` | Row/status rechecked; broader metadata/details/attachments coverage was inspected on September 15, not reopened today. |
| Update work-item data | `work_item:work_item.v2.info:write` | Includes create and update, but also batch update, status transitions, node/subtask completion or rollback, terminate/resume, freeze/unfreeze, related-item binding, work logs, attachments and adding a bot to a group. |
| Delete work-item data | `work_item:work_item.v2.info:delete` | Includes deletion of work items, attachments, subtasks and work logs. |

The write popover listed 22 APIs; the delete popover listed four. The interface exposes group-level acquisition buttons, not per-API switches. Do not describe these groups as granting only one form's fields or only marked test records.

Visible official links included [Create Work Item](https://project.feishu.cn/b/helpcenter/1p8d7djs/6c8et3fg), [Update Work Item](https://project.feishu.cn/b/helpcenter/1p8d7djs/3e73r2k5), and [Delete Work Item](https://project.feishu.cn/b/helpcenter/1p8d7djs/2f5xepox). These are observed links, not newly read article bodies. Public web search/open did not retrieve article contents in this check; API request schemas are not verified by this report.

## Actions And Next Gate

- Only opened View API popovers. An initial read-only click was rejected because the approval connection disconnected; no alternate control path was used. A fresh read-only accessibility check confirmed unchanged page, labels and permission state, then one retry of the same View API button succeeded. This is not a Feishu permission-denied result.
- No Get Permission or Batch Acquire button was pressed. No permission group, data scope, owner, collaborator, credential, name or description was changed. No version, installation, message or creator record was created.
- Next: confirm the three full groups with their additional powers disclosed; then inspect the actual acquisition dialog and submit only those approved groups. Stop for unexpected scopes or legal terms. Do not add user/space/settings/comment/view permissions.
- If expanded permissions are acquired, the existing read-only name and short description must be corrected while retaining the original AI-test marker and batch. Required rich-details persistence remains unresolved from September 15; it was not retested here. The name must not falsely promise read-only access after expansion.
- Restrict any eventual client write paths to explicitly approved operations and test objects, with preview/confirmation and exact-manifest cleanup. This is a required implementation boundary, not an existing technical enforcement claim. Permission availability is not implementation or live acceptance.

## Local Verification Boundary

Both Git statuses were rechecked: source dirty main, ahead of cached origin/main by two; entry master without commits. No fetch. Local changes are memory only; business tests, installed-app behavior and services were not exercised. Secrets and creator data were not read or recorded.
