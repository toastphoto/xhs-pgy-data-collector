const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const rendererDir = path.resolve(__dirname, '../renderer');
const appSource = fs.readFileSync(path.join(rendererDir, 'app.js'), 'utf8');
const renderContent = appSource.slice(appSource.indexOf('function renderContent(state) {'), appSource.indexOf('\nfunction initSplitters()'));
assert.ok(renderContent.startsWith('function renderContent(state) {'));
const seed = `
export function seedScrollFixture() {
  _selectedRunDir='fixture-run'; _runs=[{path:_selectedRunDir,name:'Fixture run'}];
  _colsLoadedOnce=true; _columns=['达人昵称']; _groups=[];
  _contactPreviewRunDir=_selectedRunDir; _contactLoadedRunDir=_selectedRunDir;
  _contactPreviewMeta={rawFiles:100,files:100,loaded:true,error:''};
  _contactPreviewRows=Array.from({length:100},(_,i)=>({rowId:'fixture-'+i,creatorName:'Fixture '+i,
    creatorUrl:'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/EXAMPLE'+i,selected:true,contactChannel:'蒲公英邀约'}));
  _contactPreviewRows.forEach(ensureReviewRow); _contactComposerMethod='蒲公英邀约';
  _contactPgyBrandName='Fixture brand'; _contactPgyProductName='Fixture product'; _contactPgyContactWay='fixture_contact';
  _contactPgyIntro='Fixture introduction'; _contactPgyPublishStart='2026-10-15'; _contactPgyPublishEnd='2026-10-31';
  window.fixtureRouting=method=>{
    _contactPreviewRows=[_contactPreviewRows[0]];_contactComposerMethod=method;
    const review=ensureReviewRow(_contactPreviewRows[0]);Object.assign(review,{selected:true,contactChannel:'自动分流',wechatId:'',phone:'',email:method==='邮件建联'?'fixture@example.test':''});
    _pgyInviteBatchState={status:'idle',rowIds:[],currentIndex:-1,results:[],message:'',stopRequested:false};
  };
  window.fixtureRouteChanged=()=>{
    const review=ensureReviewRow(_contactPreviewRows[0]);
    if(_contactComposerMethod==='蒲公英邀约')review.email='fixture@example.test';else review.wechatId='fixture_wechat';
  };
  window.fixtureBatch=()=>({status:_pgyInviteBatchState.status,rows:_pgyInviteBatchState.rowIds.length});
  window.fixtureAwaiting=()=>{
    const row=_contactPreviewRows[0];_pgyInviteBatchState={...capturePgyInviteContext(null,99),id:99,status:'awaiting_confirmation',
      rowIds:[row.rowId],targets:[row],currentIndex:0,results:[],message:'Fixture prepared',stopRequested:false};
  };
}
`;

(async () => {
  const browser = await chromium.launch({ headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}) });
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'pgy-review-scroll-'));
  try {
    const context = await browser.newContext({viewport:{width:950,height:850}});
    const external = [], errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'fixture.test') { external.push(url.hostname); return route.abort(); }
      if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><div id="content"></div>'});
      const relative = url.pathname.replace(/^\/renderer\//,'');
      const file = path.resolve(rendererDir, relative);
      if (!file.startsWith(rendererDir+path.sep) || !fs.existsSync(file)) return route.abort();
      return route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/javascript',
        body:fs.readFileSync(file,'utf8')+(relative==='views/exports.js'?seed:'')});
    });
    const page = await context.newPage();
    page.on('pageerror', error=>errors.push(error.message));
    await page.goto('http://fixture.test/');
    await page.addStyleTag({url:'http://fixture.test/renderer/app.css'});
    await page.addStyleTag({content:'#content{height:850px;overflow:auto;width:100%;box-sizing:border-box}body{display:block}'});
    await page.addScriptTag({content:`
      window.fixtureCalls=[];
      const delay=()=>new Promise(resolve=>setTimeout(resolve,80));
      window.desktopAPI={feishu:{status:async()=>({ok:true,connected:false})},exports:{saveContactReview:async p=>{
          if(window.fixtureSaveFails)return {ok:false,code:'CONTACT_REVIEW_SAVE_FAILED'};
          window.fixtureSaved=p;return {ok:true};}},
        invites:{openCreator:async p=>{window.fixtureCalls.push(['open',p.rowId]);await delay();
            return window.fixtureFailOpen?{ok:false,error:'Fictional page still loading'}:{ok:true};},
          prepare:async p=>{window.fixtureCalls.push(['prepare',p.rowId]);
            if(window.fixturePausePreparation)await new Promise(resolve=>{window.finishFixturePreparation=resolve;});else await delay();
            return {ok:true,token:'fixture-token',fingerprint:'fixture-print',template:p.template};},
          sendPrepared:async()=>{throw Error('No sends permitted in this fixture');}},
        contacts:{openTencentEmail:async()=>{window.fixtureCalls.push(['mail']);return {ok:true};}}};
    `});
    await page.addScriptTag({type:'module',content:`
      import {store} from '/renderer/state/store.js';
      import {enhanceWorkspace} from '/renderer/native-workflow.js';
      import {renderExports,seedScrollFixture} from '/renderer/views/exports.js';
      seedScrollFixture(); store.state={...store.state,appInfo:{productVariant:'feishu-project'},view:'exports',exports:{selectedRunDir:'fixture-run',_loadedOnce:true}};
      const views={exports:renderExports}; let lastRenderedView='exports';
      ${renderContent}
      store.subscribe(renderContent); renderContent(store.state);
      window.rerenderScrollFixture=()=>store.set({exports:{...store.state.exports,_t:Date.now()}});
    `});
    await page.locator('.contact-review-card').last().waitFor();
    await page.getByRole('tab', {name:'完整流程',exact:true}).click();
    const settle = ()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
    await settle();
    const intro=page.getByLabel('本次合作内容介绍',{exact:true});
    await intro.fill('');
    await intro.evaluate(node=>{window.fixtureTypingNode=node;});
    await intro.pressSequentially('continuous typing',{delay:650});
    assert.equal(await intro.inputValue(),'continuous typing','Autosave must not interrupt typing');
    assert.equal(await intro.evaluate(node=>node===window.fixtureTypingNode&&node===document.activeElement),true,'Autosave must retain the actual focused editor');
    await page.waitForFunction(()=>window.fixtureSaved?.settings?.pgyIntro==='continuous typing');
    await intro.evaluate(node=>{
      node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'中'}));
      node.value+='中文';node.dispatchEvent(new InputEvent('input',{bubbles:true,data:'中文',isComposing:true}));
    });
    await page.waitForFunction(()=>window.fixtureSaved?.settings?.pgyIntro==='continuous typing中文');
    assert.equal(await intro.evaluate(node=>node===window.fixtureTypingNode&&node===document.activeElement),true,'Composition must keep its editor through autosave');
    await intro.evaluate(node=>node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中文'})));
    await page.evaluate(()=>{window.fixtureSaveFails=true;});
    const product=page.getByLabel('产品名称',{exact:true});
    await product.fill('');await product.pressSequentially('typed product',{delay:600});
    assert.equal(await product.inputValue(),'typed product');
    await page.locator('[data-contact-save-status]').filter({hasText:'自动保存失败'}).waitFor();
    assert.equal(await product.evaluate(node=>node===document.activeElement),true,'Save failure must not discard editor focus');
    await page.evaluate(()=>{window.fixtureSaveFails=false;});
    await product.pressSequentially('X');
    await page.waitForFunction(()=>window.fixtureSaved?.settings?.pgyProductName==='typed productX');
    const manager=page.locator('.outreach-template-manager').filter({has:intro});
    const templateSnapshot=await manager.locator('.outreach-template-choice').allTextContents();
    await page.evaluate(()=>{window.prompt=()=>{throw Error('prompt() is not supported in Electron');};});
    await manager.getByRole('button',{name:'另存为新模板',exact:true}).click();
    assert.equal(await manager.locator('.outreach-template-choice').count(),templateSnapshot.length+1);
    assert.equal(await intro.inputValue(),'continuous typing中文','Save-as preserves current content');
    const copyName=await manager.getByLabel('模板名称',{exact:true}).inputValue();
    assert.match(copyName,/副本/);
    await manager.getByRole('button',{name:'新增模板',exact:true}).click();
    assert.equal(await manager.getByLabel('模板名称',{exact:true}).inputValue(),'新模板');
    assert.equal(await intro.inputValue(),'','New templates start empty');
    await manager.getByLabel('模板名称',{exact:true}).fill('AI local fixture');
    await intro.fill('Template fixture content');
    await manager.getByRole('button',{name:'保存到当前模板',exact:true}).click();
    await manager.getByRole('button',{name:'新增模板',exact:true}).click();
    await manager.getByRole('button',{name:'新增模板',exact:true}).click();
    assert.equal(await manager.getByLabel('模板名称',{exact:true}).inputValue(),'新模板 2');
    const titles=await manager.locator('.outreach-template-choice-title').allTextContents();
    assert.equal(titles.length,new Set(titles).size,'Automatic template names must be distinct');
    assert.equal(await manager.locator('.outreach-template-choice').first().textContent(),templateSnapshot[0],'Original default template stays unchanged');
    await intro.fill('Restored invitation fixture intro');
    assert.equal(await page.evaluate(()=>{
      const contact=document.querySelector('.export-workbench'),feishu=document.querySelector('.feishu-workbench');
      return !!(contact.compareDocumentPosition(feishu)&Node.DOCUMENT_POSITION_FOLLOWING);
    }),true,'Feishu handoff must follow invitation workbench');
    const observe = ()=>page.evaluate(()=>{
      const list=document.querySelector('.contact-review-list');
      const rect=list.getBoundingClientRect();
      const visible=[...list.children].filter(c=>c.getBoundingClientRect().bottom>rect.top && c.getBoundingClientRect().top<rect.bottom);
      return {top:list.scrollTop,max:list.scrollHeight-list.clientHeight,outer:document.querySelector('#content').scrollTop,
        first:visible[0]?.dataset.reviewRowId,firstY:visible[0]?.getBoundingClientRect().top-rect.top};
    });
    await page.locator('.contact-review-list').evaluate(list=>{
      const card=list.children[45],bounds=list.getBoundingClientRect();
      list.scrollTop+=card.getBoundingClientRect().top-bounds.top-20;
      const content=document.querySelector('#content');content.scrollTop+=list.getBoundingClientRect().top-80;
    });
    await settle();
    const before=await observe();
    assert.ok(before.top>1000 && before.top<before.max-1000);
    await page.locator('[data-review-row-id="fixture-45"]').getByRole('button',{name:'准备邀约',exact:true}).click();
    await page.locator('[data-review-row-id="fixture-45"] .pgy-invite-row-status.ready').waitFor();
    await settle();
    const after=await observe();
    console.log(JSON.stringify({before,after}));
    assert.ok(Math.abs(after.top-before.top)<10,'Preparing one invitation must not move the list: '+JSON.stringify({before,after}));
    assert.ok(Math.abs(after.outer-before.outer)<10,'Preparing must preserve the outer workbench scroll');
    await page.screenshot({path:path.join(output,'prepared-950.png')});

    // A retired DOM node must not replace the new list's saved reading position.
    await page.locator('.contact-review-list').evaluate(list=>{window.retiredFixtureList=list;});
    await page.evaluate(()=>window.rerenderScrollFixture()); await settle();
    await page.evaluate(()=>window.retiredFixtureList.dispatchEvent(new Event('scroll')));
    await page.evaluate(()=>window.rerenderScrollFixture()); await settle();
    assert.ok(Math.abs((await observe()).top-after.top)<1,'Detached list event cannot poison the next restoration');

    await page.evaluate(()=>{window.fixturePausePreparation=true;});
    await page.locator('[data-review-row-id="fixture-46"]').getByRole('button',{name:'准备邀约',exact:true}).click();
    await page.waitForFunction(()=>typeof window.finishFixturePreparation==='function');
    await page.locator('.contact-review-list').evaluate(list=>{list.scrollTop+=1500;}); await settle();
    const manual=await observe();
    await page.evaluate(()=>window.finishFixturePreparation());
    await page.locator('[data-review-row-id="fixture-46"] .pgy-invite-row-status.ready').waitFor(); await settle();
    const manualAfter=await observe();
    assert.equal(manualAfter.first,manual.first,'Late readiness must retain the newer manual anchor');
    assert.ok(Math.abs(manualAfter.firstY-manual.firstY)<1,'Late readiness must retain its viewport offset: '+JSON.stringify({manual,manualAfter}));

    for(const width of [650,400]){
      await page.setViewportSize({width,height:850});
      await page.locator('.contact-review-list').evaluate(list=>{list.scrollTop=Math.floor((list.scrollHeight-list.clientHeight)*0.6);});
      await settle(); const stable=await observe();
      for(let i=0;i<8;i++){await page.evaluate(()=>window.rerenderScrollFixture());await settle();}
      const repeated=await observe();
      assert.ok(Math.abs(repeated.top-stable.top)<1,'Repeated refresh must not drift at width '+width);
      assert.equal(repeated.first,stable.first); assert.ok(Math.abs(repeated.firstY-stable.firstY)<1);
      await page.screenshot({path:path.join(output,'stable-'+width+'.png')});
    }
    await page.setViewportSize({width:950,height:850});
    await page.evaluate(()=>{window.fixtureFailOpen=true;});
    await page.locator('.contact-review-list').evaluate(list=>{
      list.scrollTop+=list.children[60].getBoundingClientRect().top-list.getBoundingClientRect().top-20;
    });
    await settle(); const failureBefore=await observe();
    await page.locator('[data-review-row-id="fixture-60"]').getByRole('button',{name:'准备邀约',exact:true}).click();
    await page.locator('[data-review-row-id="fixture-60"] .pgy-invite-row-status.error').waitFor(); await settle();
    const failureAfter=await observe();
    assert.equal(failureAfter.first,failureBefore.first);
    assert.ok(Math.abs(failureAfter.firstY-failureBefore.firstY)<1,'Failure status must preserve reading position');
    await page.evaluate(()=>{window.fixtureRouting('蒲公英邀约');window.fixtureAwaiting();window.rerenderScrollFixture();});
    await page.getByRole('button',{name:'人工确认发送当前达人',exact:true}).waitFor();
    const editing=page.getByLabel('本次合作内容介绍',{exact:true});
    await editing.pressSequentially(' changed');
    assert.equal(await page.getByRole('button',{name:'人工确认发送当前达人',exact:true}).count(),0);
    assert.equal(await page.locator('.pgy-invite-batch-panel.stopped').count(),1);
    assert.equal(await editing.evaluate(node=>node===document.activeElement),true,'Batch cancellation must not remount the editor');
    for(const method of ['蒲公英邀约','邮件建联']) {
      await page.evaluate(method=>{window.fixtureRouting(method);window.rerenderScrollFixture();},method);
      const action=page.getByRole('button',{name:method==='蒲公英邀约'?'蒲公英批量邀约（1）':'打开企业邮箱',exact:true});
      assert.equal(await action.isEnabled(),true);
      const count=await page.evaluate(()=>window.fixtureCalls.length);
      await page.evaluate(()=>window.fixtureRouteChanged());
      await action.click();await settle();
      assert.equal(await page.evaluate(()=>window.fixtureCalls.length),count,'Old channel button must not dispatch an obsolete recipient');
      assert.equal((await page.evaluate(()=>window.fixtureBatch())).rows,0);
    }
    await page.evaluate(()=>{
      window.fixtureRouting('蒲公英邀约');window.fixtureFailOpen=false;window.fixturePausePreparation=true;
      window.finishFixturePreparation=null;window.rerenderScrollFixture();
    });
    await page.locator('.contact-review-card').getByRole('button',{name:'准备邀约',exact:true}).click();
    await page.waitForFunction(()=>typeof window.finishFixturePreparation==='function');
    await page.getByLabel('本次合作内容介绍',{exact:true}).pressSequentially(' revised');
    await page.evaluate(()=>window.finishFixturePreparation());
    await page.waitForFunction(()=>!document.querySelector('.pgy-invite-row-status.preparing'));
    assert.equal(await page.locator('.contact-pgy-action.send').count(),0,'Late preparation cannot restore invalidated send readiness');
    assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
    console.log('contact_review_scroll.ui.test.js passed;100 fictional creators, no platform access. Screenshots: '+output);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
