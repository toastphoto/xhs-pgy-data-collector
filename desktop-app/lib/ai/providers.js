function normalizeBaseUrl(input) {
  const s0 = String(input || '').trim();
  if (!s0) return '';
  // remove trailing slashes
  let s = s0.replace(/\/+$/, '');
  // remove trailing /v1
  s = s.replace(/\/v1$/i, '');
  s = s.replace(/\/v1\/$/i, '');
  // remove trailing slashes again
  s = s.replace(/\/+$/, '');
  return s;
}

async function _postJson(url, apiKey, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = null;
  }
  return { status: res.status, ok: res.ok, text, json };
}

function _extractChatText(json) {
  try {
    const t = json?.choices?.[0]?.message?.content;
    if (typeof t === 'string') return t;
  } catch (_) {}
  return '';
}

async function chatOpenAICompat({ baseUrl, apiKey, model, messages, temperature, max_tokens }) {
  const b = normalizeBaseUrl(baseUrl);
  if (!b) return { ok: false, error: 'baseUrl 为空' };
  if (!apiKey) return { ok: false, error: 'apiKey 为空' };
  if (!model) return { ok: false, error: 'model 为空' };

  const url = `${b}/v1/chat/completions`;
  const payload = {
    model,
    messages: Array.isArray(messages) ? messages : [],
    temperature: temperature ?? 0.2,
    ...(max_tokens ? { max_tokens } : {})
  };

  const r = await _postJson(url, apiKey, payload);
  if (!r.ok) return { ok: false, error: r.json?.error?.message || r.text || `HTTP ${r.status}` };
  const content = _extractChatText(r.json);
  return { ok: true, content, raw: r.json, usage: r.json?.usage || null };
}

async function chatDeepSeek({ apiKey, model, messages, temperature, max_tokens }) {
  // DeepSeek 官方：API 风格与 OpenAI 类似
  const baseUrl = 'https://api.deepseek.com';
  return await chatOpenAICompat({ baseUrl, apiKey, model, messages, temperature, max_tokens });
}

async function listModelsOpenAICompat({ baseUrl, apiKey }) {
  const b = normalizeBaseUrl(baseUrl);
  if (!b) return { ok: false, error: 'baseUrl 为空' };
  if (!apiKey) return { ok: false, error: 'apiKey 为空' };

  const url = `${b}/v1/models`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`
    }
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = null;
  }
  if (!res.ok) return { ok: false, error: json?.error?.message || text || `HTTP ${res.status}` };

  const data = Array.isArray(json?.data) ? json.data : Array.isArray(json?.data?.data) ? json.data.data : [];
  const models = data
    .map((x) => String(x?.id || x?.model || '').trim())
    .filter(Boolean);

  return { ok: true, models, raw: json };
}

module.exports = {
  normalizeBaseUrl,
  chatOpenAICompat,
  chatDeepSeek,
  listModelsOpenAICompat
};
