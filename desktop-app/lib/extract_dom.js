const { applyTransform } = require('./transform');

function _isNonEmptyConstant(v) {
  return v !== undefined && v !== null && String(v) !== '';
}

function _normalizeSelector(sel) {
  if (sel === undefined || sel === null) return null;
  const s = String(sel).trim();
  return s ? s : null;
}

function _buildExtractOneJs({ selector, attr }) {
  const sel = _normalizeSelector(selector);
  const a = attr == null ? '' : String(attr).trim();
  if (!sel) return `null`;
  return `
    (function(){
      let el = null;
      try { el = document.querySelector(${JSON.stringify(sel)}); } catch (_) {}
      if (!el) return null;
      const attr = ${JSON.stringify(a)};
      if (attr) {
        if (attr === 'value') {
          try { return (el.value !== undefined) ? el.value : el.getAttribute('value'); } catch (_) { return null; }
        }
        try { return el.getAttribute(attr); } catch (_) { return null; }
      }
      // 默认：文本；input/textarea 优先 value
      try {
        if (el && el.value !== undefined && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
          return el.value;
        }
      } catch (_) {}
      try { return (el.innerText || el.textContent || '').trim(); } catch (_) { return null; }
    })()
  `;
}

async function extractField(webContents, field, ctx = {}) {
  const f = field || {};
  if (_isNonEmptyConstant(f.value)) return applyTransform(f.value, f.transform, ctx);

  const sel = _normalizeSelector(f.selector);
  if (!sel) {
    // 常见约定：当 selector 为空但需要 url 时，取当前页面 URL
    if ((f.transform || '').trim() === 'url' && ctx.baseUrl) return applyTransform(ctx.baseUrl, 'url', ctx);
    return null;
  }

  const js = _buildExtractOneJs({ selector: sel, attr: f.attr });
  let raw = null;
  try {
    raw = await webContents.executeJavaScript(js, true);
  } catch (_) {
    raw = null;
  }
  return applyTransform(raw, f.transform, ctx);
}

async function extractObject(webContents, fields, ctx = {}) {
  const arr = Array.isArray(fields) ? fields : [];
  const out = {};
  for (const f of arr) {
    const name = (f?.name || '').trim();
    if (!name) continue;
    out[name] = await extractField(webContents, f, ctx);
  }
  return out;
}

function _getCardSelector(template) {
  const t = template || {};
  const cands = [
    t.noteCardSelector,
    t.note_card_selector,
    t.noteDetailCardSelector,
    t.note_detail_card_selector
  ];
  for (const c of cands) {
    const s = _normalizeSelector(c);
    if (s) return s;
  }
  return null;
}

async function extractCardList(webContents, cardSelector, fields, ctx = {}) {
  const sel = _normalizeSelector(cardSelector);
  if (!sel) return [];

  const maxCards = Number(ctx.maxCards || 0) > 0 ? Number(ctx.maxCards) : 200;
  const fieldDefs = (Array.isArray(fields) ? fields : [])
    .map((f) => ({
      name: (f?.name || '').trim(),
      selector: _normalizeSelector(f?.selector),
      attr: f?.attr == null ? '' : String(f.attr).trim(),
      value: _isNonEmptyConstant(f?.value) ? f.value : null,
      transform: (f?.transform || '').trim()
    }))
    .filter((f) => f.name);

  const js = `
    (function(){
      const cssEscape = (v) => {
        try { return CSS.escape(v); } catch (_) { return String(v).replace(/[^a-zA-Z0-9_-]/g, ''); }
      };
      const nthPath = (el, maxDepth = 3) => {
        if (!el || el.nodeType !== 1) return null;
        // id 优先
        if (el.id) return '#' + cssEscape(el.id);
        const parts = [];
        let cur = el;
        for (let depth = 0; depth < maxDepth && cur; depth++) {
          const tag = (cur.tagName || '').toLowerCase();
          if (!tag) break;
          let i = 1;
          let sib = cur;
          while ((sib = sib.previousElementSibling)) {
            if ((sib.tagName || '').toLowerCase() === tag) i++;
          }
          parts.unshift(tag + ':nth-of-type(' + i + ')');
          // 到 body/html 就停止
          if (tag === 'body' || tag === 'html') break;
          cur = cur.parentElement;
        }
        return parts.join(' > ');
      };

      const cards = Array.from(document.querySelectorAll(${JSON.stringify(sel)})).slice(0, ${maxCards});
      const defs = ${JSON.stringify(fieldDefs)};
      const pick = (root, d) => {
        if (d.value !== null && d.value !== undefined && String(d.value) !== '') return d.value;
        if (!d.selector) return null;
        let el = null;
        try { el = root.querySelector(d.selector); } catch (_) {}
        if (!el) return null;
        if (d.attr) {
          if (d.attr === 'value') {
            try { return (el.value !== undefined) ? el.value : el.getAttribute('value'); } catch (_) { return null; }
          }
          try { return el.getAttribute(d.attr); } catch (_) { return null; }
        }
        try {
          if (el && el.value !== undefined && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
            return el.value;
          }
        } catch (_) {}
        try { return (el.innerText || el.textContent || '').trim(); } catch (_) { return null; }
      };
      return cards.map((card, idx) => {
        const o = {};
        defs.forEach((d) => { o[d.name] = pick(card, d); });
        // 为后续“点击获取链接/详情页 URL”预留（不写入 Excel，仅内部使用）
        o.__cardSelector = nthPath(card, 3) || null;
        // 更稳的方式：记录 index，后续可用 noteCardSelector + index 精确点击
        o.__cardIndex = idx;
        return o;
      });
    })()
  `;

  let rawList = [];
  try {
    rawList = await webContents.executeJavaScript(js, true);
  } catch (_) {
    rawList = [];
  }
  if (!Array.isArray(rawList)) rawList = [];

  // Node 侧做 transform（避免在页面里引入复杂逻辑）
  return rawList.map((row) => {
    const out = {};
    for (const f of fieldDefs) {
      out[f.name] = applyTransform(row?.[f.name], f.transform, ctx);
    }
    // 保留内部字段（用于后续补全 note_url / 调试，不写入 Excel 时可忽略）
    if (row && typeof row === 'object') {
      if (row.__cardIndex !== undefined) out.__cardIndex = row.__cardIndex;
      if (row.__cardSelector) out.__cardSelector = row.__cardSelector;
    }
    return out;
  });
}

async function extractFromTemplate(webContents, template, ctx = {}) {
  const baseUrl = ctx.baseUrl || webContents?.getURL?.() || '';
  const t = template || {};

  const creator_summary = await extractObject(webContents, t.creator_summary, { ...ctx, baseUrl });
  const cardSelector = _getCardSelector(t);
  const notes = await extractCardList(webContents, cardSelector, t.note_detail, { ...ctx, baseUrl });

  return {
    creator_summary,
    notes,
    _meta: {
      baseUrl,
      noteCardSelector: cardSelector
    }
  };
}

module.exports = {
  extractField,
  extractObject,
  extractCardList,
  extractFromTemplate
};
