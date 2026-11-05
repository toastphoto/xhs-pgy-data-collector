const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveContactMapping, runContactProbe, contactApplicationPatch } = require('../lib/feishu_contact_workflow');

function fields() { return [
  {field_key:'account',field_name:'小红书ID',field_type_key:'text'},
  {field_key:'platform',field_name:'平台',field_type_key:'select',
    options:[{label:'小红书',value:'xhs',work_item_type_key:'creator',is_disabled:2}]},
  {field_key:'contact',field_name:'联系方式',field_type_key:'text'}
]; }
test('raw contact: explicit unclassified application preserves literal value and separate source without touching typed fields', () => {
  const value = '001234\n经纪人备注  原样保留';
  const row = { wechatId: 'manual_wechat', phone: '123456789', email: 'manual@example.test', contactSource: 'manual' };
  const patch = contactApplicationPatch({ recordId: 5, kind: 'unclassified', value }, 'unclassified', row,
    { account: '001234', projectKey: 'project', workItemTypeKey: 'creator', checkedAt: '2026-10-13T00:00:00.000Z' });
  assert.deepEqual(patch, { contactRaw: value, contactRawSource: '飞书项目 / project/creator / 5',
    contactRawCollectedAt: '2026-10-13T00:00:00.000Z', feishuAccountNumber: '001234' });
  assert.equal(row.contactSource, 'manual'); assert.equal(row.wechatId, 'manual_wechat');
});
test('raw contact: conflicts, unsupported source kinds and invalid text/provenance are rejected without classification', () => {
  const candidate = { recordId: 5, kind: 'unclassified', value: '12345678' };
  const provenance = { account: '001234', projectKey: 'project', workItemTypeKey: 'creator', checkedAt: '2026-10-13T00:00:00.000Z' };
  assert.throws(() => contactApplicationPatch(candidate, 'unclassified', { contactRaw: 'different' }, provenance), { code: 'FEISHU_LOCAL_CONFLICT' });
  for (const kind of ['wechat', 'phone', 'email', 'status', 'empty', 'unrecognized']) {
    assert.throws(() => contactApplicationPatch({ ...candidate, kind }, 'unclassified', {}, provenance), { code: 'FEISHU_CONTACT_INVALID' });
  }
  for (const value of ['', '   ', {}, 'x\u0000y', 'x'.repeat(4097)]) {
    assert.throws(() => contactApplicationPatch({ ...candidate, value }, 'unclassified', {}, provenance), { code: 'FEISHU_CONTACT_INVALID' });
  }
  for (const change of [{ projectKey: '../other' }, { workItemTypeKey: '' }, { account: '' }, { checkedAt: 'invalid' }]) {
    assert.throws(() => contactApplicationPatch(candidate, 'unclassified', {}, { ...provenance, ...change }), { code: 'FEISHU_CONTACT_INVALID' });
  }
  for (const kind of ['constructor', '__proto__', 'raw', 'unrecognized']) {
    assert.throws(() => contactApplicationPatch(candidate, kind, {}, provenance), { code: 'FEISHU_CONTACT_INVALID' });
  }
  const previous = { contactRaw: candidate.value, contactRawSource: '飞书项目 / project/creator / 4', contactRawCollectedAt: '2026-10-12T00:00:00.000Z' };
  const patch = contactApplicationPatch(candidate, 'unclassified', previous, provenance);
  assert.equal(patch.contactRawSource, previous.contactRawSource); assert.equal(patch.contactRawCollectedAt, previous.contactRawCollectedAt);
});
function config() { return {pluginId:'fixture-plugin',pluginSecret:'fixture-secret',userKey:'fixture-user',
  projectKey:'project',workItemTypeKey:'creator',xhsAccountNumber:'001234'}; }
function envelope(contact = '13800000000') { return {err_code:0,data:[{
  id:1,project_key:'project',work_item_type_key:'creator',fields:[
    {field_key:'account',field_value:'001234'},
    {field_key:'platform',field_value:{label:'小红书',value:'xhs'}},
    {field_key:'contact',field_value:contact}]}],pagination:{page_num:1,page_size:50,total:1}}; }
function transport(metadata = fields(), search = envelope()) {
  const calls = [];
  return {calls, fetchImpl:async (url, options) => {
    calls.push({url,options});
    if (url.endsWith('/plugin_token')) return Response.json({error:{code:0},data:{token:'p-fixture',expire_time:300}});
    if (url.endsWith('/meta')) return Response.json({err_code:0,data:metadata});
    if (url.endsWith('/search/params')) return Response.json(search);
    throw new Error('unexpected endpoint');
  }};
}
test('live metadata resolves option value, not guessed label or hardcoded field IDs', () => {
  assert.equal(resolveContactMapping(fields(),'creator').platformOptionId,'xhs');
});
test('ambiguous names, missing options, disabled, foreign scope and duplicate labels stop mapping', () => {
  const variations = [
    f => f.push({...f[0],field_key:'other'}),
    f => { f[0].field_type_key='number'; },
    f => { delete f[1].options; },
    f => { f[1].options[0].is_disabled=1; },
    f => { f[1].options[0].work_item_type_key='other'; },
    f => { f[1].options.push({...f[1].options[0],value:'other'}); },
    f => { f[1].options[0].value=1; }
  ];
  for (const change of variations) { const f=fields(); change(f); assert.throws(()=>resolveContactMapping(f,'creator')); }
});
test('one auth, one metadata, one exact query produces private manual-type preview', async () => {
  const c=config(); const fake=transport();
  const result=await runContactProbe(c,fake);
  assert.equal(result.ok,true);
  assert.equal(result.stage,'preview');
  assert.equal(result.preview.status,'manual_review');
  assert.equal(result.contactSummary.manualTypeReview,true);
  assert.deepEqual(result.preview.proposals,[]);
  assert.equal(fake.calls.length,3);
  const query=JSON.parse(fake.calls[2].options.body);
  assert.deepEqual(query.search_group.search_groups[0].search_params.map(p=>p.value),['001234','001234\n']);
  assert.deepEqual(query.search_group.search_params[0].value,['xhs']);
  assert.equal(c.pluginSecret,'');
  const summary=JSON.stringify(result.contactSummary);
  assert.equal(summary.includes('13800000000'),false);
  assert.equal(summary.includes('001234'),false);
  assert.equal(summary.includes('recordId'),false);
});
test('mapping failure retains safe metadata but never issues search', async () => {
  const f=fields(); delete f[1].options;
  const fake=transport(f); const result=await runContactProbe(config(),fake);
  assert.equal(result.ok,false);
  assert.equal(result.metadataOk,true);
  assert.equal(result.stage,'mapping');
  assert.equal(result.code,'FEISHU_PLATFORM_OPTIONS_MISSING');
  assert.equal(result.preview,undefined);
  assert.equal(fake.calls.length,2);
});
test('existing contacts cause local conflict; no mutation or write calls', async () => {
  const c=config(); c.existing=Object.freeze({email:'manual@example.com'});
  const fake=transport(fields(),envelope('fixture@example.com'));
  const result=await runContactProbe(c,fake);
  assert.equal(result.contactSummary.localConflict,true);
  assert.deepEqual(result.preview.proposals,[]);
  assert.equal(c.existing.email,'manual@example.com');
  assert.equal(fake.calls.length,3);
  assert.ok(fake.calls.every(c=>!c.url.includes('/create') && !c.url.includes('/update')));
});
test('invalid input and auth error produce safe stage/code only', async () => {
  const fake=transport(); const c=config(); c.xhsAccountNumber='';
  const invalid=await runContactProbe(c,fake);
  assert.equal(invalid.stage,'input'); assert.equal(fake.calls.length,0); assert.equal(c.pluginSecret,'');
  const failure=await runContactProbe(config(),{fetchImpl:async()=>{throw new Error('private secret');}});
  assert.equal(failure.stage,'auth'); assert.equal(failure.authenticated,false);
  assert.equal(JSON.stringify(failure).includes('private secret'),false);
});
test('wrong select response never generates preview or success summary', async () => {
  const body=envelope(); body.data[0].fields[1].field_value='xhs';
  const result=await runContactProbe(config(),transport(fields(),body));
  assert.equal(result.ok,false); assert.equal(result.stage,'search');
  assert.equal(result.code,'FEISHU_CONTACT_REVIEW_FAILED');
  assert.equal(result.preview,undefined); assert.equal(result.contactSummary,undefined);
});
test('search failure preserves only numeric business code for diagnosis', async () => {
  const result=await runContactProbe(config(),transport(fields(),{err_code:99,err_msg:'private detail'}));
  assert.equal(result.stage,'search'); assert.equal(result.apiCode,99);
  assert.equal(result.code,'FEISHU_API_ERROR');
  assert.equal(JSON.stringify(result).includes('private detail'),false);
});
test('legacy terminal LF is read without changing the record or misclassifying numeric contact', async () => {
  const body=envelope(); body.data[0].fields[0].field_value='001234\n';
  const result=await runContactProbe(config(),transport(fields(),body));
  assert.equal(result.ok,true); assert.equal(result.preview.status,'manual_review');
  assert.equal(result.contactSummary.identityVerified,true);
  assert.equal(result.contactSummary.legacyNewlineMatched,true);
  assert.equal(result.contactSummary.proposalCount,0);
});
test('zero results never claim record identity verification', async () => {
  const result=await runContactProbe(config(),transport(fields(),{
    err_code:0,data:[],pagination:{page_num:1,page_size:50,total:0}}));
  assert.equal(result.ok,true); assert.equal(result.contactSummary.outcome,'not_found');
  assert.equal(result.contactSummary.identityVerified,false);
});
