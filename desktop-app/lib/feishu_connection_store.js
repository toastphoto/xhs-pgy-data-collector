const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const names = ['pluginId', 'projectKey', 'workItemTypeKey', 'userKey', 'pluginSecret'];
function fail(code) { throw Object.assign(new Error(code), { code }); }
function snapshot(config) {
  if (!config || names.some(k => typeof config[k] !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(config[k]))) {
    fail('FEISHU_CONFIG_INVALID');
  }
  for (const k of ['pluginId', 'projectKey', 'workItemTypeKey']) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(config[k])) fail('FEISHU_CONFIG_INVALID');
  }
  return Object.fromEntries(names.map(k => [k, config[k]]));
}

function createFeishuConnectionStore({ file, safeStorage, platform = process.platform }) {
  function available() {
    if (!safeStorage.isEncryptionAvailable() || (platform === 'linux'
      && safeStorage.getSelectedStorageBackend() === 'basic_text')) fail('FEISHU_STORAGE_UNAVAILABLE');
  }
  function read() {
    if (!fs.existsSync(file)) return null;
    available();
    try {
      const size = fs.statSync(file).size;
      if (size < 1 || size > 65536) fail('FEISHU_SAVED_CONNECTION_INVALID');
      const value = JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
      if (value?.version !== 1 || typeof value.autoConnect !== 'boolean') fail('FEISHU_SAVED_CONNECTION_INVALID');
      return { autoConnect: value.autoConnect, config: snapshot(value.config) };
    } catch (_) { fail('FEISHU_SAVED_CONNECTION_INVALID'); }
  }
  function write(config, autoConnect = true) {
    const value = snapshot(config);
    available();
    const dir = path.dirname(file);
    const temp = `${file}.${crypto.randomUUID()}.tmp`;
    try {
      const encrypted = safeStorage.encryptString(JSON.stringify({ version: 1, autoConnect, config: value }));
      if (!Buffer.isBuffer(encrypted) || !encrypted.length || encrypted.length > 65536) fail('FEISHU_STORAGE_UNAVAILABLE');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(temp, encrypted, { flag: 'wx', mode: 0o600 });
      fs.renameSync(temp, file);
    } catch (_) { fail('FEISHU_STORAGE_SAVE_FAILED'); }
    finally {
      value.pluginSecret = '';
      try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch (_) { /* Preserve the original save error. */ }
    }
  }
  return Object.freeze({ read, write,
    suspend() {
      const saved = read();
      try { if (saved) write(saved.config, false); }
      finally { if (saved) saved.config.pluginSecret = ''; }
    },
    forget() { if (fs.existsSync(file)) fs.unlinkSync(file); }
  });
}

module.exports = { createFeishuConnectionStore, snapshot };
