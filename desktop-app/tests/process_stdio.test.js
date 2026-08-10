const assert = require('assert');
const { EventEmitter } = require('events');
const { guardOutputStream, installProcessStdioGuards } = require('../lib/process_stdio');

const stdout = new EventEmitter();
const stderr = new EventEmitter();
assert.deepStrictEqual(installProcessStdioGuards({ stdout, stderr }), {
  stdout: true,
  stderr: true
});
assert.doesNotThrow(() => stdout.emit('error', Object.assign(new Error('broken pipe'), { code: 'EPIPE' })));
assert.doesNotThrow(() => stderr.emit('error', new Error('closed output stream')));
assert.strictEqual(guardOutputStream(null), false);

console.log('process_stdio.test.js passed');
