function toNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s === '--' || s === '-') return null;
  if (/暂未入驻|暂无|无数据|N\/A/i.test(s)) return null;
  return s;
}

function _stripCommas(s) {
  return String(s).replace(/,/g, '').trim();
}

function parseCount(v) {
  const s0 = toNull(v);
  if (s0 == null) return null;
  const s = _stripCommas(s0);
  // 支持：4.2w / 4.2万 / 42000
  const mWan = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:w|万)$/i);
  if (mWan) return Math.round(parseFloat(mWan[1]) * 10000);
  const mNum = s.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (mNum) return Math.round(parseFloat(mNum[1]));
  return null;
}

function parsePercent(v) {
  const s0 = toNull(v);
  if (s0 == null) return null;
  const s = _stripCommas(s0);
  const m = s.match(/^(-?[0-9]+(?:\.[0-9]+)?)\s*%$/);
  if (m) return parseFloat(m[1]) / 100;
  // 兼容直接给 0.031 这种
  const m2 = s.match(/^(-?[0-9]+(?:\.[0-9]+)?)$/);
  if (m2) {
    const x = parseFloat(m2[1]);
    // 若用户给的是 3.1（想表达 3.1%），保持谨慎：这里只在 0~1 范围认为是比例
    if (x >= 0 && x <= 1) return x;
  }
  return null;
}

function parseMoney(v) {
  const s0 = toNull(v);
  if (s0 == null) return null;
  const s = _stripCommas(s0)
    .replace(/[¥￥]/g, '')
    .replace(/\s/g, '');
  // 可能出现 “3,000” / “3000” / “3k”(暂不支持)
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (m) return Math.round(parseFloat(m[1]));
  return null;
}

module.exports = {
  toNull,
  parseCount,
  parsePercent,
  parseMoney
};

