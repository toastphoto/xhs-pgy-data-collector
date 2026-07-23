const assert = require('assert');
const {
  MAX_CANDIDATE_COUNT,
  MAX_CANDIDATE_RANK,
  buildSearchCandidateExtractionScript,
  buildSearchPaginationScript,
  parseCandidateInstruction,
  parseChineseNumber
} = require('../lib/pgy_candidate_command');

assert.strictEqual(parseChineseNumber('二十'), 20);
assert.strictEqual(parseChineseNumber('三十六'), 36);
assert.strictEqual(parseChineseNumber('十'), 10);
assert.strictEqual(parseChineseNumber('一百'), 100);
assert.strictEqual(parseChineseNumber('九十九'), 99);

assert.deepStrictEqual(
  parseCandidateInstruction('将目前页面前30名达人加入候选').requestedCount,
  30
);
assert.deepStrictEqual(
  parseCandidateInstruction('查找当前页面前二十名达人并加入候选').requestedCount,
  20
);
const range42to50 = parseCandidateInstruction('将当前页面第42位达人到第50位达人加入候选');
assert.strictEqual(range42to50.ok, true);
assert.strictEqual(range42to50.mode, 'range');
assert.strictEqual(range42to50.startRank, 42);
assert.strictEqual(range42to50.endRank, 50);
assert.strictEqual(range42to50.requestedCount, 9);
const range50to70 = parseCandidateInstruction('查找当前页面第50至70位达人并加入候选');
assert.strictEqual(range50to70.ok, true);
assert.strictEqual(range50to70.startRank, 50);
assert.strictEqual(range50to70.endRank, 70);
assert.strictEqual(range50to70.requestedCount, 21);
const chineseRange = parseCandidateInstruction('将第四十二位达人到第五十位达人加入候选');
assert.strictEqual(chineseRange.startRank, 42);
assert.strictEqual(chineseRange.endRank, 50);
assert.strictEqual(parseCandidateInstruction('加入候选').code, 'CANDIDATE_COMMAND_COUNT_MISSING');
assert.strictEqual(parseCandidateInstruction('将前51位达人加入候选').code, 'CANDIDATE_COMMAND_LIMIT_EXCEEDED');
assert.strictEqual(parseCandidateInstruction('将第1位到第51位达人加入候选').code, 'CANDIDATE_COMMAND_LIMIT_EXCEEDED');
assert.strictEqual(parseCandidateInstruction('将第50位到第101位达人加入候选').code, 'CANDIDATE_COMMAND_RANK_EXCEEDED');
assert.strictEqual(parseCandidateInstruction('将第70位到第50位达人加入候选').code, 'CANDIDATE_COMMAND_RANGE_INVALID');
assert.strictEqual(parseCandidateInstruction('帮我写一封邮件').code, 'CANDIDATE_COMMAND_UNSUPPORTED');

const script = buildSearchCandidateExtractionScript(30);
assert.ok(script.includes('const requestedCount = 30'));
assert.ok(script.includes('__vueParentComponent'));
assert.ok(script.includes('/solar/pre-trade/blogger-detail/'));
assert.doesNotThrow(() => new Function(script));
assert.doesNotThrow(() => new Function(buildSearchPaginationScript('next')));
assert.ok(buildSearchPaginationScript('goto', 2).includes('const targetPage = 2'));
assert.strictEqual(MAX_CANDIDATE_COUNT, 50);
assert.strictEqual(MAX_CANDIDATE_RANK, 100);

console.log('pgy_candidate_command.test.js OK');
