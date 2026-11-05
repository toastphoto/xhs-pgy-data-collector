const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{EventEmitter}=require('events');
const file=process.argv[2]||'C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app/lib/qa_backend_supervisor.js';
const source=fs.readFileSync(file,'utf8'),results=[];
function harness(){const h={calls:[],helpers:[],exits:[],messages:[],parentAlive:true},module={exports:{}};
const c=vm.createContext({module,require:{main:null},process:{env:{},kill:()=>{if(!h.parentAlive)throw Error('gone');}}});vm.runInContext(source,c);
const child=new EventEmitter();Object.assign(child,{pid:70001,exitCode:null,signalCode:null});h.child=child;
h.s=module.exports.createSupervisor({platform:'win32',spawn:(exe,args)=>{h.calls.push({exe,args:Array.from(args)});if(h.calls.length===1)return child;const p=new EventEmitter();Object.assign(p,{pid:80000+h.helpers.length,exitCode:null,signalCode:null,kills:0,kill(){this.kills++;return true;}});h.helpers.push(p);return p;},send:m=>h.messages.push(m),exit:n=>h.exits.push(n),setTimer:fn=>{h.tick=fn;return{unref(){}};}});h.s.start({parentPid:60001,executable:'owned.exe'});return h;}
function check(name,f){f();results.push({name,ok:true});}
check('real-PID cleanup timeout requests helper termination exactly once and never overlaps',()=>{const h=harness();h.s.stop();for(let i=0;i<50;i++)h.tick();assert.equal(h.helpers.length,1);assert.equal(h.helpers[0].kills,1);for(let i=0;i<10;i++)h.s.stop();assert.equal(h.helpers.length,1);h.helpers[0].emit('exit',1);h.s.stop();assert.equal(h.helpers.length,2);h.helpers[0].emit('close',1);h.s.stop();assert.equal(h.helpers.length,2);});
check('connected parent failures are never retried by watcher alone',()=>{const h=harness();h.s.stop();h.helpers[0].emit('exit',1);for(let i=0;i<100;i++)h.tick();assert.equal(h.helpers.length,1);h.s.stop();assert.equal(h.helpers.length,2);});
check('parent-loss automatic recovery is bounded to three attempts',()=>{const h=harness();h.parentAlive=false;for(let i=0;i<100;i++){h.tick();h.helpers.at(-1)?.emit('exit',1);}assert.equal(h.helpers.length,3);});
check('stale helper completion cannot clear later in-flight cleanup',()=>{const h=harness();h.s.stop();const old=h.helpers[0];old.emit('exit',1);h.s.stop();old.emit('close',0);h.s.stop();assert.equal(h.helpers.length,2);assert.equal(h.exits.length,0);});
fs.writeFileSync('SUPERVISOR112-BOUNDARIES.json',JSON.stringify({ok:true,results},null,2));console.log('Additional bounded-cleanup checks:',results.length);
