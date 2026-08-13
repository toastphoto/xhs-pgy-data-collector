function cleanText(value, max = 180) {
  return String(value == null ? '' : value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function firstText(object, keys) {
  for (const key of keys) {
    const value = cleanText(object?.[key]);
    if (value) return value;
  }
  return '';
}

function normalizePgyCandidateRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = firstText(raw, ['userId', 'kolId', 'bloggerId', 'creatorId', 'authorId', 'accountId', 'user_id', 'kol_id', 'author_id', 'account_id', 'id']);
  const name = firstText(raw, ['name', 'kolName', 'bloggerName', 'creatorName', 'nickName', 'nickname', 'nick_name', 'userName']);
  const fans = firstText(raw, ['fansNum', 'fansCnt', 'fansCount', 'fans_count', 'followers', 'followerCount']);
  const read = firstText(raw, ['clickMidNum', 'readCnt', 'readMedian', 'readCount', 'read_count']);
  const interact = firstText(raw, ['mEngagementNum', 'interCnt', 'interactMedian', 'engagementCount', 'engagement_count']);
  const signal = [
    fans,
    read,
    interact,
    firstText(raw, ['headPhoto', 'picturePrice', 'videoPrice', 'contentTags', 'personalTags'])
  ].filter(Boolean).length;
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(id) || !name || signal < 1) return null;
  const note = [
    fans ? `粉丝 ${fans}` : '',
    read ? `阅读中位数 ${read}` : '',
    interact ? `互动中位数 ${interact}` : ''
  ].filter(Boolean).join(' / ');
  return {
    pgy_url: `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${encodeURIComponent(id)}`,
    creator_name: name,
    note,
    status: 'candidate',
    priority: '',
    excludeReason: ''
  };
}

function extractPgyCandidateSources(payload, options = {}) {
  const maxDepth = Math.max(1, Number(options.maxDepth || 7));
  const maxArrayLength = Math.max(20, Number(options.maxArrayLength || 2000));
  const sources = [];
  const seen = new Set();

  function visit(value, path = 'response', depth = 0, ancestors = []) {
    if (!value || typeof value !== 'object' || depth > maxDepth || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > maxArrayLength) return;
      const rows = [];
      const urls = new Set();
      for (const entry of value) {
        const row = normalizePgyCandidateRecord(entry);
        if (!row || urls.has(row.pgy_url)) continue;
        urls.add(row.pgy_url);
        rows.push(row);
      }
      if (rows.length) {
        const pathBonus = /list|data|source|items|records|kol|blogger|creator|result|table/i.test(path) ? 30 : 0;
        sources.push({
          path,
          rows,
          pageNumber: extractPageNumberNearCandidateSource(ancestors),
          score: rows.length * 24 + pathBonus
        });
      }
      for (let index = 0; index < Math.min(value.length, 80); index += 1) {
        visit(value[index], `${path}[${index}]`, depth + 1, [value, ...ancestors]);
      }
      return;
    }
    let keys = [];
    try { keys = Object.keys(value); } catch (_) {}
    for (const key of keys.slice(0, 180)) {
      visit(value[key], `${path}.${key}`, depth + 1, [value, ...ancestors]);
    }
  }

  visit(payload);
  return sources.sort((a, b) => b.score - a.score || b.rows.length - a.rows.length);
}

function normalizePageNumber(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 1000) return null;
  return number;
}

function extractDirectPageNumber(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  let entries = [];
  try { entries = Object.entries(value); } catch (_) { return null; }
  const preferredKeys = new Set([
    'pagenum',
    'pageno',
    'pagenumber',
    'currentpage',
    'page_num',
    'page_no',
    'page_number',
    'current_page'
  ]);
  for (const [key, entry] of entries) {
    if (!preferredKeys.has(String(key).toLowerCase())) continue;
    const pageNumber = normalizePageNumber(entry);
    if (pageNumber) return pageNumber;
  }
  const hasPaginationContext = entries.some(([key]) => (
    /^(pagesize|page_size|total|totalcount|total_count|hasnext|has_next)$/i.test(String(key))
  ));
  if (!hasPaginationContext) return null;
  const pageEntry = entries.find(([key]) => /^page$/i.test(String(key)));
  return normalizePageNumber(pageEntry?.[1]);
}

function extractPageNumberNearCandidateSource(ancestors = []) {
  const objectAncestors = ancestors.filter((value) => (
    value && typeof value === 'object' && !Array.isArray(value)
  )).slice(0, 3);
  for (const ancestor of objectAncestors) {
    const direct = extractDirectPageNumber(ancestor);
    if (direct) return direct;
    let entries = [];
    try { entries = Object.entries(ancestor); } catch (_) {}
    for (const [key, entry] of entries) {
      if (!/pagination|pageinfo|page_info|pager/i.test(String(key))) continue;
      const nested = extractDirectPageNumber(entry);
      if (nested) return nested;
    }
  }
  return null;
}

function extractPageNumberFromUrl(requestUrl) {
  try {
    const url = new URL(String(requestUrl || ''));
    const keys = [
      'page',
      'pageNum',
      'pageNo',
      'pageNumber',
      'currentPage',
      'page_num',
      'page_no',
      'page_number',
      'current_page'
    ];
    for (const key of keys) {
      const pageNumber = normalizePageNumber(url.searchParams.get(key));
      if (pageNumber) return pageNumber;
    }
  } catch (_) {}
  return null;
}

function normalizePgyRequestScope(requestUrl) {
  try {
    const url = new URL(String(requestUrl || ''));
    const protocol = String(url.protocol || '').toLowerCase();
    const hostname = String(url.hostname || '').toLowerCase();
    if (!['http:', 'https:'].includes(protocol)) return null;
    if (hostname !== 'xiaohongshu.com' && !hostname.endsWith('.xiaohongshu.com')) return null;
    const port = url.port ? `:${url.port}` : '';
    const pathname = String(url.pathname || '/')
      .replace(/\/{2,}/g, '/')
      .replace(/\/$/, '') || '/';
    return `${protocol}//${hostname}${port}${pathname}`;
  } catch (_) {
    return null;
  }
}

function normalizeSourceContext(value) {
  const context = String(value == null ? '' : value).trim();
  return context ? context.slice(0, 160) : null;
}

function sourceContextOwner(value) {
  const context = normalizeSourceContext(value);
  if (!context) return null;
  const match = context.match(/^web-contents:(\d+):navigation:/i);
  return match ? `web-contents:${match[1]}` : context;
}

function sameSourceOwner(left, right) {
  const leftOwner = sourceContextOwner(left);
  const rightOwner = sourceContextOwner(right);
  return Boolean(leftOwner && rightOwner && leftOwner === rightOwner);
}

function extractPageNumberFromPayload(payload, options = {}) {
  const maxDepth = Math.max(1, Number(options.maxDepth || 6));
  const seen = new Set();
  const preferredKeys = new Set([
    'pagenum',
    'pageno',
    'pagenumber',
    'currentpage',
    'page_num',
    'page_no',
    'page_number',
    'current_page'
  ]);

  function visit(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > maxDepth || seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const entry of value.slice(0, 30)) {
        const pageNumber = visit(entry, depth + 1);
        if (pageNumber) return pageNumber;
      }
      return null;
    }

    let entries = [];
    try { entries = Object.entries(value); } catch (_) {}
    for (const [key, entry] of entries) {
      if (!preferredKeys.has(String(key).toLowerCase())) continue;
      const pageNumber = normalizePageNumber(entry);
      if (pageNumber) return pageNumber;
    }

    const hasPaginationContext = entries.some(([key]) => (
      /^(pagesize|page_size|total|totalcount|total_count|hasnext|has_next)$/i.test(String(key))
    ));
    if (hasPaginationContext) {
      const pageEntry = entries.find(([key]) => /^page$/i.test(String(key)));
      const pageNumber = normalizePageNumber(pageEntry?.[1]);
      if (pageNumber) return pageNumber;
    }

    for (const [, entry] of entries.slice(0, 120)) {
      const pageNumber = visit(entry, depth + 1);
      if (pageNumber) return pageNumber;
    }
    return null;
  }

  return visit(payload);
}

function candidatePageFingerprint(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => String(row?.pgy_url || ''))
    .filter(Boolean)
    .join('|');
}

function resolvePgyStartPage({ pagination = null, responsePageNumber = null } = {}) {
  const responsePage = normalizePageNumber(responsePageNumber);
  const currentPage = pagination?.currentPageKnown
    ? normalizePageNumber(pagination.currentPage)
    : null;
  const visiblePage = currentPage || (
    pagination?.firstPageKnown && pagination?.atFirstPage ? 1 : null
  );
  return {
    startPage: visiblePage || responsePage || 1,
    visiblePageNumber: visiblePage,
    responsePageNumber: responsePage,
    conflict: Boolean(visiblePage && responsePage && visiblePage !== responsePage),
    evidence: visiblePage ? 'visible-pagination' : responsePage ? 'response-metadata' : 'default-first-page'
  };
}

function assessPgyPageAdvance({
  expectedPage,
  responsePageNumber,
  domPageNumber,
  domPageKnown = false,
  previousFingerprint = '',
  nextFingerprint = '',
  previousUrls = [],
  nextUrls = []
} = {}) {
  const expected = normalizePageNumber(expectedPage);
  const responsePage = normalizePageNumber(responsePageNumber);
  const domPage = domPageKnown ? normalizePageNumber(domPageNumber) : null;
  const previous = (Array.isArray(previousUrls) ? previousUrls : [])
    .map((url) => String(url || ''))
    .filter(Boolean);
  const next = (Array.isArray(nextUrls) ? nextUrls : [])
    .map((url) => String(url || ''))
    .filter(Boolean);
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  const distinctNext = Array.from(nextSet);
  const overlapCount = distinctNext.filter((url) => previousSet.has(url)).length;
  const uniqueCount = distinctNext.filter((url) => !previousSet.has(url)).length;
  const fingerprintChanged = Boolean(previousFingerprint)
    && Boolean(nextFingerprint)
    && String(nextFingerprint) !== String(previousFingerprint || '');
  const resultDetails = { uniqueCount, overlapCount };

  if (!expected) {
    return {
      ok: false,
      code: 'PGY_PAGINATION_PAGE_MISMATCH',
      evidence: 'invalid-expected-page',
      ...resultDetails
    };
  }
  if (!next.length || nextSet.size !== next.length) {
    return {
      ok: false,
      code: 'PGY_PAGINATION_DUPLICATE_PAGE',
      evidence: next.length ? 'duplicate-next-url' : 'empty-next-page',
      ...resultDetails
    };
  }
  if (overlapCount > 0) {
    return {
      ok: false,
      code: 'PGY_PAGINATION_PAGE_OVERLAP',
      evidence: 'cross-page-overlap',
      ...resultDetails
    };
  }
  if (responsePage) {
    if (responsePage !== expected) {
      return {
        ok: false,
        code: 'PGY_PAGINATION_PAGE_MISMATCH',
        evidence: 'response-page',
        ...resultDetails
      };
    }
    if (uniqueCount === next.length && fingerprintChanged) {
      return { ok: true, evidence: 'response-page', ...resultDetails };
    }
  } else if (domPage) {
    if (domPage !== expected) {
      return {
        ok: false,
        code: 'PGY_PAGINATION_PAGE_MISMATCH',
        evidence: 'dom-page',
        ...resultDetails
      };
    }
    if (uniqueCount === next.length && fingerprintChanged) {
      return { ok: true, evidence: 'dom-page', ...resultDetails };
    }
  } else if (uniqueCount === next.length && fingerprintChanged) {
    return { ok: true, evidence: 'response-content', ...resultDetails };
  }

  return {
    ok: false,
    code: 'PGY_PAGINATION_DUPLICATE_PAGE',
    evidence: 'no-new-page-evidence',
    ...resultDetails
  };
}

class PgyCandidateResponseCache {
  constructor(options = {}) {
    this.maxEntries = Math.max(2, Number(options.maxEntries || 30));
    this.maxAgeMs = Math.max(1000, Number(options.maxAgeMs || 10 * 60 * 1000));
    this.entries = [];
    this.captureSequence = 0;
    this.commandWindows = new WeakMap();
  }

  beginCommandWindow(options = {}) {
    const startedAtValue = Number(options.startedAt);
    const startedAt = Number.isFinite(startedAtValue) ? startedAtValue : Date.now();
    const requestedMaxAgeMs = Number(options.maxAgeMs);
    const maxAgeMs = Number.isFinite(requestedMaxAgeMs)
      ? Math.max(1000, Math.min(this.maxAgeMs, requestedMaxAgeMs))
      : this.maxAgeMs;
    const handle = Object.freeze({ type: 'pgy-candidate-command-window' });
    this.commandWindows.set(handle, {
      startedAt,
      expiresAt: startedAt + maxAgeMs,
      sequenceFloor: this.captureSequence,
      requestScope: normalizePgyRequestScope(options.requestUrl),
      sourceContext: normalizeSourceContext(options.sourceContext)
    });
    return handle;
  }

  endCommandWindow(commandWindow) {
    if (!commandWindow || !this.commandWindows.has(commandWindow)) return false;
    this.commandWindows.delete(commandWindow);
    return true;
  }

  capture(payload, context = {}) {
    const sources = extractPgyCandidateSources(payload);
    if (!sources.length) return { captured: 0 };
    const options = context && typeof context === 'object' ? context : {};
    const requestScope = normalizePgyRequestScope(options.requestUrl);
    if (!requestScope) return { captured: 0, code: 'PGY_RESPONSE_REQUEST_SCOPE_INVALID' };

    const capturedAtValue = Number(options.capturedAt);
    const capturedAt = Number.isFinite(capturedAtValue) ? capturedAtValue : Date.now();
    const requestPageNumber = extractPageNumberFromUrl(options.requestUrl);
    const alternatives = sources
      .filter((source) => !(
        requestPageNumber
        && source.pageNumber
        && requestPageNumber !== source.pageNumber
      ))
      .slice(0, 12)
      .map((source) => ({
        rows: source.rows,
        path: source.path,
        pageNumber: requestPageNumber || source.pageNumber || null,
        fingerprint: candidatePageFingerprint(source.rows)
      }));
    if (!alternatives.length) {
      return { captured: 0, code: 'PGY_RESPONSE_PAGE_CONFLICT' };
    }
    const best = alternatives[0];
    const pageNumber = best.pageNumber;
    const commandWindow = options.commandWindow || null;
    const windowState = commandWindow ? this.commandWindows.get(commandWindow) : null;
    const sourceContext = normalizeSourceContext(options.sourceContext);
    if (commandWindow && !windowState) {
      return { captured: 0, code: 'PGY_RESPONSE_COMMAND_WINDOW_INVALID' };
    }
    if (windowState) {
      if (capturedAt < windowState.startedAt || capturedAt > windowState.expiresAt) {
        return { captured: 0, code: 'PGY_RESPONSE_OUTSIDE_COMMAND_WINDOW' };
      }
      if (windowState.requestScope && windowState.requestScope !== requestScope) {
        return { captured: 0, code: 'PGY_RESPONSE_REQUEST_SCOPE_MISMATCH' };
      }
      if (windowState.sourceContext && sourceContext && windowState.sourceContext !== sourceContext) {
        return { captured: 0, code: 'PGY_RESPONSE_SOURCE_CONTEXT_MISMATCH' };
      }
      if (!windowState.requestScope) windowState.requestScope = requestScope;
      if (!windowState.sourceContext && sourceContext) windowState.sourceContext = sourceContext;
    }

    const fingerprint = best.fingerprint;
    const sequence = ++this.captureSequence;
    this.entries.unshift({
      capturedAt,
      sequence,
      rows: best.rows,
      path: best.path,
      pageNumber,
      fingerprint,
      alternatives,
      requestScope,
      commandWindow,
      sourceContext
    });
    this.entries = this.entries.slice(0, this.maxEntries);
    return { captured: best.rows.length, pageNumber, fingerprint, requestScope, sequence };
  }

  seedCommandWindow(commandWindow, options = {}) {
    const windowState = commandWindow ? this.commandWindows.get(commandWindow) : null;
    if (!windowState) return { seeded: 0, code: 'PGY_RESPONSE_COMMAND_WINDOW_INVALID' };

    const sourceContext = normalizeSourceContext(options.sourceContext) || windowState.sourceContext;
    if (!sourceContext) return { seeded: 0, code: 'PGY_RESPONSE_SOURCE_CONTEXT_MISSING' };
    if (windowState.sourceContext && windowState.sourceContext !== sourceContext) {
      return { seeded: 0, code: 'PGY_RESPONSE_SOURCE_CONTEXT_MISMATCH' };
    }

    const nowValue = Number(options.now);
    const now = Number.isFinite(nowValue) ? nowValue : Date.now();
    const requestedMaxAgeMs = Number(options.maxAgeMs);
    const maxAgeMs = Number.isFinite(requestedMaxAgeMs)
      ? Math.max(1000, Math.min(this.maxAgeMs, requestedMaxAgeMs))
      : this.maxAgeMs;
    const expectedPage = options.expectedPage == null
      ? null
      : normalizePageNumber(options.expectedPage);
    if (options.expectedPage != null && !expectedPage) {
      return { seeded: 0, code: 'PGY_RESPONSE_EXPECTED_PAGE_INVALID' };
    }

    this.entries = this.entries.filter((entry) => {
      const age = now - entry.capturedAt;
      return age >= 0 && age <= this.maxAgeMs;
    });
    const passive = this.entries
      .filter((entry) => (
        !entry.commandWindow
        && entry.sourceContext === sourceContext
        && now - entry.capturedAt <= maxAgeMs
        && (expectedPage == null || entry.pageNumber == null || entry.pageNumber === expectedPage)
      ))
      .sort((left, right) => {
        const leftExactPage = expectedPage != null && left.pageNumber === expectedPage ? 1 : 0;
        const rightExactPage = expectedPage != null && right.pageNumber === expectedPage ? 1 : 0;
        return rightExactPage - leftExactPage
          || right.rows.length - left.rows.length
          || right.capturedAt - left.capturedAt
          || right.sequence - left.sequence;
      })[0];
    if (!passive) return { seeded: 0, code: 'PGY_RESPONSE_PASSIVE_SNAPSHOT_MISSING' };
    if (windowState.requestScope && windowState.requestScope !== passive.requestScope) {
      return { seeded: 0, code: 'PGY_RESPONSE_REQUEST_SCOPE_MISMATCH' };
    }

    windowState.requestScope = passive.requestScope;
    windowState.sourceContext = sourceContext;
    const sequence = ++this.captureSequence;
    this.entries.unshift({
      ...passive,
      capturedAt: now,
      sequence,
      commandWindow,
      sourceContext,
      seededFromSequence: passive.sequence
    });
    this.entries = this.entries.slice(0, this.maxEntries);
    return {
      seeded: passive.rows.length,
      pageNumber: passive.pageNumber,
      fingerprint: passive.fingerprint,
      requestScope: passive.requestScope,
      sequence
    };
  }

  promoteVerifiedSnapshot(commandWindow, options = {}) {
    const windowState = commandWindow ? this.commandWindows.get(commandWindow) : null;
    if (!windowState?.requestScope) {
      return { promoted: 0, code: 'PGY_RESPONSE_COMMAND_WINDOW_INVALID' };
    }
    const sourceContext = normalizeSourceContext(options.sourceContext) || windowState.sourceContext;
    if (!sourceContext || sourceContext !== windowState.sourceContext) {
      return { promoted: 0, code: 'PGY_RESPONSE_SOURCE_CONTEXT_MISMATCH' };
    }
    const pageNumber = normalizePageNumber(options.pageNumber);
    const sequence = Number(options.sequence || 0);
    const fingerprint = String(options.fingerprint || '');
    if (!pageNumber || !Number.isFinite(sequence) || sequence < 1 || !fingerprint) {
      return { promoted: 0, code: 'PGY_RESPONSE_VERIFIED_SNAPSHOT_INVALID' };
    }

    const entry = this.entries.find((candidate) => (
      candidate.commandWindow === commandWindow
      && candidate.requestScope === windowState.requestScope
      && candidate.sourceContext === sourceContext
      && candidate.sequence === sequence
    ));
    if (!entry) return { promoted: 0, code: 'PGY_RESPONSE_VERIFIED_SNAPSHOT_MISSING' };
    const alternatives = Array.isArray(entry.alternatives) && entry.alternatives.length
      ? entry.alternatives
      : [{
          rows: entry.rows,
          path: entry.path,
          pageNumber: entry.pageNumber,
          fingerprint: entry.fingerprint
        }];
    const selected = alternatives.find((alternative) => (
      String(alternative.fingerprint || candidatePageFingerprint(alternative.rows)) === fingerprint
      && (!alternative.pageNumber || Number(alternative.pageNumber) === pageNumber)
    ));
    if (!selected?.rows?.length) {
      return { promoted: 0, code: 'PGY_RESPONSE_VERIFIED_SNAPSHOT_MISMATCH' };
    }

    const capturedAtValue = Number(options.capturedAt);
    const capturedAt = Number.isFinite(capturedAtValue) ? capturedAtValue : Date.now();
    const promotedSequence = ++this.captureSequence;
    const passiveAlternative = {
      rows: selected.rows,
      path: selected.path,
      pageNumber,
      fingerprint
    };
    this.entries.unshift({
      capturedAt,
      sequence: promotedSequence,
      rows: selected.rows,
      path: selected.path,
      pageNumber,
      fingerprint,
      alternatives: [passiveAlternative],
      requestScope: entry.requestScope,
      commandWindow: null,
      sourceContext,
      promotedFromSequence: entry.sequence
    });
    this.entries = this.entries.slice(0, this.maxEntries);
    return { promoted: selected.rows.length, pageNumber, fingerprint, sequence: promotedSequence };
  }

  recentCandidates(limit, query = {}) {
    const sourceContext = normalizeSourceContext(query.sourceContext);
    if (!sourceContext) return [];
    const nowValue = Number(query.now);
    const now = Number.isFinite(nowValue) ? nowValue : Date.now();
    const requestedMaxAgeMs = Number(query.maxAgeMs);
    const maxAgeMs = Number.isFinite(requestedMaxAgeMs)
      ? Math.max(1000, Math.min(this.maxAgeMs, requestedMaxAgeMs))
      : this.maxAgeMs;
    const requested = Math.max(1, Number(limit || 50));
    this.entries = this.entries.filter((entry) => {
      const age = now - entry.capturedAt;
      return age >= 0 && age <= this.maxAgeMs;
    });
    const snapshots = [];
    const seen = new Set();
    for (const entry of this.entries) {
      if (!sameSourceOwner(entry.sourceContext, sourceContext)) continue;
      if (now - entry.capturedAt > maxAgeMs) continue;
      const alternatives = Array.isArray(entry.alternatives) && entry.alternatives.length
        ? entry.alternatives
        : [{
            rows: entry.rows,
            path: entry.path,
            pageNumber: entry.pageNumber,
            fingerprint: entry.fingerprint
          }];
      for (const alternative of alternatives) {
        const fingerprint = String(alternative.fingerprint || candidatePageFingerprint(alternative.rows));
        if (!fingerprint || seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        snapshots.push({
          sequence: entry.sequence,
          capturedAt: entry.capturedAt,
          sourceContext: entry.sourceContext,
          requestScope: entry.requestScope,
          pageNumber: alternative.pageNumber,
          fingerprint,
          items: alternative.rows.slice(0, requested)
        });
        if (snapshots.length >= 30) return snapshots;
      }
    }
    return snapshots;
  }

  adoptVerifiedSnapshot(commandWindow, options = {}) {
    const windowState = commandWindow ? this.commandWindows.get(commandWindow) : null;
    if (!windowState) return { adopted: 0, code: 'PGY_RESPONSE_COMMAND_WINDOW_INVALID' };
    const sourceContext = normalizeSourceContext(options.sourceContext) || windowState.sourceContext;
    if (!sourceContext || windowState.sourceContext !== sourceContext) {
      return { adopted: 0, code: 'PGY_RESPONSE_SOURCE_CONTEXT_MISMATCH' };
    }
    const pageNumber = normalizePageNumber(options.pageNumber);
    const sequence = Number(options.sequence || 0);
    const fingerprint = String(options.fingerprint || '');
    if (!pageNumber || !Number.isFinite(sequence) || sequence < 1 || !fingerprint) {
      return { adopted: 0, code: 'PGY_RESPONSE_VERIFIED_SNAPSHOT_INVALID' };
    }
    const entry = this.entries.find((candidate) => (
      candidate.sequence === sequence
      && sameSourceOwner(candidate.sourceContext, sourceContext)
    ));
    if (!entry) return { adopted: 0, code: 'PGY_RESPONSE_VERIFIED_SNAPSHOT_MISSING' };
    if (windowState.requestScope && windowState.requestScope !== entry.requestScope) {
      return { adopted: 0, code: 'PGY_RESPONSE_REQUEST_SCOPE_MISMATCH' };
    }
    const alternatives = Array.isArray(entry.alternatives) && entry.alternatives.length
      ? entry.alternatives
      : [{
          rows: entry.rows,
          path: entry.path,
          pageNumber: entry.pageNumber,
          fingerprint: entry.fingerprint
        }];
    const selected = alternatives.find((alternative) => (
      String(alternative.fingerprint || candidatePageFingerprint(alternative.rows)) === fingerprint
      && (!alternative.pageNumber || Number(alternative.pageNumber) === pageNumber)
    ));
    if (!selected?.rows?.length) {
      return { adopted: 0, code: 'PGY_RESPONSE_VERIFIED_SNAPSHOT_MISMATCH' };
    }
    windowState.requestScope = entry.requestScope;
    const capturedAtValue = Number(options.capturedAt);
    const capturedAt = Number.isFinite(capturedAtValue) ? capturedAtValue : Date.now();
    const adoptedSequence = ++this.captureSequence;
    this.entries.unshift({
      capturedAt,
      sequence: adoptedSequence,
      rows: selected.rows,
      path: selected.path,
      pageNumber,
      fingerprint,
      alternatives: [{ ...selected, pageNumber, fingerprint }],
      requestScope: entry.requestScope,
      commandWindow,
      sourceContext,
      adoptedFromSequence: entry.sequence
    });
    this.entries = this.entries.slice(0, this.maxEntries);
    return { adopted: selected.rows.length, pageNumber, fingerprint, sequence: adoptedSequence };
  }

  latest(limit, query = {}) {
    if (!query || typeof query !== 'object') return null;
    const commandWindow = query.commandWindow;
    const windowState = commandWindow ? this.commandWindows.get(commandWindow) : null;
    if (!windowState?.requestScope) return null;

    const nowValue = Number(query.now);
    const now = Number.isFinite(nowValue) ? nowValue : Date.now();
    if (now < windowState.startedAt || now > windowState.expiresAt) return null;
    const expectedPage = query.expectedPage == null
      ? null
      : normalizePageNumber(query.expectedPage);
    if (query.expectedPage != null && !expectedPage) return null;
    const afterSequenceValue = Number(query.afterSequence);
    const afterSequence = Number.isFinite(afterSequenceValue)
      ? Math.max(windowState.sequenceFloor, afterSequenceValue)
      : windowState.sequenceFloor;

    this.entries = this.entries.filter((entry) => {
      const age = now - entry.capturedAt;
      return age >= 0 && age <= this.maxAgeMs;
    });
    const entry = this.entries.find((candidate) => (
      candidate.commandWindow === commandWindow
      && candidate.requestScope === windowState.requestScope
      && candidate.sequence > afterSequence
      && candidate.capturedAt >= windowState.startedAt
      && candidate.capturedAt <= windowState.expiresAt
      && (expectedPage == null || candidate.pageNumber === expectedPage)
    ));
    if (!entry) return null;
    const requested = Math.max(1, Number(limit || 50));
    const items = entry.rows.slice(0, requested);
    return {
      ok: true,
      capturedAt: entry.capturedAt,
      sequence: entry.sequence,
      pageNumber: entry.pageNumber,
      fingerprint: entry.fingerprint,
      items,
      stats: {
        requested,
        available: entry.rows.length,
        extracted: items.length,
        source: 'pgy-list-response'
      },
      message: items.length >= requested
        ? `已按当前排序读取前 ${requested} 位达人。`
        : `当前结果可读取 ${items.length} 位达人，少于指令中的 ${requested} 位。`
    };
  }

  latestCandidates(limit, query = {}) {
    if (!query || typeof query !== 'object') return [];
    const commandWindow = query.commandWindow;
    const windowState = commandWindow ? this.commandWindows.get(commandWindow) : null;
    if (!windowState?.requestScope) return [];

    const nowValue = Number(query.now);
    const now = Number.isFinite(nowValue) ? nowValue : Date.now();
    if (now < windowState.startedAt || now > windowState.expiresAt) return [];
    const expectedPage = query.expectedPage == null
      ? null
      : normalizePageNumber(query.expectedPage);
    if (query.expectedPage != null && !expectedPage) return [];
    const afterSequenceValue = Number(query.afterSequence);
    const afterSequence = Number.isFinite(afterSequenceValue)
      ? Math.max(windowState.sequenceFloor, afterSequenceValue)
      : windowState.sequenceFloor;
    const requested = Math.max(1, Number(limit || 50));

    this.entries = this.entries.filter((entry) => {
      const age = now - entry.capturedAt;
      return age >= 0 && age <= this.maxAgeMs;
    });
    const snapshots = [];
    const seen = new Set();
    for (const entry of this.entries) {
      if (
        entry.commandWindow !== commandWindow
        || entry.requestScope !== windowState.requestScope
        || entry.sequence <= afterSequence
        || entry.capturedAt < windowState.startedAt
        || entry.capturedAt > windowState.expiresAt
      ) continue;
      const alternatives = Array.isArray(entry.alternatives) && entry.alternatives.length
        ? entry.alternatives
        : [{
            rows: entry.rows,
            path: entry.path,
            pageNumber: entry.pageNumber,
            fingerprint: entry.fingerprint
          }];
      for (const alternative of alternatives) {
        if (expectedPage != null && alternative.pageNumber !== expectedPage) continue;
        const fingerprint = String(alternative.fingerprint || candidatePageFingerprint(alternative.rows));
        const key = `${entry.sequence}:${fingerprint}`;
        if (!fingerprint || seen.has(key)) continue;
        seen.add(key);
        const items = alternative.rows.slice(0, requested);
        snapshots.push({
          ok: true,
          capturedAt: entry.capturedAt,
          sequence: entry.sequence,
          pageNumber: alternative.pageNumber,
          fingerprint,
          items,
          stats: {
            requested,
            available: alternative.rows.length,
            extracted: items.length,
            source: 'pgy-list-response',
            sourcePath: alternative.path || ''
          }
        });
        if (snapshots.length >= 30) return snapshots;
      }
    }
    return snapshots;
  }

  clear() {
    this.entries = [];
    this.commandWindows = new WeakMap();
  }
}

module.exports = {
  assessPgyPageAdvance,
  candidatePageFingerprint,
  extractPageNumberFromPayload,
  extractPageNumberFromUrl,
  normalizePgyRequestScope,
  PgyCandidateResponseCache,
  extractPgyCandidateSources,
  normalizePgyCandidateRecord,
  resolvePgyStartPage
};
