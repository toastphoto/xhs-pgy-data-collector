const INVALID = 'FEISHU_HISTORY_ARCHIVE_INVALID';
const UNVERIFIED = 'FEISHU_HISTORY_ARCHIVE_UNVERIFIED';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TARGET = /^[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}$/;
const BATCH = /^AI_TEST_[A-Za-z0-9_-]+$/;
const RECORD_ID = /^[1-9][0-9]{0,15}$/;
const MARKER = '[AI\u6d4b\u8bd5]';

function fail(code) { throw Object.assign(new Error(code), { code }); }

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function archiveDeletedRecords(journal, options) {
  if (!plainObject(options) || typeof options.target !== 'string' || !TARGET.test(options.target)
    || options.target !== options.target.trim()
    || !Array.isArray(options.entryIds) || options.entryIds.length < 1 || options.entryIds.length > 1000
    || Array.from(options.entryIds).some(id => typeof id !== 'string' || id.length !== 36 || !UUID.test(id))
    || new Set(options.entryIds.map(id => id.toLowerCase())).size !== options.entryIds.length
    || !plainObject(journal) || journal.version !== 1 || !Array.isArray(journal.entries)) fail(INVALID);
  for (const entry of journal.entries) { if (!plainObject(entry)) fail(INVALID); }

  // Validate an independent snapshot before any visibility changes; never prune the manifest.
  let archived;
  try { archived = structuredClone(journal); } catch (_) { fail(INVALID); }
  const byEntryId = new Map(), byRecordId = new Map();
  for (const entry of archived.entries) {
    if (typeof entry.entryId === 'string') {
      const id = entry.entryId.toLowerCase();
      const matches = byEntryId.get(id) || [];
      matches.push(entry);
      byEntryId.set(id, matches);
    }
    if (entry.target === options.target && ['string', 'number'].includes(typeof entry.recordId)) {
      const recordId = Number(entry.recordId);
      if (Number.isSafeInteger(recordId) && recordId > 0) {
        const id = String(recordId);
        byRecordId.set(id, (byRecordId.get(id) || 0) + 1);
      }
    }
  }

  const selected = options.entryIds.map(id => {
    const matches = byEntryId.get(id.toLowerCase()) || [];
    if (matches.length !== 1 || matches[0].entryId !== id || matches[0].target !== options.target) fail(INVALID);
    const entry = matches[0];
    if (entry.recordMode !== undefined && entry.recordMode !== 'test') fail(UNVERIFIED);
    if (typeof entry.recordId !== 'string' || !RECORD_ID.test(entry.recordId)
      || !Number.isSafeInteger(Number(entry.recordId)) || String(Number(entry.recordId)) !== entry.recordId) fail(UNVERIFIED);
    if (byRecordId.get(entry.recordId) !== 1) fail(INVALID);
    if (typeof entry.batch !== 'string' || entry.batch.length > 128 || !BATCH.test(entry.batch)) fail(UNVERIFIED);
    const prefix = `${MARKER} ${entry.batch} `;
    const reviewedDelete = entry.cleanupReview && typeof entry.cleanupReview.stamp === 'string'
      && /^[a-f0-9]{64}$/i.test(entry.cleanupReview.stamp)
      && typeof entry.cleanupReview.checkedAt === 'string' && Number.isFinite(Date.parse(entry.cleanupReview.checkedAt));
    // Both software DELETE readback and readonly external-absence retirement are terminal proof.
    if (entry.status !== 'deleted'
      || (entry.externalAbsenceVerified !== true && (entry.action !== 'delete' || (entry.cleanupBlocked === true && !reviewedDelete)))
      || typeof entry.name !== 'string' || entry.name.length > 8192 || entry.name !== entry.name.trim()
      || /[\x00-\x1f\x7f-\x9f]/.test(entry.name) || !entry.name.startsWith(prefix)
      || entry.name.length <= prefix.length
      || (Object.hasOwn(entry, 'hiddenFromPicker') && typeof entry.hiddenFromPicker !== 'boolean')) fail(UNVERIFIED);
    return entry;
  });

  let count = 0;
  for (const entry of selected) {
    if (entry.hiddenFromPicker !== true) { entry.hiddenFromPicker = true; count++; }
  }
  return { journal: archived, count };
}

module.exports = { archiveDeletedRecords };
