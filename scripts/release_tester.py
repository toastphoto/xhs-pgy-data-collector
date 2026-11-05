#!/usr/bin/env python3
"""Per-artifact release checks. No installation, production login, or real sends."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = 1
MANUAL = {
    "installed-upgrade": ("安装升级与数据保留", ["install-and-launch", "accounts-settings-data-preserved", "restart-and-backend"]),
    "live-collection": ("真实账号采集与导出", ["pagination-and-order", "pause-stop-recover", "contacts-and-selected-export"]),
    "live-invite-prepare": ("真实账号连续准备，不发送", ["same-batch-three-creators", "brand-selected-and-fields-read-back", "zero-final-sends"]),
    "live-feishu": ("飞书真实往返", ["lookup-and-backfill", "maintainer-dedup-quotes", "marked-test-write-read-cleanup"]),
    "windows-distribution": ("另一台 Windows 交付检查", ["install-warning-reviewed", "launch-backend-and-input", "layout-and-login"]),
}


def manual_gates(variant="feishu-project"):
    if variant not in {"feishu-project", "feishu-bitable"}:
        raise ValueError("Unknown product variant")
    gates = dict(MANUAL)
    if variant == "feishu-bitable":
        gates.pop("live-feishu")
        gates["live-bitable"] = ("多维表格真实往返", [
            "link-auth-schema-and-team-access", "selected-batch-create-read-update-backfill",
            "identity-maintainer-conflicts-quotes", "restart-stop-unknown-outcome-reconcile",
            "two-client-concurrency", "marked-test-write-read-cleanup"])
        gates["edition-isolation"] = ("原版与多维表格版并存", [
            "independent-install-profile-session-backend", "no-feishu-project-requests",
            "original-data-and-shortcuts-unchanged"])
    return gates


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(file):
    return json.loads(Path(file).read_text(encoding="utf-8-sig"))


def save_json(file, value):
    file = Path(file)
    temp = file.with_suffix(file.suffix + ".new")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(file)


def sha(file):
    digest = hashlib.sha256()
    with Path(file).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def digest_json(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=True).encode()).hexdigest()


def source_snapshot(root=ROOT):
    # Explicit source directories, not user runs, credentials, caches or old installers.
    paths = set()
    for name in ["desktop-app/lib", "desktop-app/renderer", "desktop-app/tests", "desktop-app/scripts",
                 "desktop-app/templates", "scripts", "content-analyzer/app"]:
        folder = root / name
        if folder.exists():
            for file in folder.rglob("*"):
                if file.is_file() and file.suffix in {".py", ".js", ".cjs", ".mjs", ".json", ".css", ".html", ".cmd"}:
                    if not set(file.relative_to(folder).parts) & {"node_modules", "__pycache__", "data", "logs", "output"}:
                        paths.add(file)
    for name in ["desktop-app/main.js", "desktop-app/preload.js", "desktop-app/package.json", "desktop-app/package-lock.json",
                 "content-analyzer/main.py", "content-analyzer/requirements.txt", "scripts/release-test.cmd"]:
        if (root / name).is_file():
            paths.add(root / name)
    return {p.relative_to(root).as_posix(): sha(p) for p in sorted(paths)}


def package_commands(pkg):
    commands = []
    for section in ["pretest", "test"]:
        script = pkg.get("scripts", {}).get(section, "").strip()
        if not script:
            raise ValueError(f"Missing package script: {section}")
        for i, segment in enumerate(script.split("&&"), 1):
            argv = shlex.split(segment)
            if len(argv) < 2 or argv[0] != "node" or any(re.search(r"[|;<>`$\r\n]", arg) for arg in argv):
                raise ValueError(f"Unsupported test command; update runner explicitly: {segment}")
            commands.append((f"{section}-{i:02d}", argv[1:]))
    return commands


def plan(pkg, node, python):
    checks = [{"id": key, "scope": "source", "argv": [node, *argv], "cwd": str(ROOT / "desktop-app"), "timeout": 240}
              for key, argv in package_commands(pkg)]
    if pkg.get("productVariant") == "feishu-bitable":
        checks.append({"id": "bitable-foundation", "scope": "source", "argv": [node, "--test", "tests/bitable_foundation.test.js"],
                       "cwd": str(ROOT / "desktop-app"), "timeout": 120})
    for key, args in [
        ("tester-self-test", ["-B", "-m", "unittest", "discover", "-s", "scripts", "-p", "test_release_tester.py"]),
        ("project-memory", ["scripts/verify_project_memory.py"]),
        ("pgy-safety", ["scripts/audit_pgy_safety.py"]),
        ("live-record-validator-tests", ["-B", "scripts/test_pgy_live_validation.py"]),
    ]:
        checks.append({"id": key, "scope": "source", "argv": [python, *args], "cwd": str(ROOT), "timeout": 120})
    for key, file in [
        ("export-ui", "resource_export.ui.test.js"),
        ("feishu-ui", "feishu_workbench.ui.test.js"),
        ("review-scroll-ui", "contact_review_scroll.ui.test.js"),
        ("encrypted-config-native", "feishu_connection_store.electron.test.js"),
        ("backend-lifecycle", "backend_lifecycle.test.js"),
        ("qa-runtime", "qa_runtime.test.js"),
        ("invite-dom", "pgy_invite_dom.test.js"),
    ]:
        checks.append({"id": key, "scope": "source-fixture", "argv": [node, f"tests/{file}"], "cwd": str(ROOT / "desktop-app"), "timeout": 180})
    checks.append({"id": "feishu-auth-diagnostics", "scope": "source", "argv": [node, "--test", "tests/feishu_plugin_auth.test.js", "tests/feishu_platform_diagnostic.test.js", "tests/feishu_probe.test.js"], "cwd": str(ROOT / "desktop-app"), "timeout": 180})
    for key, file, target in [
        ("backend-lifecycle-review", "backend_lifecycle_review.test.cjs", ROOT / "desktop-app"),
        ("backend-supervisor", "backend_supervisor_boundaries.test.cjs", ROOT / "desktop-app/lib/qa_backend_supervisor.js"),
        ("backend-supervisor-windows", "backend_supervisor_windows.test.cjs", ROOT / "desktop-app/lib/qa_backend_supervisor.js"),
    ]:
        checks.append({"id": key, "scope": "source-fixture", "argv": [node, str(ROOT / "desktop-app/tests" / file), str(target)], "cwd": "isolated-evidence", "timeout": 180})
    checks.append({"id": "installer-payload", "scope": "artifact", "argv": [], "cwd": str(ROOT / "desktop-app"), "timeout": 300})
    checks.append({"id": "packaged-backend", "scope": "artifact-backend", "argv": [], "cwd": str(ROOT), "timeout": 120})
    for key, file in [("packaged-recovery", "task_recovery.electron.test.cjs"), ("packaged-invite-brand-layout", "pgy_invite_flow.electron.test.js")]:
        checks.append({"id": key, "scope": "artifact-fixture", "argv": [node, f"tests/{file}"], "cwd": str(ROOT / "desktop-app"), "timeout": 480})
    return checks


def clean_env():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("PGY_", "FEISHU_", "ELECTRON_")) and k != "NODE_OPTIONS"}
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def execute(argv, cwd, log, timeout, env):
    started = time.monotonic()
    status, detail, code = "failed", "", None
    with Path(log).open("w", encoding="utf-8") as output:
        try:
            proc = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT,
                                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
                                    start_new_session=os.name != "nt")
            try:
                code = proc.wait(timeout=timeout)
                status = "passed" if code == 0 else "failed"
                detail = f"exit {code}"
            except subprocess.TimeoutExpired:
                # Kill only this test's child tree, never matching product names.
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], stdout=output, stderr=subprocess.STDOUT, timeout=30)
                else:
                    import signal
                    os.killpg(proc.pid, signal.SIGKILL)
                proc.wait(timeout=30)
                detail = f"timeout after {timeout}s"
        except (OSError, subprocess.SubprocessError) as error:
            detail = f"{type(error).__name__}: {error}"
            output.write(detail)
    text = Path(log).read_text(encoding="utf-8", errors="replace")
    if status == "passed" and (re.search(r"(?:#|ℹ)\s+(?:skipped|todo) [1-9]\d*", text) or re.search(r"OK \(skipped=[1-9]", text)):
        status, detail = "blocked", "Test reported skipped/TODO cases; review coverage, not a full pass"
    return {"status": status, "detail": detail, "exitCode": code, "seconds": round(time.monotonic() - started, 2), "log": str(log), "logSha256": sha(log)}


def summarize(report):
    checks = report.get("checks", [])
    automatic = "passed" if checks and all(c["status"] == "passed" for c in checks) else "failed" if any(c["status"] == "failed" for c in checks) else "blocked"
    manual = report.get("manual", {})
    delivered = automatic == "passed" and set(manual) == set(manual_gates(report.get("productVariant", "feishu-project"))) and all(m["status"] == "passed" for m in manual.values())
    return {"automatic": automatic, "delivery": "passed" if delivered else "blocked",
            "counts": {s: sum(c["status"] == s for c in checks) for s in ["passed", "failed", "blocked", "pending", "running"]}}


def persist(report, file):
    report["summary"] = summarize(report)
    save_json(file, report)
    esc = lambda s: html.escape(str(s))
    label = {"passed": "通过", "failed": "失败", "blocked": "未放行", "pending": "待验", "running": "运行中"}
    rows = "".join(f'<tr><td>{esc(c["id"])}</td><td>{esc(c["scope"])}</td><td class="{c["status"]}">{label[c["status"]]}</td>'
                   f'<td>{esc(c.get("detail", ""))}</td><td><a href="{esc(Path(c["log"]).relative_to(file.parent).as_posix())}">日志</a></td></tr>'
                   if c.get("log") else f'<tr><td>{esc(c["id"])}</td><td>{esc(c["scope"])}</td><td>{label[c["status"]]}</td><td colspan="2">{esc(c.get("detail", ""))}</td></tr>' for c in report["checks"])
    gates = manual_gates(report.get("productVariant", "feishu-project"))
    manual_rows = "".join(f'<tr><td>{esc(gates[k][0])}</td><td>{label[v["status"]]}</td><td>{esc(v.get("detail", "需要人工真实验收"))}</td></tr>' for k, v in report["manual"].items())
    source_ver = report.get("sourceVersion", "unknown")
    package_ver = report.get("artifact", {}).get("version", "未核实")
    body = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>版本交付验收报告</title><style>body{{font:15px/1.6 system-ui,sans-serif;color:#20252b;margin:28px auto;padding:0 20px;max-width:1200px}}h1{{font-size:26px}}table{{border-collapse:collapse;width:100%;margin:16px 0}}td,th{{border:1px solid #d5dbe0;padding:8px;text-align:left;overflow-wrap:anywhere}}.passed{{color:#126846}}.failed{{color:#b32327}}code{{overflow-wrap:anywhere}}.table{{overflow-x:auto}}a{{color:#185aaa}}</style>
<h1>版本交付验收报告</h1><p>自动检查：<b>{label[report["summary"]["automatic"]]}</b>　交付结论：<b>{label[report["summary"]["delivery"]]}</b></p>
<p>源码版本 {esc(source_ver)} · 安装包版本 {esc(package_ver)} · {esc(report["startedAt"])}</p>
<p>安装包 SHA256：<code>{esc(report.get("installerSha256", "未指定"))}</code></p>
<p>源码检查不等于包内检查；artifact-fixture 使用 EXE 解出的实际程序及本地虚构页面，不代表真实平台成功。测试不会安装软件、使用真实登录、发邀约或修改飞书。</p>
<h2>自动检查</h2><div class="table"><table><tr><th>检查</th><th>证据范围</th><th>状态</th><th>结果</th><th>详情</th></tr>{rows}</table></div>
<h2>真实验收与交付</h2><table><tr><th>检查</th><th>状态</th><th>记录</th></tr>{manual_rows}</table>
<p>本报告是此次运行的快照。交付前必须运行 verify，重新核对安装包、源码、日志和人工记录；换包或改代码后原报告不可复用。未签名安装包仍需核对 Windows 提示，不自动关闭系统安全功能。</p>
<p><a href="report.json">完整 JSON 报告</a> · <a href="evidence/">截图和原生检查证据</a></p></html>'''
    file.with_suffix(".html").write_text(body, encoding="utf-8")


def run(args):
    node = args.node or shutil.which("node")
    if not node:
        raise ValueError("Node is missing. Specify --node; the tester never installs dependencies silently.")
    pkg = read_json(ROOT / "desktop-app/package.json")
    output = Path(args.output or ROOT / "tmp/release-tests").resolve() / (datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid4().hex[:8])
    output.mkdir(parents=True)
    (output / "logs").mkdir()
    report_file = output / "report.json"
    installer = Path(args.installer).resolve() if args.installer else None
    if installer and not installer.is_file():
        raise ValueError(f"Installer does not exist: {installer}")
    checks = plan(pkg, node, sys.executable)
    variant = pkg.get("productVariant", "feishu-project")
    report = {"schemaVersion": SCHEMA, "startedAt": now(), "root": str(ROOT), "sourceVersion": pkg["version"],
              "productVariant": variant,
              "sourceFiles": source_snapshot(), "planHash": digest_json(checks), "node": node, "python": sys.executable,
              "installer": str(installer) if installer else None, "installerSha256": sha(installer) if installer else None,
              "checks": [{**c, "status": "pending"} for c in checks],
              "manual": {k: {"status": "pending"} for k in manual_gates(variant)}}
    persist(report, report_file)
    print(f"Report: {report_file}", flush=True)
    env = clean_env()
    if args.node_path:
        env["NODE_PATH"] = args.node_path
    chrome = args.chrome or env.get("CHROME_PATH")
    if not chrome:
        cached = sorted((Path(os.environ.get("LOCALAPPDATA", "")) / "ms-playwright").glob("chromium-*/chrome-win64/chrome.exe"), reverse=True)
        chrome = next((str(p) for p in [*cached, Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Google/Chrome/Application/chrome.exe",
                                       Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Microsoft/Edge/Application/msedge.exe"] if p.is_file()), None)
    if chrome:
        env["CHROME_PATH"] = chrome
    report["runtimes"] = {"chrome": chrome, "nodePath": env.get("NODE_PATH", ""), "platform": sys.platform}
    for check in report["checks"]:
        key = check["id"]
        check["status"] = "running"
        persist(report, report_file)
        print(f"RUN  {key}", flush=True)
        local_env = {**env}
        argv = check["argv"]
        cwd = check["cwd"]
        if cwd == "isolated-evidence":
            cwd = output / "evidence" / key
            cwd.mkdir(parents=True)
        if key == "installer-payload":
            if not installer:
                check.update(status="blocked", detail="Source-only run; installer not supplied")
                persist(report, report_file)
                continue
            argv = [node, "scripts/release-artifact.cjs", str(installer), str(output / "artifact")]
        elif check["scope"] in {"artifact-fixture", "artifact-backend"}:
            if not report.get("artifact"):
                check.update(status="blocked", detail="Installer payload verification did not pass")
                persist(report, report_file)
                continue
            if key == "packaged-backend":
                argv = [sys.executable, "scripts/test_packaged_backend.py", str(Path(report["artifact"]["payload"]) / "resources/content-analyzer-backend/xhs-pgy-backend.exe")]
            local_env.update(PGY_APP_EXE=report["artifact"]["executable"], PGY_EXPECT_VERSION=report["artifact"]["version"],
                             PGY_TEST_OUTPUT_DIR=str(output / "evidence" / key))
            if key == "packaged-invite-brand-layout":
                local_env.update(PGY_BRAND_SEARCH_TEST="1", PGY_VIEW_LIFECYCLE_TEST="1", PGY_REVIEW_SCROLL_TEST="1", PGY_COMPOSER_INPUT_TEST="1")
        check.update(execute(argv, cwd, output / "logs" / f"{key}.log", check["timeout"], local_env))
        if key == "installer-payload" and check["status"] == "passed":
            try:
                report["artifact"] = read_json(output / "artifact/identity.json")
                if report["artifact"]["installerSha256"] != report["installerSha256"]:
                    raise ValueError("Installer changed while tests were running")
                if report["artifact"].get("productVariant", "feishu-project") != variant:
                    raise ValueError("Installer belongs to another product variant")
            except (OSError, ValueError) as error:
                report.pop("artifact", None)
                check.update(status="failed", detail=str(error))
        if check["scope"] == "artifact-fixture" and check["status"] == "passed":
            try:
                result = read_json(output / "evidence" / key / ("native-result.json" if key == "packaged-recovery" else "result.json"))
                if result.get("ok") is not True or result.get("version") != report["artifact"]["version"]:
                    raise ValueError("Native report is missing a passing result for this version")
                if key == "packaged-invite-brand-layout" and not any(o.get("rendererUnsentBatch") for o in result.get("outcomes", [])):
                    raise ValueError("Full same-batch preparation was not exercised")
                check["evidence"] = str(output / "evidence" / key)
            except (OSError, ValueError) as error:
                check.update(status="failed", detail=str(error))
        print(f'{check["status"].upper():7} {key}: {check["detail"]}', flush=True)
        persist(report, report_file)
    if source_snapshot() != report["sourceFiles"]:
        report["checks"].append({"id": "source-stability", "scope": "identity", "status": "failed", "detail": "Source changed during the run; rerun on a stable tree"})
    report["finishedAt"] = now()
    for key, (_, cases) in manual_gates(variant).items():
        save_json(output / f"manual-{key}.json", {"gate": key, "installerSha256": report["installerSha256"],
                  "productVariant": variant,
                  "operator": "", "observedAt": "", "summary": "", "checks": {case: "pending" for case in cases}})
    persist(report, report_file)
    print(json.dumps(report["summary"], ensure_ascii=False), flush=True)
    print(f"Report: {report_file.with_suffix('.html')}", flush=True)
    return exit_code(report)


def validate_manual(record, gate, installer_hash, variant="feishu-project"):
    gates = manual_gates(variant)
    if record.get("productVariant", "feishu-project") != variant:
        raise ValueError("Manual evidence belongs to another product variant")
    if gate not in gates or record.get("gate") != gate or not installer_hash or record.get("installerSha256") != installer_hash:
        raise ValueError("Manual evidence belongs to another installer or gate")
    for key in ["operator", "observedAt", "summary"]:
        if not isinstance(record.get(key), str) or not record[key].strip():
            raise ValueError(f"Manual evidence missing {key}")
    datetime.fromisoformat(record["observedAt"].replace("Z", "+00:00"))
    required = set(gates[gate][1])
    if set(record.get("checks", {})) != required or any(record["checks"][case] != "passed" for case in required):
        raise ValueError("Every required case needs an observed passing result; pending/failed cases cannot release")


def verify_integrity(report, root=ROOT):
    if report.get("schemaVersion") != SCHEMA:
        raise ValueError("Unsupported report schema")
    if source_snapshot(root) != report.get("sourceFiles"):
        raise ValueError("Source or test code changed. Run acceptance again; do not reuse the report.")
    pkg = read_json(root / "desktop-app/package.json")
    variant = pkg.get("productVariant", "feishu-project")
    if report.get("productVariant", "feishu-project") != variant:
        raise ValueError("Report belongs to another product variant")
    expected = plan(pkg, report["node"], report["python"])
    if report.get("planHash") != digest_json(expected) or [c["id"] for c in report["checks"]] != [c["id"] for c in expected]:
        raise ValueError("Required check plan is incomplete or changed")
    if not report.get("finishedAt"):
        raise ValueError("Test run is incomplete")
    installer = report.get("installer")
    if not installer or not Path(installer).is_file() or sha(installer) != report.get("installerSha256"):
        raise ValueError("Installer missing/changed; this report cannot release it")
    artifact = report.get("artifact")
    if not artifact or artifact.get("installerSha256") != report["installerSha256"]:
        raise ValueError("Exact installer payload was not validated")
    if artifact.get("productVariant", "feishu-project") != variant:
        raise ValueError("Installer belongs to another product variant")
    payload = Path(artifact["payload"])
    expected_files = {item["path"]: item["sha256"] for item in artifact["inventory"]}
    actual_files = {f.relative_to(payload).as_posix(): sha(f) for f in payload.rglob("*") if f.is_file()}
    if not actual_files or actual_files != expected_files:
        raise ValueError("Tested payload missing/changed")
    for check in report["checks"]:
        if check["status"] == "passed" and (not check.get("logSha256") or check.get("exitCode") != 0):
            raise ValueError(f'Passing check lacks a successful process log: {check["id"]}')
        if check.get("logSha256") and (not Path(check["log"]).is_file() or sha(check["log"]) != check["logSha256"]):
            raise ValueError(f'Check log missing/changed: {check["id"]}')
    if set(report.get("manual", {})) != set(manual_gates(variant)):
        raise ValueError("Manual gates missing")
    for gate, record in report["manual"].items():
        if record["status"] == "passed":
            file = Path(record["evidence"])
            if not file.is_file() or sha(file) != record["evidenceSha256"]:
                raise ValueError(f"Manual evidence changed: {gate}")
            validate_manual(read_json(file), gate, report["installerSha256"], variant)


def exit_code(report):
    summary = summarize(report)
    return 1 if summary["automatic"] == "failed" else 0 if summary["delivery"] == "passed" else 2


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    run_parser = sub.add_parser("run", help="Run all automated gates; exit 2 means live/install acceptance is pending")
    choice = run_parser.add_mutually_exclusive_group(required=True)
    choice.add_argument("--installer")
    choice.add_argument("--source-only", action="store_true")
    run_parser.add_argument("--output", help="Parent directory; each run creates a unique child")
    run_parser.add_argument("--node")
    run_parser.add_argument("--node-path", help="Existing Playwright Node module directory (no auto-install)")
    run_parser.add_argument("--chrome", help="Existing Chrome/Chromium/Edge executable for isolated UI tests")
    verify = sub.add_parser("verify", help="Release gate: check current hashes, complete plan and manual evidence")
    verify.add_argument("--report", required=True)
    attest = sub.add_parser("record", help="Attach a completed, sanitized real acceptance record")
    attest.add_argument("--report", required=True)
    attest.add_argument("--evidence", required=True)
    deliver = sub.add_parser("deliver", help="Copy the approved installer into a NEW handoff directory only after all gates pass")
    deliver.add_argument("--report", required=True)
    deliver.add_argument("--to", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "run":
            return run(args)
        file = Path(args.report).resolve()
        report = read_json(file)
        verify_integrity(report)
        if args.command == "record":
            evidence_file = Path(args.evidence).resolve()
            evidence = read_json(evidence_file)
            gate = evidence.get("gate")
            validate_manual(evidence, gate, report["installerSha256"], report.get("productVariant", "feishu-project"))
            report["manual"][gate] = {"status": "passed", "evidence": str(evidence_file), "evidenceSha256": sha(evidence_file), "detail": evidence["summary"]}
            persist(report, file)
        if args.command == "deliver":
            if exit_code(report) != 0:
                print("NOT RELEASED: failed or pending gates; no installer was copied", file=sys.stderr)
                return exit_code(report)
            target = Path(args.to).resolve()
            target.mkdir(parents=True, exist_ok=False)
            copied = target / Path(report["installer"]).name
            with Path(report["installer"]).open("rb") as source, copied.open("xb") as destination:
                shutil.copyfileobj(source, destination)
            if sha(copied) != report["installerSha256"]:
                raise ValueError("Installer changed while copying. Handoff directory is NOT approved.")
            save_json(target / "ACCEPTED.json", {"version": report["artifact"]["version"], "installerSha256": report["installerSha256"],
                      "acceptedAt": now(), "reportSha256": sha(file), "automaticChecks": len(report["checks"]),
                      "productVariant": report.get("productVariant", "feishu-project"),
                      "manualGates": list(report["manual"]), "scope": "Recorded acceptance, not a guarantee of zero bugs"})
            print(f"Approved handoff: {target}")
        print(json.dumps(summarize(report), ensure_ascii=False))
        return exit_code(report)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"NOT RELEASED: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
