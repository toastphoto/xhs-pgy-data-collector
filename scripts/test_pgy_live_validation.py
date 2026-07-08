#!/usr/bin/env python3
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from validate_pgy_live_validation import TEMPLATE, validate_record


def completed_record() -> dict:
    data = json.loads(json.dumps(TEMPLATE))
    data["operator_alias"] = "qa-a"
    data["app"]["branch"] = "main"
    data["app"]["commit_or_worktree_note"] = "## main...origin/main; dirty_files=46"
    data["app"]["electron_pid"] = "12345"
    data["app"]["backend_pid"] = "12346"
    data["precheck"]["prepared_by_script"] = True
    data["precheck"]["git_status_checked"] = True
    data["precheck"]["audit_pgy_safety_ok"] = True
    data["precheck"]["runtime_probe_ok"] = True
    data["precheck"]["app_processes_checked"] = True
    data["environment"]["network"] = "office"
    data["preflight"]["manual_login_confirmed"] = True
    data["preflight"]["manual_search_confirmed"] = True
    data["small_batch"]["started_at_local"] = "2026-07-02 10:00"
    data["small_batch"]["ended_at_local"] = "2026-07-02 10:08"
    data["small_batch"]["run_id_or_local_evidence_ref"] = "local-run-small"
    data["small_batch"]["passed"] = True
    data["ten_creator_batch"]["started_at_local"] = "2026-07-02 10:20"
    data["ten_creator_batch"]["ended_at_local"] = "2026-07-02 10:45"
    data["ten_creator_batch"]["run_id_or_local_evidence_ref"] = "local-run-ten"
    data["ten_creator_batch"]["passed"] = True
    data["risk_stop_behavior"]["checked"] = True
    data["risk_stop_behavior"]["method"] = "controlled-test-page"
    data["risk_stop_behavior"]["risk_text_seen"] = "验证码"
    data["risk_stop_behavior"]["app_paused_or_stopped"] = True
    data["final_assessment"]["safe_enough_for_normal_internal_use"] = True
    data["final_assessment"]["remaining_concerns"] = "Recheck after PGY page or account behavior changes."
    return data


def assert_has_error(data: dict, expected: str) -> None:
    errors = validate_record(data)
    assert any(expected in err for err in errors), f"expected {expected!r} in {errors}"


def main() -> int:
    ok = completed_record()
    assert validate_record(ok) == []

    placeholder = completed_record()
    placeholder["operator_alias"] = "sanitized-initials"
    assert_has_error(placeholder, "operator_alias")

    no_times = completed_record()
    no_times["small_batch"]["started_at_local"] = ""
    assert_has_error(no_times, "small_batch.started_at_local")

    no_evidence = completed_record()
    no_evidence["ten_creator_batch"]["run_id_or_local_evidence_ref"] = ""
    assert_has_error(no_evidence, "ten_creator_batch.run_id_or_local_evidence_ref")

    wrong_method = completed_record()
    wrong_method["risk_stop_behavior"]["method"] = "real-risk-page or controlled-test-page"
    assert_has_error(wrong_method, "risk_stop_behavior.method")

    leaked_url = completed_record()
    leaked_url["small_batch"]["run_id_or_local_evidence_ref"] = "https://pgy.xiaohongshu.com/private"
    assert_has_error(leaked_url, "forbidden URL")

    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "record.json"
        path.write_text(json.dumps(ok, ensure_ascii=False), encoding="utf-8")
        assert path.exists()

    print("test_pgy_live_validation.py OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
