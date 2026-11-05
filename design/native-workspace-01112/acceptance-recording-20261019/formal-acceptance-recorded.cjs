// Runs only under the existing interactive Windows user. Private data/manifests
// remain under that user's PGY-RestorePoints and are never returned to Multica.
if(process.env.PGY_ENABLE_REVIEWED_ACCEPTANCE!=='1')throw Error('REVIEW_ONLY_NOT_ACTIVATED');
const fs=require('fs'),path=require('path'),cp=require('child_process'),http=require('http'),crypto=require('crypto'),assert=require('assert/strict');
const {_electron}=require('C:/Users/feibo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app',asar=require(source+'/node_modules/@electron/asar');
const home=path.join(process.env.USERPROFILE,'PGY-Formal-Handoff'),request=JSON.parse(fs.readFileSync(home+'/request.json','utf8').replace(/^\uFEFF/,''));
const dir=path.join(process.env.LOCALAPPDATA,'Programs/content-analyzer-desktop'),exe=path.join(dir,'小红书相关信息采集工具.exe'),archive=path.join(dir,'resources/app.asar');
const h=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const delay=n=>new Promise(r=>setTimeout(r,n));
const ps=s=>cp.execFileSync('powershell.exe',['-NoProfile','-Command',"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);"+s],{encoding:'utf8',windowsHide:true}).trim();
const procs=()=>JSON.parse(ps('ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,ExecutablePath,CreationDate)'));
const formalProcesses=()=>procs().filter(p=>String(p.ExecutablePath||'').toLowerCase().startsWith(dir.toLowerCase()+path.sep));
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const health=()=>new Promise(resolve=>{const r=http.get('http://127.0.0.1:8010/api/desktop/health',res=>{let s='';res.on('data',b=>s+=b);res.on('end',()=>{try{resolve(JSON.parse(s));}catch{resolve(null);}});});r.on('error',()=>resolve(null));r.setTimeout(1000,()=>r.destroy());});
function entries(root,prefix='') {return fs.readdirSync(path.join(root,prefix),{withFileTypes:true}).flatMap(e=>{const rel=path.join(prefix,e.name),full=path.join(root,rel);assert(!fs.lstatSync(full).isSymbolicLink(),'RECOVERY_REPARSE_POINT');return e.isDirectory()?entries(root,rel):e.isFile()?[{rel,bytes:fs.statSync(full).size,sha256:h(full)}]:[];}).sort((a,b)=>a.rel.localeCompare(b.rel));}
function protectedState(profile){const names=['runs','templates','contact_reviews','signing_tasks','execution_approvals','db','export_presets'];return Object.fromEntries(names.map(n=>{const p=path.join(profile,n),files=fs.existsSync(p)?entries(p):[];return[n,{files:files.length,bytes:files.reduce((a,f)=>a+f.bytes,0),digest:digest(JSON.stringify(files))}];}));}
function installed(){asar.uncache(archive);const p=JSON.parse(asar.extractFile(archive,'package.json'));return {version:p.version,asarSHA256:h(archive),name:p.name};}
const expected={ '0.1.105':'38d1ae79bddd7f88214ef6c9571db8a24a1198859a2206d3671eff93f5385960','0.1.112':'dac62f7ffd178f7aa4f0d97ce14f249d5484f159b4be6c12cbd59d734512256c' };
function assertInstalled(version){const s=installed();assert.equal(s.version,version);assert.equal(s.asarSHA256,expected[version]);return s;}
const result={phase:request.phase,startedAt:new Date().toISOString(),sensitiveDataUploaded:false,collectionsRun:false,invitationsSent:false,feishuWrites:false};let app;
(async()=>{
 if(request.phase==='prepare'){
  result.installed=assertInstalled('0.1.105');assert.equal(formalProcesses().length,0,'FORMAL_PROCESS_STILL_RUNNING');assert.equal(await health(),null,'8010_OCCUPIED');
  const envKeys=['API_HOST','API_PORT','DATA_DIR','OUTPUT_DIR','LOG_DIR'];const overrides=Object.fromEntries(envKeys.filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  assert.equal(Object.keys(overrides).length,0,'ENVIRONMENT_OVERRIDE_REQUIRES_REVIEW');
  const profile=path.join(process.env.APPDATA,'content-analyzer-desktop');assert(fs.existsSync(profile));
  const point=path.join(process.env.USERPROFILE,'PGY-RestorePoints','formal105-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(point,{recursive:true});
  const account=process.env.USERDOMAIN+'\\'+process.env.USERNAME;
  cp.execFileSync('icacls.exe',[point,'/inheritance:r','/grant:r',account+':(OI)(CI)F','SYSTEM:(OI)(CI)F'],{windowsHide:true,stdio:'ignore'});
  const before=entries(profile);const protectedBaseline=protectedState(profile);
  const bytes=before.reduce((a,f)=>a+f.bytes,0),space=fs.statfsSync(point);assert(space.bavail*space.bsize>bytes*3+1024**3,'INSUFFICIENT_RECOVERY_SPACE');
  const snapshot=path.join(point,'snapshot/profile');fs.mkdirSync(path.dirname(snapshot),{recursive:true});fs.cpSync(profile,snapshot,{recursive:true,errorOnExist:true,force:false});
  assert.deepEqual(entries(snapshot),before);assert.deepEqual(entries(profile),before);
  const verified=path.join(point,'verified-restore/profile');fs.mkdirSync(path.dirname(verified),{recursive:true});fs.cpSync(snapshot,verified,{recursive:true,errorOnExist:true,force:false});assert.deepEqual(entries(verified),before);
  const state={point,profile,sessionData:profile,overrides,files:before,protectedBaseline,baseline:result.installed,createdAt:new Date().toISOString(),qaProfileExcluded:true,verifiedRestorationToPrivateScratch:true};
  fs.writeFileSync(point+'/private-manifest.json',JSON.stringify(state,null,2));fs.writeFileSync(home+'/state-private.json',JSON.stringify(state,null,2));
  result.recoveryPoint=point.replace(process.env.USERPROFILE,'%USERPROFILE%');result.profile=profile.replace(process.env.APPDATA,'%APPDATA%');result.files=before.length;result.bytes=bytes;result.snapshotVerified=true;result.restoreReadbackVerified=true;result.sourceUnchangedDuringCopy=true;result.protectedBaseline=protectedBaseline;
  result.actualEnvironmentOverrides=[];result.formalProcessesBefore=0;result.port8010Vacant=true;
 } else {
  const state=JSON.parse(fs.readFileSync(home+'/state-private.json','utf8'));assert(state.verifiedRestorationToPrivateScratch);
  assert.deepEqual(entries(state.point+'/snapshot/profile'),state.files,'RESTORE_POINT_CHANGED');
  if(request.phase==='install112'||request.phase==='install105'){
   assert.equal(formalProcesses().length,0,'FORMAL_PROCESS_STILL_RUNNING');assert.equal(await health(),null,'8010_OCCUPIED');
   const version=request.phase==='install112'?'0.1.112':'0.1.105';
   const installer=version==='0.1.112'?source+'/dist-formal-01112-review/PGY-Workbench-0.1.112-formal-candidate-setup.exe':source+'/dist-invite-selection-01105-final/小红书相关信息采集工具-0.1.105-windows-x64-setup.exe';
   const wanted=version==='0.1.112'?'adcd1aff1730f6a978c12729a1123bbf56c676d5fbfcaa34cbebbd3d12ccc4d2':'c4d28c9eba07080fd2459b6a20f4e22ce0053316737fe781cae7ceb91610a3a4';assert.equal(h(installer),wanted);
   const run=cp.spawnSync(installer,['/S'],{windowsHide:true,timeout:120000});assert.equal(run.status,0,'INSTALLER_FAILED');
   result.installerExit=run.status;result.installerSHA256=wanted;result.installed=assertInstalled(version);result.protectedState=protectedState(state.profile);assert.deepEqual(result.protectedState,state.protectedBaseline,'PROTECTED_DATA_CHANGED_DURING_INSTALL');
   result.originalRecordsTemplatesReviewsUnchanged=true;result.autoStartedPids=formalProcesses().map(p=>p.ProcessId);
  } else if(request.phase==='verify'){
   result.installed=assertInstalled(request.version);assert.equal(formalProcesses().length,0,'UNEXPECTED_EXISTING_FORMAL_INSTANCE');assert.equal(await health(),null,'8010_OCCUPIED');
   const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
   app=await _electron.launch({executablePath:exe,args:[],env,timeout:30000});
   const paths=await app.evaluate(({app})=>({pid:process.pid,userData:app.getPath('userData'),sessionData:app.getPath('sessionData')}));assert.equal(path.resolve(paths.userData),path.resolve(state.profile));assert.equal(path.resolve(paths.sessionData),path.resolve(state.sessionData));
   result.mainPid=paths.pid;result.actualDataPathsMatch=true;
   let p;for(let i=0;i<150;i++){p=app.windows().find(w=>w.url().includes('renderer/index.html'));if(p)break;await delay(100);}await p.waitForSelector('#sidebar');
   let server;for(let i=0;i<100;i++){server=await health();if(server?.instance_token&&server.protocol_version==='1')break;await delay(300);}assert(server?.instance_token);
   const all=procs(),chain=[server.pid];while(chain.at(-1)!==paths.pid&&chain.length<8){chain.push(all.find(p=>p.ProcessId===chain.at(-1))?.ParentProcessId);}assert.equal(chain.at(-1),paths.pid);result.ownedPidChain=chain;
   const service=await p.evaluate(()=>window.desktopAPI.backend.info());assert.equal(service.running,true);result.serviceOwnedAndHealthy=true;
   // Read only account entry and login checks; no collection/preparation/actions.
   if(request.checkLogin){
    assertInstalled('0.1.112');
    const probeRecorder=require('./acceptance-probe-record.cjs').createRecorder({file:home+'/'+request.id+'-probe-evidence.jsonl',patterns:require('./acceptance-risk-patterns.json')});
    await probeRecorder.runNavigation(()=>p.evaluate(()=>window.desktopAPI.browser.openCollection('https://pgy.xiaohongshu.com/solar/pre-trade/note/kol')),'collection');await delay(2000);
    const collection=await probeRecorder.runProbe(()=>p.evaluate(()=>window.desktopAPI.pgy.checkLogin()),{role:'collection',stage:'check-login'});
    result.collectionLoggedIn=collection.loggedIn;result.collectionRisk=collection.riskDetected;
    await probeRecorder.runNavigation(()=>p.evaluate(()=>window.desktopAPI.invites.openAccount()),'invite');await delay(2000);
    const invite=await probeRecorder.runProbe(()=>p.evaluate(()=>window.desktopAPI.invites.checkLogin()),{role:'invite',stage:'check-login'});
    result.inviteLoggedIn=invite.loggedIn;result.inviteRisk=invite.riskDetected;
    result.rolesHaveDistinctSessions=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('renderer/index.html'));const v=w.getBrowserViews();return v.length>=2&&v[0].webContents.session!==v[1].webContents.session;});assert(result.rolesHaveDistinctSessions);
   }
   await p.screenshot({path:home+'/'+request.id+'-sanitized.png',clip:{x:0,y:0,width:Math.min(1200,(await p.viewportSize())?.width||1200),height:78},mask:[p.locator('input')]});
   const owned=procs().filter(x=>String(x.ExecutablePath||'').toLowerCase().startsWith(dir.toLowerCase()+path.sep)).map(x=>x.ProcessId);result.observedOwnedPids=owned;
   await app.close();app=null;
   for(let i=0;i<60;i++){if(owned.every(x=>!alive(x))&&!(await health()))break;await delay(250);}
   result.ownedTreeExited=owned.every(x=>!alive(x));result.portReleased=!(await health());assert(result.ownedTreeExited&&result.portReleased,'NORMAL_EXIT_FAILED');
   result.protectedState=protectedState(state.profile);assert.deepEqual(result.protectedState,state.protectedBaseline,'ORIGINAL_PROTECTED_DATA_CHANGED');result.originalRecordsTemplatesReviewsUnchanged=true;
  } else if(request.phase==='audit'){
   result.installed=assertInstalled('0.1.105');
   result.registryVersion=ps("(Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\d55c6d3d-3f57-54cc-858a-fd18f776e68a').DisplayVersion");
   assert.equal(result.registryVersion,'0.1.105');
   result.qaAsarSHA256=h(path.join(process.env.LOCALAPPDATA,'Programs/pgy-workbench-qa/resources/app.asar'));
   assert.equal(result.qaAsarSHA256,'866f96145f298babd0386f078a0ff666695a8223339b66d763c91f267e96e4d2');
   result.aclInheritanceDisabled=ps("(Get-Acl -LiteralPath '"+state.point.replaceAll("'","''")+"').AreAccessRulesProtected")==='True';assert(result.aclInheritanceDisabled);
   result.protectedState=protectedState(state.profile);assert.deepEqual(result.protectedState,state.protectedBaseline);result.originalRecordsTemplatesReviewsUnchanged=true;
   result.formalProcessesBeforeHandoff=formalProcesses().length;assert.equal(result.formalProcessesBeforeHandoff,0);assert.equal(await health(),null);
   result.recoveryPoint=state.point.replace(process.env.USERPROFILE,'%USERPROFILE%');
  } else if(request.phase==='auditBackend'){
   result.installed=assertInstalled('0.1.105');result.backendDataChecks={};
   for(const rel of ['content-analyzer/data','content-analyzer/output']){
    const prefix=rel.replaceAll('/',path.sep)+path.sep;
    const original=state.files.filter(x=>x.rel.startsWith(prefix)).map(x=>({...x,rel:x.rel.slice(prefix.length)}));
    const current=fs.existsSync(path.join(state.profile,rel))?entries(path.join(state.profile,rel)):[];
    assert.deepEqual(current,original,'BACKEND_PERSISTENT_DATA_CHANGED');result.backendDataChecks[rel]={files:current.length,unchanged:true};
   }
  } else throw Error('UNKNOWN_PHASE');
 }
 result.ok=true;
})().catch(e=>{result.ok=false;result.errorCategory=String(e.message).split('\n')[0].slice(0,140);process.exitCode=1;}).finally(async()=>{
 if(app)await app.close().catch(()=>{});
 result.finishedAt=new Date().toISOString();fs.writeFileSync(home+'/'+request.id+'-result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({id:request.id,ok:result.ok,errorCategory:result.errorCategory}));
});
