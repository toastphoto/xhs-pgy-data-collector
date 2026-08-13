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
const XHS_PAGE_READ_STATUS = Object.freeze({
  READY: 'ready',
  NOT_READY: 'not_ready',
  LOGIN_REQUIRED: 'login_required',
  RISK_DETECTED: 'risk_detected'
});

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

function normalizeEmailText(value) {
  let text = String(value === undefined || value === null ? '' : value);
  try {
    text = text.normalize('NFKC');
  } catch (_) {}
  text = text
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[\ufe0e\ufe0f]/g, '')
    .replace(/[。｡﹒]/g, '.')
    .replace(/[﹫]/g, '@')
    .replace(/\s*(?:\[\s*(?:at|@|艾特)\s*\]|\(\s*(?:at|@|艾特)\s*\)|\{\s*(?:at|@|艾特)\s*\})\s*/gi, '@')
    .replace(/\s*(?:\[\s*(?:dot|\.|点)\s*\]|\(\s*(?:dot|\.|点)\s*\)|\{\s*(?:dot|\.|点)\s*\})\s*/gi, '.')
    .replace(/@\s*🐧\s*(?=\.)/g, '@qq')
    .replace(/([A-Z0-9][A-Z0-9._%+-]{1,61}[A-Z0-9])\s*(?:📮|📧|✉|💌|❄)\s*(?=[A-Z0-9-]+(?:\s*\.\s*[A-Z0-9-]+)+)/gi, '$1@')
    .replace(/\s*@\s*/g, '@')
    .replace(/\s*\.\s*/g, '.');
  return text;
}

function extractPublicEmails(value) {
  const text = normalizeEmailText(value);
  const pattern = /[A-Z0-9](?:[A-Z0-9._%+-]{0,62}[A-Z0-9])?@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)*\.[A-Z]{2,63}/gi;
  const emails = [];
  const seen = new Set();
  for (const match of text.matchAll(pattern)) {
    const email = cleanStr(match[0]).toLowerCase();
    const [localPart, domain = ''] = email.split('@');
    const invalidLocal = !localPart || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..');
    const invalidDomain = domain.split('.').some((label) => !label || label.startsWith('-') || label.endsWith('-'));
    if (!email || email.length > 254 || invalidLocal || invalidDomain || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

function extractVisibleMailtoEmails(values) {
  const hrefs = Array.isArray(values) ? values : [values];
  const emails = [];
  const seen = new Set();
  for (const value of hrefs) {
    const href = cleanStr(value);
    if (!/^mailto:/i.test(href)) continue;
    let recipientPart = href.slice(href.indexOf(':') + 1).split(/[?#]/, 1)[0];
    try {
      recipientPart = decodeURIComponent(recipientPart);
    } catch (_) {}
    for (const email of extractPublicEmails(recipientPart.replace(/[;,]/g, ' '))) {
      if (seen.has(email)) continue;
      seen.add(email);
      emails.push(email);
    }
  }
  return emails;
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

function isXhsWebUrl(value) {
  const text = cleanStr(value);
  if (!text) return false;
  try {
    const url = new URL(text);
    return /^https?:$/i.test(url.protocol)
      && XHS_PROFILE_HOSTS.includes(url.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

function extractPgyCreatorEntityId(value) {
  const text = cleanStr(value);
  if (!text) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!/(^|\.)xiaohongshu\.com$/i.test(url.hostname)) return '';
    const match = url.pathname.match(/\/blogger-detail\/([^/?#]+)/i);
    return match ? cleanStr(decodeURIComponent(match[1])).toLowerCase() : '';
  } catch (_) {
    return '';
  }
}

function normalizePgyCreatorUrl(value) {
  const text = cleanStr(value);
  if (!text) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!/(^|\.)xiaohongshu\.com$/i.test(url.hostname)) return '';
    const match = url.pathname.match(/^(.*\/blogger-detail\/)([^/?#]+)/i);
    if (!match) return '';
    return `https://${url.hostname.toLowerCase()}${match[1]}${encodeURIComponent(decodeURIComponent(match[2]))}`;
  } catch (_) {
    return '';
  }
}

function xhsProfileSourceMatchesPgyCreator(sourceCreatorUrl, creatorUrl) {
  const source = normalizePgyCreatorUrl(sourceCreatorUrl);
  const creator = normalizePgyCreatorUrl(creatorUrl);
  return Boolean(source && creator && source === creator);
}

function extractXhsProfileEntityId(value) {
  const normalized = normalizeXhsProfileUrl(value);
  if (!normalized) return '';
  try {
    const url = new URL(normalized);
    const match = url.pathname.match(/^\/user\/profile\/([^/?#]+)/i);
    return match ? cleanStr(decodeURIComponent(match[1])).toLowerCase() : '';
  } catch (_) {
    return '';
  }
}

function xhsProfileMatchesPgyCreator(profileUrl, creatorUrl) {
  const profileId = extractXhsProfileEntityId(profileUrl);
  const creatorId = extractPgyCreatorEntityId(creatorUrl);
  return Boolean(profileId && creatorId && profileId === creatorId);
}

function xhsProfileUrlFromPgyCreator(creatorUrl) {
  const creatorId = extractPgyCreatorEntityId(creatorUrl);
  return creatorId
    ? normalizeXhsProfileUrl(`https://www.xiaohongshu.com/user/profile/${encodeURIComponent(creatorId)}`)
    : '';
}

function detectXhsLogin(urlValue, _textValue, signals = {}) {
  const url = cleanStr(urlValue);
  const explicitSignal = Boolean(
    signals.loginRequired ||
    signals.loginInputVisible ||
    signals.loginModalVisible
  );
  let loginUrl = false;
  try {
    const parsed = new URL(url);
    loginUrl = XHS_PROFILE_HOSTS.includes(parsed.hostname.toLowerCase()) &&
      /\/(?:website-login|login|passport)(?:[/?#]|$)/i.test(parsed.pathname);
  } catch (_) {}
  return {
    loginRequired: Boolean(explicitSignal || loginUrl),
    loginText: explicitSignal ? '检测到可见登录控件' : (loginUrl ? '小红书登录页' : '')
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
  const email = extractPublicEmails(text)[0] || '';

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
    email,
    wechatId,
    phone
  };
}

function parsePublicContactSnapshot(value = {}) {
  const snapshot = value && typeof value === 'object' ? value : { profileText: value };
  const contact = parsePublicContactText([
    snapshot.profileText,
    snapshot.visibleContactText
  ].map(cleanStr).filter(Boolean).join('\n'));
  if (!contact.email) {
    contact.email = extractVisibleMailtoEmails(snapshot.visibleMailtoHrefs)[0] || '';
  }
  return contact;
}

function normalizeXhsPageSnapshot(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const mailtoHrefs = Array.isArray(source.visibleMailtoHrefs)
    ? source.visibleMailtoHrefs
    : [source.visibleMailtoHrefs];
  return {
    url: cleanStr(source.url),
    documentReadyState: cleanStr(source.documentReadyState).toLowerCase(),
    bodyText: normalizeText(source.bodyText),
    profileText: normalizeText(source.profileText),
    visibleContactText: normalizeText(source.visibleContactText),
    visibleMailtoHrefs: mailtoHrefs
      .map(cleanStr)
      .filter((href) => /^mailto:/i.test(href)),
    loginRequired: source.loginRequired === true,
    loginInputVisible: source.loginInputVisible === true,
    loginModalVisible: source.loginModalVisible === true,
    profileRootVisible: source.profileRootVisible === true,
    profileIdVisible: source.profileIdVisible === true,
    loadingIndicatorVisible: source.loadingIndicatorVisible === true
  };
}

function xhsProfileSnapshotFingerprint(value = {}) {
  const snapshot = normalizeXhsPageSnapshot(value);
  return JSON.stringify({
    url: normalizeXhsProfileUrl(snapshot.url),
    profileText: snapshot.profileText,
    visibleContactText: snapshot.visibleContactText,
    visibleMailtoHrefs: [...new Set(snapshot.visibleMailtoHrefs)].sort(),
    profileRootVisible: snapshot.profileRootVisible,
    profileIdVisible: snapshot.profileIdVisible
  });
}

function isXhsProfileSnapshotStable(currentValue, previousValue) {
  if (!previousValue) return false;
  const current = normalizeXhsPageSnapshot(currentValue);
  const previous = normalizeXhsPageSnapshot(previousValue);
  const currentUrl = normalizeXhsProfileUrl(current.url);
  const previousUrl = normalizeXhsProfileUrl(previous.url);
  if (!currentUrl || currentUrl !== previousUrl) return false;
  const hasEvidence = Boolean(
    current.profileText ||
    current.visibleContactText ||
    current.visibleMailtoHrefs.length ||
    current.profileIdVisible
  );
  return hasEvidence && xhsProfileSnapshotFingerprint(current) === xhsProfileSnapshotFingerprint(previous);
}

function classifyXhsProfilePageRead(currentValue, previousValue = null, options = {}) {
  const current = normalizeXhsPageSnapshot(currentValue);
  const combinedText = [current.bodyText, current.profileText, current.visibleContactText]
    .filter(Boolean)
    .join('\n');
  // Blocking evidence wins so a caller cannot poll past login or risk controls.
  const risk = detectXhsRisk(current.url, combinedText);
  if (risk.riskDetected) {
    return {
      ok: false,
      status: XHS_PAGE_READ_STATUS.RISK_DETECTED,
      code: 'XHS_RISK_DETECTED',
      retryable: false,
      manualIntervention: true,
      profileReady: false,
      riskDetected: true,
      riskText: risk.riskText,
      loginRequired: false
    };
  }

  const login = detectXhsLogin(current.url, combinedText, current);
  if (login.loginRequired) {
    return {
      ok: false,
      status: XHS_PAGE_READ_STATUS.LOGIN_REQUIRED,
      code: 'XHS_LOGIN_REQUIRED',
      retryable: false,
      manualIntervention: true,
      profileReady: false,
      riskDetected: false,
      riskText: '',
      loginRequired: true,
      loginText: login.loginText
    };
  }

  const currentUrl = normalizeXhsProfileUrl(current.url);
  const targetUrl = normalizeXhsProfileUrl(options.targetUrl);
  if (!currentUrl || (targetUrl && currentUrl !== targetUrl)) {
    return {
      ok: false,
      status: XHS_PAGE_READ_STATUS.NOT_READY,
      code: currentUrl ? 'XHS_PROFILE_URL_MISMATCH' : 'XHS_PROFILE_URL_NOT_READY',
      retryable: true,
      manualIntervention: false,
      profileReady: false,
      riskDetected: false,
      riskText: '',
      loginRequired: false
    };
  }

  const profileText = [current.profileText, current.visibleContactText].filter(Boolean).join('\n');
  const hasIdentityEvidence = current.profileIdVisible || /小红书号\s*[:：]?/i.test(profileText);
  const hasProfileEvidence = hasIdentityEvidence || (current.profileRootVisible && profileText.length >= 8);
  const documentIsLoading = Boolean(
    current.documentReadyState && !['interactive', 'complete'].includes(current.documentReadyState)
  );
  // The profile page contains independent infinite-scroll loaders. Once stable
  // identity content is visible, those loaders do not mean the profile is unreadable.
  const profileContentIsLoading = current.loadingIndicatorVisible && !hasProfileEvidence;
  if (documentIsLoading || profileContentIsLoading) {
    return {
      ok: false,
      status: XHS_PAGE_READ_STATUS.NOT_READY,
      code: 'XHS_PROFILE_DOCUMENT_LOADING',
      retryable: true,
      manualIntervention: false,
      profileReady: false,
      riskDetected: false,
      riskText: '',
      loginRequired: false
    };
  }

  if (!hasProfileEvidence) {
    return {
      ok: false,
      status: XHS_PAGE_READ_STATUS.NOT_READY,
      code: 'XHS_PROFILE_CONTENT_NOT_READY',
      retryable: true,
      manualIntervention: false,
      profileReady: false,
      riskDetected: false,
      riskText: '',
      loginRequired: false
    };
  }

  if (!isXhsProfileSnapshotStable(current, previousValue)) {
    return {
      ok: false,
      status: XHS_PAGE_READ_STATUS.NOT_READY,
      code: 'XHS_PROFILE_STABILIZING',
      retryable: true,
      manualIntervention: false,
      profileReady: false,
      riskDetected: false,
      riskText: '',
      loginRequired: false
    };
  }

  return {
    ok: true,
    status: XHS_PAGE_READ_STATUS.READY,
    code: 'XHS_PROFILE_READY',
    retryable: false,
    manualIntervention: false,
    profileReady: true,
    riskDetected: false,
    riskText: '',
    loginRequired: false,
    contact: parsePublicContactSnapshot(current)
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
  XHS_PAGE_READ_STATUS,
  XHS_PROFILE_HOSTS,
  XHS_RISK_PATTERNS,
  buildXhsRiskDetectionSnippet,
  classifyXhsProfilePageRead,
  cleanStr,
  contactFieldCount,
  detectXhsLogin,
  detectXhsRisk,
  extractPgyCreatorEntityId,
  extractPublicEmails,
  extractXhsProfileEntityId,
  extractVisibleMailtoEmails,
  firstProfileUrl,
  isIgnorableXhsNavigationError,
  isXhsWebUrl,
  isXhsProfileSnapshotStable,
  mergeContactFields,
  normalizeEmailText,
  normalizePhone,
  normalizePgyCreatorUrl,
  normalizeXhsPageSnapshot,
  normalizeXhsProfileUrl,
  parsePublicContactSnapshot,
  parsePublicContactText,
  xhsProfileMatchesPgyCreator,
  xhsProfileSourceMatchesPgyCreator,
  xhsProfileUrlFromPgyCreator,
  xhsProfileSnapshotFingerprint
};
