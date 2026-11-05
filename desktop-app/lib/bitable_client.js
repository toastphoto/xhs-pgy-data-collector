// Protocol: official Lark SDK bitable/v1 models. Authentication is injected by
// the main-process connection layer, never accepted as a renderer URL or header.
const ORIGIN = 'https://open.feishu.cn';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(code, details = {}) {
  return Object.assign(new Error(code), { code, ...details });
}
function identifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw failure('BITABLE_TARGET_INVALID', { outcome: 'not_sent' });
  }
  return value;
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function createBitableClient({ appToken, tableId, getAccessToken, fetchImpl = globalThis.fetch, timeoutMs = 30000 }) {
  const base = `/open-apis/bitable/v1/apps/${identifier(appToken)}/tables/${identifier(tableId)}`;
  if (typeof getAccessToken !== 'function' || typeof fetchImpl !== 'function'
    || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw failure('BITABLE_CLIENT_INVALID');
  let writeTail = Promise.resolve();

  async function request(method, suffix, { query = {}, body, write = false, signal } = {}) {
    if (signal?.aborted) throw failure('BITABLE_STOPPED', { outcome: 'not_sent' });
    let token;
    try { token = await getAccessToken(); } catch (_) {
      throw failure('BITABLE_AUTH_REQUIRED', { outcome: 'not_sent' });
    }
    if (typeof token !== 'string' || !token || /\s/.test(token)) {
      throw failure('BITABLE_AUTH_REQUIRED', { outcome: 'not_sent' });
    }
    if (signal?.aborted) throw failure('BITABLE_STOPPED', { outcome: 'not_sent' });
    const url = new URL(`${base}${suffix}`, ORIGIN);
    for (const [key, value] of Object.entries(query)) if (value != null && value !== '') url.searchParams.set(key, String(value));
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetchImpl(url.href, {
        method, redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      let data;
      try { data = await response.json(); } catch (_) {
        throw failure('BITABLE_RESPONSE_INVALID', { outcome: write ? 'unknown' : 'read_failed' });
      }
      if (!response.ok || data?.code !== 0) {
        const apiCode = Number.isSafeInteger(data?.code) ? data.code : null;
        const unknown = write && (response.status >= 500 || response.status === 408
          || !apiCode || (apiCode >= 1255000 && apiCode < 1256000));
        throw failure('BITABLE_API_ERROR', {
          httpStatus: response.status, apiCode,
          outcome: unknown ? 'unknown' : (write ? 'rejected' : 'read_failed')
        });
      }
      if (!object(data.data)) throw failure('BITABLE_RESPONSE_INVALID', { outcome: write ? 'unknown' : 'read_failed' });
      return data.data;
    } catch (error) {
      if (error?.code?.startsWith('BITABLE_')) throw error;
      // Never expose remote response bodies, tokens or transport diagnostics.
      throw failure('BITABLE_REQUEST_FAILED', { outcome: write ? 'unknown' : 'read_failed' });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  async function pages(suffix, { method = 'GET', body, signal, maxPages = 100 } = {}) {
    if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 1000) throw failure('BITABLE_PAGE_LIMIT_INVALID');
    const items = [], seen = new Set();
    let pageToken = '';
    for (let page = 0; page < maxPages; page++) {
      const data = await request(method, suffix, { body, signal,
        query: { page_size: 100, page_token: pageToken, ...(method === 'POST' ? { user_id_type: 'open_id' } : {}) } });
      if (!Array.isArray(data.items) || typeof data.has_more !== 'boolean') throw failure('BITABLE_RESPONSE_INVALID');
      items.push(...data.items);
      if (!data.has_more) return items;
      if (typeof data.page_token !== 'string' || !data.page_token || seen.has(data.page_token)) {
        throw failure('BITABLE_PAGINATION_INVALID');
      }
      pageToken = data.page_token;
      seen.add(pageToken);
    }
    throw failure('BITABLE_PAGE_LIMIT_EXCEEDED');
  }

  function writeBatch(kind, records, { clientToken, signal } = {}) {
    if (!UUID_V4.test(clientToken || '') || !Array.isArray(records) || !records.length || records.length > 500) {
      return Promise.reject(failure('BITABLE_BATCH_INVALID', { outcome: 'not_sent' }));
    }
    let snapshot;
    try {
      snapshot = records.map(row => {
        if (!object(row) || !object(row.fields) || !Object.keys(row.fields).length) throw failure('BITABLE_BATCH_INVALID');
        if (kind === 'batch_create' && row.record_id != null) throw failure('BITABLE_BATCH_INVALID');
        return { fields: row.fields, ...(kind === 'batch_update' ? { record_id: identifier(row.record_id) } : {}) };
      });
      snapshot = JSON.parse(JSON.stringify(snapshot));
    } catch (_) { return Promise.reject(failure('BITABLE_BATCH_INVALID', { outcome: 'not_sent' })); }
    if (kind === 'batch_update' && new Set(snapshot.map(r => r.record_id)).size !== snapshot.length) {
      return Promise.reject(failure('BITABLE_BATCH_INVALID', { outcome: 'not_sent' }));
    }
    const operation = writeTail.then(async () => {
      const data = await request('POST', `/records/${kind}`, {
        body: { records: snapshot }, write: true, signal,
        query: { user_id_type: 'open_id', client_token: clientToken, ignore_consistency_check: false }
      });
      const result = data.records;
      if (!Array.isArray(result) || result.length !== snapshot.length
        || result.some(r => !object(r) || typeof r.record_id !== 'string' || !r.record_id)
        || new Set(result.map(r => r.record_id)).size !== result.length
        || (kind === 'batch_update' && result.some(r => !snapshot.some(s => s.record_id === r.record_id)))) {
        throw failure('BITABLE_RESPONSE_INVALID', { outcome: 'unknown' });
      }
      return result;
    });
    writeTail = operation.catch(() => {});
    return operation;
  }

  return Object.freeze({
    listFields: ({ signal, maxPages } = {}) => pages('/fields', { signal, maxPages }),
    searchRecords: (filter, options = {}) => {
      if (!object(filter)) return Promise.reject(failure('BITABLE_FILTER_INVALID'));
      let snapshot;
      try { snapshot = JSON.parse(JSON.stringify(filter)); } catch (_) {
        return Promise.reject(failure('BITABLE_FILTER_INVALID'));
      }
      return pages('/records/search', { ...options, method: 'POST', body: { filter: snapshot, automatic_fields: false } });
    },
    createRecords: (records, options) => writeBatch('batch_create', records, options),
    updateRecords: (records, options) => writeBatch('batch_update', records, options)
  });
}

module.exports = { createBitableClient };
