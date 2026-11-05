"""Launch only the supplied candidate backend, with synthetic dirs and a random local port."""
from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from uuid import uuid4


def main():
    executable = Path(sys.argv[1]).resolve()
    assert executable.is_file(), "Packaged backend is missing"
    root = Path(tempfile.mkdtemp(prefix="pgy-packaged-backend-"))
    results = []
    # No inherited account settings, platform URLs, proxies or API credentials.
    keys = ["SYSTEMROOT", "WINDIR", "PATH", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA"]
    base_env = {key: os.environ[key] for key in keys if key in os.environ}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for cycle in range(2):
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            port = reservation.getsockname()[1]
        instance = uuid4().hex
        env = {**base_env, "PYTHON_DOTENV_DISABLED": "1", "API_HOST": "127.0.0.1", "API_PORT": str(port),
               "API_TOKEN": instance, "DESKTOP_INSTANCE_TOKEN": instance, "DEBUG": "false", "PYTHONIOENCODING": "utf-8",
               "ENABLE_LEGACY_CRAWL_API": "false", "ALLOW_STEALTH_EVASION": "false", "CHROME_ATTACH_EXISTING": "false",
               **{key: str(root / key.lower()) for key in ["DATA_DIR", "OUTPUT_DIR", "LOG_DIR"]}}
        log = (root / f"backend-{cycle}.log").open("w", encoding="utf-8")
        proc = subprocess.Popen([str(executable)], cwd=root, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0)
        try:
            def get(endpoint, authenticated=True):
                request = urllib.request.Request(f"http://127.0.0.1:{port}{endpoint}", headers={"X-API-Token": instance} if authenticated else {})
                with opener.open(request, timeout=2) as response:
                    return json.load(response)

            deadline = time.monotonic() + 45
            while True:
                assert proc.poll() is None, f"Packaged backend exited early; local diagnostic log: {log.name}"
                try:
                    health = get("/api/desktop/health")
                    break
                except urllib.error.HTTPError:
                    raise AssertionError("Local backend did not accept its isolated instance token") from None
                except (urllib.error.URLError, TimeoutError, ConnectionError):
                    if time.monotonic() >= deadline:
                        raise AssertionError(f"Packaged backend not ready; local diagnostic log: {log.name}") from None
                    time.sleep(0.2)
            assert health.get("ok") is True and health.get("instance_token") == instance, "Response is not from this test instance"
            config = get("/api/config")
            assert config.get("legacy_crawl_api_enabled") is False, "Legacy crawl API must remain disabled"
            try:
                get("/api/config", authenticated=False)
            except urllib.error.HTTPError as error:
                assert error.code in (401, 403), "Unexpected unauthenticated response"
            else:
                raise AssertionError("Unauthenticated API request was not rejected")
            results.append({"cycle": cycle + 1, "started": True, "ownInstance": True, "authRequired": True, "legacyCrawlDisabled": True})
        finally:
            if proc.poll() is None:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], stdout=log, stderr=subprocess.STDOUT, timeout=20, check=True)
                else:
                    proc.terminate()
                proc.wait(timeout=20)
            log.close()
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            with socket.socket() as probe:
                probe.settimeout(0.2)
                if probe.connect_ex(("127.0.0.1", port)) != 0:
                    break
            time.sleep(0.2)
        else:
            raise AssertionError("Backend test process stopped but its local port remains occupied")
        results[-1]["stoppedAndPortReleased"] = True
    print(json.dumps({"ok": True, "localOnly": True, "cycles": results, "diagnostics": str(root)}, indent=2))


if __name__ == "__main__":
    main()
