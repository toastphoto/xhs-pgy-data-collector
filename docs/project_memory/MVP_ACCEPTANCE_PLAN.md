# MVP Acceptance Plan

Last reviewed: 2026-07-07.

## Purpose

This file defines what "usable MVP" means for the Pugongying creator workbench. It is intentionally stricter than "code runs locally" and weaker than "production product." Use it to decide whether the current build is ready for internal operator trial.

## MVP Boundary

The MVP is an internal Electron workbench for:

1. Opening Pugongying with manual login and manual search.
2. Importing or reading candidate creators into a local candidate pool.
3. Running conservative, serial creator collection from approved Pugongying URLs.
4. Reviewing collected creators and exporting contact workbooks.
5. Routing contact rows into Pugongying invite, email, XiaoMiFeng/WeChat, or missing-contact sheets.

The MVP is not:

- A Chrome extension.
- A generic RPA tool.
- A captcha/risk-control bypass tool.
- An automatic email sender.
- An automatic Pugongying invite sender.
- A WeChat automation controller.

## Acceptance Gates

### Gate 1: Local Build And Tests

Required before any operator trial:

- `desktop-app && npm test` passes.
- `python3 scripts/verify_project_memory.py` passes.
- `python3 scripts/audit_pgy_safety.py` passes.
- `git diff --check` passes.
- `node -c` passes for changed renderer/main JS files.

### Gate 2: Product Flow Completeness

Required before calling it a usable MVP:

- Start page clearly points to the main flow.
- Find-creators page supports imported links/table and Pugongying search-page intake.
- Candidate pool supports review before collection.
- Collection refuses non-Pugongying task URLs.
- Collection uses conservative presets only.
- Review/export page can generate:
  - `建联概览`
  - `建联表`
  - `蒲公英邀约表`
  - `邮件建联表`
  - `小蜜蜂导入表`
  - `待补联系方式`
- Edited contact workbook can be imported back without losing review state.

### Gate 3: Safety And Risk Controls

Required before normal internal use:

- Manual login and manual search remain the normal path.
- No stealth/fingerprint/proxy/headless/high-concurrency behavior is enabled by default.
- Risk-control visible text stops or pauses automation.
- Batch limits and cooldown remain enforced.
- A sanitized live validation record passes `scripts/validate_pgy_live_validation.py`.

### Gate 4: Real Workflow Trial

Required before telling operators to use it routinely:

- One 3-5 creator real-account trial passes.
- One 10 creator real-account trial passes.
- Exported workbook is reviewed by the user or an operator.
- At least one edited workbook import is tested.
- Issues are recorded without committing private links, screenshots, cookies, task sheets, or account data.

## Current Assessment

As of 2026-07-07, the project should be described as:

> Internal MVP candidate / advanced prototype. Core local workflow exists, but it still needs real-account validation and operator workflow review before being called delivered.

## Recommended Next Work

1. Run `python3 scripts/check_mvp_readiness.py`.
2. Fix any static readiness failures.
3. Start the app and run the runtime safety probe.
4. Prepare a sanitized live validation record.
5. Run the 3-5 creator trial, then the 10 creator trial.
6. Use the exported workbook in a real review/import loop.
7. Only after those pass, describe the tool as "usable MVP for internal trial."
