const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildContactQuery, classifyContact, reviewContactResponse } = require('../lib/feishu_contact_preview');
const mapping = { identityConfirmed: true, platformOptionConfirmed: true, identityKind: 'xhs_account_number', platformOptionId: 'xhs-option',
  identityField: 'account', platformField: 'platform', contactField: 'contact', platformLabel: '小红书' };
const fields = [{ key: 'account', type: 'text' }, { key: 'platform', type: 'select' }, { key: 'contact', type: 'text' }];
const base = { mapping, fields, identityKind: 'xhs_account_number', identityValue: 'fixture-account',
  projectKey: 'project', workItemTypeKey: 'creator' };
function record(id, contact, identity = base.identityValue) {
  return { id, project_key: 'project', work_item_type_key: 'creator', fields: [
    {field_key:'account',field_value:identity}, {field_key:'platform',field_value:{label:'小红书',value:'xhs-option'}},
    {field_key:'contact',field_value:contact}] };
}
function review(data, overrides = {}) {
  return reviewContactResponse({ ...base, body: {err_code:0, data,
    pagination:{page_num:1,page_size:50,total:data.length}}, ...overrides });
}
test('query uses exact platform AND identity, only specified fields, first bounded page', () => {
  const q = buildContactQuery(base);
  assert.equal(q.page_size, 50);
  assert.equal(q.page_num, 1);
  assert.deepEqual(q.fields, ['account','platform','contact']);
  assert.equal(q.search_group.conjunction, 'AND');
  assert.deepEqual(q.search_group.search_params.map(p=>p.operator), ['=','=']);
  assert.deepEqual(q.search_group.search_params[0].value, ['xhs-option']);
});
test('unknown mapping, wrong namespace, blank and nickname field never build a query', () => {
  for (const extra of [{mapping:{...mapping,identityConfirmed:false}}, {identityKind:'pgy_id'},
    {identityValue:''}, {identityValue:' bad '}, {mapping:{...mapping,identityField:'name'}}]) {
    assert.throws(()=>buildContactQuery({...base,...extra}));
  }
});
test('schema drift / reused mapping fields blocked', () => {
  assert.throws(()=>buildContactQuery({...base,mapping:{...mapping,platformOptionConfirmed:false}}));
  assert.throws(()=>buildContactQuery({...base,fields:[...fields,{key:'name',type:'text'}],
    mapping:{...mapping,identityField:'name'}}));
  assert.throws(()=>buildContactQuery({...base,fields:[...fields,{key:'account',type:'text'}]}));
  assert.throws(()=>buildContactQuery({...base,mapping:{...mapping,contactField:'account'}}));
});
test('status placeholders and ambiguous contact strings never become WeChat IDs', () => {
  for(const value of ['后台邀约','待填','abc12345','13800000000','微信: abc12345 / 邮箱: a@example.com']) {
    assert.equal(review([record(1,value)]).status,'manual_review');
  }
  assert.equal(classifyContact({value:'abc12345'}).kind,'unrecognized');
});

test('unclassified contacts retain the exact remote literal through response review', () => {
  const value = '  fictional_id\t代理备注\r\n原值  ';
  assert.equal(classifyContact(value).kind, 'unclassified');
  assert.equal(classifyContact(value).value, value);
  assert.equal(review([record(1, value)]).candidates[0].value, value);
  assert.equal(classifyContact('  待填\n').kind, 'status');
  assert.equal(classifyContact('  \t\n').kind, 'empty');
});
test('known email and explicitly labelled WeChat yield proposals only', () => {
  for(const value of ['fixture@example.com','微信: abc12345']) {
    const result=review([record(1,value)]);
    assert.equal(result.status,'ready_for_review');
    assert.equal(result.proposals[0].requiresConfirmation,true);
  }
});
test('same contact retains multiple provenance IDs', () => {
  assert.deepEqual(review([record(1,'微信: abc12345'),record(2,'微信: abc12345')]).proposals[0].recordIds,[1,2]);
});
test('remote conflict never silently chooses latest record', () => {
  assert.equal(review([record(1,'微信: abc12345'),record(2,'微信: abc67890')]).status,'conflict');
});
test('existing local values are not overwritten or mutated', () => {
  const existing=Object.freeze({wechatId:'manual-value'});
  assert.equal(review([record(1,'微信: abc12345')],{existing}).status,'local_conflict');
  assert.equal(review([record(1,'微信: abc12345')],{existing:{wechatId:'abc12345'}}).status,'already_present');
});
test('empty results and missing contacts are separate', () => {
  assert.equal(review([]).status,'not_found');
  assert.equal(review([record(1,'')]).status,'no_contact');
});
test('partial results cannot be treated as conflict-free', () => {
  assert.equal(review([],{body:{err_code:0,data:[],pagination:{page_num:1,page_size:50,total:51}}}).status,'incomplete');
});
test('wrong identity, scope, platform shape, duplicate records or unsafe IDs rejected', () => {
  for(const rows of [[record(1,'x','different')], [{...record(1,'x'),project_key:'other'}],
    [record(1,'x'),record(1,'x')], [record(Number.MAX_SAFE_INTEGER+1,'x')],
    [{...record(1,'x'),fields:[{field_key:'account',field_value:base.identityValue},
      {field_key:'platform',field_value:{label:'XHS',value:'xhs-option'}}]}]]) {
    assert.throws(()=>review(rows));
  }
});
test('business errors and absent pagination never imply no matches', () => {
  for(const body of [{err_code:1,data:[]},{err_code:0,data:[]},
    {err_code:0,data:[],err:{code:9},pagination:{page_num:1,page_size:50,total:0}}]) {
    assert.throws(()=>review([],{body}));
  }
});
test('documented select object accepted; scalar, label-only and wrong value blocked', () => {
  assert.equal(review([record(1, 'fixture@example.com')]).status, 'ready_for_review');
  for (const value of ['xhs-option', {label:'小红书'}, {label:'小红书',value:'other'},
    {label:'other',value:'xhs-option'}, ['xhs-option']]) {
    const row = record(1, 'fixture@example.com');
    row.fields[1].field_value = value;
    assert.throws(() => review([row]), {code:'FEISHU_IDENTITY_NOT_VERIFIED'});
  }
});
test('opt-in legacy LF uses platform AND two exact identities, never a broad OR', () => {
  const mapped = {...mapping,matchTrailingNewline:true};
  const query=buildContactQuery({...base,mapping:mapped});
  assert.equal(query.search_group.conjunction,'AND');
  assert.deepEqual(query.search_group.search_params,[{param_key:'platform',operator:'=',value:['xhs-option']}]);
  const group=query.search_group.search_groups[0];
  assert.equal(group.conjunction,'OR');
  assert.deepEqual(group.search_params.map(p=>p.value),['fixture-account','fixture-account\n']);
  assert.ok(group.search_params.every(p=>p.param_key==='account' && p.operator==='='));
  const rows=[record(1,'fixture@example.com','fixture-account\n')];
  assert.equal(review(rows,{mapping:mapped}).candidates[0].identityVariant,'trailing_lf');
  assert.throws(()=>review(rows));
});
test('legacy matching does not trim arbitrary whitespace or alter leading zeros', () => {
  for (const identity of [' fixture-account','fixture-account ','fixture-account\r\n',
    'fixture-account\n\n','fixture-\naccount','different\n']) {
    assert.throws(()=>review([record(1,'x',identity)],{mapping:{...mapping,matchTrailingNewline:true}}));
  }
});
test('plain and LF-variant records still preserve conflicting contacts for review', () => {
  const result=review([record(1,'微信: abc12345'),record(2,'微信: abc67890','fixture-account\n')],
    {mapping:{...mapping,matchTrailingNewline:true}});
  assert.equal(result.status,'conflict'); assert.deepEqual(result.proposals,[]);
});
