const fs = require('fs');
const path = require('path');
const { makeRunKey } = require('./contact_review_store');

function cleanChannel(value) {
  return String(value || 'unknown').trim().replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 40) || 'unknown';
}

function approvalPath(storeDir, runDir, channel) {
  fs.mkdirSync(storeDir, { recursive: true });
  return path.join(storeDir, `${makeRunKey(runDir)}_${cleanChannel(channel)}.json`);
}

function loadApproval(storeDir, runDir, channel) {
  const filePath = approvalPath(storeDir, runDir, channel);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return null;
  }
}

function saveApproval(storeDir, runDir, channel, approval) {
  const filePath = approvalPath(storeDir, runDir, channel);
  const saved = { ...approval, runDir: String(runDir || ''), updatedAt: new Date().toISOString() };
  fs.writeFileSync(filePath, JSON.stringify(saved, null, 2), 'utf-8');
  return saved;
}

module.exports = { approvalPath, loadApproval, saveApproval };
