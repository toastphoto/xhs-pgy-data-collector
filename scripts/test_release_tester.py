from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import release_tester as rt


class ReleaseTesterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="pgy-release-tester-")
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def test_parse_pretest_and_test_without_npm_or_shell(self):
        commands = rt.package_commands({"scripts": {"pretest": "node one.js && node --test two.js", "test": 'node "with space.js"'}})
        self.assertEqual(commands[-1], ("test-01", ["with space.js"]))
        self.assertEqual(commands[1][1], ["--test", "two.js"])

    def test_unknown_shell_command_is_not_silently_skipped(self):
        for script in ["", "npm test", "node one.js | more", "node one.js; node two.js"]:
            with self.subTest(script=script), self.assertRaises(ValueError):
                rt.package_commands({"scripts": {"pretest": script, "test": "node test.js"}})

    def test_source_hash_sees_uncommitted_changes_but_not_runtime_data(self):
        script = self.root / "desktop-app/lib/item.js"
        script.parent.mkdir(parents=True)
        script.write_text("before")
        original = rt.source_snapshot(self.root)
        private = self.root / "runs/account.json"
        private.parent.mkdir()
        private.write_text("not test input")
        self.assertEqual(rt.source_snapshot(self.root), original)
        script.write_text("after")
        self.assertNotEqual(rt.source_snapshot(self.root), original)

    def test_real_acceptance_not_implied_by_automation_pass(self):
        report = {"checks": [{"status": "passed"}], "manual": {g: {"status": "pending"} for g in rt.MANUAL}}
        self.assertEqual(rt.summarize(report)["automatic"], "passed")
        self.assertEqual(rt.exit_code(report), 2)
        for gate in report["manual"].values():
            gate["status"] = "passed"
        self.assertEqual(rt.exit_code(report), 0)
        report["checks"][0]["status"] = "failed"
        self.assertEqual(rt.exit_code(report), 1)

    def test_empty_or_incomplete_run_is_never_green(self):
        for checks in [[], [{"status": "pending"}], [{"status": "running"}], [{"status": "blocked"}]]:
            self.assertNotEqual(rt.exit_code({"checks": checks, "manual": {}}), 0)

    def test_manual_record_requires_this_installer_and_all_scenarios(self):
        gate = "live-invite-prepare"
        record = {"gate": gate, "installerSha256": "a" * 64, "operator": "Fixture reviewer",
                  "observedAt": "2026-10-23T12:00:00+08:00", "summary": "Fictional validator test only",
                  "checks": {case: "passed" for case in rt.MANUAL[gate][1]}}
        rt.validate_manual(record, gate, "a" * 64)
        with self.assertRaises(ValueError):
            rt.validate_manual(record, gate, "b" * 64)
        record["checks"]["zero-final-sends"] = "pending"
        with self.assertRaises(ValueError):
            rt.validate_manual(record, gate, "a" * 64)

    def test_environment_cannot_shorten_batch_or_inherit_runtime_settings(self):
        with patch.dict(os.environ, {"PGY_BRAND_PREPARE_SMOKE": "1", "PGY_APP_EXE": "real.exe", "FEISHU_TOKEN": "fixture", "ELECTRON_RUN_AS_NODE": "1", "NODE_OPTIONS": "--require fixture"}):
            env = rt.clean_env()
        for key in ["PGY_BRAND_PREPARE_SMOKE", "PGY_APP_EXE", "FEISHU_TOKEN", "ELECTRON_RUN_AS_NODE", "NODE_OPTIONS"]:
            self.assertNotIn(key, env)

    def test_process_failure_missing_executable_timeout_and_skip_are_not_passes(self):
        cases = [([sys.executable, "-c", "raise SystemExit(7)"], 5, "failed"),
                 ([str(self.root / "missing.exe")], 5, "failed"),
                 ([sys.executable, "-c", "import time; time.sleep(10)"], 0.1, "failed"),
                 ([sys.executable, "-c", "print('# skipped 2')"], 5, "blocked"),
                 ([sys.executable, "-c", "print('ℹ skipped 5')"], 5, "blocked"),
                 ([sys.executable, "-c", "print('# skipped 0')"], 5, "passed")]
        for index, (command, timeout, expected) in enumerate(cases):
            with self.subTest(index=index):
                result = rt.execute(command, self.root, self.root / f"{index}.log", timeout, rt.clean_env())
                self.assertEqual(result["status"], expected)

    def fixture_report(self):
        pkg = {"scripts": {"pretest": "node pre.js", "test": "node test.js"}}
        (self.root / "desktop-app").mkdir(exist_ok=True)
        rt.save_json(self.root / "desktop-app/package.json", pkg)
        installer = self.root / "fixture.exe"
        installer.write_bytes(b"MZ-fake-unit-fixture-not-executable")
        payload = self.root / "payload"
        payload.mkdir()
        (payload / "app.bin").write_bytes(b"fixture")
        commands = rt.plan(pkg, "node", "python")
        report = {"schemaVersion": 1, "sourceFiles": rt.source_snapshot(self.root), "planHash": rt.digest_json(commands),
                  "node": "node", "python": "python", "checks": [{**c, "status": "pending"} for c in commands],
                  "finishedAt": rt.now(), "installer": str(installer), "installerSha256": rt.sha(installer),
                  "artifact": {"installerSha256": rt.sha(installer), "payload": str(payload), "inventory": [{"path": "app.bin", "sha256": rt.sha(payload / "app.bin")}]},
                  "manual": {k: {"status": "pending"} for k in rt.MANUAL}}
        return report

    def test_gate_rejects_replaced_installer_and_payload(self):
        report = self.fixture_report()
        rt.verify_integrity(report, self.root)
        Path(report["installer"]).write_bytes(b"MZ-replaced")
        with self.assertRaisesRegex(ValueError, "Installer missing/changed"):
            rt.verify_integrity(report, self.root)
        report["installerSha256"] = rt.sha(report["installer"])
        report["artifact"]["installerSha256"] = report["installerSha256"]
        (Path(report["artifact"]["payload"]) / "app.bin").write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "payload missing/changed"):
            rt.verify_integrity(report, self.root)

    def test_gate_rejects_missing_check_old_source_and_incomplete_run(self):
        report = self.fixture_report()
        for kind in ["missing-check", "unfinished", "source"]:
            value = copy.deepcopy(report)
            if kind == "missing-check":
                value["checks"].pop()
            elif kind == "unfinished":
                value.pop("finishedAt")
            else:
                value["sourceFiles"] = {}
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                rt.verify_integrity(value, self.root)

    def test_gate_rejects_green_check_without_log(self):
        report = self.fixture_report()
        report["checks"][0]["status"] = "passed"
        with self.assertRaisesRegex(ValueError, "lacks a successful process log"):
            rt.verify_integrity(report, self.root)

    def test_deliver_does_not_copy_when_acceptance_is_pending(self):
        report = self.fixture_report()
        file = self.root / "report.json"
        rt.save_json(file, report)
        target = self.root / "not-created"
        with patch.object(rt, "verify_integrity"):
            code = rt.main(["deliver", "--report", str(file), "--to", str(target)])
        self.assertEqual(code, 2)
        self.assertFalse(target.exists())

    def test_report_escapes_text_and_keeps_local_logs_linked(self):
        report = {"startedAt": "fixture", "checks": [{"id": "<unsafe>", "scope": "source", "status": "failed", "detail": "<script>"}],
                  "manual": {k: {"status": "pending"} for k in rt.MANUAL}}
        file = self.root / "report.json"
        rt.persist(report, file)
        text = file.with_suffix(".html").read_text(encoding="utf-8")
        self.assertNotIn("<script>", text)
        self.assertIn("&lt;script&gt;", text)
        self.assertEqual(json.loads(file.read_text(encoding="utf-8"))["summary"]["delivery"], "blocked")


if __name__ == "__main__":
    unittest.main()
