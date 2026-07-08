#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/check_mvp_readiness.py"


spec = importlib.util.spec_from_file_location("check_mvp_readiness", SCRIPT)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
sys.modules["check_mvp_readiness"] = module
spec.loader.exec_module(module)

checks = module.build_checks(run_commands=False)
names = {check.name for check in checks}
statuses = {check.status for check in checks}

assert "contact workbook sheets" in names
assert "task runner safety invariants" in names
assert "sanitized live validation record" in names or "latest sanitized live validation record" in names
assert statuses <= {"pass", "fail", "block", "warn"}

summary = module.summarize(checks)
assert sum(summary.values()) == len(checks)

print("test_mvp_readiness.py OK")
