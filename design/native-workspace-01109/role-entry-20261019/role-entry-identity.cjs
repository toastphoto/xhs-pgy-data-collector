const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app';
const asar=require(root+'/node_modules/@electron/asar');
const file='C:/Users/feibo/AppData/Local/Programs/pgy-workbench-qa/resources/app.asar';
const main=asar.extractFile(file,path.normalize('main.js')).toString();
const meta=JSON.parse(asar.extractFile(file,path.normalize('package.json')));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const result={checkedAt:new Date().toISOString(),version:meta.version,flavor:meta.buildFlavor,qaAsar:hash(file),formalAsar:hash('C:/Users/feibo/AppData/Local/Programs/content-analyzer-desktop/resources/app.asar'),sourceMainMatchesInstalled:main===fs.readFileSync(root+'/main.js','utf8'),invitePartitionSeparate:main.includes("partition: 'persist:pgy_invite'"),collectionPartitionSeparate:main.includes("partition: 'persist:pgy_default'"),mainPid:32552,supervisorPid:34624,backendPid:30820,credentialsRead:false,cookiesCopied:false};
fs.writeFileSync('ROLE-ENTRY-IDENTITY.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
