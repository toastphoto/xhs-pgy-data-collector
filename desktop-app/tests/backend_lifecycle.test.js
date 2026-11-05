const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict'),{EventEmitter}=require('events');
const root=process.env.PGY_TEST_APP||path.resolve(__dirname, '..');
const main=fs.readFileSync(root+'/main.js','utf8'),results=[];
function section(a,b){let i=main.indexOf(a),j=main.indexOf(b,i+a.length);assert(i>=0&&j>i);return main.slice(i,j);}
const flush=()=>new Promise(r=>setImmediate(r));
function harness(packaged=true){
 const h={events:[],children:[],requests:[],handlers:{},pending:[]};
 const spawn=()=>{const p=new EventEmitter();p.pid=50000+h.children.length;p.exitCode=null;p.signalCode=null;p.connected=true;p.send=(m,cb)=>{h.messages??=[];h.messages.push(m);if(p.sendError)cb?.(Error('denied'));};p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.kill=()=>{p.kills=(p.kills||0)+1;if(p.throwKill)throw Error('denied');return p.killResult!==false;};h.children.push(p);return p;};
 const c=vm.createContext({require:n=>({fork:spawn}),spawn,process:{env:{},pid:45000,resourcesPath:'C:/synthetic/resources'},app:{isPackaged:packaged,getPath:()=> 'C:/synthetic/profile'},path,crypto:require('crypto'),fs:{existsSync:()=>h.exists!==false},__dirname:'C:/synthetic/app',qaRuntime:{active:false},backendProc:null,backendInstanceToken:'',backendGeneration:0,backendStopping:false,DEFAULT_API_HOST:'127.0.0.1',DEFAULT_API_PORT:'8010',packagedBackendExecutable:()=> 'synthetic-backend.exe',console:{log(){},warn(){},error(){}},mainWindow:{webContents:{send:(_,p)=>h.events.push(p)}},setTimeout,clearTimeout,ipcMain:{handle:(n,f)=>h.handlers[n]=f}});
 vm.runInContext(section('function ownsBackend(', 'function getActiveBrowserView('),c);
 vm.runInContext(section('async function startBackendIfNeeded()', '// =========================\n// IPC：浏览器控制'),c);
 c.waitForBackendReady=()=>new Promise(resolve=>h.pending.push(resolve));
 vm.runInContext(section("ipcMain.handle('backend:info'", "ipcMain.handle('browser:getUrl'"),c);
 h.c=c;h.info=()=>h.handlers['backend:info']();h.exit=p=>{p.exitCode=0;p.emit('exit',0);};return h;
}
async function check(name,f){await f();results.push({name,ok:true});}
(async()=>{
 await check('no owned process/token never probes foreign service',async()=>{const h=harness();assert.equal((await h.info()).running,false);assert.equal(h.pending.length,0);});
 await check('missing packaged backend never probes',async()=>{const h=harness();h.exists=false;await h.c.startBackendIfNeeded();assert.equal((await h.info()).running,false);assert.equal(h.children.length,0);});
 await check('late startup and info probes after exit cannot report running',async()=>{const h=harness();await h.c.startBackendIfNeeded();const inf=h.info();h.exit(h.children[0]);h.pending.forEach(r=>r({ok:true}));await flush();assert.equal((await inf).running,false);assert.equal(h.events.at(-1).running,false);});
 await check('restart ignores prior success and prior exit callbacks',async()=>{const h=harness();await h.c.startBackendIfNeeded();let old=h.children[0];h.exit(old);await h.c.startBackendIfNeeded();h.pending[0]({ok:true});await flush();assert.equal(h.events.at(-1).running,false);old.emit('exit',0);assert.equal(h.c.backendProc,h.children[1]);h.pending[1]({ok:true});await flush();assert.equal(h.events.at(-1).running,true);});
 await check('stop request invalidates probe, retains ownership until exit',async()=>{const h=harness();await h.c.startBackendIfNeeded();const p=h.children[0],st=h.c.stopBackend();h.pending[0]({ok:true});await flush();assert.equal(h.c.backendProc,p);assert.equal(h.events.at(-1).running,false);assert.equal((await h.info()).running,false);h.exit(p);assert.equal((await st).ok,true);assert.equal(h.c.backendProc,null);});
 await check('IPC stop failure retains exact handle and retries',async()=>{const h=harness();await h.c.startBackendIfNeeded();let p=h.children[0];p.sendError=true;assert.equal((await h.c.stopBackend()).ok,false);assert.equal(h.c.backendProc,p);p.sendError=false;let again=h.c.stopBackend();h.exit(p);assert.equal((await again).ok,true);assert.equal(h.messages.filter(m=>m.type==='stop').length,2);});
 for(const mode of ['false','throw'])await check('development kill '+mode+' remains retryable',async()=>{const h=harness(false);await h.c.startBackendIfNeeded();let p=h.children[0];p.killResult=false;p.throwKill=mode==='throw';assert.equal((await h.c.stopBackend()).ok,false);assert.equal(h.c.backendProc,p);p.killResult=true;p.throwKill=false;let st=h.c.stopBackend();h.exit(p);assert.equal((await st).ok,true);assert.equal(p.kills,2);});
 await check('failed quit retains operator window and allows a second quit',async()=>{
  const app=new EventEmitter(),win=new EventEmitter();let quits=0,errors=0,attempts=0;app.quit=()=>quits++;
  const c=vm.createContext({app,backendProc:{pid:1},mainWindow:win,dialog:{showErrorBox:()=>errors++},stopBackend:async()=>({ok:++attempts>1})});
  vm.runInContext(section("app.on('browser-window-created'", "app.on('before-quit', () => feishuWorkbench.clear())"),c);
  app.emit('browser-window-created',{},win);let prevented=0;win.emit('close',{preventDefault:()=>prevented++});assert.equal(prevented,1);
  app.emit('before-quit',{preventDefault:()=>prevented++});await flush();assert.equal(errors,1);
  app.emit('before-quit',{preventDefault:()=>prevented++});await flush();assert.equal(attempts,2);assert.equal(quits,2);
 });
 const {createSupervisor}=require(root+'/lib/qa_backend_supervisor');
 for(const mode of ['nonzero','throw','error'])await check('Windows tree stop '+mode+' retains live root for retry',()=>{const calls=[],exits=[],messages=[];let child=new EventEmitter();Object.assign(child,{pid:70000,exitCode:null,signalCode:null});let killers=[];let failMode=mode;const s=createSupervisor({platform:'win32',spawn:(exe,args)=>{calls.push({exe,args});if(calls.length===1)return child;if(failMode==='throw')throw Error('denied');const k=new EventEmitter();killers.push(k);return k;},send:m=>messages.push(m),exit:c=>exits.push(c),setTimer:()=>({unref(){}})});s.start({parentPid:process.pid,executable:'owned.exe'});s.stop();if(mode==='nonzero')killers[0].emit('exit',1);if(mode==='error')killers[0].emit('error',Error('denied'));assert.equal(exits.length,0);assert.equal(messages.at(-1).type,'stop-failed');failMode='success';s.stop();assert.deepEqual(calls.at(-1).args,['/PID','70000','/T','/F']);child.exitCode=0;child.emit('exit',0);killers.at(-1).emit('exit',0);assert.equal(exits.at(-1),0);});
 fs.writeFileSync('BACKEND111-TARGETED.json',JSON.stringify({ok:true,count:results.length,scope:'production functions with process/http doubles; separate native Windows evidence required',results},null,2));console.log('Targeted lifecycle checks passed:',results.length);
})().catch(e=>{console.error(e);process.exitCode=1;});
