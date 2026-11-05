const fs=require('fs'),path=require('path'),cp=require('child_process');
const root='C:/Users/feibo/PGY-QA-Handoff/logs';
fs.mkdirSync(root,{recursive:true});
const lifecycle=path.join(root,'lifecycle.jsonl');
function log(x){fs.appendFileSync(lifecycle,JSON.stringify({at:new Date().toISOString(),...x})+'\n');}
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const exe='C:/Users/feibo/AppData/Local/Programs/pgy-workbench-qa/pgy-workbench-qa.exe';
const out=fs.openSync(path.join(root,'scheduled-main-out.log'),'a'),err=fs.openSync(path.join(root,'scheduled-main-error.log'),'a');
const child=cp.spawn(exe,[],{env,cwd:path.dirname(exe),stdio:['ignore',out,err],windowsHide:false});
log({event:'spawn',launcherPid:process.pid,parentPid:process.ppid,mainPid:child.pid,appData:env.APPDATA});
fs.writeFileSync(path.join(root,'launch-handle.json'),JSON.stringify({launcherPid:process.pid,parentPid:process.ppid,mainPid:child.pid,createdAt:new Date().toISOString(),exe,task:'PGY-QA-Manual-Handoff'},null,2));
child.on('error',e=>{log({event:'spawn-error',message:e.message});process.exitCode=1;});
child.on('exit',(code,signal)=>{log({event:'exit',mainPid:child.pid,code,signal});fs.closeSync(out);fs.closeSync(err);process.exitCode=code??1;});
