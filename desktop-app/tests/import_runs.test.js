const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { openDb, initDb, dbGet } = require('../lib/db/sqlite');
const { syncRunsToDb } = require('../lib/db/import_runs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ca-runs-'));
const runDir = path.join(tmp, 'run_2026-04-18T00-00-00-000Z');
fs.mkdirSync(runDir, { recursive: true });

fs.writeFileSync(
  path.join(runDir, 'raw_result.json'),
  JSON.stringify(
    {
      platform: 'pgy',
      creator_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/abc',
      creator_summary: { creator_name: '老王', xhs_id: 'xhs_001', creator_url: 'https://pgy.../abc' },
      metrics: { '粉丝数': '4.2w', '图文笔记一口价': '¥3,000', '互动率': '3.1%' },
      notes_top10: [{ '标题': 'test', '阅读': '1,200', '点赞': '30', '收藏': '5', '发布时间': '2026-04-17', '含推广': 'true' }],
      crawl_time: '2026-04-18T00:00:00.000Z'
    },
    null,
    2
  ),
  'utf-8'
);

(async () => {
  const db = await openDb(':memory:');
  initDb(db);

  const r = syncRunsToDb({ db, runsDir: tmp });
  assert.ok(r.ok);
  assert.strictEqual(r.runsScanned, 1);

  const creator = dbGet(db, 'select creator_name, xhs_id, followers, price_image, interact_rate from creators');
  assert.strictEqual(creator.creator_name, '老王');
  assert.strictEqual(creator.xhs_id, 'xhs_001');
  assert.strictEqual(creator.followers, 42000);
  assert.strictEqual(creator.price_image, 3000);
  assert.ok(Math.abs(creator.interact_rate - 0.031) < 1e-9);

  const note = dbGet(db, 'select title, read_cnt, like_cnt, collect_cnt, publish_date, is_promo from notes');
  assert.strictEqual(note.title, 'test');
  assert.strictEqual(note.read_cnt, 1200);
  assert.strictEqual(note.is_promo, 1);

  console.log('import_runs.test.js OK');
})();
