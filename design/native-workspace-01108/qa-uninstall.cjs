const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const dir='C:/Users/feibo/AppData/Local/Programs/pgy-workbench-qa',formal='C:/Users/feibo/AppData/Local/Programs/content-analyzer-desktop/resources/app.asar';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
(async()=>{
 const original=JSON.parse(fs.readFileSync('formal-install-before.json'));assert.equal(hash(formal),original.formalAsar);
 const uninstaller=path.join(dir,'Uninstall pgy-workbench-qa.exe');
 if(fs.existsSync(uninstaller)){const p=cp.spawnSync(uninstaller,['/S','/currentuser'],{windowsHide:true,timeout:60000});assert.equal(p.status,0);}
 const exe=path.join(dir,'pgy-workbench-qa.exe');for(let i=0;i<100&&fs.existsSync(exe);i++)await new Promise(r=>setTimeout(r,100));assert.equal(fs.existsSync(exe),false);
 const query="[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $p='HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/86505d45-1343-47e6-9b32-92faec441da9'; if(Test-Path -LiteralPath $p){exit 1}; @(Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '小红书相关信息采集工具*' } | Select-Object PSChildName,DisplayName,DisplayVersion,UninstallString) | ConvertTo-Json -Compress";
 let rows;for(let i=0;i<30;i++){try{rows=JSON.parse(cp.execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',query],{encoding:'utf8',windowsHide:true}));break;}catch(e){if(i===29)throw e;await new Promise(r=>setTimeout(r,250));}}assert.deepEqual(Array.isArray(rows)?rows:[rows],original.formalRegistry);
 for(const link of original.formalShortcuts)assert.equal(hash(link.file),link.sha256);assert.equal(hash(formal),original.formalAsar);
 const qaLink=path.join(process.env.APPDATA,'Microsoft/Windows/Start Menu/Programs/PGY Workbench QA.lnk');assert.equal(fs.existsSync(qaLink),false);
 fs.writeFileSync('qa-uninstall-result.json',JSON.stringify({ok:true,qaExecutableRemoved:true,qaUninstallKeyRemoved:true,qaShortcutRemoved:true,formalFilesRegistryShortcutsUnchanged:true,profilesDeleted:false},null,2));console.log('QA uninstall and formal preservation PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
