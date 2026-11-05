# Resource Export Repair

Date: 2026-09-14. Source-only changes; existing invitation/layout edits preserved.

## Confirmed Causes

- The top resource export omitted selected columns. The lower export passed them, but both paths removed all-empty columns.
- Resource mapping read exact Chinese metric keys, missing existing summary followers/prices and known median aliases used elsewhere.
- ExcelJS writing was not awaited. A deferred-writer reproduction returned success while the file was still pending.
- A synthetic original-code sample selected nickname, followers and image price with populated summary values; only nickname survived and two columns were dropped. This reproduces a code defect, not the colleague's exact data state.

## Changed Behavior

- One top resource action exports the current column checks. Adjacent native details/summary defaults closed and preserves open state during rerenders.
- Explicit columns, including missing measurements, remain in the workbook; success reports retained empty fields. Unchecked columns are excluded. Empty/invalid selections fail.
- Documented summary/metric aliases and numeric zero are preserved. No freeform note parsing, account changes or fabricated values.
- Writer completion is awaited; writer/preset failures are visible, repeated requests are blocked, and run/columns are captured before asynchronous work. Column-load failure can be retried using the existing refresh action.
- Raw-detail and contact-export behavior, account partitions, collection, pagination and invitation confirmation are unchanged.

## Verification

- Existing `package.json` pretest/test chains passed with bundled Node. npm was unavailable; the scripts were executed unchanged using Node child_process, without reinstalling dependencies.
- Nine resource regressions cover real ExcelJS and SheetJS write/read round trips, aliases/zero/empty headers, invalid selections, deferred/rejected writes, collapsed settings, frozen request context, duplicate clicks and preset/load failures.
- `tests/resource_export.ui.test.js` used installed Chrome in a headless temporary profile with all requests intercepted to a local fixture. Actual toolbar source/CSS passed click, uncheck, export and collapse checks at 400/650/950 px; no horizontal overflow, clipped controls or page errors. Screenshots were reviewed at 400/650 px.
- Reproduce the optional UI test with Playwright available on NODE_PATH and CHROME_PATH pointing to an approved installed browser; run `node tests/resource_export.ui.test.js` from desktop-app. This is not a user-profile or full Electron test.

## Pending

- Obtain sanitized raw collection output for the colleague's failing batch before claiming exactly which measurements exist in that batch.
- Build/install and verify the revised controls in Electron, then export that same batch and compare stored values with the workbook.
- No installer was rebuilt, no real account was accessed, and no commit, push or release was made. Earlier installer hashes do not contain this repair.
