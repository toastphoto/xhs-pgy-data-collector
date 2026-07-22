const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');

const CONTACT_COLUMNS = [
  '选择建联',
  '跟进状态',
  '优先级',
  '排除原因',
  '达人昵称',
  '小红书号',
  '蒲公英链接',
  '粉丝数',
  '图文报价',
  '视频报价',
  '内容标签',
  '地区',
  '推荐理由',
  '邮箱',
  '微信号',
  '手机号',
  '建联渠道',
  '微信分组标签',
  '打招呼内容',
  '备注'
];

const SUMMARY_COLUMNS = ['指标', '数量'];

const CONTACT_CHANNELS = ['自动分流', '蒲公英邀约', '微信建联', '邮件建联', '待补联系方式'];

const XMF_COLUMNS = [
  '微信号码',
  '智能备注',
  '标签',
  '发送添加朋友申请',
  '任务微信(为空则智能分配)'
];

const XMF_TEMPLATE_HELP_HEADER = [
  '智能备注通配符说明：',
  '如下是系统指定的三种通配符',
  '{YYMMDD}',
  '{MMDD}',
  '{昵称}',
  '',
  '示例：{MMDD}-{昵称}'
].join('\n');

const PGY_INVITE_COLUMNS = [
  '达人昵称',
  '小红书号',
  '蒲公英链接',
  '粉丝数',
  '图文报价',
  '视频报价',
  '合作类型',
  '品牌名',
  '产品名称',
  '联系方式',
  '合作内容介绍',
  '期望发布开始时间',
  '期望发布结束时间',
  '跟进状态',
  '优先级',
  '推荐理由',
  '备注'
];

const EMAIL_CONTACT_COLUMNS = [
  '邮箱',
  '达人昵称',
  '小红书号',
  '蒲公英链接',
  '邮件标题',
  '邮件正文',
  '跟进状态',
  '优先级',
  '推荐理由',
  '备注'
];

const PENDING_CONTACT_COLUMNS = [
  '达人昵称',
  '小红书号',
  '蒲公英链接',
  '邮箱',
  '微信号',
  '手机号',
  '建议建联方式',
  '待补内容',
  '跟进状态',
  '优先级',
  '推荐理由',
  '备注'
];

function cleanStr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function timestampForFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

function normalizeUrl(value) {
  const s = cleanStr(value);
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function firstFilled(...values) {
  for (const value of values) {
    const text = cleanStr(value);
    if (text) return text;
  }
  return '';
}

function makeRowId({ creatorUrl, xhsId, creatorName, index }) {
  const base = firstFilled(creatorUrl, xhsId, creatorName, `row_${index + 1}`);
  return `row_${crypto.createHash('sha256').update(base).digest('base64url').slice(0, 32)}`;
}

function makeLegacyRowId({ creatorUrl, xhsId, creatorName, index }) {
  const base = firstFilled(creatorUrl, xhsId, creatorName, `row_${index + 1}`);
  return Buffer.from(base).toString('base64url').slice(0, 48);
}

function creatorEntityId(value, marker) {
  try {
    const pathname = new URL(normalizeUrl(value)).pathname;
    return cleanStr(pathname.match(marker)?.[1]);
  } catch (_) {
    return '';
  }
}

function legacyReviewMatchesCreator(review, creatorUrl) {
  const profileId = creatorEntityId(review?.xhsProfileUrl, /\/user\/profile\/([^/]+)/i);
  const creatorId = creatorEntityId(creatorUrl, /\/blogger-detail\/([^/]+)/i);
  return Boolean(profileId && creatorId && profileId === creatorId);
}

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return fallback;
  }
}

function findRawResultFiles(runDir) {
  const files = [];
  if (!runDir || !fs.existsSync(runDir)) return files;

  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fp);
      else if (entry.isFile() && entry.name === 'raw_result.json') files.push(fp);
    }
  };
  walk(runDir);
  return files.sort();
}

function readResults(runDir) {
  return findRawResultFiles(runDir)
    .map((fp) => {
      try {
        return { fp, obj: JSON.parse(fs.readFileSync(fp, 'utf-8')) };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function readCandidateReviewMap(runDir) {
  const map = new Map();
  const meta = readJson(path.join(String(runDir || ''), 'meta.json'), null);
  const candidates = [
    ...(Array.isArray(meta?.signingTask?.candidates) ? meta.signingTask.candidates : []),
    ...(Array.isArray(meta?.items) ? meta.items : [])
  ];
  for (const item of candidates) {
    const url = normalizeUrl(item?.pgy_url || item?.url);
    if (!url || map.has(url)) continue;
    const status = cleanStr(item?.status || item?.candidateStatus);
    map.set(url, {
      selected: false,
      followupStatus: status === 'excluded' ? '不建联' : '',
      priority: cleanStr(item?.priority),
      excludeReason: cleanStr(item?.excludeReason || item?.exclude_reason),
      note: cleanStr(item?.note),
      creatorName: cleanStr(item?.creator_name || item?.creatorName || item?.name || item?.label)
    });
  }
  return map;
}

function normalizeReviewMap(reviewRows) {
  const map = new Map();
  if (!Array.isArray(reviewRows)) return map;
  for (const row of reviewRows) {
    const rowId = cleanStr(row?.rowId);
    if (!rowId) continue;
    map.set(rowId, {
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
      contactChannel: normalizeContactChannel(row?.contactChannel || '', '')
    });
  }
  return map;
}

function normalizeContactChannel(value, fallback = '微信建联') {
  const text = cleanStr(value);
  if (!text) return fallback;
  if (/自动|auto/i.test(text)) return '自动分流';
  if (/蒲公英|邀约|pgy/i.test(text)) return '蒲公英邀约';
  if (/邮件|邮箱|email|mail/i.test(text)) return '邮件建联';
  if (/微信|小蜜蜂|wechat|xmf/i.test(text)) return '微信建联';
  if (/待补|pending/i.test(text)) return '待补联系方式';
  return CONTACT_CHANNELS.includes(text) ? text : fallback;
}

function extractEmailFromText(value) {
  const text = cleanStr(value);
  if (!text) return '';
  const matched = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return matched ? matched[0] : '';
}

function findEmailInObject(obj) {
  const direct = firstFilled(
    obj?.email,
    obj?.mail,
    obj?.contact_email,
    obj?.creator_email,
    obj?.['邮箱'],
    obj?.['邮件']
  );
  if (extractEmailFromText(direct)) return extractEmailFromText(direct);
  try {
    return extractEmailFromText(JSON.stringify(obj || {}));
  } catch (_) {
    return '';
  }
}

function buildRecommendation({ metrics, summary, qualityReport }) {
  const parts = [];
  const followers = firstFilled(metrics['粉丝数'], summary.followers);
  const priceImage = firstFilled(metrics['图文笔记一口价'], metrics['图文报价'], summary.price_image);
  const readMedian = firstFilled(metrics['近90天笔记阅读中位数'], metrics['阅读中位数'], metrics['图文预估阅读量']);
  const interact = firstFilled(metrics['互动率'], metrics['近90天笔记互动中位数']);
  if (followers) parts.push(`粉丝 ${followers}`);
  if (priceImage) parts.push(`图文报价 ${priceImage}`);
  if (readMedian) parts.push(`阅读 ${readMedian}`);
  if (interact) parts.push(`互动 ${interact}`);
  if (qualityReport?.score != null) parts.push(`采集质量 ${qualityReport.score}`);
  return parts.join(' / ');
}

function buildContactPreviewRows(runDir, options = {}) {
  const results = readResults(runDir);
  const defaultGreeting = cleanStr(options.defaultGreeting || '您好，我们想和您沟通一下品牌合作，方便的话可以通过一下好友吗？');
  const defaultGroupTag = cleanStr(options.defaultGroupTag || '');
  const contactChannel = normalizeContactChannel(options.contactChannel || '微信');
  const xiaomifengSmartRemark = cleanStr(options.xiaomifengSmartRemark || '{MMDD}-{昵称}');
  const xiaomifengTaskWechat = cleanStr(options.xiaomifengTaskWechat || '');
  const reviewMap = normalizeReviewMap(options.reviewRows);
  const candidateMap = readCandidateReviewMap(runDir);

  return results.map((item, index) => {
    const obj = item.obj || {};
    const summary = obj.creator_summary || {};
    const metrics = obj.metrics || {};
    const qualityReport = obj.quality_report || {};
    const creatorName = firstFilled(summary.creator_name, summary.name);
    const xhsId = firstFilled(summary.xhs_id, summary.xhsId);
    const creatorUrl = firstFilled(summary.creator_url, obj.creator_url);
    const tags = firstFilled(summary.tags, metrics['内容标签']);
    const region = firstFilled(summary.location, summary.region, metrics['地区']);
    const followers = firstFilled(metrics['粉丝数'], summary.followers);
    const imagePrice = firstFilled(metrics['图文笔记一口价'], metrics['图文报价'], summary.price_image);
    const videoPrice = firstFilled(metrics['视频笔记一口价'], metrics['视频报价'], summary.price_video);
    const recommendation = buildRecommendation({ metrics, summary, qualityReport });
    const rowId = makeRowId({ creatorUrl, xhsId, creatorName, index });
    const legacyReview = reviewMap.get(makeLegacyRowId({ creatorUrl, xhsId, creatorName, index })) || {};
    const migratedLegacyReview = legacyReviewMatchesCreator(legacyReview, creatorUrl) ? legacyReview : {};
    const candidateReview = candidateMap.get(normalizeUrl(creatorUrl)) || {};
    const review = { ...candidateReview, ...migratedLegacyReview, ...(reviewMap.get(rowId) || {}) };
    const selected = review.selected === true;

    return {
      rowId,
      selected,
      followupStatus: review.followupStatus || '',
      priority: review.priority || '',
      excludeReason: review.excludeReason || '',
      note: review.note || '',
      creatorName: creatorName || review.creatorName || '',
      xhsId,
      creatorUrl,
      followers,
      imagePrice,
      videoPrice,
      tags,
      region,
      recommendation,
      email: review.email || findEmailInObject(obj),
      wechatId: review.wechatId || '',
      phone: review.phone || '',
      xhsProfileUrl: review.xhsProfileUrl || '',
      contactSource: review.contactSource || '',
      contactCollectedAt: review.contactCollectedAt || '',
      contactCollectionStatus: review.contactCollectionStatus || '',
      contactChannel: normalizeContactChannel(review.contactChannel || contactChannel),
      groupTag: defaultGroupTag,
      greeting: defaultGreeting,
      xiaomifengSmartRemark,
      xiaomifengTaskWechat,
      pgyInvite: normalizePgyInviteOptions(options),
      emailTemplate: normalizeEmailOptions(options),
      runSubdir: path.basename(path.dirname(item.fp)),
      jsonPath: item.fp
    };
  });
}

function defaultFollowupStatus(row) {
  const status = cleanStr(row?.followupStatus);
  if (status) return status;
  return row?.selected === true ? '待建联' : '';
}

function contactRowFromPreview(row) {
  return {
    '选择建联': row.selected ? '是' : '否',
    '跟进状态': defaultFollowupStatus(row),
    '优先级': row.priority || '',
    '排除原因': row.selected ? '' : (row.excludeReason || ''),
    '达人昵称': row.creatorName || '',
    '小红书号': row.xhsId || '',
    '蒲公英链接': row.creatorUrl || '',
    '粉丝数': row.followers || '',
    '图文报价': row.imagePrice || '',
    '视频报价': row.videoPrice || '',
    '内容标签': row.tags || '',
    '地区': row.region || '',
    '推荐理由': row.recommendation || '',
    '邮箱': row.email || '',
    '微信号': row.wechatId || '',
    '手机号': row.phone || '',
    '建联渠道': normalizeContactChannel(row.contactChannel || '微信'),
    '微信分组标签': row.groupTag || '',
    '打招呼内容': row.greeting || '',
    '备注': row.note || ''
  };
}

function normalizePgyInviteOptions(options = {}) {
  return {
    cooperationType: cleanStr(options.pgyCooperationType || options.cooperationType || '图文'),
    brandName: cleanStr(options.pgyBrandName || options.brandName || ''),
    productName: cleanStr(options.pgyProductName || options.productName || ''),
    contactWay: cleanStr(options.pgyContactWay || options.contactWay || ''),
    intro: cleanStr(options.pgyIntro || options.cooperationIntro || ''),
    publishStart: cleanStr(options.pgyPublishStart || options.publishStart || ''),
    publishEnd: cleanStr(options.pgyPublishEnd || options.publishEnd || '')
  };
}

function normalizeEmailOptions(options = {}) {
  return {
    subject: cleanStr(options.emailSubject || ''),
    body: cleanStr(options.emailBody || '')
  };
}

function xiaomifengRowFromPreview(row) {
  return {
    '微信号码': firstFilled(row.wechatId, row.phone),
    '智能备注': row.xiaomifengSmartRemark || '{MMDD}-{昵称}',
    '标签': row.groupTag || '',
    '发送添加朋友申请': row.greeting || '',
    '任务微信(为空则智能分配)': row.xiaomifengTaskWechat || ''
  };
}

function pgyInviteRowFromPreview(row) {
  const invite = row.pgyInvite || {};
  return {
    '达人昵称': row.creatorName || '',
    '小红书号': row.xhsId || '',
    '蒲公英链接': row.creatorUrl || '',
    '粉丝数': row.followers || '',
    '图文报价': row.imagePrice || '',
    '视频报价': row.videoPrice || '',
    '合作类型': invite.cooperationType || '',
    '品牌名': invite.brandName || '',
    '产品名称': invite.productName || '',
    '联系方式': invite.contactWay || '',
    '合作内容介绍': invite.intro || '',
    '期望发布开始时间': invite.publishStart || '',
    '期望发布结束时间': invite.publishEnd || '',
    '跟进状态': defaultFollowupStatus(row),
    '优先级': row.priority || '',
    '推荐理由': row.recommendation || '',
    '备注': row.note || ''
  };
}

function emailContactRowFromPreview(row) {
  const tpl = row.emailTemplate || {};
  return {
    '邮箱': row.email || '',
    '达人昵称': row.creatorName || '',
    '小红书号': row.xhsId || '',
    '蒲公英链接': row.creatorUrl || '',
    '邮件标题': tpl.subject || '',
    '邮件正文': tpl.body || '',
    '跟进状态': defaultFollowupStatus(row),
    '优先级': row.priority || '',
    '推荐理由': row.recommendation || '',
    '备注': row.note || ''
  };
}

function pendingContactRowFromPreview(row) {
  const channel = resolveExecutionChannel(row);
  const missing = [];
  if (channel === '微信建联' && !hasWechatContactInfo(row)) missing.push('微信号或手机号');
  if (channel === '邮件建联' && !hasEmailInfo(row)) missing.push('邮箱');
  return {
    '达人昵称': row.creatorName || '',
    '小红书号': row.xhsId || '',
    '蒲公英链接': row.creatorUrl || '',
    '邮箱': row.email || '',
    '微信号': row.wechatId || '',
    '手机号': row.phone || '',
    '建议建联方式': channel,
    '待补内容': missing.join('、') || '联系方式',
    '跟进状态': defaultFollowupStatus(row),
    '优先级': row.priority || '',
    '推荐理由': row.recommendation || '',
    '备注': row.note || ''
  };
}

function hasWechatContactInfo(row) {
  return Boolean(cleanStr(row?.wechatId) || cleanStr(row?.phone));
}

function hasEmailInfo(row) {
  return Boolean(cleanStr(row?.email));
}

function hasContactInfo(row) {
  return Boolean(hasWechatContactInfo(row) || hasEmailInfo(row));
}

function resolveExecutionChannel(row) {
  const channel = normalizeContactChannel(row?.contactChannel || '微信');
  if (channel !== '自动分流') return channel;
  if (hasWechatContactInfo(row)) return '微信建联';
  if (hasEmailInfo(row)) return '邮件建联';
  return '蒲公英邀约';
}

function summarizeContactWorkbookRows(previewRows) {
  const rows = Array.isArray(previewRows) ? previewRows : [];
  const followupStatusCounts = {};
  const summary = {
    total: rows.length,
    selected: 0,
    excluded: 0,
    withContact: 0,
    withWechatContact: 0,
    withEmail: 0,
    selectedWithContact: 0,
    selectedPgyInvite: 0,
    selectedEmail: 0,
    selectedWechat: 0,
    selectedMissingContact: 0,
    followupStatusCounts
  };

  rows.forEach((row) => {
    const selected = row?.selected === true;
    const hasContact = hasContactInfo(row);
    const hasWechat = hasWechatContactInfo(row);
    const hasEmail = hasEmailInfo(row);
    const channel = selected ? resolveExecutionChannel(row) : '';
    const status = defaultFollowupStatus(row);
    if (status) followupStatusCounts[status] = (followupStatusCounts[status] || 0) + 1;
    if (selected) summary.selected += 1;
    else summary.excluded += 1;
    if (hasContact) summary.withContact += 1;
    if (hasWechat) summary.withWechatContact += 1;
    if (hasEmail) summary.withEmail += 1;
    if (selected && hasContact) summary.selectedWithContact += 1;
    if (selected && channel === '蒲公英邀约') summary.selectedPgyInvite += 1;
    if (selected && hasEmail) summary.selectedEmail += 1;
    if (selected && channel === '微信建联' && hasWechat) summary.selectedWechat += 1;
    if (selected && (
      channel === '待补联系方式' ||
      (channel === '微信建联' && !hasWechat) ||
      (channel === '邮件建联' && !hasEmail)
    )) summary.selectedMissingContact += 1;
  });

  return summary;
}

function summaryRowsFromStats(summary) {
  const rows = [
    { '指标': '总达人', '数量': summary.total },
    { '指标': '选择建联', '数量': summary.selected },
    { '指标': '不建联/已排除', '数量': summary.excluded },
    { '指标': '已有联系方式', '数量': summary.withContact },
    { '指标': '微信/手机联系方式', '数量': summary.withWechatContact },
    { '指标': '邮箱联系方式', '数量': summary.withEmail },
    { '指标': '蒲公英邀约行', '数量': summary.selectedPgyInvite },
    { '指标': '邮件建联行', '数量': summary.selectedEmail },
    { '指标': '小蜜蜂导入行', '数量': summary.selectedWechat },
    { '指标': '待补联系方式', '数量': summary.selectedMissingContact }
  ];
  Object.keys(summary.followupStatusCounts || {}).sort().forEach((status) => {
    rows.push({ '指标': `跟进状态：${status}`, '数量': summary.followupStatusCounts[status] });
  });
  return rows;
}

function buildContactRowsFromRun(runDir, options = {}) {
  const previewRows = buildContactPreviewRows(runDir, options);
  return buildContactRowsFromPreviewRows(previewRows);
}

function buildContactRowsFromPreviewRows(previewRowsInput) {
  const previewRows = Array.isArray(previewRowsInput) ? previewRowsInput : [];
  const contactRows = previewRows.map(contactRowFromPreview);
  const selectedRows = previewRows.filter((row) => row.selected);
  const pgyInviteRows = selectedRows
    .filter((row) => resolveExecutionChannel(row) === '蒲公英邀约')
    .map(pgyInviteRowFromPreview);
  const emailContactRows = selectedRows
    .filter(hasEmailInfo)
    .map(emailContactRowFromPreview);
  const xiaomifengRows = previewRows
    .filter((row) => row.selected && resolveExecutionChannel(row) === '微信建联' && hasWechatContactInfo(row))
    .map(xiaomifengRowFromPreview);
  const pendingContactRows = previewRows
    .filter((row) => {
      if (!row.selected) return false;
      const channel = resolveExecutionChannel(row);
      if (channel === '待补联系方式') return true;
      if (channel === '微信建联') return !hasWechatContactInfo(row);
      if (channel === '邮件建联') return !hasEmailInfo(row);
      return false;
    })
    .map(pendingContactRowFromPreview);
  const summary = summarizeContactWorkbookRows(previewRows);
  const summaryRows = summaryRowsFromStats(summary);

  return { contactRows, pgyInviteRows, emailContactRows, xiaomifengRows, pendingContactRows, summary, summaryRows, files: previewRows.length, previewRows };
}

function summarizePreviewRows(previewRows) {
  const rows = Array.isArray(previewRows) ? previewRows : [];
  return rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row?.selected) acc.selected += 1;
      else acc.excluded += 1;
      if (hasContactInfo(row)) acc.withContact += 1;
      return acc;
    },
    { total: 0, selected: 0, excluded: 0, withContact: 0 }
  );
}

function getContactPreview(runDir, options = {}) {
  const rawFiles = findRawResultFiles(runDir);
  const previewRows = buildContactPreviewRows(runDir, options);
  return {
    rows: previewRows,
    summary: summarizePreviewRows(previewRows),
    files: previewRows.length,
    rawFiles: rawFiles.length
  };
}

function sheetFromRows(rows, columns) {
  const aoa = [columns];
  for (const row of rows) aoa.push(columns.map((col) => row[col] ?? ''));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((col) => {
    if (/链接|打招呼|推荐|备注|标签/.test(col)) return { wch: 28 };
    if (/达人昵称|昵称|备注名/.test(col)) return { wch: 18 };
    return { wch: 14 };
  });
  return ws;
}

function exportContactWorkbook(runDir, options = {}) {
  const rows = buildContactRowsFromRun(runDir, options);
  return writeContactWorkbook(runDir, rows, {
    outName: `建联表_${path.basename(runDir)}.xlsx`
  });
}

function writeContactWorkbook(runDir, rows, options = {}) {
  const { contactRows, pgyInviteRows, emailContactRows, xiaomifengRows, pendingContactRows, summary, summaryRows, files } = rows;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromRows(summaryRows, SUMMARY_COLUMNS), '建联概览');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(contactRows, CONTACT_COLUMNS), '建联表');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(pgyInviteRows, PGY_INVITE_COLUMNS), '蒲公英邀约表');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(emailContactRows, EMAIL_CONTACT_COLUMNS), '邮件建联表');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(xiaomifengRows, XMF_COLUMNS), '小蜜蜂导入表');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(pendingContactRows, PENDING_CONTACT_COLUMNS), '待补联系方式');

  const outName = cleanStr(options.outName) || `建联表_${path.basename(runDir)}.xlsx`;
  const outPath = path.join(runDir, outName);
  XLSX.writeFile(wb, outPath);
  return {
    outPath,
    creators: contactRows.length,
    pgyInviteRows: pgyInviteRows.length,
    emailContactRows: emailContactRows.length,
    xiaomifengRows: xiaomifengRows.length,
    pendingContactRows: pendingContactRows.length,
    summary,
    files,
    sheets: ['建联概览', '建联表', '蒲公英邀约表', '邮件建联表', '小蜜蜂导入表', '待补联系方式']
  };
}

function exportContactRowsWorkbook(runDir, previewRows, options = {}) {
  const defaultPgyInvite = normalizePgyInviteOptions(options);
  const defaultEmailTemplate = normalizeEmailOptions(options);
  const mergeNonEmpty = (base, extra) => {
    const out = { ...base };
    Object.entries(extra || {}).forEach(([key, value]) => {
      const text = cleanStr(value);
      if (text) out[key] = text;
    });
    return out;
  };
  const rows = buildContactRowsFromPreviewRows((Array.isArray(previewRows) ? previewRows : []).map((row) => ({
    ...row,
    pgyInvite: mergeNonEmpty(defaultPgyInvite, row.pgyInvite),
    emailTemplate: mergeNonEmpty(defaultEmailTemplate, row.emailTemplate)
  })));
  const suffix = cleanStr(options.suffix || '筛选结果').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || '筛选结果';
  const timestamp = cleanStr(options.timestamp) || timestampForFilename();
  return writeContactWorkbook(runDir, rows, {
    outName: `建联表_${suffix}_${timestamp}_${path.basename(runDir)}.xlsx`
  });
}

function exportXiaomifengWorkbook(runDir, previewRows, options = {}) {
  const preparedRows = (Array.isArray(previewRows) ? previewRows : []).map((row) => ({
    ...row,
    groupTag: cleanStr(options.defaultGroupTag || row?.groupTag),
    greeting: cleanStr(options.defaultGreeting || row?.greeting),
    xiaomifengSmartRemark: cleanStr(options.xiaomifengSmartRemark || row?.xiaomifengSmartRemark || '{MMDD}-{昵称}'),
    xiaomifengTaskWechat: cleanStr(options.xiaomifengTaskWechat || row?.xiaomifengTaskWechat)
  }));
  const rows = buildContactRowsFromPreviewRows(preparedRows).xiaomifengRows;
  if (!rows.length) throw new Error('没有已选择且具备微信号/手机号的微信建联达人');

  const wb = XLSX.utils.book_new();
  const aoa = [[...XMF_COLUMNS, XMF_TEMPLATE_HELP_HEADER]];
  rows.forEach((row) => aoa.push([...XMF_COLUMNS.map((col) => row[col] ?? ''), '']));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 18 }, { wch: 38 }, { wch: 28 }, { wch: 56 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Sheet2');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Sheet3');

  const timestamp = cleanStr(options.timestamp) || timestampForFilename();
  const outPath = path.join(runDir, `小蜜蜂导入_${timestamp}_${path.basename(runDir)}.xlsx`);
  XLSX.writeFile(wb, outPath);
  return { outPath, rows: rows.length, sheets: ['Sheet1', 'Sheet2', 'Sheet3'] };
}

module.exports = {
  CONTACT_COLUMNS,
  CONTACT_CHANNELS,
  EMAIL_CONTACT_COLUMNS,
  PENDING_CONTACT_COLUMNS,
  PGY_INVITE_COLUMNS,
  SUMMARY_COLUMNS,
  XMF_COLUMNS,
  buildContactPreviewRows,
  buildContactRowsFromPreviewRows,
  buildContactRowsFromRun,
  exportContactRowsWorkbook,
  exportContactWorkbook,
  exportXiaomifengWorkbook,
  findRawResultFiles,
  getContactPreview,
  makeLegacyRowId,
  makeRowId,
  summarizeContactWorkbookRows,
  summarizePreviewRows,
  timestampForFilename,
  XMF_TEMPLATE_HELP_HEADER
};
