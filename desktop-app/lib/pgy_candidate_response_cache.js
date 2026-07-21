function cleanText(value, max = 180) {
  return String(value == null ? '' : value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function firstText(object, keys) {
  for (const key of keys) {
    const value = cleanText(object?.[key]);
    if (value) return value;
  }
  return '';
}

function normalizePgyCandidateRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = firstText(raw, ['userId', 'kolId', 'bloggerId', 'creatorId', 'user_id', 'kol_id', 'id']);
  const name = firstText(raw, ['name', 'kolName', 'creatorName', 'nickName', 'nickname', 'userName']);
  const fans = firstText(raw, ['fansNum', 'fansCnt', 'fansCount', 'followers', 'followerCount']);
  const read = firstText(raw, ['clickMidNum', 'readCnt', 'readMedian', 'readCount']);
  const interact = firstText(raw, ['mEngagementNum', 'interCnt', 'interactMedian', 'engagementCount']);
  const signal = [
    fans,
    read,
    interact,
    firstText(raw, ['headPhoto', 'picturePrice', 'videoPrice', 'contentTags', 'personalTags'])
  ].filter(Boolean).length;
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(id) || !name || signal < 1) return null;
  const note = [
    fans ? `粉丝 ${fans}` : '',
    read ? `阅读中位数 ${read}` : '',
    interact ? `互动中位数 ${interact}` : ''
  ].filter(Boolean).join(' / ');
  return {
    pgy_url: `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${encodeURIComponent(id)}`,
    creator_name: name,
    note,
    status: 'candidate',
    priority: '',
    excludeReason: ''
  };
}

function extractPgyCandidateSources(payload, options = {}) {
  const maxDepth = Math.max(1, Number(options.maxDepth || 7));
  const maxArrayLength = Math.max(20, Number(options.maxArrayLength || 2000));
  const sources = [];
  const seen = new Set();

  function visit(value, path = 'response', depth = 0) {
    if (!value || typeof value !== 'object' || depth > maxDepth || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > maxArrayLength) return;
      const rows = [];
      const urls = new Set();
      for (const entry of value) {
        const row = normalizePgyCandidateRecord(entry);
        if (!row || urls.has(row.pgy_url)) continue;
        urls.add(row.pgy_url);
        rows.push(row);
      }
      if (rows.length) {
        const pathBonus = /list|data|source|items|records|kol|blogger|creator|result|table/i.test(path) ? 30 : 0;
        sources.push({ path, rows, score: rows.length * 24 + pathBonus });
      }
      for (let index = 0; index < Math.min(value.length, 80); index += 1) {
        visit(value[index], `${path}[${index}]`, depth + 1);
      }
      return;
    }
    let keys = [];
    try { keys = Object.keys(value); } catch (_) {}
    for (const key of keys.slice(0, 180)) visit(value[key], `${path}.${key}`, depth + 1);
  }

  visit(payload);
  return sources.sort((a, b) => b.score - a.score || b.rows.length - a.rows.length);
}

class PgyCandidateResponseCache {
  constructor(options = {}) {
    this.maxEntries = Math.max(2, Number(options.maxEntries || 30));
    this.maxAgeMs = Math.max(1000, Number(options.maxAgeMs || 10 * 60 * 1000));
    this.entries = [];
  }

  capture(payload, capturedAt = Date.now()) {
    const best = extractPgyCandidateSources(payload)[0];
    if (!best?.rows?.length) return { captured: 0 };
    this.entries.unshift({ capturedAt, rows: best.rows, path: best.path });
    this.entries = this.entries.slice(0, this.maxEntries);
    return { captured: best.rows.length };
  }

  latest(limit, now = Date.now()) {
    this.entries = this.entries.filter((entry) => now - entry.capturedAt <= this.maxAgeMs);
    const entry = this.entries[0];
    if (!entry) return null;
    const requested = Math.max(1, Number(limit || 50));
    const items = entry.rows.slice(0, requested);
    return {
      ok: true,
      items,
      stats: {
        requested,
        available: entry.rows.length,
        extracted: items.length,
        source: 'pgy-list-response'
      },
      message: items.length >= requested
        ? `已按当前排序读取前 ${requested} 位达人。`
        : `当前结果可读取 ${items.length} 位达人，少于指令中的 ${requested} 位。`
    };
  }

  clear() {
    this.entries = [];
  }
}

module.exports = {
  PgyCandidateResponseCache,
  extractPgyCandidateSources,
  normalizePgyCandidateRecord
};
