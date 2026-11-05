const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const renderer = fs.readFileSync(path.join(__dirname, '../renderer/views/exports.js'), 'utf8');
const components = fs.readFileSync(path.join(__dirname, '../renderer/ui/components.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../renderer/app.css'), 'utf8');
function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}
const setup = `
  const store = {state:{}, set() { window.renderFixture(); }};
  const loadOutreachTemplateLibrary = () => ({});
  const createReviewViewportStateRegistry = () => ({});
  window.exportCalls = [];
  window.desktopAPI = {exports:{
    saveColumnPreset: async () => ({ok:true}),
    exportResourceRun: async (payload) => {
      window.exportCalls.push(payload);
      return {ok:true, outPath:'fixture.xlsx', creators:1, exportedCols:payload.selectedColumns.length, emptyColumns:['地区']};
    }
  }};
  ${components.replace(/^export /gm, '')}
  ${section(renderer, 'let _runs = [];', 'function setContactSaveStatus(')}
  ${section(renderer, 'async function exportSelectedResourceColumns()', 'function clearPgyInviteDraftReadiness(')}
  ${section(renderer, 'function _filteredColumns(', 'function getReviewRows(')}
  _selectedRunDir = 'fixture-run';
  _runs = [{path:'fixture-run', name:'run_export_fixture'}];
  _columns = ['达人昵称', '粉丝数', '图文笔记一口价', '视频笔记一口价', '阅读中位数', '地区'];
  _checked = new Set(_columns);
  function renderPanel() {
    const root = document.createElement('div'); root.className = 'view';
    ${section(renderer, "  const bar = document.createElement('div');", "  const contactSec = document.createElement('div');")}
    ${section(renderer, '  // Keep column settings beside', '\n  return root;')}
    return root;
  }
  window.renderFixture = () => document.getElementById('mount').replaceChildren(renderPanel());
  window.renderFixture();
`;

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}) });
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'pgy-resource-ui-'));
  try {
    const context = await browser.newContext();
    // Serve only the isolated test document; no operator profile or platform requests.
    await context.route('**/*', (route) => route.fulfill({contentType:'text/html', body:'<!doctype html><meta charset="utf-8"><div id="mount" style="padding:16px"></div>'}));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://fixture.test/');
    await page.addStyleTag({content:css});
    await page.addScriptTag({content:setup});
    assert.deepEqual(errors, [], 'fixture initialization');
    const details = page.locator('.resource-column-settings');
    assert.equal(await details.evaluate((el) => el.open), false);
    await page.locator('summary').click();
    await page.getByLabel('粉丝数', {exact:true}).uncheck();
    assert.equal(await details.evaluate((el) => el.open), true);
    await page.getByRole('button', {name:'导出达人资源表', exact:true}).click();
    await page.getByRole('status').filter({hasText:'导出成功'}).waitFor();
    assert.deepEqual(await page.evaluate(() => window.exportCalls[0].selectedColumns), ['达人昵称','图文笔记一口价','视频笔记一口价','阅读中位数','地区']);
    for (const width of [950, 650, 400]) {
      await page.setViewportSize({width, height:850});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, 'horizontal overflow at ' + width);
      const clipped = await page.locator('button, input, select, summary').evaluateAll((els) => els.filter((el) => el.getClientRects().length && (el.getBoundingClientRect().right > innerWidth || el.getBoundingClientRect().left < 0)).map((el) => el.textContent));
      assert.deepEqual(clipped, [], 'clipped controls at ' + width);
      await page.screenshot({path:path.join(output, 'expanded-' + width + '.png'), fullPage:true});
    }
    await page.locator('summary').click();
    assert.equal(await details.evaluate((el) => el.open), false);
    await page.screenshot({path:path.join(output, 'collapsed-400.png'), fullPage:true});
    assert.deepEqual(errors, []);
    console.log('resource_export.ui.test.js passed: isolated source toolbar, 950/650/400 px, no platform access');
    console.log('Screenshots: ' + output);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
