const fs = require('fs');
const path = require('path');

function cleanStr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeRunKey(runDir) {
  const base = path.basename(String(runDir || '').trim()) || 'default';
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'default';
}

function normalizeContactChannel(value, fallback = '') {
  const text = cleanStr(value);
  if (!text) return fallback;
  if (/自动|auto/i.test(text)) return '自动分流';
  if (/蒲公英|邀约|pgy/i.test(text)) return '蒲公英邀约';
  if (/邮件|邮箱|email|mail/i.test(text)) return '邮件建联';
  if (/微信|小蜜蜂|wechat|xmf/i.test(text)) return '微信建联';
  if (/待补|pending/i.test(text)) return '待补联系方式';
  return text;
}

function getReviewPath(storeDir, runDir) {
  return path.join(ensureDir(storeDir), `${makeRunKey(runDir)}.json`);
}

function normalizeReviewRows(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const rowId = cleanStr(row?.rowId);
    if (!rowId || seen.has(rowId)) continue;
    seen.add(rowId);
    out.push({
      rowId,
      selected: row?.selected === true,
      followupStatus: cleanStr(row?.followupStatus),
      priority: cleanStr(row?.priority),
      excludeReason: cleanStr(row?.excludeReason),
      note: cleanStr(row?.note),
      email: cleanStr(row?.email),
      wechatId: cleanStr(row?.wechatId),
      phone: cleanStr(row?.phone),
      xhsProfileUrl: cleanStr(row?.xhsProfileUrl),
      contactSource: cleanStr(row?.contactSource),
      contactCollectedAt: cleanStr(row?.contactCollectedAt),
      contactCollectionStatus: cleanStr(row?.contactCollectionStatus),
      contactCollectionCode: cleanStr(row?.contactCollectionCode),
      contactCollectionError: cleanStr(row?.contactCollectionError),
      contactChannel: normalizeContactChannel(row?.contactChannel)
    });
  }
  return out;
}

function normalizeSettings(settings) {
  const src = settings && typeof settings === 'object' ? settings : {};
  return {
    defaultGroupTag: cleanStr(src.defaultGroupTag),
    defaultGreeting: cleanStr(src.defaultGreeting),
    xiaomifengSmartRemark: cleanStr(src.xiaomifengSmartRemark || '{MMDD}-{昵称}') || '{MMDD}-{昵称}',
    xiaomifengTaskWechat: cleanStr(src.xiaomifengTaskWechat),
    selectionPolicy: cleanStr(src.selectionPolicy),
    contactChannel: normalizeContactChannel(src.contactChannel || '微信') || '微信建联',
    emailSubject: cleanStr(src.emailSubject),
    emailBody: cleanStr(src.emailBody),
    pgyCooperationType: cleanStr(src.pgyCooperationType || '图文') || '图文',
    pgyBrandName: cleanStr(src.pgyBrandName),
    pgyProductName: cleanStr(src.pgyProductName),
    pgyContactWay: cleanStr(src.pgyContactWay),
    pgyIntro: cleanStr(src.pgyIntro),
    pgyPublishStart: cleanStr(src.pgyPublishStart),
    pgyPublishEnd: cleanStr(src.pgyPublishEnd)
  };
}

function loadContactReview(storeDir, runDir) {
  const reviewPath = getReviewPath(storeDir, runDir);
  if (!fs.existsSync(reviewPath)) {
    return {
      runKey: makeRunKey(runDir),
      runDir: String(runDir || ''),
      reviewRows: [],
      settings: normalizeSettings(),
      updatedAt: ''
    };
  }
  try {
    const obj = JSON.parse(fs.readFileSync(reviewPath, 'utf-8'));
    return {
      runKey: makeRunKey(runDir),
      runDir: String(obj?.runDir || runDir || ''),
      reviewRows: normalizeReviewRows(obj?.reviewRows),
      settings: normalizeSettings(obj?.settings),
      updatedAt: cleanStr(obj?.updatedAt)
    };
  } catch (_) {
    return {
      runKey: makeRunKey(runDir),
      runDir: String(runDir || ''),
      reviewRows: [],
      settings: normalizeSettings(),
      updatedAt: ''
    };
  }
}

function saveContactReview(storeDir, runDir, payload = {}) {
  const reviewPath = getReviewPath(storeDir, runDir);
  const saved = {
    runKey: makeRunKey(runDir),
    runDir: String(runDir || ''),
    reviewRows: normalizeReviewRows(payload.reviewRows),
    settings: normalizeSettings(payload.settings),
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(reviewPath, JSON.stringify(saved, null, 2), 'utf-8');
  return saved;
}

module.exports = {
  getReviewPath,
  loadContactReview,
  makeRunKey,
  normalizeReviewRows,
  saveContactReview
};
