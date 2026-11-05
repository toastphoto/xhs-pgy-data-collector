const { parsePlatformQuote } = require('./feishu_quotes');
const { normalizePgyCreatorUrl, normalizeXhsProfileUrl, xhsProfileSourceMatchesPgyCreator } = require('./xhs_contact_enrichment');

// Logical names are independent of cloud column names and user-defined mappings.
const TEXT_FIELDS = ['creatorName', 'xhsId', 'creatorUrl', 'xhsProfileUrl', 'followers', 'region', 'tags',
  'wechatId', 'email', 'phone', 'contactRaw', 'contactRawSource', 'contactRawCollectedAt',
  'contactSource', 'contactCollectedAt'];
const CONTACT_FIELDS = new Set(['wechatId', 'email', 'phone', 'contactRaw']);
const CREATOR_FIELDS = new Set([...TEXT_FIELDS, 'imagePrice', 'videoPrice']);
const FOLLOWUP_FIELDS = ['note', 'followupStatus', 'priority', 'contactChannel'];
function error(code) { return Object.assign(new Error(code), { code }); }
function text(value) { return value == null ? '' : typeof value === 'string' ? value.trim() : String(value); }
function empty(value) { return value == null || value === ''; }

function projectCreator(row) {
  if (!row || typeof row.rowId !== 'string' || !row.rowId) throw error('BITABLE_ROW_INVALID');
  // Public account numbers are strings, not numeric profile or PGY identifiers.
  if (row.xhsId != null && typeof row.xhsId !== 'string') throw error('BITABLE_ACCOUNT_TEXT_REQUIRED');
  const fields = {};
  for (const key of TEXT_FIELDS) {
    if (typeof row[key] === 'object' && row[key] != null) throw error('BITABLE_FIELD_INVALID');
    if (!empty(row[key])) fields[key] = text(row[key]);
  }
  const pgy = normalizePgyCreatorUrl(row.creatorUrl || '');
  if (row.creatorUrl && !pgy) throw error('BITABLE_CREATOR_URL_INVALID');
  if (pgy) fields.creatorUrl = pgy;
  const profile = normalizeXhsProfileUrl(row.xhsProfileUrl || '');
  const warnings = [];
  if (profile && pgy && xhsProfileSourceMatchesPgyCreator(row.xhsProfileSourceCreatorUrl, pgy)) {
    fields.xhsProfileUrl = profile;
  } else {
    delete fields.xhsProfileUrl;
    if (row.xhsProfileUrl) warnings.push('BITABLE_PROFILE_PROVENANCE_PENDING');
  }
  for (const key of ['imagePrice', 'videoPrice']) {
    try {
      const quote = parsePlatformQuote(row[key]);
      if (quote != null) fields[key] = quote;
    } catch (_) { throw error('BITABLE_QUOTE_INVALID'); }
  }
  const identity = fields.xhsId ? `xhs-account:${fields.xhsId}` : pgy ? `pgy-url:${pgy}` : '';
  if (!identity) throw error('BITABLE_IDENTITY_REQUIRED');
  const followup = {};
  for (const key of FOLLOWUP_FIELDS) if (!empty(row[key])) followup[key] = text(row[key]);
  return { rowId: row.rowId, identity, fields, followup, warnings };
}

function buildSelectedBatch(rows, selectedRowIds) {
  if (!Array.isArray(rows) || !Array.isArray(selectedRowIds)
    || selectedRowIds.some(id => typeof id !== 'string' || !id)
    || new Set(selectedRowIds).size !== selectedRowIds.length) throw error('BITABLE_SELECTION_INVALID');
  const byId = new Map();
  for (const row of rows) {
    if (!row || byId.has(row.rowId)) throw error('BITABLE_ROW_ID_AMBIGUOUS');
    byId.set(row.rowId, row);
  }
  const identities = new Map();
  const batch = selectedRowIds.map(rowId => {
    const row = byId.get(rowId);
    if (!row) throw error('BITABLE_SELECTION_STALE');
    try {
      const item = projectCreator(row);
      identities.set(item.identity, (identities.get(item.identity) || 0) + 1);
      return { ...item, status: 'pending' };
    } catch (e) { return { rowId, status: 'invalid', code: e.code || 'BITABLE_ROW_INVALID' }; }
  });
  return batch.map(item => identities.get(item.identity) > 1
    ? { ...item, status: 'conflict', code: 'BITABLE_DUPLICATE_SELECTION' } : item);
}

function creatorPatch(local, remote = {}, baseline = {}) {
  const fields = {}, conflicts = [];
  for (const [key, value] of Object.entries(local)) {
    if (!CREATOR_FIELDS.has(key) || empty(value) || value === remote[key]) continue;
    if (!empty(remote[key]) && ((CONTACT_FIELDS.has(key) || key === 'xhsId' || key === 'creatorUrl')
      || !Object.hasOwn(baseline, key) || baseline[key] !== remote[key])) {
      conflicts.push(key);
    } else fields[key] = value;
  }
  return { fields, conflicts };
}

module.exports = { TEXT_FIELDS, CREATOR_FIELDS, projectCreator, buildSelectedBatch, creatorPatch };
