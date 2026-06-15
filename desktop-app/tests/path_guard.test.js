const assert = require('assert');
const os = require('os');
const path = require('path');
const { resolveInsideRoot, resolveInsideAny } = require('../lib/path_guard');

const root = path.join(os.tmpdir(), 'xhs-pgy-path-guard');
const child = path.join(root, 'runs', 'run_1');

assert.strictEqual(resolveInsideRoot(child, root), path.resolve(child));
assert.strictEqual(resolveInsideRoot(root, root), path.resolve(root));
assert.strictEqual(resolveInsideRoot(path.join(root + '-evil', 'run_1'), root), null);
assert.strictEqual(resolveInsideRoot(path.join(root, '..', 'outside'), root), null);
assert.strictEqual(resolveInsideAny(child, [path.join(os.tmpdir(), 'other'), root]), path.resolve(child));
assert.strictEqual(resolveInsideAny('/etc/passwd', [root]), null);

console.log('path_guard.test.js OK');
