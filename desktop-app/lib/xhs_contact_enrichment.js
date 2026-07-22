const XHS_PROFILE_HOSTS = Object.freeze(['xiaohongshu.com', 'www.xiaohongshu.com']);
const XHS_RISK_PATTERNS = Object.freeze([
  '安全验证',
  '请完成验证',
  '人机验证',
  '滑动验证',
  '操作频繁',
  '请求过于频繁',
  '访问过于频繁',
  '访问异常',
  '账号异常',
  '网络环境存在风险',
  'requests too frequent',
  'request too frequent',
  'too many requests',
  'try again later',
  'security verification',
  'security check',
  'captcha'
]);

function cleanStr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return cleanStr(value)
    .replace(/[：﹕]/g, ':')
    .replace(/[，、]/g, ',')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')');
}

function normalizeXhsProfileUrl(value) {
  const text = cleanStr(value);
  if (!text) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    const host = url.hostname.toLowerCase();
    if (!XHS_PROFILE_HOSTS.includes(host)) return '';
    const match = url.pathname.match(/^\/user\/profile\/([^/?#]+)/i);
    if (!match) return '';
    return `https://www.xiaohongshu.com/user/profile/${encodeURIComponent(decodeURIComponent(match[1]))}`;
  } catch (_) {
    return '';
  }
}

function detectXhsRisk(urlValue, textValue) {
  const url = cleanStr(urlValue);
  const text = cleanStr(textValue).toLowerCase();
  const matchedPattern = XHS_RISK_PATTERNS.find((pattern) => text.includes(String(pattern).toLowerCase())) || '';
  const riskUrl = /xiaohongshu\.com\/website-login\/captcha(?:[/?#]|$)/i.test(url);
  return {
    riskDetected: Boolean(matchedPattern || riskUrl),
    riskText: matchedPattern || (riskUrl ? '安全验证' : '')
  };
}

function buildXhsRiskDetectionSnippet(urlVarName = 'url', textVarName = 'bodyText') {
  const urlName = String(urlVarName || 'url').replace(/[^a-zA-Z0-9_$]/g, '') || 'url';
  const textName = String(textVarName || 'bodyText').replace(/[^a-zA-Z0-9_$]/g, '') || 'bodyText';
  return `
          const xhsRiskPatterns = ${JSON.stringify(XHS_RISK_PATTERNS)};
          const xhsRiskPattern = xhsRiskPatterns.find((pattern) =>
            ${textName}.toLowerCase().includes(String(pattern).toLowerCase())
          ) || '';
          const xhsRiskUrl = /xiaohongshu\\.com\\/website-login\\/captcha(?:[/?#]|$)/i.test(${urlName});
          const riskText = xhsRiskPattern || (xhsRiskUrl ? '安全验证' : '');
          const riskDetected = Boolean(riskText);
  `;
}

function firstProfileUrl(values) {
  for (const value of Array.isArray(values) ? values : []) {
    const url = normalizeXhsProfileUrl(value);
    if (url) return url;
  }
  return '';
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D+/g, '');
  if (digits.length === 13 && digits.startsWith('86')) return digits.slice(2);
  return /^1[3-9]\d{9}$/.test(digits) ? digits : '';
}

function parsePublicContactText(value) {
  const text = normalizeText(value);
  const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);

  let phone = '';
  const phoneContext = /(?:手机|电话|商务|合作|联系|加微|微信|vx|v信|wechat)\s*(?:号|方式)?\s*[:：=\-]?\s*((?:\+?86[\s-]?)?1[3-9]\d(?:[\s-]?\d){8})/ig;
  for (const match of text.matchAll(phoneContext)) {
    phone = normalizePhone(match[1]);
    if (phone) break;
  }

  let wechatId = '';
  const wechatContext = /(?:微信(?:号)?|微\s*信|vx|v信|wechat|商务v|合作v|加v)\s*[:：=\-]?\s*([A-Z][A-Z0-9_-]{5,19}|[1-9]\d{5,19})/ig;
  for (const match of text.matchAll(wechatContext)) {
    const candidate = cleanStr(match[1]);
    const asPhone = normalizePhone(candidate);
    if (asPhone) {
      if (!phone) phone = asPhone;
      continue;
    }
    wechatId = candidate;
    break;
  }

  return {
    email: cleanStr(emailMatch?.[0]).toLowerCase(),
    wechatId,
    phone
  };
}

function mergeContactFields(existing = {}, discovered = {}) {
  return {
    email: cleanStr(existing.email) || cleanStr(discovered.email),
    wechatId: cleanStr(existing.wechatId) || cleanStr(discovered.wechatId),
    phone: cleanStr(existing.phone) || cleanStr(discovered.phone)
  };
}

function contactFieldCount(value = {}) {
  return ['email', 'wechatId', 'phone'].filter((key) => cleanStr(value[key])).length;
}

function isIgnorableXhsNavigationError(error, currentUrl, targetUrl) {
  const current = normalizeXhsProfileUrl(currentUrl);
  const target = normalizeXhsProfileUrl(targetUrl);
  if (!current || current !== target) return false;
  const message = cleanStr(error?.message || error);
  return error?.code === 'ERR_ABORTED' || error?.errno === -3 || /ERR_ABORTED|\(-3\)/i.test(message);
}

module.exports = {
  XHS_PROFILE_HOSTS,
  XHS_RISK_PATTERNS,
  buildXhsRiskDetectionSnippet,
  cleanStr,
  contactFieldCount,
  detectXhsRisk,
  firstProfileUrl,
  isIgnorableXhsNavigationError,
  mergeContactFields,
  normalizePhone,
  normalizeXhsProfileUrl,
  parsePublicContactText
};
