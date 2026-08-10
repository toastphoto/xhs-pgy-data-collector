const assert = require('assert');
const path = require('path');
const { assessBackendHealth, packagedBackendExecutable } = require('../lib/backend_runtime');

const resourcesPath = path.resolve('C:\\Program Files\\XhsPgy\\resources');

assert.strictEqual(
  packagedBackendExecutable(resourcesPath, 'win32'),
  path.join(resourcesPath, 'content-analyzer-backend', 'xhs-pgy-backend.exe')
);

assert.deepStrictEqual(
  assessBackendHealth({ ok: true, json: { protocol_version: '1', instance_token: 'expected', pid: 321 } }, {
    expectedToken: 'expected',
    protocolVersion: '1'
  }),
  { ok: true, pid: 321 }
);
assert.deepStrictEqual(
  assessBackendHealth({ ok: true, json: { protocol_version: '1', instance_token: 'stale', pid: 999 } }, {
    expectedToken: 'expected',
    protocolVersion: '1'
  }),
  { ok: false, code: 'BACKEND_IDENTITY_MISMATCH' }
);
assert.deepStrictEqual(
  assessBackendHealth({ ok: true, json: {} }, { expectedToken: 'expected' }),
  { ok: false, code: 'BACKEND_IDENTITY_MISSING' }
);
assert.strictEqual(
  packagedBackendExecutable(resourcesPath, 'darwin'),
  path.join(resourcesPath, 'content-analyzer-backend', 'xhs-pgy-backend')
);
assert.strictEqual(
  packagedBackendExecutable(resourcesPath, 'linux'),
  path.join(resourcesPath, 'content-analyzer-backend', 'xhs-pgy-backend')
);

console.log('backend_runtime.test.js OK');
