// Pure query planning / response review. No transport, mutation, or persistence.
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function text(value, max = 512) {
  return typeof value === 'string' && value.trim().length > 0
    && value.length <= max && !/[\x00-\x1f]/.test(value);
}
function key(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }

function validateMapping(mapping, fields) {
  if (!mapping || mapping.identityConfirmed !== true || mapping.platformOptionConfirmed !== true
      || !['xhs_account_number', 'xhs_profile_id'].includes(mapping.identityKind)
      || !key(mapping.platformOptionId) || !Array.isArray(fields)
      || (mapping.matchTrailingNewline != null && typeof mapping.matchTrailingNewline !== 'boolean')) {
    fail('FEISHU_MAPPING_UNCONFIRMED');
  }
  if (mapping.identityField === 'name') fail('FEISHU_MAPPING_INVALID');
  const byKey = new Map();
  for (const field of fields) {
    if (!field || !key(field.key) || byKey.has(field.key)) fail('FEISHU_SCHEMA_INVALID');
    byKey.set(field.key, field);
  }
  const specs = [['identityField', 'text'], ['platformField', 'select'], ['contactField', 'text']];
  const used = new Set();
  for (const [property, type] of specs) {
    const id = mapping[property];
    if (!key(id) || used.has(id) || byKey.get(id)?.type !== type) fail('FEISHU_MAPPING_INVALID');
    used.add(id);
  }
}

function buildContactQuery({ mapping, fields, identityKind, identityValue } = {}) {
  validateMapping(mapping, fields);
  if (identityKind !== mapping.identityKind || !text(identityValue)
      || identityValue !== identityValue.trim()) fail('FEISHU_IDENTITY_INVALID');
  return {
    page_num: 1, page_size: 50,
    fields: [mapping.identityField, mapping.platformField, mapping.contactField],
    search_group: { conjunction: 'AND', search_groups: mapping.matchTrailingNewline === true ? [{
      conjunction: 'OR', search_groups: [], search_params: [identityValue, `${identityValue}\n`]
        .map(value => ({ param_key: mapping.identityField, operator: '=', value }))
    }] : [], search_params: [
      { param_key: mapping.platformField, operator: '=', value: [mapping.platformOptionId] },
      ...(mapping.matchTrailingNewline === true ? [] : [
        { param_key: mapping.identityField, operator: '=', value: identityValue }
      ])
    ] }
  };
}

function classifyContact(raw) {
  if (raw == null || raw === '') return { kind: 'empty', value: '' };
  if (typeof raw !== 'string' || raw.length > 4096) return { kind: 'unrecognized', value: '' };
  const value = raw.trim();
  if (!value) return { kind: 'empty', value: '' };
  if (/^(后台邀约|蒲公英邀约|待填|待补|待定|暂无|无)$/.test(value)) return { kind: 'status', value };
  const wechat = /^(?:微信|微信号|wechat)\s*[:：]\s*([a-zA-Z][a-zA-Z0-9_-]{5,19})$/i.exec(value);
  if (wechat) return { kind: 'wechat', value: wechat[1] };
  const email = /^(?:邮箱|email)\s*[:：]\s*([^\s@：:]+@[^\s@：:]+\.[^\s@：:]+)$/i.exec(value);
  if (email) return { kind: 'email', value: email[1] };
  const phone = /^(?:手机|手机号|电话|phone)\s*[:：]\s*(\+?[0-9][0-9 -]{5,25})$/i.exec(value);
  if (phone) return { kind: 'phone', value: phone[1] };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { kind: 'email', value };
  // Unlabelled IDs, numbers, multiple contacts and agent notes need human review.
  return { kind: 'unclassified', value: raw };
}

function reviewContactResponse({ body, mapping, fields, identityKind, identityValue,
  projectKey, workItemTypeKey, existing = {} } = {}) {
  buildContactQuery({ mapping, fields, identityKind, identityValue });
  if (!key(projectKey) || !key(workItemTypeKey)) fail('FEISHU_TARGET_INVALID');
  if (!body || body.err_code !== 0 || !Array.isArray(body.data)
      || (body.err_msg != null && body.err_msg !== '')
      || (body.err != null && (typeof body.err !== 'object' || Array.isArray(body.err)
        || Object.keys(body.err).length))) fail('FEISHU_SEARCH_RESPONSE_INVALID');
  const page = body.pagination;
  if (!page || page.page_num !== 1 || page.page_size !== 50
      || !Number.isSafeInteger(page.total) || page.total < body.data.length
      || body.data.length > 50) fail('FEISHU_PAGINATION_INVALID');
  if (page.total > body.data.length) return { status: 'incomplete', proposals: [], candidates: [] };
  const seen = new Set();
  const candidates = [];
  for (const record of body.data) {
    if (!record || !Number.isSafeInteger(record.id) || record.id <= 0 || seen.has(record.id)
        || record.project_key !== projectKey || record.work_item_type_key !== workItemTypeKey
        || !Array.isArray(record.fields)) fail('FEISHU_SEARCH_RECORD_INVALID');
    seen.add(record.id);
    const values = new Map();
    for (const field of record.fields) {
      if (!field || !key(field.field_key) || values.has(field.field_key)) fail('FEISHU_SEARCH_RECORD_INVALID');
      values.set(field.field_key, field.field_value);
    }
    // Official select readback is { label, value }; the query uses its value ID.
    const platform = values.get(mapping.platformField);
    const storedIdentity = values.get(mapping.identityField);
    const trailingNewline = mapping.matchTrailingNewline === true && storedIdentity === `${identityValue}\n`;
    if ((storedIdentity !== identityValue && !trailingNewline)
        || !platform || typeof platform !== 'object' || Array.isArray(platform)
        || platform.value !== mapping.platformOptionId
        || (mapping.platformLabel && platform.label !== mapping.platformLabel)) {
      fail('FEISHU_IDENTITY_NOT_VERIFIED');
    }
    const contact = classifyContact(values.get(mapping.contactField));
    candidates.push({ recordId: record.id, identityVariant: trailingNewline ? 'trailing_lf' : 'exact', ...contact });
  }
  if (!candidates.length) return { status: 'not_found', candidates, proposals: [] };
  const distinct = new Set(candidates.filter(c => c.kind !== 'empty').map(c => JSON.stringify([c.kind, c.value])));
  if (!distinct.size) return { status: 'no_contact', candidates, proposals: [] };
  if (distinct.size > 1) return { status: 'conflict', candidates, proposals: [] };
  const selected = candidates.find(c => c.kind !== 'empty');
  const targetField = { wechat: 'wechatId', email: 'email' }[selected.kind];
  if (!targetField) return { status: 'manual_review', candidates, proposals: [] };
  const previous = existing[targetField];
  if (previous != null && (typeof previous !== 'string' || previous.trim())) {
    return { status: previous === selected.value ? 'already_present' : 'local_conflict', candidates, proposals: [] };
  }
  return { status: 'ready_for_review', candidates, proposals: [{ field: targetField,
    value: selected.value, recordIds: candidates.filter(c => c.kind === selected.kind && c.value === selected.value)
      .map(c => c.recordId), requiresConfirmation: true }] };
}

module.exports = { buildContactQuery, classifyContact, reviewContactResponse };
