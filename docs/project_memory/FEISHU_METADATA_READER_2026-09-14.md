# Feishu Metadata Reader: Local Preparation

Date: 2026-09-14. Source and offline regression evidence only; no live API acceptance.

## Implemented

- `desktop-app/lib/feishu_project_metadata.js` exposes a reader for the documented metadata GET only. It is not wired to Electron IPC, renderer buttons or automatic startup.
- Target project/type are explicit validated inputs. Origin is fixed to the currently requested Feishu Project host; there is no arbitrary request, write, delete or automatic retry method.
- A trusted main-process credential provider supplies the current plugin/user credential per call. Plugin mode requires user identity and strict read authorization mode. No Cookie borrowing, environment discovery, credential persistence, token issuance or configuration UI is implemented.
- Requests reject redirects, omit browser credentials, use no-store and bound response size to 2 MiB. The total timeout includes credentials, transport and body reads; cancellation prevents a late credential result from starting a request.
- HTTP errors, API business errors, malformed/inconsistent bodies and invalid metadata have distinct codes. Raw provider/transport exceptions and remote error text are not exposed, because they may contain private data.
- Field defaults/options are returned without applying or coercing them. Required, optional, conditional and unknown states stay distinct; duplicate field keys are rejected. This does not evaluate conditional rules or authorize creation.

## Verification

- All 24 cases in `node --test tests/feishu_project_metadata.test.js` passed using injected in-memory responses. No test used real credentials, made a network request or controlled a browser.
- Added this test to the existing pretest script, preserving all earlier commands. The complete current pretest and test chains passed using the installed bundled Node runtime; no dependencies or version were changed.
- Coverage: exact GET destination, plugin/user separation, per-call credentials, invalid targets and headers, redirects, HTTP 401/403/429/500, business errors in HTTP 200, incorrect auth envelopes, metadata structure, conditional flags, zero/default preservation, bounded bodies, timeout, cancellation and late credentials.
- Existing collection, invitation, layout, review and export regressions passed. This is not installed-app, account or workflow acceptance.

## Still Required

1. Confirm an existing Feishu Project plugin and authorized data scope, with credentials configured locally through an approved secure mechanism. Do not send long-lived secrets through chat or bundle them in a distributed EXE.
2. Only after authorization, call the real metadata endpoint and reconcile current schema, enum values and conditional requirements. An empty field list is not proof of integration readiness.
3. Implement reviewed contact lookup/matching and user preview independently of the old six-table/upsert envelope. Do not auto-apply contact-count, ownership or workflow defaults.
4. Verify creation side effects and exact cleanup permissions before implementing or enabling marked test writes. Follow [prelaunch policy](FEISHU_PRELAUNCH_TEST_POLICY.md).

At implementation time the browser continuation was rejected when the approval service connection ended; no alternative route bypassed that rejection. A later explicitly approved read-only retry succeeded: Open Platform Application Management showed no visible apps under All. See [updated inspection](FEISHU_LIVE_INSPECTION_2026-09-14.md). This is not proof of tenant-wide absence or API authorization, and no credentials or configurations were read/changed during that follow-up.

No application wiring, business API calls, business writes, installer, installation, commit, push or release occurred.
