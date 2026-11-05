const fs=require('fs'),path=require('path'),assert=require('assert/strict');const {_electron}=require('playwright');let a;
(async()=>{const env={...process.env,ELECTRON_START_BACKEND:'false'};delete env.ELECTRON_RUN_AS_NODE;
 a=await _electron.launch({executablePath:'C:/Users/feibo/AppData/Local/Programs/pgy-workbench-qa/pgy-workbench-qa.exe',args:['--host-resolver-rules=MAP * ~NOTFOUND'],env});
 const root=await a.evaluate(({app})=>app.getPath('userData'));assert.ok(root.toLowerCase().endsWith(path.normalize('pgy-workbench-qa/profile').toLowerCase()));
 const runs=path.join(root,'runs');fs.mkdirSync(runs,{recursive:true});const runDir=fs.mkdtempSync(path.join(runs,'run_qa_manual_ime_'));
 for(const id of ['QA_IME01','QA_IME02']){const dir=path.join(runDir,id);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'raw_result.json'),JSON.stringify({platform:'pgy',creator_url:'https://fixture.invalid/'+id,creator_summary:{creator_name:'[AI测试] 输入法 '+id}}));}
 let p;for(let i=0;i<100;i++){p=a.windows().find(w=>w.url().includes('/renderer/index.html'));if(p)break;await new Promise(r=>setTimeout(r,100));}assert.ok(p);await p.waitForSelector('#sidebar');
 const saved=await p.evaluate(runDir=>window.desktopAPI.exports.saveContactReview({runDir,reviewRows:[],settings:{selectionPolicy:'manual_opt_in_v1',composerMethod:'蒲公英邀约',pgyIntro:'这是独立测试草稿，请用真实中文输入法分段编辑。'}}),runDir);assert.equal(saved.ok,true);
 fs.writeFileSync('QA-MANUAL-DATA.json',JSON.stringify({ok:true,runName:path.basename(runDir),rows:2,selected:false,urls:'fixture.invalid; cannot prepare PGY invitations',productionDataCopied:false},null,2));console.log('Independent IME-only fictional run prepared; no recipient selected');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(a)await a.close();});
