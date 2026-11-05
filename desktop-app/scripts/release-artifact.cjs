// Extract the requested NSIS without installing it or touching an existing profile.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');

function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function extract(zip, archive, dest, filters = []) {
  const result = spawnSync(zip, ['x', archive, `-o${dest}`, '-y', ...filters], {
    encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 4 * 1024 * 1024
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
}
function files(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    assert.equal(entry.isSymbolicLink(), false, 'Package must not link outside the extracted payload');
    return entry.isDirectory() ? files(file, base) : [{ path: path.relative(base, file).replaceAll('\\', '/'), sha256: sha(file) }];
  });
}
function main() {
  const [installerArg, outputArg] = process.argv.slice(2);
  assert.ok(installerArg && outputArg, 'Usage: node release-artifact.cjs INSTALLER NEW_OUTPUT_DIRECTORY');
  assert.equal(process.platform, 'win32', 'Windows package verification requires Windows');
  const installer = path.resolve(installerArg), output = path.resolve(outputArg);
  assert.equal(fs.existsSync(output), false, 'Do not overwrite a previous extraction');
  assert.equal(fs.readFileSync(installer).subarray(0, 2).toString(), 'MZ', 'Not a Windows executable');
  fs.mkdirSync(output, { recursive: true });
  const zip = require('7zip-bin').path7za;
  const payload = path.join(output, 'payload');
  assert.ok(fs.readFileSync(installer).includes(Buffer.from('NullsoftInst')), 'Expected an NSIS executable');
  // 7za may expose the embedded 7z directly, not an outer $PLUGINSDIR archive.
  extract(zip, installer, payload);
  if (!fs.existsSync(path.join(payload, 'resources', 'app.asar'))) {
    const archive = path.join(payload, '$PLUGINSDIR', 'app-64.7z');
    assert.ok(fs.existsSync(archive), 'Expected NSIS application payload is missing');
    extract(zip, archive, payload);
  }
  const asarPath = path.join(payload, 'resources', 'app.asar');
  const pkg = JSON.parse(asar.extractFile(asarPath, 'package.json').toString());
  const productVariant = pkg.productVariant || 'feishu-project';
  assert.ok(['feishu-project', 'feishu-bitable'].includes(productVariant), 'Unknown product variant');
  assert.equal(pkg.name, productVariant === 'feishu-bitable' ? 'pgy-workbench-bitable' : 'content-analyzer-desktop', 'Not this product');
  if (productVariant === 'feishu-bitable') {
    assert.equal(pkg.desktopAppId, 'com.solo.contentanalyzer.bitable', 'Bitable installer must not replace the original edition');
    assert.ok(asar.extractFile(asarPath, path.normalize('lib/bitable_runtime.js')).length, 'Bitable runtime missing');
  }
  assert.match(pkg.version, /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/);
  for (const name of ['main.js', 'preload.js', 'renderer/index.html', 'renderer/views/tasks.js', 'renderer/views/exports.js']) {
    assert.ok(asar.extractFile(asarPath, path.normalize(name)).length, `Missing packaged file ${name}`);
  }
  const forbidden = asar.listPackage(asarPath).filter(name => /(?:^|[\\/])(?:\.env(?:\..+)?|ai_config\.json|task_state\.json|cookies?\.json)$/.test(name));
  assert.deepEqual(forbidden, [], 'Runtime/private files must not be bundled');
  const exes = fs.readdirSync(payload).filter(name => name.endsWith('.exe') && !/uninstall/i.test(name));
  assert.equal(exes.length, 1, 'Cannot identify a unique product executable');
  const executable = path.join(payload, exes[0]);
  const backend = path.join(payload, 'resources', 'content-analyzer-backend', 'xhs-pgy-backend.exe');
  assert.ok(fs.existsSync(backend), 'Windows Python backend is missing');
  assert.ok(fs.existsSync(path.join(payload, 'resources', 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')), 'Unpacked SQLite WASM is missing');
  const inventory = files(payload).sort((a, b) => a.path.localeCompare(b.path));
  const identity = { installer, installerSha256: sha(installer), version: pkg.version, productVariant,
    payload, executable, asarSha256: sha(asarPath), backendSha256: sha(backend), inventory };
  fs.writeFileSync(path.join(output, 'identity.json'), JSON.stringify(identity, null, 2));
  console.log(`Verified NSIS payload ${pkg.version}; ${inventory.length} files; installer sha256=${identity.installerSha256}`);
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
