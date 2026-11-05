# Interrupted Task Recovery 0.1.113

User scope: make the old task visible; restore paused, stop directly without Resume, then allow a new collection; provide a Windows installer. No installation, account operations or publication requested this turn.

## Fix

- The recovered runner has no active loop. The previous stop method only queued a request for a nonexistent loop. Stop now finalizes directly at this idle safe point; the ordinary running-loop path is unchanged.
- Shared finalization saves terminal task state before clearing the active-run boundary. Failed persistence stays recoverable/retryable, including restart between the two writes. Completed evidence remains; unexecuted entries become skipped.
- Readonly task snapshots expose the interrupted run before Start. The task page begins with its name, last save, progress and Restore button; after restore it offers Stop Old Task and View Queue. Reload fetches state even if the initial push was missed.
- Existing five-minute batch spacing is preserved and the next start time is visible. New Start also waits for an existing loop to finish its cleanup.

## Verification

- Five focused tests: restore/stop/no page access/results retained/new start after cooldown; discoverability; task/cooldown persistence failure; restart/retry. Added to npm test.
- Existing configured pretest/test plus focused command: 50 commands passed. Initial sandbox run failed filesystem save tests; identical suite under normal Windows permissions passed. No production storage logic was relaxed.
- Exact final packaged executable with a fresh temporary profile: top entry visible before Start, recovery paused, direct Stop without Resume and zero page requests, result file retained, reload shows no stale lock, new batch starts from the UI and navigates to its own local target after test-clock advancement, normal Stop succeeds. External networking and backend disabled. This validates local control/IPC, not real-account extraction or invitation sending.
- Native screenshots checked at 1080 and 1384 window widths. First candidate exposed inherited grid styling that squeezed the heading/buttons; fixed to explicit flex layout, rebuilt, and reran final native flow. First test used a newer sidebar selector absent from baseline105; corrected test selector, no product workaround.

## Artifact

Built from the exact delivered0.1.105 ASAR and unchanged bundled backend. Only five ASAR entries differ across2072 files: task_runner.js, tasks view, preload, main task snapshot wiring, package version. Pending112 UI/service work is preserved in source but excluded from this narrowly scoped installer. Source package remains112; deliverable113 is the frozen hotfix artifact, not a whole-worktree release.

Local artifact directory: `C:/Users/feibo/Documents/ChatGPT/小红书蒲公英工具/artifacts/task-recovery-01113/`.

- Deliver only `dist-final/小红书相关信息采集工具-0.1.113-windows-x64-setup.exe`.
- Bytes:109728690; SHA256:`0e333577756f709a5a7fdb67f5b579a25d1850105f441bf5d843a7bfce77cf80`.
- ASAR SHA256:`a75131da999ab3b9180f892cf14f519381ec5f23686bb5fd73e02322e5f7325e`.
- Extracted the final NSIS payload without installation: embedded ASAR hash matches the tested executable's ASAR. All146 backend/resource files match baseline105. Both memory verifiers and PGY safety audit passed; entry memory tests require normal filesystem permissions.
- Intermediate `dist` and `dist-reviewed` are rejected/superseded; not delivery assets.
- Existing NSIS appId/name/directory-choice installer settings retained. Unsigned. No install/commit/push/Release upload performed; user profiles untouched. Recheck all volatile state before later installation.

Build/verification scripts, manifest, native result and screenshots are in the local artifact directory. They contain only synthetic task fixtures. Source branch checked `design/toast-2-native-01105`, extensive preexisting changes preserved.
