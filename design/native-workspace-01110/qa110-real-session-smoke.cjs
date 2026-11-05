// Read-only smoke of the default QA profile after upgrade; no fixtures or session copying.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {_electron}=require('C:/Users/feibo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='C:/Users/feibo/PGY-QA-Handoff/QA110-SESSION-SMOKE.json';let app;
const result={version:'0.1.110',scope:'default QA readonly page entry and role switch',startedAt:new Date().toISOString(),credentialsRead:false,sessionCopied:false,fixturesInstalled:false,sent:false,feishuWrites:false};
(async()=>{
 const env={...process.env,ELECTRON_START_BACKEND:'true'};delete env.ELECTRON_RUN_AS_NODE;
 app=await _electron.launch({executablePath:'C:/Users/feibo/AppData/Local/Programs/pgy-workbench-qa/pgy-workbench-qa.exe',args:[],env,timeout:30000});
 result.mainPid=await app.evaluate(({app})=>{global.sessionSmokeProfile=app.getPath('userData');return process.pid;});
 result.defaultQaProfile=await app.evaluate(()=>global.sessionSmokeProfile.replace(/\\/g,'/').endsWith('/pgy-workbench-qa/profile'));
 let p;for(let i=0;i<100;i++){p=app.windows().find(w=>w.url().includes('/renderer/index.html'));if(p)break;await new Promise(r=>setTimeout(r,100));}
 await p.waitForSelector('#sidebar');
 const collection=await p.evaluate(()=>window.desktopAPI.browser.openCollection('https://pgy.xiaohongshu.com/solar/pre-trade/note/kol'));
 assert.equal(collection.ok,true);await p.waitForTimeout(3000);
 const c=await p.evaluate(()=>window.desktopAPI.pgy.checkLogin());result.collectionLoggedIn=!!c.loggedIn;result.collectionRisk=!!c.riskDetected;
 if(result.collectionRisk)throw Error('RISK_STOP');
 await app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/index.html'));global.smokeCollection=w.getBrowserViews()[0].webContents;global.smokeURL=global.smokeCollection.getURL();global.smokeScroll=await global.smokeCollection.executeJavaScript('window.scrollY');});
 const entry=await p.evaluate(()=>window.desktopAPI.invites.openAccount());result.inviteEntryOk=!!entry.ok;assert.equal(entry.ok,true);
 await p.waitForTimeout(3000);const i=await p.evaluate(()=>window.desktopAPI.invites.checkLogin());result.inviteLoggedIn=!!i.loggedIn;result.inviteRisk=!!i.riskDetected;
 if(result.inviteRisk)throw Error('RISK_STOP');
 const tabs=await p.evaluate(()=>window.desktopAPI.browser.listTabs());const ct=tabs.tabs.find(t=>t.role==='collection'),it=tabs.tabs.find(t=>t.role==='pgy-invite');
 assert.ok(ct&&it);assert.equal((await p.evaluate(id=>window.desktopAPI.browser.activateTab(id),ct.id)).ok,true);
 result.collectionStateRetained=await app.evaluate(async()=>!global.smokeCollection.isDestroyed()&&global.smokeCollection.getURL()===global.smokeURL&&(await global.smokeCollection.executeJavaScript('window.scrollY'))===global.smokeScroll);
 assert.equal((await p.evaluate(id=>window.desktopAPI.browser.activateTab(id),it.id)).ok,true);
 result.distinctSessions=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/index.html'));const v=w.getBrowserViews();return v.length>=2&&v[0].webContents.session!==v[1].webContents.session;});
 result.switchOk=true;result.ok=result.collectionLoggedIn&&result.inviteLoggedIn&&result.collectionStateRetained&&result.distinctSessions;
 if(!result.ok)throw Error('LOGIN_OR_STATE_NOT_VERIFIED');
})().catch(e=>{result.ok=false;result.errorCategory=e.message==='RISK_STOP'?'RISK_STOP':e.message==='LOGIN_OR_STATE_NOT_VERIFIED'?e.message:'SMOKE_FAILED';process.exitCode=1;}).finally(async()=>{if(app)try{await app.close();result.normalClose=true;}catch{result.normalClose=false;}result.finishedAt=new Date().toISOString();fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));});
