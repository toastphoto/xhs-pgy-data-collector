// Run with Playwright available in NODE_PATH. All PGY pages below are local fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pgy-invite-flow-'));
const reportPath = path.join(userData, 'result.json');
let electronApp;
const outcomes = [];
const rendererErrors = [];
(async () => {
  const executablePath = process.env.PGY_APP_EXE || require('electron').trim();
  const args = [`--user-data-dir=${userData}`, '--host-resolver-rules=MAP * ~NOTFOUND'];
  if (!process.env.PGY_APP_EXE) args.unshift(path.resolve(__dirname, '..'));
  const env = { ...process.env, ELECTRON_START_BACKEND: 'false' };
  delete env.ELECTRON_RUN_AS_NODE;
  electronApp = await _electron.launch({ executablePath, args, env, timeout: 30000 });
  // BrowserViews also appear as Playwright pages; select the renderer explicitly.
  let page;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    page = electronApp.windows().find(window => window.url().includes('/renderer/index.html'));
    if (page) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page, 'Main renderer window did not load');
  page.on('pageerror', error => { rendererErrors.push(error.message); console.error('Renderer error:', error.message); });
  try {
    await page.waitForSelector('#splitterMain[aria-valuenow]');
  } catch (error) {
    console.error('Window diagnostics:', await page.evaluate(() => ({ url: location.href, text: document.body?.innerText?.slice(0, 500), splitter: document.querySelector('#splitterMain')?.outerHTML })));
    throw error;
  }
  const appInfo = await electronApp.evaluate(({ app }) => ({ userData: app.getPath('userData'), version: app.getVersion() }));
  assert.equal(path.resolve(appInfo.userData), path.resolve(userData), 'Only the isolated test profile may be used');
  const runDir = path.join(userData, 'runs', 'run_local_invite_fixture');
  for (const id of ['EXAMPLE01', 'EXAMPLE02', 'EXAMPLE03']) {
    const dir = path.join(runDir, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'raw_result.json'), JSON.stringify({ platform: 'pgy', creator_url: `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${id}`, creator_summary: { creator_name: id } }));
  }
  const { getContactPreview } = require('../lib/contact_sheet');
  const setup = { runDir, rows: getContactPreview(runDir).rows, version: appInfo.version };
  const intercepted = await electronApp.evaluate(({ app, session }, brandSearchTest) => {
    globalThis.fixtureNavigations = [];
    globalThis.fixtureErrors = [];
    globalThis.fixtureBrandSteps = [];
    app.on('web-contents-created', (_event, contents) => {
      const execute = contents.executeJavaScript.bind(contents);
      contents.executeJavaScript = async (...args) => {
        const result = await execute(...args);
        if (args[0]?.includes('async function preparePgyInviteDetailFormInPage')) globalThis.fixtureBrandSteps.push(result);
        return result;
      };
      contents.on('console-message', (_event, level, message) => {
        if (level >= 2) globalThis.fixtureErrors.push(message);
      });
      for (const name of ['did-start-navigation', 'did-navigate', 'did-navigate-in-page', 'did-finish-load', 'did-stop-loading']) {
        contents.on(name, (...args) => globalThis.fixtureNavigations.push({ event: name, args: args.slice(1), url: contents.getURL(), loading: contents.isLoadingMainFrame() }));
      }
    });
    const style = '<style>body{margin:25px;font:16px sans-serif}.row{display:flex;gap:20px;margin:30px 0;min-height:40px}.row>label{width:130px}input,textarea,[role=combobox]{padding:10px;width:220px}button{padding:12px}.radio input{width:20px}.dates{display:flex;gap:20px}</style>';
    const brandControl = brandSearchTest ? `<div role="combobox"><span id="selectedBrand">Example Brand</span><input id="brandSearch" readonly placeholder="请选择报备品牌">
      <div role="listbox" id="brandChoices" hidden style="position:fixed;top:160px;left:120px;background:white;z-index:99"></div></div>
      <script>{const input=document.querySelector('#brandSearch'),list=document.querySelector('#brandChoices');
        input.onclick=()=>{input.readOnly=false;input.placeholder='请输入品牌名称/ID搜索';list.hidden=false;};
        input.oninput=()=>{clearTimeout(window.brandTimer);window.brandTimer=setTimeout(()=>{
          list.replaceChildren();for(const label of ['Example Brand','Example Brand Plus']){
            const option=document.createElement('div');option.setAttribute('role','option');option.textContent=label;
            option.onclick=()=>{window.fixtureBrandSelections=(window.fixtureBrandSelections||0)+1;document.querySelector('#selectedBrand').textContent=label;list.hidden=true;input.value='';input.readOnly=true;};
            list.appendChild(option);
          }
        },2000);};
      }</script>`
      : '<div role="combobox"><span>Example Brand</span><input readonly placeholder="请选择报备品牌"></div>';
    return session.fromPartition('persist:pgy_invite').protocol.interceptStringProtocol('https', (request, callback) => {
      const url = new URL(request.url);
      if (url.hostname !== 'pgy.xiaohongshu.com') return callback({ error: -6 });
      const id = url.pathname.split('/').pop();
      const html = url.pathname.includes('blogger-detail')
        ? `<button onclick="document.querySelector('[role=dialog]').hidden=false">邀约</button><div role="dialog" hidden>
            <label class="radio"><input type="radio" checked>笔记合作</label><span>直播合作</span>
            <label class="radio"><input type="radio" checked>定制合作</label><label class="radio"><input type="radio" checked>线上邀约</label>
            <button onclick="const departing = new window.URL(window.location.href);
              departing.searchParams.set('entryCleanup', 'ready');
              window.history.replaceState({}, '', departing.href);
              window.open('/solar/pre-trade/invite-form?id=${id}', '_blank')">发起邀约</button></div>`
        : url.pathname.includes('invite-form') ? `
          <div class="row"><label>品牌名 *</label>${brandControl}</div>
          <div class="row"><label>联系方式 *</label><div><label class="radio"><input type="radio" checked>微信</label><input placeholder="请输入"></div></div>
          <div class="row"><label>产品名称 *</label><input placeholder="请输入产品名称"></div>
          <div class="row"><label>合作内容介绍 *</label><textarea></textarea></div>
          <div class="row"><label>期望发布时间 *</label><div class="dates"><input placeholder="开始日期"><input placeholder="结束日期"></div></div>
          <div style="height:600px"></div><button onclick="window.fixtureSends=(window.fixtureSends||0)+1;document.querySelector('#result').textContent='邀约成功'">发起邀约</button><div id="result" role="status"></div>`
        : '<p>Local account fixture</p>';
      const hasRoutingBootstrap = url.pathname.includes('blogger-detail') || url.pathname.includes('invite-form');
      const bootstrap = `<script>window.fixtureClicks=[];document.addEventListener('click',event=>window.fixtureClicks.push({tag:event.target.tagName,text:event.target.textContent,x:event.clientX,y:event.clientY}),true);addEventListener('load', () => setTimeout(() => {
        window.fixtureInit = 'ready';
        if (${hasRoutingBootstrap}) {
          const target = new URL(location.href);
          target.searchParams.set('fixtureInit', 'ready');
          history.replaceState({ initialized: true }, '', target.href);
        }
      }, 150));</script>`;
      const response = { mimeType: 'text/html', charset: 'utf-8', data: `<!doctype html><meta charset="utf-8">${style}<div class="avatar">Local fixture</div>${html}${bootstrap}` };
      if (url.pathname.includes('invite-form') || url.pathname.includes('blogger-detail')) {
        setTimeout(() => callback(response), 400);
      } else callback(response);
    });
  }, process.env.PGY_BRAND_SEARCH_TEST === '1');
  assert.equal(intercepted, true, 'PGY HTTPS must be intercepted before any navigation');
  assert.equal(setup.version, process.env.PGY_EXPECT_VERSION || require('../package.json').version);
  assert.equal(setup.rows.length, 3);
  const account = await page.evaluate(() => window.desktopAPI.invites.openAccount());
  assert.equal(account.ok, true, JSON.stringify(account));
  if (process.env.PGY_VIEW_LIFECYCLE_TEST === '1') {
    const lifecycle = [];
    await electronApp.evaluate(({ session }) => session.fromPartition('persist:pgy_default').protocol
      .interceptStringProtocol('https', (_request, reply) => reply({ mimeType: 'text/html', data: '<p>Isolated background fixture</p>' })));
    for (let cycle = 0; cycle < 6; cycle += 1) {
      const opened = await page.evaluate(url => window.desktopAPI.contacts.openPgyCreator(url),
        'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/EXAMPLE_BACKGROUND');
      assert.equal(opened.ok, true, JSON.stringify(opened));
      const background = await electronApp.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/renderer/index.html'));
        const view = win.getBrowserViews().find(v => v.webContents?.getURL().includes('EXAMPLE_BACKGROUND'));
        const contents = view.webContents;
        contents.destroy();
        await new Promise(resolve => setTimeout(resolve, 50));
        let oldGuardThrows = false;
        try { view.webContents.isDestroyed(); } catch (_) { oldGuardThrows = true; }
        return { missingContents: !view.webContents, oldGuardThrows, destroyed: contents.isDestroyed() };
      });
      assert.equal(background.missingContents, true, 'Real Electron removes the destroyed view contents');
      assert.equal(background.oldGuardThrows, true, 'The previous layout guard reproduces the screenshot TypeError');
      assert.equal((await page.evaluate(() => window.desktopAPI.browser.activateTab('pgy-invite'))).ok, true);
      assert.equal((await page.evaluate(() => window.desktopAPI.browser.closeTab('pgy-invite'))).ok, true);
      assert.equal((await page.evaluate(() => window.desktopAPI.invites.openAccount())).ok, true);
      lifecycle.push({ cycle, ...background, inviteRecreated: true, backgroundActivation: true });
    }
    const consoleBefore = await page.locator('#console').evaluate(el => ({ width: el.getBoundingClientRect().width, children: el.children.length }));
    await page.evaluate(() => {
      for (let n = 0; n < 3; n += 1) window.__renderAppError(new Error('Isolated runtime test ' + n));
    });
    assert.equal(await page.locator('#runtimeErrorNotice').count(), 1);
    assert.deepEqual(await page.locator('#console').evaluate(el => ({ width: el.getBoundingClientRect().width, children: el.children.length })), consoleBefore);
    assert.match(await page.locator('#runtimeErrorNotice').innerText(), /Isolated runtime test 2/);
    await page.screenshot({ path: path.join(userData, 'runtime-error-contained.png') });
    await page.getByRole('button', { name: '关闭错误提示', exact: true }).click();
    assert.equal(await page.locator('#runtimeErrorNotice').count(), 0);
    outcomes.push({ lifecycle, runtimeErrors: { deduplicated: true, layoutUnchanged: true, dismissible: true } });
  }
  const template = { brandName: 'Example Brand', productName: 'Example product', contactWay: 'example_contact', intro: 'Example cooperation', contactChannel: '微信', publishStart: '2026-09-08', publishEnd: '2026-10-31' };
  for (const row of setup.rows) {
    const payload = { runDir: setup.runDir, rowId: row.rowId };
    if (row === setup.rows[0]) {
      await electronApp.evaluate(async ({webContents})=>{
        const contents=webContents.getAllWebContents().find(w=>w.getURL().includes('/note/kol'));
        await contents.executeJavaScript(`setTimeout(()=>{
          const departing=new URL(location.href);departing.searchParams.set('accountCleanup','ready');
          history.replaceState({},'',departing.href);
        },100);true`);
      });
    } else {
      await electronApp.evaluate(async ({ webContents }) => {
        const contents = webContents.getAllWebContents().find(w => w.getURL().includes('/invite-form?'));
        await contents.executeJavaScript(`window.fixtureDepartingTimer=setTimeout(() => {
          const departing = new URL(location.href);
          departing.searchParams.set('lateCleanup', 'ready');
          history.replaceState({}, '', departing.href);
        }, 100); true`);
      });
    }
    if (row === setup.rows[1]) {
      await electronApp.evaluate(({ webContents }) => {
        const content = webContents.getAllWebContents().find(w => w.getURL().includes('/invite-form?'));
        const originalLoad = content.loadURL.bind(content);
        content.loadURL = async (url, ...options) => {
          content.loadURL = originalLoad;
          await content.executeJavaScript(`clearTimeout(window.fixtureDepartingTimer);
            const departing=new URL(location.href);departing.searchParams.set('lateCleanup','ready');
            history.replaceState({},'',departing.href);
            history.replaceState({}, '', ${JSON.stringify(url)}); true`);
        };
      });
    }
    if (row === setup.rows[2]) {
      await electronApp.evaluate(({webContents})=>{
        const content=webContents.getAllWebContents().find(w=>w.getURL().includes('/invite-form?'));
        const originalLoad=content.loadURL.bind(content);
        content.loadURL=(url,...options)=>{
          content.loadURL=originalLoad;
          originalLoad(url,...options).catch(error=>{globalThis.fixtureErrors.push(error.message);});
          globalThis.fixtureEarlyLoadResolved=true;
          return Promise.resolve();
        };
      });
    }
    const opened = await page.evaluate(p => window.desktopAPI.invites.openCreator(p), payload);
    assert.equal(opened.ok, true, JSON.stringify(opened));
    if (row === setup.rows[1]) assert.equal(opened.documentReloaded, true, 'Missing commit needs one actual document reload');
    if (row === setup.rows[2]) {
      assert.equal(await electronApp.evaluate(()=>globalThis.fixtureEarlyLoadResolved),true);
      assert.notEqual(opened.documentReloaded,true,'A pending real document commit must not be interrupted by reload');
    }
    const prepared = await page.evaluate(p => window.desktopAPI.invites.prepare(p), { ...payload, template });
    assert.equal(prepared.ok, true, JSON.stringify(prepared));
    assert.equal(prepared.readyToSend, true);
    if (process.env.PGY_BRAND_PREPARE_SMOKE === '1') {
      const brand = await electronApp.evaluate(async ({ webContents }) => {
        const form = webContents.getAllWebContents().find(w => w.getURL().includes('/invite-form?'));
        return form.executeJavaScript('({selected:document.querySelector("#selectedBrand").textContent,clicks:window.fixtureBrandSelections||0,sends:window.fixtureSends||0,events:window.fixtureClicks})');
      });
      assert.equal(brand.clicks, 1, JSON.stringify(brand));
      assert.equal(brand.selected, 'Example Brand');
      assert.equal(brand.sends, 0);
      fs.writeFileSync(reportPath, JSON.stringify({ok:true,version:setup.version,localOnly:true,scope:'single brand prepare smoke only',brand},null,2));
      return;
    }
    const entryCleanupCount = await electronApp.evaluate(() => globalThis.fixtureNavigations
      .filter(n => n.event === 'did-navigate-in-page' && n.url.includes('entryCleanup=ready')).length);
    assert.ok(entryCleanupCount >= 1, 'The form handoff must exercise a real departing-page event');
    const sent = await page.evaluate(p => window.desktopAPI.invites.sendPrepared(p), { ...payload, token: prepared.token, fingerprint: prepared.fingerprint });
    assert.equal(sent.ok, true, JSON.stringify(sent));
    assert.equal(sent.outcome, 'success-confirmed');
    const replay = await page.evaluate(p => window.desktopAPI.invites.sendPrepared(p), { ...payload, token: prepared.token, fingerprint: prepared.fingerprint });
    assert.equal(replay.ok, false);
    const counts = await electronApp.evaluate(async ({ webContents }) => {
      const content = webContents.getAllWebContents().find(w => w.getURL().includes('/invite-form?'));
      return content.executeJavaScript('window.fixtureSends');
    });
    assert.equal(counts, 1);
    outcomes.push({ creator: row.creatorName, prepared: true, localClicks: counts, replayRejected: true,
      ...(row===setup.rows[2]?{earlyLoadResolution:true}:{} ) });
  }
  const seeded = await page.evaluate(p => window.desktopAPI.exports.saveContactReview(p), {
    runDir, reviewRows: setup.rows.map(row => ({ rowId: row.rowId, selected: true, contactChannel: '蒲公英邀约' })),
    settings: { selectionPolicy: 'manual_opt_in_v1', composerMethod: '蒲公英邀约', contactChannel: '蒲公英邀约',
      pgyBrandName: process.env.PGY_BRAND_SEARCH_TEST === '1' ? 'Example' : template.brandName,
      pgyProductName: template.productName, pgyContactWay: template.contactWay,
      pgyIntro: template.intro, pgyPublishStart: template.publishStart, pgyPublishEnd: template.publishEnd }
  });
  assert.equal(seeded.ok, true);
  await page.evaluate(async selectedRunDir => {
    // Confirmations target intercepted local fixtures only, never production recipients.
    window.fixtureConfirmations = [];
    window.confirm = message => { window.fixtureConfirmations.push(message); return true; };
    const { store } = await import('./state/store.js');
    store.set({ view: 'exports', exports: { selectedRunDir } });
  }, runDir);
  const batch = page.locator('.pgy-invite-batch-panel');
  await page.waitForFunction(() => document.querySelectorAll('.contact-review-card').length === 3);
  const selectedBeforeUnsent = await page.locator('.contact-review-card input[type=checkbox]').evaluateAll(inputs => inputs.map(input => input.checked));
  await page.getByRole('button', { name: '蒲公英批量邀约（3）', exact: true }).click();
  if (process.env.PGY_BRAND_SEARCH_TEST === '1') {
    await page.locator('.pgy-invite-batch-panel.awaiting_brand').waitFor({timeout:40000});
    const choices=batch.getByRole('combobox',{name:'选择报备品牌',exact:true});
    assert.deepEqual(await choices.locator('option').allTextContents(),['请选择正确的报备品牌','Example Brand','Example Brand Plus']);
    assert.equal(await batch.getByRole('button',{name:'使用此品牌并继续',exact:true}).isDisabled(),true);
    await choices.selectOption({label:'Example Brand'});
    await batch.getByRole('button',{name:'使用此品牌并继续',exact:true}).click();
    outcomes.push({brandChoice:true,delayedSearchMs:2000,canonical:'Example Brand',sameBatch:true});
  }
  for (const [index, row] of setup.rows.entries()) {
    await page.locator('.pgy-invite-batch-panel.awaiting_confirmation').waitFor({ timeout: 40000 });
    const unsent = await electronApp.evaluate(async ({webContents}) => {
      const content=webContents.getAllWebContents().find(w=>w.getURL().includes('/invite-form?'));
      return {url:content.getURL(),clicks:await content.executeJavaScript('window.fixtureSends || 0')};
    });
    assert.equal(new URL(unsent.url).searchParams.get('id'),row.creatorUrl.split('/').pop());
    assert.equal(unsent.clicks,0,'Unsent preparation must never dispatch send');
    assert.match(await batch.innerText(),new RegExp(`已处理 ${index}/3`));
    await page.getByRole('button',{
      name:index===setup.rows.length-1?'不发送，完成本批准备':'不发送，准备下一位',exact:true
    }).click();
    await page.locator(index===setup.rows.length-1?'.pgy-invite-batch-panel.completed':'.pgy-invite-batch-panel.cooldown').waitFor();
  }
  assert.match(await batch.innerText(),/明确成功 0 位.*已准备未发送 3 位/);
  assert.equal((await page.evaluate(()=>window.fixtureConfirmations)).length,1,'One batch start, no per-recipient send confirmations or restarts');
  assert.deepEqual(await page.locator('.contact-review-card input[type=checkbox]').evaluateAll(inputs=>inputs.map(input=>input.checked)),selectedBeforeUnsent);
  assert.equal(await page.locator('.contact-review-list').innerText().then(text=>text.includes('已建联')),false);
  outcomes.push({rendererUnsentBatch:true,prepared:3,localClicks:0,startConfirmations:1,selectionPreserved:true,completed:true});
  await page.screenshot({path:path.join(userData,'batch-unsent-completed.png')});
  await page.getByRole('button', { name: '蒲公英批量邀约（3）', exact: true }).click();
  for (const [index, row] of setup.rows.entries()) {
    await page.locator('.pgy-invite-batch-panel.awaiting_confirmation').waitFor({ timeout: 40000 });
    const beforeSend = await electronApp.evaluate(async ({ webContents }) => {
      const contents = webContents.getAllWebContents().find(w => w.getURL().includes('/invite-form?'));
      return { url: contents.getURL(), clicks: await contents.executeJavaScript('window.fixtureSends || 0') };
    });
    assert.equal(new URL(beforeSend.url).searchParams.get('id'), row.creatorUrl.split('/').pop());
    assert.equal(beforeSend.clicks, 0, 'Preparation cannot send');
    assert.equal(await page.getByRole('button', { name: '打开邀约账号', exact: true }).isDisabled(), true);
    if (index === 0) {
      await electronApp.evaluate(({ webContents }, target) => {
        const content = webContents.getAllWebContents().find(w => w.getURL().includes('/invite-form?'));
        const originalLoad = content.loadURL.bind(content);
        content.loadURL = async (url, ...options) => {
          if (url !== target) return originalLoad(url, ...options);
          content.loadURL = originalLoad;
          globalThis.fixtureBatchRecoveryInjected = true;
          await content.executeJavaScript(`history.replaceState({}, '', ${JSON.stringify(url)}); true`);
        };
      }, setup.rows[1].creatorUrl);
    }
    await page.getByRole('button', { name: '人工确认发送当前达人', exact: true }).click();
    await page.locator(index === setup.rows.length - 1 ? '.pgy-invite-batch-panel.completed' : '.pgy-invite-batch-panel.cooldown').waitFor({ timeout: 20000 });
    const clicks = await electronApp.evaluate(async ({ webContents }) => {
      const contents = webContents.getAllWebContents().find(w => w.getURL().includes('/invite-form?'));
      return contents.executeJavaScript('window.fixtureSends || 0');
    });
    assert.equal(clicks, 1);
  }
  const confirmations = await page.evaluate(() => window.fixtureConfirmations);
  assert.equal(confirmations.length, 5, 'Two batch approvals (one unsent) and one send confirmation per creator');
  assert.match(await batch.innerText(), /明确成功 3 位/);
  assert.equal(await electronApp.evaluate(() => globalThis.fixtureBatchRecoveryInjected), true);
  outcomes.push({ rendererBatch: true, prepared: 3, confirmed: 3, localClicks: 3, completed: true, missingCommitRecovery: true });
  await page.screenshot({ path: path.join(userData, 'batch-completed.png') });
  let reviewScroll = null;
  if (process.env.PGY_REVIEW_SCROLL_TEST === '1') {
    const scrollRun = path.join(userData, 'runs', 'run_local_scroll_fixture');
    for (let i = 0; i < 100; i++) {
      const id = `SCROLL${i}`, dir = path.join(scrollRun, id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'raw_result.json'), JSON.stringify({ platform: 'pgy',
        creator_url: `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${id}`, creator_summary: { creator_name: id } }));
    }
    const saved = await page.evaluate(p => window.desktopAPI.exports.saveContactReview(p), {
      runDir: scrollRun, reviewRows: [], settings: { selectionPolicy:'manual_opt_in_v1', composerMethod:'蒲公英邀约',
        pgyBrandName:template.brandName,pgyProductName:template.productName,pgyContactWay:template.contactWay,
        pgyIntro:template.intro,pgyPublishStart:template.publishStart,pgyPublishEnd:template.publishEnd }
    });
    assert.equal(saved.ok, true);
    await page.evaluate(async selectedRunDir => {
      const { store } = await import('./state/store.js');
      store.set({ view:'exports', exports:{ selectedRunDir } });
    }, scrollRun);
    await page.waitForFunction(() => document.querySelectorAll('.contact-review-card').length === 100);
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    await page.locator('.contact-review-list').evaluate(list => {
      const card = [...list.children].find(c => c.querySelector('.contact-review-name')?.textContent === 'SCROLL45');
      list.scrollTop += card.getBoundingClientRect().top - list.getBoundingClientRect().top - 20;
      const content = document.querySelector('#content');
      content.scrollTop += list.getBoundingClientRect().top - content.getBoundingClientRect().top - 40;
    });
    await settle();
    const observe = () => page.evaluate(() => {
      const list = document.querySelector('.contact-review-list'), rect = list.getBoundingClientRect();
      const first = [...list.children].find(c => c.getBoundingClientRect().bottom > rect.top);
      return { top:list.scrollTop,max:list.scrollHeight-list.clientHeight,outer:document.querySelector('#content').scrollTop,
        first:first?.dataset.reviewRowId,firstY:first?.getBoundingClientRect().top-rect.top };
    });
    const scrollBefore = await observe();
    const confirmationsBeforeScroll = (await page.evaluate(()=>window.fixtureConfirmations)).length;
    assert.ok(scrollBefore.top > 1000 && scrollBefore.top < scrollBefore.max - 1000);
    const target = page.locator('.contact-review-card').filter({has:page.getByText('SCROLL45',{exact:true})});
    await target.getByRole('button',{name:'准备邀约',exact:true}).click();
    await target.locator('.pgy-invite-row-status.ready').waitFor({timeout:40000}); await settle();
    const scrollAfter = await observe();
    assert.equal(scrollAfter.first,scrollBefore.first);
    assert.ok(Math.abs(scrollAfter.firstY-scrollBefore.firstY)<1,JSON.stringify({scrollBefore,scrollAfter}));
    assert.ok(Math.abs(scrollAfter.outer-scrollBefore.outer)<1,'Native preparation must preserve the outer workbench');
    const unsent = await electronApp.evaluate(async ({webContents}) => {
      const contents=webContents.getAllWebContents().find(w=>w.getURL().includes('/invite-form?'));
      return contents.executeJavaScript('window.fixtureSends || 0');
    });
    assert.equal(unsent,0);
    assert.equal((await page.evaluate(()=>window.fixtureConfirmations)).length,confirmationsBeforeScroll,'Single prepare cannot add a send confirmation');
    reviewScroll = { rows:100,before:scrollBefore,after:scrollAfter,prepared:true,localClicks:0 };
    await page.screenshot({path:path.join(userData,'scroll-prepared.png')});
    if(process.env.PGY_COMPOSER_INPUT_TEST==='1') {
      const intro=page.getByLabel('本次合作内容介绍',{exact:true});
      await intro.fill('');await intro.evaluate(node=>{window.nativeTypingNode=node;});
      await intro.pressSequentially('native typing survives',{delay:600});
      assert.equal(await intro.inputValue(),'native typing survives');
      assert.equal(await intro.evaluate(node=>node===window.nativeTypingNode&&node===document.activeElement),true);
      await page.waitForFunction(()=>document.querySelector('[data-contact-save-status]')?.textContent.includes('已保存'));
      const saved=await page.evaluate(runDir=>window.desktopAPI.exports.loadContactReview({runDir}),scrollRun);
      assert.equal(saved.settings.pgyIntro,'native typing survives');
      assert.equal(await page.locator('.contact-pgy-action.send').count(),0,'Typing invalidates the previous preparation');
      assert.equal(await page.evaluate(()=>{
        const work=document.querySelector('.export-workbench'),feishu=document.querySelector('.feishu-workbench');
        return !!(work.compareDocumentPosition(feishu)&Node.DOCUMENT_POSITION_FOLLOWING);
      }),true);
      outcomes.push({composerTyping:true,persisted:true,focusPreserved:true,feishuAfterInvitation:true});
      await page.screenshot({path:path.join(userData,'composer-typing.png')});
      const manager=page.locator('.outreach-template-manager').filter({has:intro});
      const original=await manager.locator('.outreach-template-choice').first().textContent();
      const originalCount=await manager.locator('.outreach-template-choice').count();
      await manager.getByRole('button',{name:'新增模板',exact:true}).click();
      assert.equal(await manager.getByLabel('模板名称',{exact:true}).inputValue(),'新模板');
      await manager.getByLabel('模板名称',{exact:true}).fill('AI local template fixture');
      await intro.fill('Unsent local template fixture');
      await manager.getByRole('button',{name:'保存到当前模板',exact:true}).click();
      await manager.getByRole('button',{name:'另存为新模板',exact:true}).click();
      assert.equal(await manager.locator('.outreach-template-choice').count(),originalCount+2);
      assert.equal(await intro.inputValue(),'Unsent local template fixture');
      assert.equal(await manager.locator('.outreach-template-choice').first().textContent(),original);
      assert.equal(await page.evaluate(()=>document.body.innerText.includes('UI 启动失败')),false);
      outcomes.push({templateCreation:true,saveAs:true,originalPreserved:true,prompt:false});
    }
  }
  const drag = async (selector, delta) => {
    const handle = page.locator(selector);
    const before = Number(await handle.getAttribute('aria-valuenow'));
    const rect = await handle.boundingBox();
    assert.ok(rect && rect.width >= 14);
    const host = await page.locator(selector === '#splitterMain' ? '#body' : '#console').boundingBox();
    const x = rect.x + rect.width / 2, y = rect.y + 150;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + delta, y, { steps: 8 });
    await page.mouse.up();
    const after = Number(await handle.getAttribute('aria-valuenow'));
    assert.equal(after, Math.round(x + delta - host.x));
    return { before, after };
  };
  const sidebar = await drag('#splitterSidebar', 60);
  const main = await drag('#splitterMain', -70);
  const before = Number(await page.locator('#splitterMain').getAttribute('aria-valuenow'));
  await page.locator('#splitterMain').focus();
  await page.keyboard.press('ArrowLeft');
  const after = Number(await page.locator('#splitterMain').getAttribute('aria-valuenow'));
  assert.equal(after, before - 20);
  await page.reload();
  await page.waitForSelector('#splitterMain[aria-valuenow]');
  assert.equal(Number(await page.locator('#splitterMain').getAttribute('aria-valuenow')), after);
  assert.equal(Number(await page.locator('#splitterSidebar').getAttribute('aria-valuenow')), sidebar.after);
  const zoomChecks = [];
  for (const zoom of [0.75, 1, 1.25]) {
    await electronApp.evaluate(({ BrowserWindow }, value) => {
      BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('/renderer/index.html'))
        .webContents.setZoomFactor(value);
    }, zoom);
    let aligned = false;
    let geometry;
    for (let attempt = 0; attempt < 30 && !aligned; attempt += 1) {
      const edge = await page.evaluate(() => ({
        x: document.querySelector('#splitterMain').getBoundingClientRect().right,
        y: document.querySelector('#body').getBoundingClientRect().top
      }));
      geometry = await electronApp.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/renderer/index.html'));
        return { zoom: win.webContents.getZoomFactor(), bounds: win.getBrowserViews().map(view => view.getBounds()) };
      });
      geometry.rendererEdge = edge;
      aligned = geometry.zoom === zoom && geometry.bounds.length > 0 && geometry.bounds.every(bounds => (
        Math.abs(bounds.x - Math.round(edge.x * zoom)) <= 1
        && Math.abs(bounds.y - Math.round(edge.y * zoom)) <= 1
      ));
      if (!aligned) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(aligned, true, `Native BrowserView must align at renderer zoom ${zoom}: ${JSON.stringify(geometry)}`);
    zoomChecks.push({ zoom, aligned });
    await page.screenshot({ path: path.join(userData, `layout-${zoom}.png`) });
  }
  const handoffs = await electronApp.evaluate(() => ({
    searches: globalThis.fixtureNavigations.filter(n => n.event === 'did-navigate-in-page' && n.url.includes('accountCleanup=ready')).length,
    creators: globalThis.fixtureNavigations.filter(n => n.event === 'did-navigate-in-page'
      && new URL(n.url).pathname.includes('/invite-form') && n.url.includes('lateCleanup=ready')).length,
    forms: globalThis.fixtureNavigations.filter(n => n.event === 'did-navigate-in-page' && n.url.includes('entryCleanup=ready')).length
  }));
  assert.equal(handoffs.searches,1,'The first creator must observe departing-account search cleanup');
  assert.equal(handoffs.creators, 2, 'Both later creator opens must observe departing-form cleanup');
  assert.equal(handoffs.forms, (reviewScroll ? 10 : 9) + (process.env.PGY_BRAND_SEARCH_TEST === '1' ? 1 : 0),
    'Every direct/brand-confirmation/unsent/sent form transition must observe departing-creator cleanup');
  assert.deepEqual(rendererErrors, [], 'Unexpected renderer exceptions fail release acceptance');
  const report = { ok: true, version: setup.version, localOnly: true, outcomes, handoffs, reviewScroll, layout: { sidebar, main, keyboard: { before, after }, restored: true, zoomChecks } };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
})().catch(async error => {
  const navigations = electronApp ? await electronApp.evaluate(() => globalThis.fixtureNavigations).catch(() => []) : [];
  const fixtureErrors = electronApp ? await electronApp.evaluate(() => globalThis.fixtureErrors).catch(() => []) : [];
  const brandSteps = electronApp ? await electronApp.evaluate(() => globalThis.fixtureBrandSteps).catch(() => []) : [];
  fs.writeFileSync(reportPath, JSON.stringify({ ok: false, error: error.stack, outcomes, fixtureErrors, brandSteps, navigations }, null, 2));
  process.exitCode = 1;
}).finally(async () => {
  if (electronApp) await electronApp.close();
  if (process.env.PGY_TEST_OUTPUT_DIR) {
    fs.mkdirSync(process.env.PGY_TEST_OUTPUT_DIR, { recursive: true });
    for (const name of fs.readdirSync(userData).filter(name => name === 'result.json' || name.endsWith('.png'))) {
      fs.copyFileSync(path.join(userData, name), path.join(process.env.PGY_TEST_OUTPUT_DIR, name));
    }
  }
  console.log(reportPath);
  console.log(fs.readFileSync(reportPath, 'utf8'));
});
