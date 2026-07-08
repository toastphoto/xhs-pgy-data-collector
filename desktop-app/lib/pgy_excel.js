const XLSX = require('xlsx');

function cleanStr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function pickFirstPgyUrl(s) {
  const t = cleanStr(s);
  const m = t.match(/https?:\/\/pgy\.xiaohongshu\.com\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

function pickFirstXhsUrl(s) {
  const t = cleanStr(s);
  const m = t.match(/https?:\/\/(?:www\.)?xiaohongshu\.com\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

function findKeyByHeader(row, keywords, options = {}) {
  const excludes = options.excludes || [];
  const keys = Object.keys(row || {});
  for (const k of keys) {
    const name = cleanStr(k);
    if (!name) continue;
    if (excludes.some((kw) => name.includes(kw))) continue;
    if (keywords.some((kw) => name.includes(kw))) return k;
  }
  return null;
}

function normalizeStatus(value) {
  const text = cleanStr(value).toLowerCase();
  if (!text) return 'candidate';
  if (/(排除|剔除|不采|不跑|否|no|exclude|excluded|skip|skipped)/i.test(text)) return 'excluded';
  if (/(优先|入选|选择|是|yes|selected|select|include|included|p1|p2)/i.test(text)) return 'selected';
  return 'candidate';
}

function parseExcelToPgyItems(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const items = [];
  const seen = new Set();

  const sheetNames = wb.SheetNames || [];
  let scannedSheets = 0;
  let scannedRows = 0;
  let extracted = 0;

  for (const sheet of sheetNames) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
    if (!Array.isArray(rows) || rows.length === 0) continue;
    scannedSheets += 1;

    const sample = rows[0] || {};
    const colName = findKeyByHeader(sample, ['达人/备注', '达人昵称', '昵称', '达人', '博主', 'KOL']);
    const colPgy = findKeyByHeader(sample, ['蒲公英', 'pgy', 'PGY']);
    const colXhs = findKeyByHeader(sample, ['主页链接', '主页', '小红书', 'XHS']);
    const colStatus = findKeyByHeader(sample, ['状态', '初筛']);
    const colPriority = findKeyByHeader(sample, ['优先级', '优先']);
    const colExcludeReason = findKeyByHeader(sample, ['排除原因', '剔除原因', '不采原因']);
    const colNote = findKeyByHeader(sample, ['备注', '说明'], { excludes: ['达人'] });

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      scannedRows += 1;

      let pgyUrl = colPgy ? pickFirstPgyUrl(r[colPgy]) : null;
      let xhsUrl = colXhs ? pickFirstXhsUrl(r[colXhs]) : null;

      if (!pgyUrl) {
        for (const v of Object.values(r)) {
          pgyUrl = pickFirstPgyUrl(v);
          if (pgyUrl) break;
        }
      }
      if (!xhsUrl) {
        for (const v of Object.values(r)) {
          xhsUrl = pickFirstXhsUrl(v);
          if (xhsUrl) break;
        }
      }
      if (!pgyUrl) continue;
      if (seen.has(pgyUrl)) continue;
      seen.add(pgyUrl);
      extracted += 1;

      let creatorName = '';
      if (colName && r[colName] && !pickFirstPgyUrl(r[colName]) && !pickFirstXhsUrl(r[colName])) {
        creatorName = cleanStr(r[colName]);
      }

      items.push({
        creator_name: creatorName,
        pgy_url: pgyUrl,
        xhs_url: xhsUrl || '',
        status: normalizeStatus(colStatus ? r[colStatus] : ''),
        priority: cleanStr(colPriority ? r[colPriority] : ''),
        excludeReason: cleanStr(colExcludeReason ? r[colExcludeReason] : ''),
        note: cleanStr(colNote ? r[colNote] : ''),
        sheet,
        row_index: i + 2
      });
    }
  }

  return {
    ok: true,
    filePath,
    items,
    stats: {
      sheets: scannedSheets,
      rows: scannedRows,
      extracted,
      deduped: items.length
    }
  };
}

module.exports = {
  findKeyByHeader,
  normalizeStatus,
  parseExcelToPgyItems,
  pickFirstPgyUrl,
  pickFirstXhsUrl
};
