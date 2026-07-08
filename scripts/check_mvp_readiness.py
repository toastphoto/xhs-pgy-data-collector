#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Check:
    gate: str
    name: str
    status: str
    detail: str


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def exists_check(gate: str, path: str, detail: str = "") -> Check:
    target = ROOT / path
    if target.exists():
        return Check(gate, path, "pass", detail or "present")
    return Check(gate, path, "fail", "missing")


def file_contains(path: str, needles: Iterable[str], gate: str, name: str) -> Check:
    target = ROOT / path
    if not target.exists():
        return Check(gate, name, "fail", f"{path} missing")
    text = target.read_text(encoding="utf-8", errors="replace")
    missing = [needle for needle in needles if needle not in text]
    if missing:
        return Check(gate, name, "fail", f"missing: {', '.join(missing)}")
    return Check(gate, name, "pass", path)


def command_check(gate: str, name: str, cmd: list[str], cwd: Path | None = None, timeout: int = 60) -> Check:
    try:
        result = subprocess.run(
            cmd,
            cwd=str(cwd or ROOT),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            check=False,
        )
    except Exception as err:
        return Check(gate, name, "fail", str(err))
    first_line = (result.stdout or "").strip().splitlines()[:1]
    detail = first_line[0] if first_line else f"exit {result.returncode}"
    return Check(gate, name, "pass" if result.returncode == 0 else "fail", detail)


def newest_live_validation_record() -> Path | None:
    candidates = sorted((ROOT / "tmp").glob("pgy_live_validation*.json")) if (ROOT / "tmp").exists() else []
    return candidates[-1] if candidates else None


def build_checks(run_commands: bool) -> list[Check]:
    checks: list[Check] = []

    checks.extend([
        exists_check("local-build", "desktop-app/package.json"),
        exists_check("local-build", "desktop-app/main.js"),
        exists_check("local-build", "desktop-app/preload.js"),
        exists_check("local-build", "desktop-app/renderer/views/tasks.js"),
        exists_check("local-build", "desktop-app/renderer/views/exports.js"),
        exists_check("local-build", "desktop-app/renderer/views/templates.js"),
        exists_check("local-build", "desktop-app/renderer/ui/components.js"),
    ])

    checks.extend([
        exists_check("product-flow", "desktop-app/lib/signing_task.js"),
        exists_check("product-flow", "desktop-app/lib/signing_task_store.js"),
        exists_check("product-flow", "desktop-app/lib/candidate_sheet.js"),
        exists_check("product-flow", "desktop-app/lib/pgy_excel.js"),
        exists_check("product-flow", "desktop-app/lib/contact_sheet.js"),
        exists_check("product-flow", "desktop-app/lib/contact_review_store.js"),
        exists_check("product-flow", "desktop-app/lib/contact_review_excel.js"),
        exists_check("product-flow", "desktop-app/templates/default_pgy_v1.json"),
    ])

    checks.extend([
        file_contains(
            "desktop-app/lib/contact_sheet.js",
            ["建联概览", "建联表", "蒲公英邀约表", "邮件建联表", "小蜜蜂导入表", "待补联系方式"],
            "product-flow",
            "contact workbook sheets",
        ),
        file_contains(
            "desktop-app/renderer/views/tasks.js",
            ["读取当前结果", "候选", "开始采集"],
            "product-flow",
            "find-creators workflow labels",
        ),
        file_contains(
            "desktop-app/package.json",
            ["task_runner_safety.test.js", "contact_sheet.test.js", "contact_review_excel.test.js", "pgy_risk.test.js"],
            "local-build",
            "npm test includes MVP-critical tests",
        ),
    ])

    checks.extend([
        exists_check("safety", "docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md"),
        exists_check("safety", "docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md"),
        exists_check("safety", "scripts/audit_pgy_safety.py"),
        exists_check("safety", "scripts/probe_pgy_runtime_safety.py"),
        exists_check("safety", "scripts/prepare_pgy_live_validation.py"),
        exists_check("safety", "scripts/validate_pgy_live_validation.py"),
        exists_check("safety", "scripts/test_pgy_live_validation.py"),
        file_contains(
            "desktop-app/lib/task_runner.js",
            ["SAFE_BATCH_LIMIT", "SAFE_RUN_COOLDOWN_MS", "PGY_TASK_URL_NOT_ALLOWED"],
            "safety",
            "task runner safety invariants",
        ),
        file_contains(
            "desktop-app/lib/pgy_risk.js",
            ["riskDetected", "captcha", "too many requests"],
            "safety",
            "risk text detector",
        ),
    ])

    checks.extend([
        exists_check("memory", "AGENTS.md"),
        exists_check("memory", "docs/project_memory/ACTIVE_CONTEXT.md"),
        exists_check("memory", "docs/project_memory/DECISIONS.md"),
        exists_check("memory", "docs/project_memory/HANDOFF_TEMPLATE.md"),
        exists_check("memory", "docs/project_memory/MVP_ACCEPTANCE_PLAN.md"),
    ])

    record = newest_live_validation_record()
    if record:
        checks.append(command_check(
            "real-workflow",
            "latest sanitized live validation record",
            [sys.executable, "scripts/validate_pgy_live_validation.py", rel(record)],
            timeout=20,
        ))
    else:
        checks.append(Check(
            "real-workflow",
            "sanitized live validation record",
            "block",
            "missing tmp/pgy_live_validation*.json; this is required before calling the app delivered",
        ))

    if run_commands:
        checks.extend([
            command_check("local-build", "project memory verification", [sys.executable, "scripts/verify_project_memory.py"], timeout=30),
            command_check("safety", "PGY safety audit", [sys.executable, "scripts/audit_pgy_safety.py"], timeout=30),
            command_check("local-build", "desktop npm test", ["npm", "test"], cwd=ROOT / "desktop-app", timeout=120),
            command_check("local-build", "git diff whitespace check", ["git", "diff", "--check"], timeout=30),
        ])

    return checks


def summarize(checks: list[Check]) -> dict[str, int]:
    summary = {"pass": 0, "fail": 0, "block": 0, "warn": 0}
    for check in checks:
        summary[check.status] = summary.get(check.status, 0) + 1
    return summary


def print_text(checks: list[Check]) -> None:
    summary = summarize(checks)
    print("MVP readiness")
    print(f"pass={summary.get('pass', 0)} fail={summary.get('fail', 0)} block={summary.get('block', 0)} warn={summary.get('warn', 0)}")
    current_gate = ""
    for check in checks:
        if check.gate != current_gate:
            current_gate = check.gate
            print(f"\n[{current_gate}]")
        marker = {"pass": "OK", "fail": "FAIL", "block": "BLOCK", "warn": "WARN"}.get(check.status, check.status.upper())
        print(f"- {marker} {check.name}: {check.detail}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check whether this repo is ready to be treated as a usable internal MVP.")
    parser.add_argument("--run-commands", action="store_true", help="Run slower verification commands such as npm test.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    parser.add_argument("--strict", action="store_true", help="Return non-zero when any fail or block is present.")
    args = parser.parse_args()

    checks = build_checks(run_commands=args.run_commands)
    summary = summarize(checks)

    if args.json:
        print(json.dumps({"summary": summary, "checks": [asdict(check) for check in checks]}, ensure_ascii=False, indent=2))
    else:
        print_text(checks)

    if args.strict and (summary.get("fail", 0) or summary.get("block", 0)):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
