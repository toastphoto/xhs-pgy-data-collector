const XLSX = require('xlsx');

function cleanStr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeUrl(value) {
  const s = cleanStr(value);
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function parseSelected(value) {
  const text = cleanStr(value).toLowerCase();
  if (!text) return true;
  if (/^(否|不|no|n|false|0|排除|不选)$/i.test(text)) return false;
  return true;
}

function findKey(row, names) {
  const keys = Object.keys(row || {});
  for (const name of names) {
    const found = keys.find((key) => cleanStr(key) === name);
    if (found) return found;
  }
  return null;
}

function normalizeContactChannel(value) {
  const text = cleanStr(value);
  if (!text) return '';
  if (/自动|auto/i.test(text)) return '自动分流';
  if (/蒲公英|邀约|pgy/i.test(text)) return '蒲公英邀约';
  if (/邮件|邮箱|email|mail/i.test(text)) return '邮件建联';
  if (/微信|小蜜蜂|wechat|xmf/i.test(text)) return '微信建联';
  if (/待补|pending/i.test(text)) return '待补联系方式';
  return text;
}

function getRowUrl(row) {
  const keyUrl = findKey(row, ['蒲公英链接', 'pgy_url', 'PGY链接']);
  return normalizeUrl(keyUrl ? row[keyUrl] : '');
}

function parseRow(row, rowIndex, options = {}) {
  const fallbackSelected = options.fallbackSelected || '是';
  const creatorUrl = getRowUrl(row);
  if (!creatorUrl) return null;
  const keySelected = findKey(row, ['选择建联', '是否建联']);
  const keyFollowup = findKey(row, ['跟进状态', '建联状态', '状态']);
  const keyPriority = findKey(row, ['优先级']);
  const keyExclude = findKey(row, ['排除原因']);
  const keyNote = findKey(row, ['备注', '跟进备注']);
  const keyEmail = findKey(row, ['邮箱', '邮件', 'Email', 'email']);
  const keyWechat = findKey(row, ['微信号', '微信']);
  const keyPhone = findKey(row, ['手机号', '电话']);
  const keyChannel = findKey(row, ['建联渠道', '建议建联方式', '建联方式']);
  const keyName = findKey(row, ['达人昵称', '昵称', '达人']);
  return {
    creatorUrl,
    creatorName: cleanStr(keyName ? row[keyName] : ''),
    selected: options.preserveSelected ? undefined : parseSelected(keySelected ? row[keySelected] : fallbackSelected),
    followupStatus: options.preserveDecision ? '' : cleanStr(keyFollowup ? row[keyFollowup] : ''),
    priority: options.preserveDecision ? '' : cleanStr(keyPriority ? row[keyPriority] : ''),
    excludeReason: options.preserveDecision ? '' : cleanStr(keyExclude ? row[keyExclude] : ''),
    note: cleanStr(keyNote ? row[keyNote] : ''),
    email: cleanStr(keyEmail ? row[keyEmail] : ''),
    wechatId: cleanStr(keyWechat ? row[keyWechat] : ''),
    phone: cleanStr(keyPhone ? row[keyPhone] : ''),
    contactChannel: normalizeContactChannel(keyChannel ? row[keyChannel] : ''),
    rowIndex
  };
}

function mergeReviewRow(base, next) {
  if (!base) return { ...next };
  return {
    creatorUrl: base.creatorUrl,
    creatorName: next.creatorName || base.creatorName,
    selected: next.selected === undefined ? base.selected : next.selected,
    followupStatus: next.followupStatus || base.followupStatus,
    priority: next.priority || base.priority,
    excludeReason: next.excludeReason || base.excludeReason,
    note: next.note || base.note,
    email: next.email || base.email,
    wechatId: next.wechatId || base.wechatId,
    phone: next.phone || base.phone,
    contactChannel: next.contactChannel || base.contactChannel,
    rowIndex: next.rowIndex || base.rowIndex
  };
}

function parseContactReviewWorkbook(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetNames = [];
  if (wb.SheetNames.includes('建联表')) sheetNames.push('建联表');
  if (wb.SheetNames.includes('待补联系方式')) sheetNames.push('待补联系方式');
  if (!sheetNames.length && wb.SheetNames[0]) sheetNames.push(wb.SheetNames[0]);
  const byUrl = new Map();
  let scannedRows = 0;

  sheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const rows = ws ? XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) : [];
    scannedRows += rows.length;
    rows.forEach((row, index) => {
      const creatorUrl = getRowUrl(row);
      const pendingWithBase = sheetName === '待补联系方式' && byUrl.has(creatorUrl);
      const parsed = parseRow(row, index + 2, {
        fallbackSelected: '是',
        preserveSelected: pendingWithBase,
        preserveDecision: pendingWithBase
      });
      if (!parsed) return;
      byUrl.set(parsed.creatorUrl, mergeReviewRow(byUrl.get(parsed.creatorUrl), parsed));
    });
  });

  return {
    ok: true,
    filePath,
    sheetName: sheetNames[0] || '',
    sheetNames,
    rows: Array.from(byUrl.values()),
    stats: {
      scannedRows,
      matchedRows: byUrl.size
    }
  };
}

module.exports = {
  normalizeUrl,
  parseContactReviewWorkbook,
  parseSelected
};
