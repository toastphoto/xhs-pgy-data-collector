const assert = require('assert');
const {
  MAX_CANDIDATE_COUNT,
  buildSearchCandidateExtractionScript,
  buildSearchPaginationScript,
  parseCandidateInstruction,
  parseChineseNumber
} = require('../lib/pgy_candidate_command');

assert.strictEqual(parseChineseNumber('二十'), 20);
assert.strictEqual(parseChineseNumber('三十六'), 36);
assert.strictEqual(parseChineseNumber('十'), 10);

assert.deepStrictEqual(
  parseCandidateInstruction('将目前页面前30名达人加入候选').requestedCount,
  30
);
assert.deepStrictEqual(
  parseCandidateInstruction('查找当前页面前二十名达人并加入候选').requestedCount,
  20
);
assert.strictEqual(parseCandidateInstruction('加入候选').code, 'CANDIDATE_COMMAND_COUNT_MISSING');
assert.strictEqual(parseCandidateInstruction('将前51位达人加入候选').code, 'CANDIDATE_COMMAND_LIMIT_EXCEEDED');
assert.strictEqual(parseCandidateInstruction('帮我写一封邮件').code, 'CANDIDATE_COMMAND_UNSUPPORTED');

const script = buildSearchCandidateExtractionScript(30);
assert.ok(script.includes('const requestedCount = 30'));
assert.ok(script.includes('__vueParentComponent'));
assert.ok(script.includes('/solar/pre-trade/blogger-detail/'));
assert.doesNotThrow(() => new Function(script));
assert.doesNotThrow(() => new Function(buildSearchPaginationScript('next')));
assert.ok(buildSearchPaginationScript('goto', 2).includes('const targetPage = 2'));
assert.strictEqual(MAX_CANDIDATE_COUNT, 50);

console.log('pgy_candidate_command.test.js OK');
