const assert=require('assert/strict'),path=require('path'),os=require('os'),fs=require('fs'),net=require('net');
const r=require('../lib/qa_runtime');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'qa-unit-'));let writes={};const app={getPath:k=>root,setPath:(k,v)=>writes[k]=v,setName:n=>writes.name=n,commandLine:{getSwitchValue:()=>''}};
assert.deepEqual(r.configureQaRuntime(app,{},{}),{active:false});assert.deepEqual(writes,{});
const env={API_PORT:'8010',DATA_DIR:'forbidden',OUTPUT_DIR:'forbidden',LOG_DIR:'forbidden'};
const qa=r.configureQaRuntime(app,{buildFlavor:'coexist-qa'},env);assert.equal(qa.active,true);assert.equal(env.API_PORT,'18010');assert.equal(writes.name,'pgy-workbench-qa');
for(const n of ['DATA_DIR','OUTPUT_DIR','LOG_DIR'])assert.ok(env[n].startsWith(writes.userData+path.sep));assert.ok(writes.sessionData.startsWith(writes.userData+path.sep));
app.commandLine.getSwitchValue=()=>path.join(root,'production');assert.throws(()=>r.configureQaRuntime(app,{buildFlavor:'coexist-qa'},env),/QA_PROFILE_OUTSIDE/);
(async()=>{const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));assert.equal(await r.backendPortAvailable(server.address().port),false);await new Promise(resolve=>server.close(resolve));console.log('QA configuration and occupied-port refusal PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
