const fs = require('fs');
const path = require('path');
const MiniSearch = require('minisearch');
const { dbAll } = require('../db/sqlite');

/**
 * Build MiniSearch index from docs.
 * docs: [{id, full_text, ...storeFields}]
 */
function buildIndexFromDocs(docs) {
  const index = new MiniSearch({
    fields: ['full_text'],
    storeFields: ['id', 'creator_url', 'creator_name', 'xhs_id', 'region', 'tags'],
    searchOptions: {
      boost: { full_text: 2 },
      prefix: true,
      fuzzy: 0.2
    }
  });
  index.addAll(Array.isArray(docs) ? docs : []);
  const meta = {
    version: 1,
    docCount: Array.isArray(docs) ? docs.length : 0,
    builtAt: new Date().toISOString()
  };
  return { index, meta };
}

function searchIndex(index, query, limit = 50) {
  if (!index) return [];
  const q = String(query || '').trim();
  if (!q) return [];
  const hits = index.search(q, { limit: Math.max(1, Math.min(200, Number(limit) || 50)) });
  return hits;
}

function getKbDir(userDataDir) {
  const dir = path.join(String(userDataDir || ''), 'kb');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveIndexToDisk({ userDataDir, index, meta }) {
  const dir = getKbDir(userDataDir);
  const idxPath = path.join(dir, 'index.json');
  const metaPath = path.join(dir, 'meta.json');
  fs.writeFileSync(idxPath, JSON.stringify(index.toJSON(), null, 2), 'utf-8');
  fs.writeFileSync(metaPath, JSON.stringify(meta || {}, null, 2), 'utf-8');
  return { idxPath, metaPath };
}

function loadIndexFromDisk({ userDataDir }) {
  const dir = getKbDir(userDataDir);
  const idxPath = path.join(dir, 'index.json');
  const metaPath = path.join(dir, 'meta.json');
  if (!fs.existsSync(idxPath)) return { ok: true, index: null, meta: null };
  const json = JSON.parse(fs.readFileSync(idxPath, 'utf-8'));
  const index = MiniSearch.loadJSON(json, {
    fields: ['full_text'],
    storeFields: ['id', 'creator_url', 'creator_name', 'xhs_id', 'region', 'tags'],
    searchOptions: { boost: { full_text: 2 }, prefix: true, fuzzy: 0.2 }
  });
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : null;
  return { ok: true, index, meta };
}

function _fmtRate(x) {
  if (x === null || x === undefined || Number.isNaN(Number(x))) return '';
  return `${(Number(x) * 100).toFixed(2)}%`;
}

function _fmtInt(x) {
  if (x === null || x === undefined || Number.isNaN(Number(x))) return '';
  return String(Math.round(Number(x)));
}

function _safeParseJson(s) {
  try {
    return JSON.parse(String(s || '{}'));
  } catch (_) {
    return {};
  }
}

/**
 * 从 SQLite（sql.js）构建“达人档案”文档集合（每个达人一条，取最新 run 快照）。
 */
function buildDocsFromDb({ db, limitCreators = 5000 }) {
  if (!db) throw new Error('db is required');

  // 取每个 creator_url 最新的一条 creators 记录
  const creators = dbAll(
    db,
    `
    SELECT c.*
    FROM creators c
    JOIN runs r ON c.run_id = r.run_id
    WHERE r.created_at = (
      SELECT MAX(r2.created_at)
      FROM creators c2
      JOIN runs r2 ON c2.run_id = r2.run_id
      WHERE c2.creator_url = c.creator_url
    )
    LIMIT ?
    `,
    [Math.max(1, Math.min(20000, Number(limitCreators) || 5000))]
  );

  const docs = [];
  for (const c of creators) {
    const id = String(c.xhs_id || c.creator_url || '').trim();
    if (!id) continue;

    const notes = dbAll(
      db,
      `SELECT idx, title FROM notes WHERE run_id = ? AND creator_url = ? ORDER BY idx ASC LIMIT 10`,
      [c.run_id, c.creator_url]
    );
    const noteTitles = notes.map((n) => String(n.title || '').trim()).filter(Boolean);

    const metrics = _safeParseJson(c.metrics_json);
    const metricsText = [
      c.followers != null ? `粉丝数:${_fmtInt(c.followers)}` : '',
      c.likes_fav != null ? `获赞与收藏:${_fmtInt(c.likes_fav)}` : '',
      c.price_image != null ? `图文报价:${_fmtInt(c.price_image)}` : '',
      c.price_video != null ? `视频报价:${_fmtInt(c.price_video)}` : '',
      c.interact_rate != null ? `互动率:${_fmtRate(c.interact_rate)}` : '',
      c.fans_change_rate != null ? `粉丝变化:${_fmtRate(c.fans_change_rate)}` : ''
    ]
      .filter(Boolean)
      .join(' ');

    // 适当加一些原始 metrics key（只取少量，避免冗长）
    const extraKeys = ['标签', '类目', '内容类型', '人设'];
    const extras = extraKeys
      .map((k) => (metrics && metrics[k] ? `${k}:${String(metrics[k]).trim()}` : ''))
      .filter(Boolean)
      .join(' ');

    const full_text = [
      String(c.creator_name || '').trim(),
      String(c.xhs_id || '').trim(),
      String(c.region || '').trim(),
      String(c.tags || '').trim(),
      metricsText,
      extras,
      noteTitles.length ? `笔记标题:${noteTitles.join('；')}` : ''
    ]
      .filter(Boolean)
      .join(' ');

    docs.push({
      id,
      creator_url: String(c.creator_url || '').trim(),
      creator_name: String(c.creator_name || '').trim(),
      xhs_id: String(c.xhs_id || '').trim(),
      region: String(c.region || '').trim(),
      tags: String(c.tags || '').trim(),
      full_text
    });
  }

  return { ok: true, docs, creatorCount: docs.length };
}

function rebuildKbFromDb({ userDataDir, db }) {
  const { docs, creatorCount } = buildDocsFromDb({ db });
  const { index, meta } = buildIndexFromDocs(docs);
  const fullMeta = { ...(meta || {}), creatorCount };
  saveIndexToDisk({ userDataDir, index, meta: fullMeta });
  return { ok: true, meta: fullMeta };
}

module.exports = {
  buildIndexFromDocs,
  searchIndex,
  saveIndexToDisk,
  loadIndexFromDisk,
  buildDocsFromDb,
  rebuildKbFromDb
};
