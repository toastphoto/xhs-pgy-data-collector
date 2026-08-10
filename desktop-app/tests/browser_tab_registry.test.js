const assert = require('assert');
const {
  BrowserTabRegistry,
  COLLECTION_TAB_ID,
  MAIL_TAB_ID,
  XHS_TAB_ID
} = require('../lib/browser_tab_registry');

const tabs = new BrowserTabRegistry();
tabs.add({ id: COLLECTION_TAB_ID, role: 'collection', title: '采集', closable: false });
tabs.add({ id: XHS_TAB_ID, role: 'xhs-profile', title: '小红书主页', closable: true });
tabs.add({ id: MAIL_TAB_ID, role: 'mail', title: '企业邮箱', closable: true });

assert.strictEqual(tabs.activeId, COLLECTION_TAB_ID);
tabs.activate(MAIL_TAB_ID);
assert.strictEqual(tabs.activeId, MAIL_TAB_ID);
assert.throws(() => tabs.close(COLLECTION_TAB_ID), /cannot be closed/);
tabs.close(MAIL_TAB_ID);
tabs.close(XHS_TAB_ID);
assert.strictEqual(tabs.activeId, COLLECTION_TAB_ID);
assert.deepStrictEqual(tabs.list().map((tab) => tab.id), [COLLECTION_TAB_ID]);

console.log('browser_tab_registry.test.js passed');
