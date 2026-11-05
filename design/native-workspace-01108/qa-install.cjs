const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),os=require('os'),assert=require('assert/strict');const {_electron}=require('playwright');
const app='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app',release=path.join(app,'dist-coexist-qa-01108-release');
const installDir='C:/Users/feibo/AppData/Local/Programs/pgy-workbench-qa';
const formalDir='C:/Users/feibo/AppData/Local/Programs/content-analyzer-desktop';const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function registry(){const s=cp.execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); @(Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'PGY Workbench QA|小红书相关信息采集工具' } | Select-Object PSChildName,DisplayName,DisplayVersion,UninstallString) | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true}).trim();return s?JSON.parse(s):[];}
function snapshot(){const shortcuts=[];for(const root of [path.join(process.env.APPDATA,'Microsoft/Windows/Start Menu/Programs'),path.join(process.env.USERPROFILE,'Desktop'),'C:/Users/Public/Desktop']){if(!fs.existsSync(root))continue;function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(e.name.startsWith('小红书相关信息采集工具')&&e.name.endsWith('.lnk'))shortcuts.push({file:f,sha256:hash(f)});}}walk(root);}const r=registry();return {formalAsar:hash(path.join(formalDir,'resources/app.asar')),formalRegistry:(Array.isArray(r)?r:[r]).filter(x=>x.DisplayName.startsWith('小红书')),formalShortcuts:shortcuts};}
let control;
(async()=>{
 const before=snapshot();fs.writeFileSync('formal-install-before.json',JSON.stringify(before,null,2));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pgy-qa-formal-control-'));const env={...process.env,ELECTRON_START_BACKEND:'false'};delete env.ELECTRON_RUN_AS_NODE;
 control=await _electron.launch({executablePath:path.join(formalDir,'小红书相关信息采集工具.exe'),args:['--user-data-dir='+profile,'--host-resolver-rules=MAP * ~NOTFOUND'],env});
 const formalPid=await control.evaluate(()=>process.pid);
 const installer=path.join(app,'dist-coexist-qa-01108-safe/PGY-Workbench-QA-0.1.108-setup.exe');console.log('Installing isolated QA identity');
 const p=cp.spawnSync(installer,['/S'],{windowsHide:true,timeout:90000});assert.equal(p.status,0);
 const installedAsar=path.join(installDir,'resources/app.asar');assert.equal(hash(installedAsar),hash(path.join(release,'win-unpacked/resources/app.asar')));
 assert.equal(await control.evaluate(()=>process.pid),formalPid);assert.deepEqual(snapshot(),before);
 const rows=registry(),list=Array.isArray(rows)?rows:[rows];const qa=list.find(x=>x.PSChildName.toLowerCase()==='86505d45-1343-47e6-9b32-92faec441da9');assert.ok(qa);assert.ok(qa.UninstallString.includes('pgy-workbench-qa'));assert.equal(qa.DisplayVersion,'0.1.108');
 const result={ok:true,channel:'coexist-qa',installDir,installedAsarSHA256:hash(installedAsar),installerSHA256:hash(installer),installerBytes:fs.statSync(installer).size,qaRegistry:qa,formalUnchanged:true,formalControlStayedLive:true,operatorProfileOpened:false};fs.writeFileSync('qa-install-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(control)try{await control.close()}catch{}});
