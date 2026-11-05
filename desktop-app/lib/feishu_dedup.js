const crypto = require('crypto');
const { buildContactQuery } = require('./feishu_contact_preview');

const reviewReasons = new Set(['RESPONSE_SHAPE', 'PAGE_NUMBER', 'PAGE_SIZE', 'TOTAL_INVALID',
  'TOTAL_CHANGED', 'PAGE_LENGTH', 'RECORD_ID_INVALID', 'RECORD_ID_REPEATED', 'SCOPE_MISMATCH',
  'DELETED', 'FIELDS_SHAPE', 'FIELD_KEY_INVALID', 'FIELD_KEY_DUPLICATE', 'ACCOUNT_MISMATCH',
  'PLATFORM_MISMATCH', 'ROLE_FIELD_MISSING', 'ROLE_TYPE_MISSING', 'ROLE_TYPE_UNEXPECTED',
  'ROLE_VALUE_NOT_ARRAY', 'ROLE_ID_INVALID', 'ROLE_ID_DUPLICATE', 'TARGET_OWNERS_MISSING',
  'TARGET_OWNERS_NULL', 'TARGET_OWNERS_NOT_ARRAY', 'TARGET_OWNERS_INVALID_ELEMENT',
  'OTHER_OWNERS_MISSING', 'OTHER_OWNERS_NULL', 'OTHER_OWNERS_NOT_ARRAY', 'OTHER_OWNERS_INVALID_ELEMENT',
  'TARGET_ROLE_MISSING', 'TARGET_OWNERS_EMPTY', 'TARGET_OWNERS_DUPLICATE']);
function fail(reason, pageOrdinal, recordOrdinal) {
  const e = new Error(); e.code = 'FEISHU_DUPLICATE_REVIEW_REQUIRED';
  if (reviewReasons.has(reason)) e.dedupReview = { reason, pageOrdinal,
    ...(recordOrdinal != null ? { recordOrdinal } : {}) };
  throw e;
}
function safeReviewDiagnostic(value) {
  if (!value || !reviewReasons.has(value.reason) || !Number.isInteger(value.pageOrdinal)
    || value.pageOrdinal < 1 || value.pageOrdinal > 20
    || (value.recordOrdinal != null && (!Number.isInteger(value.recordOrdinal)
      || value.recordOrdinal < 1 || value.recordOrdinal > 50))) return null;
  return { reason: value.reason, pageOrdinal: value.pageOrdinal,
    ...(value.recordOrdinal != null ? { recordOrdinal: value.recordOrdinal } : {}) };
}
const key = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);

function creationIdentity({ target, mapping, pairs, maintainer }) {
  const identities = pairs.filter(p => p.field_key === mapping.identityField);
  const platforms = pairs.filter(p => p.field_key === mapping.platformField);
  const identity = identities[0]?.field_value;
  const platform = platforms[0]?.field_value?.value;
  if (identities.length !== 1 || platforms.length !== 1 || typeof identity !== 'string'
    || !identity || identity !== identity.trim() || /[\x00-\x1f]/.test(identity)
    || !key(platform) || platform !== mapping.platformOptionId || !key(maintainer?.owner)
    || !key(maintainer.role) || !key(maintainer.fieldKey) || typeof target !== 'string') fail();
  return { target, identity, platform, maintainer: { ...maintainer },
    businessKey: crypto.createHash('sha256').update(JSON.stringify([target, platform, identity, maintainer.owner])).digest('hex') };
}

function blocksCreation(entry, candidate, mapping, local) {
  if (entry.target !== candidate.target || ['failed', 'deleted'].includes(entry.status)) return false;
  if (entry.creationIdentity) {
    const original = entry.creationIdentity;
    if (original.target !== entry.target || !key(original.platform) || !key(original.maintainer?.owner)
      || typeof original.identity !== 'string' || !original.identity || original.identity !== original.identity.trim()
      || /[\x00-\x1f]/.test(original.identity)) fail();
    return original.identity === candidate.identity && original.platform === candidate.platform
      && original.maintainer.owner === candidate.maintainer.owner;
  }
  // Older journals may have already replaced their pairs with an update/delete delta.
  if (typeof entry.businessKey === 'string' && /^[a-f0-9]{64}$/.test(entry.businessKey)) {
    return entry.businessKey === candidate.businessKey;
  }
  const pairs = entry.expectedPairs;
  if (key(entry.expectedMaintainer?.owner) && entry.expectedMaintainer.owner !== candidate.maintainer.owner) return false;
  if (!Array.isArray(pairs)) {
    if (entry.status === 'unknown' || (entry.runDir === local.runDir && entry.rowId === local.rowId)) fail();
    return false;
  }
  const identity = pairs.find(p => p.field_key === mapping.identityField)?.field_value;
  const platform = pairs.find(p => p.field_key === mapping.platformField)?.field_value?.value;
  if (entry.status === 'unknown' && (typeof identity !== 'string' || !identity || !key(platform))) fail();
  if (identity !== candidate.identity || platform !== candidate.platform) return false;
  if (!key(entry.expectedMaintainer?.owner)) fail();
  return entry.expectedMaintainer.owner === candidate.maintainer.owner;
}

function duplicateQuery({ mapping, fields, candidate, page = 1 }) {
  if (!Number.isInteger(page) || page < 1 || page > 20) fail();
  const query = buildContactQuery({ mapping, fields,
    identityKind: 'xhs_account_number', identityValue: candidate.identity });
  return { ...query, page_num: page,
    fields: [mapping.identityField, mapping.platformField, candidate.maintainer.fieldKey] };
}

// Missing/partial ownership is not evidence that an account is safe to recreate.
function reviewDuplicatePage({ body, mapping, candidate, projectKey, workItemTypeKey,
  page, total, seen = [] }) {
  const pagination = body?.pagination;
  const reject = (reason, ordinal) => fail(reason, page, ordinal);
  if (body?.err_code !== 0 || !Array.isArray(body.data) || !pagination) reject('RESPONSE_SHAPE');
  if (pagination.page_num !== page) reject('PAGE_NUMBER');
  if (pagination.page_size !== 50) reject('PAGE_SIZE');
  if (!Number.isSafeInteger(pagination.total) || pagination.total < 0 || pagination.total > 1000) reject('TOTAL_INVALID');
  if (total != null && total !== pagination.total) reject('TOTAL_CHANGED');
  if (body.data.length > 50
    || body.data.length !== Math.min(50, Math.max(0, pagination.total - seen.length))) reject('PAGE_LENGTH');
  const visited = new Set(seen), duplicateIds = [];
  for (const [index, record] of body.data.entries()) {
    const ordinal = index + 1;
    if (!Number.isSafeInteger(record?.id) || record.id <= 0) reject('RECORD_ID_INVALID', ordinal);
    if (visited.has(record.id)) reject('RECORD_ID_REPEATED', ordinal);
    if (record.project_key !== projectKey || record.work_item_type_key !== workItemTypeKey) reject('SCOPE_MISMATCH', ordinal);
    if (record.deleted_at) reject('DELETED', ordinal);
    if (!Array.isArray(record.fields)) reject('FIELDS_SHAPE', ordinal);
    visited.add(record.id);
    const fields = new Map();
    for (const field of record.fields) {
      if (!key(field?.field_key)) reject('FIELD_KEY_INVALID', ordinal);
      if (fields.has(field.field_key)) reject('FIELD_KEY_DUPLICATE', ordinal);
      fields.set(field.field_key, field);
    }
    const actualIdentity = fields.get(mapping.identityField)?.field_value;
    if (actualIdentity !== candidate.identity && !(mapping.matchTrailingNewline === true
      && actualIdentity === `${candidate.identity}\n`)) reject('ACCOUNT_MISMATCH', ordinal);
    if (fields.get(mapping.platformField)?.field_value?.value !== candidate.platform) reject('PLATFORM_MISMATCH', ordinal);
    const field = fields.get(candidate.maintainer.fieldKey);
    if (!field) reject('ROLE_FIELD_MISSING', ordinal);
    if (field.field_type_key == null || field.field_type_key === '') reject('ROLE_TYPE_MISSING', ordinal);
    if (field.field_type_key !== 'role_owners') reject('ROLE_TYPE_UNEXPECTED', ordinal);
    if (!Array.isArray(field.field_value)) reject('ROLE_VALUE_NOT_ARRAY', ordinal);
    const roles = field.field_value;
    for (const role of roles) {
      if (!key(role?.role)) reject('ROLE_ID_INVALID', ordinal);
      const prefix = role.role === candidate.maintainer.role ? 'TARGET' : 'OTHER';
      // Unassigned unrelated roles cannot establish or negate maintainer identity.
      if (prefix === 'OTHER' && role.owners === null) continue;
      if (role.owners === undefined) reject(`${prefix}_OWNERS_MISSING`, ordinal);
      if (role.owners === null) reject(`${prefix}_OWNERS_NULL`, ordinal);
      if (!Array.isArray(role.owners)) reject(`${prefix}_OWNERS_NOT_ARRAY`, ordinal);
      if (role.owners.some(o => !key(o))) reject(`${prefix}_OWNERS_INVALID_ELEMENT`, ordinal);
    }
    if (new Set(roles.map(r => r.role)).size !== roles.length) reject('ROLE_ID_DUPLICATE', ordinal);
    const maintainerRoles = roles.filter(r => r.role === candidate.maintainer.role);
    if (maintainerRoles.length !== 1) reject('TARGET_ROLE_MISSING', ordinal);
    if (!maintainerRoles[0].owners.length) reject('TARGET_OWNERS_EMPTY', ordinal);
    if (new Set(maintainerRoles[0].owners).size !== maintainerRoles[0].owners.length) reject('TARGET_OWNERS_DUPLICATE', ordinal);
    if (maintainerRoles[0].owners.includes(candidate.maintainer.owner)) duplicateIds.push(String(record.id));
  }
  return { duplicateIds, seen: [...visited], total: pagination.total,
    nextPage: visited.size < pagination.total ? page + 1 : null };
}

module.exports = { creationIdentity, blocksCreation, duplicateQuery, reviewDuplicatePage, safeReviewDiagnostic };
