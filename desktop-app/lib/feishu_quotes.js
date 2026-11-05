const quoteNames = new Set(['图文平台价', '视频平台价']);
function fail() { throw Object.assign(new Error(), { code: 'FEISHU_QUOTE_INVALID' }); }

function parsePlatformQuote(value) {
  if (value === '' || value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > 100000000
      || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) fail();
    return value;
  }
  if (typeof value !== 'string' || value.length > 128 || /[\x00-\x1f]/.test(value)) fail();
  const text = value.trim();
  if (/^(?:暂未报价|暂无报价|未报价)$/.test(text)) return 0;
  if (!text || /^(?:--?|未开通|待填|暂停接单)$/.test(text)) return null;
  const match = /^(?:[¥￥]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)\s*(元)?$/.exec(text);
  if (!match) fail();
  const number = Number(match[1].replace(/,/g, ''));
  return parsePlatformQuote(number);
}

function quoteFieldValue(field, value) {
  if (!quoteNames.has(field.name) || !['number', 'text'].includes(field.type)) {
    throw Object.assign(new Error(), { code: 'FEISHU_QUOTE_SCHEMA_UNSUPPORTED' });
  }
  const quote = parsePlatformQuote(value);
  if (quote == null) return null;
  return field.type === 'number' ? quote : String(quote);
}

module.exports = { quoteNames, parsePlatformQuote, quoteFieldValue };
