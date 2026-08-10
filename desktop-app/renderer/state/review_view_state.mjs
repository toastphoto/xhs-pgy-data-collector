function text(value) {
  return String(value || '').trim();
}

function rowIdOf(element) {
  return text(element?.dataset?.reviewRowId);
}

export function buildReviewViewportKey({ runDir = '', filters = {} } = {}) {
  const normalized = {
    runDir: text(runDir),
    search: text(filters.search).toLowerCase(),
    status: text(filters.status) || 'all',
    contact: text(filters.contact) || 'all',
    priority: text(filters.priority) || 'all',
    followup: text(filters.followup) || 'all',
    channel: text(filters.channel) || 'all'
  };
  return JSON.stringify(normalized);
}

export function captureReviewViewport(container, { activeRowId = '' } = {}) {
  const scrollTop = Math.max(0, Number(container?.scrollTop) || 0);
  const cards = Array.from(container?.children || []).filter((item) => rowIdOf(item));
  const anchor = cards.find((item) => {
    const top = Number(item.offsetTop) || 0;
    const height = Math.max(0, Number(item.offsetHeight) || 0);
    return top + height > scrollTop;
  }) || cards[0] || null;

  return {
    scrollTop,
    anchorRowId: rowIdOf(anchor),
    anchorOffset: anchor ? (Number(anchor.offsetTop) || 0) - scrollTop : 0,
    activeRowId: text(activeRowId)
  };
}

export function restoreReviewViewport(container, state = {}) {
  if (!container) return 0;
  const cards = Array.from(container.children || []);
  const anchorRowId = text(state.anchorRowId);
  const anchor = anchorRowId
    ? cards.find((item) => rowIdOf(item) === anchorRowId)
    : null;
  const requested = anchor
    ? (Number(anchor.offsetTop) || 0) - (Number(state.anchorOffset) || 0)
    : Math.max(0, Number(state.scrollTop) || 0);
  const maxScroll = Math.max(0, (Number(container.scrollHeight) || 0) - (Number(container.clientHeight) || 0));
  const restored = Math.max(0, Math.min(requested, maxScroll));
  container.scrollTop = restored;
  return restored;
}

export function createReviewViewportStateRegistry({ limit = 24 } = {}) {
  const states = new Map();
  const maxEntries = Math.max(1, Number(limit) || 24);

  const touch = (key, value) => {
    states.delete(key);
    states.set(key, value);
    while (states.size > maxEntries) states.delete(states.keys().next().value);
  };

  return {
    get(key) {
      const normalizedKey = text(key);
      if (!normalizedKey || !states.has(normalizedKey)) return null;
      const value = states.get(normalizedKey);
      touch(normalizedKey, value);
      return { ...value };
    },
    capture(key, container, { activeRowId = '' } = {}) {
      const normalizedKey = text(key);
      if (!normalizedKey) return null;
      const previous = states.get(normalizedKey) || {};
      const value = captureReviewViewport(container, {
        activeRowId: text(activeRowId) || previous.activeRowId || ''
      });
      touch(normalizedKey, value);
      return { ...value };
    },
    setActiveRow(key, rowId, container = null) {
      const normalizedKey = text(key);
      if (!normalizedKey) return null;
      if (container) return this.capture(normalizedKey, container, { activeRowId: rowId });
      const previous = states.get(normalizedKey) || {
        scrollTop: 0,
        anchorRowId: '',
        anchorOffset: 0
      };
      const value = { ...previous, activeRowId: text(rowId) };
      touch(normalizedKey, value);
      return { ...value };
    }
  };
}
