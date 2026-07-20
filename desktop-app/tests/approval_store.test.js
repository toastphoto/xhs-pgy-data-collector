const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { approvalPath, loadApproval, saveApproval } = require('../lib/approval_store');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ca-approval-store-'));
const runDir = '/tmp/runs/run_demo';
assert.strictEqual(loadApproval(tmp, runDir, 'wechat_xiaomifeng'), null);
const saved = saveApproval(tmp, runDir, 'wechat_xiaomifeng', { approvalId: 'a1', status: 'approved' });
assert.strictEqual(saved.status, 'approved');
assert.ok(fs.existsSync(approvalPath(tmp, runDir, 'wechat_xiaomifeng')));
assert.strictEqual(loadApproval(tmp, runDir, 'wechat_xiaomifeng').approvalId, 'a1');

console.log('approval_store.test.js OK');
