const { test } = require('node:test');
const assert = require('node:assert/strict');
const { creationIdentity, blocksCreation, duplicateQuery, reviewDuplicatePage, safeReviewDiagnostic } = require('../lib/feishu_dedup');
const { safeError } = require('../lib/feishu_workbench');
const mapping = { identityConfirmed: true, platformOptionConfirmed: true, identityKind: 'xhs_account_number',
  identityField: 'account', platformField: 'platform', contactField: 'contact', platformOptionId: 'xhs', matchTrailingNewline: true };
const fields = [{ key: 'account', type: 'text' }, { key: 'platform', type: 'select' }, { key: 'contact', type: 'text' }];
const pairs = [{ field_key: 'account', field_value: '001234' }, { field_key: 'platform', field_value: { value: 'xhs' } }];
const maintainer = { fieldKey: 'role_owners', role: 'maintainer', owner: 'fixture-owner' };
const candidate = creationIdentity({ target: 'project/creator', mapping, pairs, maintainer });
function record(id = 1, owners = ['fixture-other']) {
  return { id, project_key: 'project', work_item_type_key: 'creator', fields: [...structuredClone(pairs),
    { field_key: 'role_owners', field_type_key: 'role_owners', field_value: [{ role: 'maintainer', owners }] }] };
}
function review(data, overrides = {}) {
  return reviewDuplicatePage({ mapping, candidate, projectKey: 'project', workItemTypeKey: 'creator', page: 1,
    body: { err_code: 0, data, pagination: { page_num: 1, page_size: 50, total: data.length } }, ...overrides });
}
const rejected = fn => assert.throws(fn, { code: 'FEISHU_DUPLICATE_REVIEW_REQUIRED' });
function diagnosticRejected(fn, diagnostic) {
  assert.throws(fn, error => {
    assert.equal(error.code, 'FEISHU_DUPLICATE_REVIEW_REQUIRED');
    assert.deepEqual(error.dedupReview, diagnostic);
    assert.deepEqual(safeReviewDiagnostic(error.dedupReview), diagnostic);
    assert.deepEqual(safeError(error), { ok: false, code: error.code, dedupReview: diagnostic });
    return true;
  });
}

test('business identity retains text/leading zeros; ownership not row/nickname defines local duplicates', () => {
  const entry = { target: candidate.target, runDir: 'old', rowId: 'old', status: 'verified',
    expectedPairs: pairs, expectedMaintainer: maintainer };
  assert.equal(blocksCreation(entry, candidate, mapping, { runDir: 'new', rowId: 'new' }), true);
  assert.equal(blocksCreation({ ...entry, expectedMaintainer: { ...maintainer, owner: 'fixture-other' } }, candidate, mapping,
    { runDir: 'old', rowId: 'old' }), false);
  assert.notEqual(creationIdentity({ target: candidate.target, mapping, pairs: [{ ...pairs[0], field_value: '1234' }, pairs[1]], maintainer }).businessKey,
    candidate.businessKey);
  assert.equal(blocksCreation({ ...entry, status: 'deleted' }, candidate, mapping, {}), false);
  assert.equal(blocksCreation({ ...entry, status: 'unknown' }, candidate, mapping, {}), true);
  rejected(() => blocksCreation({ ...entry, expectedMaintainer: null }, candidate, mapping, {}));
});
test('repair: immutable creation identity and legacy business key block unknown incremental journals across runs', () => {
  for (const persisted of [{ creationIdentity: candidate }, { businessKey: candidate.businessKey }]) {
    for (const expectedPairs of [[], [{ field_key: 'contact', field_value: 'fixture changed' }]]) {
      const entry = { target: candidate.target, status: 'unknown', expectedPairs, expectedMaintainer: maintainer, ...persisted };
      assert.equal(blocksCreation(entry, candidate, mapping, { runDir: 'new', rowId: 'new' }), true);
      const other = creationIdentity({ target: candidate.target, mapping, pairs, maintainer: { ...maintainer, owner: 'fixture-other' } });
      assert.equal(blocksCreation(entry, other, mapping, {}), false);
    }
  }
});

test('repair: legacy unknown journals without identity evidence fail closed across rows and runs', () => {
  for (const expectedPairs of [undefined, [], [{ field_key: 'contact', field_value: 'fixture changed' }]]) {
    const entry = { target: candidate.target, status: 'unknown', expectedPairs, expectedMaintainer: maintainer, runDir: 'old', rowId: 'old' };
    rejected(() => blocksCreation(entry, candidate, mapping, { runDir: 'new', rowId: 'new' }));
    assert.equal(blocksCreation({ ...entry, expectedMaintainer: { ...maintainer, owner: 'fixture-other' } }, candidate, mapping, {}), false);
  }
});

test('remote same owner is duplicate even with multiple owners; different owner allows creation', () => {
  assert.deepEqual(review([record(1), record(2, ['fixture-other', 'fixture-owner'])]).duplicateIds, ['2']);
  assert.deepEqual(review([]).duplicateIds, []);
  const historical = record(); historical.fields[0].field_value += '\n';
  assert.deepEqual(review([historical]).duplicateIds, []);
});
test('live repair: null unrelated roles do not conceal same-owner duplicates or block different owners', () => {
  const other = record(1);
  other.fields[2].field_value.unshift({ role: 'fixture-unused-role', owners: null });
  const same = record(2, ['fixture-other', maintainer.owner]);
  same.fields[2].field_value.push({ role: 'fixture-unused-role', owners: null });
  assert.deepEqual(review([other, same]), { duplicateIds: ['2'], seen: [1, 2], total: 2, nextPage: null });
  assert.deepEqual(review([other]).duplicateIds, []);
  const absent = structuredClone(other);
  absent.fields[2].field_value.pop();
  diagnosticRejected(() => review([absent]), { reason: 'TARGET_ROLE_MISSING', pageOrdinal: 1, recordOrdinal: 1 });
  for (const owners of [null, [], undefined, ['bad key']]) {
    const invalid = structuredClone(other);
    invalid.fields[2].field_value[1].owners = owners;
    rejected(() => review([invalid]));
  }
  const ambiguous = structuredClone(other);
  ambiguous.fields[2].field_value.push({ role: 'fixture-unused-role', owners: null });
  diagnosticRejected(() => review([ambiguous]), { reason: 'ROLE_ID_DUPLICATE', pageOrdinal: 1, recordOrdinal: 1 });
});
test('query is exact scoped account/platform, requests ownership and never nickname or contact', () => {
  const query = duplicateQuery({ mapping, fields, candidate, page: 2 });
  assert.equal(query.page_num, 2);
  assert.deepEqual(query.fields, ['account', 'platform', 'role_owners']);
  assert.equal(query.search_group.search_groups[0].search_params[0].value, '001234');
  rejected(() => duplicateQuery({ mapping, fields, candidate, page: 21 }));
});
test('pagination validates full pages and can find a duplicate on a later page', () => {
  const first = Array.from({ length: 50 }, (_, i) => record(i + 1));
  const a = review(first, { body: { err_code: 0, data: first, pagination: { page_num: 1, page_size: 50, total: 51 } } });
  assert.equal(a.nextPage, 2);
  const second = [record(51, ['fixture-owner'])];
  const b = review(second, { page: 2, total: a.total, seen: a.seen,
    body: { err_code: 0, data: second, pagination: { page_num: 2, page_size: 50, total: 51 } } });
  assert.deepEqual(b.duplicateIds, ['51']); assert.equal(b.nextPage, null);
  rejected(() => review(first, { body: { err_code: 0, data: first, pagination: { page_num: 1, page_size: 50, total: 1001 } } }));
  rejected(() => review([], { body: { err_code: 0, data: [], pagination: { page_num: 1, page_size: 50, total: 1 } } }));
  rejected(() => review(second, { page: 2, total: 52, seen: a.seen,
    body: { err_code: 0, data: second, pagination: { page_num: 2, page_size: 50, total: 51 } } }));
});
test('invalid, unowned, duplicate, missing-role and incomplete results never mean no duplicate', () => {
  for (const change of [r => { r.fields.pop(); }, r => { r.fields[2].field_value = []; },
    r => { r.fields[2].field_value[0].owners = []; }, r => { r.fields[2].field_value[0].owners = ['bad key']; },
    r => { r.fields[2].field_value.push(r.fields[2].field_value[0]); },
    r => { r.fields[0].field_value = '1234'; }, r => { r.project_key = 'other'; },
    r => { r.fields.push(r.fields[0]); }, r => { r.deleted_at = 1; }]) {
    const r = record(); change(r); rejected(() => review([r]));
  }
  rejected(() => review([record(), record()]));
});

const pageReasonCases = [
  ['RESPONSE_SHAPE', [
    s => { s.body = undefined; }, s => { s.body.err_code = 1; },
    s => { s.body.data = {}; }, s => { delete s.body.pagination; }
  ]],
  ['PAGE_NUMBER', [s => { s.body.pagination.page_num = 2; }]],
  ['PAGE_SIZE', [s => { s.body.pagination.page_size = 49; }]],
  ['TOTAL_INVALID', [undefined, null, '1', -1, 1.5, 1001, Number.MAX_SAFE_INTEGER + 1].map(
    total => s => { s.body.pagination.total = total; })],
  ['TOTAL_CHANGED', [s => { s.total = 2; }]],
  ['PAGE_LENGTH', [
    s => { s.body.data = []; },
    s => { s.body.data = Array.from({ length: 51 }, (_, i) => record(i + 1)); s.body.pagination.total = 51; }
  ]]
];
for (const [reason, changes] of pageReasonCases) {
  test(`review diagnostic: ${reason}`, () => {
    for (const change of changes) {
      const state = { body: { err_code: 0, data: [record()], pagination: { page_num: 1, page_size: 50, total: 1 } } };
      change(state);
      diagnosticRejected(() => review([], state), { reason, pageOrdinal: 1 });
    }
  });
}

const recordReasonCases = [
  ['RECORD_ID_INVALID', [undefined, null, '1', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map(
    id => r => { r.id = id; })],
  ['SCOPE_MISMATCH', [r => { r.project_key = 'fixture-other-project'; }, r => { r.work_item_type_key = 'fixture-other-type'; }]],
  ['DELETED', [r => { r.deleted_at = 1; }]],
  ['FIELDS_SHAPE', [r => { delete r.fields; }, r => { r.fields = {}; }]],
  ['FIELD_KEY_INVALID', [r => { r.fields[0] = null; }, r => { r.fields[0].field_key = 'fixture invalid'; }]],
  ['FIELD_KEY_DUPLICATE', [r => { r.fields.push(structuredClone(r.fields[0])); }]],
  ['ACCOUNT_MISMATCH', [r => { r.fields.shift(); }, r => { r.fields[0].field_value = 'fixture-other-account'; }]],
  ['PLATFORM_MISMATCH', [r => { r.fields.splice(1, 1); }, r => { r.fields[1].field_value = { value: 'fixture-other-platform' }; }]],
  ['ROLE_FIELD_MISSING', [r => { r.fields.pop(); }]],
  ['ROLE_TYPE_MISSING', [undefined, null, ''].map(type => r => { r.fields[2].field_type_key = type; })],
  ['ROLE_TYPE_UNEXPECTED', ['text', 1].map(type => r => { r.fields[2].field_type_key = type; })],
  ['ROLE_VALUE_NOT_ARRAY', [undefined, null, {}].map(value => r => { r.fields[2].field_value = value; })],
  ['ROLE_ID_INVALID', [r => { r.fields[2].field_value = [null]; }, r => { r.fields[2].field_value[0].role = 'fixture invalid'; }]],
  ['ROLE_ID_DUPLICATE', [
    r => { r.fields[2].field_value.push(structuredClone(r.fields[2].field_value[0])); },
    r => { r.fields[2].field_value.push({ role: 'fixture-other-role', owners: [] }, { role: 'fixture-other-role', owners: [] }); }
  ]],
  ['TARGET_ROLE_MISSING', [r => { r.fields[2].field_value = []; }, r => { r.fields[2].field_value[0].role = 'fixture-other-role'; }]],
  ['TARGET_OWNERS_EMPTY', [r => { r.fields[2].field_value[0].owners = []; }]],
  ['TARGET_OWNERS_DUPLICATE', [r => { r.fields[2].field_value[0].owners = ['fixture-other', 'fixture-other']; }]]
];
for (const prefix of ['TARGET', 'OTHER']) {
  for (const [suffix, values] of [
    ['MISSING', [undefined]], ['NULL', [null]], ['NOT_ARRAY', ['fixture-owner', {}]],
    ['INVALID_ELEMENT', [['fixture invalid'], [null], [1], ['']]]
  ]) {
    if (prefix === 'OTHER' && suffix === 'NULL') continue;
    recordReasonCases.push([`${prefix}_OWNERS_${suffix}`, values.map(owners => r => {
      const roles = r.fields[2].field_value;
      if (prefix === 'TARGET') roles[0].owners = owners;
      else roles.push({ role: 'fixture-other-role', owners });
    })]);
  }
}
for (const [reason, changes] of recordReasonCases) {
  test(`review diagnostic: ${reason}`, () => {
    for (const change of changes) {
      const r = record(); change(r);
      diagnosticRejected(() => review([r]), { reason, pageOrdinal: 1, recordOrdinal: 1 });
    }
  });
}
test('review diagnostic: RECORD_ID_REPEATED within and across pages', () => {
  diagnosticRejected(() => review([record(), record()]),
    { reason: 'RECORD_ID_REPEATED', pageOrdinal: 1, recordOrdinal: 2 });
  diagnosticRejected(() => review([record()], { page: 2, seen: [1], total: 2,
    body: { err_code: 0, data: [record()], pagination: { page_num: 2, page_size: 50, total: 2 } } }),
  { reason: 'RECORD_ID_REPEATED', pageOrdinal: 2, recordOrdinal: 1 });
});

test('first failure wins over later predicates and never reads a later record', () => {
  const body = { err_code: 0, data: [], pagination: { page_num: 2, page_size: 49, total: -1 } };
  diagnosticRejected(() => review([], { body }), { reason: 'PAGE_NUMBER', pageOrdinal: 1 });
  body.err_code = 1;
  diagnosticRejected(() => review([], { body }), { reason: 'RESPONSE_SHAPE', pageOrdinal: 1 });
  const r = record();
  r.fields[0].field_value = 'fixture-other-account';
  r.fields[2].field_type_key = 'text';
  const unread = { get id() { assert.fail('must stop before reading the later record'); } };
  diagnosticRejected(() => review([r, unread]), { reason: 'ACCOUNT_MISMATCH', pageOrdinal: 1, recordOrdinal: 1 });
  r.fields[0].field_value = candidate.identity;
  r.fields[2].field_value = null;
  diagnosticRejected(() => review([r]), { reason: 'ROLE_TYPE_UNEXPECTED', pageOrdinal: 1, recordOrdinal: 1 });
  r.fields[2].field_type_key = 'role_owners';
  r.fields[2].field_value = [{ role: maintainer.role, owners: null }, { role: maintainer.role, owners: [] }];
  diagnosticRejected(() => review([r]), { reason: 'TARGET_OWNERS_NULL', pageOrdinal: 1, recordOrdinal: 1 });
});

test('third record fails closed for unknown maintainer but accepts null unrelated roles across pages', () => {
  for (const prefix of ['TARGET', 'OTHER']) {
    const third = record(3);
    if (prefix === 'TARGET') third.fields[2].field_value[0].owners = null;
    else third.fields[2].field_value.push({ role: 'fixture-other-role', owners: null });
    const data = [record(1), record(2, [maintainer.owner]), third];
    if (prefix === 'OTHER') {
      assert.deepEqual(review(data).duplicateIds, ['2']);
      assert.deepEqual(review(data, { page: 2, total: 53, seen: Array.from({ length: 50 }, (_, i) => i + 100),
        body: { err_code: 0, data, pagination: { page_num: 2, page_size: 50, total: 53 } } }).duplicateIds, ['2']);
      continue;
    }
    diagnosticRejected(() => review(data), { reason: `${prefix}_OWNERS_NULL`, pageOrdinal: 1, recordOrdinal: 3 });
    diagnosticRejected(() => review(data, { page: 2, total: 53, seen: Array.from({ length: 50 }, (_, i) => i + 100),
      body: { err_code: 0, data, pagination: { page_num: 2, page_size: 50, total: 53 } } }),
    { reason: `${prefix}_OWNERS_NULL`, pageOrdinal: 2, recordOrdinal: 3 });
  }
});

test('diagnostics preserve acceptance of different owners, empty other roles and exact query shape', () => {
  const first = record(1);
  first.fields[2].field_value.unshift({ role: 'fixture-other-role', owners: [] });
  const second = record(2, ['fixture-other', maintainer.owner]);
  second.fields[2].field_value.push({ role: 'fixture-other-role', owners: [maintainer.owner, maintainer.owner] });
  const third = record(3);
  third.fields[0].field_value += '\n';
  assert.deepEqual(review([first, second, third]), { duplicateIds: ['2'], seen: [1, 2, 3], total: 3, nextPage: null });
  assert.deepEqual(review([first, third]).duplicateIds, []);
  assert.deepEqual(review([]), { duplicateIds: [], seen: [], total: 0, nextPage: null });
  diagnosticRejected(() => review([third], { mapping: { ...mapping, matchTrailingNewline: false } }),
    { reason: 'ACCOUNT_MISMATCH', pageOrdinal: 1, recordOrdinal: 1 });
  assert.deepEqual(duplicateQuery({ mapping, fields, candidate }), {
    page_num: 1, page_size: 50, fields: ['account', 'platform', 'role_owners'],
    search_group: { conjunction: 'AND', search_groups: [{ conjunction: 'OR', search_groups: [],
      search_params: [candidate.identity, `${candidate.identity}\n`].map(value => ({ param_key: 'account', operator: '=', value })) }],
    search_params: [{ param_key: 'platform', operator: '=', value: ['xhs'] }] }
  });
});

test('safeReviewDiagnostic accepts every reason but only bounded ordinals and whitelisted properties', () => {
  const reasons = [...pageReasonCases, ...recordReasonCases].map(([reason]) => reason).concat('RECORD_ID_REPEATED', 'OTHER_OWNERS_NULL');
  assert.equal(new Set(reasons).size, 32);
  for (const reason of reasons) {
    for (const [pageOrdinal, recordOrdinal] of [[1, 1], [20, 50]]) {
      const expected = { reason, pageOrdinal, recordOrdinal };
      assert.deepEqual(safeReviewDiagnostic({ ...expected, token: 'fixture-private-canary', fields: pairs }), expected);
    }
  }
  const valid = { reason: 'TARGET_OWNERS_NULL', pageOrdinal: 1 };
  assert.deepEqual(safeReviewDiagnostic(valid), valid);
  assert.deepEqual(safeReviewDiagnostic({ ...valid, recordOrdinal: null }), valid);
  for (const value of [null, undefined, {}, { ...valid, reason: 'fixture-private-canary' },
    { ...valid, reason: 'TARGET_OWNERS_NULL\n' },
    ...[undefined, null, '1', 0, -1, 1.5, 21, NaN, Infinity].map(pageOrdinal => ({ ...valid, pageOrdinal })),
    ...['1', 0, -1, 1.5, 51, NaN, Infinity].map(recordOrdinal => ({ ...valid, recordOrdinal }))]) {
    assert.equal(safeReviewDiagnostic(value), null);
  }
});

test('safeError propagates only valid review diagnostics for the review-required code without private values', () => {
  const canary = 'fixture-private-canary';
  const expected = { reason: 'OTHER_OWNERS_NULL', pageOrdinal: 2, recordOrdinal: 3 };
  const error = Object.assign(new Error(canary), {
    code: 'FEISHU_DUPLICATE_REVIEW_REQUIRED', token: canary, accountNumber: canary,
    recordId: '1234567890', maintainerName: canary, expectedPairs: pairs,
    dedupReview: { ...expected, owner: canary, role: canary, field_type_key: canary, response: canary, stage: canary }
  });
  const result = safeError(error);
  assert.deepEqual(result, { ok: false, code: error.code, dedupReview: expected });
  assert.equal(JSON.stringify(result).includes(canary), false);
  assert.notEqual(result.dedupReview, error.dedupReview);
  assert.deepEqual(safeError({ ...error, dedupReview: { ...expected, reason: canary } }), { ok: false, code: error.code });
  assert.deepEqual(safeError({ ...error, dedupReview: { ...expected, recordOrdinal: 51 } }), { ok: false, code: error.code });
  for (const code of ['FEISHU_ALREADY_SUBMITTED', 'FEISHU_API_ERROR', canary]) {
    assert.deepEqual(safeError({ ...error, code }), {
      ok: false, code: code === canary ? 'FEISHU_OPERATION_FAILED' : code
    });
  }
  rejected(() => blocksCreation({ target: candidate.target, status: 'unknown', expectedMaintainer: maintainer }, candidate, mapping, {}));
  assert.deepEqual(safeError({ code: 'FEISHU_DUPLICATE_REVIEW_REQUIRED' }), { ok: false, code: 'FEISHU_DUPLICATE_REVIEW_REQUIRED' });
});
