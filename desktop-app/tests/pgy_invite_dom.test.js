const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');

if (!process.versions.electron) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgy-invite-dom-'));
  const env = { ...process.env, PGY_DOM_TEST_DIR: dir };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require('electron').trim(), [__filename, ...process.argv.slice(2)], {
    env, encoding: 'utf8', timeout: 60000, windowsHide: true
  });
  const reportPath = path.join(dir, 'result.json');
  const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null;
  assert.ok(report, `Electron DOM test did not report: ${result.error || result.stderr}`);
  assert.equal(result.status, 0, `Electron DOM child must exit successfully: ${result.error || result.stderr}`);
  console.log(JSON.stringify(report, null, 2));
  assert.equal(report.ok, true, report.error);
} else {
  const { app, BrowserWindow } = require('electron');
  const http = require('node:http');
  app.setPath('userData', process.env.PGY_DOM_TEST_DIR);
  app.disableHardwareAcceleration();
  const cases = [];
  let win;
  let server;
  const template = {
    brandName: 'Example Brand', contactChannel: '微信', contactWay: 'example_contact',
    productName: 'Example product', intro: 'Example cooperation',
    publishStart: '2026-09-08', publishEnd: '2026-10-31'
  };
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:20px;font:16px sans-serif} .row{display:flex;gap:30px;margin:35px 0;min-height:45px}
    .row>label{width:140px} input,textarea,[role=combobox]{width:230px;padding:10px;border:1px solid gray}
    .spacer{height:750px} .dates{display:flex;gap:20px} button{padding:12px}
  </style><div class="row"><label>品牌名 *</label><div role="combobox" id="brand"><span id="brandText">Example Brand</span><input readonly placeholder="请选择报备品牌" value="" style="width:20px"></div></div>
  <div class="row"><label>联系方式 *</label><div><label><input type="radio" checked>微信</label><input placeholder="请输入" value="example_contact"></div></div>
  <div class="row"><label>产品名称 *</label><input placeholder="请输入产品名称" value="Example product"></div>
  <div class="row"><label>合作内容介绍 *</label><textarea>Example cooperation</textarea></div>
  <div class="row"><label>期望发布时间 *</label><div class="dates"><div><input id="start" placeholder="开始日期" value="2026-09-08"></div><div><input id="end" placeholder="结束日期" value="2026-10-31"></div></div></div>
  <div class="spacer"></div><button id="send">发起邀约</button><script>window.sends=0;document.querySelector('#send').onclick=()=>window.sends++;</script>`;
  (async () => {
    await app.whenReady();
    server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    win = new BrowserWindow({ show: false, width: 1000, height: 700, webPreferences: { sandbox: true, backgroundThrottling: false } });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/solar/pre-trade/invite-form?id=EXAMPLE01`);
    let lib = require(process.env.PGY_INVITE_MODULE_PATH || '../lib/pgy_invite');
    if (process.argv.includes('--baseline')) {
      const Module = require('node:module');
      const mod = new Module(__filename);
      mod.paths = module.paths;
      mod._compile(execFileSync('git', ['show', 'HEAD:desktop-app/lib/pgy_invite.js'], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' }), __filename);
      lib = mod.exports;
    }
    const read = () => win.webContents.executeJavaScript(lib.buildPgyInviteSendScript(template));
    const run = async (name, change, expected, label) => {
      await win.webContents.executeJavaScript(change);
      const result = await read();
      cases.push({ name, ok: result.ok, code: result.code || '', failedFields: result.fieldResults?.filter(x => !x.verified).map(x => x.label) || [] });
      assert.equal(Boolean(result.ok), expected, name);
      if (label) assert.ok(cases.at(-1).failedFields.includes(label), name);
      assert.equal(await win.webContents.executeJavaScript('window.sends'), 0, 'readback must never send');
    };
    await run('bottom-of-form readback', "document.querySelector('#send').scrollIntoView();", true);
    await run('date hint replaced after fill', "document.querySelector('#start').removeAttribute('placeholder');document.querySelector('#end').removeAttribute('placeholder');", true);
    await run('equivalent date formatting', "document.querySelector('#start').value='2026/9/8';document.querySelector('#end').value='2026/10/31';", true);
    await run('changed date with stale HTML attribute', "document.querySelector('#start').value='2026-09-09';", false, '开始日期');
    await run('empty date with stale HTML attribute', "document.querySelector('#start').value='';", false, '开始日期');
    await run('range text is not a date', "document.querySelector('#start').value='2026-09-08 to 2026-09-09';", false, '开始日期');
    await run('hidden old brand cannot authorize', "document.querySelector('#start').value='2026-09-08';document.querySelector('#brandText').textContent='Different Brand';document.querySelector('#brand').insertAdjacentHTML('beforeend','<span hidden>Example Brand</span><div role=option>Example Brand</div>');", false, '报备品牌');
    await run('pending brand search cannot authorize', "document.querySelector('#brand input').readOnly=false;document.querySelector('#brand input').value='Example Brand';", false, '报备品牌');
    await run('identical live form restored', "document.querySelector('#brandText').textContent='Example Brand';document.querySelector('#brand input').value='';", true);
    await run('overlay blocks final action', "document.body.insertAdjacentHTML('beforeend','<div id=overlay style=\"position:fixed;inset:0;background:white;z-index:100\">Verification</div>');", false);
    await win.webContents.executeJavaScript("document.querySelector('#overlay').remove();document.body.insertAdjacentHTML('beforeend','<div id=notice role=alert style=\"position:fixed;top:0\">未发送成功</div>');");
    assert.equal((await win.webContents.executeJavaScript(lib.buildPgyInviteOutcomeScript())).outcome, 'submitted-unconfirmed');
    await win.webContents.executeJavaScript("document.querySelector('#notice').textContent='邀约成功';");
    assert.equal((await win.webContents.executeJavaScript(lib.buildPgyInviteOutcomeScript())).outcome, 'success-confirmed');
    cases.push({ name: 'negative and positive platform outcomes', ok: true });
    await win.webContents.executeJavaScript("document.querySelector('#notice').remove();document.querySelector('#start').value='';document.querySelector('#end').value='';document.querySelector('[placeholder=\"请输入产品名称\"]').value='';window.scrollTo(0,0);");
    const prepared = await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript(template));
    assert.equal(prepared.readyToSend, true, 'prepare and send share the same live readback');
    assert.equal((await read()).ready, true);
    assert.equal(await win.webContents.executeJavaScript('window.sends'), 0);
    cases.push({ name: 'prepare then verify after scrolling', ok: true });
    await run('required marker is not selected brand', "document.querySelector('.row>label').innerHTML='<span>品牌名</span><span> *</span>';", true);
    await run('ambiguous final action', "document.querySelector('#send').insertAdjacentHTML('afterend','<button>发起邀约</button>');", false);
    await win.webContents.executeJavaScript("document.querySelector('#send').nextElementSibling.remove();document.querySelector('#start').value='';document.querySelector('#start').addEventListener('change',event=>{const replacement=event.target.cloneNode();replacement.value='';event.target.replaceWith(replacement);},{once:true});");
    const replaced = await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript(template));
    assert.equal(replaced.readyToSend, false, 'detached field reference cannot authorize');
    assert.ok(replaced.missingFields.includes('开始日期'));
    cases.push({ name: 'rerendered field read from current DOM', ok: true });
    await run('missing date distinguished from changed date', "document.querySelector('#start').remove();", false, '开始日期');
    assert.equal(cases.at(-1).code, 'PGY_INVITE_FIELD_UNREADABLE');
    await win.reload();
    await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
    await win.webContents.executeJavaScript(`document.querySelector('#brandText').textContent='';
      const input=document.querySelector('#brand input');input.readOnly=false;input.placeholder='请输入品牌名称/ID搜索';input.setAttribute('aria-controls','brandList');
      document.body.insertAdjacentHTML('beforeend','<div role="listbox" id="brandList" style="position:fixed;top:30px;left:500px"><li role="option">Example Brand</li><div role="option"><span>Example Brand Plus</span></div></div><div role="listbox" id="unrelated" style="position:fixed;top:200px;left:500px"><div role="option">Unrelated choice</div></div>');`);
    const partial=await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript({...template,brandName:'Example'}));
    assert.equal(partial.waitingForBrand,true);
    assert.deepEqual(partial.brandCandidates.map(item=>item.label),['Example Brand','Example Brand Plus']);
    assert.equal(partial.action,undefined,'A partial query must not auto-select the first brand');
    assert.equal(Boolean((await read()).ready),false,'Search text is not a selected brand');
    const exact=await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript(template));
    assert.equal(exact.action.type,'select-brand');
    assert.equal(exact.action.label,'Example Brand');
    assert.equal(await win.webContents.executeJavaScript('window.sends'),0);
    cases.push({name:'partial brand yields scoped choices; direct-text li is selectable; unrelated list excluded; no send',ok:true});
    await win.webContents.executeJavaScript(`(() => {window.scrollTo(0,0);const input=document.querySelector('#brand input'),list=document.querySelector('#brandList');
      input.removeAttribute('aria-controls');document.querySelector('#unrelated').remove();
      const rect=input.getBoundingClientRect(),outer=document.createElement('div');outer.className='select-dropdown';
      Object.assign(outer.style,{position:'fixed',top:rect.bottom+'px',left:rect.left+'px',width:'280px'});
      list.replaceWith(outer);outer.appendChild(list);list.style.position='static';})()`);
    const nested=await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript({...template,brandName:'Example'}));
    assert.deepEqual(nested.brandCandidates.map(item=>item.label),['Example Brand','Example Brand Plus']);
    const nestedExact=await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript(template));
    assert.equal(nestedExact.action.type,'select-brand');
    cases.push({name:'one nested portal popup is not multiple independent brand lists',ok:true});
    await win.webContents.executeJavaScript(`document.querySelector('#brandList').className='select-items';`);
    const pluralWrapper=await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript(template,{brandSelectionConfirmed:false}));
    assert.equal(await win.webContents.executeJavaScript(`document.elementFromPoint(${pluralWrapper.action.point.x},${pluralWrapper.action.point.y}).closest('li')?.textContent`),'Example Brand');
    cases.push({name:'plural option wrapper never supplies a click point spanning multiple brands',ok:true});
    await win.webContents.executeJavaScript(`document.querySelector('#brandList li').insertAdjacentHTML('afterbegin','<span class="option-avatar"></span>');document.querySelector('#brandList li').insertAdjacentHTML('beforeend','<div class="option-metadata">ID: fixture_only</div>');`);
    const decorated=await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript(template,{brandSelectionConfirmed:false}));
    assert.equal(decorated.action.type,'select-brand');
    assert.equal(await win.webContents.executeJavaScript(`document.elementFromPoint(${decorated.action.point.x},${decorated.action.point.y}).closest('li')?.firstChild.className`),'option-avatar');
    cases.push({name:'option avatar and ID descendants do not remove the named brand row',ok:true});
    await win.webContents.executeJavaScript(`document.querySelector('#brandList').innerHTML='<li role="option"><span>Example <em>Brand</em></span><div>ID: example_metadata</div></li><li role="option"><span>Example <em>Brand</em> Plus</span><div>ID: example_other</div></li>'`);
    const highlighted=await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript({...template,brandName:'Example'}));
    assert.deepEqual(highlighted.brandCandidates.map(item=>item.label),['Example Brand','Example Brand Plus']);
    cases.push({name:'highlighted full brand label preserved and ID metadata excluded',ok:true});
    await win.webContents.executeJavaScript(`document.querySelector('#brandText').textContent='Example Brand';
      document.querySelector('#brand input').value='Example Brand';document.querySelector('#brand input').readOnly=true;`);
    const unconfirmed=await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript(template,{brandSelectionConfirmed:false}));
    assert.notEqual(unconfirmed.readyToSend,true,'A readonly search echo cannot bypass required actual selection');
    assert.equal(unconfirmed.action.type,'select-brand');
    cases.push({name:'real-page search echo is not brand selection authority',ok:true});
    await win.webContents.executeJavaScript(`const activeBrand=document.querySelector('#brand input');activeBrand.readOnly=false;activeBrand.placeholder='请选择报备品牌';activeBrand.focus();`);
    const legacyHint=await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript({...template,brandName:'Example'},{brandSelectionConfirmed:false}));
    assert.equal(legacyHint.waitingForBrand,true);
    assert.deepEqual(legacyHint.brandCandidates.map(item=>item.label),['Example Brand','Example Brand Plus']);
    cases.push({name:'focused real search input retains initial placeholder without picker toggling',ok:true});
    const settle=await win.webContents.executeJavaScript(lib.buildPgyInvitePrepareScript(template,{brandSelectionConfirmed:true,brandSelectionSettled:false}));
    assert.equal(settle.action.type,'settle-brand');
    assert.notEqual(settle.readyToSend,true);
    const focusedEcho=await win.webContents.executeJavaScript(lib.buildPgyInviteSendScript(template));
    assert.equal(focusedEcho.ok,false,'Focused search echo cannot count as committed selection');
    await win.webContents.executeJavaScript(`document.querySelector('#brand input').style.display='none';`);
    assert.equal((await win.webContents.executeJavaScript(lib.buildPgyInviteSendScript(template))).ok,true,'A hidden former search input does not invalidate committed selection');
    await win.webContents.executeJavaScript(`document.querySelector('#brand input').style.display='';`);
    await win.webContents.executeJavaScript(`document.querySelector('#brand input').blur();document.querySelector('#brand input').value='';document.querySelector('#brandText').textContent='Example Brand Plus';`);
    const wrongSelection=await win.webContents.executeJavaScript(lib.buildPgyInviteSendScript(template));
    assert.equal(wrongSelection.ok,false);
    assert.ok(wrongSelection.fieldResults.some(field=>field.label==='报备品牌'&&!field.verified));
    cases.push({name:'close search before live selection readback; wrong brand suffix rejected',ok:true});
    fs.writeFileSync(path.join(process.env.PGY_DOM_TEST_DIR, 'result.json'), JSON.stringify({ ok: true, cases }));
  })().catch(error => {
    fs.writeFileSync(path.join(process.env.PGY_DOM_TEST_DIR, 'result.json'), JSON.stringify({ ok: false, error: error.stack, cases }));
    process.exitCode = 1;
  }).finally(() => {
    if (win) win.destroy();
    if (server) server.close();
    app.exit(process.exitCode || 0);
  });
}
