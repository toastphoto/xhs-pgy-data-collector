const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function cleanStr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function rawReviewText(value, max, multiline = false) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max
    || (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/ : /[\x00-\x1f\x7f-\x9f]/).test(value)) {
    throw Object.assign(new Error('未分类联系方式字段无效，未保存'), { code: 'CONTACT_REVIEW_FIELDS_INVALID' });
  }
  return value;
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
      contactRaw: rawReviewText(row?.contactRaw, 4096, true),
      contactRawSource: rawReviewText(row?.contactRawSource, 512),
      contactRawCollectedAt: rawReviewText(row?.contactRawCollectedAt, 64),
      xhsProfileUrl: cleanStr(row?.xhsProfileUrl),
      xhsProfileSourceCreatorUrl: cleanStr(row?.xhsProfileSourceCreatorUrl),
      contactSource: cleanStr(row?.contactSource),
      contactCollectedAt: cleanStr(row?.contactCollectedAt),
      feishuAccountNumber: cleanStr(row?.feishuAccountNumber),
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
    projectName: cleanStr(src.projectName),
    defaultGreeting: cleanStr(src.defaultGreeting),
    xiaomifengSmartRemark: cleanStr(src.xiaomifengSmartRemark || '{MMDD}-{昵称}') || '{MMDD}-{昵称}',
    xiaomifengTaskWechat: cleanStr(src.xiaomifengTaskWechat),
    selectionPolicy: cleanStr(src.selectionPolicy),
    contactChannel: normalizeContactChannel(src.contactChannel || '微信') || '微信建联',
    composerMethod: ['微信建联', '邮件建联', '蒲公英邀约'].includes(cleanStr(src.composerMethod))
      ? cleanStr(src.composerMethod)
      : '微信建联',
    emailSubject: cleanStr(src.emailSubject),
    emailBody: cleanStr(src.emailBody),
    pgyCooperationGoal: cleanStr(src.pgyCooperationGoal || '笔记合作') || '笔记合作',
    pgyCooperationMode: cleanStr(src.pgyCooperationMode || '定制合作') || '定制合作',
    pgyCooperationType: cleanStr(src.pgyCooperationType || '图文') || '图文',
    pgyContactChannel: cleanStr(src.pgyContactChannel || '微信') || '微信',
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
  try {
    const obj = JSON.parse(fs.readFileSync(reviewPath, 'utf-8'));
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !Array.isArray(obj.reviewRows)
      || obj.reviewRows.some(row => !row || typeof row !== 'object' || Array.isArray(row)
        || typeof row.rowId !== 'string' || !cleanStr(row.rowId))
      || (obj.settings !== undefined && (!obj.settings || typeof obj.settings !== 'object' || Array.isArray(obj.settings)))) {
      throw new Error('invalid review document');
    }
    return {
      runKey: makeRunKey(runDir),
      runDir: String(obj?.runDir || runDir || ''),
      reviewRows: normalizeReviewRows(obj?.reviewRows),
      settings: normalizeSettings(obj?.settings),
      updatedAt: cleanStr(obj?.updatedAt)
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { runKey: makeRunKey(runDir), runDir: String(runDir || ''),
        reviewRows: [], settings: normalizeSettings(), updatedAt: '' };
    }
    throw Object.assign(new Error('复核文件读取失败，已保留原文件，请核对或恢复备份后重试'), { code: 'CONTACT_REVIEW_READ_FAILED' });
  }
}

function saveContactReview(storeDir, runDir, payload = {}) {
  const reviewPath = getReviewPath(storeDir, runDir);
  // Never replace an unreadable review with an inferred empty document.
  loadContactReview(storeDir, runDir);
  const saved = {
    runKey: makeRunKey(runDir),
    runDir: String(runDir || ''),
    reviewRows: normalizeReviewRows(payload.reviewRows),
    settings: normalizeSettings(payload.settings),
    updatedAt: new Date().toISOString()
  };
  const temporary = `${reviewPath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(saved, null, 2), { encoding: 'utf-8', flag: 'wx' });
    fs.renameSync(temporary, reviewPath);
  } catch (error) {
    if (error?.code !== 'EEXIST') { try { fs.unlinkSync(temporary); } catch (_) {} }
    throw error;
  }
  return saved;
}

module.exports = {
  getReviewPath,
  loadContactReview,
  makeRunKey,
  normalizeReviewRows,
  saveContactReview
};
