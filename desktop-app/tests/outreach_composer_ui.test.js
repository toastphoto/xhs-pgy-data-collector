const assert = require('assert');
const fs = require('fs');
const path = require('path');

const exportsSource = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'views', 'exports.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.css'), 'utf8');

assert.match(exportsSource, /\['微信建联', '邮件建联', '蒲公英邀约'\]/);
assert.match(exportsSource, /label: '品牌项目名称'/);
assert.doesNotMatch(exportsSource, /textContent = '微信分组标签'/);
assert.match(exportsSource, /已将模板中的项目名称替换为/);
assert.match(exportsSource, /新增模板/);
assert.match(exportsSource, /保存到当前模板/);
assert.match(exportsSource, /另存为新模板/);
const templateManagerSource = exportsSource.slice(exportsSource.indexOf('function createOutreachTemplateManager('),
  exportsSource.indexOf('function createOutreachTemplateManager(') + exportsSource.slice(exportsSource.indexOf('function createOutreachTemplateManager(')).indexOf('\n  deleteButton.addEventListener'));
assert.doesNotMatch(templateManagerSource, /window\.prompt\(/, 'Electron does not support browser prompt dialogs');
assert.match(templateManagerSource, /nextTemplateName\('新模板'\)/);
assert.match(exportsSource, /删除当前模板/);
assert.match(exportsSource, /设为默认/);
assert.match(exportsSource, /仅生成或填写草稿，发送前必须人工确认/);
assert.match(exportsSource, /children: \[contactComposer\]/);
assert.match(exportsSource, /_contactComposerMethod === '微信建联'\) contactSec\.appendChild\(approvalBar\)/);
assert.match(exportsSource, /_contactComposerMethod === '邮件建联'\) reviewTop\.appendChild\(btnTencentEmail\)/);
assert.match(exportsSource, /_contactComposerMethod === '蒲公英邀约'\) reviewTop\.appendChild\(btnOpenPgyInvite\)/);
assert.match(exportsSource, /_contactComposerMethod === '蒲公英邀约'\) reviewTop\.appendChild\(btnCheckPgyInvite\)/);
assert.match(exportsSource, /_contactComposerMethod === '邮件建联' && _emailHandoffState\.status !== 'idle'/);
assert.match(exportsSource, /selectedInput\.checked = review\?\.selected === true && getContactExecutionChannel\(review\) === _contactComposerMethod/);
assert.match(exportsSource, /markReviewSelected\(review, _contactComposerMethod\)/);
assert.match(exportsSource, /蒲公英批量邀约（\$\{selectedContactRows\.length\}）/);
assert.match(exportsSource, /人工确认发送当前达人/);
assert.match(exportsSource, /已在右侧处理，下一位/);
assert.match(exportsSource, /已核对右侧，继续下一位/);
assert.match(exportsSource, /重试当前达人/);
assert.match(exportsSource, /跳过当前达人/);
assert.match(exportsSource, /停止批量邀约/);
const batchStartSource = exportsSource.slice(
  exportsSource.indexOf('async function startPgyInviteBatch'),
  exportsSource.indexOf('function stopPgyInviteBatch')
);
assert.doesNotMatch(batchStartSource, /sendPreparedPgyInviteForRow/);
assert.match(batchStartSource, /每一位真正发送前都必须由你人工确认/);
assert.match(exportsSource, /await new Promise\(\(resolve\) => setTimeout\(resolve, 5000\)\)/);
assert.match(cssSource, /\.contact-composer-tab\.active/);
assert.match(cssSource, /\.outreach-template-choice\.active/);
assert.match(cssSource, /\.pgy-invite-batch-panel/);

console.log('outreach_composer_ui.test.js OK');
