const { ipcRenderer } = require('electron');

function safeText(s, max = 200) {
  if (!s) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) : t;
}

function isUniqueSelector(sel) {
  if (!sel) return false;
  try {
    return document.querySelectorAll(sel).length === 1;
  } catch (_) {
    return false;
  }
}

function nthOfType(el) {
  const tag = el.tagName.toLowerCase();
  let i = 1;
  let sib = el;
  while ((sib = sib.previousElementSibling)) {
    if (sib.tagName && sib.tagName.toLowerCase() === tag) i++;
  }
  return `${tag}:nth-of-type(${i})`;
}

function buildNthPath(el, maxDepth = 3) {
  const parts = [];
  let cur = el;
  for (let depth = 0; depth < maxDepth && cur && cur.nodeType === 1; depth++) {
    parts.unshift(nthOfType(cur));
    const cand = parts.join(' > ');
    if (isUniqueSelector(cand)) return cand;
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}

function buildSelector(el) {
  if (!el || el.nodeType !== 1) return '';

  // 优先：id / data-testid / aria-label
  if (el.id) return `#${CSS.escape(el.id)}`;
  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
  const aria = el.getAttribute('aria-label');
  if (aria) return `[aria-label="${CSS.escape(aria)}"]`;

  // 次优：tag + 1~2 个 class
  const tag = el.tagName.toLowerCase();
  const cls = (el.className && typeof el.className === 'string')
    ? el.className.split(/\s+/).filter(Boolean).slice(0, 2)
    : [];
  if (cls.length) {
    const cand = `${tag}.${cls.map((c) => CSS.escape(c)).join('.')}`;
    if (isUniqueSelector(cand)) return cand;
    // v1：tag+class 不唯一时，最多 3 层 nth-of-type 路径兜底
    return buildNthPath(el, 3);
  }

  if (isUniqueSelector(tag)) return tag;
  return buildNthPath(el, 3) || tag;
}

window.addEventListener('DOMContentLoaded', () => {
  // 点击录制
  document.addEventListener('click', (e) => {
    const el = e.target;
    const selector = buildSelector(el);
    if (!selector) return;
    ipcRenderer.send('recording:action', {
      type: 'click',
      selector,
      text: safeText(el?.innerText)
    });
  }, true);

  // 输入录制（input/textarea/contenteditable）
  const recordInput = (e) => {
    const el = e.target;
    if (!el) return;
    const tag = (el.tagName || '').toLowerCase();
    const isText = tag === 'input' || tag === 'textarea' || el.isContentEditable;
    if (!isText) return;

    const selector = buildSelector(el);
    if (!selector) return;

    const value = el.isContentEditable ? safeText(el.innerText, 500) : safeText(el.value, 500);
    ipcRenderer.send('recording:action', {
      type: 'input',
      selector,
      value
    });
  };

  document.addEventListener('change', recordInput, true);
  document.addEventListener('input', (e) => {
    // 降噪：只在输入停止 350ms 后记录一次
    clearTimeout(window.__recordInputTimer);
    window.__recordInputTimer = setTimeout(() => recordInput(e), 350);
  }, true);
});
