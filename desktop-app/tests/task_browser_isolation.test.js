const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

assert.match(mainSource, /const AUTOMATION_TAB_ID = 'automation'|AUTOMATION_TAB_ID,/);
assert.match(mainSource, /function ensureTaskBrowserTab\(\)/);
assert.match(
  mainSource,
  /openUrl:\s*async \(url\) => \{[\s\S]*?const taskView = ensureTaskBrowserTab\(\);[\s\S]*?taskView\.webContents\.loadURL\(finalUrl\)/
);
assert.match(
  mainSource,
  /checkLogin:\s*\(\) => pgyCheckLogin\(taskBrowserView\?\.webContents\)/
);
assert.match(
  mainSource,
  /pgyExtractCurrentMultiPage\(templatePath, options, taskBrowserView\?\.webContents\)/
);
assert.match(
  mainSource,
  /safeId === COLLECTION_TAB_ID \|\| safeId === AUTOMATION_TAB_ID/
);
assert.match(mainSource, /mainWindow\.addBrowserView\(view\)/);
assert.match(mainSource, /mainWindow\.setTopBrowserView\(activeView\)/);
assert.doesNotMatch(mainSource, /mainWindow\?\.setBrowserView\(view\)/);
assert.doesNotMatch(
  mainSource,
  /openUrl:\s*async \(url\) => \{[\s\S]{0,300}ensureCollectionTabActive\(\)/
);

console.log('task_browser_isolation.test.js passed');
