#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def run(cmd: list[str]) -> tuple[int, str]:
    try:
        proc = subprocess.run(
            cmd,
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=60,
            check=False,
        )
        return proc.returncode, proc.stdout.strip()
    except Exception as err:
        return 1, str(err)


def first_pid(pattern: str) -> str:
    code, out = run(["pgrep", "-fl", pattern])
    if code != 0 or not out:
        return ""
    for line in out.splitlines():
        parts = line.strip().split(maxsplit=1)
        if parts and parts[0].isdigit():
            return parts[0]
    return ""


def load_template() -> dict[str, Any]:
    from validate_pgy_live_validation import TEMPLATE

    return json.loads(json.dumps(TEMPLATE))


def build_record() -> dict[str, Any]:
    record = load_template()
    record["validation_date"] = datetime.now(timezone.utc).date().isoformat()

    branch_code, branch = run(["git", "branch", "--show-current"])
    status_code, status = run(["git", "status", "--short", "--branch"])
    audit_code, _audit = run(["python3", "scripts/audit_pgy_safety.py"])
    probe_code, _probe = run(["python3", "scripts/probe_pgy_runtime_safety.py"])

    electron_pid = first_pid(
        "xhs-pgy-data-collector/desktop-app/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
    )
    backend_pid = first_pid("content-analyzer/main.py")

    status_lines = [line for line in status.splitlines() if line.strip()]
    status_summary = status_lines[0] if status_lines else ""
    if len(status_lines) > 1:
        status_summary += f"; dirty_files={len(status_lines) - 1}"

    record["app"]["branch"] = branch if branch_code == 0 else ""
    record["app"]["commit_or_worktree_note"] = status_summary or "git status checked; no summary available"
    record["app"]["electron_pid"] = electron_pid
    record["app"]["backend_pid"] = backend_pid

    record["precheck"]["prepared_by_script"] = True
    record["precheck"]["git_status_checked"] = status_code == 0
    record["precheck"]["audit_pgy_safety_ok"] = audit_code == 0
    record["precheck"]["runtime_probe_ok"] = probe_code == 0
    record["precheck"]["app_processes_checked"] = bool(electron_pid and backend_pid)
    record["precheck"]["no_private_data_in_record"] = True

    return record


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare a sanitized PGY live validation JSON record.")
    parser.add_argument("--output", "-o", help="Write the prepared JSON record to this path.")
    args = parser.parse_args()

    record = build_record()
    text = json.dumps(record, ensure_ascii=False, indent=2)

    if args.output:
        path = Path(args.output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text + "\n", encoding="utf-8")
        print(f"Wrote {path}")
    else:
        print(text)

    missing = []
    if not record["precheck"]["audit_pgy_safety_ok"]:
        missing.append("python3 scripts/audit_pgy_safety.py")
    if not record["precheck"]["runtime_probe_ok"]:
        missing.append("python3 scripts/probe_pgy_runtime_safety.py")
    if not record["precheck"]["app_processes_checked"]:
        missing.append("running Electron app and backend")
    if missing:
        print("Precheck incomplete:", ", ".join(missing), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
