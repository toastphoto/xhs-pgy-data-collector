const ORIGIN = 'https://project.feishu.cn';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

class FeishuMetadataError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'FeishuMetadataError';
    this.code = code;
    Object.assign(this, details);
  }
}

function fail(code, details) {
  throw new FeishuMetadataError(code, details);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function identifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    fail('FEISHU_TARGET_INVALID');
  }
  return value;
}

function headerValue(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 8192
    && /^[\x21-\x7e]+$/.test(value);
}

function credentialHeaders(credentials) {
  if (!isRecord(credentials) || !['plugin', 'user'].includes(credentials.kind)
      || !headerValue(credentials.token)
      || (credentials.kind === 'plugin' && !headerValue(credentials.userKey))) {
    fail('FEISHU_CREDENTIALS_REQUIRED');
  }
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-PLUGIN-TOKEN': credentials.token
  };
  if (credentials.kind === 'plugin') {
    headers['X-USER-KEY'] = credentials.userKey;
    headers['x-auth-mode'] = '1';
  }
  return headers;
}

function parseMetadataResponse(body) {
  if (!isRecord(body) || !Number.isSafeInteger(body.err_code)) {
    fail('FEISHU_RESPONSE_INVALID');
  }
  // An HTTP 200 or an auth-token envelope is not metadata success.
  if (body.err_code !== 0) {
    fail('FEISHU_API_ERROR', { apiCode: body.err_code });
  }
  if ((body.err !== undefined && body.err !== null
      && (!isRecord(body.err) || Object.keys(body.err).length > 0))
      || (body.err_msg !== undefined && body.err_msg !== '')
      || !Array.isArray(body.data)) {
    fail('FEISHU_RESPONSE_INVALID');
  }
  const keys = new Set();
  for (const field of body.data) {
    if (!isRecord(field) || typeof field.field_key !== 'string' || !field.field_key.trim()
        || typeof field.field_name !== 'string' || !field.field_name.trim()
        || typeof field.field_type_key !== 'string' || !field.field_type_key.trim()
        || keys.has(field.field_key)) {
      fail('FEISHU_METADATA_INVALID');
    }
    keys.add(field.field_key);
  }
  return body.data;
}

function summarizeRequirements(fields) {
  const required = { 1: 'required', 2: 'optional', 3: 'conditional' };
  return fields.map((field) => ({
    key: field.field_key,
    name: field.field_name,
    type: field.field_type_key,
    requirement: Number.isInteger(field.is_required)
      ? (required[field.is_required] || 'unknown') : 'unknown'
  }));
}

async function readBoundedJson(response, signal) {
  const length = response.headers.get('content-length');
  if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_RESPONSE_BYTES) {
    fail('FEISHU_RESPONSE_TOO_LARGE');
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    fail('FEISHU_RESPONSE_INVALID');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  const cancel = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) fail('FEISHU_REQUEST_ABORTED');
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) fail('FEISHU_RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
    if (signal.aborted) fail('FEISHU_REQUEST_ABORTED');
    try {
      return JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'));
    } catch (_) {
      fail('FEISHU_RESPONSE_INVALID');
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    cancel();
  }
}

function createFeishuMetadataReader({
  projectKey, workItemTypeKey, getCredentials, fetchImpl = globalThis.fetch, timeoutMs = 15000
} = {}) {
  const project = identifier(projectKey);
  const type = identifier(workItemTypeKey);
  if (typeof getCredentials !== 'function' || typeof fetchImpl !== 'function'
      || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    fail('FEISHU_CONFIG_INVALID');
  }
  const url = `${ORIGIN}/open_api/${project}/work_item/${type}/meta`;

  return Object.freeze({
    // Main-process use only. The credential provider must not expose secrets to IPC/UI.
    async readMetadata({ signal } = {}) {
      if (signal && (typeof signal.addEventListener !== 'function'
          || typeof signal.removeEventListener !== 'function')) {
        fail('FEISHU_CONFIG_INVALID');
      }
      if (signal?.aborted) fail('FEISHU_REQUEST_ABORTED');
      const controller = new AbortController();
      let rejectStopped;
      let stopError;
      const stopped = new Promise((_, reject) => { rejectStopped = reject; });
      const stop = (code) => {
        if (stopError) return;
        stopError = new FeishuMetadataError(code);
        controller.abort();
        rejectStopped(stopError);
      };
      const onAbort = () => stop('FEISHU_REQUEST_ABORTED');
      signal?.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => stop('FEISHU_REQUEST_TIMEOUT'), timeoutMs);
      const checkStopped = () => { if (stopError) throw stopError; };
      const operation = async () => {
        let credentials;
        try {
          credentials = await getCredentials({ signal: controller.signal });
        } catch (_) {
          checkStopped();
          fail('FEISHU_CREDENTIALS_REQUIRED');
        }
        checkStopped();
        const headers = credentialHeaders(credentials);
        const response = await fetchImpl(url, {
          method: 'GET', headers, signal: controller.signal,
          redirect: 'manual', credentials: 'omit', cache: 'no-store'
        });
        checkStopped();
        if (response.redirected || (response.url && response.url !== url)
            || (response.status >= 300 && response.status < 400)) {
          fail('FEISHU_REDIRECT_REJECTED');
        }
        if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
          fail('FEISHU_RESPONSE_INVALID');
        }
        if (response.status < 200 || response.status >= 300) {
          fail('FEISHU_HTTP_ERROR', { status: response.status });
        }
        const body = await readBoundedJson(response, controller.signal);
        checkStopped();
        const fields = parseMetadataResponse(body);
        return { projectKey: project, workItemTypeKey: type, fields,
          requirements: summarizeRequirements(fields) };
      };
      try {
        return await Promise.race([operation(), stopped]);
      } catch (error) {
        if (stopError) throw stopError;
        if (error instanceof FeishuMetadataError) throw error;
        // Remote bodies and transport/provider exceptions may contain credentials or contacts.
        fail('FEISHU_REQUEST_FAILED');
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        controller.abort();
      }
    }
  });
}

module.exports = { createFeishuMetadataReader, parseMetadataResponse, summarizeRequirements };
