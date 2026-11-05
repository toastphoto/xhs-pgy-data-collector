# Feishu Workbench UI Audit

Checked 2026-09-30. Target: actual Windows main-product Review/Outreach page.
Native observation was the earlier running 0.1.57 directory build, not the
installed 0.1.55 or a colleague's machine. Preserve its live session.

## Observed Steps

1. Connected main page: visible connection success, 27 fields; collapsed
   credential settings. Query remains disabled without a selected creator and
   checked account identity. No real lookup performed in this audit.
2. Expanded create mode: identity, contact, platform, source, URL and note
   fields were present, but arrived in metadata order. Preview was below the
   long form. No preview/confirmation/write submitted.
3. Switched update mode: selection of software-created records is required;
   no real target chosen or changed.
4. Refreshed the local creation manifest, then inspected cleanup mode: zero
   entries, no selectable target, disabled cleanup preview. No deletion.
   Restored create mode and collapsed the write section afterward.

Health: basic controls and mutation prerequisites are present, but the task is
not production-accepted. A connected label is not contact or CRUD acceptance.

## Evidence And Findings

Accepted native screenshots were saved and inspected locally in the handoff
entry's Git-ignored `artifacts/feishu/ui-audit-20260930/` directory:
`01-connected-main.png`, `02-create-form.png`, `03-cleanup-empty.png`.
Do not commit them, private configuration, or contact values.

- P2: create/update/cleanup hidden behind a folded section and a dropdown;
  users can miss entire operation modes. Source now uses explicit accessible
  tabs, with keyboard navigation and distinct cleanup selection.
- P2: disabled query/preview still looked actionable; source now gives disabled
  controls a neutral style and gives empty creator/record lists visible states.
- P2: required identity fields followed incidental metadata order. Source now
  groups nickname/account/platform/source/contact first and uses a full-width
  note textarea. Matching options and backend allowlists remain unchanged.
- P2: a run change retained account, target record and safety confirmation.
  Source now clears row-dependent authority/drafts while keeping the session.
- P2: session expiry could leave a misleading connected UI. Added a safe
  check-connection button using the existing status IPC and clear expired UI.
- P3: native topbar Open text wrapped vertically. Scoped non-shrinking button
  width/no-wrap fix; no splitter or BrowserView geometry change.

Existing controls include connect/disconnect, query, confirmed local fill,
create/update/cleanup previews and confirmations, manifest refresh, and
read-only reconciliation. Only safe mode switching/empty-manifest refresh were
exercised here. Conditional confirmations cannot be accepted from their source
existence alone.

Still missing/unaccepted: persistent reconnect, daily-batch sync with per-row
results, invitation-only contact mapping, direct project opening from this
section, and main-product real lookup/fill/create/update/cleanup acceptance.
Do not add nonfunctional buttons or silently mutate team-library records.

## New Source And Artifact Evidence

- Source version 0.1.58. Existing full pretest/test chain passed after UI edits;
  four renderer state regressions also passed and were added to pretest.
- 102 focused Feishu regressions passed, including run reset, no transport on
  mode switch, target-selection rerender and expired-session controls.
- Updated Playwright source UI script has NOT been run for this change.
  User approval for isolated browser layout regression is pending; old
  400/650/950 screenshots do not validate the new layout.
- Windows dir build `desktop-app/dist-feishu-0.1.58/win-unpacked/` succeeded.
  Version, five source/ASAR matches, bundled backend/Python and exclusion of
  root tests/scripts/prior builds were checked.
- ASAR SHA256:
  `23ecfa4cc7dda1bb372b9fa52ab91934b6b7d4cdc69ac4c9328dc394eaeb6d5a`.
  Recheck after any later build.
- New artifact has not been opened/installed; running 0.1.57 remains unchanged.
  No installer, remote write/delete/send, commit, push or Release upload.

Next: authorized isolated visual regression, actual new artifact inspection,
then the separately confirmed real workflow gates in DELIVERY_GATES_2026-09-30.md.
