const crypto = require('crypto');
const { exchangePluginToken } = require('./feishu_plugin_auth');
const { createFeishuMetadataReader, summarizeRequirements } = require('./feishu_project_metadata');
const { createFeishuContactReader } = require('./feishu_contact_reader');
const { resolveContactMapping, contactApplicationPatch } = require('./feishu_contact_workflow');
const { creationIdentity, blocksCreation, duplicateQuery, reviewDuplicatePage, safeReviewDiagnostic } = require('./feishu_dedup');
const { quoteNames, quoteFieldValue } = require('./feishu_quotes');
const { archiveDeletedRecords } = require('./feishu_record_history');

function fail(code) { const e = new Error(code); e.code = code; throw e; }
// Only exact-ID detail callers may use this as absence proof, never write dispatch or search.
const isRecordMissing = error => error?.apiCode === 30005
  && (error.code === 'FEISHU_API_ERROR' || (error.code === 'FEISHU_HTTP_ERROR' && error.status === 400));
const key = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
const text = (s, max = 4096) => typeof s === 'string' && s.length <= max && !/[\x00-\x08\x0b-\x1f]/.test(s);
// Contact literals retain whitespace and TAB/LF/CRLF; other fields use the original strict validator.
const literalContactText = value => typeof value === 'string' && value.length <= 4096
  && (value === '' || value.trim().length > 0)
  && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(value) && !/\r(?!\n)/.test(value);
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
// JSON object order is not role configuration; retain array order and every value.
function canonicalRole(value) {
  if (Array.isArray(value)) return value.map(canonicalRole);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonicalRole(value[k])]));
  }
  return value;
}
const copy = v => JSON.parse(JSON.stringify(v));
const publicText = (value, max) => typeof value === 'string' && value.length <= max
  && value === value.trim() && !/[\x00-\x1f\x7f-\x9f]/.test(value) ? value : '';
const contactTimeNames = new Set(['建联时间', '建连时间', '建联日期', '建连日期']);
const editableNames = new Set(['账号昵称', '小红书ID', '联系方式', '平台', '达人资源来源',
  '后台链接', '平台链接', '其他备注', '所在城市', ...contactTimeNames, ...quoteNames]);
const testRecordMode = entry => entry.recordMode === undefined || entry.recordMode === 'test';
const enrichmentNames = new Set(['联系方式', '后台链接', '平台链接', '所在城市', ...quoteNames]);
const enrichmentRowStamp = row => hash([row.rowId, row.creatorUrl, row.xhsId, row.feishuAccountNumber,
  row.wechatId, row.email, row.phone, row.contactRaw, row.imagePrice, row.videoPrice,
  row.region, row.xhsProfileUrl, row.xhsProfileSourceCreatorUrl]);

function enrichmentBaseline(record, pairs) {
  return hash(pairs.map(p => {
    const matches = record.fields.filter(f => f.field_key === p.field_key);
    if (matches.length > 1) fail('FEISHU_READBACK_INVALID');
    const f = matches[0];
    return [p.field_key, f?.field_type_key || null, canonicalRole(f?.field_value ?? null)];
  }));
}

function enrichmentPairs(form, input, record) {
  const values = Object.fromEntries(form.filter(f => enrichmentNames.has(f.name))
    .filter(f => input?.[f.key] !== '' && input?.[f.key] != null).map(f => [f.key, input[f.key]]));
  const built = validateValues(form, values, { create: false });
  for (const p of built.pairs) {
    if (form.find(f => f.key === p.field_key)?.name !== '联系方式') continue;
    if (/^(待填|待补|待定|后台邀约|蒲公英邀约|暂无|无)$/.test(p.field_value.trim())) fail('FEISHU_CONTACT_REQUIRED');
    const before = record.fields.find(f => f.field_key === p.field_key)?.field_value;
    if (typeof before === 'string' && before && p.field_value !== before) {
      if (`\n${before}\n`.includes(`\n${p.field_value}\n`)) p.field_value = before;
      else if (!`\n${p.field_value}\n`.includes(`\n${before}\n`)) p.field_value = `${before}\n${p.field_value}`;
      if (!literalContactText(p.field_value)) fail('FEISHU_FIELDS_INVALID');
    }
  }
  return built.pairs.filter(p => {
    const before = record.fields.find(f => f.field_key === p.field_key)?.field_value;
    return JSON.stringify(before) !== JSON.stringify(p.field_value);
  });
}
function contactTimeField(fields, required) {
  const matches = fields.filter(f => contactTimeNames.has(f.name));
  if (!matches.length && !required) return null;
  if (matches.length !== 1 || matches[0].type !== 'date' || matches[0].key === 'name') fail('FEISHU_CONTACT_TIME_SCHEMA_UNSUPPORTED');
  return matches[0];
}
const cleanupReasons = new Set(['CREATE_ORIGIN_UNVERIFIED', 'INITIAL_WORKFLOW_UNVERIFIED',
  'FIELD_SCHEMA_UNVERIFIED', 'ROLE_DEFAULT_UNVERIFIED', 'FIELD_DEFAULT_UNVERIFIED']);
const cleanupOriginReasons = new Set(['CREATOR_MISSING', 'CREATOR_INVALID', 'CREATOR_MISMATCH',
  'UPDATER_MISSING', 'UPDATER_INVALID', 'UPDATER_MISMATCH', 'CREATED_AT_INVALID', 'UPDATED_AT_INVALID',
  'TIMESTAMPS_REVERSED', 'TIMESTAMPS_UNEQUAL']);
const connectionFields = ['pluginId', 'pluginSecret', 'projectKey', 'workItemTypeKey', 'userKey'];
const errorStages = new Set(['maintainer_search', 'maintainer_roles', 'connection_config',
  'connection_auth', 'connection_metadata', 'connection_storage']);
function invalidConnectionFields(config) {
  return connectionFields.filter(field => ['pluginId', 'projectKey', 'workItemTypeKey'].includes(field)
    ? !key(config?.[field]) : typeof config?.[field] !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(config[field]));
}
function connectionError(error, stage) {
  return Object.assign(new Error(), safeError(error), { stage });
}
function safeCleanupDiagnostic(entry) {
  if (entry?.cleanupBlocked !== true || !cleanupReasons.has(entry.cleanupDiagnostic)) return {};
  return { cleanupDiagnostic: entry.cleanupDiagnostic,
    ...(entry.cleanupDiagnostic === 'CREATE_ORIGIN_UNVERIFIED' && cleanupOriginReasons.has(entry.cleanupOriginDiagnostic)
      ? { cleanupOriginDiagnostic: entry.cleanupOriginDiagnostic } : {}) };
}

function safeError(error) {
  const knownUnknown = error?.code === 'FEISHU_ALREADY_SUBMITTED' && error?.status === 'unknown';
  const dedupReview = error?.code === 'FEISHU_DUPLICATE_REVIEW_REQUIRED' && safeReviewDiagnostic(error.dedupReview);
  const configFields = error?.code === 'FEISHU_CONFIG_INVALID' && error?.stage === 'connection_config'
    && Array.isArray(error.configFields) && error.configFields.length > 0 && error.configFields.length <= 5
    && error.configFields.every(field => connectionFields.includes(field))
    && new Set(error.configFields).size === error.configFields.length ? [...error.configFields] : null;
  return { ok: false, code: /^FEISHU_[A-Z_]{1,80}$/.test(error?.code || '')
    ? error.code : 'FEISHU_OPERATION_FAILED',
  ...(Number.isSafeInteger(error?.status) ? { status: error.status } : {}),
  ...(knownUnknown ? { status: 'unknown',
    ...(typeof error.entryId === 'string' && /^[a-f0-9-]{36}$/i.test(error.entryId) ? { entryId: error.entryId } : {}),
    ...(typeof error.recordId === 'string' && /^[1-9][0-9]{0,15}$/.test(error.recordId) ? { recordId: error.recordId } : {}),
    ...(publicText(error.maintainerName, 256) ? { maintainerName: error.maintainerName } : {}) } : {}),
  ...(error?.cleanupBlocked === true ? { cleanupBlocked: true } : {}),
  ...(error?.code === 'FEISHU_CLEANUP_BLOCKED' ? safeCleanupDiagnostic(error) : {}),
  ...(dedupReview ? { dedupReview } : {}),
  ...(Number.isSafeInteger(error?.apiCode) ? { apiCode: error.apiCode } : {}),
  ...(errorStages.has(error?.stage) ? { stage: error.stage } : {}),
  ...(configFields ? { configFields } : {}) };
}

function formFields(fields, type) {
  return fields.filter(f => editableNames.has(f.field_name)).map(f => ({
    key: f.field_key, name: f.field_name, type: f.field_type_key,
    required: f.is_required === 1,
    ...(contactTimeNames.has(f.field_name) ? { generated: 'contact_time' } : {}),
    options: Array.isArray(f.options) ? f.options.filter(o => key(o?.value)
      && text(o?.label, 256) && (!o.work_item_type_key || o.work_item_type_key === type)
      && (o.is_disabled == null || o.is_disabled === 2)).map(o => ({ value: o.value, label: o.label })) : []
  }));
}

function validateValues(fields, input, { create, titlePrefix = '' } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('FEISHU_FIELDS_INVALID');
  const byKey = new Map(fields.map(f => [f.key, f]));
  const pairs = [];
  let name = '';
  for (const [fieldKey, value] of Object.entries(input)) {
    const f = byKey.get(fieldKey);
    if (f && contactTimeNames.has(f.name)) {
      if (f.type !== 'date' || !Number.isSafeInteger(value) || value <= 0 || !create) fail('FEISHU_FIELDS_INVALID');
      pairs.push({ field_key: f.key, field_value: value });
      continue;
    }
    if (f && quoteNames.has(f.name)) {
      if (fields.filter(x => x.name === f.name).length !== 1) fail('FEISHU_QUOTE_SCHEMA_UNSUPPORTED');
      const quote = quoteFieldValue(f, value);
      if (quote != null) pairs.push({ field_key: f.key, field_value: quote });
      else if (!create) fail('FEISHU_CLEAR_UNSUPPORTED');
      continue;
    }
    const literalContact = f?.name === '联系方式' && f.type === 'text' && f.key !== 'name';
    if (!f || (literalContact ? !literalContactText(value) : !text(value) || value !== value.trim())) fail('FEISHU_FIELDS_INVALID');
    if (!value) {
      if (!create) fail('FEISHU_CLEAR_UNSUPPORTED');
      continue;
    }
    if (f.key === 'name') { name = value; continue; }
    if (!['text', 'link', 'select'].includes(f.type)) fail('FEISHU_FIELD_UNSUPPORTED');
    if (f.type === 'link') {
      let u;
      try { u = new URL(value); } catch (_) { fail('FEISHU_FIELDS_INVALID'); }
      if (u.protocol !== 'https:' || u.username || u.password
        || !['pgy.xiaohongshu.com', 'www.xiaohongshu.com'].includes(u.hostname)) fail('FEISHU_FIELDS_INVALID');
    }
    if (f.type === 'select' && !f.options.some(o => o.value === value)) fail('FEISHU_OPTION_INVALID');
    pairs.push({ field_key: f.key, field_value: f.type === 'select' ? { value } : value });
  }
  if (create) {
    if (!name) fail('FEISHU_REQUIRED_MISSING');
    for (const f of fields.filter(f => f.required && f.key !== 'name')) {
      if (!pairs.some(p => p.field_key === f.key)) fail('FEISHU_REQUIRED_MISSING');
    }
  }
  return { name: name ? titlePrefix + name : '', pairs };
}

// Official paths only. No cookies, redirects, unbounded bodies, transport logs or automatic retries.
async function request(url, credentials, method, body, fetchImpl, idem) {
  const controller = new AbortController();
  let timer;
  let bodyReader;
  const cancel = () => { bodyReader?.cancel().catch(() => {}); };
  controller.signal.addEventListener('abort', cancel, { once: true });
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error(), { code: 'FEISHU_REQUEST_TIMEOUT' })); }, 15000);
  });
  async function readJson(response, limit) {
    if (Number(response.headers.get('content-length')) > limit || !response.body?.getReader) fail('FEISHU_RESPONSE_INVALID');
    const reader = response.body.getReader();
    bodyReader = reader;
    if (controller.signal.aborted) fail('FEISHU_REQUEST_TIMEOUT');
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) fail('FEISHU_RESPONSE_TOO_LARGE');
        chunks.push(Buffer.from(value));
      }
    } finally { reader.cancel().catch(() => {}); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch (_) { fail('FEISHU_RESPONSE_INVALID'); }
  }
  const work = async () => {
    const r = await fetchImpl(url, { method, headers: {
      Accept: 'application/json', 'Content-Type': 'application/json',
      'X-PLUGIN-TOKEN': credentials.token, 'X-USER-KEY': credentials.userKey, 'x-auth-mode': '1',
      ...(idem ? { 'X-IDEM-UUID': idem } : {})
    }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
    redirect: 'manual', credentials: 'omit', cache: 'no-store' });
    if (r.redirected || (r.url && r.url !== url) || (r.status >= 300 && r.status < 400)) fail('FEISHU_REDIRECT_REJECTED');
    if (!Number.isInteger(r.status) || r.status < 200 || r.status >= 300) {
      const details = { code: 'FEISHU_HTTP_ERROR', status: r.status };
      // Retain only a numeric API code; a rejected request is never a successful envelope.
      try {
        const rejected = await readJson(r, 64 * 1024);
        if (Number.isSafeInteger(rejected?.err_code) && rejected.err_code !== 0) details.apiCode = rejected.err_code;
      } catch (_) { /* Unreadable error bodies do not replace the known HTTP failure. */ }
      throw Object.assign(new Error(), details);
    }
    const parsed = await readJson(r, 2 * 1024 * 1024);
    if (!Number.isSafeInteger(parsed?.err_code)) fail('FEISHU_RESPONSE_INVALID');
    if (parsed.err_code !== 0) throw Object.assign(new Error(), { code: 'FEISHU_API_ERROR', apiCode: parsed.err_code });
    if ((parsed.err_msg && parsed.err_msg !== '') || (parsed.err && Object.keys(parsed.err).length)) fail('FEISHU_RESPONSE_INVALID');
    return parsed;
  };
  try { return await Promise.race([work(), timeout]); }
  finally { clearTimeout(timer); controller.abort(); cancel(); }
}

async function operatorRequest(stage, ...args) {
  try { return await request(...args); }
  catch (error) { throw Object.assign(new Error(), safeError(error), { stage }); }
}

function recordStamp(record, version = 1) {
  if (version !== 1 && version !== 2) fail('FEISHU_READBACK_INVALID');
  if (!record || !Number.isSafeInteger(record.updated_at) || !Array.isArray(record.fields)) fail('FEISHU_READBACK_INVALID');
  const fields = record.fields.map(f => [f.field_key, f.field_type_key, f.field_value]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  if (new Set(fields.map(f => f[0])).size !== fields.length) fail('FEISHU_READBACK_INVALID');
  const value = [record.name, record.updated_at, record.updated_by, record.work_item_status, fields];
  return hash(version === 2 ? canonicalRole(value) : value);
}

// Only fresh manual DELETE reviews treat typed role assignments as unordered sets.
function manualCleanupStamp(record) {
  recordStamp(record, 2);
  const fields = record.fields.map(field => {
    if (field.field_type_key !== 'role_owners') return field;
    if (!Array.isArray(field.field_value)) fail('FEISHU_MANUAL_CLEANUP_UNVERIFIED');
    const roles = field.field_value.map(role => {
      if (!role || typeof role !== 'object' || Array.isArray(role) || !key(role.role)
        || (role.owners !== null && (!Array.isArray(role.owners) || !role.owners.every(key)
          || new Set(role.owners).size !== role.owners.length))) fail('FEISHU_MANUAL_CLEANUP_UNVERIFIED');
      return { ...role, owners: role.owners === null ? null : [...role.owners].sort() };
    });
    if (new Set(roles.map(role => role.role)).size !== roles.length) fail('FEISHU_MANUAL_CLEANUP_UNVERIFIED');
    roles.sort((a, b) => a.role.localeCompare(b.role));
    return { ...field, field_value: roles };
  });
  return recordStamp({ ...record, fields }, 2);
}

function checkPairs(record, pairs, name, expectedFieldTypes = {}, fields = []) {
  if (name && record.name !== name) fail('FEISHU_READBACK_MISMATCH');
  for (const p of pairs) {
    const generatedTime = contactTimeNames.has(fields.find(f => f.key === p.field_key)?.name);
    const mismatch = () => fail(generatedTime ? 'FEISHU_CONTACT_TIME_READBACK_MISMATCH' : 'FEISHU_READBACK_MISMATCH');
    const matches = record.fields?.filter(f => f.field_key === p.field_key) || [];
    if (matches.length !== 1) mismatch();
    const actual = matches[0].field_value;
    const hasType = Object.hasOwn(expectedFieldTypes, p.field_key);
    if (quoteNames.has(fields.find(f => f.key === p.field_key)?.name) && !hasType) fail('FEISHU_RECONCILE_UNCERTAIN');
    if (hasType && matches[0].field_type_key !== expectedFieldTypes[p.field_key]) {
      mismatch();
    }
    if (typeof p.field_value === 'number' && matches[0].field_type_key !== 'number'
      && !(expectedFieldTypes[p.field_key] === 'date' && matches[0].field_type_key === 'date'
        && contactTimeNames.has(fields.find(f => f.key === p.field_key)?.name))) fail('FEISHU_READBACK_MISMATCH');
    if (typeof p.field_value === 'object' ? actual?.value !== p.field_value.value : actual !== p.field_value) {
      mismatch();
    }
  }
}

function fieldTypes(fields, pairs) {
  return Object.fromEntries(pairs.map(p => [p.field_key, fields.find(f => f.key === p.field_key).type]));
}

// Preserve every non-written field (including all roles) and workflow state, not just the requested delta.
function untouchedStamp(record, pairs) {
  recordStamp(record);
  const written = new Set(pairs.map(p => p.field_key));
  const fields = record.fields.filter(f => !written.has(f.field_key))
    .map(f => [f.field_key, f.field_type_key, canonicalRole(f.field_value)])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return hash([record.name, canonicalRole(record.work_item_status), fields]);
}

function checkMutationBaseline(record, entry) {
  if (!entry.mutationBaseline?.untouchedStamp || !entry.mutationBaseline.actor) fail('FEISHU_RECONCILE_UNCERTAIN');
  if (record.updated_by !== entry.mutationBaseline.actor
    || untouchedStamp(record, entry.expectedPairs) !== entry.mutationBaseline.untouchedStamp) fail('FEISHU_REMOTE_CHANGED');
}

function checkMaintainer(record, expected) {
  if (!expected) return;
  const fields = record.fields?.filter(f => f.field_key === expected.fieldKey) || [];
  if (fields.length !== 1 || fields[0].field_type_key !== 'role_owners'
    || !Array.isArray(fields[0].field_value)) fail('FEISHU_MAINTAINER_READBACK_MISMATCH');
  const roles = fields[0].field_value.filter(r => r?.role === expected.role);
  if (roles.length !== 1 || !Array.isArray(roles[0].owners) || roles[0].owners.length !== 1
    || roles[0].owners[0] !== expected.owner) fail('FEISHU_MAINTAINER_READBACK_MISMATCH');
}

function validCreationDefault(type, value) {
  if (!['text', 'number', 'select', 'link'].includes(type)) return false;
  if (value === null) return true;
  if (type === 'text') return text(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'select') return value && typeof value === 'object' && !Array.isArray(value)
    && Object.hasOwn(value, 'value') && key(value.value)
    && Object.keys(value).every(k => ['value', 'label'].includes(k))
    && (!Object.hasOwn(value, 'label') || text(value.label, 256));
  if (!text(value) || /[\x00-\x1f]/.test(value)) return false;
  if (value === '') return true;
  try {
    const url = new URL(value);
    return value === value.trim() && url.protocol === 'https:' && !url.username && !url.password
      && ['pgy.xiaohongshu.com', 'www.xiaohongshu.com'].includes(url.hostname);
  } catch (_) { return false; }
}

function initialWorkflowIssues(record, actor) {
  if (!Object.hasOwn(record, 'work_item_status')) return ['STATUS_MISSING'];
  const status = record.work_item_status;
  if (!status || typeof status !== 'object' || Array.isArray(status)) return ['STATUS_SHAPE'];
  const issues = [];
  if (Object.keys(status).some(k => !['state_key', 'is_archived_state', 'is_init_state', 'updated_at', 'updated_by', 'history'].includes(k))) issues.push('STATUS_EXTRA_FIELDS');
  if (!key(status.state_key)) issues.push('STATE_KEY_INVALID');
  if (status.is_init_state !== true) issues.push(Object.hasOwn(status, 'is_init_state') ? 'NOT_INITIAL' : 'INITIAL_FLAG_MISSING');
  if (status.is_archived_state !== false) issues.push(Object.hasOwn(status, 'is_archived_state') ? 'ARCHIVED_OR_INVALID' : 'ARCHIVE_FLAG_MISSING');
  if (!Number.isSafeInteger(status.updated_at) || status.updated_at <= 0) issues.push('STATUS_TIME_INVALID');
  if (status.updated_by !== actor) issues.push(Object.hasOwn(status, 'updated_by') ? 'STATUS_ACTOR_MISMATCH' : 'STATUS_ACTOR_MISSING');
  if (Object.hasOwn(status, 'history') && status.history !== null && !Array.isArray(status.history)) issues.push('HISTORY_SHAPE');
  else if (Array.isArray(status.history) && status.history.length) issues.push('HISTORY_NONEMPTY');
  return issues;
}

function canBaselineCreate(record, plan, fields, actor) {
  const reject = reason => ({ allowed: false, reason });
  const rejectOrigin = originReason => ({ ...reject('CREATE_ORIGIN_UNVERIFIED'), originReason });
  // Missing origin is not inferred from the acknowledged ID or the current snapshot.
  if (record.created_by !== actor) return rejectOrigin(record.created_by == null ? 'CREATOR_MISSING'
    : typeof record.created_by !== 'string' || !record.created_by ? 'CREATOR_INVALID' : 'CREATOR_MISMATCH');
  if (record.updated_by !== actor) return rejectOrigin(record.updated_by == null ? 'UPDATER_MISSING'
    : typeof record.updated_by !== 'string' || !record.updated_by ? 'UPDATER_INVALID' : 'UPDATER_MISMATCH');
  if (!Number.isSafeInteger(record.created_at) || record.created_at <= 0) return rejectOrigin('CREATED_AT_INVALID');
  if (!Number.isSafeInteger(record.updated_at) || record.updated_at <= 0) return rejectOrigin('UPDATED_AT_INVALID');
  // Audit clocks are metadata, not proof of ownership or intervention.
  // Explicit API initial state is required; static metadata cannot predict creation audit values.
  // SDK shape: project-oapi-sdk-golang v1.0.29/service/workitem#WorkItemStatus.
  if (initialWorkflowIssues(record, actor).length) return reject('INITIAL_WORKFLOW_UNVERIFIED');
  return creationDefaults(record, plan, fields);
}

function creationDefaults(record, plan, fields) {
  const reject = reason => ({ allowed: false, reason });
  const same = (a, b) => JSON.stringify(canonicalRole(a)) === JSON.stringify(canonicalRole(b));
  const types = new Set(['text', 'number', 'select', 'link', 'role_owners', 'work_item_status', 'user', 'multi_user', 'date', 'bool']);
  const slots = { name: 'NAME', created_by: 'CREATOR', updated_by: 'UPDATER', created_at: 'CREATED_AT',
    updated_at: 'UPDATED_AT', work_item_status: 'WORKFLOW', work_item_id: 'ITEM_ID' };
  const empty = value => value === null || value === '';
  const written = new Set(plan.pairs.map(p => p.field_key));
  for (const [ordinal, field] of record.fields.entries()) {
    const metadata = fields.find(f => f.field_key === field.field_key);
    if (!metadata || metadata.field_type_key !== field.field_type_key || !Object.hasOwn(field, 'field_value')) return {
      ...reject('FIELD_SCHEMA_UNVERIFIED'), schema: { ordinal: ordinal + 1,
        slot: Object.hasOwn(slots, field.field_key) ? slots[field.field_key] : 'OTHER',
        metadataFound: !!metadata, valuePresent: Object.hasOwn(field, 'field_value'),
        actualType: types.has(field.field_type_key) ? field.field_type_key : 'OTHER',
        expectedType: types.has(metadata?.field_type_key) ? metadata.field_type_key : 'OTHER' }
    };
    if (written.has(field.field_key)) continue;
    if (field.field_key === 'name' && field.field_value === plan.name) continue;
    if (field.field_key === plan.maintainer.fieldKey) {
      const roles = field.field_value;
      if (!Array.isArray(roles) || roles.some(r => !key(r?.role))
        || new Set(roles.map(r => r.role)).size !== roles.length) return reject('ROLE_DEFAULT_UNVERIFIED');
      const defaults = Array.isArray(metadata.default_value) ? metadata.default_value : [];
      for (const role of roles) {
        if (!Object.hasOwn(role, 'owners') || (role.owners !== null && (!Array.isArray(role.owners)
          || role.owners.some(owner => !key(owner)) || new Set(role.owners).size !== role.owners.length))) return reject('ROLE_DEFAULT_UNVERIFIED');
        if (role.role === plan.maintainer.role) {
          if (!same(role, { role: plan.maintainer.role, owners: [plan.maintainer.owner] })) return reject('ROLE_DEFAULT_UNVERIFIED');
        } else if (role.owners === null || !role.owners.length) {
          if (Object.keys(role).some(k => !['role', 'owners'].includes(k))) return reject('ROLE_DEFAULT_UNVERIFIED');
        } else if (!defaults.some(expected => same(expected, role))) return reject('ROLE_DEFAULT_UNVERIFIED');
      }
      continue;
    }
    // Empty fields and explicit typed metadata defaults are initial server data, not observed rebases.
    if (!validCreationDefault(field.field_type_key, field.field_value)) return reject('FIELD_DEFAULT_UNVERIFIED');
    if (!empty(field.field_value) && (!Object.hasOwn(metadata, 'default_value')
      || !same(metadata.default_value, field.field_value))) return reject('FIELD_DEFAULT_UNVERIFIED');
  }
  return { allowed: true };
}

function createFeishuWorkbench({ getRow, loadJournal, saveJournal, connectionStore, maintainerStore, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let session = null;
  let busy = false;
  let generation = 0;
  const plans = new Map();
  const lookups = new Map();
  function clear() { generation++; if (session) session.token = ''; session = null; plans.clear(); lookups.clear(); }
  function active() {
    if (!session || now() >= session.expiresAt) { clear(); fail('FEISHU_SESSION_EXPIRED'); }
    return session;
  }
  function current(s) { if (active() !== s) fail('FEISHU_SESSION_EXPIRED'); }
  const targetKey = s => `${s.projectKey}/${s.workItemTypeKey}`;
  const choiceScope = s => hash([s.pluginId, s.projectKey, s.workItemTypeKey, s.userKey]);
  let rememberedChoice = null;
  function publicChoice(s) {
    return s?.choice ? { token: s.choice.token, name: s.choice.person.name, target: targetKey(s) } : null;
  }
  let autoRestoreAllowed = true;
  async function serial(fn, restore = true) {
    if (busy) return { ok: false, code: 'FEISHU_BUSY' };
    busy = true;
    try {
      if (restore && connectionStore && autoRestoreAllowed && (!session || now() >= session.expiresAt)) {
        await restoreInternal(false);
      }
      return await fn();
    } catch (e) { return safeError(e); } finally { busy = false; }
  }
  async function authenticate(config) {
    try {
      clear();
      const configFields = invalidConnectionFields(config);
      if (configFields.length) throw Object.assign(new Error(), { code: 'FEISHU_CONFIG_INVALID', stage: 'connection_config', configFields });
      const { projectKey, workItemTypeKey, userKey } = config;
      const epoch = generation;
      let auth;
      try { auth = await exchangePluginToken({ pluginId: config.pluginId, pluginSecret: config.pluginSecret, fetchImpl }); }
      catch (error) { throw connectionError(error, 'connection_auth'); }
      config.pluginSecret = '';
      try {
        const credentials = () => ({ kind: 'plugin', token: auth.token, userKey });
        let metadata;
        try { metadata = await createFeishuMetadataReader({ projectKey, workItemTypeKey, getCredentials: credentials, fetchImpl }).readMetadata(); }
        catch (error) { throw connectionError(error, 'connection_metadata'); }
        const mapping = { ...resolveContactMapping(metadata.fields, workItemTypeKey), matchTrailingNewline: true };
        if (generation !== epoch) fail('FEISHU_SESSION_EXPIRED');
        session = { pluginId: config.pluginId, projectKey, workItemTypeKey, userKey, token: auth.token,
          expiresAt: now() + Math.min(auth.expiresIn || auth.expireTime || 300, 1800) * 1000,
          fields: metadata.fields, mapping, form: formFields(metadata.fields, workItemTypeKey) };
        const scope = choiceScope(session);
        let person = rememberedChoice?.scope === scope ? rememberedChoice.person : null;
        try { person = maintainerStore?.read(scope) || person; }
        catch (_) { person = null; session.choiceNotice = 'FEISHU_SAVED_MAINTAINER_INVALID'; }
        if (person) session.choice = { token: rememberedChoice?.scope === scope
          && hash(rememberedChoice.person) === hash(person) ? rememberedChoice.token : crypto.randomUUID(), person: copy(person) };
        if (session.choice) rememberedChoice = { scope, person: copy(person), token: session.choice.token };
        return { ok: true, fields: session.form, fieldCount: metadata.fields.length, target: targetKey(session) };
      } catch (e) { auth.token = ''; throw e; }
    } finally { if (config) config.pluginSecret = ''; }
  }
  const publicConfig = c => c ? { pluginId: c.pluginId, projectKey: c.projectKey, workItemTypeKey: c.workItemTypeKey } : {};
  function connectedResult() {
    return { ok: true, connected: !!session && now() < session.expiresAt, busy: false,
      ...(session && now() < session.expiresAt ? { fields: session.form, fieldCount: session.fields.length, target: targetKey(session),
        maintainer: publicChoice(session), maintainerNotice: session.choiceNotice || '' } : {}) };
  }
  async function restoreInternal(manual) {
    const saved = connectionStore?.read();
    if (!saved) return { ...connectedResult(), saved: false, config: {} };
    try {
      if (!manual && (!autoRestoreAllowed || !saved.autoConnect)) return { ...connectedResult(), saved: true, config: publicConfig(saved.config) };
      if (!session || now() >= session.expiresAt || ['pluginId', 'projectKey', 'workItemTypeKey', 'userKey']
        .some(k => session[k] !== saved.config[k])) {
        autoRestoreAllowed = false;
        await authenticate({ ...saved.config });
      }
      if (manual && !saved.autoConnect) connectionStore.write(saved.config, true);
      autoRestoreAllowed = true;
      return { ...connectedResult(), saved: true, config: publicConfig(saved.config) };
    } finally {
      saved.config.pluginSecret = '';
    }
  }
  async function connect(config) {
    return serial(async () => {
      autoRestoreAllowed = false;
      // Clipboard boundary whitespace cannot be part of these ASCII credentials or keys.
      if (config && typeof config === 'object') {
        for (const field of connectionFields) if (typeof config[field] === 'string') config[field] = config[field].trim();
      }
      const savedConfig = connectionStore ? { pluginId: config?.pluginId, projectKey: config?.projectKey,
        workItemTypeKey: config?.workItemTypeKey, userKey: config?.userKey, pluginSecret: config?.pluginSecret } : null;
      try {
        const result = await authenticate(config);
        if (connectionStore) {
          try {
            if (config.rememberConnection !== false) connectionStore.write(savedConfig, true);
            else connectionStore.suspend();
          } catch (error) { throw connectionError(error, 'connection_storage'); }
        }
        autoRestoreAllowed = config.rememberConnection !== false;
        return { ...result, connected: true, saved: !!connectionStore && config.rememberConnection !== false,
          config: publicConfig(savedConfig), maintainer: publicChoice(session), maintainerNotice: session.choiceNotice || '' };
      } catch (error) { clear(); throw error; }
      finally { if (savedConfig) savedConfig.pluginSecret = ''; if (config) config.pluginSecret = ''; }
    }, false);
  }
  async function detail(s, id, { stamp = true } = {}) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('FEISHU_RECORD_INVALID');
    const r = await request(`https://project.feishu.cn/open_api/${s.projectKey}/work_item/${s.workItemTypeKey}/query`, s,
      'POST', { work_item_ids: [Number(id)] }, fetchImpl);
    if (!Array.isArray(r.data) || r.data.length !== 1) fail('FEISHU_READBACK_INVALID');
    const record = r.data[0];
    if (String(record.id) !== String(id) || record.project_key !== s.projectKey
      || record.work_item_type_key !== s.workItemTypeKey || record.deleted_at) fail('FEISHU_READBACK_INVALID');
    if (stamp) recordStamp(record);
    return record;
  }
  async function checkCreateDuplicate(s, candidate, local) {
    const matches = loadJournal().entries.filter(e => blocksCreation(e, candidate, s.mapping, local));
    const unknown = matches.find(e => e.status === 'unknown');
    if (unknown) throw Object.assign(new Error(), { code: 'FEISHU_ALREADY_SUBMITTED', status: 'unknown',
      entryId: unknown.entryId, recordId: unknown.recordId, maintainerName: unknown.maintainerName,
      cleanupBlocked: unknown.cleanupBlocked === true });
    for (const entry of matches.filter(e => e.status === 'verified')) {
      let record;
      try { record = await detail(s, entry.recordId); }
      catch (error) {
        if (!isRecordMissing(error)) throw error;
      }
      current(s);
      if (!record) continue;
      const reviewed = reviewDuplicatePage({ body: { err_code: 0, data: [record],
        pagination: { page_num: 1, page_size: 50, total: 1 } }, mapping: s.mapping, candidate,
        projectKey: s.projectKey, workItemTypeKey: s.workItemTypeKey, page: 1 });
      if (reviewed.duplicateIds.length) fail('FEISHU_ALREADY_SUBMITTED');
    }
    let page = 1, seen = [], total;
    while (page) {
      const query = duplicateQuery({ mapping: s.mapping, fields: s.form, candidate, page });
      const body = await request(`https://project.feishu.cn/open_api/${s.projectKey}/work_item/${s.workItemTypeKey}/search/params`,
        s, 'POST', query, fetchImpl);
      current(s);
      const reviewed = reviewDuplicatePage({ body, mapping: s.mapping, candidate,
        projectKey: s.projectKey, workItemTypeKey: s.workItemTypeKey, page, total, seen });
      if (reviewed.duplicateIds.length) fail('FEISHU_DUPLICATE_MAINTAINER');
      ({ seen, total } = reviewed);
      page = reviewed.nextPage;
    }
  }
  function checkEnrichmentIdentity(s, record, candidate) {
    if (!Array.isArray(record.fields)) fail('FEISHU_READBACK_INVALID');
    const value = k => {
      const fields = record.fields.filter(f => f.field_key === k);
      if (fields.length !== 1) fail('FEISHU_ENRICH_IDENTITY_CHANGED');
      return fields[0].field_value;
    };
    const account = value(s.mapping.identityField), roles = value(candidate.maintainer.fieldKey);
    const assigned = Array.isArray(roles) ? roles.filter(r => r?.role === candidate.maintainer.role) : [];
    if ((account !== candidate.identity && !(s.mapping.matchTrailingNewline && account === `${candidate.identity}\n`))
      || value(s.mapping.platformField)?.value !== candidate.platform || assigned.length !== 1
      || !Array.isArray(assigned[0].owners) || !assigned[0].owners.includes(candidate.maintainer.owner)) fail('FEISHU_ENRICH_IDENTITY_CHANGED');
    // AI test lifecycle remains separate even when it matches the same business identity.
    if (record.name?.startsWith('[AI测试]')) fail('FEISHU_ENRICH_TEST_RECORD');
  }
  async function enrichmentTarget(s, candidate, recordId) {
    if (recordId) {
      const record = await detail(s, recordId, { stamp: false }); current(s);
      checkEnrichmentIdentity(s, record, candidate); return record;
    }
    let page = 1, seen = [], total;
    const ids = [];
    while (page) {
      const response = await request(`https://project.feishu.cn/open_api/${s.projectKey}/work_item/${s.workItemTypeKey}/search/params`,
        s, 'POST', duplicateQuery({ mapping: s.mapping, fields: s.form, candidate, page }), fetchImpl);
      current(s);
      const scoped = { ...response, data: Array.isArray(response.data) ? response.data.map(record => ({ ...record,
        fields: Array.isArray(record.fields) ? record.fields.map(field => field.field_key === candidate.maintainer.fieldKey
          && Array.isArray(field.field_value) ? { ...field, field_value: field.field_value.filter(role => role?.role === candidate.maintainer.role) }
          : field) : record.fields })) : response.data };
      const result = reviewDuplicatePage({ body: scoped, mapping: s.mapping, candidate,
        projectKey: s.projectKey, workItemTypeKey: s.workItemTypeKey, page, seen, total });
      ids.push(...result.duplicateIds); ({ seen, total } = result); page = result.nextPage;
    }
    if (ids.length !== 1) fail(ids.length ? 'FEISHU_ENRICH_TARGET_AMBIGUOUS' : 'FEISHU_ENRICH_TARGET_MISSING');
    const record = await detail(s, ids[0], { stamp: false }); current(s);
    checkEnrichmentIdentity(s, record, candidate); return record;
  }
  function pendingEnrichment(s, recordId) {
    if (loadJournal().entries.some(e => e.target === targetKey(s) && e.recordId === recordId
      && e.status === 'unknown')) fail('FEISHU_ENRICH_PENDING');
  }
  async function searchPeople(s, query) {
    if (!text(query, 256) || !query || query !== query.trim() || /[\r\n\t]/.test(query)) fail('FEISHU_MAINTAINER_NAME_REQUIRED');
    const result = await operatorRequest('maintainer_search', 'https://project.feishu.cn/open_api/user/search', s,
      'POST', { project_key: s.projectKey, query }, fetchImpl);
    current(s);
    if (!Array.isArray(result.data) || result.data.length > 50) fail('FEISHU_MAINTAINER_RESULTS_INVALID');
    const people = result.data.filter(u => (u?.name_cn || u?.name?.default || u?.name_en) === query);
    if (people.some(u => !key(u.user_key)) || new Set(people.map(u => u.user_key)).size !== people.length) {
      fail('FEISHU_MAINTAINER_RESULTS_INVALID');
    }
    return people;
  }
  // The legacy IPC name is retained; the reviewed person is explicitly selected, never the API actor.
  async function readOperator(s, selected) {
    const fields = s.fields.filter(f => f.field_key === 'role_owners' && f.field_type_key === 'role_owners');
    if (fields.length !== 1) fail('FEISHU_MAINTAINER_ROLE_INVALID');
    const users = await searchPeople(s, selected.name);
    const matchesUser = users.filter(u => u.user_key === selected.userKey);
    if (matchesUser.length !== 1) fail('FEISHU_OPERATOR_INVALID');
    const user = matchesUser[0];
    if (user.status !== 'activated') fail('FEISHU_OPERATOR_INACTIVE');
    if ((user.username || '') !== selected.username) fail('FEISHU_OPERATOR_CHANGED');
    const name = user.name_cn || user.name?.default || user.name_en;
    if (!text(name, 256) || !name.trim() || /[\r\n\t]/.test(name)) fail('FEISHU_OPERATOR_INVALID');
    const result = await operatorRequest('maintainer_roles', `https://project.feishu.cn/open_api/${s.projectKey}/flow_roles/${s.workItemTypeKey}`,
      s, 'GET', undefined, fetchImpl);
    current(s);
    if (!Array.isArray(result.data) || result.data.length > 500) fail('FEISHU_MAINTAINER_ROLE_INVALID');
    const matches = result.data.filter(r => r?.name === '现维护经纪人');
    if (matches.length !== 1 || !key(matches[0].id)
      || result.data.filter(r => r?.id === matches[0].id).length !== 1) fail('FEISHU_MAINTAINER_ROLE_INVALID');
    const role = matches[0];
    return { name, userKey: user.user_key, username: user.username || '', expected: { fieldKey: fields[0].field_key, role: role.id, owner: user.user_key },
      stamp: hash([user.user_key, name, user.username || '', user.status, canonicalRole(role)]) };
  }
  function grantOperator(s, person) {
    const checkedAt = now();
    s.operator = { ...person, token: crypto.randomUUID(), expiresAt: checkedAt + 5 * 60 * 1000 };
    return { ok: true, token: s.operator.token, name: person.name, roleName: '现维护经纪人',
      choice: publicChoice(s), checkedAt: new Date(checkedAt).toISOString(),
      remainingLeaseMs: Math.max(0, Math.min(5 * 60 * 1000, s.operator.expiresAt - now())) };
  }
  function owned(s, journal, id) {
    const found = journal.entries.filter(e => e.target === targetKey(s) && e.recordId === String(id)
      && e.status === 'verified');
    if (found.length !== 1) fail('FEISHU_NOT_OWNED');
    if (!testRecordMode(found[0])) fail('FEISHU_PRODUCTION_RECORD_PROTECTED');
    if (found[0].cleanupBlocked === true) {
      throw Object.assign(new Error(), { code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: true, ...safeCleanupDiagnostic(found[0]) });
    }
    return found[0];
  }
  async function checkOwned(s, entry) {
    const r = await detail(s, entry.recordId);
    if (r.name !== entry.name || !r.name.startsWith(`[AI测试] ${entry.batch} `)
      || recordStamp(r, entry.stampVersion) !== entry.stamp) fail('FEISHU_REMOTE_CHANGED');
    return r;
  }
  function cleanupReviewEntry(s, journal, identity) {
    if (identity?.target !== targetKey(s) || typeof identity.entryId !== 'string'
      || !/^[a-f0-9-]{36}$/i.test(identity.entryId) || typeof identity.recordId !== 'string'
      || !/^[1-9][0-9]{0,15}$/.test(identity.recordId) || !Number.isSafeInteger(Number(identity.recordId))) fail('FEISHU_NOT_OWNED');
    const matches = journal.entries.filter(e => e.target === identity.target
      && (e.entryId === identity.entryId || e.recordId === identity.recordId));
    const entry = matches[0];
    if (entry && !testRecordMode(entry)) fail('FEISHU_PRODUCTION_RECORD_PROTECTED');
    if (matches.length !== 1 || entry.entryId !== identity.entryId || entry.recordId !== identity.recordId
      || entry.status !== 'verified' || entry.action !== 'create' || entry.cleanupBlocked !== true
      || !key(entry.batch) || !/^AI_TEST_[A-Za-z0-9_-]+$/.test(entry.batch)
      || !publicText(entry.name, 8192) || !entry.name.startsWith(`[AI测试] ${entry.batch} `)
      || entry.name.length <= `[AI测试] ${entry.batch} `.length || !entry.creationIdentity
      || entry.creationIdentity.target !== identity.target || !Array.isArray(entry.expectedPairs)
      || !entry.expectedPairs.length || !entry.expectedMaintainer) fail('FEISHU_NOT_OWNED');
    return entry;
  }
  async function cleanupReviewDetail(s, entry) {
    const record = await detail(s, entry.recordId);
    current(s);
    checkPairs(record, entry.expectedPairs, entry.name, entry.expectedFieldTypes, s.form);
    checkMaintainer(record, entry.expectedMaintainer);
    if (record.created_by !== s.userKey || initialWorkflowIssues(record, s.userKey).length) fail('FEISHU_MANUAL_CLEANUP_UNVERIFIED');
    recordStamp(record, 2);
    return record;
  }
  function remember(plan) {
    const token = crypto.randomUUID();
    for (const [oldToken, old] of plans) {
      const sameRow = ['create', 'enrich'].includes(plan.action) && ['create', 'enrich'].includes(old.action)
        && old.runDir === plan.runDir && old.rowId === plan.rowId;
      const sameEntry = plan.entryId && old.entryId === plan.entryId;
      if (old.expiresAt <= now() || sameRow || sameEntry) plans.delete(oldToken);
    }
    if (plans.size >= 50) plans.delete(plans.keys().next().value);
    const expiresAt = now() + 5 * 60 * 1000;
    plans.set(token, { ...copy(plan), expiresAt, generation });
    return { ok: true, token, expiresAt, ...copy(plan.preview) };
  }
  async function revokeConnection(storageMethod) {
    // Memory revocation must not depend on an idle writer or successful storage cleanup.
    autoRestoreAllowed = false;
    clear();
    const result = await serial(async () => {
      await connectionStore?.[storageMethod]();
      return { ok: true };
    }, false);
    return { ...result, sessionRevoked: true };
  }
  return Object.freeze({
    connect, clear,
    restoreConnection: payload => serial(async () => {
      try { return await restoreInternal(payload?.manual === true); }
      catch (error) { return { ...safeError(error), connected: false, saved: true }; }
    }, false),
    disconnect: () => revokeConnection('suspend'),
    forgetConnection: () => revokeConnection('forget'),
    status: () => serial(async () => connectedResult()),
    searchMaintainers: payload => serial(async () => {
      const s = active();
      plans.clear(); s.operator = null; s.people = null;
      const people = (await searchPeople(s, payload?.name)).filter(u => u.status === 'activated');
      if (!people.length) fail('FEISHU_OPERATOR_INVALID');
      const choices = people.map(u => ({ userKey: u.user_key, name: payload.name, username: u.username || '', token: crypto.randomUUID(),
        label: people.length === 1 ? payload.name : text(u.username, 128) && u.username.trim() && !/[\r\n\t]/.test(u.username)
          ? `${payload.name} (${u.username})` : '' }));
      if (choices.some(u => !u.label) || new Set(choices.map(u => u.label)).size !== choices.length) fail('FEISHU_MAINTAINER_AMBIGUOUS');
      s.people = { choices, expiresAt: now() + 5 * 60 * 1000 };
      return { ok: true, candidates: choices.map(({ token, label }) => ({ token, label })) };
    }),
    inspectOperator: payload => serial(async () => {
      const s = active();
      plans.clear(); s.operator = null;
      const selected = s.people?.expiresAt > now() && s.people.choices.find(u => u.token === payload?.candidateToken);
      if (!selected) fail('FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
      const operator = await readOperator(s, selected);
      current(s);
      const person = { name: operator.name, username: operator.username, userKey: operator.userKey, stamp: operator.stamp };
      const scope = choiceScope(s);
      maintainerStore?.write(scope, person);
      current(s);
      s.choice = { token: crypto.randomUUID(), person };
      rememberedChoice = { scope, person, token: s.choice.token };
      return grantOperator(s, operator);
    }),
    refreshOperator: payload => serial(async () => {
      const s = active(), choice = s.choice;
      plans.clear(); s.operator = null;
      if (!choice || payload?.choiceToken !== choice.token) fail('FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
      const person = await readOperator(s, choice.person);
      current(s);
      if (s.choice !== choice || person.stamp !== choice.person.stamp) fail('FEISHU_OPERATOR_CHANGED');
      return grantOperator(s, person);
    }),
    lookup: payload => serial(async () => {
      const s = active(); const epoch = generation;
      const row = await getRow(payload.runDir, payload.rowId);
      current(s);
      if (!row) fail('FEISHU_ROW_MISSING');
      const account = payload.accountNumber;
      if (!text(account, 512) || !account || account !== account.trim()) fail('FEISHU_IDENTITY_INVALID');
      const preview = await createFeishuContactReader({ ...s, getCredentials: async () => ({ kind: 'plugin', ...s }), fetchImpl })
        .preview({ mapping: s.mapping, fields: summarizeRequirements(s.fields), identityKind: 'xhs_account_number',
          identityValue: account, existing: { wechatId: row.wechatId, email: row.email } });
      if (generation !== epoch) fail('FEISHU_SESSION_EXPIRED');
      current(s);
      const token = crypto.randomUUID();
      // Keep independent row previews for a bounded batch; a new read invalidates only that row.
      for (const [oldToken, old] of lookups) {
        if (now() - old.at > 5 * 60 * 1000 || (old.runDir === payload.runDir && old.rowId === payload.rowId)) lookups.delete(oldToken);
      }
      if (lookups.size >= 50) lookups.delete(lookups.keys().next().value);
      lookups.set(token, { runDir: payload.runDir, rowId: payload.rowId, account, preview, at: now(),
        identity: hash([row.creatorUrl, row.creatorName, row.xhsId, row.feishuAccountNumber]) });
      return { ok: true, token, preview, checkedAt: new Date(now()).toISOString() };
    }),
    // Human-selected contact only, with a fresh local conflict check. No remote mutation.
    applyContact: payload => serial(async () => {
      const s = active();
      const l = lookups.get(payload.token);
      if (!l || l.runDir !== payload.runDir || l.rowId !== payload.rowId || now() - l.at > 5 * 60 * 1000) fail('FEISHU_PREVIEW_EXPIRED');
      const c = l.preview.candidates.find(c => String(c.recordId) === String(payload.recordId));
      if (!c) fail('FEISHU_CONTACT_INVALID');
      const row = await getRow(l.runDir, l.rowId);
      current(s);
      if (lookups.get(payload.token) !== l || now() - l.at > 5 * 60 * 1000) fail('FEISHU_PREVIEW_EXPIRED');
      if (row && l.identity !== hash([row.creatorUrl, row.creatorName, row.xhsId, row.feishuAccountNumber])) fail('FEISHU_LOCAL_CHANGED');
      const patch = contactApplicationPatch(c, payload.kind, row, { account: l.account, projectKey: s.projectKey,
        workItemTypeKey: s.workItemTypeKey, checkedAt: new Date(l.at).toISOString() });
      lookups.delete(payload.token);
      return { ok: true, patch };
    }),
    listRecords: () => serial(async () => {
      const s = active();
      const j = loadJournal();
      return { ok: true, records: j.entries.filter(e => e.target === targetKey(s)).map(e => ({
        entryId: e.entryId, recordId: e.recordId || '', name: e.name, batch: e.batch, status: e.status,
        recordMode: e.recordMode || 'test',
        runDir: e.runDir, rowId: e.rowId, code: e.code || '', target: e.target,
        accountNumber: e.creationIdentity?.target === e.target ? publicText(e.creationIdentity.identity, 512) : '',
        maintainerName: publicText(e.maintainerName, 256), cleanupBlocked: e.cleanupBlocked === true,
        hiddenFromPicker: e.hiddenFromPicker === true,
        ...safeCleanupDiagnostic(e),
        externalAbsenceVerified: e.externalAbsenceVerified === true
      })) };
    }),
    archiveDeletedRecords: payload => serial(async () => {
      const s = active();
      if (payload?.target !== targetKey(s) || payload?.confirmed !== true) fail('FEISHU_HISTORY_ARCHIVE_INVALID');
      const result = archiveDeletedRecords(loadJournal(), { target: targetKey(s), entryIds: payload.entryIds });
      current(s);
      plans.clear();
      if (result.count) saveJournal(result.journal);
      return { ok: true, target: targetKey(s), count: result.count };
    }),
    prepareManualCleanup: payload => serial(async () => {
      const s = active(), epoch = generation;
      if (payload?.safetyConfirmed !== true) fail('FEISHU_WRITE_SAFETY_REQUIRED');
      const original = copy(cleanupReviewEntry(s, loadJournal(), payload));
      const record = await cleanupReviewDetail(s, original);
      if (generation !== epoch) fail('FEISHU_SESSION_EXPIRED');
      if (hash(cleanupReviewEntry(s, loadJournal(), payload)) !== hash(original)) fail('FEISHU_LOCAL_CHANGED');
      let total = 0;
      if (record.fields.length > 300) fail('FEISHU_MANUAL_CLEANUP_UNVERIFIED');
      const fields = record.fields.map((f, index) => {
        const value = Object.hasOwn(f, 'field_value') ? JSON.stringify(f.field_value) : '(未返回)';
        if (typeof value !== 'string' || value.length > 8192 || (total += value.length) > 65536) fail('FEISHU_MANUAL_CLEANUP_UNVERIFIED');
        const name = s.fields.find(m => m.field_key === f.field_key)?.field_name;
        return { label: publicText(name, 256) || `字段 ${index + 1}`, displayValue: value };
      });
      return remember({ action: 'delete', manualCleanup: true, target: targetKey(s),
        entryId: original.entryId, entryHash: hash(original), recordId: original.recordId, stamp: manualCleanupStamp(record),
        preview: { action: 'delete', manualCleanup: true, entryId: original.entryId,
          recordId: original.recordId, name: original.name, batch: original.batch, target: original.target,
          maintainer: { name: original.maintainerName, roleName: '现维护经纪人' }, reviewFields: fields,
          updaterChanged: record.updated_by !== s.userKey } });
    }),
    verifyOwnedAbsence: payload => serial(async () => {
      const s = active(), epoch = generation;
      const { entryId, recordId, target } = payload || {};
      const inspectCurrent = payload?.inspectCurrent === true;
      if (target !== targetKey(s) || typeof entryId !== 'string'
        || !/^[a-f0-9-]{36}$/i.test(entryId) || typeof recordId !== 'string'
        || !/^[1-9][0-9]{0,15}$/.test(recordId) || !Number.isSafeInteger(Number(recordId))) fail('FEISHU_NOT_OWNED');
      const knownEntry = journal => {
        const matches = journal.entries.filter(e => e.target === target
          && (e.entryId === entryId || e.recordId === recordId));
        const entry = matches[0];
        if (entry && !testRecordMode(entry)) fail('FEISHU_PRODUCTION_RECORD_PROTECTED');
        if (matches.length !== 1 || entry.entryId !== entryId || entry.recordId !== recordId
          || entry.status !== 'verified' || !key(entry.batch) || !/^AI_TEST_[A-Za-z0-9_-]+$/.test(entry.batch)
          || !publicText(entry.name, 8192) || !entry.name.startsWith(`[AI测试] ${entry.batch} `)
          || entry.name.length <= `[AI测试] ${entry.batch} `.length) fail('FEISHU_NOT_OWNED');
        return entry;
      };
      const original = knownEntry(copy(loadJournal()));
      let absent = false, currentInspection;
      try {
        const record = await detail(s, recordId);
        if (inspectCurrent && original.action === 'create' && original.cleanupBlocked === true
          && Array.isArray(original.expectedPairs) && original.expectedMaintainer) {
          checkPairs(record, original.expectedPairs, original.name, original.expectedFieldTypes, s.form);
          checkMaintainer(record, original.expectedMaintainer);
          const assessment = canBaselineCreate(record, { pairs: original.expectedPairs, name: original.name,
            maintainer: original.expectedMaintainer }, s.fields, s.userKey);
          currentInspection = assessment.allowed ? { matches: true } : { matches: false, ...safeCleanupDiagnostic({
            cleanupBlocked: true, cleanupDiagnostic: assessment.reason, cleanupOriginDiagnostic: assessment.originReason }) };
          currentInspection.workflowIssues = initialWorkflowIssues(record, s.userKey);
          const defaults = creationDefaults(record, { pairs: original.expectedPairs, name: original.name,
            maintainer: original.expectedMaintainer }, s.fields);
          currentInspection.defaults = defaults.allowed ? { matches: true } : { matches: false,
            ...safeCleanupDiagnostic({ cleanupBlocked: true, cleanupDiagnostic: defaults.reason }),
            ...(defaults.schema ? { schema: defaults.schema } : {}) };
        }
      }
      catch (error) {
        current(s);
        if (generation !== epoch) fail('FEISHU_SESSION_EXPIRED');
        if (!isRecordMissing(error)) throw error;
        absent = true;
      }
      current(s);
      if (generation !== epoch) fail('FEISHU_SESSION_EXPIRED');
      // Keep shared loader references untouched on save failure and retain unrelated concurrent entries.
      const journal = copy(loadJournal()), entry = knownEntry(journal);
      if (hash(entry) !== hash(original)) fail('FEISHU_LOCAL_CHANGED');
      if (absent) {
        entry.status = 'deleted';
        entry.externalAbsenceVerified = true;
        saveJournal(journal);
      }
      return { ok: true, entryId, recordId, target, exists: !absent,
        status: entry.status, externalAbsenceVerified: entry.externalAbsenceVerified === true,
        ...(currentInspection ? { currentInspection } : {}) };
    }),
    prepare: payload => serial(async () => {
      const s = active();
      const action = payload.action;
      if (!['create', 'update', 'delete', 'enrich'].includes(action)) fail('FEISHU_ACTION_INVALID');
      const journal = loadJournal();
      if (action === 'enrich') {
        const operator = s.operator;
        if (!operator || operator.expiresAt <= now() || payload.operatorToken !== operator.token
          || payload.operatorConfirmed !== true) fail('FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
        const row = await getRow(payload.runDir, payload.rowId); current(s);
        if (!row) fail('FEISHU_ROW_MISSING');
        const identityFields = s.form.filter(f => [s.mapping.identityField, s.mapping.platformField].includes(f.key));
        const built = validateValues(identityFields, Object.fromEntries(identityFields.map(f => [f.key, payload.values?.[f.key]])), { create: false });
        const candidate = creationIdentity({ target: targetKey(s), mapping: s.mapping, pairs: built.pairs, maintainer: operator.expected });
        const fresh = await readOperator(s, operator); current(s);
        if (fresh.stamp !== operator.stamp || s.operator !== operator) fail('FEISHU_OPERATOR_CHANGED');
        const record = await enrichmentTarget(s, candidate, payload.recordId);
        pendingEnrichment(s, String(record.id));
        const pairs = enrichmentPairs(s.form, payload.values, record);
        if (!pairs.length) return { ok: true, action, noChanges: true, recordId: String(record.id), name: record.name, fields: [] };
        const latest = await getRow(payload.runDir, payload.rowId); current(s);
        if (!latest || enrichmentRowStamp(latest) !== enrichmentRowStamp(row)) fail('FEISHU_LOCAL_CHANGED');
        const entryId = crypto.randomUUID();
        return remember({ action, entryId, target: targetKey(s), recordId: String(record.id), runDir: payload.runDir, rowId: payload.rowId,
          rowStamp: enrichmentRowStamp(row), candidate, pairs, baseline: enrichmentBaseline(record, pairs),
          expectedFieldTypes: fieldTypes(s.form, pairs), operatorToken: operator.token, operatorStamp: operator.stamp,
          preview: { action, entryId, recordId: String(record.id), name: record.name, target: targetKey(s),
            maintainer: { name: operator.name, roleName: '现维护经纪人' },
            fields: pairs.map(p => ({ ...p, before: record.fields.find(f => f.field_key === p.field_key)?.field_value ?? '' })) } });
      }
      if (action === 'create') {
        const recordMode = payload.recordMode === undefined ? 'test' : payload.recordMode;
        if (!['test', 'production'].includes(recordMode)) fail('FEISHU_RECORD_MODE_INVALID');
        const deferWriteConfirmation = payload.deferWriteConfirmation === true;
        if (!deferWriteConfirmation && payload.safetyConfirmed !== true) fail('FEISHU_WRITE_SAFETY_REQUIRED');
        const operator = s.operator;
        if (!operator || operator.expiresAt <= now() || payload.operatorToken !== operator.token
          || payload.operatorConfirmed !== true) fail('FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
        const row = await getRow(payload.runDir, payload.rowId);
        current(s);
        if (!row) fail('FEISHU_ROW_MISSING');
        const batch = `${recordMode === 'test' ? 'AI_TEST' : 'SYNC'}_${new Date(now()).toISOString().slice(0, 10).replace(/-/g, '')}_${crypto.randomBytes(4).toString('hex')}`;
        const timeField = contactTimeField(s.form, recordMode === 'production');
        const input = { ...payload.values, ...(timeField ? { [timeField.key]: Math.floor(now() / 1000) * 1000 } : {}) };
        if (recordMode === 'production' && !input[s.mapping.contactField]
          && s.fields.find(f => f.field_key === s.mapping.contactField)?.is_required !== 2) fail('FEISHU_CONTACT_REQUIRED_BY_PROJECT');
        const built = validateValues(s.form, input, { create: true, titlePrefix: recordMode === 'test' ? `[AI测试] ${batch} ` : '' });
        const identity = built.pairs.find(p => p.field_key === s.mapping.identityField)?.field_value;
        if (!text(identity, 512) || !identity || /[\x00-\x1f]/.test(identity)
          || !built.pairs.some(p => p.field_key === s.mapping.platformField && p.field_value.value === s.mapping.platformOptionId)) fail('FEISHU_IDENTITY_INVALID');
        const contact = built.pairs.find(p => p.field_key === s.mapping.contactField)?.field_value;
        if ((recordMode === 'test' && (typeof contact !== 'string' || !contact))
          || (typeof contact === 'string' && /^(待填|待补|待定|后台邀约|蒲公英邀约|暂无|无)$/.test(contact.trim()))) fail('FEISHU_CONTACT_REQUIRED');
        const fresh = await readOperator(s, operator);
        current(s);
        if (fresh.stamp !== operator.stamp || s.operator !== operator) fail('FEISHU_OPERATOR_CHANGED');
        const supported = new Set([...s.form.map(f => f.key), operator.expected.fieldKey]);
        if (s.fields.some(f => f.is_required === 1 && !supported.has(f.field_key))) fail('FEISHU_REQUIRED_UNSUPPORTED');
        const candidate = creationIdentity({ target: targetKey(s), mapping: s.mapping,
          pairs: built.pairs, maintainer: operator.expected });
        await checkCreateDuplicate(s, candidate, payload);
        const latestRow = await getRow(payload.runDir, payload.rowId);
        current(s);
        if (!latestRow || hash(latestRow) !== hash(row)) fail('FEISHU_LOCAL_CHANGED');
        if (s.operator !== operator || operator.expiresAt <= now()) fail('FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
        return remember({ action, deferWriteConfirmation, target: targetKey(s), runDir: payload.runDir, rowId: payload.rowId,
          rowStamp: hash(row), businessKey: candidate.businessKey, recordMode, timeField, batch, name: built.name, pairs: built.pairs,
          expectedFieldTypes: fieldTypes(s.form, built.pairs),
          operatorToken: operator.token, operatorStamp: operator.stamp, maintainer: operator.expected,
          preview: { action, recordMode, name: built.name, batch, fields: built.pairs, target: targetKey(s),
            ...(timeField ? { contactTime: { fieldKey: timeField.key, label: timeField.name, generatedAtSubmission: true } } : {}),
            maintainer: { name: operator.name, roleName: '现维护经纪人' } } });
      }
      const entry = owned(s, journal, payload.recordId);
      const record = await checkOwned(s, entry);
      current(s);
      if (action === 'delete') {
        if (payload.safetyConfirmed !== true) fail('FEISHU_WRITE_SAFETY_REQUIRED');
        return remember({ action, target: targetKey(s), entryId: entry.entryId, stamp: recordStamp(record, 2),
          preview: { action, recordId: entry.recordId, name: entry.name, batch: entry.batch, target: entry.target } });
      }
      const built = validateValues(s.form, payload.values, { create: false });
      if (built.name || !built.pairs.length || built.pairs.some(p => [s.mapping.identityField, s.mapping.platformField].includes(p.field_key))) fail('FEISHU_FIELDS_INVALID');
      const changes = built.pairs.map(p => ({ ...p, before: record.fields.find(f => f.field_key === p.field_key)?.field_value }));
      return remember({ action, target: targetKey(s), entryId: entry.entryId, stamp: recordStamp(record, 2), pairs: built.pairs,
        expectedFieldTypes: fieldTypes(s.form, built.pairs),
        preview: { action, recordId: entry.recordId, name: entry.name, fields: changes, target: entry.target } });
    }),
    execute: payload => serial(async () => {
      const s = active();
      const plan = plans.get(payload.token);
      plans.delete(payload.token);
      if (!plan || plan.expiresAt <= now() || plan.generation !== generation
        || plan.target !== targetKey(s) || payload.confirmed !== true) fail('FEISHU_CONFIRMATION_REQUIRED');
      if (plan.manualCleanup && (plan.action !== 'delete' || payload.manualCleanupConfirmed !== true
        || payload.reviewedRecordId !== plan.recordId)) fail('FEISHU_CONFIRMATION_REQUIRED');
      if (plan.action === 'create' && plan.deferWriteConfirmation === true && payload.safetyConfirmed !== true) {
        fail('FEISHU_WRITE_SAFETY_REQUIRED');
      }
      const journal = loadJournal();
      let entry;
      if (plan.action === 'create') {
        if (!s.operator || s.operator.expiresAt <= now() || s.operator.token !== plan.operatorToken) {
          fail('FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
        }
        const fresh = await readOperator(s, s.operator);
        current(s);
        if (fresh.stamp !== plan.operatorStamp) fail('FEISHU_OPERATOR_CHANGED');
        const row = await getRow(plan.runDir, plan.rowId);
        current(s);
        if (!row || hash(row) !== plan.rowStamp) fail('FEISHU_LOCAL_CHANGED');
        const candidate = creationIdentity({ target: targetKey(s), mapping: s.mapping,
          pairs: plan.pairs, maintainer: plan.maintainer });
        await checkCreateDuplicate(s, candidate, plan);
        const latestRow = await getRow(plan.runDir, plan.rowId);
        current(s);
        if (!latestRow || hash(latestRow) !== plan.rowStamp) fail('FEISHU_LOCAL_CHANGED');
        if (!s.operator || s.operator.token !== plan.operatorToken || s.operator.expiresAt <= now()
          || plan.expiresAt <= now()) fail('FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
        if (plan.timeField) {
          plan.pairs = plan.pairs.map(p => p.field_key === plan.timeField.key ? { ...p, field_value: Math.floor(now() / 1000) * 1000 } : p);
        }
        entry = { entryId: crypto.randomUUID(), target: plan.target, runDir: plan.runDir, rowId: plan.rowId,
          recordMode: plan.recordMode,
          businessKey: candidate.businessKey, batch: plan.batch, name: plan.name, status: 'unknown', action: 'create', expectedPairs: plan.pairs,
          creationIdentity: copy(candidate), maintainerName: publicText(plan.preview.maintainer.name, 256),
          expectedFieldTypes: plan.expectedFieldTypes, cleanupBlocked: false, expectedMaintainer: plan.maintainer };
        journal.entries.push(entry);
      } else if (plan.action === 'enrich') {
        if (payload.safetyConfirmed !== true) fail('FEISHU_WRITE_SAFETY_REQUIRED');
        if (!s.operator || s.operator.token !== plan.operatorToken) fail('FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
        const fresh = await readOperator(s, s.operator); current(s);
        if (fresh.stamp !== plan.operatorStamp) fail('FEISHU_OPERATOR_CHANGED');
        const row = await getRow(plan.runDir, plan.rowId); current(s);
        if (!row || enrichmentRowStamp(row) !== plan.rowStamp) fail('FEISHU_LOCAL_CHANGED');
        pendingEnrichment(s, plan.recordId);
        const latest = await getRow(plan.runDir, plan.rowId); current(s);
        if (!latest || enrichmentRowStamp(latest) !== plan.rowStamp) fail('FEISHU_LOCAL_CHANGED');
        // Keep both local source checks; cloud comparison is the final asynchronous read.
        const record = await detail(s, plan.recordId, { stamp: false }); current(s);
        checkEnrichmentIdentity(s, record, plan.candidate);
        if (enrichmentBaseline(record, plan.pairs) !== plan.baseline) fail('FEISHU_ENRICH_FIELDS_CHANGED');
        if (plan.expiresAt <= now()) fail('FEISHU_CONFIRMATION_REQUIRED');
        entry = { entryId: plan.entryId, target: plan.target, recordId: plan.recordId, runDir: plan.runDir, rowId: plan.rowId,
          recordMode: 'production', action: 'enrich', status: 'unknown', name: record.name, batch: '',
          creationIdentity: copy(plan.candidate), businessKey: plan.candidate.businessKey,
          maintainerName: publicText(s.operator.name, 256), expectedPairs: plan.pairs,
          expectedFieldTypes: plan.expectedFieldTypes, cleanupBlocked: false };
        journal.entries.push(entry);
      } else {
        entry = journal.entries.find(e => e.entryId === plan.entryId);
        const identity = { entryId: plan.entryId, recordId: plan.recordId, target: plan.target };
        if (!entry || (plan.manualCleanup ? cleanupReviewEntry(s, journal, identity) : owned(s, journal, entry.recordId)) !== entry) fail('FEISHU_NOT_OWNED');
        if (plan.manualCleanup && hash(entry) !== plan.entryHash) fail('FEISHU_LOCAL_CHANGED');
        const record = plan.manualCleanup ? await cleanupReviewDetail(s, entry) : await checkOwned(s, entry);
        current(s);
        if (plan.expiresAt <= now()) fail('FEISHU_CONFIRMATION_REQUIRED');
        if ((plan.manualCleanup ? manualCleanupStamp(record) : recordStamp(record, 2)) !== plan.stamp) fail('FEISHU_REMOTE_CHANGED');
        if (plan.manualCleanup && hash(cleanupReviewEntry(s, loadJournal(), identity)) !== plan.entryHash) fail('FEISHU_LOCAL_CHANGED');
        if (!entry.creationIdentity && entry.action === 'create') {
          entry.creationIdentity = creationIdentity({ target: entry.target, mapping: s.mapping,
            pairs: entry.expectedPairs, maintainer: entry.expectedMaintainer });
        }
        if (plan.manualCleanup) entry.cleanupReview = { checkedAt: new Date(now()).toISOString(), stamp: plan.stamp };
        else entry.mutationBaseline = { actor: s.userKey, untouchedStamp: untouchedStamp(record, plan.pairs || []) };
        entry.status = 'unknown'; entry.action = plan.action;
        entry.expectedPairs = plan.pairs || [];
        entry.expectedFieldTypes = plan.expectedFieldTypes || {};
      }
      // Durable unknown state precedes dispatch. A crash/timeout cannot silently retry a write.
      saveJournal(journal);
      try {
        current(s);
        if (plan.expiresAt <= now()) fail('FEISHU_CONFIRMATION_REQUIRED');
        if (plan.action === 'create' && (!s.operator || s.operator.token !== plan.operatorToken
          || s.operator.expiresAt <= now())) fail('FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
        const base = `https://project.feishu.cn/open_api/${s.projectKey}/work_item`;
        if (plan.action === 'create') {
          const r = await request(`${base}/create`, s, 'POST', { work_item_type_key: s.workItemTypeKey,
            name: plan.name, field_value_pairs: [...plan.pairs, { field_key: plan.maintainer.fieldKey,
              field_value: [{ role: plan.maintainer.role, owners: [plan.maintainer.owner] }] }],
            required_mode: 1, role_mode: 1 }, fetchImpl, entry.entryId);
          if (!Number.isSafeInteger(r.data) || r.data < 1) fail('FEISHU_READBACK_INVALID');
          entry.recordId = String(r.data);
          saveJournal(journal);
        } else {
          await request(`${base}/${s.workItemTypeKey}/${entry.recordId}`, s, plan.action === 'delete' ? 'DELETE' : 'PUT',
            plan.action === 'delete' ? undefined : { update_fields: plan.pairs }, fetchImpl, entry.entryId);
        }
        if (plan.action === 'delete') {
          try {
            await detail(s, entry.recordId);
            fail('FEISHU_DELETE_UNVERIFIED');
          } catch (e) {
            // Only documented not-found proves cleanup; permission/network failure does not.
            if (!isRecordMissing(e)) throw e;
          }
          entry.status = 'deleted';
        } else {
          const record = await detail(s, entry.recordId, { stamp: plan.action !== 'enrich' });
          if (plan.action === 'enrich') checkEnrichmentIdentity(s, record, plan.candidate);
          if (plan.action === 'update') checkMutationBaseline(record, entry);
          checkPairs(record, plan.pairs, plan.action === 'enrich' ? '' : entry.name, entry.expectedFieldTypes, s.form);
          checkMaintainer(record, entry.expectedMaintainer);
          if (plan.action === 'create' && plan.recordMode !== 'production') {
            const assessment = canBaselineCreate(record, plan, s.fields, s.userKey);
            entry.cleanupBlocked = !assessment.allowed;
            if (!assessment.allowed) {
              entry.cleanupDiagnostic = assessment.reason;
              if (cleanupOriginReasons.has(assessment.originReason)) entry.cleanupOriginDiagnostic = assessment.originReason;
            }
          }
          if (!entry.cleanupBlocked && plan.action !== 'enrich') {
            entry.stamp = recordStamp(record, 2);
            entry.stampVersion = 2;
          }
          entry.status = 'verified';
        }
        current(s);
        entry.code = '';
        saveJournal(journal);
        return { ok: true, action: plan.action, entryId: entry.entryId, recordId: entry.recordId,
          recordMode: entry.recordMode || 'test',
          status: entry.status, name: entry.name, cleanupBlocked: entry.cleanupBlocked === true, ...safeCleanupDiagnostic(entry) };
      } catch (e) {
        entry.status = 'unknown';
        entry.code = safeError(e).code;
        // A business rejection before create supplied an ID is definitive; all other dispatch failures need reconciliation.
        if (plan.action === 'create' && !entry.recordId && e.code === 'FEISHU_API_ERROR') entry.status = 'failed';
        saveJournal(journal);
        return { ...safeError(e), entryId: entry.entryId, status: entry.status, recordId: entry.recordId || '',
          cleanupBlocked: entry.cleanupBlocked === true, ...safeCleanupDiagnostic(entry) };
      }
    }),
    reconcile: payload => serial(async () => {
      const s = active();
      const journal = loadJournal();
      const entry = journal.entries.find(e => e.target === targetKey(s) && e.entryId === payload.entryId && e.status === 'unknown');
      if (!entry) fail('FEISHU_NOT_OWNED');
      if (!entry.recordId) {
        if (!testRecordMode(entry)) fail('FEISHU_RECONCILE_UNCERTAIN');
        const r = await request(`https://project.feishu.cn/open_api/${s.projectKey}/work_item/${s.workItemTypeKey}/search/params`, s,
          'POST', { search_group: { conjunction: 'AND', search_params: [
            { param_key: 'name', operator: '=', value: entry.name },
            { param_key: s.mapping.platformField, operator: '=', value: [s.mapping.platformOptionId] }
          ], search_groups: [] }, page_num: 1, page_size: 50, fields: ['name'] }, fetchImpl);
        if (!Array.isArray(r.data) || r.data.length !== 1 || r.pagination?.total !== 1
          || r.data[0].name !== entry.name || r.data[0].project_key !== s.projectKey
          || r.data[0].work_item_type_key !== s.workItemTypeKey || !Number.isSafeInteger(r.data[0].id)) fail('FEISHU_RECONCILE_UNCERTAIN');
        entry.recordId = String(r.data[0].id);
        saveJournal(journal);
      }
      if (entry.action === 'delete') {
        try { await detail(s, entry.recordId); fail('FEISHU_RECONCILE_UNCERTAIN'); }
        catch (e) { if (!isRecordMissing(e)) throw e; }
        entry.status = 'deleted';
      } else {
        const r = await detail(s, entry.recordId, { stamp: entry.action !== 'enrich' });
        if (entry.action === 'enrich') checkEnrichmentIdentity(s, r, entry.creationIdentity);
        if (entry.action === 'update') checkMutationBaseline(r, entry);
        checkPairs(r, entry.expectedPairs, entry.action === 'enrich' ? '' : entry.name, entry.expectedFieldTypes, s.form);
        checkMaintainer(r, entry.expectedMaintainer);
        if (testRecordMode(entry) && !r.name.startsWith(`[AI测试] ${entry.batch} `)) fail('FEISHU_READBACK_MISMATCH');
        if (testRecordMode(entry) && entry.action !== 'update') entry.cleanupBlocked = true;
        if (entry.action !== 'enrich') { entry.stamp = recordStamp(r, 2); entry.stampVersion = 2; }
        entry.status = 'verified';
      }
      current(s);
      entry.code = '';
      saveJournal(journal);
      return { ok: true, entryId: entry.entryId, recordId: entry.recordId, status: entry.status,
        cleanupBlocked: entry.cleanupBlocked === true, ...safeCleanupDiagnostic(entry) };
    })
  });
}

module.exports = { createFeishuWorkbench, formFields, validateValues, recordStamp, safeError };
