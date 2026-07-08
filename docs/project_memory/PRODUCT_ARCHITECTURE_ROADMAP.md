# Product Architecture Roadmap

Last reviewed: 2026-06-30. Recheck vendor packages, manuals, and live tool behavior before treating any integration detail as current.

## Product Direction

Build the project as a simple creator discovery and contact-list workbench, not as a bundle of disconnected RPA scripts or browser extensions.

The durable center should be the Electron desktop app in `desktop-app/`. External automation tools should be treated as replaceable action executors:

- Electron app: task cockpit, data model, operator UI, evidence, quality reports, exports, and local execution history.
- Pugongying-focused collection flow: find creators, capture useful fields, review/filter, and produce contact tables.
- WeChat RPA: optional downstream execution channel that can consume an Excel contact table.
- Lark Base/Feishu project: optional collaboration layer, review table, and status sync target.

Do not build a Chrome browser extension for this project. The Chrome/Automa vendor package is reference material only.

## What The External Manuals Show

The Feishu "creator signing Copilot" manuals describe a complete business chain:

- Create a signing task.
- Search creators through Pugongying and Xiaohongshu.
- View a creator list and detail table.
- Manually exclude creators.
- Start Pugongying invitation.
- Generate WeChat contact Excel for RPA.
- Track Pugongying, WeChat, and email reply status.
- View execution records and manually trigger status tracking.
- Reset stuck workflow state.

This product workflow is valuable, but this project should simplify it. The near-term focus is not a full multi-channel automation suite; it is making the Pugongying creator discovery and contact-table workflow easy for operators.

## Current External Implementation Shape

Automa Hosted Chrome package:

- Packaged Chrome extension artifact, not maintainable source.
- No `src/`, `package.json`, TypeScript/Vue files, or source maps were found in the inspected package.
- Business workflows are likely in hosted workflow JSON, Chrome storage, or remote service configuration.
- Useful only as product/process reference. Do not implement or depend on a Chrome extension route.

XiaoMiFeng WeChat RPA package:

- Packaged Windows desktop application, not source.
- Inspected package at `/Users/workstudio/Downloads/小蜜蜂RPA系统4_20260528/`.
- About 359 MB, .NET Framework 4.8 GUI executable, WPF/.NET dependency set.
- Uses FlaUI-style UI automation, SQLite/SqlSugar, NPOI Excel handling, PaddleOCR/OpenCV-related components.
- Useful as a possible downstream consumer for contact-list Excel files if template import and result export can be verified.

All package details above are inspection snapshots and need recheck when the vendor package changes.

## RPA Limits To Design Around

RPA is useful for UI-only systems, but it should not become the system of record.

Expected limits:

- Slow execution because it operates through visible UI steps.
- Fragile selectors and visual recognition when target apps update.
- Strong dependency on OS, screen state, permissions, focus, popups, and antivirus/security tools.
- Harder debugging unless every action writes structured logs and screenshots.
- Account and platform risk controls can pause or block automation.
- Hard to scale safely across accounts without rate limits and queue governance.

Design implication: keep RPA outside the core workflow. The app should produce clean, reusable contact tables first. RPA integration should start as export/import compatibility, not direct control.

## Better Architecture

Use a layered model:

1. Task model
   - Signing task, search criteria, contact plan, channel choices, owner, status, and notes.

2. Creator model
   - Creator identity, source channel, Pugongying URL, Xiaohongshu ID, metrics, price fields, tags, exclusion status, and evidence.

3. Execution model
   - Every search/export/status-tracking run becomes an execution record with inputs, outputs, quality summary, errors, screenshots, and run directory.

4. Contact-table model
   - Reviewable selected creators, contact channel, contact copy, tags/groups, owner, exclusion reason, and export status.

5. Collaboration sync
   - Export to Excel first.
   - Later sync to Lark Base/Feishu project once local state is stable.

## Refactor Plan

Phase 1: Stabilize local workbench

- Keep Electron app as mainline.
- Continue extracting task, execution, and report logic into testable modules.
- Make saved task templates and execution records first-class UI objects.
- Add per-creator quality detail and exclusion reason fields.
- Make the Pugongying creator discovery workflow easier to operate than the vendor flow.

Phase 2: Build contact-list workflow

- Add a clear selected-creator/contact-list view.
- Support manual include/exclude and exclusion reasons.
- Generate a standard internal contact table from reviewed creators.
- Keep the table useful even when no RPA tool is available.

Phase 3: Add XiaoMiFeng-compatible Excel

- Collect a sanitized XiaoMiFeng import Excel template.
- Collect a sanitized execution result export or local DB schema sample.
- Build export mapping from selected creators to XiaoMiFeng template.
- Build optional result import mapping back into creator contact status.
- Do not depend on direct DB writes until the schema and version stability are verified.

Phase 4: Add Lark collaboration sync

- Map local task, creator, and execution records into Lark Base tables.
- Sync only sanitized business fields, never cookies or browser profile data.
- Make sync explicit and inspectable before any automatic write-back.

Phase 5: Evaluate deeper automation

- Only after stable local records and contact-table exports, evaluate whether deeper automation can reduce manual steps.
- Do not build a Chrome extension path unless the product direction is explicitly changed later.

## Vendor Evidence To Request

For Automa/Feishu workflow:

- Workflow export JSON for each hosted workflow.
- Workflow IDs, activation/version policy, and update process.
- Backend service source or API docs if hosted services are used.
- Feishu Base/table schema and status field definitions.
- Execution logs and failure examples.
- These are reference materials only; they should not become a Chrome extension requirement.

For XiaoMiFeng WeChat RPA:

- Import Excel template.
- Result export sample.
- Local database schema documentation or sanitized sample.
- Whether command-line start, API trigger, or scheduled execution is supported.
- Version/update policy and activation/machine-binding rules.
- Practical limits: per-account daily add count, recommended interval, retry/failure handling.

## Near-Term Recommendation

Do not rebuild the product around XiaoMiFeng, Automa, or a Chrome extension.

Use this project as the main application chain:

```text
Electron task cockpit
-> Pugongying creator discovery
-> quality report and creator review
-> selected contact list
-> export internal contact table
-> optional XiaoMiFeng-compatible Excel
-> optional result import/status sync
```

The next technical target should be the contact-list workflow plus a XiaoMiFeng-compatible Excel export. This gives immediate business value without binding the core product to one fragile RPA package.
