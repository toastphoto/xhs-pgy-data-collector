# Invitation Loading And Brand Choice

## User Report And Evidence

User reports needing collection-account viewing before preparation and failure when the typed brand is not an exact match; no screenshot/error text was available. Do not assume that clicking the separate collection account initializes invitation state.

Source review found no collection-view dependency: persisted row targets and separate invitation partition are used. A new live check on installed0.1.95 directly prepared another existing real recipient with the marked synthetic test template, without collection viewing or final send. It succeeded, so the original reported incident remains unreplicated, not disproven.

A same-target reentry defect was reproduced RED in the actual main-handler VM: committed target proof plus still-loading main frame was rejected immediately.0.1.96 waits up to8seconds for that exact unchanged target to become idle; target/reload/view/destroy changes still stop, timeout clears document proof and stops loading. No collection navigation or cookie copying, no send retry. Delayed query/homepage handoffs remain separate unverified cases; do not relax send/read snapshots based on this fix.

## Brand Behavior

- Previously a650ms search wait could immediately return no-match; partial names never resolved even with options present. Now pending results are polled within the existing form budget, with up to10seconds for search.
- An exact match is still automatically selected and read back. Nonexact results pause at `awaiting_brand`/single-row brand selection, not a generic preparation error. Operator explicitly selects the canonical name, then the SAME batch/row continues and later recipients reuse that name. Saved formal message templates are not overwritten.
- Pending choices bind to current run/row/URL/template revision/batch. Stop/edit/replacement or unlisted choice cannot resume, and pending choices carry no send token. Final human send confirmation remains independent.
- Candidate extraction and exact click share the same scoped option parser. Prefer ARIA-owned roots, then local listbox, then a single geometrically associated portal. Merge nested root matches before checking ambiguity; reject multiple independent roots. Direct-text LI works. No first-result guessing or unrelated full-page option picking.

## Validation

-101 IPC regressions and57 batch tests passed, including delayed search, canonical-name same-batch resume, stale choices, risk stop and unchanged-target wait. Full configured pretest7/test42 commands passed; safety audit passed.
-18 isolated native DOM cases passed, including unrelated lists/direct LI/nested unlinked portal and existing live field readback. Fixture corrections preserved earlier failures: visible option placement, boolean normalization, duplicate lexical variable scope and scroll-to-field before positioning popup.
- Independent review found and confirmed fixes for candidate/click selector inconsistency, unrelated options and nested popup false ambiguity. Final bounded review reported no remaining confirmed P1/P2; it did not touch real accounts.
- Early native fixture9ABdWi failed malformed test event markup;6BwvHu passed brand choice/continuity then failed old expected handoff count10vs9. The intermediate reviewed artifact native f76Axm passed3 direct/brand choice after2s/3 unsent/3 send fixtures/100-row scroll/input/template/layout, but lacks final nested-root dedupe and is WITHHELD.

## Packaging And Remaining Gates

Concurrent UI work changed the source branch; retain it, do not reset to main. To avoid shipping unaccepted UI changes, use a temporary packaging stage from delivered0.1.95 ASAR, overlay only main.js/lib/pgy_invite.js/renderer/views/exports.js plus version0.1.96. All other72-asset inventory entries match the old delivered baseline;115 backend files/Python are retained. This stage is not a new business checkout.

Eligible final candidate ONLY `dist-invite-brand-0196-release`: installer109725610 bytes/SHA25617a70668fa7caea84b9b4a8b27280f0d2cc57eb7c38e27e16101de23e5467e26, ASARd7d91b3fe10c243427165ec48e4f2d732b793fba628a250d15581aab813fed8f, unsigned. `dist-invite-brand-0196-final` and `dist-invite-brand-0196-reviewed` are WITHHELD.

Final native rerun `pgy-invite-flow-iXi4MG/result.json` PASS on the exact release candidate:3 direct, delayed2s brand choices explicitly confirmed/canonical name/same batch,3 unsent(one start/zero clicks/selections retained),3 original send fixtures, original handoff recovery,18 DOM cases separately, slow typing/persistence/templates,100-row scroll8298/outer1832 unchanged, splitters/reload/three zooms. These are fictional local fixtures, not real sending. Complete7/42 commands and safety audit also passed after the final source correction.

Actual installed app remains0.1.95, left at a single unsent marked test form; selection/contact status unchanged. A fresh0196 preserved-data installation/real brand-choice validation question was sent and has no answer yet. No real final send, Feishu mutation, installation0196, commit/push/Release. Source/fixture success does not prove the original teammate failure resolved on their machine.
