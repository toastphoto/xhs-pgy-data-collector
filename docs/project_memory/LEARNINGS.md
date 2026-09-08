# Learnings

Last reviewed: 2026-09-04.

All entries recorded through 2026-09-02 were reviewed. Stable, reusable rules were consolidated into `AGENTS.md`; architectural and product rationale remains in `DECISIONS.md`. The absorbed entries were removed after this review.

Record new material mistakes or user corrections below. Keep each entry concise and include the pitfall, correct practice, and reusable impact. Do not include secrets, private data, account state, or long chat excerpts.

## 2026-09-07: Do Not Describe An Aligned Workflow As An Implemented Control

- Pitfall: Product alignment was summarized without leading with the fact that the requested batch button did not yet exist, so the user reasonably interpreted the description as a delivered interface.
- Correct practice: Separate `agreed behavior`, `implemented source`, `packaged artifact`, and `installed/live-validated behavior` in every status report. Name missing controls directly.
- Reusable impact: Never let a precise future-state description imply current availability.

## 2026-09-07: Conditional UI Requires A Real Rerender Test

- Pitfall: Channel-specific append conditions were correct in source, but the existing tab handler only toggled composer panels and did not rerender the lower action surface.
- Correct practice: When a state variable controls DOM construction, update the store or otherwise rerender that subtree on state change. Test the actual visible button set after every tab transition.
- Reusable impact: Source-contract assertions are insufficient for stateful renderer changes; pair them with an interaction-level visibility check.
