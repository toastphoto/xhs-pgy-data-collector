const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const mainPath = path.join(__dirname, '..', 'main.js');
const source = fs.readFileSync(mainPath, 'utf8');
const start = source.indexOf('async function pgyExtractResourceDelta(');
const end = source.indexOf('async function pgySuggestNoteCardSelectorForCurrentPage(', start);
assert.ok(start >= 0 && end > start);
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context, { filename: mainPath });

for (const tab of ['base', '数据概览', '笔记数据', '粉丝分析']) {
  test(`generated resource script parses: ${tab}`, async () => {
    let executed = false;
    await context.pgyExtractResourceDelta({
      executeJavaScript: async (script) => {
        new vm.Script(script);
        executed = true;
        return { creator: {}, metrics: {}, notesTop: [] };
      }
    }, tab, '');
    assert.equal(executed, true, 'A swallowed page-script syntax error must fail this regression');
  });
}

test('base identity comes from the creator card, not the signed-in account', async () => {
  const profile = 'https://www.xiaohongshu.com/user/profile/fixture-public-id';
  const selectors = new Map([
    ['.blogger-base-info .blogger-name', { innerText: 'Fixture Creator' }],
    ['.base-info-item.blogger-redid a', {
      innerText: 'fixture-account', href: profile,
      getAttribute: (name) => name === 'href' ? profile : null
    }],
    ['h1', { textContent: 'Unrelated Signed-In Company' }]
  ]);
  const document = {
    body: { innerText: 'Fixture Creator\n小红书号：fixture-account' },
    querySelector: (selector) => selectors.get(selector) || null,
    querySelectorAll: () => []
  };
  const result = await context.pgyExtractResourceDelta({
    executeJavaScript: async (script) => vm.runInNewContext(script, { document })
  }, 'base', '');
  assert.equal(result.creator.creator_name, 'Fixture Creator');
  assert.equal(result.creator.xhs_id, 'fixture-account');
  assert.equal(result.creator.xhs_profile_url, profile);
});

test('a page-script syntax error cannot become a successful empty delta', async () => {
  await assert.rejects(context.pgyExtractResourceDelta({
    executeJavaScript: async () => { throw new SyntaxError('Invalid regular expression flags'); }
  }, 'base', ''), (error) => error.code === 'PGY_RESOURCE_SCRIPT_INVALID');
});

test('the multi-page caller preserves the resource-script failure', () => {
  const start = source.indexOf('async function pgyExtractCurrentMultiPage(');
  const extractOnce = source.slice(start, source.indexOf('return extracted;', start));
  assert.match(extractOnce, /if \(\['PGY_RESOURCE_SCRIPT_INVALID', 'PGY_RESOURCE_READ_FAILED'\]\.includes\(error\?\.code\)\) throw error;/);
});

test('Electron-wrapped base script failures also stop unreliable identity output', async () => {
  await assert.rejects(context.pgyExtractResourceDelta({
    executeJavaScript: async () => { throw new Error('Script failed to execute'); }
  }, '', ''), (error) => error.code === 'PGY_RESOURCE_READ_FAILED');
});

test('an optional metrics tab read failure still leaves missing metrics empty', async () => {
  const result = await context.pgyExtractResourceDelta({
    executeJavaScript: async () => { throw new Error('Unavailable optional tab'); }
  }, '粉丝分析', '');
  assert.equal(Object.keys(result.creator).length, 0);
  assert.equal(Object.keys(result.metrics).length, 0);
});
