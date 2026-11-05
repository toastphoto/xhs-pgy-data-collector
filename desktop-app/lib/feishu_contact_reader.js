const { buildContactQuery, reviewContactResponse } = require('./feishu_contact_preview');

class ContactReadError extends Error {
  constructor(code, details = {}) { super(code); this.code = code; Object.assign(this, details); }
}
function fail(code, details) { throw new ContactReadError(code, details); }
function key(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }
function header(value) { return typeof value === 'string' && /^[\x21-\x7e]{1,8192}$/.test(value); }

function createFeishuContactReader({ projectKey, workItemTypeKey, getCredentials,
  fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (!key(projectKey) || !key(workItemTypeKey)) fail('FEISHU_TARGET_INVALID');
  if (typeof getCredentials !== 'function' || typeof fetchImpl !== 'function'
      || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) fail('FEISHU_CONFIG_INVALID');
  const url = `https://project.feishu.cn/open_api/${projectKey}/work_item/${workItemTypeKey}/search/params`;
  return Object.freeze({
    async preview({ mapping, fields, identityKind, identityValue, existing = {}, signal } = {}) {
      // Snapshot caller-owned state before credentials or network awaits.
      const input = { mapping: mapping && { ...mapping }, fields: fields?.map(f => ({ ...f })),
        identityKind, identityValue, existing: { ...existing }, projectKey, workItemTypeKey };
      const query = buildContactQuery(input);
      if (identityKind !== 'xhs_account_number') fail('FEISHU_IDENTITY_INVALID');
      if (signal && (typeof signal.addEventListener !== 'function'
          || typeof signal.removeEventListener !== 'function')) fail('FEISHU_CONFIG_INVALID');
      if (signal?.aborted) fail('FEISHU_REQUEST_ABORTED');
      const controller = new AbortController();
      let stopError;
      let rejectStopped;
      const stopped = new Promise((_, reject) => { rejectStopped = reject; });
      const stop = code => {
        if (stopError) return;
        stopError = new ContactReadError(code);
        controller.abort();
        rejectStopped(stopError);
      };
      const check = () => { if (stopError) throw stopError; };
      const onAbort = () => stop('FEISHU_REQUEST_ABORTED');
      signal?.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => stop('FEISHU_REQUEST_TIMEOUT'), timeoutMs);
      const run = async () => {
        let credentials;
        try { credentials = await getCredentials({ signal: controller.signal }); }
        catch (_) { check(); fail('FEISHU_CREDENTIALS_REQUIRED'); }
        check();
        if (credentials?.kind !== 'plugin' || !header(credentials.token) || !header(credentials.userKey)) {
          fail('FEISHU_CREDENTIALS_REQUIRED');
        }
        const response = await fetchImpl(url, { method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json',
            'X-PLUGIN-TOKEN': credentials.token, 'X-USER-KEY': credentials.userKey, 'x-auth-mode': '1' },
          body: JSON.stringify(query), redirect: 'manual', credentials: 'omit', cache: 'no-store',
          signal: controller.signal });
        check();
        if (response.redirected || (response.url && response.url !== url)
            || (response.status >= 300 && response.status < 400)) fail('FEISHU_REDIRECT_REJECTED');
        if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
          fail('FEISHU_RESPONSE_INVALID');
        }
        if (response.status < 200 || response.status >= 300) fail('FEISHU_HTTP_ERROR', {status: response.status});
        const limit = 2 * 1024 * 1024;
        const length = response.headers.get('content-length');
        if (length && /^\d+$/.test(length) && Number(length) > limit) fail('FEISHU_RESPONSE_TOO_LARGE');
        if (!response.body?.getReader) fail('FEISHU_RESPONSE_INVALID');
        const reader = response.body.getReader();
        const cancel = () => { reader.cancel().catch(() => {}); };
        controller.signal.addEventListener('abort', cancel, { once: true });
        const chunks = [];
        let size = 0;
        let body;
        try {
          while (true) {
            check();
            const { done, value } = await reader.read();
            check();
            if (done) break;
            size += value.byteLength;
            if (size > limit) fail('FEISHU_RESPONSE_TOO_LARGE');
            chunks.push(Buffer.from(value));
          }
          try { body = JSON.parse(Buffer.concat(chunks, size).toString('utf8')); }
          catch (_) { fail('FEISHU_RESPONSE_INVALID'); }
        } finally {
          controller.signal.removeEventListener('abort', cancel);
          cancel();
        }
        // Return only reviewed candidates/proposals, never a raw remote response.
        if (Number.isSafeInteger(body?.err_code) && body.err_code !== 0) {
          fail('FEISHU_API_ERROR', {apiCode: body.err_code});
        }
        try { return reviewContactResponse({ ...input, body }); }
        catch (_) { fail('FEISHU_CONTACT_REVIEW_FAILED'); }
      };
      try { return await Promise.race([run(), stopped]); }
      catch (error) {
        if (stopError) throw stopError;
        if (error instanceof ContactReadError) throw error;
        fail('FEISHU_REQUEST_FAILED');
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        controller.abort();
      }
    }
  });
}

module.exports = { createFeishuContactReader };
