const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),http=require('http'),assert=require('assert/strict');
const {_electron}=require('C:/Users/feibo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app';
const asar=require(root+'/node_modules/@electron/asar');
const out=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'pgy-formal111-')),copy=path.join(temp,'app');
const hash=b=>require('crypto').createHash('sha256').update(b).digest('hex');
const delay=n=>new Promise(r=>setTimeout(r,n));
const ps=cmd=>cp.execFileSync('powershell.exe',['-NoProfile','-Command',cmd],{encoding:'utf8',windowsHide:true}).trim();
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const get=port=>new Promise(resolve=>{const r=http.get(`http://127.0.0.1:${port}/api/desktop/health`,res=>{let s='';res.on('data',b=>s+=b);res.on('end',()=>{try{resolve(JSON.parse(s));}catch{resolve(null);}});});r.on('error',()=>resolve(null));r.setTimeout(800,()=>r.destroy());});
const result={version:'0.1.111',scope:'Windows unpacked formal runtime with explicit isolation bootstrap; NOT NSIS install',realDataUsed:false,cases:[]};let app,ownedMain;
(async()=>{
 fs.cpSync(root+'/dist-formal-01111-review/win-unpacked',copy,{recursive:true});
 const archive=copy+'/resources/app.asar',extracted=temp+'/extracted';asar.extractAll(archive,extracted);
 const meta=JSON.parse(fs.readFileSync(extracted+'/package.json'));assert.equal(meta.buildFlavor,undefined);
 const mainBefore=hash(fs.readFileSync(extracted+'/main.js'));meta.main='isolated_bootstrap.cjs';fs.writeFileSync(extracted+'/package.json',JSON.stringify(meta));
 const profile=temp+'/profile';fs.mkdirSync(profile+'/sessions',{recursive:true});
 fs.writeFileSync(extracted+'/isolated_bootstrap.cjs',`const {app}=require('electron');const fs=require('fs');app.setPath('userData',process.env.PGY_FIXTURE_PROFILE);app.setPath('sessionData',process.env.PGY_FIXTURE_PROFILE+'/sessions');require('./main.js');`);
 await asar.createPackageWithOptions(extracted,archive,{unpack:'**/node_modules/sql.js/dist/sql-wasm.wasm'});
 asar.uncache(archive);
 assert.equal(hash(asar.extractFile(archive,'main.js')),mainBefore);
 result.isolationDiff=['package.json main only','added isolated_bootstrap.cjs','userData/sessionData -> new temporary profile','API_PORT -> 18111','DATA_DIR/OUTPUT_DIR/LOG_DIR -> temporary profile','DNS external blocked'];
 const exe=copy+'/'+JSON.parse(fs.readFileSync(root+'/package.json')).build.productName+'.exe';
 const env={...process.env,ELECTRON_START_BACKEND:'true',API_HOST:'127.0.0.1',API_PORT:'18111',PGY_FIXTURE_PROFILE:profile,DATA_DIR:profile+'/backend/data',OUTPUT_DIR:profile+'/backend/output',LOG_DIR:profile+'/backend/logs'};delete env.ELECTRON_RUN_AS_NODE;
 fs.mkdirSync(profile+'/templates',{recursive:true});const fixtureFile=profile+'/templates/fixture-protected.json';fs.writeFileSync(fixtureFile,JSON.stringify({name:'[AI测试] protected synthetic fixture',revision:7}));const fixtureHash=hash(fs.readFileSync(fixtureFile));
 for(const mode of ['normal','crash','restart']){
  assert.equal(await get(18111),null,'isolated port must be vacant');
  app=await _electron.launch({executablePath:exe,args:['--host-resolver-rules=MAP * ~NOTFOUND'],env,timeout:30000});
  const context=await app.evaluate(({app})=>({pid:process.pid,userData:app.getPath('userData'),sessionData:app.getPath('sessionData'),packaged:app.isPackaged}));ownedMain=context.pid;assert.equal(path.resolve(context.userData),path.resolve(profile));assert.equal(context.packaged,true);
  let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().includes('renderer/index.html'));if(page)break;await delay(100);}await page.waitForSelector('#sidebar');
  let h;for(let i=0;i<100;i++){h=await get(18111);if(h?.instance_token&&h.protocol_version==='1')break;await delay(300);}assert.ok(h?.instance_token);
  const chain=[h.pid];while(chain.at(-1)!==ownedMain&&chain.length<8){chain.push(Number(ps(`(Get-CimInstance Win32_Process -Filter 'ProcessId=${chain.at(-1)}').ParentProcessId`)));}assert.equal(chain.at(-1),ownedMain);assert.ok(chain.length>=3);
  const info=await page.evaluate(()=>window.desktopAPI.backend.info());assert.equal(info.running,true);
  if(mode==='normal')await page.screenshot({path:out+'/FORMAL111-ISOLATED.png'});
  const backendPids=JSON.parse(ps(`ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq ${h.pid} -or $_.ParentProcessId -eq ${h.pid} -or $_.ProcessId -eq ${chain[1]} } | Select-Object -ExpandProperty ProcessId)`));
  if(mode==='crash'){process.kill(ownedMain);await app.waitForEvent('close',{timeout:15000}).catch(()=>{});}else await app.close();app=null;
  for(let i=0;i<60;i++){if(!alive(ownedMain)&&backendPids.every(pid=>!alive(pid))&&!(await get(18111)))break;await delay(250);}
  const gone=!alive(ownedMain)&&backendPids.every(pid=>!alive(pid));assert.equal(gone,true,'owned Windows tree must exit');assert.equal(await get(18111),null);
  assert.equal(hash(fs.readFileSync(fixtureFile)),fixtureHash);
  result.cases.push({mode,mainPid:ownedMain,ownedPidChain:chain,observedBackendTreePids:backendPids,treeExited:true,portReleased:true,syntheticFixtureUnchanged:true,healthTokenSaved:false});ownedMain=null;
 }
 result.ok=true;
})().catch(e=>{result.ok=false;result.error=String(e.message).slice(0,240);process.exitCode=1;}).finally(async()=>{if(app)await app.close().catch(()=>{});fs.writeFileSync(out+'/WINDOWS-FORMAL111.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));});
