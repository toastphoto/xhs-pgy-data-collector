#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SECRET_PATTERNS = [
    ("URL", re.compile(r"https?://", re.I)),
    ("cookie", re.compile(r"(?i)\bcookie\b")),
    ("token", re.compile(r"(?i)\b(token|access_token|refresh_token|secret|sessionid|session_id)\b")),
    ("phone-like number", re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")),
    ("bearer", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{12,}")),
    ("OpenAI-style key", re.compile(r"sk-[A-Za-z0-9_-]{20,}")),
    ("GitHub token", re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}")),
]


TEMPLATE: dict[str, Any] = {
    "schema_version": 2,
    "validation_date": datetime.now(timezone.utc).date().isoformat(),
    "operator_alias": "sanitized-initials",
    "app": {
        "repo": "xhs-pgy-data-collector",
        "branch": "",
        "commit_or_worktree_note": "dirty local validation is OK; describe current build without secrets",
        "electron_pid": "",
        "backend_pid": "",
    },
    "precheck": {
        "prepared_by_script": False,
        "git_status_checked": False,
        "audit_pgy_safety_ok": False,
        "runtime_probe_ok": False,
        "app_processes_checked": False,
        "no_private_data_in_record": True,
    },
    "environment": {
        "network": "office/home/other",
        "account_type": "real account, name omitted",
        "browser_surface": "Electron BrowserView",
    },
    "preflight": {
        "manual_login_confirmed": False,
        "manual_search_confirmed": False,
        "automated_search_pagination_used": False,
        "notes": "",
    },
    "small_batch": {
        "creator_count": 3,
        "preset": "standard",
        "started_at_local": "",
        "ended_at_local": "",
        "risk_page_seen": False,
        "runner_paused_if_risk_seen": None,
        "run_id_or_local_evidence_ref": "",
        "passed": False,
        "notes": "",
    },
    "ten_creator_batch": {
        "creator_count": 10,
        "preset": "standard",
        "started_at_local": "",
        "ended_at_local": "",
        "risk_page_seen": False,
        "runner_paused_if_risk_seen": None,
        "run_id_or_local_evidence_ref": "",
        "passed": False,
        "notes": "",
    },
    "risk_stop_behavior": {
        "checked": False,
        "method": "real-risk-page or controlled-test-page",
        "risk_text_seen": "",
        "app_paused_or_stopped": False,
        "continued_automation_after_risk": False,
        "notes": "",
    },
    "final_assessment": {
        "safe_enough_for_normal_internal_use": False,
        "remaining_concerns": "",
    },
}


def scan_for_private_shapes(value: Any, path: str = "$") -> list[str]:
    errors: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            errors.extend(scan_for_private_shapes(child, f"{path}.{key}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            errors.extend(scan_for_private_shapes(child, f"{path}[{index}]"))
    elif isinstance(value, str):
        for label, pattern in SECRET_PATTERNS:
            if pattern.search(value):
                errors.append(f"{path} contains forbidden {label} shape")
    return errors


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def filled(value: Any) -> bool:
    return bool(str(value or "").strip())


def is_digits(value: Any) -> bool:
    text = str(value or "").strip()
    return bool(text) and text.isdigit()


def looks_like_local_time(value: Any) -> bool:
    text = str(value or "").strip()
    return bool(re.match(r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}", text))


def validate_record(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    require(data.get("schema_version") == 2, "schema_version must be 2", errors)
    require(filled(data.get("validation_date")), "validation_date must be filled", errors)
    require(
        filled(data.get("operator_alias")) and data.get("operator_alias") != "sanitized-initials",
        "operator_alias must be a sanitized non-placeholder alias",
        errors,
    )

    app = data.get("app") or {}
    require(bool(str(app.get("branch") or "").strip()), "app.branch must be filled", errors)
    require(bool(str(app.get("commit_or_worktree_note") or "").strip()), "app.commit_or_worktree_note must be filled", errors)
    require(is_digits(app.get("electron_pid")), "app.electron_pid must be a numeric process id", errors)
    require(is_digits(app.get("backend_pid")), "app.backend_pid must be a numeric process id", errors)

    precheck = data.get("precheck") or {}
    require(precheck.get("prepared_by_script") is True, "precheck.prepared_by_script must be true", errors)
    require(precheck.get("git_status_checked") is True, "precheck.git_status_checked must be true", errors)
    require(precheck.get("audit_pgy_safety_ok") is True, "precheck.audit_pgy_safety_ok must be true", errors)
    require(precheck.get("runtime_probe_ok") is True, "precheck.runtime_probe_ok must be true", errors)
    require(precheck.get("app_processes_checked") is True, "precheck.app_processes_checked must be true", errors)
    require(precheck.get("no_private_data_in_record") is True, "precheck.no_private_data_in_record must be true", errors)

    environment = data.get("environment") or {}
    require(environment.get("network") in {"office", "home", "other"}, "environment.network must be office, home, or other", errors)
    require(environment.get("account_type") == "real account, name omitted", "environment.account_type must omit the account name", errors)
    require(environment.get("browser_surface") == "Electron BrowserView", "environment.browser_surface must be Electron BrowserView", errors)

    preflight = data.get("preflight") or {}
    require(preflight.get("manual_login_confirmed") is True, "preflight.manual_login_confirmed must be true", errors)
    require(preflight.get("manual_search_confirmed") is True, "preflight.manual_search_confirmed must be true", errors)
    require(preflight.get("automated_search_pagination_used") is False, "automated search pagination must remain false", errors)

    small = data.get("small_batch") or {}
    small_count = small.get("creator_count")
    require(isinstance(small_count, int) and 3 <= small_count <= 5, "small_batch.creator_count must be 3-5", errors)
    require(small.get("preset") in {"standard", "conservative"}, "small_batch preset must be standard or conservative", errors)
    require(looks_like_local_time(small.get("started_at_local")), "small_batch.started_at_local must look like YYYY-MM-DD HH:MM", errors)
    require(looks_like_local_time(small.get("ended_at_local")), "small_batch.ended_at_local must look like YYYY-MM-DD HH:MM", errors)
    require(filled(small.get("run_id_or_local_evidence_ref")), "small_batch.run_id_or_local_evidence_ref must be filled", errors)
    require(small.get("passed") is True, "small_batch.passed must be true", errors)
    if small.get("risk_page_seen") is True:
      require(small.get("runner_paused_if_risk_seen") is True, "small batch risk page must pause the runner", errors)

    ten = data.get("ten_creator_batch") or {}
    require(ten.get("creator_count") == 10, "ten_creator_batch.creator_count must be exactly 10", errors)
    require(ten.get("preset") in {"standard", "conservative"}, "ten_creator_batch preset must be standard or conservative", errors)
    require(looks_like_local_time(ten.get("started_at_local")), "ten_creator_batch.started_at_local must look like YYYY-MM-DD HH:MM", errors)
    require(looks_like_local_time(ten.get("ended_at_local")), "ten_creator_batch.ended_at_local must look like YYYY-MM-DD HH:MM", errors)
    require(filled(ten.get("run_id_or_local_evidence_ref")), "ten_creator_batch.run_id_or_local_evidence_ref must be filled", errors)
    require(ten.get("passed") is True, "ten_creator_batch.passed must be true", errors)
    if ten.get("risk_page_seen") is True:
      require(ten.get("runner_paused_if_risk_seen") is True, "ten creator risk page must pause the runner", errors)

    risk = data.get("risk_stop_behavior") or {}
    require(risk.get("checked") is True, "risk_stop_behavior.checked must be true", errors)
    require(risk.get("method") in {"real-risk-page", "controlled-test-page"}, "risk_stop_behavior.method must be real-risk-page or controlled-test-page", errors)
    require(filled(risk.get("risk_text_seen")), "risk_stop_behavior.risk_text_seen must be filled", errors)
    require(risk.get("app_paused_or_stopped") is True, "risk_stop_behavior.app_paused_or_stopped must be true", errors)
    require(risk.get("continued_automation_after_risk") is False, "app must not continue automation after risk", errors)

    final = data.get("final_assessment") or {}
    require(
        final.get("safe_enough_for_normal_internal_use") is True,
        "final_assessment.safe_enough_for_normal_internal_use must be true for a passing record",
        errors,
    )

    errors.extend(scan_for_private_shapes(data))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a sanitized Pugongying live safety validation record.")
    parser.add_argument("record", nargs="?", help="Path to a completed sanitized JSON validation record.")
    parser.add_argument("--print-template", action="store_true", help="Print a blank sanitized validation JSON template.")
    args = parser.parse_args()

    if args.print_template:
        print(json.dumps(TEMPLATE, ensure_ascii=False, indent=2))
        return 0

    if not args.record:
        parser.error("record path is required unless --print-template is used")

    path = Path(args.record)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as err:
        print(f"Failed to read validation record: {err}", file=sys.stderr)
        return 1

    if not isinstance(data, dict):
        print("Validation record must be a JSON object", file=sys.stderr)
        return 1

    errors = validate_record(data)
    if errors:
        print("PGY live validation record failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("PGY live validation record OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
