# Same-Batch Unsent Preparation

## Scope

User explicitly requires consecutive preparation in ONE batch, without stopping/restarting each creator, and forbids final send. Prior0.1.94 live checks were separate stop/restart checks and do not satisfy this requirement.

## Implementation0.1.95

- Add `不发送，准备下一位` only while awaiting send confirmation; final recipient uses `不发送，完成本批准备`.
- Advance the same batch id/index/results through the existing5-second cooldown. Record `unsent` separately; never call sent/manual/skipped bookkeeping for it, never deselect or mark contacted, and remove the current renderer prepared-send payload.
- An unknown send result, failed preparation, sending or stopped state cannot use unsent-next. Existing send confirmation, risk/target checks and stop/edit ownership remain unchanged.
- Completion reports successful sends/manual/skips/unsent separately. Previously prepared pages must be prepared again before future sending; this is not a claim that multiple live forms remain open.

## Verification

-49 batch tests PASS, full configured pretest7/test42 commands PASS, safety audit and diff check PASS.
- Independent bounded review found two test-only issues, not a confirmed runtime regression: stale cumulative confirmation count in scroll fixture and token assertions at the wrong object level. Corrected to a phase-relative count and missing `.prepared`, with a post-completion send rejection assertion.49 tests passed again.
- First native artifact run `pgy-invite-flow-gAiNhT` passed3 unsent in one batch/zero clicks/one start/selection preservation and original3-send fixture, then failed stale scroll confirmation count5vs4. Final same-artifact rerun `pgy-invite-flow-NJOz3d/result.json` PASS:3 direct,3 unsent/one batch start/zero clicks/selection retained,3 original confirmed-send fixtures, missing-commit recovery, slow input/persistence/template creation/save-as,100-row scroll8298/outer1832 stable, drag/reload/three zoom levels. All fictional requests intercepted; this is not real-send evidence.
- Candidate `dist-invite-unsent-0195-final`: installer109721757 bytes/SHA256222a64dde9351f21b18175b84de0211283999fdb831898ee1d64d7100a297949; ASAR44d0095e9bbc39c8ec2e7f6b241b6decdd7d7e07b7ea1ed80484c86f3be211d1.72 application assets/115 backend files match source; Python bundled, unsigned. Test-only corrections do not change packaged runtime.
- User approved normal close/preserved-data installation after native regression passes. Installed ASAR exactly matches the above hash; visible0.1.95/service normal. Normal close of0194 observed, installer launched, installer window exited and new app appeared before the next capture. No profile/data manipulation. Original run/five rows/two selections/test template and dates retained.

## Real Same-Batch Acceptance

- Started ONE actual two-recipient batch from the batch button and accepted ONE startup confirmation; saved invitation login worked. No collection-account viewing or individual-open prerequisite.
- First actual recipient opened/filled and reached awaiting-confirmation at1/2. Readback matched brand/product/synthetic contact/marked intro/start/end dates.
- Clicked only `不发送，准备下一位`. The same active batch advanced through its interval to2/2, displayed processed1/2, automatically opened and filled the second actual recipient. No stop, restart, reselection or manual-send-completion click occurred.
- Second form readback matched the draft. Clicked only `不发送，完成本批准备`; final status showed processed2/2, successful0/manual0/skipped0/prepared-unsent2. Original two checkboxes remained checked and both visible followup chips remained pending contact. The second row explicitly displayed prepared-but-unsent/reprepare-before-send.
- No final webpage or software send action, no Feishu mutation, commit or push. App left open on second unsent form with the batch completed. Test template remains explicitly marked, original formal/default untouched. Account/page state is time-sensitive; recheck before future operations.
- Acceptance is bounded to these two consecutive real unsent preparations. It does not prove real sending, arbitrary50-person reliability or that multiple forms are retained simultaneously.
