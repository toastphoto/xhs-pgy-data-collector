const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildPgyInviteEntryInspectScript,
  buildPgyInviteOutcomeScript,
  buildPgyInvitePrepareScript,
  buildPgyInviteSendScript,
  isAllowedPgyInviteNavigationUrl,
  normalizePgyInviteFormUrl,
  normalizePgyInviteTemplate,
  normalizePgyInviteCreatorUrl,
  resolveInviteTargetFromRows,
  validatePgyInviteTemplate
} = require('../lib/pgy_invite');

const appRoot = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(appRoot, 'main.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(appRoot, 'preload.js'), 'utf8');
const rendererSource = fs.readFileSync(path.join(appRoot, 'renderer', 'app.js'), 'utf8');
const rendererCss = fs.readFileSync(path.join(appRoot, 'renderer', 'app.css'), 'utf8');
const exportsSource = fs.readFileSync(path.join(appRoot, 'renderer', 'views', 'exports.js'), 'utf8');

const ensureStart = mainSource.indexOf('function ensurePgyInviteBrowserTab()');
const ensureEnd = mainSource.indexOf('\nfunction closeBrowserTab', ensureStart);
assert.ok(ensureStart > 0 && ensureEnd > ensureStart, 'invite BrowserView factory must exist');
const ensureSource = mainSource.slice(ensureStart, ensureEnd);
assert.match(ensureSource, /partition:\s*'persist:pgy_invite'/);
assert.doesNotMatch(ensureSource, /persist:pgy_default/);
assert.match(ensureSource, /role:\s*'pgy-invite'/);

assert.match(mainSource, /ipcMain\.handle\('invites:openAccount'/);
assert.match(mainSource, /ipcMain\.handle\('invites:checkLogin'/);
assert.match(mainSource, /ipcMain\.handle\('invites:openCreator'/);
assert.match(mainSource, /ipcMain\.handle\('invites:prepare'/);
assert.match(mainSource, /ipcMain\.handle\('invites:sendPrepared'/);
assert.match(mainSource, /resolveInsideRuns\(payload\?\.runDir/);
assert.match(mainSource, /resolveInviteTargetFromRows\(preview\?\.rows, payload\?\.rowId\)/);
assert.match(mainSource, /activateBrowserTab\(PGY_INVITE_TAB_ID\)/);
assert.match(mainSource, /await inviteView\.webContents\.loadURL\(url\);\s*activateBrowserTab\(PGY_INVITE_TAB_ID, \{ force: true \}\)/);
assert.match(mainSource, /PGY_INVITE_ADDRESS_READ_ONLY/);
assert.match(mainSource, /tabId === PGY_INVITE_TAB_ID && !isAllowedPgyInviteNavigationUrl\(url\)/);

assert.strictEqual(
  normalizePgyInviteCreatorUrl('https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123?source=list'),
  'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123'
);
assert.strictEqual(normalizePgyInviteCreatorUrl('https://www.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123'), '');
assert.strictEqual(normalizePgyInviteCreatorUrl('https://evil.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123'), '');
assert.strictEqual(normalizePgyInviteCreatorUrl('https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123/extra'), '');
assert.strictEqual(isAllowedPgyInviteNavigationUrl('https://pgy.xiaohongshu.com/login'), true);
assert.strictEqual(isAllowedPgyInviteNavigationUrl('http://pgy.xiaohongshu.com/login'), false);
assert.strictEqual(isAllowedPgyInviteNavigationUrl('https://www.xiaohongshu.com/login'), false);
assert.strictEqual(
  normalizePgyInviteFormUrl('https://pgy.xiaohongshu.com/solar/pre-trade/invite-form?id=ABC12345&trackId=discarded'),
  'https://pgy.xiaohongshu.com/solar/pre-trade/invite-form?id=ABC12345'
);
assert.strictEqual(normalizePgyInviteFormUrl('https://evil.xiaohongshu.com/solar/pre-trade/invite-form?id=ABC12345'), '');
assert.deepStrictEqual(
  resolveInviteTargetFromRows(
    [{ rowId: 'row-1', creatorName: '甲', creatorUrl: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123?source=list' }],
    'row-1'
  ),
  {
    rowId: 'row-1',
    creatorName: '甲',
    creatorUrl: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123'
  }
);
assert.strictEqual(
  resolveInviteTargetFromRows(
    [{ rowId: 'row-1', creatorUrl: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123' }],
    'row-2'
  ),
  null
);
assert.deepStrictEqual(
  normalizePgyInviteTemplate({
    cooperationType: '视频',
    cooperationMode: '种收联动',
    intro: '  固定话术  ',
    brandName: '品牌'
  }),
  {
    cooperationGoal: '笔记合作',
    cooperationMode: '种收联动',
    contactMethod: '线上邀约',
    contactChannel: '微信',
    brandName: '品牌',
    productName: '',
    contactWay: '',
    intro: '固定话术',
    publishStart: '',
    publishEnd: ''
  }
);
assert.strictEqual(normalizePgyInviteTemplate({ cooperationGoal: '直播合作' }).cooperationGoal, '直播合作');
const completeTemplate = {
  cooperationGoal: '笔记合作',
  cooperationMode: '定制合作',
  contactChannel: '手机号',
  brandName: '品牌A',
  productName: '产品A',
  contactWay: '13800138000',
  intro: '产品介绍与笔记要求',
  publishStart: '2026-09-01',
  publishEnd: '2026-09-10'
};
assert.strictEqual(validatePgyInviteTemplate(completeTemplate).ok, true);
assert.strictEqual(validatePgyInviteTemplate({}).ok, false);
assert.match(validatePgyInviteTemplate({ ...completeTemplate, productName: '123456789012345678901' }).errors.join('；'), /最多 20/);
assert.match(buildPgyInviteEntryInspectScript(completeTemplate), /inspectPgyInviteEntryInPage/);
assert.match(buildPgyInviteEntryInspectScript(completeTemplate), /open-detail-form/);
assert.match(buildPgyInviteEntryInspectScript(completeTemplate), /visibleRight - visibleLeft/);
assert.match(buildPgyInviteEntryInspectScript(completeTemplate), /exactClickable\(modal, '发起邀约'\) \|\| helpers\.exactClickable\(document, '发起邀约'\)/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /preparePgyInviteDetailFormInPage/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /请输入品牌名称\/ID搜索/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /aria-placeholder/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /brandHintNode\?\.closest\('\[role="combobox"\]/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /visibleAncestor\(brandInput\?\.parentElement\)[\s\S]*?visibleAncestor\(brandInput\)/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /centerPoint\(brandInput\)[\s\S]*?centerPoint\(brandHintNode\)[\s\S]*?pointRightOfLabel\(brandLabelNode, 130\)[\s\S]*?centerPoint\(brandTrigger \|\| brandContainer\)/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /type: 'open-brand-picker'[\s\S]*?value: template\.brandName/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /optionPoint[\s\S]*?type: 'select-brand'/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /selectedBrandNode/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /brandSearchHint \? brandInput : null/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /fieldRightOfLabel\(root, brandLabelNode\)/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /setFieldValue\(searchInput, template\.brandName, \{ blur: false \}\)/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /合作内容介绍/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /querySelectorAll\('button'\)[\s\S]*?发起邀约/);
assert.match(buildPgyInvitePrepareScript(completeTemplate), /finalButton\.scrollIntoView\(\{ block: 'center', inline: 'nearest' \}\)/);
assert.match(buildPgyInviteSendScript(completeTemplate), /verifyPreparedPgyInviteInPage/);
assert.match(buildPgyInviteSendScript(completeTemplate), /PGY_INVITE_FORM_CHANGED/);
assert.match(buildPgyInviteOutcomeScript(), /inspectPgyInviteOutcomeInPage/);
assert.doesNotThrow(() => new Function(`return ${buildPgyInviteEntryInspectScript(completeTemplate)};`));
assert.doesNotThrow(() => new Function(`return ${buildPgyInvitePrepareScript(completeTemplate)};`));
assert.doesNotThrow(() => new Function(`return ${buildPgyInviteSendScript(completeTemplate)};`));

assert.match(preloadSource, /invites:\s*\{/);
assert.match(preloadSource, /openCreator:\s*\(payload\)/);
assert.match(preloadSource, /prepare:\s*\(payload\)/);
assert.match(preloadSource, /sendPrepared:\s*\(payload\)/);
assert.match(rendererSource, /tab\.role === 'pgy-invite' \? '邀约账号'/);
assert.match(rendererSource, /\['\+ 邀约账号'\]/);
assert.match(rendererSource, /inviteAddressReadOnly/);
assert.match(rendererSource, /class: 'browser-role-switch'/);
assert.match(rendererSource, /role: 'collection', label: '采集页'/);
assert.match(rendererSource, /role: 'pgy-invite', label: '邀约账号'/);
assert.match(rendererCss, /#app\s*\{[\s\S]*?overflow:\s*hidden/);
assert.match(rendererCss, /#body\s*\{[\s\S]*?min-height:\s*0[\s\S]*?overflow:\s*hidden/);
assert.match(rendererCss, /\.contact-pgy-link\s*\{[\s\S]*?margin-right:\s*6px[\s\S]*?border:\s*1px solid/);
assert.match(exportsSource, /window\.desktopAPI\.invites\.openCreator\(\{/);
assert.match(exportsSource, /runDir:\s*_selectedRunDir/);
assert.match(exportsSource, /rowId/);
assert.match(exportsSource, /result\?\.loggedIn && !result\?\.riskDetected/);
assert.match(exportsSource, /邀约账号需要人工处理安全验证/);
assert.match(exportsSource, /当前仅打开页面，不会填写或发送邀约/);
assert.match(exportsSource, /准备邀约/);
assert.match(exportsSource, /确认发送/);
assert.match(exportsSource, /联系方式披露方式/);
assert.match(exportsSource, /合作内容介绍/);
assert.match(exportsSource, /由邀约账号自动带入/);
assert.match(exportsSource, /\.pgy-invite-row-status, \.contact-pgy-action\.send/);
assert.match(mainSource, /draft\.token !== String\(payload\?\.token/);
assert.match(mainSource, /draft\.fingerprint !== String\(payload\?\.fingerprint/);
assert.match(mainSource, /Date\.now\(\) > draft\.expiresAt/);
assert.match(mainSource, /currentUrl !== target\.creatorUrl/);
assert.match(mainSource, /targetUrlDeadline = Date\.now\(\) \+ 8000/);
assert.match(mainSource, /if \(currentUrl === target\.creatorUrl\) break/);
assert.match(mainSource, /drivePgyInviteToDetailForm\(inviteView, template\)/);
assert.match(mainSource, /preparePgyInviteDetailForm\(inviteView, template\)/);
assert.match(mainSource, /retryableEntryCodes\.has\(lastResult\?\.code\)[\s\S]*?await sleep\(250\)[\s\S]*?continue/);
assert.match(mainSource, /PGY_INVITE_ENTRY_ACTION_NOT_FOUND/);
assert.match(mainSource, /PGY_INVITE_ENTRY_ACTION_DISABLED/);
assert.match(mainSource, /retryablePrepareCodes = new Set\(\[[\s\S]*?PGY_INVITE_DETAIL_FORM_NOT_FOUND/);
assert.match(mainSource, /retryablePrepareCodes\.has\(lastResult\?\.code\)[\s\S]*?await sleep\(250\)[\s\S]*?continue/);
assert.match(mainSource, /PGY_INVITE_FORM_PREPARE_TIMEOUT[\s\S]*?lastResult\.action\.type/);
assert.match(mainSource, /async function sendTrustedPgyInviteText\(webContents, value\)/);
assert.match(mainSource, /async function focusPgyInviteFieldAtPoint\(webContents, point\)/);
assert.match(mainSource, /document\.elementFromPoint/);
assert.match(mainSource, /document\.activeElement === field/);
assert.match(mainSource, /Object\.getOwnPropertyDescriptor\(prototype, 'value'\)\?\.set/);
assert.match(mainSource, /webContents\.insertText\(text\)/);
assert.doesNotMatch(mainSource, /keyCode: 'A', modifiers/);
assert.match(mainSource, /lastResult\.action\.type === 'open-brand-picker'[\s\S]*?focusPgyInviteFieldAtPoint[\s\S]*?sendTrustedPgyInviteText/);
assert.match(mainSource, /lastResult\.missingFields\.length === 0[\s\S]*?lastResult\?\.finalAction\?\.found[\s\S]*?await sleep\(350\)[\s\S]*?continue/);
assert.match(mainSource, /currentCreatorUrl !== url\) await inviteView\.webContents\.loadURL\(url\)/);
assert.match(mainSource, /settleDeadline = Date\.now\(\) \+ 3000[\s\S]*?normalizePgyInviteCreatorUrl[\s\S]*?return successResult\(\)/);
assert.match(mainSource, /currentUrl !== draft\.formUrl/);
assert.match(mainSource, /sendTrustedPgyInviteClick\(inviteView\.webContents, verified\.finalAction\.point\)/);
assert.match(mainSource, /pgyInvitePreparedDraft = null;\s*try \{\s*activateBrowserTab\(PGY_INVITE_TAB_ID/);

console.log('pgy_invite_account_isolation.test.js passed');
