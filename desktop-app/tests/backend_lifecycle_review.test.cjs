'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||'formal111-input/app');
const main=fs.readFileSync(path.join(root,'main.js'),'utf8').replace(/\r\n/g,'\n');
const supervisorSource=fs.readFileSync(path.join(root,'lib/qa_backend_supervisor.js'),'utf8');
const results=[],observations={};
function section(a,b){const i=main.indexOf(a),j=main.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return main.slice(i,j);}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(packaged=true,forkFactory=null){
 const h={children:[],events:[],pending:[],timers:[],handlers:{},messages:[],dialogs:[],quits:0};
 function spawn(){if(forkFactory){const p=forkFactory();h.children.push(p);return p;}const p=new EventEmitter();Object.assign(p,{pid:51000+h.children.length,exitCode:null,signalCode:null,connected:true,stdout:new EventEmitter(),stderr:new EventEmitter()});
  p.kill=()=>{p.kills=(p.kills||0)+1;if(p.killMode==='throw')throw Error('fixture denied');return p.killMode!=='false';};
  p.send=(message,callback)=>{h.messages.push({p,message});if(p.sendMode==='throw')throw Error('fixture ipc denied');if(p.sendMode==='callback-error')callback?.(Error('fixture ipc denied'));};
  h.children.push(p);return p;
 }
 const app=new EventEmitter();app.isPackaged=packaged;app.getPath=()=> 'C:/synthetic/profile';
 app.quit=()=>{h.quits++;const e={prevented:false,preventDefault(){this.prevented=true;}};app.emit('before-quit',e);h.quitPrevented=e.prevented;};
 const win=new EventEmitter();win.webContents={send:(_,payload)=>h.events.push(payload)};
 const c=vm.createContext({require:()=>({fork:spawn}),spawn,process:{env:{},pid:50000,resourcesPath:'C:/synthetic/resources',platform:'win32'},app,
  path,crypto,fs:{existsSync:()=>h.exists!==false},__dirname:'C:/synthetic/app',qaRuntime:{active:false},isolatedRuntime:{active:false},bitableRuntime:{active:false},backendProc:null,backendInstanceToken:'',backendGeneration:0,backendStopping:false,
  DEFAULT_API_HOST:'127.0.0.1',DEFAULT_API_PORT:'8010',packagedBackendExecutable:()=> 'owned-fixture-backend.exe',console:{log(){},warn(){},error(){}},mainWindow:win,
  setTimeout:(fn,ms)=>{const t={fn,ms,active:true};h.timers.push(t);return t;},clearTimeout:t=>{if(t)t.active=false;},
  ipcMain:{handle:(name,fn)=>h.handlers[name]=fn},dialog:{showErrorBox:(title,message)=>h.dialogs.push({title,message})}});
 vm.runInContext(section('function ownsBackend(', 'function getActiveBrowserView('),c);
 vm.runInContext(section('async function startBackendIfNeeded()', '// =========================\n// IPC：浏览器控制'),c);
 c.waitForBackendReady=()=>new Promise((resolve,reject)=>h.pending.push({resolve,reject}));
 vm.runInContext(section("ipcMain.handle('backend:info'", "ipcMain.handle('browser:getUrl'"),c);
 h.c=c;h.app=app;h.win=win;h.info=()=>h.handlers['backend:info']();
 h.exit=(p,code=0)=>{p.exitCode=code;p.emit('exit',code);};
 h.timeout=()=>{const ts=h.timers.filter(t=>t.active&&t.ms===8000);assert(ts.length);for(const t of ts){t.active=false;t.fn();}};
 h.bindQuit=()=>{vm.runInContext(section("app.on('browser-window-created'", "app.on('before-quit', () => feishuWorkbench"),c);app.emit('browser-window-created',{},win);};
 return h;
}
function supervisor(){
 const s={calls:[],killers:[],messages:[],exits:[],parentAlive:true,child:new EventEmitter()};
 Object.assign(s.child,{pid:71000,exitCode:null,signalCode:null});
 const module={exports:{}};
 const context=vm.createContext({module,require:{main:null},process:{env:{ELECTRON_RUN_AS_NODE:'1',FIXTURE:'yes'},kill:(pid,signal)=>{assert.equal(pid,70000);assert.equal(signal,0);if(!s.parentAlive)throw Error('parent absent');}}});
 vm.runInContext(supervisorSource,context);
 s.controller=module.exports.createSupervisor({platform:'win32',spawn:(exe,args,opts)=>{
  s.calls.push({exe,args:Array.from(args),opts});if(s.calls.length===1)return s.child;
  if(s.failMode==='throw')throw Error('taskkill launch denied');
  const k=new EventEmitter();s.killers.push(k);return k;
 },send:m=>{s.messages.push(m);s.onMessage?.(m);},exit:code=>{s.exits.push(code);s.onExit?.(code);},setTimer:(fn,ms)=>{assert.equal(ms,500);s.tick=fn;return {unref(){}};}});
 s.start=()=>s.controller.start({parentPid:70000,executable:'owned-fixture.exe',cwd:'fixture-directory'});
 return s;
}
async function check(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:String(e.message)});}}

(async()=>{
 await check('F1 original: disabled or missing backend never probes',async()=>{for(const mode of ['disabled','missing']){const h=harness();if(mode==='disabled')h.c.process.env.ELECTRON_START_BACKEND='false';else h.exists=false;await h.c.startBackendIfNeeded();assert.equal((await h.info()).running,false);assert.equal(h.pending.length,0);assert.equal(h.children.length,0);}});
 await check('F1 original: late success after exit cannot publish running',async()=>{const h=harness();await h.c.startBackendIfNeeded();h.exit(h.children[0]);h.pending[0].resolve({ok:true});await flush();assert.equal(h.events.at(-1).running,false);assert.equal(h.c.backendProc,null);});
 for(const outcome of ['success','failure','rejection'])await check('F1 old startup '+outcome+' cannot overwrite new ready instance',async()=>{
  const h=harness();await h.c.startBackendIfNeeded();const old=h.children[0];h.exit(old);await h.c.startBackendIfNeeded();h.pending[1].resolve({ok:true});await flush();const n=h.events.length;
  if(outcome==='rejection')h.pending[0].reject(Error('old failure'));else h.pending[0].resolve({ok:outcome==='success',code:'OLD_FAILURE'});await flush();
  assert.equal(h.events.length,n);assert.equal(h.events.at(-1).running,true);assert.equal(h.c.backendProc,h.children[1]);
 });
 await check('F1 old info result and old exit cannot overwrite current instance',async()=>{const h=harness();await h.c.startBackendIfNeeded();const old=h.children[0],info=h.info();h.exit(old);await h.c.startBackendIfNeeded();h.pending[2].resolve({ok:true});await flush();const n=h.events.length;old.emit('exit',1);h.pending[1].resolve({ok:true});assert.equal((await info).code,'BACKEND_INSTANCE_CHANGED');assert.equal(h.events.length,n);assert.equal(h.c.backendProc,h.children[1]);});
 await check('F1 old error event cannot overwrite new ready instance',async()=>{const h=harness();await h.c.startBackendIfNeeded();const old=h.children[0];h.exit(old);await h.c.startBackendIfNeeded();h.pending[1].resolve({ok:true});await flush();const n=h.events.length;old.emit('error',Object.assign(Error('old asynchronous error'),{code:'OLD_ERROR'}));observations.oldError={eventDelta:h.events.length-n,lastCode:h.events.at(-1).code,lastRunning:h.events.at(-1).running,currentOwned:h.c.backendProc===h.children[1]};assert.equal(h.events.length,n);});
 await check('Stop invalidates pending readiness and clears only on confirmed exit',async()=>{const h=harness();await h.c.startBackendIfNeeded();const p=h.children[0],stop=h.c.stopBackend();assert.equal(h.c.backendProc,p);h.pending[0].resolve({ok:true});await flush();assert.equal(h.events.at(-1).running,false);assert.equal((await h.info()).running,false);h.exit(p);assert.equal((await stop).ok,true);assert.equal(h.c.backendProc,null);});
 for(const mode of ['callback-error','throw'])await check('F2 IPC '+mode+' retains exact owner and successful retry',async()=>{const h=harness();await h.c.startBackendIfNeeded();const p=h.children[0];p.sendMode=mode;assert.equal((await h.c.stopBackend()).ok,false);assert.equal(h.c.backendProc,p);p.sendMode='';const stop=h.c.stopBackend();h.exit(p);assert.equal((await stop).ok,true);assert.equal(h.messages.filter(x=>x.message.type==='stop').length,2);});
 for(const mode of ['false','throw'])await check('F2 development kill '+mode+' remains retryable',async()=>{const h=harness(false);await h.c.startBackendIfNeeded();const p=h.children[0];p.killMode=mode;assert.equal((await h.c.stopBackend()).ok,false);assert.equal(h.c.backendProc,p);p.killMode='';const stop=h.c.stopBackend();h.exit(p);assert.equal((await stop).ok,true);assert.equal(p.kills,2);});
 await check('F2 main timeout retains owner and issues another stop on retry',async()=>{const h=harness();await h.c.startBackendIfNeeded();const p=h.children[0];const first=h.c.stopBackend();h.timeout();assert.equal((await first).code,'BACKEND_STOP_TIMEOUT');assert.equal(h.c.backendProc,p);const second=h.c.stopBackend();h.exit(p);assert.equal((await second).ok,true);assert.equal(h.messages.filter(x=>x.message.type==='stop').length,2);});
 await check('Failed window quit is retryable, concurrent quit does not duplicate stop',async()=>{const h=harness();await h.c.startBackendIfNeeded();h.bindQuit();const p=h.children[0];h.app.quit();h.app.quit();assert.equal(h.messages.filter(x=>x.message.type==='stop').length,1);h.timeout();await flush();assert.equal(h.dialogs.length,1);assert.equal(h.quitPrevented,true);assert.equal(h.c.backendProc,p);h.app.quit();h.exit(p);await flush();assert.equal(h.quitPrevented,false);});
 await check('Real Node failed fork without PID does not permanently trap window',async()=>{
  let closed;const closePromise=new Promise(resolve=>closed=resolve),events=[];
  const h=harness(true,()=>{const p=require('node:child_process').fork('unused-review-fixture.cjs',[],{execPath:path.join(root,'missing-review-executable-'+process.pid),stdio:['ignore','ignore','ignore','ipc']});p.on('error',e=>events.push({type:'error',code:e.code}));p.on('exit',()=>events.push({type:'exit'}));p.once('close',()=>{events.push({type:'close'});closed();});return p;});
  await h.c.startBackendIfNeeded();h.bindQuit();await closePromise;const p=h.children[0];h.app.quit();await flush();
  observations.forkFailure={realNodeFailure:true,pidAllocated:Boolean(p.pid),events,handleRetained:h.c.backendProc===p,quitPrevented:h.quitPrevented,dialogCount:h.dialogs.length};
  assert.equal(h.c.backendProc===null,true,'failed-fork handle remains although no PID was created');assert.equal(h.quitPrevented,false);
 });
 for(const mode of ['nonzero','throw','error'])await check('Supervisor '+mode+' retry targets only own live child PID',()=>{const s=supervisor();s.start();s.failMode=mode;s.controller.stop();if(mode==='nonzero')s.killers[0].emit('exit',1);if(mode==='error')s.killers[0].emit('error',Error('denied'));assert.equal(s.exits.length,0);assert.equal(s.messages.at(-1).type,'stop-failed');s.failMode='';s.controller.stop();assert.deepEqual(s.calls.at(-1).args,['/PID','71000','/T','/F']);s.child.exitCode=0;s.child.emit('exit',0);s.killers.at(-1).emit('exit',0);assert.equal(s.exits.at(-1),0);});
 await check('Supervisor rejects invalid parent and duplicate start; removes Electron node env',()=>{const s=supervisor();s.controller.start({parentPid:0,executable:'foreign.exe'});assert.equal(s.calls.length,0);s.start();s.controller.start({parentPid:70000,executable:'foreign.exe'});assert.equal(s.calls.length,1);assert.equal(s.calls[0].exe,'owned-fixture.exe');assert.equal(s.calls[0].opts.env.ELECTRON_RUN_AS_NODE,undefined);});
 await check('Supervisor parent disappearance cleans only current child tree',()=>{const s=supervisor();s.start();s.parentAlive=false;s.tick();assert.deepEqual(s.calls[1].args,['/PID','71000','/T','/F']);});
 await check('Supervisor completed child is never terminated by stale PID',()=>{const s=supervisor();s.start();s.child.exitCode=0;s.child.emit('exit',0);s.controller.stop();assert.equal(s.calls.length,1);});
 await check('F2 integrated: hung taskkill attempt is bounded and subsequent stop can retry',async()=>{
  const h=harness();await h.c.startBackendIfNeeded();const p=h.children[0],s=supervisor();s.start();s.onMessage=m=>p.emit('message',m);s.onExit=code=>h.exit(p,code);
  p.send=(m,cb)=>{h.messages.push({p,message:m});if(m.type==='stop')s.controller.stop();};
  const first=h.c.stopBackend();h.timeout();assert.equal((await first).code,'BACKEND_STOP_TIMEOUT');
  for(let i=0;i<20;i++)s.tick();const second=h.c.stopBackend();h.timeout();assert.equal((await second).code,'BACKEND_STOP_TIMEOUT');
  observations.hungTaskkill={ownedHandleRetained:h.c.backendProc===p,stopRequests:h.messages.filter(x=>x.message.type==='stop').length,taskkillAttempts:s.calls.filter(x=>x.exe==='taskkill.exe').length,watcherTicks:20};
  assert(s.calls.filter(x=>x.exe==='taskkill.exe').length>=2,'taskkill remains permanently in-flight; retry sends no new cleanup');
 });
})().catch(e=>results.push({name:'harness',pass:false,error:String(e.stack)})).finally(()=>{
 const report={version:require(path.join(root,'package.json')).version,runtime:process.platform,node:process.version,
  mainSHA256:crypto.createHash('sha256').update(main).digest('hex'),supervisorSHA256:crypto.createHash('sha256').update(supervisorSource).digest('hex'),
  scope:'Exact production functions and supervisor factory; Electron/HTTP/Windows processes/timers simulated, except one real Node ENOENT fork failure (no child PID); no backend or real kill executed',
  windowsExecuted:false,realDataAccessed:false,total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,observations,results};
 fs.writeFileSync('FORMAL111-INDEPENDENT.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;
});
