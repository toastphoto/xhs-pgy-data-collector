const assert = require('assert');

const {
  PGY_RISK_PATTERNS,
  buildBrowserRiskDetectionSnippet,
  detectRiskText,
  normalizeRiskText
} = require('../lib/pgy_risk');

assert.ok(PGY_RISK_PATTERNS.length >= 20);
for (const phrase of ['验证码', '安全验证', '人机验证', '拖动滑块', '访问异常', 'too many requests']) {
  assert.ok(PGY_RISK_PATTERNS.includes(phrase), `missing risk phrase: ${phrase}`);
}

assert.strictEqual(normalizeRiskText('  A\nB\tC  '), 'a b c');
assert.strictEqual(detectRiskText('请完成安全验证后继续'), '安全验证');
assert.strictEqual(detectRiskText('当前访问异常，请稍后重试'), '访问异常');
assert.strictEqual(detectRiskText('Please retry later: TOO MANY REQUESTS'), 'too many requests');
assert.strictEqual(detectRiskText('请拖动滑块完成验证'), '滑块');
assert.strictEqual(detectRiskText('正常的蒲公英达人详情页，展示昵称和粉丝数据'), '');

const snippet = buildBrowserRiskDetectionSnippet('bodyText');
assert.match(snippet, /riskPatterns/);
assert.match(snippet, /riskDetected/);
assert.match(snippet, /too many requests/);
assert.match(snippet, /人机验证/);

console.log('pgy_risk.test.js OK');
