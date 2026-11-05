const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '../renderer/views/feishu.js'), 'utf8').replace(/^export /gm, '');
const css = fs.readFileSync(path.join(__dirname, '../renderer/app.css'), 'utf8');
const setup = `
  window.calls = []; window.applied = false;
  window.desktopAPI = {feishu:{
    connect: async p => ({ok:true,target:'project/creator',fieldCount:3,fields:[
      {key:'name',name:'账号昵称',type:'text',required:true,options:[]},
      {key:'account',name:'小红书ID',type:'text',required:true,options:[]},
      {key:'contact',name:'联系方式',type:'text',required:false,options:[]}
    ]}),
    clear: async () => ({ok:true}),
    status: async () => ({ok:true,connected:window.fixtureConnected!==false}),
    searchMaintainers: async () => ({ok:true,candidates:[{token:'choice',label:'Fixture Operator'}]}),
    inspectOperator: async () => ({ok:true,name:'Fixture Operator',token:'operator',roleName:'现维护经纪人',
      choice:{token:'saved-choice',name:'Fixture Operator',target:'project/creator'},
      checkedAt:new Date(Date.now()+16).toISOString(),remainingLeaseMs:300000}),
    refreshOperator: async p => {window.calls.push(['refresh',p.choiceToken]);return {ok:true,name:'Fixture Operator',token:'refreshed-operator',roleName:'现维护经纪人',
      choice:{token:'saved-choice',name:'Fixture Operator',target:'project/creator'},checkedAt:new Date(Date.now()+16).toISOString(),remainingLeaseMs:300000};},
    lookup: async p => {window.calls.push(['lookup',p.runDir,p.rowId,p.accountNumber]); return {ok:true,token:'lookup',checkedAt:new Date().toISOString(),preview:{status:'manual_review',candidates:[{recordId:5,kind:'unclassified',value:'12345678'}],proposals:[]}};},
    applyContact: async p => ({ok:true,patch:{phone:'12345678'}}),
    prepare: async p => ({ok:true,token:'plan',action:p.action,target:'project/creator',name:'[AI测试] Fixture',batch:'fixture-batch',expiresAt:Date.now()+300000,
      ...(p.action==='create'?{maintainer:{name:'Fixture Operator',roleName:'现维护经纪人'}}:{}),fields:[{field_key:'contact',field_value:p.values?.contact||'fixture'}]}),
    execute: async p => {window.calls.push(['execute',p.confirmed]);return {ok:true,action:'create',recordId:'41',status:'verified'};},
    listRecords: async () => ({ok:true,records:window.fixtureRecords||[]})
  }};
  ${source}
  const ctx = {runDir:'run',rows:[{rowId:'row',creatorName:'Fixture Creator',selected:true}],
    save:async()=>({ok:true}),apply:async()=>{window.applied=true;return{ok:true};},rerender:()=>window.renderFixture()};
  window.renderFixture=()=>document.getElementById('mount').replaceChildren(renderFeishuWorkbench(ctx));
  window.switchRun=()=>{ctx.runDir='other';window.renderFixture();}; window.renderFixture();
  window.prepareBatch=()=>{ctx.rows=[{rowId:'a',creatorName:'Fixture A',xhsId:'001234',selected:true},
    {rowId:'b',creatorName:'Fixture B',xhsId:'005678',selected:true}];currentRow='';batch=null;
    window.calls=[];window.renderFixture();};
`;
(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const output = fs.mkdtempSync(path.join(os.tmpdir(),'pgy-feishu-ui-'));
  try {
    const context = await browser.newContext();
    await context.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><div id="mount" style="padding:16px"></div>'}));
    const page = await context.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
    await page.goto('http://fixture.test'); await page.addStyleTag({content:css}); await page.addScriptTag({content:setup});
    await page.getByLabel('Plugin Secret',{exact:true}).fill('fictional-secret');
    await page.getByRole('button',{name:'连接并读取字段',exact:true}).click();
    await page.getByRole('status').filter({hasText:'连接成功'}).waitFor();
    assert.equal(await page.getByLabel('建档模式',{exact:true}).inputValue(),'production');
    assert.equal(await page.getByLabel('已核对正式新建／补录及通知影响；不发送邀约、不推进流程',{exact:true}).isChecked(),false);
    await page.getByLabel('建档模式',{exact:true}).selectOption('test');
    assert.equal(await page.getByLabel('Plugin Secret',{exact:true}).inputValue(),'');
    await page.getByLabel('本次达人',{exact:true}).selectOption('row');
    await page.getByLabel('主页显示的小红书号',{exact:true}).fill('001234');
    await page.getByLabel('已核对该小红书号属于当前达人',{exact:true}).check();
    await page.getByRole('button',{name:'查询团队库',exact:true}).click();
    await page.getByRole('status').filter({hasText:'命中记录'}).waitFor();
    assert.equal(await page.evaluate(()=>window.applied),false);
    await page.locator('.feishu-contact-preview select').selectOption('phone');
    await page.getByRole('button',{name:'确认回填本地',exact:true}).click();
    await page.getByRole('status').filter({hasText:'回填成功'}).waitFor();
    assert.equal(await page.evaluate(()=>window.applied),true);
    assert.equal(await page.getByRole('tab',{name:'新建跟进',exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(await page.getByLabel('联系方式',{exact:true}).inputValue(),'手机：12345678','confirmed contact must flow into the new follow-up draft');
    await page.getByLabel('已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程',{exact:true}).check();
    await page.getByLabel('联系方式',{exact:true}).fill('手机：12345678');
    assert.equal(await page.getByRole('button',{name:'预览写入字段',exact:true}).isDisabled(),true);
    await page.getByLabel('经纪人姓名',{exact:true}).fill('Fixture Operator');
    await page.getByRole('button',{name:'查找经纪人',exact:true}).click();
    await page.getByLabel('匹配人员',{exact:true}).selectOption('choice');
    await page.getByText('人员已核验；预览和写入仍需单独确认',{exact:true}).waitFor();
    await page.getByLabel('将新增跟进的现维护经纪人设为 Fixture Operator',{exact:true}).check();
    await page.evaluate(()=>{window.beforeLeaseNow=Date.now();Date.now=()=>window.beforeLeaseNow+300001;window.renderFixture();});
    assert.equal(await page.getByLabel('经纪人姓名',{exact:true}).inputValue(),'Fixture Operator');
    assert.equal(await page.getByLabel('将新增跟进的现维护经纪人设为 Fixture Operator',{exact:true}).isChecked(),true);
    assert.equal(await page.evaluate(()=>window.calls.filter(c=>c[0]==='refresh').length),0,'expiry alone does not refresh or dispatch');
    await page.getByRole('button',{name:'预览写入字段',exact:true}).click();
    await page.getByRole('status').filter({hasText:'尚未写入'}).waitFor();
    assert.equal(await page.evaluate(()=>window.calls.filter(c=>c[0]==='refresh').length),1,'explicit preview refreshes the same choice once');
    assert.ok(!await page.evaluate(()=>window.calls.some(c=>c[0]==='execute')));
    assert.equal(await page.getByRole('tabpanel',{name:'新建跟进',exact:true}).isVisible(),true);
    await page.getByLabel('联系方式',{exact:true}).fill('手机：87654321');
    await page.getByRole('button',{name:'确认写入飞书',exact:true}).click();
    assert.ok(!await page.evaluate(()=>window.calls.some(c=>c[0]==='execute')));
    await page.getByRole('button',{name:'预览写入字段',exact:true}).click();
    await page.getByRole('status').filter({hasText:'尚未写入'}).waitFor();
    await page.getByRole('button',{name:'确认写入飞书',exact:true}).click();
    await page.getByRole('status').filter({hasText:'新建成功'}).waitFor();
    assert.equal(await page.evaluate(()=>window.calls.filter(c=>c[0]==='execute').length),1);
    await page.getByRole('button',{name:'检查连接',exact:true}).click();
    await page.getByRole('status').filter({hasText:'连接有效'}).waitFor();
    await page.getByRole('tab',{name:'新建跟进',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('tabpanel',{name:'修改记录',exact:true}).waitFor();
    assert.equal(await page.getByText('暂无本软件创建的记录',{exact:true}).isVisible(),true);
    await page.getByRole('tab',{name:'修改记录',exact:true}).focus();
    await page.keyboard.press('End');
    await page.getByRole('tabpanel',{name:'测试清理',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'预览精确清理对象',exact:true}).isDisabled(),true);
    assert.equal(await page.evaluate(()=>window.calls.filter(c=>c[0]==='execute').length),1,'mode changes never dispatch writes');
    await page.evaluate(()=>{window.fixtureRecords=[{entryId:'11111111-1111-4111-8111-111111111111',
      target:'project/creator',recordId:'41',name:'[AI测试] Fixture',status:'verified'}];});
    await page.getByRole('button',{name:'刷新本软件创建清单',exact:true}).click();
    await page.getByRole('status').filter({hasText:'创建清单 1 条'}).waitFor();
    await page.getByRole('tab',{name:'修改记录',exact:true}).click();
    await page.getByLabel('目标记录',{exact:true}).selectOption('41');
    assert.equal(await page.getByLabel('修改联系方式',{exact:true}).isVisible(),true,'target selection renders editable fields');
    await page.getByRole('tab',{name:'新建跟进',exact:true}).click();
    await page.evaluate(()=>window.prepareBatch());
    await page.locator('.feishu-batch summary').click();
    await page.getByLabel('已核对本批小红书号与达人对应关系',{exact:true}).check();
    await page.getByRole('button',{name:'查询选中达人',exact:true}).click();
    await page.getByRole('status').filter({hasText:'批量查询完成'}).waitFor();
    assert.equal(await page.evaluate(()=>window.calls.filter(c=>c[0]==='lookup').length),2);
    assert.equal(await page.getByRole('button',{name:'确认回填本地（0）',exact:true}).isDisabled(),true);
    assert.equal(await page.locator('[data-batch-contact-value]').count(),0,'no raw paragraph before explicit source selection');
    for (const name of ['Fixture A','Fixture B']) {
      const source = page.getByLabel('回补来源 · '+name,{exact:true});
      assert.equal(await source.inputValue(),'');
      await source.selectOption('5');
      const row = page.locator('.feishu-batch-row').filter({has:source});
      assert.equal(await row.locator('[data-batch-contact-value]').textContent(),'12345678');
      assert.equal(await page.getByLabel('回补类型 · '+name,{exact:true}).inputValue(),'');
      await page.getByLabel('回补类型 · '+name,{exact:true}).selectOption('phone');
      await page.getByLabel('回填 · '+name,{exact:true}).check();
    }
    await page.getByRole('button',{name:'确认回填本地（2）',exact:true}).click();
    await page.getByRole('status').filter({hasText:'批量回填完成'}).waitFor();
    assert.equal(await page.getByText('已回填并保存',{exact:true}).count(),2);
    assert.equal(await page.evaluate(()=>window.calls.some(c=>c[0]==='execute')),false,'batch backfill cannot execute cloud writes');
    await page.getByLabel('经纪人姓名',{exact:true}).fill('Changed Fixture');
    assert.equal(await page.locator('[data-authority-status]').innerText(),'');
    await page.getByRole('status').filter({hasText:'姓名已更改'}).waitFor();
    assert.equal(await page.getByLabel('将新增跟进的现维护经纪人设为 Fixture Operator',{exact:true}).count(),0);
    for (const width of [950,650,400]) {
      await page.setViewportSize({width,height:850});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);
      await page.screenshot({path:path.join(output,'workbench-'+width+'.png'),fullPage:true});
    }
    await page.evaluate(()=>window.switchRun());
    assert.equal(await page.locator('.feishu-contact-preview:not([data-operator])').count(),0);
    assert.equal(await page.locator('.feishu-write-preview').count(),0);
    assert.equal(await page.getByLabel('主页显示的小红书号',{exact:true}).inputValue(),'');
    assert.equal(await page.getByLabel('已核对该小红书号属于当前达人',{exact:true}).isChecked(),false);
    assert.equal(await page.getByLabel('已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程',{exact:true}).isChecked(),false);
    await page.locator('.feishu-write summary').click();
    await page.getByRole('tab',{name:'修改记录',exact:true}).click();
    assert.equal(await page.getByRole('tabpanel',{name:'修改记录',exact:true}).isVisible(),true,'mode switch stays open without a current creator');
    assert.equal(await page.getByLabel('目标记录',{exact:true}).inputValue(),'');
    await page.getByRole('tab',{name:'测试清理',exact:true}).click();
    await page.getByRole('button',{name:'刷新本软件创建清单',exact:true}).click();
    await page.getByRole('status').filter({hasText:'创建清单 1 条'}).waitFor();
    assert.equal(await page.getByRole('tabpanel',{name:'测试清理',exact:true}).isVisible(),true,'journal refresh stays open without a current creator');
    await page.getByLabel('目标记录',{exact:true}).selectOption('41');
    assert.equal(await page.getByRole('button',{name:'预览精确清理对象',exact:true}).isVisible(),true,'target selection does not collapse cleanup');
    await page.getByLabel('已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程',{exact:true}).check();
    assert.equal(await page.getByRole('button',{name:'预览精确清理对象',exact:true}).isEnabled(),true);
    assert.equal(await page.evaluate(()=>window.calls.some(c=>c[0]==='execute')),false,'disclosure interactions cannot dispatch cloud writes');
    await page.getByLabel('已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程',{exact:true}).uncheck();
    await page.evaluate(()=>{
      window.fixtureRecords=[{entryId:'11111111-1111-4111-8111-111111111111',recordId:'41',
        target:'project/creator',name:'[AI测试] AI_TEST_fixture Fixture',batch:'AI_TEST_fixture',status:'verified'}];
      window.fixtureAbsence='existing';
      window.desktopAPI.feishu.verifyOwnedAbsence=async p=>{
        window.calls.push(['verifyOwnedAbsence',p]);
        if(window.fixtureAbsence==='error')return {ok:false,code:'FEISHU_HTTP_ERROR',status:403};
        const absent=window.fixtureAbsence==='absent';
        if(absent){window.fixtureRecords[0].status='deleted';window.fixtureRecords[0].externalAbsenceVerified=true;}
        return {ok:true,...p,exists:!absent,status:absent?'deleted':'verified',externalAbsenceVerified:absent};
      };
    });
    await page.getByRole('button',{name:'刷新本软件创建清单',exact:true}).click();
    await page.getByLabel('目标记录',{exact:true}).selectOption('41');
    const absenceButton=page.getByRole('button',{name:'核对云端是否已删除',exact:true});
    assert.equal(await absenceButton.isEnabled(),true,'readonly absence check must not require write attestation');
    assert.equal(await page.getByRole('button',{name:'预览精确清理对象',exact:true}).isDisabled(),true);
    await absenceButton.click();
    await page.locator('[data-owned-absence-status=true][role=status]').filter({hasText:'仍存在'}).waitFor();
    assert.equal(await page.getByLabel('目标记录',{exact:true}).inputValue(),'41');
    await page.evaluate(()=>{window.fixtureAbsence='error';});
    await absenceButton.click();
    await page.locator('[data-owned-absence-status=true][role=status]').filter({hasText:'HTTP 403'}).waitFor();
    assert.equal(await page.getByLabel('目标记录',{exact:true}).inputValue(),'41','permission failure preserves precise selected target');
    await page.evaluate(()=>{window.fixtureAbsence='absent';});
    await absenceButton.click();
    await page.locator('[data-owned-absence-status=true][role=status]').filter({hasText:'只读确认外部不存在'}).waitFor();
    assert.equal(await page.getByLabel('目标记录',{exact:true}).inputValue(),'');
    assert.equal(await page.getByLabel('目标记录',{exact:true}).locator('option').filter({hasText:'外部不存在'}).count(),1);
    assert.equal(await page.evaluate(()=>window.calls.some(c=>c[0]==='execute')),false,'absence verification never sends DELETE');
    assert.deepEqual(await page.evaluate(()=>window.calls.filter(c=>c[0]==='verifyOwnedAbsence').map(c=>c[1])),
      Array.from({length:3},()=>({entryId:'11111111-1111-4111-8111-111111111111',recordId:'41',target:'project/creator'})));
    await page.locator('.feishu-write summary').click();
    await page.evaluate(()=>window.renderFixture());
    assert.equal(await page.getByRole('tabpanel',{name:'测试清理',exact:true}).isVisible(),false,'manual collapse survives rerender');
    await page.evaluate(()=>{window.fixtureConnected=false;});
    await page.getByRole('button',{name:'检查连接',exact:true}).click();
    await page.getByRole('status').filter({hasText:'连接已过期'}).waitFor();
    assert.equal(await page.getByLabel('Plugin Secret',{exact:true}).isVisible(),true);
    assert.equal(await page.getByRole('tab',{name:'新建跟进',exact:true}).count(),0,'expired connection hides write controls');
    const restoredPage = await context.newPage();
    restoredPage.on('pageerror', e => errors.push(e.message)); restoredPage.on('dialog', d => d.accept());
    await restoredPage.goto('http://fixture.test'); await restoredPage.addStyleTag({content:css});
    const savedSetup = setup.replace('const ctx =', `
      window.desktopAPI.feishu.restoreConnection=async()=>{window.calls.push(['restore']);return {ok:true,connected:true,saved:true,fields:[],fieldCount:0,target:'project/creator',config:{pluginId:'fixture-plugin',projectKey:'project',workItemTypeKey:'creator'}};};
      window.desktopAPI.feishu.disconnect=async()=>({ok:true});
      window.desktopAPI.feishu.forgetConnection=async()=>({ok:true});
      const ctx =`);
    await restoredPage.addScriptTag({content:savedSetup});
    await restoredPage.getByText('已保存本机连接',{exact:true}).waitFor();
    assert.equal(await restoredPage.getByLabel('Plugin Secret',{exact:true}).inputValue(),'');
    assert.equal(await restoredPage.getByLabel('操作人 User Key',{exact:true}).inputValue(),'');
    assert.equal(await restoredPage.locator('.feishu-settings').getAttribute('open'),null);
    assert.deepEqual(await restoredPage.evaluate(()=>window.calls),[['restore']]);
    await restoredPage.setViewportSize({width:650,height:850});
    assert.equal(await restoredPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await restoredPage.screenshot({path:path.join(output,'saved-connection-650.png'),fullPage:true});
    await restoredPage.locator('.feishu-settings summary').click();
    await restoredPage.getByRole('button',{name:'断开连接',exact:true}).click();
    await restoredPage.getByRole('button',{name:'使用已保存连接',exact:true}).waitFor();
    await restoredPage.getByRole('button',{name:'使用已保存连接',exact:true}).click();
    await restoredPage.getByRole('status').filter({hasText:'连接成功'}).waitFor();
    await restoredPage.getByRole('button',{name:'忘记本机连接',exact:true}).click();
    await restoredPage.getByRole('status').filter({hasText:'已忘记本机连接'}).waitFor();
    assert.equal(await restoredPage.getByText('已保存本机连接',{exact:true}).count(),0);

    const cloudPage = await context.newPage();
    cloudPage.on('pageerror',e=>errors.push(e.message)); cloudPage.on('dialog',d=>d.accept());
    await cloudPage.goto('http://fixture.test'); await cloudPage.addStyleTag({content:css});
    await cloudPage.addScriptTag({content:setup+`
      recordMode='test';
      connection={connected:true,target:'project/creator',fields:[
        {key:'name',name:'账号昵称',type:'text',required:true,options:[]},
        {key:'account',name:'小红书ID',type:'text',required:true,options:[]},
        {key:'contact',name:'联系方式',type:'text',options:[]},
        {key:'image',name:'图文平台价',type:'number',options:[]},
        {key:'video',name:'视频平台价',type:'number',options:[]},
        {key:'platform',name:'平台',type:'select',options:[{label:'小红书',value:'xhs'}]},
        {key:'source',name:'达人资源来源',type:'select',options:[{label:'主动搜索',value:'search'}]}
      ]};
      currentRow='';batch=null;cloud=null;operatorLease=null;operator={name:'Fixture Operator',token:'operator',checkedAt:new Date().toISOString()};
      operatorConfirmed=true;safetyConfirmed=false;window.calls=[];
      ctx.rows=Array.from({length:100},(_,i)=>({rowId:'cloud-'+i,creatorName:'Fixture Creator '+i,
        xhsId:'000'+i,wechatId:'fixture_'+i,imagePrice:i===0?0:'¥4,800',videoPrice:'¥9,800',selected:i<3}));
      window.desktopAPI.feishu.prepare=async p=>{window.calls.push(['prepare',p.rowId,p.values]);
        if(p.deferWriteConfirmation!==true||p.safetyConfirmed!==undefined)throw Error('readonly preview must defer write approval');
        if(p.rowId==='cloud-1')return {ok:false,code:'FEISHU_DUPLICATE_MAINTAINER'};
        return {ok:true,token:'plan-'+p.rowId,action:'create',name:'[AI测试] '+p.rowId,batch:'fixture-'+p.rowId,
          target:'project/creator',expiresAt:Date.now()+300000,fields:[
            {field_key:'image',field_value:Number(String(p.values.image).replace(/[¥,]/g,''))},
            {field_key:'video',field_value:Number(String(p.values.video).replace(/[¥,]/g,''))}]};};
      window.desktopAPI.feishu.execute=async p=>{window.calls.push(['execute',p.token]);
        if(p.safetyConfirmed!==true)throw Error('write needs fresh safety approval');
        if(window.deferWrite)return await new Promise(r=>{window.resolveWrite=r;});
        return {ok:true,status:'verified',recordId:'42'};};
      window.renderFixture();
    `});
    assert.equal(await cloudPage.locator('.feishu-cloud-table tbody tr').count(),100);
    await cloudPage.getByLabel('搜索建档名单',{exact:true}).pressSequentially('Creator 99',{delay:30});
    assert.equal(await cloudPage.locator('.feishu-cloud-table tbody tr').count(),1,'typing search retains focus across rerenders');
    await cloudPage.getByLabel('搜索建档名单',{exact:true}).fill('');
    assert.equal(await cloudPage.getByLabel('图文平台价 · Fixture Creator 0',{exact:true}).inputValue(),'0');
    await cloudPage.getByLabel('已核对建档名单的小红书号与达人对应关系',{exact:true}).check();
    await cloudPage.getByRole('button',{name:'查重并预览选中行',exact:true}).click();
    await cloudPage.locator('.feishu-cloud-progress[role=status]').filter({hasText:'预览完成'}).waitFor();
    assert.equal(await cloudPage.evaluate(()=>window.calls.filter(c=>c[0]==='prepare').length),3);
    assert.equal(await cloudPage.evaluate(()=>window.calls.some(c=>c[0]==='execute')),false);
    assert.equal(await cloudPage.getByRole('button',{name:'确认新建到飞书（2）',exact:true}).isEnabled(),false);
    await cloudPage.getByLabel('已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程',{exact:true}).check();
    assert.equal(await cloudPage.getByRole('button',{name:'确认新建到飞书（2）',exact:true}).isEnabled(),true);
    assert.equal(await cloudPage.evaluate(()=>window.calls.filter(c=>c[0]==='prepare').length),3,'write approval preserves reviewed readonly plans');
    for(const width of [950,650,400]){
      await cloudPage.setViewportSize({width,height:850});
      assert.equal(await cloudPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'cloud overflow '+width);
      assert.equal(await cloudPage.locator('.feishu-cloud-list').evaluate(e=>e.scrollHeight>e.clientHeight),true);
      await cloudPage.screenshot({path:path.join(output,'cloud-'+width+'.png'),fullPage:true});
    }
    await cloudPage.setViewportSize({width:650,height:850});
    await cloudPage.locator('.feishu-cloud-list').evaluate(e=>{e.scrollTop=900;e.scrollLeft=120;});
    await cloudPage.waitForFunction(()=>cloud.scrollTop===900&&cloud.scrollLeft===120);
    await cloudPage.evaluate(()=>window.renderFixture());
    await cloudPage.waitForFunction(()=>document.querySelector('.feishu-cloud-list').scrollTop===900);
    assert.equal(await cloudPage.locator('.feishu-cloud-list').evaluate(e=>e.scrollLeft),120,'horizontal scroll survives rerender');
    await cloudPage.evaluate(()=>{window.deferWrite=true;});
    await cloudPage.getByRole('button',{name:'确认新建到飞书（2）',exact:true}).click();
    await cloudPage.getByRole('button',{name:'停止批量建档',exact:true}).click();
    await cloudPage.locator('.feishu-cloud-progress[role=status]').filter({hasText:'正在停止'}).waitFor();
    assert.equal(await cloudPage.evaluate(()=>window.calls.filter(c=>c[0]==='execute').length),1);
    await cloudPage.evaluate(()=>window.resolveWrite({ok:true,status:'verified',recordId:'42'}));
    await cloudPage.locator('.feishu-cloud-progress[role=status]').filter({hasText:'已停止'}).waitFor();
    assert.equal(await cloudPage.evaluate(()=>window.calls.filter(c=>c[0]==='execute').length),1,'stop cannot dispatch next row');
    await cloudPage.screenshot({path:path.join(output,'cloud-stop-650.png'),fullPage:true});

    const productionPage = await context.newPage();
    productionPage.on('pageerror',e=>errors.push(e.message));
    productionPage.on('dialog',async d=>{
      assert.match(d.message(),/正式记录|补录以下/); assert.doesNotMatch(d.message(),/AI测试|AI_TEST|SYNC_/);
      if(d.message().includes('补录以下'))assert.match(d.message(),/工作项 51/);
      await d.accept();
    });
    await productionPage.goto('http://fixture.test'); await productionPage.addStyleTag({content:css});
    await productionPage.addScriptTag({content:setup+`
      connection={connected:true,target:'project/creator',fields:[
        {key:'name',name:'账号昵称',type:'text',required:true,options:[]},
        {key:'account',name:'小红书ID',type:'text',required:true,options:[]},
        {key:'contact',name:'联系方式',type:'text',required:false,options:[]},
        {key:'contact_time',name:'建联时间',type:'date',generated:'contact_time',options:[]}
      ]};
      currentRow='';cloud=null;operatorLease=null;operator={name:'Fixture Operator',token:'operator',checkedAt:new Date().toISOString()};
      operatorConfirmed=true;safetyConfirmed=false;window.calls=[];
      ctx.rows=[{rowId:'prod-a',creatorName:'正式样例甲',xhsId:'001234',selected:true},
        {rowId:'prod-b',creatorName:'正式样例乙',xhsId:'005678',wechatId:'fixture_wechat',selected:true}];
      window.desktopAPI.feishu.prepare=async p=>{
        if(p.recordMode!=='production'||Object.hasOwn(p.values,'contact_time'))throw Error('invalid production payload');
        window.calls.push(['prepare',p.rowId,p.values]);
        return {ok:true,token:'plan-'+p.rowId,action:'create',recordMode:'production',name:p.values.name,batch:'SYNC_fixture',
          target:'project/creator',expiresAt:Date.now()+300000,fields:[]};};
      window.desktopAPI.feishu.execute=async p=>{window.calls.push(['execute',p.token]);
        return {ok:true,action:'create',recordMode:'production',status:'verified',recordId:p.token==='plan-prod-a'?'51':'52'};};
      window.renderFixture();
    `});
    assert.equal(await productionPage.getByLabel('建档模式',{exact:true}).inputValue(),'production');
    assert.equal(await productionPage.getByLabel('建档联系方式 · 正式样例甲',{exact:true}).inputValue(),'');
    assert.equal(await productionPage.getByText('建联时间：提交时自动填写当前时间',{exact:true}).isVisible(),true);
    await productionPage.getByLabel('已核对建档名单的小红书号与达人对应关系',{exact:true}).check();
    await productionPage.getByRole('button',{name:'查重并预览选中行',exact:true}).click();
    await productionPage.locator('.feishu-cloud-progress[role=status]').filter({hasText:'预览完成'}).waitFor();
    assert.equal(await productionPage.evaluate(()=>window.calls.find(c=>c[1]==='prod-a')[2].contact),'');
    assert.equal(await productionPage.getByRole('button',{name:'确认新建到飞书（2）',exact:true}).isEnabled(),false);
    await productionPage.getByLabel('已核对正式新建／补录及通知影响；不发送邀约、不推进流程',{exact:true}).check();
    for(const width of [950,650,400]){
      await productionPage.setViewportSize({width,height:850});
      assert.equal(await productionPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'production overflow '+width);
      await productionPage.screenshot({path:path.join(output,'production-'+width+'.png'),fullPage:true});
    }
    await productionPage.getByRole('button',{name:'确认新建到飞书（2）',exact:true}).click();
    await productionPage.locator('.feishu-cloud-progress[role=status]').filter({hasText:'处理完成'}).waitFor();
    assert.equal(await productionPage.evaluate(()=>window.calls.filter(c=>c[0]==='execute').length),2);
    await productionPage.evaluate(()=>{
      window.desktopAPI.feishu.prepare=async p=>{
        if(p.action!=='enrich')throw Error('expected enrichment');
        window.calls.push(['enrich-prepare',p.rowId]);
        if(p.rowId==='prod-b')return {ok:true,noChanges:true,recordId:'52',fields:[]};
        return {ok:true,token:'enrich-prod-a',entryId:'fixture-enrich',action:'enrich',recordId:'51',name:'正式样例甲',
          target:'project/creator',expiresAt:Date.now()+300000,
          fields:[{field_key:'contact',before:'微信：old-fixture',field_value:'微信：old-fixture\n邮箱：new@example.invalid'}]};
      };
      window.desktopAPI.feishu.execute=async p=>{window.calls.push(['enrich-execute',p.token]);
        return {ok:true,action:'enrich',recordId:'51',status:'verified',entryId:'fixture-enrich'};};
    });
    await productionPage.getByLabel('飞书批量操作',{exact:true}).selectOption('enrich');
    await productionPage.getByLabel('已核对建档名单的小红书号与达人对应关系',{exact:true}).check();
    await productionPage.getByRole('button',{name:'查重并预览选中行',exact:true}).click();
    await productionPage.locator('.feishu-cloud-progress[role=status]').filter({hasText:'预览完成'}).waitFor();
    assert.equal(await productionPage.getByText('已是最新 · 无需写入',{exact:true}).isVisible(),true);
    assert.equal(await productionPage.getByText('目标工作项 51',{exact:true}).isVisible(),true);
    for(const width of [950,650,400]){
      await productionPage.setViewportSize({width,height:850});
      assert.equal(await productionPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'enrichment overflow '+width);
      await productionPage.screenshot({path:path.join(output,'enrichment-'+width+'.png'),fullPage:true});
    }
    await productionPage.getByRole('button',{name:'确认补录到飞书（1）',exact:true}).click();
    await productionPage.locator('.feishu-cloud-progress[role=status]').filter({hasText:'处理完成'}).waitFor();
    assert.equal(await productionPage.evaluate(()=>window.calls.filter(c=>c[0]==='enrich-execute').length),1);
    assert.deepEqual(errors,[]);
    console.log('Feishu source UI fixture passed; no real Feishu request/writes. Screenshots: '+output);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
