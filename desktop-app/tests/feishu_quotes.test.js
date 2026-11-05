const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePlatformQuote, quoteFieldValue } = require('../lib/feishu_quotes');
const { formFields, validateValues } = require('../lib/feishu_workbench');
test('exact currency quotes retain cents and zero; missing values are null rather than zero', () => {
  for (const [value, expected] of [['¥4,800', 4800], ['￥9,800', 9800], ['4,800.50元', 4800.5],
    [' 4800 ', 4800], ['0', 0], [0, 0], ['', null], ['--', null], ['暂无报价', 0], [null, null]]) {
    assert.equal(parsePlatformQuote(value), expected);
  }
});

test('explicit unquoted image and video prices map to zero through create and supplementation', () => {
  const fields = formFields([
    { field_key: 'name', field_name: '账号昵称', field_type_key: 'text', is_required: 1 },
    { field_key: 'image', field_name: '图文平台价', field_type_key: 'number' },
    { field_key: 'video', field_name: '视频平台价', field_type_key: 'text' }
  ], 'creator');
  for (const status of ['暂未报价', '暂无报价', '未报价', ' 暂未报价 ']) {
    assert.equal(parsePlatformQuote(status), 0);
    for (const create of [true, false]) {
      assert.deepEqual(validateValues(fields, { name: 'Fixture', image: status, video: status }, { create }).pairs,
        [{ field_key: 'image', field_value: 0 }, { field_key: 'video', field_value: '0' }]);
    }
  }
});
test('ranges, lower bounds, unconfirmed units, exponent and malformed numbers require manual review', () => {
  for (const value of ['800起', '4800-9800', '1.2w', '1.2万', 'USD4800', '-1', '1e5', '4,80',
    '4800\n', '1.001', '100000001', Infinity, NaN, {}, []]) {
    assert.throws(() => parsePlatformQuote(value), { code: 'FEISHU_QUOTE_INVALID' });
  }
});

test('observed paused-order quote is unavailable, omitted on create and never clears an existing quote', () => {
  assert.equal(parsePlatformQuote('暂停接单'), null);
  const fields = formFields([
    { field_key: 'name', field_name: '账号昵称', field_type_key: 'text', is_required: 1 },
    { field_key: 'image', field_name: '图文平台价', field_type_key: 'number' },
    { field_key: 'video', field_name: '视频平台价', field_type_key: 'number' }
  ], 'creator');
  assert.deepEqual(validateValues(fields, { name: 'Fixture', image: '暂停接单', video: '¥8,500' }, { create: true }).pairs,
    [{ field_key: 'video', field_value: 8500 }]);
  assert.throws(() => validateValues(fields, { image: '暂停接单' }, { create: false }), { code: 'FEISHU_CLEAR_UNSUPPORTED' });
  assert.equal(parsePlatformQuote('0'), 0);
  for (const value of ['暂停接单 ¥8,500', '报价待确认']) {
    assert.throws(() => parsePlatformQuote(value), { code: 'FEISHU_QUOTE_INVALID' });
  }
});
test('only platform quote fields are mapped with metadata types; costs and unrelated numeric fields remain blocked', () => {
  const fields = formFields([
    { field_key: 'name', field_name: '账号昵称', field_type_key: 'text', is_required: 1 },
    { field_key: 'image', field_name: '图文平台价', field_type_key: 'number' },
    { field_key: 'video', field_name: '视频平台价', field_type_key: 'text' },
    { field_key: 'cost', field_name: '非报备图文成本', field_type_key: 'number' }
  ], 'creator');
  assert.equal(fields.some(f => f.key === 'cost'), false);
  assert.deepEqual(validateValues(fields, { name: 'Fixture', image: '¥4,800', video: '￥9,800' }, { create: true }).pairs,
    [{ field_key: 'image', field_value: 4800 }, { field_key: 'video', field_value: '9800' }]);
  assert.equal(validateValues(fields, { name: 'Fixture', image: '--', video: '' }, { create: true }).pairs.length, 0);
  assert.throws(() => quoteFieldValue({ name: '图文平台价', type: 'computed' }, '4800'),
    { code: 'FEISHU_QUOTE_SCHEMA_UNSUPPORTED' });
  assert.throws(() => quoteFieldValue({ name: '非报备图文成本', type: 'number' }, '4800'),
    { code: 'FEISHU_QUOTE_SCHEMA_UNSUPPORTED' });
});
