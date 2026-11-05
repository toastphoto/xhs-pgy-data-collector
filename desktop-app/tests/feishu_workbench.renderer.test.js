const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tagName) {
    this.tagName = tagName; this.children = []; this.handlers = {}; this.attributes = {}; this.dataset = {}; this.style = {};
    this.classList = { add: () => {} };
  }
  append(...children) { this.children.push(...children); for (const c of children) c.parent = this; }
  prepend(...children) { this.children.unshift(...children); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  hasAttribute(name) { return name in this.attributes; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  querySelector(selector) {
    const attr = ({ '[data-operator]': 'operator', '[data-prepare]': 'prepare', '[data-people]': 'people',
      '[data-cloud-prepare]': 'cloudPrepare', '[data-cloud-submit]': 'cloudSubmit',
      '[data-owned-absence]': 'ownedAbsence' })[selector];
    return walk(this).find(n => attr ? n.dataset?.[attr] : selector.startsWith('.')
      && n.className?.split(' ').includes(selector.slice(1))) || null;
  }
  remove() { this.parent.children = this.parent.children.filter(c => c !== this); }
}
const walk = node => [node, ...(node.children || []).flatMap(walk)];
function harness({ testMode = true } = {}) {
  const calls = [];
  const api = { status: async () => {
    calls.push('status'); return { ok: true, connected: false };
  }, searchMaintainers: async p => {
    calls.push('searchMaintainers'); assert.equal(p.name, 'Fixture Operator');
    return { ok: true, candidates: [{ token: 'fixture-choice', label: 'Fixture Operator' }] };
  }, inspectOperator: async p => {
    assert.equal(p.candidateToken, 'fixture-choice');
    calls.push('inspectOperator'); return { ok: true, name: 'Fixture Operator', token: 'fixture-token', roleName: '现维护经纪人',
      checkedAt: new Date().toISOString(), remainingLeaseMs: 300000 };
  } };
  const context = vm.createContext({
    document: {
      createElement: tag => new Element(tag),
      createTextNode: text => ({ textContent: text }),
      getElementById: () => null
    },
    Option: function(text, value) { return { textContent: text, value }; },
    requestAnimationFrame: fn => fn(), performance,
    clearTimeout: () => {},
    setTimeout: fn => { fn(); },
    confirm: () => true,
    window: { desktopAPI: { feishu: api } }
  });
  const source = fs.readFileSync(path.join(__dirname, '../renderer/views/feishu.js'), 'utf8');
  vm.runInContext(source.replace(/^export /gm, ''), context);
  const evaluate = script => vm.runInContext(script, context);
  if (testMode) evaluate("recordMode = 'test';");
  const ctx = { runDir: 'fixture-a', rows: [{ rowId: 'row', creatorName: 'Fixture' }], rerender() {},
    save: async () => ({ ok: true }), apply: async () => ({ ok: true }) };
  const render = () => context.renderFeishuWorkbench(ctx);
  render();
  evaluate(`connection = {connected:true,fields:[
    {key:'contact',name:'联系方式',type:'text',options:[]},
    {key:'name',name:'账号昵称',type:'text',options:[]}
  ]};currentRow='row';maintainerName='Fixture Operator';`);
  const clock = (at = Date.now()) => {
    context.clockNow = at;
    context.clockMonotonic = 1000;
    context.performance = { now: () => context.clockMonotonic };
    const timers = new Map(); let nextTimer = 0;
    context.setTimeout = (fn, delay) => {
      if (delay === 500) { fn(); return; }
      const id = ++nextTimer; timers.set(id, { fn, at: context.clockNow + delay }); return id;
    };
    context.clearTimeout = id => timers.delete(id);
    evaluate('Date = class extends Date { static now() { return clockNow; } };');
    return { advance(ms) {
      context.clockNow += ms;
      context.clockMonotonic += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= context.clockNow) { timers.delete(id); timer.fn(); }
    }, wallOnly(ms) { context.clockNow += ms; }, monotonicOnly(ms) { context.clockMonotonic += ms; }, timers };
  };
  return { calls, api, ctx, render, evaluate, clock };
}
const byText = (root, text) => walk(root).find(n => n.textContent === text);
const byLabel = (root, label) => walk(root).find(n => n.attributes?.['aria-label'] === label);
const batchRawValue = root => walk(root).find(n => n.dataset?.batchContactValue === 'true');
test('cloud enrichment follows untouched fields without losing manual edits or submission evidence', () => {
  const h = harness();
  h.ctx.rows[0] = {rowId:'row',creatorName:'Fixture',xhsId:'fixture-id',email:'old@example.invalid',imagePrice:'100'};
  let root = h.render();
  h.evaluate("cloud.confirmed=true;cloud.items[0].plan={expiresAt:Date.now()+60000};cloud.items[0].status='ready';");
  h.ctx.rows[0].priority='review-only'; h.ctx.rows[0].contactCollectionStatus='completed';
  root=h.render();
  assert.equal(h.evaluate('cloud.confirmed'),true);
  assert.equal(h.evaluate('cloud.items[0].status'),'ready');
  const price = byLabel(root,'图文平台价 · Fixture');
  price.value='150';price.handlers.input();
  h.ctx.rows[0].contactRaw='unclassified fixture';
  h.ctx.rows[0].email='new@example.invalid';
  h.ctx.rows[0].videoPrice='200';
  root=h.render();
  assert.equal(h.evaluate('cloud.confirmed'),false);
  assert.equal(h.evaluate('cloud.items[0].plan'),null);
  assert.equal(byLabel(root,'图文平台价 · Fixture').value,'150');
  assert.equal(byLabel(root,'视频平台价 · Fixture').value,'200');
  assert.equal(byLabel(root,'建档联系方式 · Fixture').value,'邮箱：new@example.invalid\nunclassified fixture');
  const contact=byLabel(root,'建档联系方式 · Fixture');contact.value='manual fixture';contact.handlers.input();
  h.ctx.rows[0].phone='fixture-phone';root=h.render();
  assert.equal(byLabel(root,'建档联系方式 · Fixture').value,'manual fixture');
  h.evaluate("cloud.items[0].status='unknown';cloud.items[0].submission={name:'attempt'};");
  h.ctx.rows[0].videoPrice='300';root=h.render();
  assert.equal(byLabel(root,'视频平台价 · Fixture').value,'200');
  assert.equal(h.evaluate('cloud.items[0].status'),'unknown');
});

test('contact draft retains every known contact kind and does not classify raw values', () => {
  const h=harness();
  assert.equal(h.evaluate("contactDraft({wechatId:'fixture-wx',email:'fixture@example.invalid',phone:'fixture-phone',contactRaw:'00123'})"),
    '微信：fixture-wx\n邮箱：fixture@example.invalid\n手机：fixture-phone\n00123');
});

function rawReviewFixture(h, failSave = false) {
  const reviewStore = require('../lib/contact_review_store');
  const storeDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'feishu-raw-review-'));
  const reviewMap = new Map(h.ctx.rows.map(row => [row.rowId, row]));
  const source = fs.readFileSync(path.join(__dirname, '../renderer/views/exports.js'), 'utf8');
  const start = source.indexOf('async function applyFeishuContactPatch(');
  const end = source.indexOf('\nfunction ensureReviewRow(', start);
  const context = vm.createContext({ _selectedRunDir: h.ctx.runDir, _contactReviewMap: reviewMap,
    _xiaomifengApprovalCheck: null, resetEmailHandoff() {},
    saveContactReviewNow: async () => {
      if (failSave) return { ok: false, code: 'FEISHU_LOCAL_SAVE_FAILED' };
      reviewStore.saveContactReview(storeDir, h.ctx.runDir, { reviewRows: [...reviewMap.values()] });
      return { ok: true };
    } });
  vm.runInContext(source.slice(start, end), context);
  h.ctx.apply = context.applyFeishuContactPatch;
  return () => reviewStore.loadContactReview(storeDir, h.ctx.runDir).reviewRows;
}
const rawPatch = value => ({ contactRaw: value, contactRawSource: '飞书项目 / project/creator / 5',
  contactRawCollectedAt: '2026-10-13T00:00:00.000Z', feishuAccountNumber: '001234' });

test('production is the fresh UI default and changing mode revokes previews and write approval', () => {
  const h = harness({ testMode: false });
  assert.equal(h.evaluate('recordMode'), 'production');
  assert.ok(byText(h.render(), '已核对正式新建／补录及通知影响；不发送邀约、不推进流程'));
  h.evaluate("safetyConfirmed=true;plan={token:'old'};cloud={items:[],revision:0,confirmed:true,phase:'preview'};");
  const mode = byLabel(h.render(), '建档模式');
  mode.value = 'test'; mode.handlers.change();
  assert.equal(h.evaluate('recordMode'), 'test');
  assert.equal(h.evaluate('plan'), null);
  assert.equal(h.evaluate('safetyConfirmed'), false);
  assert.equal(h.evaluate('cloud.confirmed'), false);
  assert.ok(byText(h.render(), '已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程'));
});

test('production protected history is never offered by the mutation picker', () => {
  const h = harness({ testMode: false });
  h.evaluate("action='delete';records=[{recordId:'41',entryId:'prod',target:connection.target,name:'[AI测试] deceptive',recordMode:'production',status:'verified'}];");
  const root = h.render();
  assert.equal(walk(root).filter(n => n.tagName === 'select').some(n => n.children.some(o => o.value === '41')), false);
});

test('obsolete safety checkboxes cannot authorize another mode or a mode change-back', () => {
  for (const modes of [['production'], ['production', 'test']]) {
    const h = harness();
    const oldApproval = byText(h.render(), '已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程').parent.children[0];
    for (const value of modes) {
      const mode = byLabel(h.render(), '建档模式'); mode.value = value; mode.handlers.change();
    }
    oldApproval.checked = true; oldApproval.handlers.change();
    assert.equal(h.evaluate('safetyConfirmed'), false);
    const currentApproval = byText(h.render(), modes.at(-1) === 'test'
      ? '已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程'
      : '已核对正式新建／补录及通知影响；不发送邀约、不推进流程').parent.children[0];
    currentApproval.checked = true; currentApproval.handlers.change();
    assert.equal(h.evaluate('safetyConfirmed'), true);
    assert.deepEqual(h.calls, []);
  }
});

test('single production preparation sends the explicit mode and no client-generated time', async () => {
  const h = harness({ testMode: false });
  h.evaluate("connection.fields.push({key:'contact_time',name:'建联时间',type:'date',generated:'contact_time',options:[]});accountNumber='001234';accountConfirmed=true;operator={token:'fixture-operator',name:'Fixture Operator',checkedAt:new Date().toISOString()};operatorConfirmed=true;safetyConfirmed=true;");
  let prepared = 0;
  h.api.prepare = async p => {
    prepared++; assert.equal(p.recordMode, 'production'); assert.equal(Object.hasOwn(p.values, 'contact_time'), false);
    return { ok: true, token: 'single-production', action: 'create', recordMode: 'production',
      name: 'Fixture', batch: 'SYNC_fixture', target: 'project/creator', fields: [] };
  };
  const root = h.render();
  assert.ok(byText(root, '提交时自动填写当前时间'));
  byText(root, '预览写入字段').handlers.click(); await new Promise(setImmediate);
  assert.equal(prepared, 1);
  assert.equal(h.evaluate('plan.recordMode'), 'production');
});

test('raw contact: final local adapter rejects a different existing original before persistence', async () => {
  const h = batchHarness([{ rowId: 'a', creatorName: 'Fixture A', xhsId: '001234',
    contactRaw: 'original fixture value', selected: true }]);
  const restored = rawReviewFixture(h);
  const result = await h.ctx.apply(h.ctx.runDir, 'a', rawPatch('new fixture value'));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FEISHU_LOCAL_CONFLICT');
  assert.equal(h.ctx.rows[0].contactRaw, 'original fixture value');
  assert.deepEqual(restored(), []);
});

test('raw contact: batch explicit original application persists via the real review adapter and rolls back save failures', async () => {
  for (const failSave of [false, true]) {
    const value = '001234\n代理备注  原值';
    const h = batchHarness([{ rowId: 'a', creatorName: 'Fixture A', xhsId: '001234', selected: true,
      wechatId: 'manual_wechat', email: 'manual@example.test', phone: '123456789' }]);
    const restored = rawReviewFixture(h, failSave);
    h.api.lookup = async () => ({ ok: true, token: 'raw-token', preview: { status: 'manual_review', candidates: [
      { recordId: 5, kind: 'unclassified', value }] } });
    h.api.applyContact = async payload => {
      assert.equal(payload.kind, 'unclassified'); h.calls.push(['apply', payload.rowId]); return { ok: true, patch: rawPatch(value) };
    };
    await h.query();
    const source = byLabel(h.render(), '回补来源 · Fixture A'); source.value = '5'; source.handlers.change();
    const kind = byLabel(h.render(), '回补类型 · Fixture A');
    assert.ok(kind.children.some(option => option.value === 'unclassified' && option.textContent === '未分类原值'));
    assert.equal(kind.value, ''); kind.value = 'unclassified'; kind.handlers.change();
    const include = walk(h.render()).find(n => n.children?.some(c => c.textContent === '回填 · Fixture A')).children[0];
    assert.equal(include.disabled, false); include.checked = true; include.handlers.change();
    byText(h.render(), '确认回填本地（1）').handlers.click(); await new Promise(setImmediate);
    assert.equal(h.evaluate('batch.items[0].applied'), !failSave);
    assert.equal(h.ctx.rows[0].contactRaw, failSave ? undefined : value);
    assert.equal(h.ctx.rows[0].wechatId, 'manual_wechat'); assert.equal(h.ctx.rows[0].email, 'manual@example.test');
    assert.equal(h.ctx.rows[0].phone, '123456789');
    if (!failSave) {
      assert.equal(restored()[0].contactRaw, value); assert.equal(restored()[0].contactRawSource, rawPatch(value).contactRawSource);
    } else {
      assert.deepEqual(restored(), []); assert.equal(h.ctx.rows[0].contactRawSource, undefined);
    }
    assert.equal(h.calls.some(call => call[0] === 'execute'), false);
  }
});
test('raw contact: single explicit original application persists unchanged without typed inference', async () => {
  const h = harness(), value = '001234\n代理备注  原值';
  const restored = rawReviewFixture(h);
  h.evaluate(`accountConfirmed=true;accountNumber='001234';lookup={token:'raw-token',preview:{status:'manual_review',
    candidates:[{recordId:5,kind:'unclassified',value:${JSON.stringify(value)}}]}};`);
  h.api.applyContact = async payload => { assert.equal(payload.kind, 'unclassified'); return { ok: true, patch: rawPatch(value) }; };
  const root = h.render(), kind = byLabel(root, '联系方式类型');
  const index = kind.children.findIndex(option => option.value === 'unclassified'); assert.ok(index > 0);
  kind.value = 'unclassified'; kind.options = kind.children.map(option => ({ text: option.textContent })); kind.selectedIndex = index;
  byText(root, '确认回填本地').handlers.click(); await new Promise(setImmediate);
  assert.equal(restored()[0].contactRaw, value); assert.equal(h.evaluate('draft.contact'), value);
  for (const field of ['wechatId', 'email', 'phone']) assert.equal(restored()[0][field], '');
});
test('raw contact: batch raw conflicts and in-flight run/source changes never apply to another row or restore approval', async () => {
  for (const change of ['conflict', 'run', 'source']) {
    const h = batchHarness([{ rowId: 'a', creatorName: 'Fixture A', xhsId: '001234', selected: true,
      contactRaw: change === 'conflict' ? 'different' : '' }]);
    h.api.lookup = async () => ({ ok: true, token: 'raw-token', preview: { status: 'manual_review', candidates: [
      { recordId: 5, kind: 'unclassified', value: 'original' }, { recordId: 6, kind: 'unclassified', value: 'other' }] } });
    await h.query();
    let source = byLabel(h.render(), '回补来源 · Fixture A'); source.value = '5'; source.handlers.change();
    const kind = byLabel(h.render(), '回补类型 · Fixture A'); kind.value = 'unclassified'; kind.handlers.change();
    const include = walk(h.render()).find(n => n.children?.some(c => c.textContent === '回填 · Fixture A')).children[0];
    if (change === 'conflict') { assert.equal(include.disabled, true); assert.equal(h.ctx.rows[0].contactRaw, 'different'); continue; }
    include.checked = true; include.handlers.change(); let finish;
    h.api.applyContact = () => new Promise(resolve => { finish = resolve; });
    h.ctx.apply = async () => { h.calls.push(['local-apply']); return { ok: true }; };
    byText(h.render(), '确认回填本地（1）').handlers.click(); await new Promise(setImmediate);
    if (change === 'run') { h.ctx.runDir = 'other'; h.render(); }
    else { source = byLabel(h.render(), '回补来源 · Fixture A'); source.value = '6'; source.handlers.change(); }
    finish({ ok: true, patch: rawPatch('original') }); await new Promise(setImmediate);
    assert.equal(h.calls.some(call => call[0] === 'local-apply'), false, change);
    assert.equal(h.evaluate('batch.items[0].approved'), false);
  }
});
test('raw contact: cloud draft keeps original values alongside typed contacts', async () => {
  const h = cloudHarness(), value = '001234\n代理备注  原值';
  h.ctx.rows = [{ ...h.ctx.rows[0], wechatId: '', email: '', phone: '', ...rawPatch(value) }];
  h.render(); await h.preview();
  const prepared = h.calls.find(call => call[0] === 'prepare'); assert.equal(prepared[2].contact, value);
  assert.equal(h.calls.some(call => call[0] === 'execute'), false);
  assert.equal(h.evaluate(`contactDraft(${JSON.stringify({ ...rawPatch(value), wechatId: 'manual_wechat' })})`), `微信：manual_wechat\n${value}`);
});
test('raw contact: single delayed reply cannot overwrite a changed creator, run or raw value', async () => {
  for (const change of ['run', 'creator', 'raw']) {
    const h = harness();
    h.evaluate(`accountConfirmed=true;accountNumber='001234';lookup={token:'raw-token',preview:{status:'manual_review',
      candidates:[{recordId:5,kind:'unclassified',value:'original'}]}};`);
    let finish; h.api.applyContact = () => new Promise(resolve => { finish = resolve; });
    h.ctx.apply = async () => { h.calls.push('local-apply'); return { ok: true }; };
    const root = h.render(), kind = byLabel(root, '联系方式类型'); kind.value = 'unclassified';
    byText(root, '确认回填本地').handlers.click(); await new Promise(setImmediate);
    if (change === 'run') h.ctx.runDir = 'other';
    if (change === 'creator') h.ctx.rows[0].creatorName = 'Replacement';
    if (change === 'raw') h.ctx.rows[0].contactRaw = 'different';
    h.render(); finish({ ok: true, patch: rawPatch('original') }); await new Promise(setImmediate);
    assert.equal(h.calls.includes('local-apply'), false, change);
  }
});

test('raw contact: real Chrome explicitly preserves originals in single and batch with fixture-only persisted roundtrip', {
  skip: !process.env.CHROME_PATH, timeout: 30000
}, async () => {
  const { chromium } = require('playwright');
  const reviewStore = require('../lib/contact_review_store');
  const storeDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'feishu-raw-chrome-'));
  const value = '001234\n代理备注  原值', patch = rawPatch(value), savedRuns = [];
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const context = await browser.newContext(); let requests = 0;
    await context.route('**/*', route => { requests++; return route.abort(); });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    await page.exposeFunction('saveRawFixture', (runDir, rowId, received) => {
      assert.equal(received.contactRaw, value); assert.equal(received.contactRawSource, patch.contactRawSource);
      const saved = reviewStore.saveContactReview(storeDir, runDir, { reviewRows: [{ rowId, ...received }] });
      assert.equal(reviewStore.loadContactReview(storeDir, runDir).reviewRows[0].contactRaw, value);
      savedRuns.push(runDir); return { ok: true, row: saved.reviewRows[0] };
    });
    await page.setContent('<!doctype html><meta charset="utf-8"><div id="mount"></div>');
    await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname, '../renderer/app.css'), 'utf8') });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../renderer/views/feishu.js'), 'utf8').replace(/^export /gm, '') + `
      window.calls=[];const candidate={recordId:5,kind:'unclassified',value:${JSON.stringify(value)}};
      window.desktopAPI={feishu:{lookup:async()=>({ok:true,token:'batch-token',preview:{status:'manual_review',candidates:[candidate]}}),
        applyContact:async p=>{window.calls.push(p.kind);if(p.kind!=='unclassified')throw Error('wrong kind');return {ok:true,patch:${JSON.stringify(patch)}};},
        execute:async()=>{window.calls.push('execute');return {ok:false};}}};
      window.ctx={runDir:'raw-single-fixture',rows:[{rowId:'row',creatorName:'Fixture',xhsId:'001234',selected:true}],
        save:async()=>({ok:true}),rerender:()=>window.renderFixture(),apply:async(run,id,patch)=>{
          const saved=await window.saveRawFixture(run,id,patch);if(saved.ok)Object.assign(window.ctx.rows.find(row=>row.rowId===id),patch);return saved;
        }};
      window.renderFixture=()=>document.getElementById('mount').replaceChildren(renderFeishuWorkbench(window.ctx));
      window.renderFixture();connection={connected:true,target:'project/creator',fields:[{key:'contact',name:'联系方式',type:'text',options:[]}]};
      currentRow='row';accountNumber='001234';accountConfirmed=true;singleOpen=true;
      lookup={token:'single-token',preview:{status:'manual_review',candidates:[candidate]}};window.renderFixture();
    ` });
    const singleKind = page.getByLabel('联系方式类型', { exact: true });
    assert.equal(await singleKind.inputValue(), ''); await singleKind.selectOption({ label: '未分类原值' });
    await page.getByRole('button', { name: '确认回填本地', exact: true }).click(); await page.waitForFunction(() => !busy);
    assert.equal(await page.evaluate(() => draft.contact), value);
    await page.evaluate(() => {
      window.ctx.runDir='raw-batch-fixture';window.ctx.rows=[{rowId:'row',creatorName:'Fixture',xhsId:'001234',selected:true}];
      batchOpen=true;window.renderFixture();
    });
    await page.getByLabel('已核对本批小红书号与达人对应关系', { exact: true }).check();
    await page.getByRole('button', { name: '查询选中达人', exact: true }).click(); await page.waitForFunction(() => !busy);
    await page.getByLabel('回补来源 · Fixture', { exact: true }).selectOption('5');
    assert.equal(await page.getByLabel('回补类型 · Fixture', { exact: true }).inputValue(), '');
    await page.getByLabel('回补类型 · Fixture', { exact: true }).selectOption({ label: '未分类原值' });
    await page.getByLabel('回填 · Fixture', { exact: true }).check();
    await page.getByRole('button', { name: '确认回填本地（1）', exact: true }).click(); await page.waitForFunction(() => !busy);
    assert.equal(await page.evaluate(() => batch.items[0].applied), true);
    assert.deepEqual(savedRuns, ['raw-single-fixture', 'raw-batch-fixture']);
    for (const run of savedRuns) {
      const row = reviewStore.loadContactReview(storeDir, run).reviewRows[0];
      for (const field of ['wechatId', 'email', 'phone']) assert.equal(row[field], '');
    }
    assert.deepEqual(await page.evaluate(() => window.calls), ['unclassified', 'unclassified']);
    assert.equal(requests, 0); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

const cleanupOriginLabels = {
  CREATOR_MISSING: '首次回读缺少创建人字段', CREATOR_INVALID: '首次回读创建人格式无效',
  CREATOR_MISMATCH: '首次回读创建人与本次创建身份不一致',
  UPDATER_MISSING: '首次回读缺少更新人字段', UPDATER_INVALID: '首次回读更新人格式无效',
  UPDATER_MISMATCH: '首次回读更新人与本次创建身份不一致',
  CREATED_AT_INVALID: '首次回读创建时间无效', UPDATED_AT_INVALID: '首次回读更新时间无效',
  TIMESTAMPS_REVERSED: '首次回读更新时间早于创建时间', TIMESTAMPS_UNEQUAL: '旧版本首次回读创建与更新时间不一致'
};
const historyText = root => walk(root.querySelector('.feishu-cloud-history')).map(n => n.textContent || '').join('\n');
test('cleanup diagnostics: failure translates only whitelisted reasons under the exact blocked parent', () => {
  const h = harness();
  for (const [cleanupOriginDiagnostic, label] of Object.entries(cleanupOriginLabels)) {
    const result = h.evaluate(`failure(${JSON.stringify({ code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: true,
      cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED', cleanupOriginDiagnostic })},false)`);
    assert.match(result, /记录的创建来源或初始状态无法核实/);
    assert.match(result, /清理保护原因：首次回读创建来源无法核实/);
    assert.ok(result.includes(label));
  }
  const parentLabels = { INITIAL_WORKFLOW_UNVERIFIED: '首次回读初始流程状态无法核实',
    FIELD_SCHEMA_UNVERIFIED: '首次回读字段结构无法核实', ROLE_DEFAULT_UNVERIFIED: '首次回读角色默认值无法核实',
    FIELD_DEFAULT_UNVERIFIED: '首次回读字段默认值无法核实' };
  for (const [cleanupDiagnostic, label] of Object.entries(parentLabels)) {
    const result = h.evaluate(`failure(${JSON.stringify({ code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: true,
      cleanupDiagnostic, cleanupOriginDiagnostic: 'CREATOR_MISSING' })},false)`);
    assert.ok(result.includes(label)); assert.ok(!result.includes(cleanupOriginLabels.CREATOR_MISSING));
  }
  for (const untrusted of ['PRIVATE_SENTINEL', 'CREATOR_MISSING\nPRIVATE_SENTINEL', 'constructor',
    { name: 'CREATOR_MISSING', secret: 'PRIVATE_SENTINEL' }, ['CREATOR_MISSING'], 1]) {
    const result = h.evaluate(`failure(${JSON.stringify({ code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: true,
      cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED', cleanupOriginDiagnostic: untrusted })},false)`);
    assert.doesNotMatch(result, /PRIVATE_SENTINEL|constructor/);
    assert.ok(!Object.values(cleanupOriginLabels).some(label => result.includes(label)));
  }
  for (const extra of [{ cleanupDiagnostic: 'PRIVATE_SENTINEL', cleanupOriginDiagnostic: 'CREATOR_MISSING' },
    { cleanupBlocked: false }, { code: 'FEISHU_HTTP_ERROR' }]) {
    const result = h.evaluate(`failure(${JSON.stringify({ code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: true,
      cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED', cleanupOriginDiagnostic: 'CREATOR_MISSING', ...extra })},false)`);
    assert.doesNotMatch(result, /PRIVATE_SENTINEL|清理保护原因|首次回读/);
  }
});

test('cleanup diagnostics: persisted verified and unknown history retain safe reasons on first and repeated refresh', async () => {
  for (const status of ['verified', 'unknown']) {
    const h = cloudHarness();
    const record = { entryId: 'diagnostic-entry', recordId: '41', target: 'project/creator', name: '[AI测试] Diagnostic',
      batch: 'fixture-batch', status, cleanupBlocked: true, cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED',
      cleanupOriginDiagnostic: 'CREATOR_MISSING' };
    h.evaluate(`cloudHistory=[];records=${JSON.stringify([record])};`);
    h.api.listRecords = async () => ({ ok: true, records: [structuredClone(record)] });
    assert.ok(historyText(h.render()).includes(cleanupOriginLabels.CREATOR_MISSING));
    record.cleanupOriginDiagnostic = 'UPDATER_MISSING';
    byText(h.render(), '刷新提交结果').handlers.click(); await new Promise(setImmediate);
    let text = historyText(h.render());
    assert.ok(text.includes(cleanupOriginLabels.UPDATER_MISSING)); assert.ok(!text.includes(cleanupOriginLabels.CREATOR_MISSING));
    assert.equal(h.evaluate('cloudHistory.length'), 1); assert.equal(h.evaluate('cloudHistory[0].status'), status);
    delete record.cleanupOriginDiagnostic;
    byText(h.render(), '刷新提交结果').handlers.click(); await new Promise(setImmediate);
    text = historyText(h.render()); assert.match(text, /首次回读创建来源无法核实/);
    assert.ok(!Object.values(cleanupOriginLabels).some(label => text.includes(label)));
    assert.equal(h.evaluate('cloudHistory[0].cleanupOriginDiagnostic'), undefined);
    assert.equal(h.evaluate('cloudHistory[0].result.cleanupOriginDiagnostic'), undefined);
  }
});

test('cleanup diagnostics: conflicting identities and rejected reconciliation cannot contaminate unknown history', async () => {
  const h = cloudHarness();
  h.evaluate(`cloudHistory=[{target:'project/creator',name:'[AI测试] Same',batch:'same-batch',status:'unknown',
    cleanupBlocked:true,cleanupDiagnostic:'INITIAL_WORKFLOW_UNVERIFIED',result:{entryId:'original-entry',recordId:'41'}}];
    records=[{target:'project/creator',name:'[AI测试] Same',batch:'same-batch',status:'verified',entryId:'different-entry',recordId:'42',
    cleanupBlocked:true,cleanupDiagnostic:'CREATE_ORIGIN_UNVERIFIED',cleanupOriginDiagnostic:'CREATOR_MISSING'}];`);
  const root = h.render();
  assert.equal(h.evaluate('cloudHistory[0].status'), 'unknown');
  assert.equal(h.evaluate('cloudHistory[0].cleanupDiagnostic'), 'INITIAL_WORKFLOW_UNVERIFIED');
  assert.equal(h.evaluate('cloudHistory[0].cleanupOriginDiagnostic'), undefined);
  h.api.reconcile = async () => ({ ok: true, target: 'other/creator', entryId: 'original-entry', recordId: '41', status: 'verified',
    cleanupBlocked: true, cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED', cleanupOriginDiagnostic: 'CREATOR_MISSING' });
  byText(root, '核对提交结果').handlers.click(); await new Promise(setImmediate); h.render();
  assert.equal(h.evaluate('cloudHistory[0].status'), 'unknown');
  assert.equal(h.evaluate('cloudHistory[0].cleanupDiagnostic'), 'INITIAL_WORKFLOW_UNVERIFIED');
  assert.equal(h.evaluate('cloudHistory[0].cleanupOriginDiagnostic'), undefined);
});

test('cleanup diagnostics: legacy and untrusted history never invent subreasons; deleted records show retirement only', () => {
  for (const status of ['verified', 'unknown', 'deleted']) for (const origin of [undefined, 'PRIVATE_SENTINEL', 'constructor']) {
    const h = cloudHarness();
    h.evaluate(`cloudHistory=[];records=${JSON.stringify([{ target: 'project/creator', entryId: 'fixture-entry', recordId: '41',
      name: '[AI测试] Legacy', status, externalAbsenceVerified: status === 'deleted', cleanupBlocked: true,
      cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED', cleanupOriginDiagnostic: origin }])};`);
    const text = historyText(h.render()); assert.doesNotMatch(text, /PRIVATE_SENTINEL|constructor/);
    assert.ok(!Object.values(cleanupOriginLabels).some(label => text.includes(label)));
    if (status === 'deleted') {
      assert.match(text, /外部不存在（只读确认）/);
      assert.doesNotMatch(text, /禁止自动修改和清理|清理保护原因/);
    }
  }
});

test('persisted history: refresh restores normal and blocked verified entries with stored identity only', async () => {
  for (const cleanupBlocked of [false, true]) {
    const h = cloudHarness(); h.evaluate('cloudHistory=[];records=[];operator=null;operatorConfirmed=false;safetyConfirmed=false;plan=null;');
    const saved = { entryId: 'persisted-entry', recordId: '42', target: 'project/creator', status: 'verified',
      name: '[AI测试] AI_TEST_persisted Fixture', batch: 'AI_TEST_persisted', accountNumber: '001234',
      maintainerName: 'Stored Owner', cleanupBlocked };
    h.api.listRecords = async () => { h.calls.push(['listRecords']); return { ok: true, records: [saved] }; };
    byText(h.render(), '刷新提交结果').handlers.click(); await new Promise(setImmediate);
    const root = h.render();
    assert.ok(byText(root, saved.name)); assert.ok(byText(root, `批次 ${saved.batch}`));
    assert.ok(byText(root, '记录归属：Stored Owner · 小红书号 001234'));
    assert.ok(byText(root, '历史提交成功 · 已回读'));
    assert.equal(h.evaluate('cloudHistory.length'), 1);
    assert.equal(h.evaluate('cloudHistory[0].cleanupBlocked'), cleanupBlocked);
    byText(root, '刷新提交结果').handlers.click(); await new Promise(setImmediate); h.render();
    assert.equal(h.evaluate('cloudHistory.length'), 1);
    assert.deepEqual(h.calls, [['listRecords'], ['listRecords']]);
    assert.equal(h.evaluate('operator'), null); assert.equal(h.evaluate('safetyConfirmed'), false); assert.equal(h.evaluate('plan'), null);
  }
});

test('persisted history: target isolation, legacy missing fields and unknown readonly reconciliation survive refresh', async () => {
  const h = cloudHarness(); h.evaluate('cloudHistory=[];records=[];operator=null;operatorConfirmed=false;safetyConfirmed=false;');
  h.api.listRecords = async () => { h.calls.push(['listRecords']); return { ok: true, records: [
    { entryId: 'legacy', recordId: '40', target: 'project/creator', status: 'verified', name: '[AI测试] Legacy' },
    { entryId: 'pending', recordId: '41', target: 'project/creator', status: 'unknown', name: '[AI测试] Pending' },
    { entryId: 'foreign', recordId: '43', target: 'other/creator', status: 'verified', name: '[AI测试] Foreign' }
  ] }; };
  h.api.reconcile = async p => { h.calls.push(['reconcile', p.entryId]); return { ok: true, status: 'verified', recordId: '41' }; };
  byText(h.render(), '刷新提交结果').handlers.click(); await new Promise(setImmediate);
  let root = h.render();
  assert.ok(byText(root, '[AI测试] Legacy')); assert.equal(byText(root, '[AI测试] Foreign'), undefined);
  assert.ok(byText(root, '记录归属：待核对 · 小红书号 待核对'));
  assert.equal(h.evaluate("cloudHistory.find(r=>r.result.entryId==='legacy').batch"), undefined);
  assert.equal(h.evaluate("cloudHistory.find(r=>r.result.entryId==='legacy').maintainerName"), undefined);
  byText(root, '核对提交结果').handlers.click(); await new Promise(setImmediate); root = h.render();
  assert.equal(h.evaluate("cloudHistory.find(r=>r.result.entryId==='pending').status"), 'verified');
  assert.deepEqual(h.calls, [['listRecords'], ['reconcile', 'pending']]);
});

test('history identity: conflicting known IDs never merge same-name same-batch submissions', () => {
  for (const status of ['unknown', 'deleted']) for (const conflict of ['entry', 'record', 'both']) {
    const h = cloudHarness();
    h.evaluate(`cloudHistory=[{target:'project/creator',name:'[AI测试] Same',batch:'same-batch',
      creatorName:'Old Fixture',account:'old-account',status:'${status}',
      result:{entryId:'old-entry',recordId:'41'}}];
      records=[{target:'project/creator',name:'[AI测试] Same',batch:'same-batch',status:'verified',
        entryId:'${conflict === 'record' ? 'old-entry' : 'new-entry'}',
        recordId:'${conflict === 'entry' ? '41' : '42'}',accountNumber:'new-account'}];`);
    h.render();
    const root = h.render();
    assert.equal(h.evaluate('cloudHistory.length'), 2);
    assert.equal(h.evaluate('cloudHistory[0].status'), status);
    assert.equal(h.evaluate('cloudHistory[0].account'), 'old-account');
    assert.equal(h.evaluate('cloudHistory[0].result.entryId'), 'old-entry');
    assert.equal(h.evaluate('cloudHistory[0].result.recordId'), '41');
    if (status === 'unknown') assert.ok(byText(root, '核对提交结果'));
  }
});

test('history identity: missing-ID recovery requires a unique matching stored record and submission', () => {
  for (const ambiguous of ['none', 'records', 'history', 'account']) {
    const h = cloudHarness();
    h.evaluate(`cloudHistory=[{target:'project/creator',name:'[AI测试] Same',batch:'same-batch',
      account:'fixture-account',status:'unknown',result:{}}];
      records=[{target:'project/creator',name:'[AI测试] Same',batch:'same-batch',status:'verified',
        entryId:'new-entry',recordId:'42',accountNumber:'${ambiguous === 'account' ? 'other-account' : 'fixture-account'}'}];`);
    if (ambiguous === 'records') h.evaluate("records.push({...records[0],entryId:'other-entry',recordId:'43'});");
    if (ambiguous === 'history') h.evaluate("cloudHistory.push({...cloudHistory[0],result:{}});");
    const root = h.render();
    assert.equal(h.evaluate('cloudHistory[0].status'), ambiguous === 'none' ? 'verified' : 'unknown');
    if (ambiguous !== 'none') assert.ok(byText(root, '核对提交结果'));
    assert.equal(h.calls.length, 0);
  }
});

test('history identity: refreshing another account retirement never retires an unresolved submission', async () => {
  const h = cloudHarness();
  h.evaluate(`cloudHistory=[{target:'project/creator',name:'[AI测试] Same',batch:'same-batch',
    account:'original-account',status:'unknown',result:{}}];records=[];`);
  h.api.listRecords = async () => ({ ok: true, records: [{ target: 'project/creator', name: '[AI测试] Same', batch: 'same-batch',
    entryId: 'other-entry', recordId: '42', accountNumber: 'other-account', status: 'deleted', externalAbsenceVerified: true }] });
  byText(h.render(), '刷新提交结果').handlers.click(); await new Promise(setImmediate);
  h.render(); const root = h.render();
  assert.equal(h.evaluate('cloudHistory[0].status'), 'unknown');
  assert.equal(h.evaluate('cloudHistory[0].account'), 'original-account');
  assert.ok(byText(root, '核对提交结果'));
});

test('history identity: resolved unknown record ID survives subsequent renders without inventing missing identity', async () => {
  const h = cloudHarness();
  h.evaluate("cloudHistory=[];records=[];");
  h.api.listRecords = async () => ({ ok: true, records: [{ target: 'project/creator', name: '[AI测试] Pending',
    entryId: 'pending-entry', status: 'unknown' }] });
  h.api.reconcile = async () => ({ ok: true, status: 'verified', recordId: '41' });
  byText(h.render(), '刷新提交结果').handlers.click(); await new Promise(setImmediate);
  byText(h.render(), '核对提交结果').handlers.click(); await new Promise(setImmediate);
  h.render(); const root = h.render();
  assert.equal(h.evaluate('cloudHistory[0].result.recordId'), '41');
  assert.ok(byText(root, '工作项 41'));
  assert.equal(h.evaluate('cloudHistory[0].account'), '');
  assert.equal(h.evaluate('cloudHistory[0].maintainerName'), undefined);
});

test('history identity: unknown reconciliation rejects another target even when the local record list is empty', async () => {
  const h = cloudHarness();
  h.evaluate(`records=[];cloudHistory=[{target:'project/creator',name:'[AI测试] Pending',batch:'pending-batch',
    status:'unknown',result:{entryId:'pending-entry',recordId:'41'}}];`);
  h.api.reconcile = async () => ({ ok: true, target: 'other/creator', status: 'verified', recordId: '41' });
  byText(h.render(), '核对提交结果').handlers.click(); await new Promise(setImmediate);
  const root = h.render();
  assert.equal(h.evaluate('cloudHistory[0].status'), 'unknown');
  assert.ok(byText(root, '核对提交结果'));
  assert.doesNotMatch(h.evaluate('message'), /原提交结果已核对/);
});

test('history identity: row reconciliation rejects another target before updating row or success text', async () => {
  const h = cloudHarness(); await h.preview();
  h.api.execute = async () => ({ ok: false, status: 'unknown', entryId: 'pending-entry', recordId: '41' });
  await h.submit(2);
  h.api.reconcile = async () => ({ ok: true, target: 'other/creator', status: 'verified', recordId: '41' });
  byText(h.render(), '核对该行结果').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('cloud.items[0].status'), 'unknown');
  assert.equal(h.evaluate('cloudHistory[0].status'), 'unknown');
  assert.doesNotMatch(h.evaluate('message'), /建档结果已核对/);
});

test('history identity: standalone readonly reconciliation never reports another target as confirmed', async () => {
  const h = harness();
  h.evaluate(`connection.target='project/creator';records=[{target:'project/creator',entryId:'pending-entry',
    name:'[AI测试] Pending',recordId:'41',status:'unknown'}];`);
  h.api.reconcile = async () => ({ ok: true, target: 'other/creator', status: 'verified', recordId: '41' });
  h.api.listRecords = async () => ({ ok: true, records: [] });
  byText(h.render(), '只读核对结果').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('records[0].status'), 'unknown');
  assert.doesNotMatch(h.evaluate('message'), /核对完成/);
});

test('batch raw value: source and type stay explicit even for a single typed candidate', async () => {
  const h = batchHarness(); await h.query();
  assert.equal(h.evaluate('batch.items.every(i=>i.recordId===\'\' && i.kind===\'\' && !i.approved)'), true);
  assert.equal(batchRawValue(h.render()), undefined);
  const source = byLabel(h.render(), '回补来源 · Fixture A'); source.value = '5'; source.handlers.change();
  assert.equal(batchRawValue(h.render()).textContent, 'fixture_a');
  assert.equal(h.evaluate('batch.items[0].kind'), '');
  assert.equal(byText(h.render(), '确认回填本地（0）').disabled, true);
});

test('batch raw value: long multiline text is literal and switching source revokes type and approval', async () => {
  const raw = '<img src=x onerror=alert(1)>\n' + 'fictional_'.repeat(80) + '\nlast line';
  const h = batchHarness([{ rowId: 'a', creatorName: 'Fixture A', xhsId: '001234', selected: true }]);
  h.api.lookup = async () => ({ ok: true, token: 'fixture', preview: { status: 'manual_review', candidates: [
    { recordId: 5, kind: 'unclassified', value: raw }, { recordId: 6, kind: 'unclassified', value: 'other_fixture' }
  ] } });
  await h.query(); assert.equal(batchRawValue(h.render()), undefined);
  let source = byLabel(h.render(), '回补来源 · Fixture A'); source.value = '5'; source.handlers.change();
  let value = batchRawValue(h.render()); assert.equal(value.textContent, raw);
  assert.equal(value.style.whiteSpace, 'pre-wrap'); assert.equal(value.style.overflowWrap, 'anywhere');
  assert.equal(value.children.length, 0);
  const kind = byLabel(h.render(), '回补类型 · Fixture A'); kind.value = 'wechat'; kind.handlers.change();
  const include = walk(h.render()).find(n => n.children?.some(c => c.textContent === '回填 · Fixture A')).children[0];
  include.checked = true; include.handlers.change(); assert.equal(h.evaluate('batch.items[0].approved'), true);
  source = byLabel(h.render(), '回补来源 · Fixture A'); source.value = '6'; source.handlers.change();
  value = batchRawValue(h.render()); assert.equal(value.textContent, 'other_fixture');
  assert.equal(h.evaluate('batch.items[0].kind'), ''); assert.equal(h.evaluate('batch.items[0].approved'), false);
  source = byLabel(h.render(), '回补来源 · Fixture A'); source.value = ''; source.handlers.change();
  assert.equal(batchRawValue(h.render()), undefined);
});

test('persisted history and batch raw value: real Chrome restores history and wraps selected contact without granting writes', {
  skip: !process.env.CHROME_PATH, timeout: 30000
}, async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  const raw = '<img src=x onerror=alert(1)>\n' + 'fictional_contact_'.repeat(70) + '\nlast line';
  try {
    const context = await browser.newContext(); let requests = 0;
    await context.route('**/*', route => { requests++; return route.abort(); });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><meta charset="utf-8"><div id="mount"></div>');
    await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname, '../renderer/app.css'), 'utf8') });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../renderer/views/feishu.js'), 'utf8').replace(/^export /gm, '') + `
      window.calls=[];window.desktopAPI={feishu:{
        listRecords:async()=>{window.calls.push('listRecords');return {ok:true,records:[
          {entryId:'fixture-clean',recordId:'41',target:'fixture/creator',status:'verified',name:'[AI测试] Clean',batch:'AI_TEST_clean',accountNumber:'001234',maintainerName:'Stored Owner'},
          {entryId:'fixture-blocked',recordId:'42',target:'fixture/creator',status:'verified',name:'[AI测试] Blocked',cleanupBlocked:true,
            cleanupDiagnostic:'CREATE_ORIGIN_UNVERIFIED',cleanupOriginDiagnostic:'UPDATER_MISSING'}
        ]};},
        lookup:async()=>{window.calls.push('lookup');return {ok:true,token:'fixture-token',preview:{status:'manual_review',candidates:[
          {recordId:5,kind:'unclassified',value:${JSON.stringify(raw)}},
          {recordId:6,kind:'wechat',value:'other_fixture'}
        ]}};},
        prepare:async()=>{window.calls.push('prepare');return {ok:false};},
        execute:async()=>{window.calls.push('execute');return {ok:false};},
        applyContact:async()=>{window.calls.push('applyContact');return {ok:false};}}};
      const ctx={runDir:'raw-fixture',rows:[{rowId:'a',creatorName:'Fixture A',xhsId:'001234',selected:true}],
        save:async()=>({ok:true}),rerender:()=>window.renderFixture()};
      window.renderFixture=()=>document.getElementById('mount').replaceChildren(renderFeishuWorkbench(ctx));
      window.renderFixture();connection={connected:true,target:'fixture/creator',fields:[]};batchOpen=true;window.renderFixture();
    ` });
    await page.locator('.feishu-cloud-history summary').click();
    await page.getByRole('button', { name: '刷新提交结果', exact: true }).click(); await page.waitForFunction(() => !busy);
    assert.equal(await page.locator('.feishu-history-row').count(), 2);
    const historyText = await page.locator('.feishu-cloud-history').textContent();
    assert.match(historyText, /批次 AI_TEST_clean/); assert.match(historyText, /Stored Owner/);
    assert.match(historyText, /首次回读缺少更新人字段/);
    await page.getByRole('button', { name: '刷新提交结果', exact: true }).click(); await page.waitForFunction(() => !busy);
    assert.equal(await page.locator('.feishu-history-row').count(), 2);
    assert.match(await page.locator('.feishu-cloud-history').textContent(), /首次回读缺少更新人字段/);
    await page.getByLabel('已核对本批小红书号与达人对应关系', { exact: true }).check();
    await page.getByRole('button', { name: '查询选中达人', exact: true }).click(); await page.waitForFunction(() => !busy);
    const source = page.getByLabel('回补来源 · Fixture A', { exact: true });
    const kind = page.getByLabel('回补类型 · Fixture A', { exact: true });
    const value = page.locator('[data-batch-contact-value]');
    assert.equal(await source.inputValue(), ''); assert.equal(await kind.inputValue(), ''); assert.equal(await value.count(), 0);
    await source.selectOption('5'); assert.equal(await value.textContent(), raw);
    assert.equal(await value.locator('*').count(), 0);
    for (const width of [320, 960]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => {
        document.querySelector('.feishu-batch-row').style.width='240px';
        document.querySelector('.feishu-batch-row').querySelectorAll('input,select').forEach(n=>n.style.maxWidth='100%');
      });
      const geometry = await value.evaluate(node => ({ visible: node.getBoundingClientRect().height > 0,
        wraps: getComputedStyle(node).whiteSpace === 'pre-wrap' && getComputedStyle(node).overflowWrap === 'anywhere',
        fits: node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight }));
      assert.deepEqual(geometry, { visible: true, wraps: true, fits: true });
    }
    await kind.selectOption('wechat'); await page.getByLabel('回填 · Fixture A', { exact: true }).check();
    await source.selectOption('6');
    assert.equal(await value.textContent(), 'other_fixture'); assert.equal(await kind.inputValue(), '');
    assert.equal(await page.getByLabel('回填 · Fixture A', { exact: true }).isChecked(), false);
    await source.selectOption(''); assert.equal(await value.count(), 0);
    assert.deepEqual(await page.evaluate(() => window.calls), ['listRecords', 'listRecords', 'lookup']);
    assert.equal(await page.evaluate(() => safetyConfirmed), false); assert.equal(await page.evaluate(() => operator), null);
    assert.equal(requests, 0); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
const readingSection = (root, kind) => walk(root).find(n => n.className === `feishu-${kind}`);
test('batch scroll: real Chrome retains source, kind and lease-expiry rerenders without reviving authority or stale scope', {
  skip: !process.env.CHROME_PATH, timeout: 30000
}, async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const context = await browser.newContext(); let requests = 0;
    await context.route('**/*', route => { requests++; return route.abort(); });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><meta charset="utf-8"><div id="mount"></div>');
    await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname, '../renderer/app.css'), 'utf8') });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../renderer/views/feishu.js'), 'utf8').replace(/^export /gm, '') + `
      window.calls=[];window.desktopAPI={feishu:{
        prepare:async()=>{window.calls.push('prepare');return {ok:false};},
        execute:async()=>{window.calls.push('execute');return {ok:false};},
        applyContact:async()=>{window.calls.push('applyContact');return {ok:false};}}};
      window.fixtureNow=Date.now();const RealDate=Date;
      Date=class extends RealDate { static now(){return window.fixtureNow;} };
      const nativeTimeout=setTimeout;
      setTimeout=(callback,delay,...args)=>{
        if(delay>100000){window.leaseCallback=callback;return -1;}
        return nativeTimeout(callback,delay,...args);
      };
      window.fixtureContext={runDir:'scroll-fixture',rows:Array.from({length:15},(_,i)=>({
        rowId:'row-'+i,creatorName:'Fixture '+i,xhsId:'fixture-'+i,selected:true})),
        save:async()=>({ok:true}),rerender:()=>window.renderFixture()};
      window.renderFixture=()=>document.getElementById('mount').replaceChildren(renderFeishuWorkbench(window.fixtureContext));
      window.renderFixture();connection={connected:true,target:'fixture/creator',fields:[]};
      batchOpen=true;singleOpen=true;
      operator={token:'fixture-operator',name:'Fixture Operator',checkedAt:new Date(window.fixtureNow).toISOString()};
      operatorConfirmed=true;safetyConfirmed=false;
      window.renderFixture();
      for(const item of batch.items){item.queriedIdentity=contactRowIdentity(window.fixtureContext.rows.find(row=>row.rowId===item.rowId));item.result={ok:true,token:'fixture-'+item.rowId,preview:{status:'manual_review',candidates:[
        {recordId:5,kind:'unclassified',value:'fictional contact'},
        {recordId:6,kind:'unclassified',value:'other fictional contact'}]}};}
      batch.items[3].recordId='5';batch.items[3].kind='phone';batch.items[3].approved=true;
      window.renderFixture();
    ` });
    assert.deepEqual(errors, []);
    const list = page.getByLabel('批量回补名单', { exact: true });
    await list.evaluate(node => { node.scrollTop = 850; node.dispatchEvent(new Event('scroll')); });
    const top = await list.evaluate(node => node.scrollTop); assert.ok(top > 0);
    await page.evaluate(() => {
      window.oldList=document.querySelector('.feishu-batch-list');
      const source=document.querySelector('[aria-label="回补来源 · Fixture 3"]');
      source.value='6';source.dispatchEvent(new Event('change'));
    });
    const afterFrame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await afterFrame();
    assert.equal(await list.evaluate(node => node.scrollTop), top, 'source rerender must retain inner scroll');
    assert.equal(await page.evaluate(() => batch.items[3].kind), '');
    assert.equal(await page.evaluate(() => batch.items[3].approved), false);
    await page.evaluate(() => { window.oldList.scrollTop=0;window.oldList.dispatchEvent(new Event('scroll')); });
    await page.evaluate(() => {
      const kind=document.querySelector('[aria-label="回补类型 · Fixture 3"]');
      kind.value='phone';kind.dispatchEvent(new Event('change'));
    });
    await afterFrame();
    assert.equal(await list.evaluate(node => node.scrollTop), top, 'kind rerender and detached scroll cannot reset position');
    assert.equal(await page.evaluate(() => batch.items[3].approved), false);
    await page.evaluate(() => {
      plan={token:'fixture-plan',action:'create',name:'[AI测试] Fixture',fields:[]};
      window.fixtureNow+=300001;window.leaseCallback();
    });
    await afterFrame();
    assert.equal(await list.evaluate(node => node.scrollTop), top, 'lease expiry must preserve reading position only');
    assert.equal(await page.evaluate(() => operatorConfirmed), false);
    assert.equal(await page.evaluate(() => operatorReady()), false);
    assert.equal(await page.evaluate(() => plan), null);
    assert.equal(await page.evaluate(() => safetyConfirmed), false);
    await page.evaluate(() => {
      const nativeFrame=requestAnimationFrame;window.pendingFrames=[];
      requestAnimationFrame=callback=>{window.pendingFrames.push(callback);return 0;};
      window.renderFixture();window.obsoleteList=document.querySelector('.feishu-batch-list');
      window.fixtureContext.runDir='other-scroll-fixture';window.renderFixture();
      window.pendingFrames.splice(0).forEach(callback=>callback());requestAnimationFrame=nativeFrame;
      window.obsoleteList.scrollTop=500;window.obsoleteList.dispatchEvent(new Event('scroll'));
      window.renderFixture();
    });
    await afterFrame();
    assert.equal(await list.evaluate(node => node.scrollTop), 0, 'new run must not inherit old scroll or callbacks');
    assert.equal(await page.evaluate(() => batch.items.every(i => !i.recordId && !i.kind && !i.approved)), true);
    assert.equal(await page.evaluate(() => operator), null);
    assert.deepEqual(await page.evaluate(() => window.calls), []);
    assert.equal(requests, 0); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
function toggleReading(section) {
  assert.equal(typeof section.children[0].handlers.click, 'function');
  section.children[0].handlers.click({ preventDefault() {} });
}
function readingHarness(status = 'verified') {
  const h = harness();
  h.evaluate(`connection.target='fixture-a/creator';cloudHistory=[{target:connection.target,
    creatorName:'Reading Fixture',maintainerName:'Original Owner',status:${JSON.stringify(status)},
    result:{entryId:'reading-entry',recordId:'41'}}];`);
  return h;
}
test('reading state: opened history survives refresh pending, success and failure without changing authority', async () => {
  for (const ok of [true, false]) {
    const h = readingHarness(); let root = h.render(), finish;
    h.ctx.rerender = () => { root = h.render(); };
    const original = h.evaluate('JSON.stringify([cloudHistory,operator,operatorConfirmed,safetyConfirmed,plan])');
    h.api.listRecords = () => { h.calls.push('listRecords'); return new Promise(resolve => { finish = resolve; }); };
    toggleReading(readingSection(root, 'cloud-history'));
    byText(root, '刷新提交结果').handlers.click();
    assert.equal(readingSection(root, 'cloud-history').open, true);
    finish(ok ? { ok: true, records: [] } : { ok: false, code: 'FEISHU_HTTP_ERROR', status: 403 });
    await new Promise(setImmediate);
    assert.equal(readingSection(root, 'cloud-history').open, true);
    assert.equal(h.evaluate('JSON.stringify([cloudHistory,operator,operatorConfirmed,safetyConfirmed,plan])'), original);
    assert.deepEqual(h.calls, ['listRecords']);
  }
});
test('reading state: explicit history collapse survives render and last unknown reconciliation stays open', async () => {
  const h = readingHarness('unknown'); let root = h.render();
  assert.equal(readingSection(root, 'cloud-history').open, true);
  toggleReading(readingSection(root, 'cloud-history'));
  root = h.render(); assert.equal(readingSection(root, 'cloud-history').open, false);
  toggleReading(readingSection(root, 'cloud-history'));
  h.ctx.rerender = () => { root = h.render(); };
  h.api.reconcile = async p => { h.calls.push(['reconcile', p.entryId]); return { ok: true, status: 'verified', recordId: '41' }; };
  byText(root, '核对提交结果').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('cloudHistory[0].status'), 'verified');
  assert.equal(readingSection(root, 'cloud-history').open, true);
  assert.ok(byText(root, '历史提交成功 · 已回读'));
  assert.deepEqual(h.calls, [['reconcile', 'reading-entry']]);
});
test('reading state: dirty settings preserve explicit open and closed choices but never preserve the secret input', () => {
  const h = readingHarness(); let root = h.render();
  toggleReading(readingSection(root, 'settings'));
  const key = byLabel(root, '项目 Key'); key.value = 'fixture-edited'; key.handlers.input();
  byLabel(root, 'Plugin Secret').value = 'fictional-unsaved-value';
  root = h.render(); assert.equal(readingSection(root, 'settings').open, true);
  assert.equal(h.evaluate('configDirty'), true); assert.equal(byLabel(root, '项目 Key').value, 'fixture-edited');
  assert.equal(byLabel(root, 'Plugin Secret').value, '');
  toggleReading(readingSection(root, 'settings'));
  assert.equal(readingSection(h.render(), 'settings').open, false);
  assert.deepEqual(h.calls, []);
});
test('reading state: target isolation and run changes preserve only reading choices and reject obsolete node events', () => {
  const h = readingHarness(); let root = h.render();
  const oldHistory = readingSection(root, 'cloud-history'), oldSettings = readingSection(root, 'settings');
  toggleReading(oldHistory); toggleReading(oldSettings);
  h.evaluate("connection={...connection,target:'fixture-b/creator'};"); root = h.render();
  assert.equal(readingSection(root, 'cloud-history').open, false); assert.equal(readingSection(root, 'settings').open, false);
  oldHistory.open = false; oldHistory.handlers.toggle(); oldSettings.open = false; oldSettings.handlers.toggle();
  h.evaluate("connection={...connection,target:'fixture-a/creator'};"); root = h.render();
  assert.equal(readingSection(root, 'cloud-history').open, true); assert.equal(readingSection(root, 'settings').open, true);
  const prior = readingSection(root, 'cloud-history'); toggleReading(prior); root = h.render();
  prior.open = true; prior.handlers.toggle(); toggleReading(prior);
  assert.equal(readingSection(h.render(), 'cloud-history').open, false);
  toggleReading(readingSection(h.render(), 'cloud-history'));
  h.evaluate("operator={token:'fixture-old',name:'Fixture Operator',checkedAt:new Date().toISOString()};operatorConfirmed=true;safetyConfirmed=true;plan={token:'old-plan'};");
  h.ctx.runDir = 'other-reading-run'; root = h.render();
  assert.equal(readingSection(root, 'cloud-history').open, true); assert.equal(readingSection(root, 'settings').open, true);
  assert.equal(h.evaluate('operator'), null); assert.equal(h.evaluate('operatorConfirmed'), false);
  assert.equal(h.evaluate('safetyConfirmed'), false); assert.equal(h.evaluate('plan'), null);
  const detached = readingSection(root, 'cloud-history');
  h.evaluate("connection={...connection,connected:false,target:''};"); h.render();
  h.evaluate("connection={...connection,connected:true,target:'fixture-a/creator'};");
  detached.open = false; detached.handlers.toggle();
  assert.equal(readingSection(h.render(), 'cloud-history').open, true);
  assert.deepEqual(h.calls, []);
});
test('reading state: lease expiry preserves reading choices and history but cannot renew authority or dispatch', async () => {
  const h = cloudHarness(), clock = h.clock(); await h.preview(); let root = h.render();
  const stale = byText(root, '确认新建到飞书（2）');
  toggleReading(readingSection(root, 'cloud-history')); toggleReading(readingSection(root, 'settings'));
  const deadline = h.evaluate('operatorDeadline()'), calls = h.calls.length;
  h.ctx.rerender = () => { root = h.render(); };
  clock.advance(300001);
  assert.equal(readingSection(root, 'cloud-history').open, true); assert.equal(readingSection(root, 'settings').open, true);
  assert.equal(h.evaluate('operatorDeadline()'), deadline); assert.equal(h.evaluate('operatorConfirmed'), false);
  assert.equal(h.evaluate('cloud.items.every(i=>i.plan===null)'), true);
  stale.handlers.click(); await new Promise(setImmediate); assert.equal(h.calls.length, calls);
});
test('reading state: a new renderer session uses defaults instead of recovering prior reading choices or authority', () => {
  const h = readingHarness(); const root = h.render();
  toggleReading(readingSection(root, 'cloud-history')); toggleReading(readingSection(root, 'settings'));
  const fresh = readingHarness(); const freshRoot = fresh.render();
  assert.equal(readingSection(freshRoot, 'cloud-history').open, false); assert.equal(readingSection(freshRoot, 'settings').open, false);
  assert.equal(fresh.evaluate('operator'), null); assert.equal(fresh.evaluate('operatorConfirmed'), false);
  assert.equal(fresh.evaluate('plan'), null); assert.deepEqual(fresh.calls, []);
});

test('reading state: real Chrome DOM refresh, reconciliation, targets and expiry retain reading state only', {
  skip: !process.env.CHROME_PATH, timeout: 30000
}, async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const context = await browser.newContext(); let requests = 0;
    await context.route('**/*', route => { requests++; return route.abort(); });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><meta charset="utf-8"><div id="mount"></div>');
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../renderer/views/feishu.js'), 'utf8').replace(/^export /gm, '') + `
      window.calls=[]; window.holdRefresh=false;
      window.desktopAPI={feishu:{
        listRecords:async()=>{window.calls.push('listRecords');return window.holdRefresh
          ? new Promise(resolve=>{window.finishRefresh=resolve;}) : {ok:true,records:[]};},
        reconcile:async p=>{window.calls.push(['reconcile',p.entryId]);return {ok:true,status:'verified',recordId:'41'};},
        prepare:async()=>{throw new Error('unexpected prepare');},execute:async()=>{throw new Error('unexpected execute');}
      }};
      const ctx={runDir:'reading-run',rows:[{rowId:'row',creatorName:'Reading Fixture',selected:true,xhsId:'fixture-account'}],
        save:async()=>({ok:true}),rerender:()=>window.renderFixture()};
      window.renderFixture=()=>document.getElementById('mount').replaceChildren(renderFeishuWorkbench(ctx));
      window.renderFixture();
      connection={connected:true,target:'fixture-a/creator',fields:[]};
      cloudHistory=[{target:connection.target,creatorName:'Reading Fixture',maintainerName:'Original Owner',
        status:'verified',result:{entryId:'reading-entry',recordId:'41'}}];
      window.renderFixture();
    ` });
    const history = page.locator('.feishu-cloud-history'), settings = page.locator('.feishu-settings');
    const open = locator => locator.evaluate(node => node.open);
    await history.locator('summary').click();
    await page.evaluate(() => { window.holdRefresh = true; });
    await history.getByRole('button', { name: '刷新提交结果', exact: true }).click();
    await page.waitForFunction(() => typeof window.finishRefresh === 'function');
    assert.equal(await open(history), true);
    await page.evaluate(() => { window.finishRefresh({ ok: true, records: [] }); });
    await page.waitForFunction(() => !busy); assert.equal(await open(history), true);
    await page.evaluate(() => { cloudHistory[0].status = 'unknown'; window.renderFixture(); });
    await history.locator('summary').click(); await page.evaluate(() => window.renderFixture());
    assert.equal(await open(history), false);
    await history.locator('summary').click();
    await history.getByRole('button', { name: '核对提交结果', exact: true }).click();
    await page.waitForFunction(() => !busy && cloudHistory[0].status === 'verified');
    assert.equal(await open(history), true);
    assert.equal(await history.getByText('历史提交成功 · 已回读', { exact: true }).isVisible(), true);
    await settings.locator('summary').click(); await page.getByLabel('项目 Key', { exact: true }).fill('fixture-edited');
    await page.evaluate(() => window.renderFixture()); assert.equal(await open(settings), true);
    assert.equal(await page.getByLabel('项目 Key', { exact: true }).inputValue(), 'fixture-edited');
    await page.evaluate(() => { window.oldHistory=document.querySelector('.feishu-cloud-history');
      window.oldSettings=document.querySelector('.feishu-settings');
      connection={...connection,target:'fixture-b/creator'}; window.renderFixture(); });
    assert.equal(await open(history), false); assert.equal(await open(settings), false);
    await page.evaluate(() => { window.oldHistory.open=false;window.oldHistory.dispatchEvent(new Event('toggle'));
      window.oldSettings.open=false;window.oldSettings.dispatchEvent(new Event('toggle'));
      connection={...connection,target:'fixture-a/creator'};window.renderFixture(); });
    assert.equal(await open(history), true); assert.equal(await open(settings), true);
    await page.evaluate(() => { configDirty=false;operator={token:'expired-fixture',name:'Fixture Operator',
      checkedAt:new Date(Date.now()-300001).toISOString()};operatorConfirmed=true;plan={token:'stale'};
      window.renderFixture(); });
    assert.equal(await open(history), true); assert.equal(await open(settings), true);
    assert.equal(await page.evaluate(() => operatorConfirmed), false);
    assert.equal(await page.evaluate(() => plan), null);
    assert.equal(await page.locator('[data-cloud-prepare]').isDisabled(), true);
    assert.equal(await page.locator('[data-cloud-submit]').isDisabled(), true);
    await page.evaluate(() => { ctx.runDir='new-reading-run';window.renderFixture(); });
    assert.equal(await open(history), true); assert.equal(await open(settings), true);
    assert.equal(await page.evaluate(() => operator), null);
    assert.deepEqual(await page.evaluate(() => window.calls), ['listRecords', ['reconcile', 'reading-entry']]);
    assert.equal(requests, 0); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('dedup failures distinguish a known duplicate from an incomplete ownership review without implying invitation', () => {
  const h = harness();
  assert.match(h.evaluate("failure({code:'FEISHU_DUPLICATE_MAINTAINER'})"), /同号同经纪人.*跳过重复建档.*未发送邀约/);
  assert.match(h.evaluate("failure({code:'FEISHU_DUPLICATE_REVIEW_REQUIRED'})"), /无法完整核实.*未新建/);
});
test('single-operation disclosure stays open across mode, list and result renders without a current creator', async () => {
  const h = harness(); h.evaluate("currentRow='';");
  let root = h.render();
  const disclosure = byText(root, '单条操作与测试清理').parent;
  assert.equal(disclosure.open, false);
  let prevented = false;
  byText(root, '单条操作与测试清理').handlers.click({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.evaluate('singleOpen'), true, 'summary click is recorded before a delayed toggle');
  byText(root, '测试清理').handlers.click();
  root = h.render();
  assert.equal(byText(root, '单条操作与测试清理').parent.open, true);
  assert.equal(h.evaluate('action'), 'delete');
  h.api.listRecords = async () => ({ ok: true, records: [] });
  byText(root, '刷新本软件创建清单').handlers.click(); await new Promise(setImmediate);
  root = h.render();
  assert.equal(byText(root, '单条操作与测试清理').parent.open, true);
  const current = byText(root, '单条操作与测试清理').parent;
  byText(root, '单条操作与测试清理').handlers.click({ preventDefault() {} });
  assert.equal(current.open, false);
  disclosure.open = true; disclosure.handlers.toggle();
  assert.equal(byText(h.render(), '单条操作与测试清理').parent.open, false);
  h.ctx.runDir = 'fixture-other';
  assert.equal(byText(h.render(), '单条操作与测试清理').parent.open, false);
  assert.equal(h.evaluate('action'), 'create');
  assert.deepEqual(h.calls.filter(c => ['prepare', 'execute'].includes(c)), []);
});
test('dedup review displays only whitelisted failure predicate and response ordinals, never payload', () => {
  const h = harness();
  const result = h.evaluate(`failure({code:'FEISHU_DUPLICATE_REVIEW_REQUIRED',dedupReview:{
    reason:'OTHER_OWNERS_NULL',pageOrdinal:2,recordOrdinal:3,secret:'PRIVATE_SENTINEL'}})`);
  assert.match(result, /查询第2页第3条：其他角色人员列表为空值 \[OTHER_OWNERS_NULL\]/);
  assert.doesNotMatch(result, /PRIVATE_SENTINEL/);
  for (const diagnostic of ["{reason:'PRIVATE_SENTINEL',pageOrdinal:1}",
    "{reason:'ROLE_TYPE_MISSING',pageOrdinal:21}",
    "{reason:'ROLE_TYPE_MISSING',pageOrdinal:1,recordOrdinal:'PRIVATE_SENTINEL'}"]) {
    const message = h.evaluate(`failure({code:'FEISHU_DUPLICATE_REVIEW_REQUIRED',dedupReview:${diagnostic}})`);
    assert.doesNotMatch(message, /PRIVATE_SENTINEL|查询第|ROLE_TYPE_MISSING/);
  }
  assert.equal(h.evaluate("dedupDiagnostic({code:'FEISHU_OTHER',dedupReview:{reason:'ROLE_TYPE_MISSING',pageOrdinal:1}})"), '');
});
function batchHarness(rows) {
  const h = harness();
  h.ctx.rows = rows || [
    { rowId: 'a', creatorName: 'Fixture A', xhsId: '001234', selected: true },
    { rowId: 'b', creatorName: 'Fixture B', xhsId: '005678', selected: true }
  ];
  h.evaluate('batch=null;'); h.render();
  h.api.lookup = async p => {
    h.calls.push(['lookup', p.rowId, p.accountNumber]);
    return { ok: true, token: `token-${p.rowId}`, preview: { status: 'ready_for_review',
      candidates: [{ recordId: p.rowId === 'a' ? 5 : 6, kind: 'wechat', value: `fixture_${p.rowId}` }] } };
  };
  h.api.applyContact = async p => { h.calls.push(['apply', p.rowId]); return { ok: true, patch: { wechatId: `fixture_${p.rowId}` } }; };
  h.ctx.apply = async (run, id, patch) => {
    h.calls.push(['save', run, id]); Object.assign(h.ctx.rows.find(r => r.rowId === id), patch); return { ok: true };
  };
  h.query = async () => {
    h.render();
    h.evaluate('batch.confirmed=true;'); byText(h.render(), '查询选中达人').handlers.click();
    await new Promise(setImmediate);
  };
  h.review = () => {
    for (const item of JSON.parse(h.evaluate('JSON.stringify(batch.items)'))) {
      const candidate = item.result?.preview?.candidates[0];
      if (!candidate || !['wechat', 'phone', 'email'].includes(candidate.kind)) continue;
      const source = byLabel(h.render(), `回补来源 · ${item.creatorName}`);
      source.value = String(candidate.recordId); source.handlers.change();
      const kind = byLabel(h.render(), `回补类型 · ${item.creatorName}`);
      kind.value = candidate.kind; kind.handlers.change();
      const include = walk(h.render()).find(n => n.children?.some(c => c.textContent === `回填 · ${item.creatorName}`)).children[0];
      if (!include.disabled) { include.checked = true; include.handlers.change(); }
    }
  };
  return h;
}

test('batch queries only checked rows serially, preserves leading zeros, and never auto-applies', async () => {
  const h = batchHarness(); h.ctx.rows.push({ rowId: 'c', creatorName: 'Fixture C', xhsId: 'third' });
  assert.equal(byText(h.render(), '查询选中达人').disabled, true);
  await h.query();
  assert.deepEqual(h.calls, [['lookup', 'a', '001234'], ['lookup', 'b', '005678']]);
  assert.equal(h.evaluate('batch.progress'), 2);
  assert.equal(byText(h.render(), '确认回填本地（0）').disabled, true);
  assert.match(h.evaluate('message'), /查询完成/);
});

test('one batch confirmation applies reviewed rows and persists each, without cloud execute', async () => {
  const h = batchHarness(); await h.query(); h.review();
  byText(h.render(), '确认回填本地（2）').handlers.click(); await new Promise(setImmediate);
  assert.deepEqual(h.calls.slice(2), [['lookup', 'a', '001234'], ['apply', 'a'], ['save', 'fixture-a', 'a'],
    ['lookup', 'b', '005678'], ['apply', 'b'], ['save', 'fixture-a', 'b']]);
  assert.equal(h.evaluate('batch.items.filter(i=>i.applied).length'), 2);
  assert.equal(byText(h.render(), '确认回填本地（0）').disabled, true);
});

test('batch identities, missing IDs and the 50-row ceiling are explicit gates', async () => {
  const h = batchHarness(); h.ctx.rows[1].xhsId = ''; h.evaluate('batch=null;');
  await h.query(); assert.deepEqual(h.calls, [['lookup', 'a', '001234']]);
  assert.ok(byText(h.render(), '缺少有效的主页小红书号，已跳过 (FEISHU_IDENTITY_INVALID)'));
  h.ctx.rows = Array.from({ length: 51 }, (_, i) => ({ rowId: `r${i}`, creatorName: `Fixture ${i}`, selected: true, xhsId: 'fixture' }));
  h.evaluate('batch=null;'); h.render(); h.evaluate('batch.confirmed=true;');
  assert.equal(byText(h.render(), '查询选中达人').disabled, true);
});

test('ambiguous sources and unclassified contact types require explicit batch review', async () => {
  const h = batchHarness(); h.api.lookup = async p => ({ ok: true, token: p.rowId, preview: { status: 'manual_review', candidates:
    p.rowId === 'a' ? [{ recordId: 5, kind: 'unclassified', value: '12345678' }]
      : [{ recordId: 6, kind: 'wechat', value: 'fixture_b' }, { recordId: 7, kind: 'wechat', value: 'fixture_other' }] } });
  await h.query(); assert.equal(h.evaluate('batch.items.filter(i=>i.approved).length'), 0);
  const firstSource = byLabel(h.render(), '回补来源 · Fixture A'); firstSource.value = '5'; firstSource.handlers.change();
  const kind = byLabel(h.render(), '回补类型 · Fixture A'); kind.value = 'phone'; kind.handlers.change();
  const source = byLabel(h.render(), '回补来源 · Fixture B'); source.value = '7'; source.handlers.change();
  const secondKind = byLabel(h.render(), '回补类型 · Fixture B'); secondKind.value = 'wechat'; secondKind.handlers.change();
  for (const name of ['Fixture A', 'Fixture B']) {
    const label = walk(h.render()).find(n => n.children?.some(c => c.textContent === `回填 · ${name}`));
    assert.equal(label.children[0].disabled, false); label.children[0].checked = true; label.children[0].handlers.change();
  }
  assert.equal(byText(h.render(), '确认回填本地（2）').disabled, false);
});

test('batch does not include conflicting local values or status placeholders', async () => {
  const h = batchHarness(); h.ctx.rows[0].wechatId = 'different_fixture';
  h.api.lookup = async p => ({ ok: true, token: p.rowId, preview: { status: 'local_conflict', candidates:
    [{ recordId: 5, kind: p.rowId === 'a' ? 'wechat' : 'status', value: p.rowId === 'a' ? 'fixture_a' : '待填' }] } });
  await h.query(); h.review(); assert.equal(byText(h.render(), '确认回填本地（0）').disabled, true);
  assert.ok(byText(h.render(), '本地值不同或类型不符，未纳入回填'));
});

test('partial query and local-save failures stay per-row, not falsely reported as saved', async () => {
  const h = batchHarness(); await h.query(); h.review();
  h.ctx.apply = async (run, id) => ({ ok: id !== 'a', code: 'FEISHU_LOCAL_CONFLICT' });
  byText(h.render(), '确认回填本地（2）').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('batch.items[0].applied'), false); assert.equal(h.evaluate('batch.items[1].applied'), true);
  assert.match(h.evaluate('message'), /已保存 1/);
  const other = batchHarness(); other.api.lookup = async p => p.rowId === 'a'
    ? { ok: false, code: 'FEISHU_REQUEST_TIMEOUT' }
    : { ok: true, token: 'b', preview: { status: 'not_found', candidates: [] } };
  await other.query(); assert.equal(other.evaluate('batch.progress'), 2);
  assert.equal(other.evaluate('batch.items[0].result.ok'), false);
});

test('stop request waits for the current lookup then prevents the next request', async () => {
  const h = batchHarness(); let resolve;
  h.api.lookup = p => { h.calls.push(['lookup', p.rowId]); return new Promise(r => { resolve = r; }); };
  h.evaluate('batch.confirmed=true;'); byText(h.render(), '查询选中达人').handlers.click(); await new Promise(setImmediate);
  byText(h.render(), '停止批量').handlers.click(); assert.match(h.evaluate('message'), /正在停止/);
  resolve({ ok: true, token: 'a', preview: { status: 'not_found', candidates: [] } }); await new Promise(setImmediate);
  assert.deepEqual(h.calls, [['lookup', 'a']]); assert.equal(h.evaluate('batch.phase'), 'stopped');
});

test('switching run during query discards in-flight results and never applies to the new run', async () => {
  const h = batchHarness(); let resolve;
  h.api.lookup = () => new Promise(r => { resolve = r; });
  h.evaluate('batch.confirmed=true;'); byText(h.render(), '查询选中达人').handlers.click(); await new Promise(setImmediate);
  h.ctx.runDir = 'new-run'; h.ctx.rows = []; h.render();
  resolve({ ok: true, token: 'old', preview: { status: 'not_found', candidates: [] } }); await new Promise(setImmediate);
  assert.equal(h.evaluate('batch.items.length'), 0); assert.equal(h.evaluate('batch.confirmed'), false);
  assert.equal(h.calls.length, 0);
});

test('authentication or rate-limit failure stops a batch and retains the visible reason', async () => {
  for (const status of [401, 403, 429]) {
    const h = batchHarness(); h.api.lookup = async p => { h.calls.push(p.rowId); return { ok: false, code: 'FEISHU_HTTP_ERROR', status }; };
    await h.query(); assert.deepEqual(h.calls, ['a']); assert.equal(h.evaluate('batch.phase'), 'stopped');
    assert.match(h.evaluate('message'), new RegExp(`HTTP ${status}`));
  }
});

test('changing batch identity invalidates confirmation and preview; late-loaded rows appear', async () => {
  const h = batchHarness(); await h.query();
  const account = byLabel(h.render(), '小红书号 · Fixture A'); account.value = 'new_fixture'; account.handlers.input();
  assert.equal(h.evaluate('batch.confirmed'), false); assert.equal(h.evaluate('batch.items[0].result'), null);
  h.ctx.rows.push({ rowId: 'c', creatorName: 'Fixture C', selected: true, xhsId: 'third_fixture' });
  assert.ok(byLabel(h.render(), '小红书号 · Fixture C'));
});

test('batch confirmation cancellation has no apply/save side effects', async () => {
  const h = batchHarness(); await h.query(); h.review(); h.evaluate('confirm=()=>false;');
  byText(h.render(), '确认回填本地（2）').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.length, 2); assert.equal(h.evaluate('batch.items.some(i=>i.applied)'), false);
});

test('expired preview is failed per row and cannot count as saved', async () => {
  const h = batchHarness(); await h.query(); h.review();
  h.api.applyContact = async () => ({ ok: false, code: 'FEISHU_PREVIEW_EXPIRED' });
  byText(h.render(), '确认回填本地（2）').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.length, 4); assert.equal(h.calls.some(c => c[0] === 'save'), false);
  assert.match(h.evaluate('message'), /已保存 0/);
  assert.ok(byText(h.render(), '预览已过期，请重新查询 (FEISHU_PREVIEW_EXPIRED)'));
});

test('batch contact confirmation refreshes each exact reviewed source before local application', async () => {
  const h = batchHarness(); await h.query(); h.review(); h.calls.length = 0;
  byText(h.render(), '确认回填本地（2）').handlers.click(); await new Promise(setImmediate);
  assert.deepEqual(h.calls, [['lookup', 'a', '001234'], ['apply', 'a'], ['save', 'fixture-a', 'a'],
    ['lookup', 'b', '005678'], ['apply', 'b'], ['save', 'fixture-a', 'b']]);
});

test('batch contact refresh rejects changed, missing or duplicate source values without applying', async () => {
  for (const mode of ['changed', 'missing', 'duplicate', 'type', 'variant', 'incomplete', 'token', 'failed', 401, 403, 429]) {
    const h = batchHarness([{ rowId: 'a', creatorName: 'Fixture A', xhsId: '001234', selected: true }]);
    await h.query(); h.review(); h.calls.length = 0;
    h.api.lookup = async () => {
      h.calls.push('refresh');
      if (mode === 'failed') return { ok: false, code: 'FEISHU_REQUEST_TIMEOUT' };
      if (typeof mode === 'number') return { ok: false, code: 'FEISHU_HTTP_ERROR', status: mode };
      const original = { recordId: 5, kind: 'wechat', value: 'fixture_a' };
      if (['variant', 'incomplete', 'token'].includes(mode)) return { ok: true,
        ...(mode !== 'token' ? { token: 'fresh' } : {}), preview: { status: mode === 'incomplete' ? 'incomplete' : 'ready_for_review',
          candidates: [{ ...original, ...(mode === 'variant' ? { identityVariant: 'trailing_lf' } : {}) }] } };
      return { ok: true, token: 'fresh', preview: { status: 'ready_for_review', candidates:
        mode === 'changed' ? [{ ...original, value: 'changed_fixture' }]
        : mode === 'missing' ? [] : mode === 'duplicate' ? [original, original]
        : [{ ...original, kind: 'phone' }] } };
    };
    byText(h.render(), '确认回填本地（1）').handlers.click(); await new Promise(setImmediate);
    assert.deepEqual(h.calls, ['refresh']);
    assert.equal(h.evaluate('batch.items[0].applied'), false);
    assert.equal(h.evaluate('batch.items[0].approved'), false);
  }
});

test('batch refresh uses a new token after lengthy human review without renewing cloud authority', async () => {
  const h = batchHarness([{ rowId: 'a', creatorName: 'Fixture A', xhsId: '001234', selected: true }]);
  const clock = h.clock(); await h.query(); h.review(); clock.advance(600001);
  h.api.lookup = async () => ({ ok: true, token: 'fresh-token', preview: { status: 'ready_for_review',
    candidates: [{ recordId: 5, kind: 'wechat', value: 'fixture_a' }] } });
  h.api.applyContact = async p => {
    assert.equal(p.token, 'fresh-token'); return { ok: true, patch: { wechatId: 'fixture_a' } };
  };
  byText(h.render(), '确认回填本地（1）').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('batch.items[0].applied'), true);
  assert.equal(h.evaluate('operator || plan'), null);
});

test('batch refresh cannot apply after stop, identity, selection, source, run or connection changes', async () => {
  for (const change of ['stop', 'account', 'source', 'approval', 'selection', 'identity', 'run', 'connection']) {
    const h = batchHarness([{ rowId: 'a', creatorName: 'Fixture A', xhsId: '001234', selected: true }]);
    await h.query(); h.review(); let finish;
    h.api.lookup = () => new Promise(resolve => { finish = resolve; });
    h.calls.length = 0;
    byText(h.render(), '确认回填本地（1）').handlers.click(); await new Promise(setImmediate);
    if (change === 'identity') h.ctx.rows[0].creatorName = 'Changed Fixture';
    else if (change === 'run') { h.ctx.runDir = 'other-run'; h.render(); }
    else h.evaluate(({ stop: 'batch.stopRequested=true', account: "batch.items[0].account='other'",
      source: "batch.items[0].recordId='6'", approval: 'batch.items[0].approved=false',
      selection: 'batch.items[0].selected=false', connection: 'configDirty=true' })[change]);
    finish({ ok: true, token: 'fresh', preview: { status: 'ready_for_review',
      candidates: [{ recordId: 5, kind: 'wechat', value: 'fixture_a' }] } });
    await new Promise(setImmediate);
    assert.deepEqual(h.calls, [], change);
  }
});

test('batch contact review is invalidated by same-row creator changes before confirmation or during initial lookup', async () => {
  for (const property of ['creatorUrl', 'xhsId', 'feishuAccountNumber']) {
    const h = batchHarness([{ rowId: 'a', creatorName: 'Fixture A', creatorUrl: 'https://example.test/a', xhsId: '001234', selected: true }]);
    await h.query(); h.review(); h.calls.length = 0;
    const stale = byText(h.render(), '确认回填本地（1）');
    h.ctx.rows[0][property] = 'changed_fixture';
    stale.handlers.click(); await new Promise(setImmediate);
    assert.deepEqual(h.calls, [], property);
  }
});

test('batch refresh rejects a changed stored account and irreversibly revoked or replaced review objects', async () => {
  for (const change of ['stored-account', 'reconfirm', 'rename-back']) {
    const h = batchHarness([{ rowId: 'a', creatorName: 'Fixture A', xhsId: '001234', selected: true }]);
    await h.query(); h.review(); let finish; h.calls.length = 0;
    h.api.lookup = () => new Promise(resolve => { finish = resolve; });
    byText(h.render(), '确认回填本地（1）').handlers.click(); await new Promise(setImmediate);
    if (change === 'stored-account') h.ctx.rows[0].feishuAccountNumber = 'other_fixture';
    if (change === 'rename-back') {
      h.ctx.rows[0].creatorName = 'Changed Fixture'; h.render();
      h.ctx.rows[0].creatorName = 'Fixture A'; h.render();
    }
    if (change !== 'stored-account') {
      for (const value of [false, true]) {
        const checkbox = walk(h.render()).find(n => n.children?.some(c => c.textContent === '已核对本批小红书号与达人对应关系')).children[0];
        checkbox.checked = value; checkbox.handlers.change();
      }
    }
    finish({ ok: true, token: 'fresh', preview: { status: 'ready_for_review',
      candidates: [{ recordId: 5, kind: 'wechat', value: 'fixture_a' }] } });
    await new Promise(setImmediate);
    assert.deepEqual(h.calls, [], change);
  }
});

test('batch apply reply cannot persist after stored account changes or approval revocation and reapproval', async () => {
  for (const change of ['stored-account', 'reconfirm']) {
    const h = batchHarness([{ rowId: 'a', creatorName: 'Fixture A', xhsId: '001234', selected: true }]);
    await h.query(); h.review(); let finish; h.calls.length = 0;
    h.api.applyContact = () => new Promise(resolve => { finish = resolve; });
    byText(h.render(), '确认回填本地（1）').handlers.click(); await new Promise(setImmediate);
    if (change === 'stored-account') h.ctx.rows[0].feishuAccountNumber = 'changed_fixture';
    else for (const value of [false, true]) {
      const check = walk(h.render()).find(n => n.children?.some(c => c.textContent === '已核对本批小红书号与达人对应关系')).children[0];
      check.checked = value; check.handlers.change();
    }
    finish({ ok: true, patch: { wechatId: 'fixture_a', feishuAccountNumber: '001234' } });
    await new Promise(setImmediate);
    assert.equal(h.calls.some(c => c[0] === 'save'), false, change);
  }
});

test('batch application updates the selected contact draft without overwriting a manual draft', async () => {
  for (const manual of [false, true]) {
    const h = batchHarness([{ rowId: 'a', creatorName: 'Fixture A', xhsId: '001234', selected: true }]);
    h.evaluate(`currentRow='a';draft.contact=${JSON.stringify(manual ? 'Manual contact' : '')};`);
    await h.query(); h.review();
    byText(h.render(), '确认回填本地（1）').handlers.click(); await new Promise(setImmediate);
    assert.equal(h.evaluate('draft.contact'), manual ? 'Manual contact' : '微信：fixture_a');
  }
});

test('real review adapter copied projections retain batch outcomes during pending save, stop and rollback', async () => {
  for (const mode of ['normal', 'pending-render', 'stop', 'rollback']) {
    const h = batchHarness();
    const restored = rawReviewFixture(h, mode === 'rollback');
    const originals = h.ctx.rows.map(row => ({ ...row }));
    const mapRows = h.ctx.rows;
    const apply = h.ctx.apply;
    h.ctx.rows = originals.map(row => ({ ...row }));
    h.ctx.rerender = () => {
      h.ctx.rows = originals.map(row => ({ ...row, ...mapRows.find(r => r.rowId === row.rowId) }));
      h.render();
    };
    h.api.applyContact = async p => ({ ok: true, patch: { wechatId: `fixture_${p.rowId}`, feishuAccountNumber: p.rowId === 'a' ? '001234' : '005678' } });
    h.ctx.apply = async (...args) => {
      const pending = apply(...args);
      if (mode !== 'normal') h.ctx.rerender();
      if (mode === 'stop') byText(h.render(), '停止批量').handlers.click();
      return pending;
    };
    await h.query(); h.review();
    byText(h.render(), '确认回填本地（2）').handlers.click(); await new Promise(setImmediate);
    assert.equal(h.evaluate('batch.items.filter(i=>i.applied).length'), mode === 'rollback' ? 0 : mode === 'stop' ? 1 : 2, mode);
    assert.equal(restored().filter(row => row.wechatId).length, mode === 'rollback' ? 0 : mode === 'stop' ? 1 : 2, mode);
    assert.equal(h.evaluate('batch.items.some(i=>!!i.pendingIdentity)'), false);
  }
});

test('real review adapter single copied snapshot completes without requiring a rerender after save', async () => {
  const h = harness();
  const restored = rawReviewFixture(h);
  h.ctx.rows = h.ctx.rows.map(row => ({ ...row }));
  h.evaluate("accountConfirmed=true;accountNumber='001234';lookup={token:'fixture',preview:{status:'manual_review',candidates:[{recordId:5,kind:'unclassified',value:'fixture original'}]}};");
  h.api.applyContact = async () => ({ ok: true, patch: rawPatch('fixture original') });
  const root = h.render(), kind = byLabel(root, '联系方式类型'); kind.value = 'unclassified';
  byText(root, '确认回填本地').handlers.click(); await new Promise(setImmediate);
  assert.equal(restored()[0].contactRaw, 'fixture original');
  assert.equal(h.evaluate('lookup'), null);
  assert.equal(h.evaluate('draft.contact'), 'fixture original');
  assert.match(h.evaluate('message'), /回填成功/);
});

test('real review adapter single failure after pending projection render reports rollback and clears preview', async () => {
  const h = harness(), originalRows = h.ctx.rows, restored = rawReviewFixture(h, true), apply = h.ctx.apply;
  h.ctx.rows = originalRows.map(row => ({ ...row }));
  h.ctx.rerender = () => { h.ctx.rows = originalRows.map(row => ({ ...row })); h.render(); };
  h.ctx.apply = async (...args) => {
    const pending = apply(...args); h.ctx.rerender(); return pending;
  };
  h.evaluate("accountConfirmed=true;accountNumber='001234';lookup={token:'fixture',preview:{status:'manual_review',candidates:[{recordId:5,kind:'unclassified',value:'fixture original'}]}};");
  h.api.applyContact = async () => ({ ok: true, patch: rawPatch('fixture original') });
  const root = h.render(); byLabel(root, '联系方式类型').value = 'unclassified';
  byText(root, '确认回填本地').handlers.click(); await new Promise(setImmediate);
  assert.deepEqual(restored(), []);
  assert.equal(originalRows[0].contactRaw, undefined);
  assert.equal(h.evaluate('busy'), false);
  assert.equal(h.evaluate('lookup'), null);
  assert.match(h.evaluate('message'), /本地保存失败/);
  assert.notEqual(h.evaluate('draft.contact'), 'fixture original');
});

test('stop during local application finishes the current save before stopping', async () => {
  const h = batchHarness(); await h.query(); h.review(); let resolve;
  h.ctx.apply = () => new Promise(r => { resolve = r; });
  byText(h.render(), '确认回填本地（2）').handlers.click(); await new Promise(setImmediate);
  byText(h.render(), '停止批量').handlers.click();
  resolve({ ok: true }); await new Promise(setImmediate);
  assert.deepEqual(h.calls.slice(2), [['lookup', 'a', '001234'], ['apply', 'a']]);
  assert.equal(h.evaluate('batch.phase'), 'stopped'); assert.equal(h.evaluate('batch.progress'), 1);
});

test('first connection UI: missing copied User Key identifies its field and makes no remote request', async () => {
  const { createFeishuWorkbench } = require('../lib/feishu_workbench');
  let requests = 0;
  const service = createFeishuWorkbench({ fetchImpl: async () => { requests++; throw Error('must not send'); } });
  const h = harness();
  h.evaluate(`connection={connected:false,fields:[],target:''};
    config={pluginId:'fixture-plugin',projectKey:'fixture-project',workItemTypeKey:'fixture-type',userKey:''};`);
  h.api.connect = payload => service.connect(payload);
  const root = h.render(); byLabel(root, 'Plugin Secret').value = 'fixture-private-secret';
  byText(root, '连接并读取字段').handlers.click();
  assert.match(h.evaluate('message'), /正在连接飞书/);
  await new Promise(setImmediate);
  assert.match(h.evaluate('message'), /校验连接配置.*操作人 User Key/);
  assert.equal(requests, 0); assert.equal(h.evaluate('connection.connected'), false);
  assert.equal(byLabel(root, 'Plugin Secret').value, '');
  assert.doesNotMatch(h.evaluate('message'), /fixture-private-secret/);
});

test('connection UI diagnostics distinguish stages and reject injected field values', () => {
  const h = harness();
  for (const [stage, code, expected] of [['connection_auth', 'FEISHU_AUTH_API', '认证插件凭证'],
    ['connection_metadata', 'FEISHU_API_ERROR', '读取项目字段'],
    ['connection_storage', 'FEISHU_STORAGE_SAVE_FAILED', '保存本机连接']]) {
    const result = h.evaluate(`failure(${JSON.stringify({ stage, code, apiCode: 17 })},false)`);
    assert.match(result, new RegExp(expected)); assert.match(result, /API 17/);
  }
  const forged = h.evaluate(`failure({stage:'connection_config',code:'FEISHU_CONFIG_INVALID',configFields:['fixture-private-secret']},false)`);
  assert.doesNotMatch(forged, /fixture-private-secret/);
  assert.doesNotMatch(forged, /请检查：/);
});

test('initial mount restores saved connection once without asking for secret or starting writes', async () => {
  const h = harness();
  h.api.restoreConnection = async () => {
    h.calls.push('restoreConnection');
    return { ok: true, connected: true, saved: true, fields: [], fieldCount: 2, target: 'project/type',
      config: { pluginId: 'fixture-plugin', projectKey: 'project', workItemTypeKey: 'type' } };
  };
  h.render(); await new Promise(setImmediate);
  const root = h.render(); h.render();
  assert.deepEqual(h.calls, ['restoreConnection']);
  assert.equal(h.evaluate('connection.connected && savedConnection'), true);
  assert.equal(walk(root).find(n => n.tagName === 'details').open, false);
  assert.equal(walk(root).find(n => n.type === 'password').value, '');
  assert.equal(h.evaluate('config.userKey'), '');
  assert.ok(byText(root, '已保存本机连接'));
});
test('restore failure retains a saved-connection retry action, never pre-fills credentials', async () => {
  const h = harness(); h.api.restoreConnection = async () => ({ ok: false, saved: true, code: 'FEISHU_HTTP_ERROR' });
  h.render(); await new Promise(setImmediate);
  assert.ok(byText(h.render(), '使用已保存连接'));
  assert.equal(h.evaluate('connection.connected'), false);
  assert.equal(byText(h.render(), '新建跟进'), undefined);
});

test('disconnect and forget revoke visible authority before waiting for storage, preserving submitted history', async () => {
  for (const method of ['disconnect', 'forgetConnection']) {
    const h = cloudHarness(); let finish;
    h.evaluate(`savedConnection=true;singleOpen=true;currentRow='a';accountNumber='001234';accountConfirmed=true;
      config={pluginId:'fixture-plugin',projectKey:'project',workItemTypeKey:'creator',userKey:''};
      records=[{entryId:'old-entry',recordId:'41',target:'project/creator',status:'verified'}];
      lookup={token:'old-lookup',preview:{status:'not_found',candidates:[]}};plan={action:'create',token:'old-plan',name:'[AI测试] Fixture',target:'project/creator',fields:[]};
      cloudHistory=[{creatorName:'Submitted Fixture',target:'project/creator',status:'unknown',result:{entryId:'submitted-entry'}}];`);
    const beforeDisconnect = h.render();
    const history = h.evaluate('JSON.stringify(cloudHistory)');
    h.api[method] = () => new Promise(resolve => { finish = resolve; });
    byText(beforeDisconnect, method === 'disconnect' ? '断开连接' : '忘记本机连接').handlers.click();
    await new Promise(setImmediate);
    assert.equal(h.evaluate('connection.connected'), false, 'UI permission must be revoked before persistence returns');
    assert.equal(h.evaluate('operator || plan || lookup'), null);
    assert.equal(h.evaluate('operatorConfirmed || safetyConfirmed'), false);
    assert.equal(h.evaluate('JSON.stringify(cloudHistory)'), history);
    finish({ ok: false, code: 'FEISHU_STORAGE_SAVE_FAILED', sessionRevoked: true });
    await new Promise(setImmediate);
    const root = h.render();
    assert.equal(h.evaluate('savedConnection'), true);
    assert.equal(h.evaluate('config.pluginId'), 'fixture-plugin');
    assert.match(h.evaluate('message'), /已断开.*本机.*未完成/);
    assert.equal(root.querySelector('[data-prepare]'), null);
    assert.ok(byText(root, '使用已保存连接'));
    assert.equal(h.evaluate('JSON.stringify(cloudHistory)'), history);
  }
});

test('disconnect and forget transport uncertainty pause UI without claiming a confirmed revocation or forgotten file', async () => {
  for (const method of ['disconnect', 'forgetConnection']) for (const reply of [undefined, { ok: false }, 'throw']) {
    const h = harness(); h.evaluate('savedConnection=true;safetyConfirmed=true;');
    h.api[method] = async () => { if (reply === 'throw') throw Error('private transport body'); return reply; };
    byText(h.render(), method === 'disconnect' ? '断开连接' : '忘记本机连接').handlers.click();
    await new Promise(setImmediate);
    assert.equal(h.evaluate('connection.connected || safetyConfirmed'), false);
    assert.equal(h.evaluate('savedConnection'), true);
    assert.match(h.evaluate('message'), /结果未核实.*操作已暂停/);
    assert.doesNotMatch(h.evaluate('message'), /已忘记|private transport body/);
  }
});

test('switching runs clears identity, target, confirmation and draft state but keeps the connection', () => {
  const h = harness();
  h.evaluate(`accountNumber='old-account';accountConfirmed=true;safetyConfirmed=true;
    recordId='41';draft={contact:'old'};checkedFields.add('contact');action='delete';
    lookup={};plan={};records=[{recordId:'41'}];`);
  h.ctx.runDir = 'fixture-b';
  const root = h.render();
  assert.equal(h.evaluate('connection.connected'), true);
  assert.equal(h.evaluate('currentRow'), '');
  assert.equal(h.evaluate('accountNumber'), '');
  assert.equal(h.evaluate('recordId'), '');
  assert.equal(h.evaluate('accountConfirmed || safetyConfirmed'), false);
  assert.equal(h.evaluate('Object.keys(draft).length + checkedFields.size + records.length'), 0);
  assert.equal(h.evaluate('lookup || plan'), null);
  assert.equal(h.evaluate('action'), 'create');
  assert.ok(byText(root, '尚未选择本次达人'));
});

test('keyboard mode switching clears pending authority and never calls a transport', () => {
  const h = harness();
  h.evaluate('plan={};checkedFields.add("contact");');
  let prevented = false;
  byText(h.render(), '新建跟进').handlers.keydown({ key: 'End', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.evaluate('action'), 'delete');
  assert.equal(h.evaluate('plan'), null);
  assert.equal(h.evaluate('checkedFields.size'), 0);
  const root = h.render();
  assert.equal(byText(root, '预览精确清理对象').disabled, true);
  assert.deepEqual(h.calls, []);
});

test('record selection immediately renders update fields; unavailable records stay disabled', () => {
  const h = harness();
  h.evaluate(`action='update';records=[
    {recordId:'41',name:'[AI测试] Fixture',status:'verified'},
    {recordId:'42',name:'[AI测试] Pending',status:'unknown'}
  ];`);
  let rerenders = 0;
  h.ctx.rerender = () => rerenders++;
  const root = h.render();
  const pick = walk(root).find(n => n.attributes?.['aria-label'] === '目标记录');
  assert.equal(pick.children[2].disabled, true);
  pick.value = '41'; pick.handlers.change();
  assert.equal(rerenders, 1);
  assert.equal(h.evaluate('recordId'), '41');
  const updated = h.render();
  assert.ok(walk(updated).some(n => n.type === 'checkbox' && n !== pick));
  assert.ok(byText(updated, '修改联系方式'));
  assert.equal(byText(updated, '账号昵称'), undefined);
});

test('an expired session hides write controls and clears stale previews after check-connection', async () => {
  const h = harness();
  h.evaluate("operator={token:'old',name:'Old Fixture',checkedAt:new Date().toISOString()};operatorConfirmed=true;");
  byText(h.render(), '检查连接').handlers.click();
  await new Promise(setImmediate);
  assert.equal(h.evaluate('connection.connected'), false);
  assert.match(h.evaluate('message'), /连接已过期/);
  assert.deepEqual(h.calls, ['status']);
  assert.equal(byText(h.render(), '新建跟进'), undefined);
  assert.equal(h.evaluate('operator'), null);
  assert.equal(h.evaluate('operatorConfirmed'), false);
});

test('cleanup-blocked readbacks are selectable only for readonly checks and explain the manual gate', () => {
  const h = harness();
  h.evaluate("action='delete';recordId='43';safetyConfirmed=true;records=[{recordId:'43',name:'[AI测试] Uncertain',status:'verified',cleanupBlocked:true}];");
  const root = h.render();
  const pick = walk(root).find(n => n.attributes?.['aria-label'] === '目标记录');
  assert.equal(pick.children[1].disabled, false);
  assert.match(pick.children[1].textContent, /需人工核对.*禁止自动修改和清理/);
  assert.equal(byText(root, '预览精确清理对象').disabled, true);
  assert.ok(byText(root, '记录的创建来源或初始状态无法核实，已禁止自动修改和清理；请管理员核对'));
  assert.deepEqual(h.calls, []);
});

test('create requires an explicitly selected maintainer, not an automatic actor identity', async () => {
  const h = harness(); h.evaluate('accountConfirmed=true;safetyConfirmed=true;');
  assert.equal(byText(h.render(), '预览写入字段').disabled, true);
  byText(h.render(), '查找经纪人').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('operator'), null, 'even one match cannot be automatically selected');
  const pick = walk(h.render()).find(n => n.attributes?.['aria-label'] === '匹配人员');
  pick.value = 'fixture-choice'; pick.handlers.change(); await new Promise(setImmediate);
  const root = h.render(); assert.ok(byText(root, '现维护经纪人：Fixture Operator'));
  assert.equal(byText(root, '预览写入字段').disabled, true);
  const checkbox = walk(root).find(n => n.children?.some(c => c.textContent === '将新增跟进的现维护经纪人设为 Fixture Operator')).children[0];
  checkbox.checked = true; checkbox.handlers.change();
  assert.equal(byText(h.render(), '预览写入字段').disabled, false);
  checkbox.checked = false; checkbox.handlers.change();
  assert.equal(byText(h.render(), '预览写入字段').disabled, true);
  assert.deepEqual(h.calls, ['searchMaintainers', 'inspectOperator']);
});

test('editing the connection key removes stale person confirmation and write preview', () => {
  const h = harness(); h.evaluate(`operator={name:'Old Fixture',token:'old',checkedAt:new Date().toISOString()};operatorConfirmed=true;
    accountConfirmed=true;safetyConfirmed=true;plan={name:'Fixture',target:'project/type',fields:[]};`);
  const root = h.render();
  const user = walk(root).find(n => n.attributes?.['aria-label'] === '操作人 User Key');
  user.value = 'another-fixture'; user.handlers.input();
  assert.equal(h.evaluate('operator'), null); assert.equal(h.evaluate('operatorConfirmed'), false);
  assert.equal(h.evaluate('plan'), null); assert.equal(h.evaluate('configDirty'), true);
  assert.equal(root.querySelector('.feishu-write-preview'), null);
  assert.equal(byText(h.render(), '查找经纪人').disabled, true);
  assert.equal(byText(h.render(), '预览写入字段').disabled, true);
});

test('refreshing or failing person lookup cannot preserve an old confirmation', async () => {
  const h = harness(); h.evaluate("operator={name:'Old Fixture',token:'old',checkedAt:new Date().toISOString()};operatorConfirmed=true;plan={};");
  h.api.searchMaintainers = async () => ({ ok: false, code: 'FEISHU_OPERATOR_INVALID' });
  // Render without the deliberately stale preview object.
  h.evaluate('plan=null;');
  byText(h.render(), '查找经纪人').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('operator'), null); assert.equal(h.evaluate('operatorConfirmed'), false);
  assert.match(h.evaluate('message'), /未匹配/);
  assert.equal(byText(h.render(), '预览写入字段').disabled, true);
});

test('maintainer preview displays the server-reviewed name, not the editable key', () => {
  const h = harness(); h.evaluate(`config.userKey='another-fixture';
    plan={name:'Fixture',target:'project/type',fields:[],maintainer:{name:'Reviewed Fixture',roleName:'现维护经纪人'}};`);
  assert.ok(byText(h.render(), '现维护经纪人：Reviewed Fixture'));
});

test('person failures display only safe stage, HTTP and API diagnostics and keep lookup connected', async () => {
  for (const [status, apiCode] of [[403, 10001], [401, 10301]]) {
    const h = harness();
    h.api.searchMaintainers = async () => ({ ok: false, code: 'FEISHU_HTTP_ERROR', status,
      stage: 'maintainer_roles', apiCode, message: 'private response credential' });
    byText(h.render(), '查找经纪人').handlers.click(); await new Promise(setImmediate);
    const message = h.evaluate('message');
    assert.match(message, new RegExp(`经纪人角色查询.*HTTP ${status}.*API ${apiCode}`));
    assert.doesNotMatch(message, /private|credential/);
    assert.equal(h.evaluate('connection.connected'), true);
    assert.equal(h.evaluate('operator'), null);
  }
});

test('untrusted diagnostic stage and status strings cannot reach rendered errors', () => {
  const h = harness();
  const message = h.evaluate("failure({code:'FEISHU_HTTP_ERROR',stage:'private-credential',status:'private-credential',apiCode:'private-credential'})");
  assert.doesNotMatch(message, /private|credential/);
  assert.match(h.evaluate("failure({code:'FEISHU_HTTP_ERROR',status:404,stage:'maintainer_search'})"), /经纪人姓名查询.*HTTP 404/);
  assert.match(h.evaluate("failure({code:'FEISHU_OPERATION_FAILED',status:'unknown'})"), /结果未知，禁止自动重试/);
});

test('editing the manually entered name immediately removes selection and pending write UI', () => {
  const h = harness();
  h.evaluate(`operator={name:'Old Fixture',token:'old',checkedAt:new Date().toISOString()};operatorConfirmed=true;
    accountConfirmed=true;safetyConfirmed=true;maintainerCandidates=[{token:'old',label:'Old Fixture'}];
    maintainerChoice='old';plan={name:'Fixture',target:'project/type',fields:[]};`);
  const root = h.render();
  const name = walk(root).find(n => n.attributes?.['aria-label'] === '经纪人姓名');
  name.value = 'Another Fixture'; name.handlers.input();
  assert.equal(h.evaluate('operator'), null);
  assert.equal(h.evaluate('operatorConfirmed'), false);
  assert.equal(h.evaluate('maintainerCandidates.length'), 0);
  assert.equal(h.evaluate('maintainerChoice'), '');
  assert.equal(h.evaluate('plan'), null);
  assert.equal(root.querySelector('.feishu-write-preview'), null);
  assert.equal(root.querySelector('[data-people]'), null);
  assert.equal(byText(root, '预览写入字段').disabled, true);
  assert.deepEqual(h.calls, []);
});

function cloudHarness() {
  const h = harness();
  h.ctx.rows = [
    { rowId: 'a', creatorName: 'Fixture A', xhsId: '001234', wechatId: 'fixture_a', imagePrice: '¥4,800', videoPrice: '￥9,800', selected: true },
    { rowId: 'b', creatorName: 'Fixture B', xhsId: '005678', email: 'fixture@example.test', imagePrice: 0, selected: true }
  ];
  h.evaluate(`cloud=null;currentRow='';connection={connected:true,target:'project/creator',fields:[
    {key:'name',name:'账号昵称',type:'text',options:[]},{key:'account',name:'小红书ID',type:'text',options:[]},
    {key:'contact',name:'联系方式',type:'text',options:[]},{key:'platform',name:'平台',type:'select',options:[{label:'小红书',value:'xhs'}]},
    {key:'source',name:'达人资源来源',type:'select',options:[{label:'主动搜索',value:'search'}]},
    {key:'image',name:'图文平台价',type:'number',options:[]},{key:'video',name:'视频平台价',type:'number',options:[]}
  ]};operator={token:'fixture-operator',name:'Fixture Operator',checkedAt:new Date().toISOString()};operatorConfirmed=true;safetyConfirmed=true;`);
  h.api.prepare = async p => {
    h.calls.push(['prepare', p.rowId, JSON.parse(JSON.stringify(p.values))]);
    return { ok: true, token: `plan-${p.rowId}`, action: 'create', name: `[AI测试] ${p.rowId}`,
      batch: `batch-${p.rowId}`, target: 'project/creator', expiresAt: Date.now() + 300000,
      fields: Object.entries(p.values).map(([field_key, field_value]) => ({ field_key, field_value })) };
  };
  h.api.execute = async p => { h.calls.push(['execute', p.token]); return { ok: true, action: 'create', status: 'verified', recordId: p.token }; };
  h.render();
  h.preview = async () => {
    h.evaluate('cloud.confirmed=true;'); byText(h.render(), '查重并预览选中行').handlers.click(); await new Promise(setImmediate);
  };
  h.submit = async count => { byText(h.render(), `确认新建到飞书（${count}）`).handlers.click(); await new Promise(setImmediate); };
  return h;
}
test('production batch explicitly requests production and leaves contacts and generated time to the backend', async () => {
  const h = cloudHarness();
  h.ctx.rows = h.ctx.rows.map(row => ({ ...row, wechatId: '', email: '' }));
  h.evaluate("recordMode='production';cloud=null;connection.fields.push({key:'contact_time',name:'建联时间',type:'date',generated:'contact_time',options:[]});");
  h.render();
  let prepared = 0, confirmation = '';
  h.api.prepare = async p => {
    assert.equal(p.recordMode, 'production'); assert.equal(p.values.contact, '');
    assert.equal(Object.hasOwn(p.values, 'contact_time'), false); prepared++;
    return { ok: true, token: `plan-${p.rowId}`, recordMode: 'production', action: 'create', name: p.values.name,
      target: 'project/creator', batch: `SYNC_${p.rowId}`, expiresAt: Date.now() + 300000,
      fields: Object.entries(p.values).map(([field_key, field_value]) => ({ field_key, field_value })) };
  };
  h.evaluate('confirm = message => { productionConfirmation=message; return true; };');
  await h.preview();
  assert.equal(prepared, 2);
  await h.submit(2);
  confirmation = h.evaluate('productionConfirmation');
  assert.match(confirmation, /正式记录/);
  assert.doesNotMatch(confirmation, /AI测试|AI_TEST|SYNC_/);
  assert.equal(h.calls.filter(c => c[0] === 'execute').length, 2);
});

test('production enrichment: selected rows preview exact deltas, submit once and unchanged rows are skipped', async () => {
  const h=cloudHarness();h.evaluate("recordMode='production';");
  const mode=byLabel(h.render(),'飞书批量操作');mode.value='enrich';mode.handlers.change();h.render();
  let prepared=0,confirmation='';
  h.api.prepare=async p=>{
    assert.equal(p.action,'enrich');prepared++;
    if(p.rowId==='b')return {ok:true,noChanges:true,recordId:'42',fields:[]};
    return {ok:true,token:'enrich-a',entryId:'enrich-op-a',action:'enrich',recordId:'41',name:'Existing Fixture',target:'project/creator',
      expiresAt:Date.now()+300000,fields:[{field_key:'contact',before:'old fixture',field_value:'new fixture'}]};
  };
  h.api.execute=async p=>{h.calls.push(['execute',p.token]);return {ok:true,entryId:'enrich-op-a',recordId:'41',status:'verified'};};
  h.evaluate("confirm=message=>{enrichmentConfirmation=message;return true;};");
  await h.preview();assert.equal(prepared,2);
  const root=h.render();
  assert.equal(h.evaluate("cloud.items[1].status"),'unchanged');
  assert.equal(byText(root,'已是最新 · 无需写入').textContent,'已是最新 · 无需写入');
  byText(root,'确认补录到飞书（1）').handlers.click();await new Promise(setImmediate);
  assert.equal(h.calls.filter(c=>c[0]==='execute').length,1);
  confirmation=h.evaluate('enrichmentConfirmation');
  assert.match(confirmation,/工作项 41/);assert.match(confirmation,/old fixture → new fixture/);
  assert.doesNotMatch(confirmation,/新建以下/);
});

test('production enrichment: switching action cannot revive old preview and successful rows receive new enrichment', async () => {
  const h=cloudHarness();h.evaluate("recordMode='production';");await h.preview();
  const stale=byText(h.render(),'确认新建到飞书（2）');
  const mode=byLabel(h.render(),'飞书批量操作');mode.value='enrich';mode.handlers.change();h.render();
  h.evaluate('cloud.confirmed=true;');stale.handlers.click();await new Promise(setImmediate);
  assert.equal(h.calls.some(c=>c[0]==='execute'),false);
  h.evaluate("cloud.items[0].status='verified';cloud.items[0].submission={name:'old immutable evidence'};");
  h.ctx.rows[0].email='later@example.invalid';h.render();
  assert.match(h.evaluate('cloud.items[0].contact'),/later@example.invalid/);
  assert.equal(h.evaluate('cloud.items[0].submission.name'),'old immutable evidence');
});

test('production enrichment: lost execute response keeps operation identity and resolves without resending', async () => {
  const h=cloudHarness();h.evaluate("recordMode='production';cloudAction='enrich';cloud=null;");h.render();
  h.api.prepare=async p=>({ok:true,token:`plan-${p.rowId}`,entryId:`operation-${p.rowId}`,recordId:p.rowId==='a'?'41':'42',
    action:'enrich',name:p.values.name,target:'project/creator',expiresAt:Date.now()+300000,
    fields:[{field_key:'contact',before:'old',field_value:p.values.contact}]});
  h.api.execute=async()=>{h.calls.push(['execute']);throw Error('fixture lost IPC response');};
  await h.preview();byText(h.render(),'确认补录到飞书（2）').handlers.click();await new Promise(setImmediate);
  assert.equal(h.evaluate('cloud.items[0].status'),'unknown');
  assert.equal(h.evaluate('cloud.items[0].result.entryId'),'operation-a');
  assert.equal(h.evaluate('cloud.items[0].result.recordId'),'41');
  h.api.reconcile=async p=>{assert.equal(p.entryId,'operation-a');return {ok:true,entryId:p.entryId,recordId:'41',status:'verified'};};
  byText(h.render(),'核对该行结果').handlers.click();await new Promise(setImmediate);
  assert.equal(h.evaluate('cloud.items[0].status'),'verified');
  assert.equal(h.calls.filter(c=>c[0]==='execute').length,1);
});

test('creation mode change and change-back cannot revive a stale batch submission', async () => {
  const h = cloudHarness(); await h.preview();
  const stale = byText(h.render(), '确认新建到飞书（2）');
  for (const value of ['production', 'test']) {
    const mode = byLabel(h.render(), '建档模式'); mode.value = value; mode.handlers.change();
  }
  h.evaluate('safetyConfirmed=true;cloud.confirmed=true;');
  stale.handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.some(c => c[0] === 'execute'), false);
  assert.equal(h.evaluate('cloud.items.every(i=>i.plan===null)'), true);
});

test('cloud readonly preview needs no write approval and submit still requires fresh approval', async () => {
  const h = cloudHarness(); h.evaluate('safetyConfirmed=false;');
  const prepare = h.api.prepare;
  h.api.prepare = p => {
    assert.equal(p.deferWriteConfirmation, true);
    assert.equal(p.safetyConfirmed, undefined);
    return prepare(p);
  };
  await h.preview();
  assert.equal(h.evaluate('cloud.phase'), 'preview');
  const stale = byText(h.render(), '确认新建到飞书（2）');
  assert.equal(stale.disabled, true);
  stale.handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.some(c => c[0] === 'execute'), false);
  const approval = byText(h.render(), '已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程').parent.children[0];
  approval.checked = true; approval.handlers.change();
  assert.equal(h.evaluate('cloud.items.every(i=>i.plan!==null)'), true);
  h.api.execute = async p => {
    assert.equal(p.safetyConfirmed, true);
    h.calls.push(['execute', p.token]);
    return { ok: true, status: 'verified', recordId: p.token };
  };
  await h.submit(2);
  assert.equal(h.calls.filter(c => c[0] === 'execute').length, 2);
});

test('revoked write approval invalidates plans and stale submit while readonly preview remains available', async () => {
  const h = cloudHarness(); await h.preview();
  const stale = byText(h.render(), '确认新建到飞书（2）');
  const approval = byText(h.render(), '已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程').parent.children[0];
  approval.checked = false; approval.handlers.change();
  stale.handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.some(c => c[0] === 'execute'), false);
  assert.equal(h.evaluate('cloud.items.every(i=>i.plan===null)'), true);
  h.evaluate('cloud.confirmed=true;');
  assert.equal(byText(h.render(), '查重并预览选中行').disabled, false);
});

test('cloud preview captures only selected rows and quotes, preserves IDs/zero, and never writes automatically', async () => {
  const h = cloudHarness(); await h.preview();
  assert.deepEqual(h.calls.map(c => c.slice(0, 2)), [['prepare', 'a'], ['prepare', 'b']]);
  assert.equal(h.calls[0][2].account, '001234'); assert.equal(h.calls[0][2].image, '¥4,800');
  assert.equal(h.calls[1][2].image, '0'); assert.equal(h.calls[0][2].source, 'search');
  assert.equal(h.evaluate('cloud.phase'), 'preview');
  assert.equal(byText(h.render(), '确认新建到飞书（2）').disabled, false);
});
test('one cloud confirmation executes only eligible previews, records each readback and skips remote duplicates', async () => {
  const h = cloudHarness(); const prepare = h.api.prepare;
  h.api.prepare = p => p.rowId === 'b' ? { ok: false, code: 'FEISHU_DUPLICATE_MAINTAINER' } : prepare(p);
  await h.preview(); await h.submit(1);
  assert.deepEqual(h.calls.filter(c => c[0] === 'execute'), [['execute', 'plan-a']]);
  assert.equal(h.evaluate('cloud.items[0].status'), 'verified');
  assert.equal(h.evaluate('cloud.items[1].status'), 'duplicate');
  assert.equal(h.evaluate('cloud.phase'), 'done');
});
test('cloud confirmation cancellation, changed scope and expired previews cannot dispatch writes', async () => {
  const canceled = cloudHarness(); await canceled.preview(); canceled.evaluate('confirm=()=>false;'); await canceled.submit(2);
  assert.equal(canceled.calls.some(c => c[0] === 'execute'), false);
  const edited = cloudHarness(); await edited.preview(); const stale = byText(edited.render(), '确认新建到飞书（2）');
  const account = byLabel(edited.render(), '建档小红书号 · Fixture A'); account.value = '001235'; account.handlers.input();
  edited.evaluate('cloud.confirmed=true;'); stale.handlers.click(); await new Promise(setImmediate);
  assert.equal(edited.calls.some(c => c[0] === 'execute'), false);
  const expired = cloudHarness(); await expired.preview(); const staleExpiry = byText(expired.render(), '确认新建到飞书（2）');
  expired.evaluate('cloud.items[0].plan.expiresAt=1;'); staleExpiry.handlers.click(); await new Promise(setImmediate);
  assert.equal(expired.calls.some(c => c[0] === 'execute'), false);
  assert.ok(byText(expired.render(), '预览已过期，请重新查重并预览；未继续写入'));
});
test('cloud unknown dispatch halts at the current row, cannot be re-prepared, and has read-only reconciliation', async () => {
  const h = cloudHarness(); await h.preview();
  h.api.execute = async p => { h.calls.push(['execute', p.token]); return { ok: false, status: 'unknown', code: 'FEISHU_READBACK_MISMATCH', recordId: '41' }; };
  await h.submit(2);
  assert.equal(h.evaluate('cloud.phase'), 'stopped'); assert.equal(h.evaluate('cloud.items[0].status'), 'unknown');
  assert.equal(h.calls.filter(c => c[0] === 'execute').length, 1);
  const before = h.calls.length; await h.preview();
  assert.equal(h.calls.slice(before).some(c => c[0] === 'prepare' && c[1] === 'a'), false);
  h.api.listRecords = async () => ({ ok: true, records: [{ entryId: 'owned', name: '[AI测试] a', batch: 'batch-a' }] });
  h.api.reconcile = async p => { h.calls.push(['reconcile', p.entryId]); return { ok: true, status: 'verified', recordId: '41' }; };
  byText(h.render(), '核对该行结果').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('cloud.items[0].status'), 'verified');
  assert.deepEqual(h.calls.at(-1), ['reconcile', 'owned']);
});
test('cloud stop requested waits for bounded dispatch/readback, then prevents next row', async () => {
  const h = cloudHarness(); await h.preview(); let resolve;
  h.api.execute = p => { h.calls.push(['execute', p.token]); return new Promise(r => { resolve = r; }); };
  byText(h.render(), '确认新建到飞书（2）').handlers.click(); await new Promise(setImmediate);
  byText(h.render(), '停止批量建档').handlers.click();
  assert.equal(h.evaluate('cloud.phase'), 'creating'); assert.equal(h.evaluate('cloud.stopRequested'), true);
  resolve({ ok: true, status: 'verified', recordId: '41' }); await new Promise(setImmediate);
  assert.equal(h.evaluate('cloud.phase'), 'stopped'); assert.equal(h.evaluate('cloud.progress'), 1);
  assert.equal(h.calls.filter(c => c[0] === 'execute').length, 1);
});

test('an earlier unknown submission is not labelled a duplicate and can be reconciled without another write', async () => {
  const h = cloudHarness();
  h.api.prepare = async p => { h.calls.push(['prepare', p.rowId]); return {
    ok: false, code: 'FEISHU_ALREADY_SUBMITTED', status: 'unknown', entryId: 'prior-owned-entry', recordId: '41'
  }; };
  await h.preview();
  assert.equal(h.evaluate('cloud.items[0].status'), 'unknown');
  assert.equal(h.evaluate('cloud.phase'), 'stopped');
  assert.equal(h.calls.length, 1, 'unknown outcome prevents preparing the next row');
  h.api.reconcile = async p => { h.calls.push(['reconcile', p.entryId]); return { ok: true, status: 'verified', recordId: '41' }; };
  byText(h.render(), '核对该行结果').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('cloud.items[0].status'), 'verified');
  assert.deepEqual(h.calls.at(-1), ['reconcile', 'prior-owned-entry']);
  assert.equal(h.calls.some(c => c[0] === 'execute'), false);
});
test('cloud run changes preserve returned result in old batch without attributing it to new run', async () => {
  const h = cloudHarness(); await h.preview(); let resolve;
  h.api.execute = p => new Promise(r => { resolve = r; }); h.evaluate('oldCloud=cloud;');
  byText(h.render(), '确认新建到飞书（2）').handlers.click(); await new Promise(setImmediate);
  h.ctx.runDir = 'another'; h.render();
  resolve({ ok: true, status: 'verified', recordId: '41' }); await new Promise(setImmediate);
  assert.equal(h.evaluate('oldCloud.items[0].status'), 'verified');
  assert.equal(h.evaluate('cloud.items[0].status'), 'idle');
});
test('missing quote mapping, fifty-row ceiling and thrown dispatch never silently create or retry', async () => {
  const missing = cloudHarness(); missing.evaluate("connection.fields=connection.fields.filter(f=>f.key!=='image');"); await missing.preview();
  assert.equal(missing.calls.some(c => c[0] === 'prepare' && c[1] === 'a'), false);
  assert.equal(missing.evaluate('cloud.items[0].error.code'), 'FEISHU_QUOTE_SCHEMA_UNSUPPORTED');
  const many = cloudHarness(); many.ctx.rows = Array.from({ length: 51 }, (_, i) => ({ rowId: `r${i}`, selected: true }));
  many.evaluate('cloud=null;'); many.render(); many.evaluate('cloud.confirmed=true;');
  assert.equal(byText(many.render(), '查重并预览选中行').disabled, true);
  const thrown = cloudHarness(); await thrown.preview(); thrown.api.execute = async () => { throw new Error('private transport'); };
  await thrown.submit(2); assert.equal(thrown.evaluate('cloud.items[0].status'), 'unknown');
  assert.equal(thrown.evaluate('cloud.phase'), 'stopped');
});

test('editing an account or unchecking identity blocks a stale single-contact apply handler', async () => {
  for (const edit of [true, false]) {
    const h = harness();
    h.evaluate(`accountNumber='001234';accountConfirmed=true;lookup={token:'old-lookup',preview:{candidates:[
      {recordId:'5',kind:'phone',value:'12345678'}]}};`);
    h.api.applyContact = async p => { h.calls.push(['apply', p.token]); return { ok: true, patch: { phone: '12345678' } }; };
    const root = h.render(), stale = byText(root, '确认回填本地');
    const kind = byLabel(root, '联系方式类型'); kind.options = kind.children; kind.selectedIndex = 2;
    if (edit) { const account = byLabel(root, '主页显示的小红书号'); account.value = '005678'; account.handlers.input(); }
    else h.evaluate('accountConfirmed=false;');
    stale.handlers.click(); await new Promise(setImmediate);
    assert.equal(h.calls.length, 0);
  }
});

test('refreshing or removing an in-flight cloud row keeps its result bound to the immutable submitted identity', async () => {
  for (const removed of [false, true]) {
    const h = cloudHarness(); await h.preview(); let resolve;
    h.api.execute = () => new Promise(r => { resolve = r; });
    byText(h.render(), '确认新建到飞书（2）').handlers.click(); await new Promise(setImmediate);
    if (removed) h.ctx.rows.shift();
    else h.ctx.rows[0] = { ...h.ctx.rows[0], creatorName: 'Replacement', xhsId: 'NEW999' };
    h.render(); resolve({ ok: false, status: 'unknown', code: 'FEISHU_READBACK_MISMATCH', recordId: '41' });
    await new Promise(setImmediate);
    assert.equal(h.evaluate('cloudHistory[0].account'), '001234');
    assert.equal(h.evaluate('cloudHistory[0].creatorName'), 'Fixture A');
    assert.equal(h.evaluate('cloudHistory[0].status'), 'unknown');
    assert.equal(h.evaluate('cloud.items[0].status'), 'idle');
    assert.ok(byText(h.render(), '核对提交结果'));
  }
});

test('restored connection exposes journal unknowns independently from current rows and maintainer', async () => {
  const h = harness();
  h.api.restoreConnection = async () => ({ ok: true, connected: true, saved: true, target: 'project/creator', fields: [] });
  h.api.listRecords = async () => ({ ok: true, records: [{ entryId: 'prior', recordId: '41', name: '[AI测试] Previous',
    target: 'project/creator', status: 'unknown', maintainerName: 'Previous Operator', accountNumber: 'OLD001' }] });
  h.api.reconcile = async p => { h.calls.push(['reconcile', p.entryId]); return { ok: true, status: 'verified', recordId: '41' }; };
  h.evaluate('initialRestoreStarted=false;cloudHistory=[];'); h.render(); await new Promise(setImmediate);
  const root = h.render();
  assert.ok(byText(root, '记录归属：Previous Operator · 小红书号 OLD001'));
  byText(root, '核对提交结果').handlers.click(); await new Promise(setImmediate);
  assert.deepEqual(h.calls, [['reconcile', 'prior']]);
});

test('natural cloud preview expiry disables a fresh button and reports a stale click without dispatch', async () => {
  const h = cloudHarness(); await h.preview();
  const stale = byText(h.render(), '确认新建到飞书（2）');
  h.evaluate('cloud.items[0].plan.expiresAt=1;'); stale.handlers.click(); await new Promise(setImmediate);
  assert.match(h.evaluate('message'), /预览已过期/);
  assert.equal(byText(h.render(), '确认新建到飞书（0）').disabled, true);
  assert.equal(h.calls.some(c => c[0] === 'execute'), false);
});

test('person changes do not relabel an older unknown submission or its verified readback', async () => {
  const h = cloudHarness(); await h.preview();
  h.api.execute = async () => ({ ok: false, status: 'unknown', entryId: 'prior-owned', recordId: '41', code: 'FEISHU_READBACK_MISMATCH' });
  await h.submit(2);
  h.evaluate("resetMaintainer();operator={name:'Another Operator',token:'another',checkedAt:new Date().toISOString()};operatorConfirmed=true;");
  h.api.reconcile = async () => ({ ok: true, status: 'verified', recordId: '41' });
  byText(h.render(), '核对该行结果').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('cloudHistory[0].maintainerName'), 'Fixture Operator');
  assert.equal(h.evaluate('cloudHistory[0].status'), 'verified');
  assert.ok(byText(h.render(), '记录归属：Fixture Operator'));
  assert.ok(byText(h.render(), '记录归属：Fixture Operator · 小红书号 001234'));
  assert.equal(byText(h.render(), '提交结果未知 · 禁止重发'), undefined);
});

test('rechecking identity or a failed requery save cannot revive an earlier contact approval', async () => {
  for (const failedSave of [false, true]) {
    const h = harness();
    h.evaluate(`accountNumber='001234';accountConfirmed=true;lookup={token:'prior-query',preview:{candidates:[
      {recordId:'5',kind:'phone',value:'12345678'}]}};`);
    h.api.applyContact = async p => { h.calls.push(['apply', p.token]); return { ok: true, patch: {} }; };
    const root = h.render(), stale = byText(root, '确认回填本地');
    const kind = byLabel(root, '联系方式类型'); kind.options = kind.children; kind.selectedIndex = 2;
    if (failedSave) {
      h.ctx.save = async () => ({ ok: false }); byText(root, '查询团队库').handlers.click(); await new Promise(setImmediate);
    } else {
      const label = walk(root).find(n => n.children?.some(c => c.textContent === '已核对该小红书号属于当前达人'));
      label.children[0].checked = false; label.children[0].handlers.change();
      label.children[0].checked = true; label.children[0].handlers.change();
    }
    stale.handlers.click(); await new Promise(setImmediate);
    assert.equal(h.calls.length, 0);
    assert.equal(h.evaluate('lookup'), null);
  }
});

test('an ID-less unknown submission merges with its journal identity and reconciliation clears every representation', async () => {
  const h = cloudHarness(); await h.preview();
  h.api.execute = async () => { throw Error('unknown IPC outcome'); }; await h.submit(2);
  h.evaluate("records=[{entryId:'owned',status:'unknown',name:'[AI测试] a',batch:'batch-a',target:'project/creator'}];");
  h.render();
  assert.equal(h.evaluate('cloudHistory.length'), 1);
  assert.equal(h.evaluate('cloudHistory[0].result.entryId'), 'owned');
  h.api.reconcile = async () => ({ ok: true, status: 'verified', recordId: '41' });
  byText(h.render(), '核对提交结果').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('cloudHistory.some(h=>h.status===\'unknown\')'), false);
  assert.equal(h.evaluate('cloud.items[0].status'), 'verified');
});

test('maintainer deadline uses checkedAt, expires visibly and preserves drafts and history without requests', () => {
  const h = cloudHarness(), clock = h.clock();
  h.evaluate(`operator.checkedAt=new Date(Date.now()-240000).toISOString();
    draft={contact:'keep-contact'};maintainerName='Keep Name';cloud.items[0].contact='keep-row';
    cloudHistory=[{target:'project/creator',creatorName:'Old',maintainerName:'Old Owner',status:'unknown'}];`);
  let renders = 0; h.ctx.rerender = () => renders++;
  assert.ok(walk(h.render()).some(n => /归属确认预计有效至/.test(n.textContent || '')));
  const deadline = h.evaluate('operatorDeadline()');
  assert.equal(deadline, h.evaluate('Date.parse(operator.checkedAt)+300000'));
  clock.advance(60001);
  assert.ok(renders > 0); assert.equal(h.evaluate('operatorConfirmed'), false);
  const root = h.render();
  assert.ok(walk(root).some(n => /归属确认已过期/.test(n.textContent || '')));
  assert.equal(byText(root, '查重并预览选中行').disabled, true);
  assert.equal(h.evaluate('draft.contact'), 'keep-contact');
  assert.equal(h.evaluate('cloud.items[0].contact'), 'keep-row');
  assert.equal(h.evaluate('maintainerName'), 'Keep Name');
  assert.equal(h.evaluate('cloudHistory[0].maintainerName'), 'Old Owner');
  assert.deepEqual(h.calls, []);
});

test('stale cloud and single-create controls cannot dispatch after maintainer expiry, including a delayed save', async () => {
  const h = cloudHarness(), clock = h.clock(); await h.preview();
  const stale = byText(h.render(), '确认新建到飞书（2）');
  clock.advance(300001); stale.handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.some(c => c[0] === 'execute'), false);
  const single = harness(), singleClock = single.clock();
  single.evaluate(`operator={name:'Fixture Operator',token:'single',checkedAt:new Date(Date.now()).toISOString()};
    operatorConfirmed=true;accountConfirmed=true;safetyConfirmed=true;`);
  let finishSave; single.ctx.save = () => new Promise(resolve => { finishSave = resolve; });
  single.api.prepare = async () => { single.calls.push('prepare'); return {ok:true}; };
  byText(single.render(), '预览写入字段').handlers.click();
  singleClock.advance(300001); finishSave({ok:true}); await new Promise(setImmediate);
  assert.equal(single.calls.includes('prepare'), false);
  assert.equal(single.evaluate('operatorConfirmed'), false);
});

test('backend maintainer rejection halts preview or creation and revokes UI authority without losing edits', async () => {
  for (const execute of [false, true]) {
    const h = cloudHarness(); h.evaluate("cloud.items[0].contact='keep';draft={contact:'keep'};");
    if (execute) await h.preview();
    h.calls.length = 0;
    const rejected = async p => { h.calls.push([execute ? 'execute' : 'prepare', execute ? p.token : p.rowId]);
      return {ok:false,code:'FEISHU_OPERATOR_CONFIRMATION_REQUIRED'}; };
    if (execute) { h.api.execute = rejected; await h.submit(2); }
    else { h.api.prepare = rejected; await h.preview(); }
    assert.deepEqual(h.calls, [[execute ? 'execute' : 'prepare', execute ? 'plan-a' : 'a']]);
    assert.equal(h.evaluate('cloud.phase'), 'stopped');
    assert.equal(h.evaluate('operatorConfirmed'), false);
    assert.equal(h.evaluate('cloud.items[0].contact'), 'keep');
    assert.equal(h.evaluate('draft.contact'), 'keep');
    assert.equal(byText(h.render(), '查重并预览选中行').disabled, true);
  }
});

test('expiry during dispatched creation preserves original outcome and stops before the next row', async () => {
  const h = cloudHarness(), clock = h.clock(); await h.preview(); let resolve;
  h.api.execute = p => { h.calls.push(['execute',p.token]); return new Promise(r => {resolve=r;}); };
  byText(h.render(), '确认新建到飞书（2）').handlers.click(); await new Promise(setImmediate);
  clock.advance(300001);
  assert.equal(h.evaluate('cloud.phase'), 'creating');
  assert.equal(h.evaluate('cloud.stopRequested'), true);
  resolve({ok:false,status:'unknown',recordId:'41',code:'FEISHU_READBACK_MISMATCH'}); await new Promise(setImmediate);
  assert.equal(h.evaluate('cloud.phase'), 'stopped');
  assert.equal(h.calls.filter(c => c[0] === 'execute').length, 1);
  assert.equal(h.evaluate('cloudHistory[0].status'), 'unknown');
  assert.equal(h.evaluate('cloudHistory[0].maintainerName'), 'Fixture Operator');
  assert.equal(h.evaluate('cloudHistory[0].account'), '001234');
  assert.equal(h.evaluate('operatorConfirmed'), false);
});

async function startMaintainerInspection(h, inspect) {
  byText(h.render(), '查找经纪人').handlers.click(); await new Promise(setImmediate);
  h.api.inspectOperator = inspect;
  const pick = byLabel(h.render(), '匹配人员');
  pick.value = 'fixture-choice'; pick.handlers.change(); await new Promise(setImmediate);
}
const inspectionReply = (checkedAt, remainingLeaseMs = 300000) => ({ ok: true, token: 'fixture-token',
  name: 'Fixture Operator', roleName: '现维护经纪人', checkedAt, remainingLeaseMs });

function stableChoiceFixture(h) {
  h.evaluate(`selectedMaintainer=Object.freeze({token:'saved-choice',name:'Fixture Operator',target:connection.target});`);
  h.api.refreshOperator = async p => {
    h.calls.push(['refresh', p.choiceToken]);
    return { ...inspectionReply(new Date(h.evaluate('Date.now()')).toISOString()), token: 'fresh-operator',
      choice: { token: 'saved-choice', name: 'Fixture Operator', target: 'project/creator' } };
  };
}

test('stable choice: operation expiry preserves selected person and confirmation, never refreshes or writes automatically', async () => {
  const h = cloudHarness(), clock = h.clock(); stableChoiceFixture(h); await h.preview();
  const stale = byText(h.render(), '确认新建到飞书（2）');
  const calls = h.calls.length;
  clock.advance(300001); h.render();
  assert.equal(h.evaluate('selectedMaintainer.name'), 'Fixture Operator');
  assert.equal(h.evaluate('operatorConfirmed'), true);
  assert.equal(h.evaluate('operatorReady()'), false);
  assert.equal(h.calls.length, calls);
  stale.handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.length, calls);
  await h.preview();
  assert.equal(h.evaluate('cloud.phase'), 'preview');
  assert.equal(h.evaluate('cloud.items.every(i=>i.status===\'ready\')'), true);
  assert.equal(h.calls.filter(c => c[0] === 'refresh').length, 2);
  assert.equal(h.calls.some(c => c[0] === 'execute'), false);
});

test('stable choice: editing name clears old deadline and confirmation text immediately in the current DOM', async () => {
  const h = cloudHarness(); stableChoiceFixture(h); await h.preview();
  const root = h.render(), input = byLabel(root, '经纪人姓名');
  input.value = 'Changed Fixture'; input.handlers.input();
  assert.equal(h.evaluate('selectedMaintainer'), null);
  assert.equal(h.evaluate('operatorConfirmed'), false);
  const person = root.querySelector('[data-operator]');
  assert.doesNotMatch(walk(person).map(n => n.textContent || '').join('\n'), /有效至|人员已核验|归属已确认/);
  assert.match(walk(root).map(n => n.textContent || '').join('\n'), /姓名已更改.*旧确认已撤销/);
});

test('stable choice: new task keeps exact choice but discards previews and no inspection is automatic', async () => {
  const h = cloudHarness(); stableChoiceFixture(h); await h.preview();
  const calls = h.calls.length; h.ctx.runDir = 'other-fixture'; h.render();
  assert.equal(h.evaluate('selectedMaintainer.token'), 'saved-choice');
  assert.equal(h.evaluate('operator'), null); assert.equal(h.evaluate('plan'), null);
  assert.equal(h.calls.length, calls);
});

test('stable choice: failed, changed or malformed readonly revalidation never prepares or silently switches people', async () => {
  for (const reply of [{ ok: false, code: 'FEISHU_OPERATOR_CHANGED' },
    { ...inspectionReply(new Date().toISOString()), choice: { token: 'other', name: 'Fixture Operator', target: 'project/creator' } },
    { ...inspectionReply(new Date().toISOString()), choice: { token: 'saved-choice', name: 'Different', target: 'project/creator' }, name: 'Different' }]) {
    const h = cloudHarness(); stableChoiceFixture(h);
    h.api.refreshOperator = async () => reply;
    await h.preview();
    assert.equal(h.calls.some(c => c[0] === 'prepare' || c[0] === 'execute'), false);
    assert.equal(h.evaluate('selectedMaintainer'), null);
    assert.equal(h.evaluate('operatorConfirmed'), false);
  }
});

test('stable choice: delayed revalidation cannot survive selection, target, task or confirmation ABA', async () => {
  for (const edit of ["resetMaintainer();", "connection.target='different';", "currentRun='other';epoch++;",
    "maintainerRevision++;operatorConfirmed=false;maintainerRevision++;operatorConfirmed=true;"]) {
    const h = cloudHarness(); stableChoiceFixture(h); let finish;
    h.api.refreshOperator = () => new Promise(resolve => { finish = resolve; });
    const pending = h.preview(); await new Promise(setImmediate);
    h.evaluate(edit);
    finish({ ...inspectionReply(new Date().toISOString()), choice: { token: 'saved-choice', name: 'Fixture Operator', target: 'project/creator' } });
    await pending; await new Promise(setImmediate);
    assert.equal(h.calls.some(c => c[0] === 'prepare' || c[0] === 'execute'), false);
  }
});

test('stable choice: normal restart restores preference without inspection, confirmation or mutation authority', async () => {
  const h = harness();
  h.api.restoreConnection = async () => ({ ok: true, connected: true, saved: true, target: 'project/creator', fields: [], fieldCount: 2,
    maintainer: { token: 'restored-choice', name: 'Fixture Operator', target: 'project/creator' } });
  h.evaluate('initialRestoreStarted=false;'); h.render(); await new Promise(setImmediate);
  assert.equal(h.evaluate('selectedMaintainer.token'), 'restored-choice');
  assert.equal(h.evaluate('maintainerName'), 'Fixture Operator');
  assert.equal(h.evaluate('operator'), null); assert.equal(h.evaluate('operatorConfirmed'), false);
  assert.deepEqual(h.calls, []);
});

test('stable choice: a new authority refresh revokes single and other bulk cached previews together', async () => {
  const h = cloudHarness(); stableChoiceFixture(h); await h.preview();
  h.evaluate("plan={action:'create',token:'single-old',target:'project/creator',fields:[]};");
  const oldSubmit = byText(h.render(), '确认新建到飞书（2）');
  h.api.refreshOperator = async () => ({ ...inspectionReply(new Date().toISOString()), token: 'another-operator',
    choice: { token: 'saved-choice', name: 'Fixture Operator', target: 'project/creator' } });
  await h.preview();
  assert.equal(h.evaluate('plan'), null);
  const calls = h.calls.length; oldSubmit.handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.length, calls, 'old controls must not submit after authority rotation');
});

test('stable choice: failed submission history cannot retain a ready bulk plan after a single preview rotates authority', async () => {
  const h = cloudHarness(); stableChoiceFixture(h); await h.preview();
  h.evaluate("cloud.items[0].submission={status:'failed',result:{ok:false}};currentRow='a';accountNumber='001234';accountConfirmed=true;");
  byText(h.render(), '预览写入字段').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('cloud.items.every(i=>i.plan===null)'), true);
  assert.equal(h.evaluate('cloud.items[0].status'), 'idle');
  assert.equal(h.evaluate('cloud.items[0].submission.status'), 'failed');
  assert.equal(byText(h.render(), '确认新建到飞书（0）').disabled, true);
});

test('stable choice: late single preview after ownership confirmation ABA cannot resurrect a plan', async () => {
  const h = harness(); h.evaluate("connection.target='project/creator';accountConfirmed=true;safetyConfirmed=true;operatorConfirmed=true;");
  stableChoiceFixture(h); let finish;
  h.api.prepare = () => new Promise(resolve => { finish = resolve; });
  byText(h.render(), '预览写入字段').handlers.click(); await new Promise(setImmediate);
  const checkbox = walk(h.render()).find(n => n.children?.some(c => c.textContent === '将新增跟进的现维护经纪人设为 Fixture Operator')).children[0];
  checkbox.checked = false; checkbox.handlers.change();
  checkbox.checked = true; checkbox.handlers.change();
  finish({ ok: true, token: 'revoked-preview', action: 'create', fields: [], target: 'project/creator', name: 'Fixture' });
  await new Promise(setImmediate);
  assert.equal(h.evaluate('plan'), null);
});

test('maintainer lease: live response with one-ms timestamp skew remains valid without lengthening five minutes', async () => {
  const h = harness(), base = Date.now(), clock = h.clock(base);
  await startMaintainerInspection(h, async () => inspectionReply(new Date(base + 1).toISOString()));
  assert.equal(h.evaluate('operatorReady()'), true);
  assert.equal(h.evaluate('operatorDeadline()'), base + 300000);
  const checkbox = walk(h.render()).find(n => n.children?.some(c => c.textContent === '将新增跟进的现维护经纪人设为 Fixture Operator')).children[0];
  assert.equal(checkbox.disabled, false);
  checkbox.checked = true; checkbox.handlers.change(); assert.equal(h.evaluate('operatorConfirmed'), true);
  assert.match(h.evaluate('message'), /已确认/);
  clock.advance(300000); h.render();
  assert.equal(h.evaluate('operatorConfirmed'), false);
  assert.match(h.evaluate('operatorInvalidReason'), /CHECK_TIME_EXPIRED/);
  assert.equal(h.calls.some(c => c === 'execute'), false);
});

test('maintainer lease: IPC latency is subtracted and a too-late response cannot grant fresh time', async () => {
  for (const delay of [120000, 300000]) {
    const h = harness(), base = Date.now(), clock = h.clock(base); let finish;
    await startMaintainerInspection(h, () => new Promise(resolve => { finish = resolve; }));
    clock.advance(delay); finish(inspectionReply(new Date(base + delay + 1).toISOString()));
    await new Promise(setImmediate);
    assert.equal(h.evaluate('operatorReady()'), delay < 300000);
    assert.equal(h.evaluate('operatorDeadline()'), base + 300000);
    if (delay < 300000) { clock.advance(180000); h.render(); }
    assert.equal(h.evaluate('operatorReady()'), false);
    assert.match(h.evaluate('operatorInvalidReason'), /CHECK_TIME_EXPIRED/);
  }
});

test('maintainer lease: remaining duration is bounded and malformed replies cannot fall back to timestamps', async () => {
  for (const remaining of [undefined, null, 0, -1, 300001, 1.5, '300000', Infinity, NaN]) {
    const h = harness(), base = Date.now(); h.clock(base);
    await startMaintainerInspection(h, async () => {
      const reply = inspectionReply(new Date(base).toISOString());
      if (remaining === undefined) delete reply.remainingLeaseMs; else reply.remainingLeaseMs = remaining;
      return reply;
    });
    h.render(); assert.equal(h.evaluate('operatorReady()'), false);
    assert.match(h.evaluate('operatorInvalidReason'), /CHECK_LEASE_INVALID/);
    assert.equal(h.evaluate('operatorConfirmed'), false);
  }
  const h = harness(), base = Date.now(); h.clock(base);
  await startMaintainerInspection(h, async () => inspectionReply('private-invalid-time'));
  assert.match(h.evaluate('operatorInvalidReason'), /CHECK_TIME_INVALID/);
  assert.doesNotMatch(h.evaluate('operatorInvalidReason'), /private-invalid-time/);
});

test('maintainer lease: invalid start clocks, forward jumps and delayed timers cannot authorize a stale selection', async () => {
  for (const clockEdit of ['clockNow=NaN;', 'clockMonotonic=NaN;']) {
    const h = harness(), base = Date.now(); h.clock(base); let finish;
    byText(h.render(), '查找经纪人').handlers.click(); await new Promise(setImmediate);
    h.api.inspectOperator = () => new Promise(resolve => { finish = resolve; });
    h.evaluate(clockEdit);
    const pick = byLabel(h.render(), '匹配人员'); pick.value='fixture-choice'; pick.handlers.change();
    await new Promise(setImmediate); finish(inspectionReply(new Date(base + 1).toISOString())); await new Promise(setImmediate);
    assert.equal(h.evaluate('operatorReady()'), false);
    assert.equal(h.evaluate('operatorConfirmed'), false);
  }
  const h = harness(), base = Date.now(), clock = h.clock(base);
  await startMaintainerInspection(h, async () => inspectionReply(new Date(base + 16).toISOString()));
  assert.equal(h.evaluate('operatorReady()'), true);
  clock.wallOnly(300000); // No fake timer callback; the action path must recheck time.
  const checkbox = walk(h.render()).find(n => n.children?.some(c => c.textContent === '将新增跟进的现维护经纪人设为 Fixture Operator')).children[0];
  checkbox.checked=true; checkbox.handlers.change();
  assert.equal(h.evaluate('operatorConfirmed'), false);
  clock.wallOnly(-300000);
  assert.equal(h.evaluate('operatorReady()'), false, 'clock recovery cannot revive revoked authority');
});

test('maintainer lease: backwards wall clock cannot extend authority; invalid monotonic clock stays rejected', async () => {
  const h = harness(), base = Date.now(), clock = h.clock(base);
  await startMaintainerInspection(h, async () => inspectionReply(new Date(base + 1).toISOString()));
  clock.advance(1000); clock.wallOnly(-60000);
  assert.equal(h.evaluate('operatorDeadline()-Date.now()'), 299000);
  clock.monotonicOnly(299000); h.render();
  assert.equal(h.evaluate('operatorReady()'), false);
  const changed = harness(), changedClock = changed.clock(base);
  await startMaintainerInspection(changed, async () => inspectionReply(new Date(base + 1).toISOString()));
  changedClock.monotonicOnly(100); changed.render(); changedClock.monotonicOnly(-50); changed.render();
  assert.match(changed.evaluate('operatorInvalidReason'), /REVIEW_CLOCK_INVALID/);
  changedClock.monotonicOnly(100); changed.render();
  assert.equal(changed.evaluate('operatorReady()'), false);
});

test('maintainer lease: replacing a selection or clock contract during inspection cannot revive old authority', async () => {
  for (const edit of ["resetMaintainer();maintainerName='Changed';", "configDirty=true;", "currentRun='other';epoch++;",
    "resetMaintainer();maintainerName='Fixture Operator';maintainerChoice='fixture-choice';",
    "resetMaintainer();connection.target='other';connection.target='project/creator';maintainerChoice='fixture-choice';"]) {
    const h = harness(), base = Date.now(); h.clock(base); let finish;
    await startMaintainerInspection(h, () => new Promise(resolve => { finish = resolve; }));
    h.evaluate(edit); finish(inspectionReply(new Date(base + 1).toISOString())); await new Promise(setImmediate);
    assert.equal(h.evaluate('operator'), null);
    assert.equal(h.evaluate('operatorLease'), null);
  }
  const h = harness(), base = Date.now(); h.clock(base);
  await startMaintainerInspection(h, async () => inspectionReply(new Date(base + 1).toISOString()));
  h.evaluate('operator.checkedAt="private-replaced-time";'); h.render();
  assert.equal(h.evaluate('operatorReady()'), true, 'accepted snapshot is immutable');
  h.evaluate('operator={...operator};'); h.render();
  assert.equal(h.evaluate('operatorReady()'), false);
  assert.match(h.evaluate('operatorInvalidReason'), /CHECK_LEASE_INVALID/);
});

test('maintainer lease: readiness uses one wall sample and latches clock rejection without a render', async () => {
  const h = harness(), base = Date.now(); h.clock(base);
  await startMaintainerInspection(h, async () => inspectionReply(new Date(base + 1).toISOString()));
  h.evaluate(`let sampleCount=0;Date.now=()=> ++sampleCount===1 ? ${base + 300001} : ${base + 299999};`);
  assert.equal(h.evaluate('operatorReady()'), false);
  assert.equal(h.evaluate('sampleCount'), 1);
  assert.equal(h.evaluate('operatorReady()'), false, 'a second clock value cannot revive expiry');
  const changed = harness(), clock = changed.clock(base);
  await startMaintainerInspection(changed, async () => inspectionReply(new Date(base + 1).toISOString()));
  clock.monotonicOnly(100); assert.equal(changed.evaluate('operatorReady()'), true);
  changed.evaluate('operatorConfirmed=true;');
  clock.monotonicOnly(-50); assert.equal(changed.evaluate('operatorReady()'), false);
  clock.monotonicOnly(100); assert.equal(changed.evaluate('operatorReady()'), false);
  assert.equal(changed.evaluate('operatorConfirmed'), false);
  assert.match(changed.evaluate('operatorInvalidReason'), /REVIEW_CLOCK_INVALID/);
});

test('maintainer timing diagnostics separate missing, invalid, future and expired evidence without private data', () => {
  const base = Date.now();
  for (const [checkedAt, reason] of [
    [undefined, 'CHECK_TIME_MISSING'], [null, 'CHECK_TIME_MISSING'], ['', 'CHECK_TIME_MISSING'],
    ['private-invalid-value', 'CHECK_TIME_INVALID'], [42, 'CHECK_TIME_INVALID'],
    [new Date(base + 1).toISOString(), 'CHECK_TIME_FUTURE'],
    [new Date(base + 16).toISOString(), 'CHECK_TIME_FUTURE'],
    [new Date(base - 300000).toISOString(), 'CHECK_TIME_EXPIRED']
  ]) {
    const h = cloudHarness(); h.clock(base);
    h.evaluate(`operator.checkedAt=${JSON.stringify(checkedAt) || 'undefined'};
      operator.token='private-fixture-token';operator.name='Private Fixture';`);
    const root = h.render();
    assert.equal(byText(root, '查重并预览选中行').disabled, true);
    assert.match(h.evaluate('operatorInvalidReason'), new RegExp(reason));
    assert.doesNotMatch(h.evaluate('operatorInvalidReason'), /private-invalid-value|private-fixture-token|Private Fixture/);
    assert.equal(h.evaluate('operatorConfirmed'), false);
    assert.deepEqual(h.calls, []);
    if (reason === 'CHECK_TIME_FUTURE') {
      assert.match(h.evaluate('operatorInvalidReason'), new RegExp(`超前 ${Date.parse(checkedAt) - base} 毫秒`));
    }
  }
});

test('maintainer zero-skew confirmation remains ready while a one-ms future value is currently rejected', () => {
  const h = cloudHarness(), base = Date.now(); h.clock(base);
  h.evaluate(`operator.checkedAt=new Date(${base}).toISOString();`);
  assert.equal(h.evaluate('operatorReady()'), true);
  assert.equal(h.evaluate('operatorDeadline()'), base + 300000);
  h.evaluate(`operator.checkedAt=new Date(${base + 1}).toISOString();`);
  assert.equal(h.evaluate('operatorReady()'), false);
  h.render();
  assert.match(h.evaluate('operatorInvalidReason'), /CHECK_TIME_FUTURE/);
  h.evaluate(`operator.checkedAt=new Date(${base}).toISOString();`);
  assert.equal(h.evaluate('operatorReady()'), false, 'later clock alignment must not revive a rejected inspection');
  assert.deepEqual(h.calls, []);
});

test('missing or invalid maintainer checkedAt fails closed; only explicit re-selection restores authority', async () => {
  for (const checkedAt of [undefined, 'invalid', new Date(Date.now()-300001).toISOString(), new Date(Date.now()+60000).toISOString()]) {
    const h = cloudHarness(); h.evaluate(`operator.checkedAt=${JSON.stringify(checkedAt) || 'undefined'};`);
    assert.equal(byText(h.render(), '查重并预览选中行').disabled, true);
    assert.equal(h.evaluate('operatorConfirmed'), false);
    assert.deepEqual(h.calls, []);
  }
  const h = harness(); h.evaluate(`operator={token:'expired',name:'Fixture Operator',checkedAt:new Date(Date.now()-300001).toISOString()};operatorConfirmed=true;`);
  h.render(); byText(h.render(), '查找经纪人').handlers.click(); await new Promise(setImmediate);
  const pick = byLabel(h.render(), '匹配人员'); pick.value='fixture-choice'; pick.handlers.change(); await new Promise(setImmediate);
  assert.equal(h.evaluate('operatorConfirmed'), false);
  const check = walk(h.render()).find(n => n.children?.some(c => c.textContent === '将新增跟进的现维护经纪人设为 Fixture Operator')).children[0];
  check.checked=true; check.handlers.change();
  assert.equal(h.evaluate('operatorConfirmed'), true);
  assert.deepEqual(h.calls, ['searchMaintainers','inspectOperator']);
});

test('expiry blocks dispatch even when its timer is delayed or render crosses the deadline', async () => {
  const stale = cloudHarness(); await stale.preview();
  const submit = byText(stale.render(), '确认新建到飞书（2）');
  stale.evaluate('Date.now=()=>Date.parse(operator.checkedAt)+300001;');
  submit.handlers.click(); await new Promise(setImmediate);
  assert.equal(stale.calls.some(c => c[0] === 'execute'), false);
  assert.equal(stale.evaluate('operatorConfirmed'), false);
  const crossed = cloudHarness(); await crossed.preview();
  crossed.ctx.rerender = () => {
    if (crossed.evaluate("cloud.phase==='creating'")) crossed.evaluate('Date.now=()=>Date.parse(operator.checkedAt)+300001;');
  };
  await crossed.submit(2);
  assert.equal(crossed.calls.some(c => c[0] === 'execute'), false);
  assert.equal(crossed.evaluate('cloud.phase'), 'stopped');
});

test('single-create execute rechecks authority after saving and never refreshes it automatically', async () => {
  const h = harness(), clock = h.clock();
  h.evaluate(`operator={name:'Fixture Operator',token:'single',checkedAt:new Date(Date.now()).toISOString()};
    operatorConfirmed=true;accountConfirmed=true;safetyConfirmed=true;
    plan={action:'create',token:'single-plan',name:'[AI测试] Fixture',target:'project/creator',fields:[]};`);
  let finishSave; h.ctx.save = () => new Promise(resolve => {finishSave=resolve;});
  h.api.execute = async () => {h.calls.push('execute');return {ok:true};};
  byText(h.render(), '确认写入飞书').handlers.click();
  clock.advance(300001); finishSave({ok:true}); await new Promise(setImmediate);
  assert.deepEqual(h.calls, []);
  assert.equal(h.evaluate('operatorConfirmed'), false);
});

test('single-create delayed save cannot revive revoked approval even when checked again', async () => {
  for (const recheck of [false, true]) {
    const h = harness(); h.clock();
    h.evaluate(`operator={name:'Fixture Operator',token:'single',checkedAt:new Date(Date.now()).toISOString()};
      operatorConfirmed=true;accountConfirmed=true;safetyConfirmed=true;
      plan={action:'create',token:'single-plan',name:'[AI测试] Fixture',target:'project/creator',fields:[]};`);
    const approval = byText(h.render(), '已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程').parent.children[0];
    let finishSave; h.ctx.save = () => new Promise(resolve => {finishSave=resolve;});
    h.api.execute = async () => {h.calls.push('execute');return {ok:true};};
    byText(h.render(), '确认写入飞书').handlers.click();
    approval.checked = false; approval.handlers.change();
    if (recheck) { approval.checked = true; approval.handlers.change(); }
    finishSave({ok:true}); await new Promise(setImmediate);
    assert.deepEqual(h.calls, []);
    assert.equal(h.evaluate('plan'), null);
  }
});

test('cloud delayed save cannot revive revoked approval or the frozen batch revision', async () => {
  for (const recheck of [false, true]) {
    const h = cloudHarness(); await h.preview();
    const approval = byText(h.render(), '已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程').parent.children[0];
    let finishSave; h.ctx.save = () => new Promise(resolve => {finishSave=resolve;});
    byText(h.render(), '确认新建到飞书（2）').handlers.click();
    approval.checked = false; approval.handlers.change();
    if (recheck) { approval.checked = true; approval.handlers.change(); }
    finishSave({ok:true}); await new Promise(setImmediate);
    assert.equal(h.calls.some(c => c[0] === 'execute'), false);
    assert.equal(h.evaluate('cloud.items.every(i=>i.plan===null)'), true);
  }
});

const cloudPanel = root => walk(root).find(n => n.dataset?.testid === 'feishu-cloud');
const panelText = root => walk(cloudPanel(root)).filter(n => !n.hidden).map(n => n.textContent || '').join('\n');
async function mixedCloudPreview(h) {
  const prepare = h.api.prepare;
  h.api.prepare = p => {
    if (p.rowId !== 'b') return prepare(p);
    h.calls.push(['prepare', p.rowId]);
    return { ok: false, code: 'FEISHU_DUPLICATE_MAINTAINER' };
  };
  await h.preview();
}
test('cloud invalidation: maintainer expiry explains recovery inside the cloud section and clears preview-only counts/errors', async () => {
  const h = cloudHarness(), clock = h.clock();
  h.evaluate("operator.checkedAt=new Date(Date.now()-240000).toISOString();safetyConfirmed=false;cloud.note='keep note';");
  await mixedCloudPreview(h);
  const before = h.render(), stalePrepare = byText(before, '查重并预览选中行'), staleSubmit = byText(before, '确认新建到飞书（1）');
  const calls = h.calls.length, draft = h.evaluate('JSON.stringify(cloud.items.map(i=>[i.rowId,i.account,i.contact,i.image,i.video,i.selected]))');
  assert.equal(h.evaluate('cloud.progress'), 2); clock.advance(60001);
  const root = h.render(), text = panelText(root);
  assert.match(text, /归属确认已过期/); assert.match(text, /重新查找并选择/);
  assert.match(text, /重新核对建档名单.*查重.*预览/);
  assert.doesNotMatch(text, /处理 2\/2|同号同经纪人|尚未执行/);
  assert.match(text, /处理 0\/0/); assert.match(text, /可新建 0 · 重复跳过 0/);
  assert.equal(h.evaluate('cloud.items.every(i=>i.status===\'idle\'&&i.plan===null&&i.error===null)'), true);
  assert.equal(h.evaluate('JSON.stringify(cloud.items.map(i=>[i.rowId,i.account,i.contact,i.image,i.video,i.selected]))'), draft);
  assert.equal(h.evaluate('cloud.note'), 'keep note');
  assert.equal(byText(root, '查重并预览选中行').disabled, true);
  stalePrepare.handlers.click(); staleSubmit.handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.length, calls, 'expiry must not renew authority, reprepare or execute');
});
test('cloud invalidation: revoked write approval explains readonly recovery and never revives an old plan', async () => {
  const h = cloudHarness(); await mixedCloudPreview(h);
  const root = h.render(), stale = byText(root, '确认新建到飞书（1）');
  const approval = byText(root, '已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程').parent.children[0];
  approval.checked = false; approval.handlers.change();
  const text = panelText(h.render());
  assert.match(text, /写入确认已撤销/); assert.match(text, /重新核对建档名单.*查重.*预览/);
  assert.doesNotMatch(text, /处理 2\/2|同号同经纪人/);
  stale.handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.some(c => c[0] === 'execute'), false);
  const oldToken = stale.textContent;
  await h.preview();
  assert.equal(h.evaluate('safetyConfirmed'), false); assert.equal(h.evaluate('cloud.phase'), 'preview');
  assert.equal(byText(h.render(), oldToken).disabled, true);
  assert.doesNotMatch(panelText(h.render()), /写入确认已撤销/);
});
test('cloud invalidation: operator and config edits explain recovery immediately in the existing cloud section', async () => {
  for (const kind of ['operator', 'config']) {
    const h = cloudHarness(); await mixedCloudPreview(h); const root = h.render(), calls = h.calls.length;
    const control = byLabel(root, kind === 'config' ? '项目 Key' : '经纪人姓名');
    control.value = 'Changed Fixture'; control.handlers.input();
    const text = panelText(root);
    assert.match(text, kind === 'config' ? /连接设置已更改/ : /经纪人归属待确认/);
    assert.match(text, kind === 'config' ? /重新连接/ : /重新查找并选择/);
    assert.match(text, /重新核对建档名单.*查重.*预览/);
    assert.doesNotMatch(text, /处理 2\/2|同号同经纪人/);
    assert.equal(h.calls.length, calls); assert.equal(h.evaluate('cloud.items.every(i=>i.plan===null)'), true);
    assert.equal(byText(root, '查重并预览选中行').disabled, true);
  }
});
test('cloud invalidation: switching runs explains fresh authority and retains original submission history', async () => {
  const h = cloudHarness(); await h.preview(); await h.submit(2);
  const history = h.evaluate('JSON.stringify(cloudHistory.map(h=>[h.target,h.creatorName,h.account,h.maintainerName,h.status,h.result]))');
  const calls = h.calls.length; h.ctx.runDir = 'fixture-other';
  h.ctx.rows = [{ rowId: 'other', creatorName: 'New Run', xhsId: 'other-fixture', selected: true }];
  const root = h.render(), text = panelText(root);
  assert.match(text, /当前任务已切换/); assert.match(text, /重新查找并选择/);
  assert.match(text, /重新核对建档名单.*查重.*预览/); assert.match(text, /处理 0\/0/);
  assert.doesNotMatch(text, /已核实 2|处理 2\/2/);
  assert.equal(h.evaluate('JSON.stringify(cloudHistory.map(h=>[h.target,h.creatorName,h.account,h.maintainerName,h.status,h.result]))'), history);
  assert.ok(byText(root, '历史提交成功 · 已回读')); assert.equal(h.calls.length, calls);
});
test('cloud invalidation: expiry clears only new preview state and preserves verified/unknown identities, owners and reconciliation', async () => {
  const h = cloudHarness(), clock = h.clock(); await h.preview();
  h.api.execute = async p => { h.calls.push(['execute', p.token]); return p.token === 'plan-a'
    ? { ok: true, status: 'verified', recordId: '41' }
    : { ok: false, status: 'unknown', entryId: 'unknown-b', recordId: '42', code: 'FEISHU_READBACK_MISMATCH' }; };
  await h.submit(2);
  h.ctx.rows.push({ rowId: 'c', creatorName: 'Fixture C', xhsId: 'third-fixture', wechatId: 'fixture_c', selected: true });
  h.render(); h.evaluate('cloud.items[0].selected=false;cloud.items[1].selected=false;');
  h.api.prepare = async p => { h.calls.push(['prepare', p.rowId]); return { ok: false, code: 'FEISHU_DUPLICATE_MAINTAINER' }; };
  await h.preview();
  const state = h.evaluate('JSON.stringify(cloud.items.slice(0,2).map(i=>[i.rowId,i.creatorName,i.account,i.operationOwner,i.status,i.error,i.result]))');
  const history = h.evaluate('JSON.stringify(cloudHistory.map(h=>[h.target,h.creatorName,h.account,h.maintainerName,h.status,h.result]))');
  const calls = h.calls.length; h.render(); clock.advance(300001); const root = h.render();
  assert.match(panelText(root), /归属确认已过期/); assert.match(panelText(root), /处理 0\/0/);
  assert.doesNotMatch(panelText(root), /同号同经纪人/);
  assert.equal(h.evaluate('cloud.items[2].error'), null); assert.equal(h.evaluate('cloud.items[2].plan'), null);
  assert.equal(h.evaluate('JSON.stringify(cloud.items.slice(0,2).map(i=>[i.rowId,i.creatorName,i.account,i.operationOwner,i.status,i.error,i.result]))'), state);
  assert.equal(h.evaluate('JSON.stringify(cloudHistory.map(h=>[h.target,h.creatorName,h.account,h.maintainerName,h.status,h.result]))'), history);
  assert.ok(byText(root, '历史提交成功 · 已回读')); assert.ok(byText(root, '提交结果未知 · 禁止重发'));
  assert.equal(byText(root, '核对提交结果').disabled, false); assert.equal(h.calls.length, calls);
});
test('cloud invalidation: expired plan clears ready/duplicate previews without revoking an otherwise valid maintainer', async () => {
  const h = cloudHarness(); await mixedCloudPreview(h); const stale = byText(h.render(), '确认新建到飞书（1）');
  h.evaluate('cloud.items[0].plan.expiresAt=1;'); const root = h.render();
  assert.match(panelText(root), /预览已过期/); assert.match(panelText(root), /重新核对建档名单.*查重.*预览/);
  assert.match(panelText(root), /处理 0\/0/); assert.doesNotMatch(panelText(root), /同号同经纪人/);
  assert.equal(h.evaluate('operatorConfirmed'), true); assert.equal(h.evaluate('cloud.items.every(i=>i.plan===null)'), true);
  stale.handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.some(c => c[0] === 'execute'), false);
});
test('cloud invalidation: late readonly preview response after maintainer expiry cannot resurrect a plan', async () => {
  const h = cloudHarness(), clock = h.clock();
  h.evaluate('operator.checkedAt=new Date(Date.now()-240000).toISOString();');
  const prepare = h.api.prepare; let finish;
  h.api.prepare = async p => { const result = await prepare(p); return new Promise(resolve => { finish = () => resolve(result); }); };
  await h.preview(); h.render(); assert.equal(h.evaluate('cloud.total'), 2);
  clock.advance(60001);
  assert.equal(h.evaluate('busy'), true); assert.equal(h.evaluate('cloud.progress'), 0); assert.equal(h.evaluate('cloud.total'), 0);
  assert.doesNotMatch(panelText(h.render()), /处理 1\/0/);
  finish(); await new Promise(setImmediate);
  const root = h.render();
  assert.match(panelText(root), /归属确认已过期/); assert.match(panelText(root), /处理 0\/0/);
  assert.equal(h.evaluate('cloud.items.every(i=>i.plan===null&&i.status===\'idle\')'), true);
  assert.equal(h.evaluate('cloud.progress'), 0); assert.equal(h.evaluate('cloud.total'), 0);
  assert.doesNotMatch(panelText(root), /处理 1\/0/);
  assert.deepEqual(h.calls.map(c => c.slice(0, 2)), [['prepare', 'a']]);
});
test('cloud invalidation: expiry during dispatched creation keeps actual progress and original result distinct from invalid previews', async () => {
  for (const status of ['verified', 'unknown']) {
    const h = cloudHarness(), clock = h.clock(); await h.preview(); let finish;
    h.api.execute = p => { h.calls.push(['execute', p.token]); return new Promise(resolve => { finish = resolve; }); };
    byText(h.render(), '确认新建到飞书（2）').handlers.click(); await new Promise(setImmediate);
    h.render(); clock.advance(300001);
    finish({ ok: status === 'verified', status, recordId: '41', entryId: 'entry-a', ...(status === 'unknown' ? { code: 'FEISHU_READBACK_MISMATCH' } : {}) });
    await new Promise(setImmediate); const root = h.render();
    assert.match(panelText(root), /归属确认已过期/); assert.match(panelText(root), /上次提交处理 1\/2/);
    assert.equal(h.evaluate('cloud.items[0].status'), status); assert.equal(h.evaluate('cloud.items[1].plan'), null);
    assert.equal(h.evaluate('cloudHistory[0].account'), '001234'); assert.equal(h.evaluate('cloudHistory[0].maintainerName'), 'Fixture Operator');
    assert.equal(h.evaluate('cloudHistory[0].status'), status);
    assert.equal(h.calls.filter(c => c[0] === 'execute').length, 1);
  }
});

function ownedAbsenceHarness(status = 'verified', target = 'project/creator') {
  const h = cloudHarness();
  const record = { entryId: '11111111-1111-4111-8111-111111111111', recordId: '41', target,
    name: '[AI测试] AI_TEST_fixture Original Fixture', batch: 'AI_TEST_fixture', status,
    accountNumber: '001234', maintainerName: 'Original Owner', cleanupBlocked: false };
  h.evaluate(`action='delete';singleOpen=true;recordId='41';operator=null;operatorConfirmed=false;safetyConfirmed=false;
    records=${JSON.stringify([record])};plan={action:'delete',token:'old-delete-plan',name:'Old Fixture',recordId:'41',target:'project/creator',fields:[]};`);
  h.api.listRecords = async () => { h.calls.push(['listRecords']); return { ok: true, records: [structuredClone(record)] }; };
  h.api.verifyOwnedAbsence = async payload => {
    assert.equal(h.evaluate('plan'), null, 'pending mutation approval must be invalid before the readonly request');
    h.calls.push(['absence', structuredClone(payload)]);
    return { ok: true, ...payload, exists: true, status: 'verified', externalAbsenceVerified: false };
  };
  return { ...h, record };
}
const absenceIdentity = h => ({ entryId: h.record.entryId, recordId: h.record.recordId, target: h.record.target });

test('blocked readonly: either mode permits exact absence checks but disables and guards mutation handlers', async () => {
  for (const mode of ['delete', 'update']) {
    const h = ownedAbsenceHarness(); h.record.cleanupBlocked = true;
    h.evaluate(`action='${mode}';records=${JSON.stringify([h.record])};safetyConfirmed=true;plan.action='${mode}';`);
    h.api.prepare = async p => { h.calls.push(['prepare', p]); return { ok: false }; };
    h.api.execute = async p => { h.calls.push(['execute', p]); return { ok: false }; };
    const root = h.render(), pick = byLabel(root, '目标记录');
    assert.equal(pick.children[1].disabled, false);
    assert.match(pick.children[1].textContent, /需人工核对.*禁止自动修改和清理/);
    const prepare = root.querySelector('[data-prepare]');
    const execute = byText(root, mode === 'delete' ? '确认删除该测试记录' : '确认写入飞书');
    assert.equal(prepare.disabled, true); assert.equal(execute.disabled, true);
    prepare.handlers.click(); await new Promise(setImmediate);
    execute.handlers.click(); await new Promise(setImmediate);
    assert.deepEqual(h.calls, []);
    h.evaluate('safetyConfirmed=false;');
    byText(h.render(), '核对云端是否已删除').handlers.click(); await new Promise(setImmediate);
    assert.deepEqual(h.calls, [['absence', { ...absenceIdentity(h), inspectCurrent: true }], ['listRecords']]);
    assert.equal(h.evaluate('records[0].cleanupBlocked'), true);
    assert.equal(h.evaluate('operator'), null); assert.equal(h.evaluate('safetyConfirmed'), false);
    assert.match(h.evaluate('message'), /仍存在.*仍禁止自动修改和清理/);
  }
});

test('blocked readonly: current inspection displays safe evidence without restoring mutation approval', async () => {
  for (const inspection of [
    { matches: true },
    { matches: false, cleanupDiagnostic: 'INITIAL_WORKFLOW_UNVERIFIED' },
    { matches: false, cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED', cleanupOriginDiagnostic: 'UPDATER_MISMATCH' },
    { matches: false, cleanupDiagnostic: 'FIELD_SCHEMA_UNVERIFIED', defaults: { matches: false,
      cleanupDiagnostic: 'FIELD_SCHEMA_UNVERIFIED', schema: { ordinal: 2, slot: 'NAME', metadataFound: false,
        valuePresent: true, actualType: 'text', expectedType: 'OTHER' } } },
    { matches: false, cleanupDiagnostic: 'PRIVATE_SENTINEL', cleanupOriginDiagnostic: 'PRIVATE_SENTINEL',
      defaults: { matches: false, schema: { ordinal: 2, slot: 'PRIVATE_SENTINEL', metadataFound: false,
        valuePresent: true, actualType: 'PRIVATE_SENTINEL', expectedType: 'OTHER' } },
      workflowIssues: ['PRIVATE_SENTINEL', 'STATUS_TIME_INVALID', 'STATUS_ACTOR_MISSING', 'HISTORY_MISSING', 'STATUS_TIME_INVALID'] }
  ]) {
    const h = ownedAbsenceHarness(); h.record.cleanupBlocked = true;
    h.evaluate(`records=${JSON.stringify([h.record])};`);
    const original = h.evaluate('JSON.stringify(records)'), verify = h.api.verifyOwnedAbsence;
    h.api.verifyOwnedAbsence = async p => ({ ...await verify(p), currentInspection: inspection });
    byText(h.render(), '核对云端是否已删除').handlers.click(); await new Promise(setImmediate);
    const root = h.render(), message = h.evaluate('message');
    assert.match(message, /仍禁止自动修改和清理/);
    if (inspection.matches) assert.match(message, /当前字段检查通过，但不补建旧记录的首次基线/);
    else if (inspection.cleanupDiagnostic === 'INITIAL_WORKFLOW_UNVERIFIED') assert.match(message, /当前检查初始流程状态无法核实/);
    else if (inspection.cleanupOriginDiagnostic === 'UPDATER_MISMATCH') assert.match(message, /当前检查更新人与本次创建身份不一致/);
    assert.doesNotMatch(message, /首次回读/);
    assert.doesNotMatch(panelText(root), /PRIVATE_SENTINEL/);
    if (inspection.defaults?.schema?.slot === 'NAME') assert.match(message, /第2项 \[NAME\]、元数据缺失、值存在、类型 text\/OTHER/);
    if (inspection.workflowIssues) {
      assert.match(message, /当前流程检查.*STATUS_TIME_INVALID.*STATUS_ACTOR_MISSING.*HISTORY_MISSING/);
      assert.equal(message.match(/STATUS_TIME_INVALID/g).length, 1);
    }
    assert.equal(h.evaluate('JSON.stringify(records)'), original);
    assert.equal(h.evaluate('plan'), null); assert.equal(h.evaluate('safetyConfirmed'), false);
    assert.equal(root.querySelector('[data-prepare]').disabled, true);
    assert.deepEqual(h.calls, [['absence', { ...absenceIdentity(h), inspectCurrent: true }], ['listRecords']]);
  }
});

test('manual cleanup UI: blocked record requires exact current preview and distinct human review before delete', async () => {
  const h = ownedAbsenceHarness(); h.record.cleanupBlocked = true;
  h.evaluate(`records=${JSON.stringify([h.record])};safetyConfirmed=true;plan=null;`);
  h.api.prepareManualCleanup = async p => {
    h.calls.push(['manual', structuredClone(p)]);
    return { ok: true, action: 'delete', manualCleanup: true, token: 'manual-token', ...absenceIdentity(h),
      name: h.record.name, reviewFields: [{ label: 'Fixture field', displayValue: 'Complete current fixture' }], updaterChanged: true };
  };
  h.api.execute = async p => {
    h.calls.push(['execute', structuredClone(p)]); h.record.status = 'deleted';
    return { ok: true, action: 'delete', entryId: h.record.entryId, recordId: h.record.recordId };
  };
  byText(h.render(), '预览人工清理').handlers.click(); await new Promise(setImmediate);
  let root = h.render();
  assert.match(walk(root).map(n => n.textContent || '').join('\n'), /Complete current fixture/);
  assert.equal(byText(root, '删除云端测试记录').disabled, true);
  byText(root, '删除云端测试记录').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.calls.length, 1);
  const check = byText(root, '已核对返回字段及目标，只删除这条 AI 测试记录（不承诺可恢复）').parent.children[0];
  check.checked = true; check.handlers.change(); root = h.render();
  assert.equal(byText(root, '删除云端测试记录').disabled, false);
  byText(root, '删除云端测试记录').handlers.click(); await new Promise(setImmediate);
  assert.deepEqual(h.calls, [['manual', { ...absenceIdentity(h), safetyConfirmed: true }],
    ['execute', { token: 'manual-token', confirmed: true, manualCleanupConfirmed: true, reviewedRecordId: '41' }], ['listRecords']]);
  assert.equal(h.evaluate('recordId'), ''); assert.equal(h.evaluate('plan'), null);
  assert.equal(h.evaluate('records[0].cleanupBlocked'), true);
});

test('manual cleanup UI: stale selection or late mismatched preview cannot authorize deletion', async () => {
  for (const change of ["recordId='42';", "connection={...connection,target:'other/creator'};", "records[0].entryId='other';", 'safetyConfirmed=false;']) {
    const h = ownedAbsenceHarness(); h.record.cleanupBlocked = true;
    h.evaluate(`records=${JSON.stringify([h.record])};safetyConfirmed=true;plan=null;`); let finish;
    h.api.prepareManualCleanup = p => { h.calls.push(['manual', p]); return new Promise(resolve => { finish = resolve; }); };
    const button = byText(h.render(), '预览人工清理');
    button.handlers.click(); await new Promise(setImmediate); h.evaluate(change);
    finish({ ok: true, manualCleanup: true, action: 'delete', token: 'late', ...absenceIdentity(h), name: h.record.name, reviewFields: [] });
    await new Promise(setImmediate);
    assert.equal(h.evaluate('plan'), null); assert.equal(h.calls.length, 1, change);
  }
});

test('deleted history UI: batch archive removes only terminal dropdown entries and keeps the audit records', async () => {
  const h = ownedAbsenceHarness(); h.record.status = 'deleted';
  h.evaluate(`records=${JSON.stringify([h.record])};recordId='';plan=null;`);
  h.api.archiveDeletedRecords = async p => {
    h.calls.push(['archive', structuredClone(p)]); h.record.hiddenFromPicker = true;
    return { ok: true, target: h.record.target, count: 1 };
  };
  byText(h.render(), '移除已删除历史（1）').handlers.click(); await new Promise(setImmediate);
  const root = h.render();
  assert.deepEqual(h.calls, [['archive', { target: h.record.target, entryIds: [h.record.entryId], confirmed: true }], ['listRecords']]);
  assert.equal(h.evaluate('records.length'), 1); assert.equal(h.evaluate('records[0].status'), 'deleted');
  assert.equal(byLabel(root, '目标记录').children.some(n => n.value === '41'), false);
  assert.match(h.evaluate('message'), /未删除飞书数据/);
});

test('blocked readonly: stale mutation handlers reject new blocks and changed exact identities before dispatch', async () => {
  for (const mode of ['delete', 'update']) for (const change of [
    'records[0].cleanupBlocked=true;', "records[0].target='other/creator';",
    "records[0].entryId='other-entry';", 'records.push({...records[0]});',
    "recordId='42';", "action='create';", 'configDirty=true;'
  ]) {
    const h = ownedAbsenceHarness(); h.evaluate(`action='${mode}';safetyConfirmed=true;plan.action='${mode}';`);
    const root = h.render(), prepare = root.querySelector('[data-prepare]');
    const execute = byText(root, mode === 'delete' ? '确认删除该测试记录' : '确认写入飞书');
    h.api.prepare = async () => { h.calls.push('prepare'); return { ok: false }; };
    h.api.execute = async () => { h.calls.push('execute'); return { ok: false }; };
    h.evaluate(change);
    execute.handlers.click(); await new Promise(setImmediate);
    prepare.handlers.click(); await new Promise(setImmediate);
    assert.deepEqual(h.calls, [], `${mode}: ${change}`);
  }
});

test('blocked readonly: pending mutation preview cannot adopt a response after cleanup is blocked or identity changes', async () => {
  for (const change of ['records[0].cleanupBlocked=true;', "records[0].entryId='other-entry';"]) {
    const h = ownedAbsenceHarness(); h.evaluate('safetyConfirmed=true;plan=null;'); let finish;
    h.api.prepare = p => { h.calls.push(['prepare', p.recordId]); return new Promise(resolve => { finish = resolve; }); };
    h.render().querySelector('[data-prepare]').handlers.click(); await new Promise(setImmediate);
    h.evaluate(change);
    finish({ ok: true, action: 'delete', target: h.record.target, recordId: '41', token: 'late-token', fields: [] });
    await new Promise(setImmediate);
    assert.equal(h.evaluate('plan'), null); assert.deepEqual(h.calls, [['prepare', '41']]);
    assert.equal(byText(h.render(), '确认删除该测试记录'), undefined);
  }
});

test('blocked readonly: normal exact unblocked selection still prepares and executes once', async () => {
  const h = ownedAbsenceHarness(); h.evaluate('safetyConfirmed=true;plan=null;');
  h.api.prepare = async p => { h.calls.push(['prepare', p.recordId]); return {
    ok: true, action: 'delete', token: 'exact-token', target: h.record.target, recordId: '41', name: 'Fixture', fields: []
  }; };
  h.api.execute = async p => { h.calls.push(['execute', structuredClone(p)]); return { ok: true, action: 'delete', recordId: '41' }; };
  const prepare = h.render().querySelector('[data-prepare]'); assert.equal(prepare.disabled, false);
  prepare.handlers.click(); await new Promise(setImmediate);
  const execute = byText(h.render(), '确认删除该测试记录'); assert.equal(execute.disabled, false);
  execute.handlers.click(); await new Promise(setImmediate);
  assert.deepEqual(h.calls, [['prepare', '41'], ['execute', { token: 'exact-token', confirmed: true }], ['listRecords']]);
});

test('blocked readonly: exists and forbidden retain the blocked baseline, external absence retires only exact history', async () => {
  const h = ownedAbsenceHarness(); h.record.cleanupBlocked = true;
  h.evaluate(`records=${JSON.stringify([h.record])};cloudHistory=[{target:'project/creator',creatorName:'Submitted Fixture',
    account:'001234',maintainerName:'Original Owner',status:'verified',result:{...records[0]}}];`);
  const baseline = h.evaluate('JSON.stringify(records)'); let request = 0;
  h.api.verifyOwnedAbsence = async p => {
    assert.equal(h.evaluate('plan'), null); h.calls.push(['absence', structuredClone(p)]);
    if (++request === 2) return { ok: false, code: 'FEISHU_HTTP_ERROR', status: 403 };
    if (request === 3) { h.record.status = 'deleted'; h.record.externalAbsenceVerified = true; }
    return { ok: true, ...p, exists: request === 1, status: h.record.status, externalAbsenceVerified: request === 3 };
  };
  for (let i = 1; i <= 3; i++) {
    byText(h.render(), '核对云端是否已删除').handlers.click(); await new Promise(setImmediate);
    if (i < 3) { assert.equal(h.evaluate('JSON.stringify(records)'), baseline); assert.equal(h.evaluate('recordId'), '41'); }
  }
  assert.equal(h.evaluate('recordId'), ''); assert.equal(h.evaluate('records[0].cleanupBlocked'), true);
  assert.equal(h.evaluate('records[0].stampVersion'), undefined); assert.equal(h.evaluate('records[0].summary'), undefined);
  assert.equal(h.evaluate('cloudHistory[0].maintainerName'), 'Original Owner');
  assert.equal(h.evaluate('cloudHistory[0].account'), '001234');
  assert.equal(h.evaluate('cloudHistory[0].result.externalAbsenceVerified'), true);
  const text = walk(h.render()).map(n => n.textContent || '').join('\n');
  assert.match(text, /只读确认外部不存在，未再次发送删除/); assert.doesNotMatch(text, /本软件已清理/);
  assert.deepEqual(h.calls, [['absence', { ...absenceIdentity(h), inspectCurrent: true }], ['listRecords'],
    ['absence', { ...absenceIdentity(h), inspectCurrent: true }],
    ['absence', { ...absenceIdentity(h), inspectCurrent: true }], ['listRecords']]);
});

test('blocked readonly: stale absence selection cannot dispatch after entry, target, status or uniqueness changes', async () => {
  for (const change of ["records[0].entryId='wrong-entry';", "records[0].target='other/creator';",
    "records[0].status='unknown';", 'records.push({...records[0]});']) {
    const h = ownedAbsenceHarness(); h.evaluate('records[0].cleanupBlocked=true;');
    const stale = byText(h.render(), '核对云端是否已删除'); assert.ok(stale);
    h.evaluate(change); stale.handlers.click(); await new Promise(setImmediate);
    assert.deepEqual(h.calls, [], change);
  }
});

test('blocked readonly: obsolete create preview cannot become mutation before or after local save', async () => {
  for (const mode of ['delete', 'update']) for (const pending of [false, true]) {
    const h = cloudHarness(); let finish;
    h.evaluate("action='create';singleOpen=true;currentRow='a';accountNumber='001234';accountConfirmed=true;");
    if (pending) h.ctx.save = () => new Promise(resolve => { finish = resolve; });
    const stale = h.render().querySelector('[data-prepare]');
    if (pending) { stale.handlers.click(); await new Promise(setImmediate); assert.equal(typeof finish, 'function'); }
    h.evaluate(`action='${mode}';recordId='41';records=[{entryId:'fixture-entry',recordId:'41',target:'project/creator',status:'verified',cleanupBlocked:true}];`);
    if (pending) finish({ ok: true }); else stale.handlers.click();
    await new Promise(setImmediate);
    assert.deepEqual(h.calls, [], `${mode}, pending=${pending}`);
    assert.equal(h.evaluate('plan'), null);
  }
});

test('blocked readonly: real Chrome DOM selects blocked records without opening mutation and retires via exact readonly evidence', {
  skip: !process.env.CHROME_PATH, timeout: 30000
}, async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const context = await browser.newContext(); let requests = 0;
    await context.route('**/*', route => { requests++; return route.abort(); });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><meta charset="utf-8"><div id="mount"></div>');
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../renderer/views/feishu.js'), 'utf8').replace(/^export /gm, '') + `
      window.calls=[];window.absenceCount=0;
      window.fixtureRecord={entryId:'11111111-1111-4111-8111-111111111111',recordId:'41',target:'fixture/creator',
        name:'[AI测试] Blocked Fixture',status:'verified',cleanupBlocked:true};
      window.desktopAPI={feishu:{listRecords:async()=>{window.calls.push(['listRecords']);return {ok:true,records:[{...window.fixtureRecord}]};},
        verifyOwnedAbsence:async p=>{window.calls.push(['absence',{...p}]);window.absenceCount++;
          if(window.absenceCount===2)return {ok:false,code:'FEISHU_HTTP_ERROR',status:403};
          if(window.absenceCount===3){window.fixtureRecord.status='deleted';window.fixtureRecord.externalAbsenceVerified=true;}
          return {ok:true,...p,exists:window.absenceCount===1,status:window.fixtureRecord.status,externalAbsenceVerified:window.absenceCount===3};},
        prepare:async()=>{window.calls.push(['prepare']);return {ok:false};},execute:async()=>{window.calls.push(['execute']);return {ok:false};}}};
      const ctx={runDir:'blocked-fixture',rows:[],save:async()=>({ok:true}),rerender:()=>window.renderFixture()};
      window.renderFixture=()=>document.getElementById('mount').replaceChildren(renderFeishuWorkbench(ctx));
      window.renderFixture();connection={connected:true,target:'fixture/creator',fields:[]};
      action='delete';singleOpen=true;records=[{...window.fixtureRecord}];window.renderFixture();
    ` });
    const pick = page.getByLabel('目标记录', { exact: true });
    assert.equal(await pick.locator('option[value="41"]').isDisabled(), false);
    assert.match(await pick.locator('option[value="41"]').textContent(), /需人工核对.*禁止自动修改和清理/);
    await pick.selectOption('41');
    for (const mode of ['delete', 'update']) {
      await page.evaluate(mode => { action=mode;safetyConfirmed=true;window.renderFixture(); }, mode);
      assert.equal(await page.locator('[data-prepare]').isDisabled(), true);
      await page.evaluate(() => { safetyConfirmed=false;window.renderFixture(); });
      assert.equal(await page.locator('[data-owned-absence]').isDisabled(), false);
    }
    for (let i = 1; i <= 3; i++) {
      await page.locator('[data-owned-absence]').click(); await page.waitForFunction(() => !busy);
      assert.equal(await page.locator('[data-prepare]').isDisabled(), true);
      if (i < 3) {
        assert.equal(await pick.inputValue(), '41');
        assert.equal(await page.evaluate(() => records[0].cleanupBlocked), true);
      }
    }
    assert.equal(await pick.inputValue(), '');
    assert.match(await page.locator('[data-owned-absence-status]').textContent(), /只读确认外部不存在，未再次发送删除/);
    assert.match(await pick.locator('option[value="41"]').textContent(), /外部不存在（只读确认）/);
    // isDisabled retargets options inside a label to the enabled select.
    assert.equal(await pick.locator('option[value="41"]').evaluate(option => option.disabled && option.matches(':disabled')), true);
    await pick.focus(); await pick.press('End');
    assert.equal(await pick.inputValue(), '');
    const identity = { entryId: '11111111-1111-4111-8111-111111111111', recordId: '41', target: 'fixture/creator', inspectCurrent: true };
    assert.deepEqual(await page.evaluate(() => window.calls), [['absence', identity], ['listRecords'],
      ['absence', identity], ['absence', identity], ['listRecords']]);
    assert.equal(await page.evaluate(() => operator), null); assert.equal(await page.evaluate(() => safetyConfirmed), false);
    assert.equal(requests, 0); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('owned absence: exact verified selection is readonly in either non-create mode without operator or write approval', async () => {
  for (const mode of ['delete', 'update']) {
    const h = ownedAbsenceHarness(); h.evaluate(`action='${mode}';`); const original = h.evaluate('JSON.stringify(records)');
    const root = h.render(), verify = byText(root, '核对云端是否已删除');
    assert.ok(verify); assert.equal(verify.disabled, false);
    verify.handlers.click(); await new Promise(setImmediate);
    assert.deepEqual(h.calls, [['absence', absenceIdentity(h)], ['listRecords']]);
    assert.equal(h.evaluate('plan'), null); assert.equal(h.evaluate('recordId'), '41');
    assert.equal(h.evaluate('JSON.stringify(records)'), original);
    assert.match(walk(h.render()).map(n => n.textContent || '').join('\n'), /云端记录仍存在.*保护.*不变/);
    assert.equal(h.evaluate('safetyConfirmed'), false); assert.equal(h.evaluate('operator'), null);
  }
});
test('owned absence: confirmed external absence refreshes retirement, invalidates old delete and retains history identity', async () => {
  const h = ownedAbsenceHarness();
  h.evaluate(`safetyConfirmed=true;cloudHistory=[{target:'project/creator',creatorName:'Submitted Fixture',account:'001234',
    maintainerName:'Original Owner',name:${JSON.stringify(h.record.name)},batch:'AI_TEST_fixture',status:'verified',
    result:{entryId:${JSON.stringify(h.record.entryId)},recordId:'41',status:'verified'}}];`);
  const root = h.render(), staleDelete = byText(root, '确认删除该测试记录');
  h.api.verifyOwnedAbsence = async payload => {
    assert.equal(h.evaluate('plan'), null); h.calls.push(['absence', structuredClone(payload)]);
    h.record.status = 'deleted'; h.record.externalAbsenceVerified = true;
    return { ok: true, ...payload, exists: false, status: 'deleted', externalAbsenceVerified: true };
  };
  byText(root, '核对云端是否已删除').handlers.click(); await new Promise(setImmediate);
  staleDelete.handlers.click(); await new Promise(setImmediate);
  const after = h.render(), text = walk(after).map(n => n.textContent || '').join('\n');
  assert.match(text, /只读确认外部不存在，未再次发送删除/);
  assert.match(text, /外部不存在（只读确认）/); assert.doesNotMatch(text, /本软件已清理|已清理 ·/);
  assert.equal(h.evaluate('recordId'), ''); assert.equal(h.evaluate('plan'), null);
  assert.equal(h.evaluate('cloudHistory[0].creatorName'), 'Submitted Fixture');
  assert.equal(h.evaluate('cloudHistory[0].account'), '001234'); assert.equal(h.evaluate('cloudHistory[0].maintainerName'), 'Original Owner');
  assert.equal(h.evaluate('cloudHistory[0].status'), 'deleted'); assert.equal(h.evaluate('cloudHistory[0].result.externalAbsenceVerified'), true);
  assert.deepEqual(h.calls, [['absence', absenceIdentity(h)], ['listRecords']]);
});
test('owned absence: errors and incomplete absence evidence never retire a record or enable mutation', async () => {
  for (const response of [{ ok: false, code: 'FEISHU_API_ERROR', apiCode: 10301 }, 'throw',
    { ok: true, exists: false, status: 'deleted' }, { ok: true, exists: false, status: 'deleted', externalAbsenceVerified: 'true' }]) {
    const h = ownedAbsenceHarness(), original = h.evaluate('JSON.stringify(records)');
    h.api.verifyOwnedAbsence = async payload => {
      h.calls.push(['absence', structuredClone(payload)]);
      if (response === 'throw') throw new Error('fixture readonly failure');
      return { ...payload, ...response };
    };
    const verify = byText(h.render(), '核对云端是否已删除'); assert.ok(verify); verify.handlers.click(); await new Promise(setImmediate);
    assert.equal(h.evaluate('plan'), null); assert.equal(h.evaluate('JSON.stringify(records)'), original);
    assert.equal(h.evaluate('recordId'), '41'); assert.equal(h.evaluate('safetyConfirmed'), false);
    assert.doesNotMatch(walk(h.render()).map(n => n.textContent || '').join('\n'), /只读确认外部不存在|外部不存在（只读确认）/);
    assert.deepEqual(h.calls, [['absence', absenceIdentity(h)]]);
  }
});
test('owned absence: unavailable API, create, unknown, duplicate identities and other targets cannot use the absence route', async () => {
  for (const kind of ['api', 'create', 'unknown', 'unselected', 'duplicate', 'target']) {
    const h = ownedAbsenceHarness(kind === 'unknown' ? 'unknown' : 'verified', kind === 'target' ? 'other/creator' : 'project/creator');
    if (kind === 'api') delete h.api.verifyOwnedAbsence;
    if (kind === 'create') h.evaluate("action='create';");
    if (kind === 'unselected') h.evaluate("recordId='';");
    if (kind === 'duplicate') h.evaluate('records.push({...records[0],entryId:\'22222222-2222-4222-8222-222222222222\'});');
    const root = h.render(); assert.equal(byText(root, '核对云端是否已删除'), undefined, kind);
    if (kind === 'unknown') {
      h.api.reconcile = async p => { h.calls.push(['reconcile', p.entryId]); return { ok: true, status: 'unknown', recordId: '41' }; };
      byText(root, '只读核对结果').handlers.click(); await new Promise(setImmediate);
      assert.deepEqual(h.calls, [['reconcile', h.record.entryId], ['listRecords']]);
    } else assert.deepEqual(h.calls, []);
  }
});
test('owned absence: history refresh synchronizes precise external retirement without mutation', async () => {
  const h = ownedAbsenceHarness('unknown');
  h.evaluate(`cloudHistory=[{target:'project/creator',creatorName:'Original Fixture',account:'001234',
    maintainerName:'Original Owner',name:${JSON.stringify(h.record.name)},batch:'AI_TEST_fixture',status:'unknown',
    result:{entryId:${JSON.stringify(h.record.entryId)},recordId:'41',status:'unknown'}}];`);
  h.record.status = 'deleted'; h.record.externalAbsenceVerified = true;
  byText(h.render(), '刷新提交结果').handlers.click(); await new Promise(setImmediate);
  assert.equal(h.evaluate('records[0].status'), 'deleted');
  assert.equal(h.evaluate('cloudHistory[0].status'), 'deleted');
  assert.match(walk(h.render()).map(n => n.textContent || '').join('\n'), /外部不存在（只读确认）/);
  assert.deepEqual(h.calls, [['listRecords']]);
});
test('owned absence: editing connection disables the current DOM button before rerender', async () => {
  const h = ownedAbsenceHarness(), root = h.render();
  const verify = byText(root, '核对云端是否已删除');
  assert.equal(verify.disabled, false);
  const keyInput = byLabel(root, '项目 Key');
  keyInput.value = 'edited-fixture'; keyInput.handlers.input();
  assert.equal(h.evaluate('configDirty'), true);
  assert.equal(verify.disabled, true);
  verify.handlers.click(); await new Promise(setImmediate);
  assert.deepEqual(h.calls, []);
});
test('owned absence: busy/config dirty disable the button and stale handlers cannot issue a request', async () => {
  for (const state of ['busy', 'configDirty']) {
    const h = ownedAbsenceHarness(), stale = byText(h.render(), '核对云端是否已删除'); assert.ok(stale);
    h.evaluate(`${state}=true;`);
    assert.equal(byText(h.render(), '核对云端是否已删除').disabled, true);
    stale.handlers.click(); await new Promise(setImmediate); assert.deepEqual(h.calls, []);
  }
});
test('owned absence: response identity and target must match the exact readonly request', async () => {
  for (const wrong of [{ target: 'other/creator' }, { recordId: '42' }, { entryId: 'other-entry' }]) {
    const h = ownedAbsenceHarness(), original = h.evaluate('JSON.stringify(records)');
    h.api.verifyOwnedAbsence = async payload => { h.calls.push(['absence', structuredClone(payload)]); return {
      ok: true, ...payload, ...wrong, exists: false, status: 'deleted', externalAbsenceVerified: true
    }; };
    const verify = byText(h.render(), '核对云端是否已删除'); assert.ok(verify); verify.handlers.click(); await new Promise(setImmediate);
    assert.equal(h.evaluate('JSON.stringify(records)'), original); assert.equal(h.evaluate('recordId'), '41');
    assert.match(h.evaluate('message'), /FEISHU_READBACK_INVALID/);
    assert.deepEqual(h.calls, [['absence', absenceIdentity(h)]]);
  }
});
test('owned absence: late readonly responses cannot affect a different selection, run or connection', async () => {
  for (const change of ['selection', 'run', 'target', 'config']) {
    const h = ownedAbsenceHarness(); let finish;
    h.api.verifyOwnedAbsence = p => { h.calls.push(['absence', structuredClone(p)]); return new Promise(resolve => { finish = resolve; }); };
    const verify = byText(h.render(), '核对云端是否已删除'); assert.ok(verify); verify.handlers.click(); await new Promise(setImmediate);
    if (change === 'selection') h.evaluate("recordId='42';");
    if (change === 'run') { h.ctx.runDir = 'other-run'; h.render(); }
    if (change === 'target') h.evaluate("connection={...connection,target:'other/creator'};");
    if (change === 'config') h.evaluate('configDirty=true;');
    finish({ ok: true, ...absenceIdentity(h), exists: false, status: 'deleted', externalAbsenceVerified: true });
    await new Promise(setImmediate);
    assert.doesNotMatch(h.evaluate('message'), /只读确认外部不存在/);
    assert.equal(h.evaluate('records.some(r=>r.externalAbsenceVerified===true)'), false);
    assert.deepEqual(h.calls, [['absence', absenceIdentity(h)]]);
  }
});
test('owned absence: list refresh clears retired selection and labels external versus tool cleanup honestly in history', async () => {
  for (const external of [true, false]) {
    const h = ownedAbsenceHarness();
    h.evaluate(`cloudHistory=[{target:'project/creator',creatorName:'Original',account:'001234',maintainerName:'Original Owner',
      name:${JSON.stringify(h.record.name)},batch:'AI_TEST_fixture',status:'verified',
      result:{entryId:${JSON.stringify(h.record.entryId)},recordId:'41',status:'verified'}}];`);
    h.record.status = 'deleted'; h.record.externalAbsenceVerified = external;
    byText(h.render(), '刷新本软件创建清单').handlers.click(); await new Promise(setImmediate);
    const text = walk(h.render()).map(n => n.textContent || '').join('\n');
    assert.equal(h.evaluate('recordId'), ''); assert.equal(h.evaluate('plan'), null);
    assert.match(text, external ? /外部不存在（只读确认）/ : /本软件已清理/);
    assert.doesNotMatch(text, external ? /本软件已清理/ : /外部不存在（只读确认）/);
    assert.equal(h.evaluate('cloudHistory[0].maintainerName'), 'Original Owner');
    assert.equal(h.evaluate('cloudHistory[0].status'), 'deleted'); assert.deepEqual(h.calls, [['listRecords']]);
  }
});
