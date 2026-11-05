const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function fail(code) { throw Object.assign(new Error(code), { code }); }
function validate(value) {
  if (!value || !/^[a-f0-9]{64}$/.test(value.scope || '')
    || !/^[A-Za-z0-9_-]{1,128}$/.test(value.person?.userKey || '')
    || !/^[a-f0-9]{64}$/.test(value.person?.stamp || '')
    || !['name', 'username'].every(k => typeof value.person[k] === 'string'
      && value.person[k].length <= 256 && !/[\x00-\x1f\x7f]/.test(value.person[k]))
    || !value.person.name.trim()) fail('FEISHU_SAVED_MAINTAINER_INVALID');
  return { scope: value.scope, person: { name: value.person.name, username: value.person.username,
    userKey: value.person.userKey, stamp: value.person.stamp } };
}

// Persist only an explicit identity preference, never a token or write approval.
function createFeishuMaintainerStore({ file, safeStorage, platform = process.platform }) {
  function available() {
    if (!safeStorage.isEncryptionAvailable() || (platform === 'linux'
      && safeStorage.getSelectedStorageBackend() === 'basic_text')) fail('FEISHU_STORAGE_UNAVAILABLE');
  }
  function read(scope) {
    if (!fs.existsSync(file)) return null;
    available();
    try {
      const size = fs.statSync(file).size;
      if (size < 1 || size > 65536) fail('FEISHU_SAVED_MAINTAINER_INVALID');
      const raw = JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
      if (raw.version !== 1) fail('FEISHU_SAVED_MAINTAINER_INVALID');
      const value = validate(raw);
      return value.scope === scope ? value.person : null;
    } catch (_) { fail('FEISHU_SAVED_MAINTAINER_INVALID'); }
  }
  function write(scope, person) {
    const value = validate({ scope, person });
    available();
    const temp = `${file}.${crypto.randomUUID()}.tmp`;
    try {
      const bytes = safeStorage.encryptString(JSON.stringify({ version: 1, ...value }));
      if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 65536) fail('FEISHU_STORAGE_UNAVAILABLE');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(temp, bytes, { flag: 'wx', mode: 0o600 });
      fs.renameSync(temp, file);
    } catch (_) { fail('FEISHU_MAINTAINER_SAVE_FAILED'); }
    finally { try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch (_) {} }
  }
  return Object.freeze({ read, write });
}
module.exports = { createFeishuMaintainerStore };
