const assert = require('assert');

// RED: 未实现前应报错/失败
const { buildIndexFromDocs, searchIndex } = require('../lib/kb/index');

const docs = [
  {
    id: 'xhs_001',
    creator_url: 'u1',
    creator_name: '小王',
    xhs_id: 'xhs_001',
    region: '上海',
    tags: '穿搭 通勤',
    full_text: '小王 上海 穿搭 通勤 高级感 极简风 笔记标题:通勤穿搭 高级感'
  },
  {
    id: 'xhs_002',
    creator_url: 'u2',
    creator_name: '小李',
    xhs_id: 'xhs_002',
    region: '广州',
    tags: '美妆 护肤',
    full_text: '小李 广州 美妆 护肤 平价好物 笔记标题:平价护肤'
  }
];

const { index } = buildIndexFromDocs(docs);
const hits = searchIndex(index, '通勤 高级感', 10);

assert.ok(hits.length >= 1, 'should return at least one hit');
assert.strictEqual(hits[0].id, 'xhs_001');

console.log('kb.test.js OK');
