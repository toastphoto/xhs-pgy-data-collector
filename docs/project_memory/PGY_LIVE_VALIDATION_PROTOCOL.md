# Pugongying Live Safety Validation Protocol

Purpose: record whether the conservative Pugongying workflow behaves safely with a real account, without committing private creator links, cookies, account names, screenshots, or task spreadsheets.

This protocol does not try to prove the app is undetectable. It proves only that the current build was exercised in small real-account batches and that the app stopped or paused when risk-control signals appeared.

## When To Run

- Before telling teammates the workflow is safe enough for normal internal use.
- After changes to collection speed, batch limits, BrowserView automation, replay, template extraction, risk detection, proxy/headless behavior, or Pugongying login/search flow.
- After Pugongying visibly changes page structure, login behavior, or risk-control pages.

## Privacy Boundary

Do not store:

- Real Pugongying creator URLs.
- Account names, phone numbers, cookies, tokens, session ids, or QR codes.
- Screenshots that show private account details.
- Raw Excel task files or teammate contact data.

Allowed evidence:

- Batch size, preset, start/end time, and whether risk-control text appeared.
- Local run id and relative evidence directory, if screenshots are sanitized or kept local only.
- Short operator notes with no account or creator identifiers.

## Required Phases

1. Manual login and search preflight
   - Open Pugongying in the Electron BrowserView.
   - Log in manually.
   - Search/select creators manually.
   - Confirm no automated search pagination is used.

2. Small batch
   - Add 3-5 creators.
   - Run standard conservative mode.
   - Pass only if no risk-control page appears, or if a risk page appears and the app pauses before continuing.

3. Ten creator batch
   - Add exactly 10 creators.
   - Run standard conservative mode.
   - Pass only if no risk-control page appears, or if a risk page appears and the app pauses before continuing.

4. Risk-stop behavior
   - Confirm that visible login/captcha/safety/frequent-operation text causes pause/stop instead of continued automation.
   - This can be observed during a real run or checked with a controlled test page; note which one was used.

## Record Format

Use `scripts/prepare_pgy_live_validation.py` to create a sanitized JSON record with current branch, worktree note, Electron/backend PIDs, static safety audit result, and runtime safety probe result prefilled. Save actual records outside git or under an ignored local directory such as `tmp/`.

```bash
python3 scripts/prepare_pgy_live_validation.py --output tmp/pgy_live_validation_YYYYMMDD.json
```

Then the operator fills only the real-account fields: preflight, small batch, ten creator batch, risk-stop behavior, and final assessment. Do not paste account names, creator URLs, cookies, screenshots, or task sheet contents into the JSON.

The completed record must replace placeholders and include:

- `operator_alias`: a sanitized non-placeholder alias.
- `environment.network`: one of `office`, `home`, or `other`.
- `small_batch.started_at_local` and `ten_creator_batch.started_at_local`: local timestamps like `2026-07-02 10:00`.
- `small_batch.run_id_or_local_evidence_ref` and `ten_creator_batch.run_id_or_local_evidence_ref`: local-only run/evidence references, never URLs.
- `risk_stop_behavior.method`: either `real-risk-page` or `controlled-test-page`.
- `risk_stop_behavior.risk_text_seen`: the visible risk text used to confirm pause/stop behavior, with no account or creator identifiers.

Validate a completed record with:

```bash
python3 scripts/validate_pgy_live_validation.py tmp/pgy_live_validation_YYYYMMDD.json
```

The validator rejects obvious secrets, URLs, placeholders, missing timestamps, missing local evidence refs, and missing phase evidence. A passing JSON record is still not a guarantee that future Pugongying runs will never be flagged; it is current evidence for the tested account, date, and build.

`scripts/validate_pgy_live_validation.py --print-template` remains available for inspecting the schema, but the preferred path is the prepare script because it proves the local safety prechecks were actually run before live testing.
