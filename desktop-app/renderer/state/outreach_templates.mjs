export const OUTREACH_TEMPLATE_STORAGE_KEY = 'xhs-pgy.outreach-templates.v1';

export const OUTREACH_CHANNEL_KEYS = {
  '微信建联': 'wechat',
  '邮件建联': 'email',
  '蒲公英邀约': 'pgy'
};

const DEFAULT_LIBRARY = {
  version: 1,
  channels: {
    wechat: {
      selectedId: 'wechat-concise',
      templates: [
        {
          id: 'wechat-concise',
          name: '简洁合作邀约',
          isDefault: true,
          body: '你好，我们想和您沟通一下{{项目名称}}合作，方便的话可以通过一下好友吗？'
        },
        {
          id: 'wechat-casual',
          name: '轻松口吻',
          isDefault: false,
          body: '哈喽{{达人昵称}}，这边有个{{项目名称}}想邀请你合作，可以聊聊吗~'
        }
      ]
    },
    email: {
      selectedId: 'email-detailed',
      templates: [
        {
          id: 'email-detailed',
          name: '详细邀请',
          isDefault: true,
          subject: '{{项目名称}}合作邀约',
          body: '哈喽博主，这边有个{{项目名称}}邀请您合作，如果有兴趣可以加v：{{微信号}} 详情了解'
        },
        {
          id: 'email-casual',
          name: '简短询问',
          isDefault: false,
          subject: '{{项目名称}}合作邀约',
          body: '哈喽宝，这边有个{{项目名称}}，可以接吗~'
        }
      ]
    },
    pgy: {
      selectedId: 'pgy-formal',
      templates: [
        {
          id: 'pgy-formal',
          name: '正式沟通',
          isDefault: true,
          body: '您好，想跟您沟通一下品牌合作的需求'
        },
        {
          id: 'pgy-casual',
          name: '轻松询问',
          isDefault: false,
          body: '哈喽宝子，辛苦看下可以接吗？'
        }
      ]
    }
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function normalizeTemplate(value, fallback, index) {
  const source = value && typeof value === 'object' ? value : {};
  const fallbackTemplate = fallback || {};
  return {
    id: cleanText(source.id) || `${cleanText(fallbackTemplate.id) || 'template'}-${index + 1}`,
    name: cleanText(source.name) || cleanText(fallbackTemplate.name) || `模板 ${index + 1}`,
    isDefault: source.isDefault === true,
    subject: source.subject === undefined ? cleanText(fallbackTemplate.subject) : String(source.subject),
    body: source.body === undefined ? cleanText(fallbackTemplate.body) : String(source.body)
  };
}

function normalizeChannel(value, fallback) {
  const source = value && typeof value === 'object' ? value : {};
  const incoming = Array.isArray(source.templates) ? source.templates : [];
  const sourceTemplates = incoming.length ? incoming : fallback.templates;
  const templates = [];
  const seen = new Set();

  sourceTemplates.forEach((item, index) => {
    const normalized = normalizeTemplate(item, fallback.templates[index], index);
    if (!normalized.id || seen.has(normalized.id)) return;
    seen.add(normalized.id);
    templates.push(normalized);
  });

  if (!templates.length) templates.push(normalizeTemplate(fallback.templates[0], fallback.templates[0], 0));
  let defaultIndex = templates.findIndex((item) => item.isDefault);
  if (defaultIndex < 0) defaultIndex = 0;
  templates.forEach((item, index) => { item.isDefault = index === defaultIndex; });

  const requestedSelectedId = cleanText(source.selectedId);
  const selectedId = templates.some((item) => item.id === requestedSelectedId)
    ? requestedSelectedId
    : (templates.find((item) => item.isDefault)?.id || templates[0].id);

  return { selectedId, templates };
}

export function createDefaultOutreachTemplateLibrary() {
  return clone(DEFAULT_LIBRARY);
}

export function normalizeOutreachTemplateLibrary(value) {
  const source = value && typeof value === 'object' ? value : {};
  const channels = source.channels && typeof source.channels === 'object' ? source.channels : {};
  const defaults = createDefaultOutreachTemplateLibrary();
  return {
    version: 1,
    channels: {
      wechat: normalizeChannel(channels.wechat, defaults.channels.wechat),
      email: normalizeChannel(channels.email, defaults.channels.email),
      pgy: normalizeChannel(channels.pgy, defaults.channels.pgy)
    }
  };
}

export function loadOutreachTemplateLibrary(storage) {
  if (!storage?.getItem) return createDefaultOutreachTemplateLibrary();
  try {
    const raw = storage.getItem(OUTREACH_TEMPLATE_STORAGE_KEY);
    return raw ? normalizeOutreachTemplateLibrary(JSON.parse(raw)) : createDefaultOutreachTemplateLibrary();
  } catch (_) {
    return createDefaultOutreachTemplateLibrary();
  }
}

export function saveOutreachTemplateLibrary(storage, library) {
  const normalized = normalizeOutreachTemplateLibrary(library);
  if (storage?.setItem) storage.setItem(OUTREACH_TEMPLATE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getOutreachChannel(library, channelKey) {
  const normalized = normalizeOutreachTemplateLibrary(library);
  return normalized.channels[channelKey] || normalized.channels.wechat;
}

export function getSelectedOutreachTemplate(library, channelKey) {
  const channel = getOutreachChannel(library, channelKey);
  return channel.templates.find((item) => item.id === channel.selectedId)
    || channel.templates.find((item) => item.isDefault)
    || channel.templates[0];
}

export function resolveOutreachTemplateText(value, variables = {}) {
  return String(value ?? '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, key) => {
    const replacement = variables[String(key).trim()];
    return replacement === undefined || replacement === null || replacement === '' ? match : String(replacement);
  });
}

export function restoreOutreachVariable(value, literalValue, variableName) {
  const literal = String(literalValue ?? '').trim();
  if (!literal) return String(value ?? '');
  return String(value ?? '').split(literal).join(`{{${variableName}}}`);
}

export function createOutreachTemplateId(channelKey, now = Date.now()) {
  return `${cleanText(channelKey) || 'template'}-${Number(now) || Date.now()}`;
}

export function upsertOutreachTemplate(library, channelKey, template) {
  const normalized = normalizeOutreachTemplateLibrary(library);
  const channel = normalized.channels[channelKey];
  if (!channel) return normalized;
  const next = normalizeTemplate(template, {}, channel.templates.length);
  const index = channel.templates.findIndex((item) => item.id === next.id);
  if (index >= 0) channel.templates[index] = { ...channel.templates[index], ...next };
  else channel.templates.push(next);
  channel.selectedId = next.id;
  if (next.isDefault) channel.templates.forEach((item) => { item.isDefault = item.id === next.id; });
  return normalizeOutreachTemplateLibrary(normalized);
}

export function deleteOutreachTemplate(library, channelKey, templateId) {
  const normalized = normalizeOutreachTemplateLibrary(library);
  const channel = normalized.channels[channelKey];
  if (!channel || channel.templates.length <= 1) return { ok: false, library: normalized, reason: 'last_template' };
  const removed = channel.templates.find((item) => item.id === templateId);
  if (!removed) return { ok: false, library: normalized, reason: 'not_found' };
  channel.templates = channel.templates.filter((item) => item.id !== templateId);
  if (removed.isDefault) channel.templates[0].isDefault = true;
  if (!channel.templates.some((item) => item.id === channel.selectedId)) {
    channel.selectedId = channel.templates.find((item) => item.isDefault)?.id || channel.templates[0].id;
  }
  return { ok: true, library: normalizeOutreachTemplateLibrary(normalized), removed };
}

export function setDefaultOutreachTemplate(library, channelKey, templateId) {
  const normalized = normalizeOutreachTemplateLibrary(library);
  const channel = normalized.channels[channelKey];
  if (!channel || !channel.templates.some((item) => item.id === templateId)) return normalized;
  channel.templates.forEach((item) => { item.isDefault = item.id === templateId; });
  channel.selectedId = templateId;
  return normalizeOutreachTemplateLibrary(normalized);
}
