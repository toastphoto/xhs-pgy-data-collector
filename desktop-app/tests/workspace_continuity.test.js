const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

const candidateReadStart = mainSource.indexOf('async function readPgyCandidatesFromResponsePages');
const candidateReadEnd = mainSource.indexOf('async function validateCandidateCheckpointSession', candidateReadStart);
assert.ok(candidateReadStart >= 0 && candidateReadEnd > candidateReadStart);
const candidateReadSource = mainSource.slice(candidateReadStart, candidateReadEnd);

assert.match(candidateReadSource, /const failIncomplete = async \(code, error\) => \{\s+await restoreStartPage\(\);/);
const completedRangeStart = candidateReadSource.lastIndexOf('const resultItems = items.slice');
assert.ok(completedRangeStart >= 0);
const completedRangeSource = candidateReadSource.slice(completedRangeStart);
assert.doesNotMatch(completedRangeSource, /await restoreStartPage\(\)/);

const mailHandlerStart = mainSource.indexOf("ipcMain.handle('contacts:openTencentEmail'");
const mailHandlerEnd = mainSource.indexOf('function resolvePgyInviteTargetPayload', mailHandlerStart);
assert.ok(mailHandlerStart >= 0 && mailHandlerEnd > mailHandlerStart);
const mailHandlerSource = mainSource.slice(mailHandlerStart, mailHandlerEnd);

const ensureMailStart = mainSource.indexOf('function ensureMailBrowserTab()');
const ensureMailEnd = mainSource.indexOf('function ensureXhsBrowserTab()', ensureMailStart);
assert.ok(ensureMailStart >= 0 && ensureMailEnd > ensureMailStart);
const ensureMailSource = mainSource.slice(ensureMailStart, ensureMailEnd);
assert.match(ensureMailSource, /id: MAIL_TAB_ID,/);
assert.match(ensureMailSource, /role: 'mail'/);
assert.match(ensureMailSource, /closable: false/);
assert.match(mailHandlerSource, /const currentUrl = mailView\.webContents\.getURL\(\) \|\| '';/);
assert.match(mailHandlerSource, /reusedExistingPage = isAllowedTencentMailUrl\(currentUrl\);/);
assert.match(mailHandlerSource, /if \(!reusedExistingPage\) await mailView\.webContents\.loadURL\(TENCENT_MAIL_HOME_URL\);/);

console.log('workspace_continuity.test.js passed');
