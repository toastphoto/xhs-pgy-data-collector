import assert from 'node:assert/strict';
import { buildCandidateMergePatch } from '../renderer/state/candidate_merge.mjs';

const existing = {
  creator_name: '旧昵称',
  status: 'excluded',
  priority: '高',
  excludeReason: '人工排除',
  note: '人工备注'
};
const searchPatch = {
  creator_name: '新昵称',
  status: 'candidate',
  priority: '普通',
  excludeReason: '响应默认值',
  note: '粉丝 10 万'
};

assert.deepEqual(
  buildCandidateMergePatch(existing, searchPatch, { preserveManualReview: true }),
  { creator_name: '新昵称' }
);
assert.deepEqual(
  buildCandidateMergePatch(existing, searchPatch),
  searchPatch
);
assert.deepEqual(
  buildCandidateMergePatch(existing, { creator_name: '', note: '' }, { preserveManualReview: true }),
  {}
);

console.log('candidate_merge.test.mjs OK');
