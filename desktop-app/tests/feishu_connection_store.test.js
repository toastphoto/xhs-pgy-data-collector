const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createFeishuConnectionStore } = require('../lib/feishu_connection_store');
const { createFeishuMaintainerStore } = require('../lib/feishu_maintainer_store');

test('maintainer preference is encrypted, scoped and contains no authority or credentials', t => {
  const f = fixture(t), file = path.join(f.dir, 'maintainer.bin');
  const store = createFeishuMaintainerStore({ file, safeStorage: f.safeStorage });
  const scope = 'a'.repeat(64), person = { name: 'Fixture Operator', userKey: 'fixture-person', username: '', stamp: 'b'.repeat(64),
    token: 'must-not-persist', expiresAt: 42, operatorConfirmed: true, pluginSecret: 'must-not-persist' };
  f.store.write(config()); const original = fs.readFileSync(f.file);
  store.write(scope, person);
  assert.equal(fs.readFileSync(file).includes(Buffer.from(person.name)), false);
  assert.deepEqual(createFeishuMaintainerStore({ file, safeStorage: f.safeStorage }).read(scope),
    { name: person.name, userKey: person.userKey, username: '', stamp: person.stamp });
  assert.equal(store.read('c'.repeat(64)), null);
  assert.deepEqual(fs.readFileSync(f.file), original);
  const bad = createFeishuMaintainerStore({ file, safeStorage: { ...f.safeStorage, encryptString() { throw Error('private'); } } });
  const before = fs.readFileSync(file);
  assert.throws(() => bad.write(scope, person), { code: 'FEISHU_MAINTAINER_SAVE_FAILED' });
  assert.deepEqual(fs.readFileSync(file), before);
});

test('maintainer corrupt data and unavailable encryption never fall back to plain text', t => {
  const f = fixture(t), file = path.join(f.dir, 'maintainer.bin');
  const store = createFeishuMaintainerStore({ file, safeStorage: f.safeStorage });
  fs.writeFileSync(file, 'fixture-private-data');
  assert.throws(() => store.read('a'.repeat(64)), { code: 'FEISHU_SAVED_MAINTAINER_INVALID' });
  const blocked = createFeishuMaintainerStore({ file, safeStorage: { ...f.safeStorage, isEncryptionAvailable: () => false } });
  assert.throws(() => blocked.read('a'.repeat(64)), { code: 'FEISHU_STORAGE_UNAVAILABLE' });
  assert.throws(() => store.write('a'.repeat(64), { name: 'Bad\nName' }), { code: 'FEISHU_SAVED_MAINTAINER_INVALID' });
});

const config = () => ({ pluginId: 'fixture-plugin', projectKey: 'fixture-project', workItemTypeKey: 'fixture-type',
  userKey: 'fixture-user', pluginSecret: 'fixture-private-value' });
function fixture(t, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-vault-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'connection.bin');
  const key = crypto.randomBytes(32);
  const safeStorage = { isEncryptionAvailable: () => true,
    encryptString(value) {
      const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]);
    },
    decryptString(buffer) {
      const cipher = crypto.createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12));
      cipher.setAuthTag(buffer.subarray(12, 28));
      return Buffer.concat([cipher.update(buffer.subarray(28)), cipher.final()]).toString('utf8');
    }, ...overrides };
  return { file, dir, safeStorage, store: createFeishuConnectionStore({ file, safeStorage }) };
}
test('encrypted restart round trip, suspend and forget affect only the connection file', t => {
  const f = fixture(t);
  assert.equal(f.store.read(), null);
  fs.writeFileSync(path.join(f.dir, 'keep-fixture.txt'), 'keep');
  f.store.write(config());
  const bytes = fs.readFileSync(f.file);
  for (const value of Object.values(config())) assert.equal(bytes.includes(Buffer.from(value)), false);
  const restarted = createFeishuConnectionStore({ file: f.file, safeStorage: f.safeStorage });
  assert.deepEqual(restarted.read(), { autoConnect: true, config: config() });
  restarted.suspend(); assert.equal(restarted.read().autoConnect, false);
  restarted.write(config()); assert.equal(restarted.read().autoConnect, true);
  restarted.forget(); assert.equal(restarted.read(), null);
  assert.equal(fs.readFileSync(path.join(f.dir, 'keep-fixture.txt'), 'utf8'), 'keep');
});
test('unavailable encryption never falls back to plaintext', t => {
  const f = fixture(t, { isEncryptionAvailable: () => false });
  assert.throws(() => f.store.write(config()), { code: 'FEISHU_STORAGE_UNAVAILABLE' });
  assert.equal(fs.existsSync(f.file), false);
  const linux = createFeishuConnectionStore({ file: f.file, platform: 'linux', safeStorage: {
    ...f.safeStorage, isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'basic_text' } });
  assert.throws(() => linux.write(config()), { code: 'FEISHU_STORAGE_UNAVAILABLE' });
});
test('corrupt and foreign encrypted data fail closed with sanitized errors', t => {
  const f = fixture(t); fs.writeFileSync(f.file, 'fixture-private-value');
  assert.throws(() => f.store.read(), { code: 'FEISHU_SAVED_CONNECTION_INVALID' });
  f.store.write(config());
  const wrong = fixture(t);
  fs.copyFileSync(f.file, wrong.file);
  assert.throws(() => wrong.store.read(), { code: 'FEISHU_SAVED_CONNECTION_INVALID' });
});
test('save failure leaves the previous encrypted connection intact', t => {
  const f = fixture(t); f.store.write(config());
  const original = fs.readFileSync(f.file);
  const bad = createFeishuConnectionStore({ file: f.file, safeStorage: { ...f.safeStorage,
    encryptString() { throw new Error('fixture-private-value'); } } });
  assert.throws(() => bad.write(config()), { code: 'FEISHU_STORAGE_SAVE_FAILED' });
  assert.deepEqual(fs.readFileSync(f.file), original);
  assert.deepEqual(fs.readdirSync(f.dir), ['connection.bin']);
});
