# Project Memory

This directory is the repository-local memory layer for future AI/helper threads and long-term maintenance. It should contain durable project facts, decisions, and handoff cues that are safer than relying on old chat context.

## Files

- `README.md`: purpose, file map, and update rules for project memory.
- `ACTIVE_CONTEXT.md`: current project state, recent milestones, volatile facts to recheck, and recommended next steps.
- `DECISIONS.md`: important decisions, reasons, impact, and when to revisit them.
- `HANDOFF_TEMPLATE.md`: short copyable template for starting a new continuation thread.
- `PRODUCT_ARCHITECTURE_ROADMAP.md`: durable product-chain direction, external RPA/plugin assessment, and staged refactor plan.
- `UX_REDESIGN_PLAN.md`: product-level UI/UX blueprint for the Electron workbench, including progressive disclosure, flow-first navigation, bulk-action rules, and list/detail patterns.
- `PGY_ANTI_BOT_SAFETY_AUDIT.md`: Pugongying anti-bot/risk-control safety audit, conservative operation rules, and live-validation checklist.
- `PGY_LIVE_VALIDATION_PROTOCOL.md`: sanitized real-account validation protocol and required evidence format for 3-5 creator and 10 creator safety checks.
- `MVP_ACCEPTANCE_PLAN.md`: usable internal MVP definition, acceptance gates, and delivery boundary.
- `../../AGENTS.md`: top-level entry point for helpers entering the repo.
- `../../scripts/verify_project_memory.py`: validation script for required memory files, required links, and obvious secret shapes.
- `../../scripts/audit_pgy_safety.py`: validation script for conservative Pugongying collection safety invariants.
- `../../scripts/probe_pgy_runtime_safety.py`: runtime probe that checks the running backend keeps proxy/headless off, legacy crawl API disabled, and the old crawler root page disabled.
- `../../scripts/prepare_pgy_live_validation.py`: creates a sanitized real-account validation JSON template with current branch, process ids, static audit, and runtime probe prefilled.
- `../../scripts/validate_pgy_live_validation.py`: validation script for sanitized real-account safety validation JSON records.
- `../../scripts/test_pgy_live_validation.py`: focused tests for the live-validation record checker.
- `../../scripts/check_mvp_readiness.py`: readiness checker for static/local MVP gates and remaining blockers.

## Update Rules

- Write reusable facts, not chat transcripts.
- Keep entries concise and dated when the timing matters.
- Mark volatile facts as "needs recheck" instead of presenting them as permanent.
- Never include real keys, cookies, private account data, private creator lists, or task spreadsheets.
- Prefer links to repository files over copying long code or docs.
- Run `python scripts/verify_project_memory.py` after editing memory files.
- Use `python scripts/check_mvp_readiness.py` before claiming the app is ready for internal operator trial.
