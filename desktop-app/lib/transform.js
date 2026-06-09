function toText(v) {
  if (v === undefined || v === null) return null;
  let s = String(v)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // 去掉用户复制时可能带的包裹符号：`...` 或 "..."/'...'
  // 允许末尾有空白/不可见字符：反复剥离一层
  for (let i = 0; i < 2; i++) {
    const t = s.trim();
    if ((t.startsWith('`') && t.endsWith('`')) || (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      s = t.slice(1, -1).trim();
    } else {
      s = t;
      break;
    }
  }
  return s;
}

function toNumber(v) {
  if (v === undefined || v === null) return null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/,/g, '').replace(/\s+/g, '').toLowerCase();

  // 兼容：1.2万 / 3w / 1.5k
  const m = s.match(/^(-?\d+(?:\.\d+)?)(万|w|k)?$/i);
  if (m) {
    const n = parseFloat(m[1]);
    const unit = (m[2] || '').toLowerCase();
    if (Number.isNaN(n)) return null;
    if (unit === '万' || unit === 'w') return Math.round(n * 10000);
    if (unit === 'k') return Math.round(n * 1000);
    return Math.round(n);
  }

  // 兜底：提取第一个数字
  const m2 = s.match(/-?\d+(?:\.\d+)?/);
  if (!m2) return null;
  const n2 = parseFloat(m2[0]);
  if (Number.isNaN(n2)) return null;
  return Math.round(n2);
}

function toUrl(v, baseUrl) {
  if (v === undefined || v === null) return null;
  let s = String(v).trim();
  if (!s) return null;
  for (let i = 0; i < 2; i++) {
    const t = s.trim();
    if ((t.startsWith('`') && t.endsWith('`')) || (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      s = t.slice(1, -1).trim();
    } else {
      s = t;
      break;
    }
  }
  if (/^(javascript:|#)/i.test(s)) return null;
  try {
    // 已是绝对 url
    if (/^https?:\/\//i.test(s)) return s;
    if (!baseUrl) return s;
    return new URL(s, baseUrl).toString();
  } catch (_) {
    return s;
  }
}

function applyTransform(value, transform, ctx = {}) {
  const t = (transform || '').trim();
  if (!t) return value;
  if (t === 'raw') return value;
  if (t === 'text') return toText(value);
  if (t === 'number' || t === 'int') return toNumber(value);
  if (t === 'url') return toUrl(value, ctx.baseUrl);
  return value;
}

module.exports = {
  toText,
  toNumber,
  toUrl,
  applyTransform
};
