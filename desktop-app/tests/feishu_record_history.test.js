const { test } = require('node:test');
const assert = require('node:assert/strict');
const { archiveDeletedRecords } = require('../lib/feishu_record_history');

const TARGET = 'fixture-project/fixture-creator';
const OTHER_TARGET = 'other-project/fixture-creator';
const ID = '1ba28293-f001-432a-9c83-1e1997022946';
const OTHER_ID = '2ba28293-f001-432a-9c83-1e1997022946';
const THIRD_ID = '3ba28293-f001-432a-9c83-1e1997022946';
const INVALID = 'FEISHU_HISTORY_ARCHIVE_INVALID';
const UNVERIFIED = 'FEISHU_HISTORY_ARCHIVE_UNVERIFIED';
const BATCH = 'AI_TEST_20261014_fixture';
const MARKER = '[AI\u6d4b\u8bd5]';

function record(overrides = {}) {
  return { entryId: ID, target: TARGET, recordId: '41', batch: BATCH,
    name: `${MARKER} ${BATCH} Fixture Creator`, status: 'deleted', action: 'delete',
    stamp: 'fixture-original-stamp', stampVersion: 2, code: '',
    expectedPairs: [{ field_key: 'fixture', field_value: 'original value' }],
    mutationBaseline: { actor: 'fixture-actor', untouchedStamp: 'fixture-baseline' },
    ...overrides };
}
function journal(entries = [record()]) {
  return { version: 1, entries, audit: { retained: true, events: ['fixture-original-event'] } };
}
function request(entryIds = [ID], target = TARGET) { return { target, entryIds }; }
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function rejects(input, options, code) {
  const before = structuredClone(input);
  assert.throws(() => archiveDeletedRecords(input, options), error => error.code === code && error.message === code);
  assert.deepEqual(input, before);
}

test('production records cannot be hidden as test history even with a forged test title', () => {
  for (const recordMode of ['production', 'invalid', null]) {
    rejects(journal([record({ recordMode })]), request(), UNVERIFIED);
    rejects(journal([record(), record({ entryId: OTHER_ID, recordId: '42', recordMode })]), request([ID, OTHER_ID]), UNVERIFIED);
  }
});

test('archive copies the complete audit and only marks explicitly selected entries', () => {
  const input = freeze(journal([record(), record({ entryId: OTHER_ID, recordId: '42', status: 'verified' }),
    record({ entryId: THIRD_ID, target: OTHER_TARGET, status: 'unknown' })]));
  const before = structuredClone(input);
  const options = freeze(request());
  const result = archiveDeletedRecords(input, options);
  const expected = structuredClone(before);
  expected.entries[0].hiddenFromPicker = true;
  assert.deepEqual(result, { journal: expected, count: 1 });
  assert.deepEqual(input, before);
  assert.notEqual(result.journal, input);
  assert.notEqual(result.journal.entries, input.entries);
  result.journal.entries[0].expectedPairs[0].field_value = 'copied value';
  result.journal.entries[1].mutationBaseline.actor = 'copied actor';
  result.journal.audit.events.push('copied event');
  assert.deepEqual(input, before);
});

test('batch archive counts changes only and preserves status, stamps and all other fields', () => {
  const input = journal([record({ hiddenFromPicker: false }), record({ entryId: OTHER_ID, recordId: '42' })]);
  const first = archiveDeletedRecords(input, request([ID, OTHER_ID]));
  assert.equal(first.count, 2);
  assert.equal(first.journal.entries.length, 2);
  first.journal.entries.forEach((entry, index) => {
    const { hiddenFromPicker, ...retained } = entry;
    const { hiddenFromPicker: originalVisibility, ...original } = input.entries[index];
    assert.equal(hiddenFromPicker, true);
    assert.deepEqual(retained, original);
  });
  const repeated = archiveDeletedRecords(freeze(first.journal), request([ID, OTHER_ID]));
  assert.equal(repeated.count, 0);
  assert.deepEqual(repeated.journal, first.journal);
  assert.notEqual(repeated.journal, first.journal);
});

test('readonly externally retired blocked entries retain their original diagnostics and create action', () => {
  const input = journal([record({ action: 'create', externalAbsenceVerified: true, cleanupBlocked: true,
    cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED', cleanupOriginDiagnostic: 'CREATOR_MISMATCH', stamp: null })]);
  const result = archiveDeletedRecords(input, request());
  assert.equal(result.count, 1);
  assert.deepEqual(result.journal.entries[0], { ...input.entries[0], hiddenFromPicker: true });
});

test('reviewed software deletion can be archived without inventing a creation baseline', () => {
  const input = journal([record({ cleanupBlocked: true, stamp: undefined, stampVersion: undefined,
    cleanupReview: { checkedAt: '2026-10-14T00:00:00.000Z', stamp: 'a'.repeat(64) } })]);
  const result = archiveDeletedRecords(input, request());
  assert.equal(result.count, 1);
  assert.equal(result.journal.entries[0].cleanupBlocked, true);
  assert.deepEqual(result.journal.entries[0], { ...input.entries[0], hiddenFromPicker: true });
  for (const cleanupReview of [null, {}, { stamp: 'bad', checkedAt: 'bad' }]) {
    rejects(journal([record({ cleanupBlocked: true, cleanupReview })]), request(), UNVERIFIED);
  }
});

test('unrelated other-target objects sharing a record ID remain unchanged', () => {
  const input = journal([record(), record({ entryId: OTHER_ID, target: OTHER_TARGET, status: 'verified' })]);
  const result = archiveDeletedRecords(input, request());
  assert.equal(result.count, 1);
  assert.deepEqual(result.journal.entries[1], input.entries[1]);
  rejects(input, request([OTHER_ID]), INVALID);
});

test('requests require a nonempty unique UUID list bounded at 1000 entries', () => {
  for (const entryIds of [null, {}, ID, [], Array(1), [1], [null], [Symbol('fixture')], [ID, ID], [ID, ID.toUpperCase()],
    ['------------------------------------'], ['1ba28293f001432a9c831e1997022946'], [` ${ID}`], [`${ID}\n`]]) {
    rejects(journal(), request(entryIds), INVALID);
  }
  const entries = Array.from({ length: 1001 }, (_, index) => record({
    entryId: `${index.toString(16).padStart(8, '0')}-f001-432a-9c83-1e1997022946`, recordId: String(index + 1)
  }));
  const options = request(entries.slice(0, 1000).map(entry => entry.entryId));
  const result = archiveDeletedRecords(journal(entries), options);
  assert.equal(result.count, 1000);
  assert.equal(result.journal.entries.length, 1001);
  assert.equal(result.journal.entries[1000].hiddenFromPicker, undefined);
  rejects(journal(entries), request(entries.map(entry => entry.entryId)), INVALID);
});

test('target must be exact project/type keys without whitespace or extra path segments', () => {
  for (const target of [null, 1, {}, Symbol('fixture'), '', 'fixture-project', '/fixture-creator', 'fixture-project/',
    `${TARGET}/extra`, ` ${TARGET}`, `${TARGET}\n`, 'a'.repeat(129) + '/b', 'a/' + 'b'.repeat(129)]) {
    rejects(journal(), request([ID], target), INVALID);
  }
  for (const options of [null, undefined, [], TARGET, {}, { target: TARGET }, { entryIds: [ID] }]) {
    rejects(journal(), options, INVALID);
  }
});

test('journal requires version 1 and an array of plain manifest objects', () => {
  for (const input of [null, undefined, [], {}, { entries: [] }, { version: 2, entries: [] },
    { version: '1', entries: [] }, { version: 1, entries: null }, { version: 1, entries: {} },
    journal(Array(1)), journal([null]), journal([[]]), journal([1]), journal([new Date(0)])]) {
    rejects(input, request(), INVALID);
  }
  const input = journal();
  input.audit.callback = () => {};
  assert.throws(() => archiveDeletedRecords(input, request()), { code: INVALID, message: INVALID });
  assert.equal(input.entries[0].hiddenFromPicker, undefined);
});

test('unknown IDs, nonexact case and duplicate journal UUIDs cannot select a manifest entry', () => {
  rejects(journal(), request([OTHER_ID]), INVALID);
  rejects(journal(), request([ID.toUpperCase()]), INVALID);
  rejects(journal([]), request(), INVALID);
  for (const duplicate of [record({ recordId: '42' }), record({ entryId: ID.toUpperCase(), recordId: '42' }),
    record({ target: OTHER_TARGET })]) {
    rejects(journal([record(), duplicate]), request(), INVALID);
  }
});

test('record IDs must be acknowledged canonical positive numeric strings in the safe integer range', () => {
  for (const recordId of [undefined, null, 41, '', '0', '-41', '041', '41.0', '4.1e1', ' 41', '41\n',
    'fixture-record', '9007199254740992', '99999999999999999']) {
    rejects(journal([record({ recordId })]), request(), UNVERIFIED);
  }
  assert.equal(archiveDeletedRecords(journal([record({ recordId: '9007199254740991' })]), request()).count, 1);
  for (const recordId of ['41', 41, '041', '41.0', '41\n']) {
    rejects(journal([record(), record({ entryId: OTHER_ID, recordId })]), request(), INVALID);
  }
});

test('trailing newlines cannot become valid IDs or targets even when both sides match', () => {
  rejects(journal([record({ entryId: `${ID}\n` })]), request([`${ID}\n`]), INVALID);
  rejects(journal([record({ target: `${TARGET}\n` })]), request([ID], `${TARGET}\n`), INVALID);
  rejects(journal([record({ recordId: '41\n' })]), request(), UNVERIFIED);
});

test('retained blocked, unknown, failed and merely verified entries cannot be hidden', () => {
  for (const status of ['verified', 'unknown', 'failed', 'retained', 'deleted ', undefined]) {
    rejects(journal([record({ status, cleanupBlocked: true, externalAbsenceVerified: true })]), request(), UNVERIFIED);
  }
  for (const entry of [record({ action: 'create', cleanupBlocked: true }), record({ action: 'update' }),
    record({ action: undefined }), record({ action: 'create', externalAbsenceVerified: false }),
    record({ action: 'create', externalAbsenceVerified: 'true' }), record({ cleanupBlocked: true })]) {
    rejects(journal([entry]), request(), UNVERIFIED);
  }
});

test('the complete leading AI marker, exact batch and nonempty title must all match', () => {
  for (const overrides of [{ name: 'Fixture Creator' }, { name: `${BATCH} ${MARKER} Fixture Creator` },
    { name: `${MARKER} AI_TEST_other Fixture Creator` }, { name: `${MARKER} ${BATCH}_extra Fixture Creator` },
    { name: `${MARKER} ${BATCH}` }, { name: `${MARKER} ${BATCH} ` }, { name: ` ${MARKER} ${BATCH} Fixture Creator` },
    { name: `${MARKER} ${BATCH} Fixture\nCreator` }, { batch: '' }, { batch: 'fixture' }, { batch: 'AI_TEST_' },
    { batch: 'AI_TEST_fixture/bad' }, { batch: null }, { batch: 41 }, { name: null },
    { batch: { toString: null } },
    { batch: 'AI_TEST_' + 'x'.repeat(121) }, { name: `${MARKER} ${BATCH} ` + 'x'.repeat(8192) }]) {
    rejects(journal([record(overrides)]), request(), UNVERIFIED);
  }
});

test('an already hidden record still must satisfy the deletion and identity guards', () => {
  const input = journal([record({ hiddenFromPicker: true })]);
  assert.deepEqual(archiveDeletedRecords(input, request()), { journal: input, count: 0 });
  for (const overrides of [{ status: 'unknown' }, { name: 'unmarked' }, { recordId: '' },
    { action: 'create', externalAbsenceVerified: false }, { hiddenFromPicker: 'true' }, { hiddenFromPicker: null }]) {
    rejects(journal([record({ hiddenFromPicker: true, ...overrides })]), request(), UNVERIFIED);
  }
});

test('a mixed valid/unverified or missing request rejects atomically without changing the input', () => {
  const input = freeze(journal([record(), record({ entryId: OTHER_ID, recordId: '42', status: 'verified', cleanupBlocked: true })]));
  rejects(input, request([ID, OTHER_ID]), UNVERIFIED);
  rejects(input, request([ID, THIRD_ID]), INVALID);
  assert.equal(input.entries[0].hiddenFromPicker, undefined);
});
