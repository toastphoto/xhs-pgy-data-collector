# Feishu Local Auth Probe

## Scope

User confirms the administrator installed the test plugin in the only target space. The operator's inability to install is not contrary evidence. Do not request repeated installation or broaden permissions without a concrete API error.

Official authentication documentation was read live: https://project.feishu.cn/b/helpcenter/1p8d7djs/4id4bvnf . Production exchange uses POST /open_api/authen/plugin_token, type 0, and error.code; metadata uses the existing strict read-mode GET reader and err_code.

## Added

- desktop-app/lib/feishu_plugin_auth.js: one-shot credential exchange, fixed official origin, no redirects, bounded body and timeout, sanitized errors. No persistent cache; this is a diagnostic helper, not a production credential service.
- desktop-app/scripts/probe-feishu-metadata.js: stdin-only configuration, existing reader integration, reports field schema without options/defaults or credential values. Empty metadata is not success.
- scripts/probe_feishu_metadata.py: interactive hidden Secret entry; credentials passed over a child-process pipe, not command arguments or files. Node executable may be supplied with --node. Optional nonsecret target arguments prefill known IDs.
- Two new test files cover token and diagnostic composition behavior.

## Verified / Pending

40 focused Node tests passed, including 24 existing metadata tests; Python --help passed. No package dependency changes, main/renderer wiring, build, commit or push. Live token/metadata request has not been observed. A separate interactive PowerShell window was launched for user credential entry; spawning a window is not proof of successful API execution.

Run from an interactive terminal: python -B scripts/probe_feishu_metadata.py . Enter the authorized acting User Key and Plugin Secret locally; never paste secrets in chat. Output may contain private field schema, so only share necessary outcome/error codes. No contact lookup, business write, workflow transition or deletion is performed.

The Secret and short-lived token exist in process memory; Python/JavaScript cannot guarantee memory zeroization. Neither is stored on disk by this probe. Production distributed clients still require a separately reviewed credential architecture; do not ship a shared Secret in an EXE.
