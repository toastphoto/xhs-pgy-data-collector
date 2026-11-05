"""Interactive local-only credential entry; no secrets in argv, files or logs."""
import argparse
import getpass
import json
from pathlib import Path
import shutil
import subprocess
import sys
import warnings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', default=shutil.which('node'))
    parser.add_argument('--plugin-id')
    parser.add_argument('--project-key')
    parser.add_argument('--work-item-type-key')
    args = parser.parse_args()
    if not args.node or not sys.stdin.isatty():
        parser.error('Run in an interactive terminal with Node.js available.')
    print('Read-only test: sends credentials only to https://project.feishu.cn.')
    print('Exchanges a token and reads field metadata. No business records are changed.')
    config = {
        'pluginId': args.plugin_id or input('Plugin ID: ').strip(),
        'projectKey': args.project_key or input('Project key: ').strip(),
        'workItemTypeKey': args.work_item_type_key or input('Work item type key: ').strip(),
        'userKey': input('Acting user key (not a project key): ').strip(),
    }
    # Never fall back to echoed password input in a redirected console.
    with warnings.catch_warnings():
        warnings.simplefilter('error', getpass.GetPassWarning)
        config['pluginSecret'] = getpass.getpass('Plugin Secret (hidden, not saved): ')
    script = Path(__file__).resolve().parents[1] / 'desktop-app/scripts/probe-feishu-metadata.js'
    try:
        result = subprocess.run([args.node, str(script)], input=json.dumps(config),
                                capture_output=True, text=True, encoding='utf-8', timeout=45)
        payload = json.loads(result.stdout)
        print(json.dumps(payload, ensure_ascii=True, indent=2))
        return result.returncode
    except (OSError, ValueError, subprocess.TimeoutExpired):
        print('FEISHU_LOCAL_PROBE_FAILED (raw process output suppressed)')
        return 1
    finally:
        config['pluginSecret'] = ''


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (EOFError, KeyboardInterrupt, getpass.GetPassWarning):
        print('Cancelled; no further requests.')
        sys.exit(1)
