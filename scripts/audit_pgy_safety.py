#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8", errors="replace")


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def main() -> int:
    errors: list[str] = []

    live_protocol = ROOT / "docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md"
    live_preparer = ROOT / "scripts/prepare_pgy_live_validation.py"
    live_validator = ROOT / "scripts/validate_pgy_live_validation.py"
    live_validator_test = ROOT / "scripts/test_pgy_live_validation.py"
    runtime_probe = ROOT / "scripts/probe_pgy_runtime_safety.py"
    require(live_protocol.is_file(), "Live PGY validation protocol must exist", errors)
    require(live_preparer.is_file(), "Live PGY validation preparer must exist", errors)
    require(live_validator.is_file(), "Live PGY validation record checker must exist", errors)
    require(live_validator_test.is_file(), "Live PGY validation checker tests must exist", errors)
    require(runtime_probe.is_file(), "Runtime PGY safety probe must exist", errors)

    task_runner = read("desktop-app/lib/task_runner.js")
    backend_runtime = read("desktop-app/lib/backend_runtime.js")
    candidate_command = read("desktop-app/lib/pgy_candidate_command.js")
    candidate_response_cache = read("desktop-app/lib/pgy_candidate_response_cache.js")
    candidate_checkpoint = read("desktop-app/lib/pgy_candidate_checkpoint.js")
    pgy_risk = read("desktop-app/lib/pgy_risk.js")
    xhs_contact = read("desktop-app/lib/xhs_contact_enrichment.js")
    main_js = read("desktop-app/main.js")
    exports_view = read("desktop-app/renderer/views/exports.js")
    tasks_view = read("desktop-app/renderer/views/tasks.js")
    recordings_view = read("desktop-app/renderer/views/recordings.js")
    package_json = read("desktop-app/package.json")
    default_template = read("desktop-app/templates/default_pgy_v1.json")
    api_server = read("content-analyzer/app/api/server.py")
    config_py = read("content-analyzer/app/utils/config.py")
    helpers_py = read("content-analyzer/app/utils/helpers.py")
    browser_engine = read("content-analyzer/app/core/browser_engine.py")
    enhanced_browser = read("content-analyzer/app/core/enhanced_browser.py")
    base_crawler = read("content-analyzer/app/core/base_crawler.py")
    content_readme = read("content-analyzer/README.md")
    legacy_security_doc = read("content-analyzer/docs/SECURITY_IMPROVEMENTS.md")
    live_protocol_text = read("docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md")
    live_preparer_text = read("scripts/prepare_pgy_live_validation.py")
    live_validator_text = read("scripts/validate_pgy_live_validation.py")
    live_validator_test_text = read("scripts/test_pgy_live_validation.py")
    task_runner_test = read("desktop-app/tests/task_runner_safety.test.js")
    candidate_response_test = read("desktop-app/tests/pgy_candidate_response_cache.test.js")
    email_handoff_segment = exports_view.split("const btnTencentEmail", 1)[-1].split(
        "reviewTop.appendChild(btnTencentEmail)", 1
    )[0]

    require("const SAFE_BATCH_LIMIT = 50" in task_runner, "TaskRunner must keep SAFE_BATCH_LIMIT at 50", errors)
    require("ALLOWED_TASK_HOSTS" in task_runner and "pgy.xiaohongshu.com" in task_runner, "TaskRunner must restrict automated batches to PGY task URLs", errors)
    require("PGY_TASK_URL_NOT_ALLOWED" in task_runner and "isAllowedTaskUrl" in task_runner, "TaskRunner must reject non-PGY task URLs", errors)
    require("SAFE_RUN_COOLDOWN_MS = 5 * 60 * 1000" in task_runner, "TaskRunner must keep a 5-minute cooldown between completed batches", errors)
    require("SAFE_RUN_COOLDOWN_FILE = '.pgy_task_cooldown.json'" in task_runner, "TaskRunner must keep cooldown state in a local runs-dir file", errors)
    require("PGY_RUN_COOLDOWN" in task_runner and "_lastFinishedAt" in task_runner, "TaskRunner must reject immediate back-to-back batches", errors)
    require("_readLastFinishedAt" in task_runner and "_writeLastFinishedAt" in task_runner, "TaskRunner cooldown must survive app restarts", errors)
    require("SAFE_RUN_COOLDOWN_FILE" in task_runner_test and "persisted-cooldown" in task_runner_test, "TaskRunner safety tests must cover persisted cooldown", errors)
    require("activeRunId" in task_runner and "PGY_UNFINISHED_RUN" in task_runner and "recoverFromTaskState" in task_runner, "TaskRunner must keep unfinished runs locked and recoverable across restart", errors)
    require("PGY_TASK_URL_NOT_ALLOWED" in task_runner_test and "example.com/not-pgy" in task_runner_test, "TaskRunner safety tests must cover non-PGY URL rejection", errors)
    require("items.length > SAFE_BATCH_LIMIT" in task_runner, "TaskRunner must reject over-limit batches", errors)
    require("allowLargeBatch" not in task_runner, "TaskRunner must not expose a hidden large-batch bypass", errors)
    require("fast:" not in task_runner or "fast: 'standard'" in task_runner, "TaskRunner must not keep a faster hidden preset", errors)
    require("normalizePresetKey" in task_runner and "fast: 'standard'" in task_runner, "Legacy fast preset must be normalized to standard", errors)
    require("较快" not in task_runner, "TaskRunner must not label any hidden preset as faster", errors)
    require("riskDetected" in task_runner and "_pauseForManualIntervention" in task_runner, "TaskRunner must pause on risk detection", errors)
    require("resolveNoteUrlByClick: false" in task_runner, "TaskRunner presets must keep note URL click-completion disabled by default", errors)
    require("resolveLimit: 0" in task_runner, "TaskRunner must keep note URL click resolve limit at 0 by default", errors)
    require(
        "Math.max(preset.tabWaitMs, requestedTabWaitMs)" in task_runner,
        "TaskRunner must not allow payload options to shorten tab waits below the preset",
        errors,
    )
    require(
        '"resolveNoteUrlByClick": false' in default_template,
        "Bundled PGY template must keep note URL click-completion disabled by default",
        errors,
    )

    wait_values = [int(x) for x in re.findall(r"pageWaitMs:\s*(\d+)", task_runner)]
    require(bool(wait_values), "TaskRunner wait presets were not found", errors)
    require(all(value >= 3000 for value in wait_values), f"All pageWaitMs values must be >= 3000, got {wait_values}", errors)
    require("pageWaitJitterMs" in task_runner and "jitteredDelayMs" in task_runner, "TaskRunner must keep jittered waits", errors)

    require("buildBrowserRiskDetectionSnippet" in main_js, "main.js must use the shared PGY risk detector snippet", errors)
    require("pgy_risk.test.js" in package_json, "npm test must include the PGY risk text unit test", errors)
    for phrase in ["captcha", "安全验证", "人机验证", "拖动滑块", "访问异常", "too many requests"]:
        require(phrase in pgy_risk, f"PGY risk detection must include common risk-control text: {phrase}", errors)
    require("PGY_RISK_PATTERNS" in pgy_risk and "detectRiskText" in pgy_risk, "PGY risk detection must live in a testable shared module", errors)
    require(
        "buildBrowserRiskDetectionSnippet" in pgy_risk and "riskDetected" in pgy_risk,
        "PGY risk module must generate the BrowserView risk-detection snippet",
        errors,
    )
    require((ROOT / "desktop-app/tests/pgy_risk.test.js").is_file(), "PGY risk text unit test must exist", errors)
    for phrase in ["requests too frequent", "website-login", "security verification"]:
        require(phrase in xhs_contact, f"XHS contact enrichment must detect risk signal: {phrase}", errors)
    require(
        "buildXhsRiskDetectionSnippet" in xhs_contact and "detectXhsRisk" in xhs_contact,
        "XHS risk detection must live in a testable shared module",
        errors,
    )
    require(
        "XHS_CONTACT_COOLDOWN_EVERY = 5" in main_js
        and "XHS_CONTACT_COOLDOWN_MIN_MS = 35000" in main_js
        and "XHS_RISK_DETECTED" in main_js,
        "XHS contact enrichment must keep periodic cooldowns and stop on risk detection",
        errors,
    )
    require(
        "preflight?.riskDetected" in main_js and "请勿继续重试" in main_js,
        "XHS contact enrichment must reject a new batch while the current page is risk-blocked",
        errors,
    )
    require(
        "_xhsContactState.session === 'risk'" in exports_view and "请勿反复刷新或重试" in exports_view,
        "Contact review UI must disable enrichment and explain recovery while XHS is risk-blocked",
        errors,
    )
    require(
        "pgyDetectRiskOnCurrentPage" in main_js and "before_write_result" in main_js and "PGY_RISK_DETECTED" in main_js,
        "pgy extraction must recheck risk-control text during extraction and before writing results",
        errors,
    )
    require(
        "PGY_CURRENT_URL_NOT_ALLOWED" in main_js and "isAllowedTaskUrl(currentPageUrl)" in main_js,
        "direct PGY extraction must reject non-PGY current pages",
        errors,
    )
    require(
        "rejectNonPgyCurrentPageForBrowserAutomation" in main_js
        and "pgy:pickElement" in main_js
        and "pgy:scanPageBlocks" in main_js
        and "pgy:suggestNoteCardSelector" in main_js,
        "page calibration/annotation IPC entrypoints must keep a PGY current-page guard",
        errors,
    )
    require(
        "鼠标精确点选" in main_js and "网页标注" in main_js and "自动识别笔记卡片" in main_js,
        "page calibration guard must cover manual picking, annotation scanning, and note-card suggestion",
        errors,
    )
    require(
        "recording:start" in main_js
        and "录制排查" in main_js
        and "if (!isAllowedTaskUrl(url)) return;" in main_js
        and "if (!isAllowedTaskUrl(currentPageUrl)) return;" in main_js,
        "recording capture must only start on PGY and must not store non-PGY navigation/actions",
        errors,
    )
    require("PGY_MIN_TAB_WAIT_MS = 2500" in main_js, "Direct PGY extraction must keep a conservative tab-wait floor", errors)
    require("Math.max(PGY_MIN_TAB_WAIT_MS, requestedTabWaitMs)" in main_js, "Direct PGY extraction options must not shorten tab waits", errors)
    require(
        "PGY_ALLOW_NOTE_CLICK_RESOLVE" in main_js and "resolveNoteUrlByClick = PGY_ALLOW_NOTE_CLICK_RESOLVE && requestedResolveByClick" in main_js,
        "Direct PGY extraction must keep note URL click-completion disabled unless explicitly gated",
        errors,
    )
    require("Math.min(PGY_NOTE_CLICK_RESOLVE_LIMIT" in main_js, "Direct PGY extraction must cap gated note URL click-completion", errors)
    require(
        "stopIfReplayHitsRisk" in main_js and "after_replay_click" in main_js and "after_replay_input" in main_js,
        "recording replay must stop when risk-control text appears",
        errors,
    )
    require(
        "PGY_REPLAY_URL_NOT_ALLOWED" in main_js and "before_replay_navigate" in main_js and "before_replay_click" in main_js and "before_replay_input" in main_js,
        "recording replay must reject non-PGY navigation/click/input automation",
        errors,
    )

    require("const SAFE_BATCH_LIMIT = 50" in tasks_view, "Task UI must show the 50 creator ceiling", errors)
    require(
        "const MAX_CANDIDATE_COUNT = 50" in candidate_command
        and "const MAX_CANDIDATE_RANK = 100" in candidate_command,
        "Segmented candidate intake must keep a 50-person segment ceiling and rank-100 boundary",
        errors,
    )
    require(
        "PGY_CANDIDATE_MAX_PAGES = 10" in main_js
        and (
            "while (items.length < endRank" in main_js
            or (
                "while (pagesRead <= PGY_CANDIDATE_MAX_PAGES)" in main_js
                and "if (items.length >= endRank) break" in main_js
                and "if (pagesRead >= PGY_CANDIDATE_MAX_PAGES) break" in main_js
            )
        )
        and "pgyDetectRiskOnCurrentPage" in main_js,
        "Segmented candidate paging must stay bounded and recheck PGY risk before page turns",
        errors,
    )
    require(
        "PGY_CANDIDATE_CHECKPOINT_WAIT_MS = 90 * 1000" in candidate_checkpoint
        and "findPendingCheckpoint" in main_js
        and "findCheckpointBeforeNextPage" in main_js
        and "continueSearchCandidates" in tasks_view,
        "Candidate paging must pause for at least 90 seconds at 40-rank checkpoints and require a manual continue",
        errors,
    )
    require(
        "PGY_PAGINATION_RESPONSE_TIMEOUT" in main_js
        and "本次部分结果不会自动加入候选" in main_js,
        "Incomplete candidate pagination must not be reported or merged as a complete range",
        errors,
    )
    require(
        "beginCommandWindow" in candidate_response_cache
        and "endCommandWindow" in candidate_response_cache
        and "commandWindow" in main_js,
        "Candidate response reads must be scoped to an explicit command window",
        errors,
    )
    require(
        "seedCommandWindow" in candidate_response_cache
        and "sourceContext" in candidate_response_cache
        and "seedCandidateCommandFromVisiblePage" in main_js
        and "if (!pending?.commandWindow) return;" not in main_js
        and "PGY_CANDIDATE_RESPONSE_NOT_READY" in main_js,
        "Candidate first-page reads must adopt only a same-navigation sanitized snapshot instead of dropping pre-command responses",
        errors,
    )
    require(
        "PGY_PAGINATION_PAGE_OVERLAP" in candidate_response_cache
        and "overlapCount > 0" in candidate_response_cache
        and "PGY_PAGINATION_PAGE_OVERLAP" in candidate_response_test,
        "Candidate paging must reject any cross-page creator overlap to preserve rank positions",
        errors,
    )
    require(
        "requestSingleInstanceLock" in main_js and "BACKEND_IDENTITY_MISMATCH" in backend_runtime,
        "Desktop collection must reject duplicate app instances and stale backend identity",
        errors,
    )
    require(
        "startXhsContactRows" not in email_handoff_segment and "不会启动补采" in email_handoff_segment,
        "Email handoff must not silently start public-contact enrichment without confirmation",
        errors,
    )
    require(
        "isSameTaskPage" in task_runner
        and "页面已离开当前达人" in task_runner
        and "event.sender?.id !== browserView?.webContents?.id" in main_js,
        "Collection work and recording events must remain bound to the fixed collection page",
        errors,
    )
    require(
        "latest_segment" in tasks_view and "urls.length > SAFE_BATCH_LIMIT" in tasks_view,
        "Task UI must support the latest segment without weakening the 50-person run ceiling",
        errors,
    )
    require("建议 10-30 人/批" in tasks_view, "Task UI must show recommended batch size", errors)
    require("批次间隔至少 5 分钟" in tasks_view, "Task UI must show cooldown guidance between batches", errors)
    require("task-safety-notice" in tasks_view, "Task UI must render a safety notice before collection", errors)
    require("较快" not in tasks_view, "Task UI must not expose a speed-seeking preset in the normal collection flow", errors)
    require("录制和回放只允许蒲公英页面" in recordings_view, "Recording UI must explain the PGY-only recording/replay boundary", errors)
    require("出现验证码、人机验证、访问异常或操作频繁提示也会停止" in recordings_view, "Recording UI must explain risk-page replay stop behavior", errors)

    require("ALLOW_STEALTH_EVASION = os.getenv" in config_py, "Config must define explicit ALLOW_STEALTH_EVASION gate", errors)
    require("USE_PROXY = ALLOW_STEALTH_EVASION and" in config_py, "Proxy use must require ALLOW_STEALTH_EVASION", errors)
    require("HEADLESS = ALLOW_STEALTH_EVASION and" in config_py, "Headless mode must require ALLOW_STEALTH_EVASION", errors)
    require("API_HOST = os.getenv('API_HOST', '127.0.0.1')" in config_py, "Backend API host must default to 127.0.0.1", errors)
    require("ENABLE_LEGACY_CRAWL_API = os.getenv" in config_py and "'false'" in config_py, "Legacy crawl API must be disabled by default", errors)
    require("LEGACY_CRAWL_MAX_URLS" in config_py and "LEGACY_CRAWL_MAX_CONTENTS" in config_py, "Legacy crawl API must have explicit small-batch limits", errors)
    require(
        api_server.count("_require_legacy_crawl_api_enabled()") >= 7,
        "Legacy crawl/prelogin routes must require the explicit compatibility gate",
        errors,
    )
    require("_validate_legacy_crawl_task(task)" in api_server, "Legacy crawl route must validate URL and content-count limits", errors)
    require("legacy_crawl_api_enabled" in api_server, "Backend config must expose legacy crawl API status for visibility", errors)
    require("不会修改采集安全边界" in api_server, "Runtime config route must not pretend to change safety boundaries", errors)
    require("旧采集台已禁用" in api_server, "Backend root page must not show the old crawler UI while legacy API is disabled", errors)
    require(
        "prepare_pgy_live_validation.py" in live_protocol_text and "runtime safety probe" in live_protocol_text,
        "Live validation protocol must prefer the preparer script and runtime safety probe",
        errors,
    )
    require('"schema_version": 2' in live_validator_text, "Live validation schema must stay at version 2", errors)
    require(
        "audit_pgy_safety_ok" in live_validator_text and "runtime_probe_ok" in live_validator_text,
        "Live validation record must require static and runtime prechecks",
        errors,
    )
    require("operator_alias" in live_validator_text and "sanitized-initials" in live_validator_text, "Live validation checker must reject placeholder operator aliases", errors)
    require("started_at_local" in live_validator_text and "run_id_or_local_evidence_ref" in live_validator_text, "Live validation checker must require batch timing and local evidence refs", errors)
    require("real-risk-page" in live_validator_text and "controlled-test-page" in live_validator_text, "Live validation checker must require a concrete risk-stop method", errors)
    require(
        "scripts/audit_pgy_safety.py" in live_preparer_text and "scripts/probe_pgy_runtime_safety.py" in live_preparer_text,
        "Live validation preparer must run static and runtime safety checks",
        errors,
    )
    require("forbidden URL" in live_validator_test_text and "risk_stop_behavior.method" in live_validator_test_text, "Live validation checker tests must cover private URL and placeholder method failures", errors)
    require(
        "not the current product surface" in content_readme and "desktop-app" in content_readme,
        "content-analyzer README must describe itself as a legacy compatibility backend, not the product path",
        errors,
    )
    require("ENABLE_LEGACY_CRAWL_API=false" in content_readme, "content-analyzer README must document disabled legacy API default", errors)
    require("ALLOW_STEALTH_EVASION=false" in content_readme, "content-analyzer README must document disabled stealth/evasion default", errors)
    require("HEADLESS=false" in content_readme, "content-analyzer README must document visible-browser default", errors)
    for phrase in [
        "浏览器指纹伪装",
        "智能代理轮换",
        "自动处理反爬机制",
        "建议使用小号",
        "MIN_DELAY=1",
        "MAX_DELAY=3",
        "USE_PROXY=true",
        "HEADLESS=true",
        "API_HOST=0.0.0.0",
        "undetected-chromedriver",
    ]:
        require(phrase not in content_readme, f"content-analyzer README must not reintroduce old unsafe guidance: {phrase}", errors)
    require(
        "intentionally no longer contains the older crawler-evasion notes" in legacy_security_doc,
        "legacy security notes must be replaced by a deprecation notice",
        errors,
    )
    for phrase in ["from seleniumwire import webdriver", "CookieManager", "options.add_argument(\"--disable-blink-features=AutomationControlled\")"]:
        require(phrase not in legacy_security_doc, f"legacy security notes must not keep old evasion snippets: {phrase}", errors)
    require("if not Config.ALLOW_STEALTH_EVASION" in helpers_py and "return None" in helpers_py, "ProxyPool must be inert unless ALLOW_STEALTH_EVASION is enabled", errors)
    require("from fake_useragent import UserAgent" not in helpers_py.split("def get_random_ua", 1)[0], "fake_useragent must not be imported at helpers module import time", errors)
    require("if not Config.ALLOW_STEALTH_EVASION" in helpers_py and "return DEFAULT_BROWSER_UA" in helpers_py, "Random UA helper must return a stable UA unless ALLOW_STEALTH_EVASION is enabled", errors)
    require("self.use_proxy = Config.ALLOW_STEALTH_EVASION and bool(requested_proxy)" in base_crawler, "BaseCrawler must not let use_proxy=True bypass ALLOW_STEALTH_EVASION", errors)
    require("self.headless = Config.ALLOW_STEALTH_EVASION and bool(requested_headless)" in browser_engine, "BrowserEngine must not let headless=True bypass ALLOW_STEALTH_EVASION", errors)

    for rel, text in [
        ("content-analyzer/app/utils/helpers.py", helpers_py),
        ("content-analyzer/app/core/browser_engine.py", browser_engine),
        ("content-analyzer/app/core/enhanced_browser.py", enhanced_browser),
        ("content-analyzer/app/core/base_crawler.py", base_crawler),
    ]:
        if any(token in text for token in ["AutomationControlled", "enable-automation", "user-agent", "get_random_ua"]):
            require("ALLOW_STEALTH_EVASION" in text, f"{rel} has evasion-related code that must stay gated", errors)

    for flag in ["--disable-web-security", "--disable-features=IsolateOrigins,site-per-process", "profile.managed_default_content_settings.images"]:
        for rel, text in [
            ("content-analyzer/app/core/browser_engine.py", browser_engine),
            ("content-analyzer/app/core/enhanced_browser.py", enhanced_browser),
        ]:
            if flag in text:
                flag_index = text.index(flag)
                gate_index = text.rfind("ALLOW_STEALTH_EVASION", 0, flag_index)
                require(gate_index >= 0 and flag_index - gate_index < 500, f"{rel} must gate nonstandard browser flag/pref {flag}", errors)

    if errors:
        print("PGY safety audit failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("PGY safety audit OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
