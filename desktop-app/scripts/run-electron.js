/**
 * 目的：
 * - 让 `npm run dev` 在缺少 node_modules/.bin/electron 或 electron dist 未下载时也能启动
 * - 若 electron 二进制不存在，则自动执行 electron 的 install.js 下载对应平台的 dist
 *
 * 注意：首次运行可能需要联网下载 Electron。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const electronPkgDir = path.join(projectRoot, 'node_modules', 'electron');
const installJs = path.join(electronPkgDir, 'install.js');

function tryResolveElectronBinary() {
  try {
    // electron 包在 Node 环境下导出的是可执行文件路径（string）
    const p = require('electron');
    if (typeof p === 'string' && p && fs.existsSync(p)) return p;
    return null;
  } catch (_) {
    return null;
  }
}

function runInstallIfNeeded() {
  if (!fs.existsSync(electronPkgDir)) {
    console.error('[run-electron] 未找到 node_modules/electron。请先执行 npm install。');
    process.exit(1);
  }
  if (!fs.existsSync(installJs)) {
    console.error('[run-electron] 未找到 electron/install.js：', installJs);
    process.exit(1);
  }

  console.log('[run-electron] Electron 二进制缺失，尝试执行 install.js 下载...');
  const r = spawnSync(process.execPath, [installJs], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env
  });
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
}

let electronBin = tryResolveElectronBinary();
if (!electronBin) {
  runInstallIfNeeded();
  electronBin = tryResolveElectronBinary();
}

if (!electronBin) {
  console.error('[run-electron] 仍无法解析 Electron 二进制路径，请检查 npm install 是否成功。');
  process.exit(1);
}

const args = ['.'].concat(process.argv.slice(2));
const res = spawnSync(electronBin, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env
});
process.exit(res.status || 0);

