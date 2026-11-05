const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createFeishuConnectionStore } = require('../lib/feishu_connection_store');
const { createFeishuMaintainerStore } = require('../lib/feishu_maintainer_store');
const choiceScope = 'a'.repeat(64);
const choicePerson = { name: 'Fixture Operator', userKey: 'fixture-member', username: '', stamp: 'b'.repeat(64) };
const fixture = { pluginId: 'fixture-plugin', projectKey: 'fixture-project', workItemTypeKey: 'fixture-type',
  userKey: 'fixture-user', pluginSecret: 'fixture-private-value' };
if (process.versions.electron) {
  const { app, safeStorage } = require('electron');
  const dir = process.argv.at(-1), mode = process.argv.at(-2);
  const checkpoint = stage => fs.writeFileSync(path.join(dir, `${mode}-stage.txt`), stage);
  checkpoint('main-loaded');
  const profile = path.join(dir, 'electron-profile');
  fs.mkdirSync(profile, { recursive: true });
  app.setPath('userData', profile);
  app.disableHardwareAcceleration();
  app.whenReady().then(() => {
    checkpoint('app-ready');
    const file = path.join(dir, 'connection.bin');
    const instrumented = {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      encryptString(value) { checkpoint('encrypting'); const bytes = safeStorage.encryptString(value); checkpoint('encrypted'); return bytes; },
      decryptString(value) { checkpoint('decrypting'); const plain = safeStorage.decryptString(value); checkpoint('decrypted'); return plain; }
    };
    const store = createFeishuConnectionStore({ file, safeStorage: instrumented });
    const preference = createFeishuMaintainerStore({ file: path.join(dir, 'maintainer.bin'), safeStorage: instrumented });
    assert.equal(safeStorage.isEncryptionAvailable(), true);
    checkpoint('encryption-available');
    if (mode === 'write') {
      store.write(fixture);
      checkpoint('encrypted-save');
      const bytes = fs.readFileSync(file);
      for (const value of Object.values(fixture)) assert.equal(bytes.includes(Buffer.from(value)), false);
      preference.write(choiceScope, { ...choicePerson, token: 'never-persist-authority', expiresAt: 42 });
      const choiceBytes = fs.readFileSync(path.join(dir, 'maintainer.bin'));
      assert.equal(choiceBytes.includes(Buffer.from(choicePerson.name)), false);
      assert.deepEqual(fs.readFileSync(file), bytes, 'choice save must not rewrite connection credentials');
    } else {
      assert.deepEqual(store.read(), { autoConnect: true, config: fixture });
      assert.deepEqual(preference.read(choiceScope), choicePerson);
      assert.equal(preference.read('c'.repeat(64)), null);
      checkpoint('decrypted-read');
      store.suspend(); assert.equal(store.read().autoConnect, false);
      store.forget(); assert.equal(store.read(), null);
      assert.deepEqual(preference.read(choiceScope), choicePerson);
    }
    checkpoint('passed');
    app.quit();
  }).catch(error => { console.error(`OS encrypted connection verification failed: ${/^FEISHU_[A-Z_]+$/.test(error.code || '') ? error.code : 'ASSERTION'}`); app.exit(1); });
} else {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-os-vault-'));
  try {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    for (const mode of ['write', 'read']) {
      const result = spawnSync(process.env.FEISHU_TEST_ELECTRON || require('electron').trim(), [__filename, mode, dir], { env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
      const stageFile = path.join(dir, `${mode}-stage.txt`);
      const stage = fs.existsSync(stageFile) ? fs.readFileSync(stageFile, 'utf8') : 'before-main';
      assert.equal(result.status, 0, `separate Electron process must succeed: ${stage} / ${result.error?.code || result.stderr || 'native-exit'}`);
      assert.equal(stage, 'passed', 'A zero exit without executing the complete native test is not a pass');
    }
    console.log('Windows safeStorage encrypted connection and identity preference cross-process restore: PASS (fictional data only)');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
