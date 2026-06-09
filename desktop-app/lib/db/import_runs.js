const fs = require('fs');
const path = require('path');

const { parseCount, parseMoney, parsePercent, toNull } = require('./normalize');
const { dbRun, withTransaction, saveDbToFile } = require('./sqlite');

function findRawResultFiles(runDir) {
  const out = [];
  const direct = path.join(runDir, 'raw_result.json');
  if (fs.existsSync(direct)) out.push(direct);
  let children = [];
  try {
    children = fs.readdirSync(runDir);
  } catch (_) {
    children = [];
  }
  for (const c of children) {
    const p = path.join(runDir, c);
    let st = null;
    try {
      st = fs.statSync(p);
    } catch (_) {
      st = null;
    }
    if (!st || !st.isDirectory()) continue;
    const fp = path.join(p, 'raw_result.json');
    if (fs.existsSync(fp)) out.push(fp);
  }
  return out;
}

function _safeJsonStringify(v) {
  try {
    return JSON.stringify(v ?? {}, null, 0);
  } catch (_) {
    return '{}';
  }
}

function syncRunsToDb({ db, runsDir, dbPath }) {
  if (!db) throw new Error('db is required');
  const base = String(runsDir || '').trim();
  if (!base) return { ok: false, error: 'runsDir 为空' };

  let dirs = [];
  try {
    dirs = fs
      .readdirSync(base)
      .filter((n) => n.startsWith('run_'))
      .map((name) => ({ name, dir: path.join(base, name) }))
      .filter((x) => {
        try {
          return fs.statSync(x.dir).isDirectory();
        } catch (_) {
          return false;
        }
      });
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }

  const tx = () => {
    let runsScanned = 0;
    let creatorsUpserted = 0;
    let notesUpserted = 0;
    let rawFiles = 0;

    for (const it of dirs) {
      runsScanned += 1;
      const run_id = it.name;
      const run_dir = it.dir;

      const files = findRawResultFiles(run_dir);
      rawFiles += files.length;

      for (const fp of files) {
        let obj = null;
        try {
          obj = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        } catch (_) {
          obj = null;
        }
        if (!obj) continue;

        const platform = String(obj.platform || 'pgy');
        const created_at = String(obj.crawl_time || new Date().toISOString());
        dbRun(
          db,
          `
          INSERT INTO runs (run_id, run_dir, created_at, platform, source)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(run_id) DO UPDATE SET
            run_dir=excluded.run_dir,
            created_at=excluded.created_at,
            platform=excluded.platform
          `,
          [run_id, run_dir, created_at, platform, '']
        );

        const sum = obj.creator_summary || {};
        const metrics = obj.metrics || {};

        const creator_url = String(sum.creator_url || obj.creator_url || '').trim();
        const creator_name = String(sum.creator_name || sum.name || '').trim();
        const xhs_id = String(sum.xhs_id || sum.xhsId || '').trim();
        const tags = String(sum.tags || '').trim();
        const region = String(sum.location || sum.region || '').trim();
        const updated_at_text = String(metrics['数据更新至'] || '').trim();

        const followers = parseCount(metrics['粉丝数'] ?? metrics['粉丝'] ?? metrics['粉丝量']);
        const likes_fav = parseCount(metrics['获赞与收藏'] ?? metrics['获赞收藏'] ?? metrics['获赞']);
        const price_image = parseMoney(metrics['图文笔记一口价'] ?? metrics['图文报价']);
        const price_video = parseMoney(metrics['视频笔记一口价'] ?? metrics['视频报价']);

        const exposure_median = parseCount(metrics['曝光中位数']);
        const read_median = parseCount(metrics['阅读中位数']);
        const interact_median = parseCount(metrics['互动中位数']);
        const interact_rate = parsePercent(metrics['互动率']);
        const fans_change_rate = parsePercent(metrics['粉丝量变化幅度']);

        if (creator_url) {
          dbRun(
            db,
            `
            INSERT INTO creators (
              run_id, creator_url, creator_name, xhs_id, tags, region, updated_at_text,
              followers, likes_fav, price_image, price_video,
              exposure_median, read_median, interact_median, interact_rate, fans_change_rate,
              metrics_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(run_id, creator_url) DO UPDATE SET
              creator_name=excluded.creator_name,
              xhs_id=excluded.xhs_id,
              tags=excluded.tags,
              region=excluded.region,
              updated_at_text=excluded.updated_at_text,
              followers=excluded.followers,
              likes_fav=excluded.likes_fav,
              price_image=excluded.price_image,
              price_video=excluded.price_video,
              exposure_median=excluded.exposure_median,
              read_median=excluded.read_median,
              interact_median=excluded.interact_median,
              interact_rate=excluded.interact_rate,
              fans_change_rate=excluded.fans_change_rate,
              metrics_json=excluded.metrics_json
            `,
            [
              run_id,
              creator_url,
              creator_name,
              xhs_id,
              tags,
              region && region !== '--' ? region : '',
              updated_at_text,
              followers,
              likes_fav,
              price_image,
              price_video,
              exposure_median,
              read_median,
              interact_median,
              interact_rate,
              fans_change_rate,
              _safeJsonStringify(metrics)
            ]
          );
          creatorsUpserted += 1;
        }

        const notesTop = Array.isArray(obj.notes_top10) ? obj.notes_top10 : [];
        for (let i = 0; i < Math.min(10, notesTop.length); i++) {
          const n = notesTop[i] || {};
          const title = String(n['标题'] || n.title || '').trim();
          const read_cnt = parseCount(n['阅读'] || n.read);
          const like_cnt = parseCount(n['点赞'] || n.like);
          const collect_cnt = parseCount(n['收藏'] || n.collect);
          const publish_date = toNull(n['发布时间'] || n.date) || null;
          const is_promo = String(n['含推广'] || n.promo || '').trim().toLowerCase() === 'true' ? 1 : 0;

          if (creator_url) {
            dbRun(
              db,
              `
              INSERT INTO notes (
                run_id, creator_url, creator_name, idx, title,
                read_cnt, like_cnt, collect_cnt, publish_date, is_promo
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(run_id, creator_url, idx) DO UPDATE SET
                title=excluded.title,
                read_cnt=excluded.read_cnt,
                like_cnt=excluded.like_cnt,
                collect_cnt=excluded.collect_cnt,
                publish_date=excluded.publish_date,
                is_promo=excluded.is_promo
              `,
              [
                run_id,
                creator_url,
                creator_name,
                i + 1,
                title,
                read_cnt,
                like_cnt,
                collect_cnt,
                publish_date,
                is_promo
              ]
            );
            notesUpserted += 1;
          }
        }
      }
    }

    return { ok: true, runsScanned, rawFiles, creatorsUpserted, notesUpserted };
  };

  try {
    const stats = withTransaction(db, tx);
    // persist
    if (dbPath) saveDbToFile(db, dbPath);
    return stats;
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

module.exports = { syncRunsToDb };
