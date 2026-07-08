export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value == null ? '' : String(value);
    else if (key === 'html') node.innerHTML = value == null ? '' : String(value);
    else if (key === 'style' && value && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : String(value));
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child == null) return;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

export function createPageIntro({ title, description }) {
  return el('div', { class: 'page-intro' }, [
    el('h2', { text: title }),
    description ? el('p', { text: description }) : null
  ]);
}

export function createNotice({ html, text, tone = 'info' }) {
  return el('div', { class: `soft-notice ${tone}`.trim(), html: html || text || '' });
}

export function createActionRow(children = [], className = '') {
  return el('div', { class: `tool-strip ${className}`.trim() }, children);
}

export function createButton(label, onClick, { primary = false, ghost = false, disabled = false, className = '' } = {}) {
  const classes = ['btn'];
  if (primary) classes.push('primary');
  if (ghost) classes.push('ghost');
  if (className) classes.push(className);
  return el('button', {
    class: classes.join(' '),
    disabled,
    onclick: onClick
  }, [label]);
}

export function createAdvancedSection({ title, open = false, onToggle, children = [] }) {
  const details = el('details', { class: 'advanced-section' }, [
    el('summary', { text: title }),
    ...children
  ]);
  details.open = Boolean(open);
  if (onToggle) details.addEventListener('toggle', () => onToggle(details.open));
  return details;
}

export function createMetricCard({ label, value, tone = '' }) {
  return el('div', { class: `export-metric ${tone}`.trim() }, [
    el('div', { class: 'export-metric-label', text: label }),
    el('div', { class: 'export-metric-value', text: value })
  ]);
}

export function createStatusPill(label, tone = 'neutral') {
  return el('span', { class: `status-pill ${tone}`.trim(), text: label });
}

export function createPanelHeader({ title, description = '', action = null }) {
  return el('div', { class: 'panel-header' }, [
    el('div', { class: 'panel-header-copy' }, [
      el('div', { class: 'panel-header-title', text: title }),
      description ? el('div', { class: 'panel-header-desc', text: description }) : null
    ]),
    action
  ]);
}

export function createSummaryCard({ title, description, meta = '', tone = '', actions = [] }) {
  return el('div', { class: `summary-card ${tone}`.trim() }, [
    el('div', { class: 'summary-card-copy' }, [
      el('div', { class: 'summary-card-title', text: title }),
      description ? el('div', { class: 'summary-card-desc', text: description }) : null,
      meta ? el('div', { class: 'summary-card-meta', text: meta }) : null
    ]),
    actions.length ? el('div', { class: 'summary-card-actions' }, actions) : null
  ]);
}

export function createStepCard({ index, title, description, meta = '', active = false, done = false }) {
  const tone = done ? 'done' : active ? 'active' : '';
  return el('div', { class: `step-card ${tone}`.trim() }, [
    el('div', { class: 'step-index', text: index }),
    el('div', { class: 'step-card-body' }, [
      el('div', { class: 'step-card-title', text: title }),
      el('div', { class: 'step-card-desc', text: description }),
      meta ? el('div', { class: 'step-card-meta', text: meta }) : null
    ])
  ]);
}

export function createEmptyState(text) {
  return el('div', { class: 'empty-state', text });
}
