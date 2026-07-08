#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    ROOT / "AGENTS.md",
    ROOT / "docs/project_memory/README.md",
    ROOT / "docs/project_memory/ACTIVE_CONTEXT.md",
    ROOT / "docs/project_memory/DECISIONS.md",
    ROOT / "docs/project_memory/HANDOFF_TEMPLATE.md",
    ROOT / "docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md",
    ROOT / "docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md",
    ROOT / "docs/project_memory/MVP_ACCEPTANCE_PLAN.md",
    ROOT / "scripts/probe_pgy_runtime_safety.py",
    ROOT / "scripts/prepare_pgy_live_validation.py",
    ROOT / "scripts/test_pgy_live_validation.py",
    ROOT / "scripts/check_mvp_readiness.py",
    ROOT / "scripts/test_mvp_readiness.py",
]

SECRET_PATTERNS = [
    ("OpenAI-style key", re.compile(r"sk-[A-Za-z0-9_-]{20,}")),
    ("GitHub token", re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}")),
    ("Slack token", re.compile(r"xox[baprs]-[A-Za-z0-9-]{20,}")),
    ("JWT", re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
    ("AWS access key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("Long bearer-like secret", re.compile(r"(?i)(api[_-]?key|secret|access[_-]?token)\s*[:=]\s*['\"][A-Za-z0-9_./+=-]{24,}['\"]")),
]


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def main() -> int:
    errors: list[str] = []

    for path in REQUIRED_FILES:
        if not path.exists():
            errors.append(f"missing required file: {rel(path)}")
        elif not path.is_file():
            errors.append(f"required path is not a file: {rel(path)}")

    agents_path = ROOT / "AGENTS.md"
    if agents_path.exists():
        agents = agents_path.read_text(encoding="utf-8")
        for required_link in [
            "docs/project_memory/ACTIVE_CONTEXT.md",
            "docs/project_memory/HANDOFF_TEMPLATE.md",
        ]:
            if required_link not in agents:
                errors.append(f"AGENTS.md does not link {required_link}")

    memory_files = sorted((ROOT / "docs/project_memory").glob("*.md"))
    scan_files = sorted(set(REQUIRED_FILES + memory_files))

    for path in scan_files:
        if not path.exists() or not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for label, pattern in SECRET_PATTERNS:
            match = pattern.search(text)
            if match:
                line_no = text[: match.start()].count("\n") + 1
                errors.append(f"possible {label} in {rel(path)}:{line_no}")

    if errors:
        print("Project memory verification failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Project memory verification OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
