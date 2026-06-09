#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "1) 安装依赖..."
npm install

echo "2) 打包 mac dmg..."
npm run dist:mac

echo "3) 打包完成，打开输出目录 dist/"
open dist || true

