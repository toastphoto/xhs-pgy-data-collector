const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');

const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const renderer = fs.readFileSync(path.join(__dirname, '..', 'renderer/views/exports.js'), 'utf8');
function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}
const exportSource = section(main, 'function getResourceTableColumns()', "ipcMain.handle('exports:getResourceColumns'");
const ipcSource = section(main, "ipcMain.handle('exports:exportResourceRun'", "ipcMain.handle('exports:exportContactRun'");
function harness(objects, excel = ExcelJS) {
  const handlers = {};
  const dependencies = {
    fs: { readFileSync: (file) => JSON.stringify(objects[Number(path.basename(file))]) },
    path, cleanStr: (v) => String(v ?? '').trim(), ExcelJS: excel, XLSX,
    findRawResultFiles: () => objects.map((_, i) => String(i)),
    ipcMain: { handle: (name, handler) => { handlers[name] = handler; } },
    resolveInsideRuns: (dir) => dir, listRunDirs: () => []
  };
  // ExcelJS uses instanceof Array; execute with its native realm for real XLSX I/O.
  const context = new Function('deps', `const { ${Object.keys(dependencies).join(',')} } = deps;
    ${exportSource}
    ${ipcSource}
    return { exportRunToResourceXlsx, normalizeSelectedColumns };`)(dependencies);
  return { context, run: (dir, opts) => context.exportRunToResourceXlsx(dir, opts),
    ipc: (payload) => handlers['exports:exportResourceRun']({}, payload) };
}
const fixture = {
  creator_summary: { creator_name: 'fixture', followers: 89353, price_image: 1200, price_video: 0 },
  metrics: { '近90天笔记阅读中位数': 10998, '近90天笔记互动中位数': 1135 }
};
for (const [name, excel] of [['ExcelJS', ExcelJS], ['SheetJS fallback', null]]) {
  test(name + ': selected headers, mapped values, zero and empty fields survive workbook round trip', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgy-resource-export-'));
    try {
      const h = harness([fixture], excel);
      const columns = ['达人昵称', '粉丝数', '图文笔记一口价', '视频笔记一口价', '阅读中位数', '互动中位数', '地区'];
      const result = await h.run(dir, { selectedColumns: columns, mode: 'slim' });
      assert.equal(result.exportedCols, 7);
      assert.equal(result.droppedCols, 0);
      assert.deepEqual(Array.from(result.emptyColumns), ['地区']);
      const book = XLSX.readFile(result.outPath);
      const data = XLSX.utils.sheet_to_json(book.Sheets['媒介资源表'], { header: 1, defval: '' });
      assert.deepEqual(data[0], columns);
      assert.deepEqual(data[1], ['fixture', '89353', '1200', '0', '10998', '1135', '']);
      const second = await h.run(dir, { selectedColumns: ['地区'], mode: 'slim' });
      const changed = XLSX.readFile(second.outPath);
      assert.deepEqual(XLSX.utils.sheet_to_json(changed.Sheets['媒介资源表'], { header: 1, defval: '' })[0], ['地区']);
    } finally {
      assert.ok(path.basename(dir).startsWith('pgy-resource-export-'));
      assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
test('invalid or cleared selections never silently export all columns; missing files fail', async () => {
  const h = harness([fixture]);
  for (const selectedColumns of [[], ['unknown'], '粉丝数']) {
    await assert.rejects(h.run('fixture', { selectedColumns }), /有效导出列|格式无效/);
  }
  await assert.rejects(harness([]).run('fixture', {}), /没有可导出/);
  assert.deepEqual(Array.from(h.context.normalizeSelectedColumns(['粉丝数', '粉丝数', 'unknown'], ['粉丝数'])), ['粉丝数']);
});
test('canonical metrics win over summary fallbacks and preserve zero', () => {
  let row;
  class Workbook {
    constructor() { this.xlsx = { writeFile: async () => {} }; }
    addWorksheet() { return {
      getRow: () => ({ eachCell() {} }),
      addRow: (values) => { row = values; return { eachCell() {} }; }
    }; }
  }
  return harness([{ ...fixture, metrics: { '粉丝数': 0, '图文笔记一口价': 500 },
    notes_top10: [{ '阅读': 0, '点赞': 0, '收藏': 0 }] }], { Workbook })
    .run('fixture', { selectedColumns: ['粉丝数', '图文笔记一口价', '笔记1-阅读', '笔记1-点赞', '笔记1-收藏'] })
    .then(() => assert.deepEqual(Array.from(row), ['0', '500', '0', '0', '0']));
});
test('IPC waits for the actual writer and reports writer rejection as failure', async () => {
  let finish;
  const gate = new Promise((resolve) => { finish = resolve; });
  class Workbook {
    constructor() { this.xlsx = { writeFile: () => gate }; }
    addWorksheet() { return { getRow: () => ({ eachCell() {} }), addRow: () => ({ eachCell() {} }) }; }
  }
  const h = harness([fixture], { Workbook });
  let settled = false;
  const pending = h.ipc({ runDir: 'fixture', selectedColumns: ['粉丝数'] }).then((r) => { settled = true; return r; });
  await new Promise(setImmediate);
  assert.equal(settled, false);
  finish();
  assert.equal((await pending).ok, true);
  const broken = harness([fixture], { Workbook: class extends Workbook {
    constructor() { super(); this.xlsx.writeFile = async () => { throw new Error('fixture write failed'); }; }
  } });
  const result = await broken.ipc({ runDir: 'fixture', selectedColumns: ['粉丝数'] });
  assert.equal(result.ok, false);
  assert.match(result.error, /fixture write failed/);
});

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.handlers = {}; this.style = {}; }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(name, callback) { this.handlers[name] = callback; }
}
function walk(el) { return [el, ...el.children.flatMap(walk)]; }
function uiHarness(save = async () => ({ ok: true })) {
  const calls = [];
  const context = vm.createContext({
    document: { createElement: (tag) => new Element(tag), createTextNode: (text) => ({ textContent: text, children: [] }) },
    window: { localStorage: {}, desktopAPI: { exports: {
      saveColumnPreset: save,
      exportResourceRun: async (payload) => {
        calls.push(JSON.parse(JSON.stringify(payload)));
        return { ok: true, outPath: 'fixture.xlsx', creators: 1, exportedCols: payload.selectedColumns.length, emptyColumns: ['地区'] };
      }
    } } },
    store: { state: {}, set() {} }, createReviewViewportStateRegistry: () => ({}),
    loadOutreachTemplateLibrary: () => ({}),
    switchSelectedContactRun: async () => true
  });
  const components = fs.readFileSync(path.join(__dirname, '..', 'renderer/ui/components.js'), 'utf8');
  vm.runInContext(components.replace(/^export /gm, ''), context);
  vm.runInContext(section(renderer, 'let _runs = [];', 'function setContactSaveStatus('), context);
  vm.runInContext(section(renderer, 'async function exportSelectedResourceColumns()', 'function clearPgyInviteDraftReadiness('), context);
  vm.runInContext(section(renderer, 'async function ensureColumnsLoaded(', 'function _filteredColumns('), context);
  vm.runInContext(section(renderer, 'function _filteredColumns(', 'function getReviewRows('), context);
  const bar = section(renderer, "  const bar = document.createElement('div');", "  const contactSec = document.createElement('div');");
  const settings = section(renderer, '  // Keep column settings beside', '\n  return root;');
  vm.runInContext('function renderPanel() { const root = document.createElement("div");' + bar + settings + 'return root;}', context);
  const evaluate = (source) => vm.runInContext(source, context);
  evaluate("_selectedRunDir = 'fixture-a'; _runs = [{path:'fixture-a',name:'fixture'}]; _columns = ['达人昵称','粉丝数','地区']; _checked = new Set(_columns);");
  return { calls, context, evaluate, render: () => context.renderPanel() };
}
test('one export action shares its section with collapsed settings; toggles and selections survive rerenders', async () => {
  const h = uiHarness();
  let panel = h.render();
  let nodes = walk(panel);
  assert.equal(nodes.filter((n) => n.textContent === '导出达人资源表').length, 1);
  let details = nodes.find((n) => n.tagName === 'details');
  assert.equal(details.open, false);
  assert.ok(panel.children[0].children.includes(details));
  details.open = true;
  details.handlers.toggle();
  panel = h.render();
  nodes = walk(panel);
  details = nodes.find((n) => n.tagName === 'details');
  assert.equal(details.open, true);
  const checkboxes = nodes.filter((n) => n.type === 'checkbox');
  checkboxes[1].checked = false;
  checkboxes[1].handlers.change();
  panel = h.render();
  nodes = walk(panel);
  await nodes.find((n) => n.textContent === '导出达人资源表').handlers.click();
  assert.deepEqual(h.calls[0].selectedColumns, ['达人昵称', '地区']);
  assert.match(h.evaluate('_msg'), /暂无数据的列（已保留）：地区/);
  h.evaluate('_checked.clear()');
  assert.equal(walk(h.render()).find((n) => n.textContent === '导出达人资源表').disabled, true);
});
test('resource export freezes run/columns before preset save and prevents duplicate clicks', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const h = uiHarness(() => gate);
  const pending = h.context.exportSelectedResourceColumns();
  assert.equal(h.evaluate('_resourceExportBusy'), true);
  h.evaluate("_selectedRunDir = 'fixture-b'; _checked.clear()");
  await h.context.exportSelectedResourceColumns();
  release({ ok: true });
  await pending;
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].runDir, 'fixture-a');
  assert.deepEqual(h.calls[0].selectedColumns, ['达人昵称', '粉丝数', '地区']);
  assert.equal(h.evaluate('_resourceExportBusy'), false);
});
test('failed preset persistence is visible and cannot start a workbook export', async () => {
  const h = uiHarness(async () => ({ ok: false, error: 'fixture preset failure' }));
  await h.context.exportSelectedResourceColumns();
  assert.equal(h.calls.length, 0);
  assert.match(h.evaluate('_msg'), /导出失败：fixture preset failure/);
});

test('failed column loading stays disabled and can be explicitly retried without stale preset columns', async () => {
  const h = uiHarness();
  const api = h.context.window.desktopAPI.exports;
  api.getResourceColumns = async () => ({ ok: false, error: 'fixture unavailable' });
  await h.context.ensureColumnsLoaded();
  assert.equal(h.evaluate('_columns.length'), 0);
  assert.match(h.evaluate('_msg'), /导出列加载失败/);
  api.getResourceColumns = async () => ({ ok: true, columns: ['粉丝数'], groups: [] });
  api.loadColumnPreset = async () => ({ ok: false, error: 'fixture preset read failed' });
  await h.context.ensureColumnsLoaded(true);
  assert.equal(h.evaluate('_columns.length'), 0);
  api.loadColumnPreset = async () => ({ ok: true, selectedColumns: ['粉丝数', 'removed'], knownColumns: ['粉丝数'] });
  await h.context.ensureColumnsLoaded(true);
  assert.deepEqual(Array.from(h.evaluate('_checked')), ['粉丝数']);
});
