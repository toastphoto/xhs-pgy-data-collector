const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const file=process.argv[2]||'C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app/lib/qa_backend_supervisor.js';
const {createSupervisor}=require(file),delay=n=>new Promise(r=>setTimeout(r,n));
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
let child,helper,sentinel;const result={scope:'Windows real process handles; production supervisor factory; first cleanup executable replaced by deliberately hung Node helper',formalInstallation:false,realDataAccessed:false,attempts:[],messages:[]};
(async()=>{
 sentinel=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});
 let tick,exited=false,helperClosed=false,activeHelpers=0,maxActive=0;
 const controller=createSupervisor({platform:'win32',spawn:(exe,args,opts)=>{
   if(!child){child=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],opts);return child;}
   const first=result.attempts.length===0;
   const p=first?cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],opts):cp.spawn(exe,args,opts);
   helper=p;activeHelpers++;maxActive=Math.max(maxActive,activeHelpers);result.attempts.push({helperPid:p.pid,ownedTargetPid:child.pid,firstDeliberatelyHung:first});
   p.once('close',()=>{activeHelpers--;helperClosed=true;});return p;
 },send:m=>result.messages.push(m),exit:()=>{exited=true;},setTimer:fn=>{tick=fn;return{unref(){}};}});
 controller.start({parentPid:process.pid,executable:'test-only-backend'});result.backendPid=child.pid;result.sentinelPid=sentinel.pid;
 controller.stop();for(let i=0;i<5;i++)controller.stop();assert.equal(result.attempts.length,1);
 for(let i=0;i<10;i++){await delay(500);tick();}
 for(let i=0;i<60&&!helperClosed;i++)await delay(50);assert.equal(helperClosed,true);assert.equal(alive(child.pid),true);assert.equal(alive(sentinel.pid),true);
 assert.equal(result.attempts.length,1);controller.stop();
 for(let i=0;i<100&&!exited;i++)await delay(100);
 assert.equal(exited,true);assert.equal(result.attempts.length,2);assert.equal(maxActive,1);assert.equal(alive(child.pid),false);assert.equal(alive(sentinel.pid),true);
 result.noOverlappingHelpers=true;result.firstHelperExitedBeforeRetry=true;result.newCleanupAttemptOnSecondRequest=true;result.ownedBackendExited=true;result.unrelatedSentinelUntouched=true;result.ok=true;
})().catch(e=>{result.ok=false;result.error=String(e.message);process.exitCode=1;}).finally(async()=>{
 for(const p of [helper,child,sentinel]){if(p&&alive(p.pid)){p.kill();await new Promise(r=>{p.once('close',r);setTimeout(r,2000);});}}
 fs.writeFileSync('WINDOWS112-HUNG-CLEANUP.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
});
