const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

const { parseContactReviewWorkbook, parseSelected } = require('../lib/contact_review_excel');

assert.strictEqual(parseSelected('否'), false);
assert.strictEqual(parseSelected('排除'), false);
assert.strictEqual(parseSelected('是'), true);
assert.strictEqual(parseSelected(''), true);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'contact-review-excel-'));
const filePath = path.join(tmp, '建联表回导.xlsx');
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet([
  {
    '选择建联': '否',
    '跟进状态': '已拒绝',
    '优先级': 'P1',
    '排除原因': '报价高',
    '达人昵称': '达人A',
    '蒲公英链接': 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a',
    '邮箱': 'a@example.com',
    '微信号': 'wx_a',
    '手机号': '13800000000',
    '建联渠道': '邮件',
    '备注': '下次再看'
  }
]);
XLSX.utils.book_append_sheet(wb, ws, '建联表');
XLSX.writeFile(wb, filePath);

const parsed = parseContactReviewWorkbook(filePath);
assert.ok(parsed.ok);
assert.strictEqual(parsed.sheetName, '建联表');
assert.deepStrictEqual(parsed.sheetNames, ['建联表']);
assert.strictEqual(parsed.rows.length, 1);
assert.strictEqual(parsed.rows[0].creatorUrl, 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a');
assert.strictEqual(parsed.rows[0].creatorName, '达人A');
assert.strictEqual(parsed.rows[0].selected, false);
assert.strictEqual(parsed.rows[0].followupStatus, '已拒绝');
assert.strictEqual(parsed.rows[0].priority, 'P1');
assert.strictEqual(parsed.rows[0].excludeReason, '报价高');
assert.strictEqual(parsed.rows[0].email, 'a@example.com');
assert.strictEqual(parsed.rows[0].wechatId, 'wx_a');
assert.strictEqual(parsed.rows[0].phone, '13800000000');
assert.strictEqual(parsed.rows[0].contactChannel, '邮件建联');
assert.strictEqual(parsed.rows[0].note, '下次再看');

const pendingFilePath = path.join(tmp, '建联表待补回导.xlsx');
const pendingWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(pendingWb, XLSX.utils.json_to_sheet([
  {
    '选择建联': '是',
    '跟进状态': '待建联',
    '优先级': 'P2',
    '达人昵称': '达人B',
    '蒲公英链接': 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/b',
    '建联渠道': '微信建联',
    '备注': '先补联系方式'
  }
]), '建联表');
XLSX.utils.book_append_sheet(pendingWb, XLSX.utils.json_to_sheet([
  {
    '达人昵称': '达人B',
    '蒲公英链接': 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/b',
    '邮箱': 'b@example.com',
    '微信号': 'wx_b',
    '手机号': '13900000000',
    '跟进状态': '已建联',
    '备注': '已补微信'
  }
]), '待补联系方式');
XLSX.writeFile(pendingWb, pendingFilePath);

const pendingParsed = parseContactReviewWorkbook(pendingFilePath);
assert.ok(pendingParsed.ok);
assert.deepStrictEqual(pendingParsed.sheetNames, ['建联表', '待补联系方式']);
assert.strictEqual(pendingParsed.stats.scannedRows, 2);
assert.strictEqual(pendingParsed.stats.matchedRows, 1);
assert.strictEqual(pendingParsed.rows.length, 1);
assert.strictEqual(pendingParsed.rows[0].creatorName, '达人B');
assert.strictEqual(pendingParsed.rows[0].selected, true);
assert.strictEqual(pendingParsed.rows[0].followupStatus, '待建联');
assert.strictEqual(pendingParsed.rows[0].priority, 'P2');
assert.strictEqual(pendingParsed.rows[0].email, 'b@example.com');
assert.strictEqual(pendingParsed.rows[0].wechatId, 'wx_b');
assert.strictEqual(pendingParsed.rows[0].phone, '13900000000');
assert.strictEqual(pendingParsed.rows[0].note, '已补微信');

const excludedPendingFilePath = path.join(tmp, '建联表待补不覆盖决策.xlsx');
const excludedPendingWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(excludedPendingWb, XLSX.utils.json_to_sheet([
  {
    '选择建联': '否',
    '跟进状态': '不建联',
    '优先级': 'P3',
    '排除原因': '不匹配',
    '达人昵称': '达人C',
    '蒲公英链接': 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/c',
    '备注': '主表决策'
  }
]), '建联表');
XLSX.utils.book_append_sheet(excludedPendingWb, XLSX.utils.json_to_sheet([
  {
    '达人昵称': '达人C',
    '蒲公英链接': 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/c',
    '微信号': 'wx_c',
    '跟进状态': '已建联',
    '优先级': 'P1',
    '备注': '只补联系方式'
  }
]), '待补联系方式');
XLSX.writeFile(excludedPendingWb, excludedPendingFilePath);

const excludedPendingParsed = parseContactReviewWorkbook(excludedPendingFilePath);
assert.strictEqual(excludedPendingParsed.rows.length, 1);
assert.strictEqual(excludedPendingParsed.rows[0].selected, false);
assert.strictEqual(excludedPendingParsed.rows[0].followupStatus, '不建联');
assert.strictEqual(excludedPendingParsed.rows[0].priority, 'P3');
assert.strictEqual(excludedPendingParsed.rows[0].excludeReason, '不匹配');
assert.strictEqual(excludedPendingParsed.rows[0].wechatId, 'wx_c');
assert.strictEqual(excludedPendingParsed.rows[0].note, '只补联系方式');

console.log('contact_review_excel.test.js OK');
