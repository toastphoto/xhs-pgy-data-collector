const fs=require('fs');
const type=v=>v===null?'null':Array.isArray(v)?'array':typeof v;
function navigation(value){
 if(typeof value!=='string')return{pageType:'unknown',observed:false};
 try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='pgy.xiaohongshu.com'||u.username||u.password)return{pageType:'unknown',observed:true,allowedOrigin:false};
 let pageType='unknown';if(u.pathname==='/')pageType='home';else if(u.pathname==='/solar/pre-trade/note/kol')pageType='search';else if(/login/i.test(u.pathname))pageType='login';else if(/blogger-detail/.test(u.pathname))pageType='creator';else if(/invitation|invite|cooperate/.test(u.pathname))pageType='form';
 return{pageType,observed:true,allowedOrigin:true,queryOrFragmentOmitted:!!(u.search||u.hash)};
 }catch{return{pageType:'unknown',observed:false};}
}
function createRecorder({file,patterns,write=record=>fs.appendFileSync(file,JSON.stringify(record)+'\n','utf8')}){
 const known=new Set(patterns.map(x=>x.toLowerCase()));
 const stop=(record,code)=>{record.stopCode=code||null;record.proceed=!code;write(record);if(code){const e=new Error(code);e.code=code;throw e;}return record;};
 function recordProbe({response,role,stage,exception=false}){
 if(!['collection','invite'].includes(role)||stage!=='check-login')throw Error('INVALID_RECORD_CONTEXT');
 const obj=response&&typeof response==='object'&&!Array.isArray(response)?response:null;
 const word=typeof obj?.riskText==='string'&&known.has(obj.riskText.toLowerCase())?obj.riskText.toLowerCase():null;
 const record={kind:'login-probe',at:new Date().toISOString(),role,stage,responseType:type(response),okType:type(obj?.ok),ok:typeof obj?.ok==='boolean'?obj.ok:null,riskFieldType:type(obj?.riskDetected),riskDetected:typeof obj?.riskDetected==='boolean'?obj.riskDetected:null,loggedInFieldType:type(obj?.loggedIn),loggedIn:typeof obj?.loggedIn==='boolean'?obj.loggedIn:null,matchedTerms:word?[word]:[],matchedTermEvidence:word?'known-term':'unknown',navigation:navigation(obj?.url),pageEvidence:'classification-only; body/title/account omitted'};
 let code=null;
 if(exception)code='PROBE_EXCEPTION';else if(obj?.riskDetected===true)code='PLATFORM_RISK_STOP';else if(!obj||obj.ok!==true)code='PROBE_FAILED';else if(typeof obj.riskDetected!=='boolean')code='RISK_FIELD_TYPE_INVALID';else if(typeof obj.loggedIn!=='boolean')code='LOGIN_FIELD_TYPE_INVALID';else if(word)code='RISK_EVIDENCE_CONFLICT';else if(!obj.loggedIn)code='LOGIN_REQUIRED';
 return stop(record,code);
 }
 function recordNavigation({response,role}){
  if(!['collection','invite'].includes(role))throw Error('INVALID_RECORD_CONTEXT');
  const record={kind:'navigation',at:new Date().toISOString(),role,stage:'open-account-entry',responseType:type(response),okType:type(response?.ok),ok:typeof response?.ok==='boolean'?response.ok:null,navigation:navigation(response?.url),requestedPageType:role==='collection'?'search':'account-entry'};
  return stop(record,response?.ok===true?null:'NAVIGATION_FAILED');
 }
 async function runProbe(check,context){let response;try{response=await check();}catch(_){return recordProbe({...context,response:undefined,exception:true});}return recordProbe({...context,response});}
 async function runNavigation(open,role){let response;try{response=await open();}catch(_){return recordNavigation({response:undefined,role});}return recordNavigation({response,role});}
 return{recordProbe,recordNavigation,runProbe,runNavigation};
}
module.exports={createRecorder,navigation};
