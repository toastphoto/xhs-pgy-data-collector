# Feishu Production Creation - 2026-10-15

## Human Scope

- Explicit production request: new records use only the creator nickname, without AI-test markers or a test timestamp. Fill the contact-establishment time at submission. Allow missing contacts for later completion.
- Human explicitly declined changing Feishu configuration. Do not disable platform required-field validation, invent a contact, alter old cloud records, or use unmarked production records for testing.
- This turn only changes local code and builds an installer. No cloud create/update/delete, invitation send, installation, commit or push occurred. Native readonly inspection observed installed0.1.86 connected; do not infer0.1.88 installation or live acceptance.

## Implementation

- Fresh UI defaults to explicit production creation; AI-test mode remains separate. Backend callers omitting mode retain the old test behavior. Mode changes revoke previews and approvals, including obsolete checkbox events after a change-back.
- Production titles have no marker/batch prefix. Internal SYNC batches remain local audit metadata. Existing test names and their ownership proofs are not rewritten.
- Recognize exactly one date field named `建联时间`, `建连时间`, `建联日期` or `建连日期`. Generate its millisecond timestamp to second precision immediately before dispatch, persist the expected value before sending, and read back that exact field/value and the selected maintainer. Missing/ambiguous/unsupported schema rejects before a write.
- Production empty contacts are omitted only when current creation metadata explicitly marks the mapped field optional (`is_required=2`). Required, conditional or unknown metadata returns FEISHU_CONTACT_REQUIRED_BY_PROJECT. `required_mode:1` remains unchanged; other mandatory fields are still checked. Nonempty placeholder strings are not contacts.
- Same platform/account/current-maintainer deduplication spans test and production modes. Unknown production results with no acknowledged ID cannot be claimed by nickname or automatically retried.
- Production entries are explicitly excluded from test update/delete/manual cleanup/absence retirement/history archive, even if their titles resemble AI-test names. Known-ID uncertain results may be reconciled readonly. Existing tests retain their original guarded lifecycle.

## Evidence

- Final scoped production regressions15/15 passed; complete source pretest7/7 and test42/42 commands passed with Chrome enabled. Real Chrome fixture UI covers production empty contacts, automatic-time display, two-row confirmation, mode defaults and widths950/650/400 without page overflow; legacy test-mode lifecycle also passes. These are isolated fixtures, not cloud acceptance.
- Independent readonly final review found no remaining P1/P2 within the reviewed scope; backend/dedup/history/IPC243/243 and94 extra in-memory pressure assertions passed. Earlier review caught stale mode confirmation and nonempty placeholder bypass; both have regression coverage.
- Version0.1.88 candidate: `desktop-app/dist-feishu-production-0188-final/`.
- Installer109708439 bytes, SHA256 `52e36a5f590aaf379a0e3b5a3cad5e8e24b5bd07645180aab0ea7170dc661b31`.
- ASAR62146278 bytes, SHA256 `16b748b1f345d6ec0b03badc10e5024fc9a8ca397a4af679064c89765e16ea02`.
- All72 nondependency app/runtime metadata assets and115 bundled backend files match source/build output; Python312 DLL present. Installer NotSigned. No new credentials or operator profiles are embedded.
- Final packaged isolated invitation regression passed:3 direct creator preparations and3 batch preparations, replay rejection,2 departing-creator and6 departing-form history events, mouse/keyboard splitter changes, reload persistence and75/100/125 percent zoom alignment. All sends clicked fictional local buttons only; no real invitations or production profiles.
- Source and entry project-memory verification passed, entry verifier unit tests8/8 passed, and PGY safety audit passed.

## Protocol Evidence And Remaining Gates

- [Official field formats](https://project.feishu.cn/b/helpcenter/1p8d7djs/1tj6ggll#10fb2f8d): date and date-time both use API type `date` and numeric millisecond values. Day precision and second precision are different; published creation metadata has no verified precision discriminator.
- [Official create API](https://project.feishu.cn/b/helpcenter/1p8d7djs/6c8et3fg): required_mode0 skips all mandatory checks; keep1. [Creation metadata](https://project.feishu.cn/b/helpcenter/1p8d7djs/2jhqmwhn) documents required1/optional2/conditional3.
- Current target contact requirement and actual time-field precision/normalization were not verified against the new installed version. If the target is day-only and normalizes timestamps, keep the acknowledged ID and report a time-readback mismatch; do not guess a timezone, weaken comparison or automatically recreate it.
- Installation, real target metadata/time readback, colleague clean-machine validation and signing remain separate gates. Live tests must use marked test mode and an exact approved manifest. Production mode does not authorize an unscoped cloud write or deletion.
