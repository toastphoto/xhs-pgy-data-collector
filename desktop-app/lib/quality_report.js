const DEFAULT_REQUIRED_CREATOR_FIELDS = [
  { key: 'creator_name', label: '达人昵称' },
  { key: 'xhs_id', label: '小红书号' },
  { key: 'creator_url', label: '蒲公英链接' }
];

const DEFAULT_REQUIRED_METRICS = [
  { key: '粉丝数', label: '粉丝数' },
  { key: '图文笔记一口价', label: '图文笔记一口价' },
  { key: '视频笔记一口价', label: '视频笔记一口价' }
];

function isFilled(value) {
  if (value === undefined || value === null) return false;
  const s = String(value).trim();
  return Boolean(s && s !== '-' && s !== '--' && s.toLowerCase() !== 'null');
}

function buildQualityReport(rawResult, options = {}) {
  const result = rawResult && typeof rawResult === 'object' ? rawResult : {};
  const creator = result.creator_summary && typeof result.creator_summary === 'object' ? result.creator_summary : {};
  const metrics = result.metrics && typeof result.metrics === 'object' ? result.metrics : {};
  const pages = Array.isArray(result.pages) ? result.pages : [];
  const notesTop = Array.isArray(result.notes_top10) ? result.notes_top10 : [];

  const requiredCreatorFields = Array.isArray(options.requiredCreatorFields)
    ? options.requiredCreatorFields
    : DEFAULT_REQUIRED_CREATOR_FIELDS;
  const requiredMetrics = Array.isArray(options.requiredMetrics)
    ? options.requiredMetrics
    : DEFAULT_REQUIRED_METRICS;

  const missingCreatorFields = requiredCreatorFields
    .filter((field) => !isFilled(creator[field.key]))
    .map((field) => ({ type: 'creator', key: field.key, label: field.label || field.key }));

  const missingMetrics = requiredMetrics
    .filter((field) => !isFilled(metrics[field.key]))
    .map((field) => ({ type: 'metric', key: field.key, label: field.label || field.key }));

  const failedPages = pages
    .filter((page) => page && page.ok === false)
    .map((page) => ({
      name: String(page.name || ''),
      tabText: String(page.tabText || ''),
      reason: String(page.reason || 'unknown')
    }));

  const warnings = [];
  if (!pages.length) warnings.push({ code: 'no_evidence_pages', message: '没有保存页面证据' });
  if (!notesTop.length) warnings.push({ code: 'no_top_notes', message: '没有采到近 10 条笔记数据' });
  for (const page of failedPages) {
    warnings.push({
      code: 'page_extract_incomplete',
      message: `页面采集不完整：${page.name || page.tabText || 'unknown'}`
    });
  }

  const missingCount = missingCreatorFields.length + missingMetrics.length;
  const score = Math.max(0, 100 - missingCount * 12 - failedPages.length * 8 - warnings.length * 3);

  return {
    ok: missingCount === 0 && failedPages.length === 0,
    score,
    missingCount,
    missingCreatorFields,
    missingMetrics,
    failedPages,
    warnings,
    evidencePageCount: pages.length,
    topNoteCount: notesTop.length,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  DEFAULT_REQUIRED_CREATOR_FIELDS,
  DEFAULT_REQUIRED_METRICS,
  buildQualityReport,
  isFilled
};
