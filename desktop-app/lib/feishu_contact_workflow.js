const { exchangePluginToken } = require('./feishu_plugin_auth');
const { createFeishuMetadataReader, summarizeRequirements } = require('./feishu_project_metadata');
const { createFeishuContactReader } = require('./feishu_contact_reader');
const { platformDiagnostic } = require('./feishu_platform_diagnostic');

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function key(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }

function contactApplicationPatch(candidate, kind, row, provenance) {
  if (!['wechat', 'email', 'phone', 'unclassified'].includes(kind)) fail('FEISHU_CONTACT_INVALID');
  const field = ({ wechat: 'wechatId', email: 'email', phone: 'phone', unclassified: 'contactRaw' })[kind];
  if (!candidate || !field || !['wechat', 'email', 'phone', 'unclassified'].includes(candidate.kind)
    || (candidate.kind !== 'unclassified' && candidate.kind !== kind)
    || typeof candidate.value !== 'string' || !candidate.value.trim() || candidate.value.length > 4096
    || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(candidate.value)) fail('FEISHU_CONTACT_INVALID');
  if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.value)) fail('FEISHU_CONTACT_INVALID');
  if (kind === 'wechat' && !/^[A-Za-z0-9_-]{1,128}$/.test(candidate.value)) fail('FEISHU_CONTACT_INVALID');
  if (kind === 'phone' && !/^\+?[0-9][0-9 -]{5,25}$/.test(candidate.value)) fail('FEISHU_CONTACT_INVALID');
  if (!row || (row[field] != null && row[field] !== '' && row[field] !== candidate.value)) fail('FEISHU_LOCAL_CONFLICT');
  if (kind === 'unclassified') {
    if (!key(provenance?.projectKey) || !key(provenance?.workItemTypeKey)
      || typeof provenance.account !== 'string' || !provenance.account || provenance.account.length > 512
      || provenance.account !== provenance.account.trim() || /[\x00-\x1f]/.test(provenance.account)
      || !['number', 'string'].includes(typeof candidate.recordId)
      || (typeof candidate.recordId === 'number' && !Number.isSafeInteger(candidate.recordId))
      || !/^[1-9][0-9]{0,15}$/.test(String(candidate.recordId)) || typeof provenance.checkedAt !== 'string'
      || !Number.isFinite(Date.parse(provenance.checkedAt))) {
      fail('FEISHU_CONTACT_INVALID');
    }
    return { contactRaw: candidate.value, feishuAccountNumber: provenance.account,
      contactRawSource: row.contactRaw === candidate.value && row.contactRawSource
        ? row.contactRawSource : `飞书项目 / ${provenance.projectKey}/${provenance.workItemTypeKey} / ${candidate.recordId}`,
      contactRawCollectedAt: row.contactRaw === candidate.value && row.contactRawCollectedAt
        ? row.contactRawCollectedAt : provenance.checkedAt };
  }
  return { [field]: candidate.value, feishuAccountNumber: provenance.account,
    contactSource: `飞书项目 / ${candidate.recordId}`, contactCollectedAt: provenance.checkedAt };
}

// Resolve the already-confirmed business meanings against this target's live metadata.
function resolveContactMapping(fields, workItemTypeKey) {
  if (!Array.isArray(fields) || !key(workItemTypeKey)) fail('FEISHU_MAPPING_INVALID');
  const pick = (name, type) => {
    const matches = fields.filter(f => f?.field_name === name);
    if (matches.length !== 1 || matches[0].field_type_key !== type
        || !key(matches[0].field_key)) fail('FEISHU_MAPPING_INVALID');
    return matches[0];
  };
  const identity = pick('小红书ID', 'text');
  const platform = pick('平台', 'select');
  const contact = pick('联系方式', 'text');
  if (new Set([identity.field_key, platform.field_key, contact.field_key]).size !== 3) {
    fail('FEISHU_MAPPING_INVALID');
  }
  if (!Array.isArray(platform.options) || platform.options.length > 500) {
    fail('FEISHU_PLATFORM_OPTIONS_MISSING');
  }
  const options = platform.options.filter(o => o?.label === '小红书'
    && (!o.work_item_type_key || o.work_item_type_key === workItemTypeKey));
  if (options.length !== 1 || !key(options[0].value)
      || (options[0].is_disabled != null && options[0].is_disabled !== 2)) {
    fail('FEISHU_PLATFORM_OPTION_UNCONFIRMED');
  }
  return { identityConfirmed: true, platformOptionConfirmed: true, identityKind: 'xhs_account_number',
    identityField: identity.field_key, platformField: platform.field_key, contactField: contact.field_key,
    platformOptionId: options[0].value, platformLabel: '小红书' };
}

// This summary deliberately excludes account numbers, record IDs and contact values.
function summarizePreview(preview) {
  return { outcome: preview.status, candidateCount: preview.candidates.length,
    proposalCount: preview.proposals.length, identityVerified: preview.candidates.length > 0,
    legacyNewlineMatched: preview.candidates.some(c => c.identityVariant === 'trailing_lf'),
    manualTypeReview: preview.candidates.some(c => ['unclassified', 'unrecognized'].includes(c.kind)),
    remoteConflict: preview.status === 'conflict', localConflict: preview.status === 'local_conflict' };
}

// Local diagnostic only: a single credential exchange, metadata read and exact query.
async function runContactProbe(config, { fetchImpl = globalThis.fetch } = {}) {
  let stage = 'input';
  let authenticated = false;
  let metadata;
  const common = () => ({ authenticated, stage, metadataOk: !!metadata,
    ...(metadata ? { fieldCount: metadata.fields.length, fields: metadata.requirements,
      platformDiagnostic: platformDiagnostic(metadata.fields) } : {}) });
  try {
    if (!config || typeof config !== 'object' || !key(config.projectKey) || !key(config.workItemTypeKey)
        || typeof config.userKey !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(config.userKey)
        || typeof config.xhsAccountNumber !== 'string' || !config.xhsAccountNumber.trim()
        || config.xhsAccountNumber !== config.xhsAccountNumber.trim()
        || config.xhsAccountNumber.length > 512 || /[\x00-\x1f]/.test(config.xhsAccountNumber)) {
      fail('FEISHU_PROBE_INPUT_INVALID');
    }
    const { projectKey, workItemTypeKey, xhsAccountNumber, userKey } = config;
    const existing = { wechatId: config.existing?.wechatId, email: config.existing?.email };
    stage = 'auth';
    const auth = await exchangePluginToken({ pluginId: config.pluginId,
      pluginSecret: config.pluginSecret, fetchImpl });
    config.pluginSecret = '';
    authenticated = true;
    const getCredentials = async () => ({ kind: 'plugin', token: auth.token, userKey });
    try {
      stage = 'metadata';
      metadata = await createFeishuMetadataReader({ projectKey, workItemTypeKey, getCredentials, fetchImpl })
        .readMetadata();
      stage = 'mapping';
      const mapping = { ...resolveContactMapping(metadata.fields, workItemTypeKey),
        // One terminal LF was observed in a real legacy ID. Two exact values only, never fuzzy search.
        matchTrailingNewline: true };
      stage = 'search';
      const preview = await createFeishuContactReader({ projectKey, workItemTypeKey, getCredentials, fetchImpl })
        .preview({ mapping, fields: summarizeRequirements(metadata.fields),
          identityKind: 'xhs_account_number', identityValue: xhsAccountNumber, existing });
      stage = 'preview';
      return { ok: true, ...common(), preview, contactSummary: summarizePreview(preview) };
    } finally {
      auth.token = '';
    }
  } catch (error) {
    return { ok: false, ...common(),
      code: /^FEISHU_[A-Z_]{1,80}$/.test(error.code || '') ? error.code : 'FEISHU_PROBE_FAILED',
      ...(Number.isSafeInteger(error.status) ? { status: error.status } : {}),
      ...(Number.isSafeInteger(error.apiCode) ? { apiCode: error.apiCode } : {}) };
  } finally {
    if (config && typeof config === 'object') config.pluginSecret = '';
  }
}

module.exports = { resolveContactMapping, summarizePreview, runContactProbe, contactApplicationPatch };
