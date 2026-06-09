const assert = require('assert');

// RED: 该模块在实现前应不存在/或函数未实现，测试必须先失败
const n = require('../lib/db/normalize');

assert.strictEqual(n.toNull('--'), null);
assert.strictEqual(n.toNull('暂未入驻'), null);
assert.strictEqual(n.toNull(''), null);

assert.strictEqual(n.parseCount('4.2w'), 42000);
assert.strictEqual(n.parseCount('4.2万'), 42000);
assert.strictEqual(n.parseCount('3,400'), 3400);
assert.strictEqual(n.parseCount('--'), null);

assert.strictEqual(n.parsePercent('3.1%'), 0.031);
assert.strictEqual(n.parsePercent('--'), null);

assert.strictEqual(n.parseMoney('¥3,000'), 3000);
assert.strictEqual(n.parseMoney('￥3000'), 3000);
assert.strictEqual(n.parseMoney('暂未入驻'), null);

console.log('normalize.test.js OK');

