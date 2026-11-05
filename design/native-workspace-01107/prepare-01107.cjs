const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const root='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector',app=path.join(root,'desktop-app');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');const asar=require(path.join(app,'node_modules/@electron/asar'));
const old=path.join(app,'dist-native-workspace-01106/win-unpacked/resources/app.asar'),next=path.join(app,'dist-native-workspace-01107/win-unpacked/resources/app.asar');
const files=f=>asar.listPackage(f).map(n=>n.replace(/^[/\\]+/, '')).filter(n=>!asar.statFile(f,path.normalize(n)).files);
const a=files(old),b=files(next),changes=[];
for(const p of new Set([...a,...b])){let x,y;try{x=asar.extractFile(old,path.normalize(p));}catch{}try{y=asar.extractFile(next,path.normalize(p));}catch{}if(!x||!y||hash(x)!==hash(y))changes.push({path:p,oldSHA256:x&&hash(x),newSHA256:y&&hash(y)});}
const installed='C:/Users/feibo/AppData/Local/Programs/content-analyzer-desktop/resources/app.asar';
fs.writeFileSync('delta-01107.json',JSON.stringify({oldVersion:'0.1.106',version:'0.1.107',oldFiles:a.length,newFiles:b.length,changes,installedVersion:JSON.parse(asar.extractFile(installed,path.normalize('package.json'))).version,installedSHA256:hash(fs.readFileSync(installed))},null,2));
const diff=cp.spawnSync('git',['diff','--no-index','--','pre-01107/app.js',path.join(app,'renderer/app.js')],{encoding:'utf8'});if(diff.status>1)throw Error(diff.stderr);fs.writeFileSync('P2-01107.patch',diff.stdout);
const installer=path.join(app,'dist-native-workspace-01107',JSON.parse(fs.readFileSync('release-01107.json')).installer.filename);fs.copyFileSync(installer,'PGY-workspace-0.1.107-setup.exe');
const p=cp.spawnSync(process.execPath,[path.join(app,'tests/workspace_layout.test.mjs')],{encoding:'utf8'}),q=cp.spawnSync(process.execPath,[path.join(app,'tests/browser_layout.test.js')],{encoding:'utf8'});fs.writeFileSync('layout-tests-01107.log',p.stdout+p.stderr+q.stdout+q.stderr);if(p.status||q.status)throw Error('Layout tests failed');
console.log(JSON.stringify({changes,installedSHA256:hash(fs.readFileSync(installed))},null,2));
