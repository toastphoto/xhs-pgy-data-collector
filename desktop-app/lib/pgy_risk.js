const PGY_RISK_PATTERNS = Object.freeze([
  '验证码',
  '安全验证',
  '人机验证',
  '身份验证',
  '滑块',
  '拖动滑块',
  '请完成验证',
  '访问过于频繁',
  '操作过于频繁',
  '请求过于频繁',
  '访问异常',
  '当前访问异常',
  '账号异常',
  '登录过期',
  '请登录',
  '环境异常',
  '系统繁忙',
  '稍后重试',
  '风险',
  '请稍后再试',
  'verify',
  'verification',
  'captcha',
  'too many requests',
  'security check'
]);

function normalizeRiskText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000)
    .toLowerCase();
}

function detectRiskText(value, patterns = PGY_RISK_PATTERNS) {
  const text = normalizeRiskText(value);
  return patterns.find((pattern) => text.includes(String(pattern).toLowerCase())) || '';
}

function buildBrowserRiskDetectionSnippet(bodyTextVarName = 'bodyText') {
  const name = String(bodyTextVarName || 'bodyText').replace(/[^a-zA-Z0-9_$]/g, '');
  return `
          const riskPatterns = ${JSON.stringify(PGY_RISK_PATTERNS)};
          const riskText = riskPatterns.find((pattern) =>
            ${name}.toLowerCase().includes(String(pattern).toLowerCase())
          ) || '';
          const riskDetected = Boolean(riskText);
  `;
}

module.exports = {
  PGY_RISK_PATTERNS,
  buildBrowserRiskDetectionSnippet,
  detectRiskText,
  normalizeRiskText
};
