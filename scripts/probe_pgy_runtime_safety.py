#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


def request(method: str, url: str, body: dict | None = None) -> tuple[int, str]:
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode("utf-8", errors="replace")


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe the running PGY backend safety posture.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8010")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    errors: list[str] = []

    status, config_text = request("GET", f"{base}/api/config")
    require(status == 200, f"GET /api/config expected 200, got {status}", errors)
    try:
        config = json.loads(config_text)
    except Exception:
        config = {}
        errors.append("GET /api/config did not return JSON")

    require(config.get("use_proxy") is False, "Backend must report use_proxy=false", errors)
    require(config.get("headless") is False, "Backend must report headless=false", errors)
    require(config.get("legacy_crawl_api_enabled") is False, "Legacy crawl API must be disabled by default", errors)

    status, crawl_text = request(
        "POST",
        f"{base}/api/crawl/start",
        {"urls": ["https://pgy.xiaohongshu.com/"], "max_contents": 1},
    )
    require(status == 403, f"POST /api/crawl/start expected 403 when legacy API is disabled, got {status}", errors)
    require("旧采集 API 默认禁用" in crawl_text, "Legacy crawl disabled message was not returned", errors)

    status, root_text = request("GET", f"{base}/")
    require(status == 200, f"GET / expected 200, got {status}", errors)
    require("旧采集台已禁用" in root_text, "Root page must show disabled legacy collection notice", errors)

    if errors:
        print("PGY runtime safety probe failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("PGY runtime safety probe OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
