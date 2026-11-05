const URL = 'https://project.feishu.cn/open_api/authen/plugin_token';
const LIMIT = 65536;

class FeishuAuthError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'FeishuAuthError';
    this.code = code;
    Object.assign(this, details);
  }
}

function valid(value) {
  return typeof value === 'string' && /^[\x21-\x7e]{1,8192}$/.test(value);
}

// One-shot exchange for the local diagnostic. Never persists or logs credentials.
async function exchangePluginToken({ pluginId, pluginSecret, fetchImpl = globalThis.fetch,
  timeoutMs = 15000 } = {}) {
  const fail = (code, details) => { throw new FeishuAuthError(code, details); };
  if (!valid(pluginId) || !valid(pluginSecret) || typeof fetchImpl !== 'function'
      || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    fail('FEISHU_AUTH_CONFIG_INVALID');
  }
  const controller = new AbortController();
  let timer;
  let reader;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new FeishuAuthError('FEISHU_AUTH_TIMEOUT'));
    }, timeoutMs);
  });
  const request = async () => {
    const response = await fetchImpl(URL, {
      method: 'POST', redirect: 'manual', credentials: 'omit', cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ plugin_id: pluginId, plugin_secret: pluginSecret, type: 0 })
    });
    if (response.redirected || (response.url && response.url !== URL)
        || (response.status >= 300 && response.status < 400)) fail('FEISHU_AUTH_REDIRECT');
    if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300) {
      fail('FEISHU_AUTH_HTTP', Number.isInteger(response.status) ? { status: response.status } : {});
    }
    if (!response.body?.getReader) fail('FEISHU_AUTH_RESPONSE_INVALID');
    reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      if (controller.signal.aborted) fail('FEISHU_AUTH_TIMEOUT');
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT) fail('FEISHU_AUTH_RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch (_) { fail('FEISHU_AUTH_RESPONSE_INVALID'); }
    if (!Number.isSafeInteger(body?.error?.code)) fail('FEISHU_AUTH_RESPONSE_INVALID');
    if (body.error.code !== 0) fail('FEISHU_AUTH_API', { apiCode: body.error.code });
    if (!valid(body?.data?.token) || !body.data.token.startsWith('p-')
        || !Number.isInteger(body.data.expire_time) || body.data.expire_time <= 0) {
      fail('FEISHU_AUTH_RESPONSE_INVALID');
    }
    return { token: body.data.token, expiresIn: body.data.expire_time };
  };
  try {
    return await Promise.race([timeout, request()]);
  } catch (error) {
    if (error instanceof FeishuAuthError) throw error;
    fail('FEISHU_AUTH_REQUEST_FAILED');
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) reader.cancel().catch(() => {});
  }
}

module.exports = { exchangePluginToken };
