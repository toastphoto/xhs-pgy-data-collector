import assert from 'node:assert/strict';
import {
  createDefaultOutreachTemplateLibrary,
  createOutreachTemplateId,
  deleteOutreachTemplate,
  getSelectedOutreachTemplate,
  loadOutreachTemplateLibrary,
  normalizeOutreachTemplateLibrary,
  resolveOutreachTemplateText,
  restoreOutreachVariable,
  saveOutreachTemplateLibrary,
  setDefaultOutreachTemplate,
  upsertOutreachTemplate
} from '../renderer/state/outreach_templates.mjs';

const defaults = createDefaultOutreachTemplateLibrary();
assert.equal(defaults.channels.wechat.templates.length, 2);
assert.equal(defaults.channels.email.templates.length, 2);
assert.equal(defaults.channels.pgy.templates.length, 2);
assert.match(getSelectedOutreachTemplate(defaults, 'email').subject, /\{\{项目名称\}\}/);

assert.equal(
  resolveOutreachTemplateText('{{项目名称}}合作邀约 / {{微信号}}', { 项目名称: '安踏项目' }),
  '安踏项目合作邀约 / {{微信号}}'
);
assert.equal(restoreOutreachVariable('安踏项目合作邀约', '安踏项目', '项目名称'), '{{项目名称}}合作邀约');

let library = upsertOutreachTemplate(defaults, 'wechat', {
  id: 'wechat-personal',
  name: '我的模板',
  body: '你好，聊聊{{项目名称}}'
});
assert.equal(getSelectedOutreachTemplate(library, 'wechat').name, '我的模板');
assert.equal(library.channels.wechat.templates.length, 3);

library = setDefaultOutreachTemplate(library, 'wechat', 'wechat-personal');
assert.equal(library.channels.wechat.templates.filter((item) => item.isDefault).length, 1);
assert.equal(library.channels.wechat.templates.find((item) => item.isDefault).id, 'wechat-personal');

const deleted = deleteOutreachTemplate(library, 'wechat', 'wechat-personal');
assert.equal(deleted.ok, true);
assert.equal(deleted.library.channels.wechat.templates.length, 2);
assert.equal(deleted.library.channels.wechat.templates.filter((item) => item.isDefault).length, 1);

let single = normalizeOutreachTemplateLibrary({
  channels: {
    wechat: { templates: [{ id: 'only', name: '唯一模板', body: 'hello', isDefault: true }] }
  }
});
assert.equal(deleteOutreachTemplate(single, 'wechat', 'only').reason, 'last_template');

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value)
};
saveOutreachTemplateLibrary(storage, library);
assert.deepEqual(loadOutreachTemplateLibrary(storage), normalizeOutreachTemplateLibrary(library));
assert.match(createOutreachTemplateId('email', 123), /^email-123$/);

console.log('outreach_templates.test.mjs passed');
