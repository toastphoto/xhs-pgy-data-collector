const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFeishuWorkbench, validateValues, formFields, safeError, recordStamp } = require('../lib/feishu_workbench');

const metadata = () => [
  { field_key: 'account', field_name: '小红书ID', field_type_key: 'text', is_required: 1 },
  { field_key: 'platform', field_name: '平台', field_type_key: 'select', is_required: 1,
    options: [{ label: '小红书', value: 'xhs', is_disabled: 2 }] },
  { field_key: 'contact', field_name: '联系方式', field_type_key: 'text', is_required: 2 },
  { field_key: 'name', field_name: '账号昵称', field_type_key: 'text', is_required: 1 },
  { field_key: 'source', field_name: '达人资源来源', field_type_key: 'select', is_required: 1,
    options: [{ label: '主动搜索', value: 'search', is_disabled: 2 }] },
  { field_key: 'note', field_name: '其他备注', field_type_key: 'text', is_required: 2 },
  { field_key: 'role_owners', field_name: '角色与人员', field_type_key: 'role_owners', is_required: 1,
    default_value: [{ role: 'fixture-reviewer', owners: ['other-fixture'] }] }
];
const config = () => ({ pluginId: 'fixture-plugin', pluginSecret: 'fixture-secret', projectKey: 'project', workItemTypeKey: 'creator', userKey: 'fixture-user' });
function memoryStore() {
  let value = null;
  return { read: () => value ? structuredClone(value) : null,
    write: (config, autoConnect = true) => { value = { config: structuredClone(config), autoConnect }; },
    suspend: () => { if (value) value.autoConnect = false; }, forget: () => { value = null; } };
}
const values = () => ({ name: 'Fixture Creator', account: '001234', platform: 'xhs', source: 'search', contact: '微信：fixture_contact' });
const workflowStatus = () => ({ state_key: 'fixture-initial', is_archived_state: false, is_init_state: true,
  updated_at: 100, updated_by: 'fixture-user', history: [] });
function setup({ expires = 60, connectionStore, maintainerStore, extraRows = {}, extraRuns = {}, extraFields = [], journalByReference = false,
  requiredContact = 2,
  initialStatus = workflowStatus(), workflowMetadata = null } = {}) {
  let journal = { version: 1, entries: [] }, timestamp = Date.now();
  let local = { rowId: 'row', creatorName: 'Fixture Creator', wechatId: '', email: '' };
  let remote = null, writes = 0, malformed = false, loseCreate = false, errorCode = 0;
  let contactValue = '微信：fixture_contact', onGetRow = () => {};
  let users = [{ user_key: 'fixture-assignee', name_cn: 'Fixture Operator', status: 'activated' }];
  let roles = [{ id: 'fixture-maintainer', name: '现维护经纪人' }, { id: 'fixture-reviewer', name: '审核人' }];
  let denyOperator = false, onOperator = () => {}, onCreate = () => {}, operatorHttp = 0, rolesHttp = 0;
  let rolesFailure = null, createFailure = null, duplicateResponse = null;
  let onQuery = () => {}, onUpdate = () => {}, loseDelete = false, queryResponse = null, onSave = () => {};
  const fixtureMetadata = () => [...metadata().map(f => f.field_key === 'contact' ? { ...f, is_required: requiredContact } : f), ...(workflowMetadata === null ? [] : [workflowMetadata || {
    field_key: 'work_item_status', field_name: 'Fixture initial workflow', field_type_key: 'work_item_status',
    is_required: 2, default_value: structuredClone(initialStatus)
  }]), ...extraFields];
  const calls = [], snapshots = [];
  const transport = async (url, opts) => {
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ url, method: opts.method, body, headers: opts.headers });
    if (url.endsWith('/plugin_token')) return Response.json({ error: { code: 0 }, data: { token: 'p-fixture', expire_time: expires } });
    if (url.endsWith('/meta')) return Response.json({ err_code: 0, data: fixtureMetadata() });
    if (url.endsWith('/user/search')) {
      onOperator();
      if (operatorHttp) return new Response('private response credential', { status: operatorHttp });
      if (denyOperator) return Response.json({ err_code: 10001 });
      return Response.json({ err_code: 0, data: users });
    }
    if (url.endsWith('/flow_roles/creator') && rolesFailure) return rolesFailure();
    if (url.endsWith('/flow_roles/creator')) return rolesHttp
      ? new Response('private response credential', { status: rolesHttp })
      : Response.json({ err_code: 0, data: roles });
    if (opts.method === 'DELETE') {
      writes++; remote = null;
      if (loseDelete) throw new Error('fixture lost delete response');
      return Response.json({ err_code: 0 });
    }
    if (opts.method === 'PUT') {
      writes++;
      for (const f of body.update_fields) {
        const old = remote.fields.find(x => x.field_key === f.field_key);
        old.field_value = f.field_value;
      }
      remote.updated_at++;
      remote.updated_by = 'fixture-user';
      onUpdate(remote);
      return Response.json({ err_code: 0 });
    }
    if (url.endsWith('/create')) {
      writes++;
      assert.equal(journal.entries.at(-1).status, 'unknown', 'journal must precede network dispatch');
      if (createFailure) return createFailure();
      if (errorCode) return Response.json({ err_code: errorCode, err_msg: 'private rejected value' });
      remote = { id: 41, name: body.name, project_key: 'project', work_item_type_key: 'creator',
        work_item_status: structuredClone(initialStatus),
        created_at: 100, created_by: 'fixture-user', updated_at: 100, updated_by: 'fixture-user', fields: structuredClone(body.field_value_pairs).map(p => ({ ...p,
          field_type_key: fixtureMetadata().find(f => f.field_key === p.field_key)?.field_type_key })) };
      remote.fields.find(f => f.field_key === 'role_owners').field_value.push({ role: 'fixture-reviewer', owners: ['other-fixture'] });
      onCreate(remote);
      if (loseCreate) throw new Error('private transport credential');
      return Response.json({ err_code: 0, data: 41 });
    }
    if (url.endsWith('/query')) {
      await onQuery(remote);
      if (queryResponse) return queryResponse();
      if (!remote) return Response.json({ err_code: 30005 });
      if (malformed) return Response.json({ err_code: 0, data: [] });
      return Response.json({ err_code: 0, data: [remote] });
    }
    if (url.endsWith('/search/params')) {
      if (body.search_group.search_params.some(p => p.param_key === 'name')) return Response.json({ err_code: 0, data: remote ? [remote] : [], pagination: { total: remote ? 1 : 0 } });
      if (body.fields.includes('role_owners')) {
        if (duplicateResponse) return duplicateResponse(body);
        const data = [{ id: 5, project_key: 'project', work_item_type_key: 'creator', fields: [
          { field_key: 'account', field_value: '001234' }, { field_key: 'platform', field_value: { value: 'xhs' } },
          { field_key: 'role_owners', field_type_key: 'role_owners',
            field_value: [{ role: 'fixture-maintainer', owners: ['fixture-library-owner'] }] }
        ] }, ...(remote ? [remote] : [])];
        return Response.json({ err_code: 0, data, pagination: { page_num: 1, page_size: 50, total: data.length } });
      }
      return Response.json({ err_code: 0, data: [{ id: 5, project_key: 'project', work_item_type_key: 'creator', fields: [
        { field_key: 'account', field_value: '001234' }, { field_key: 'platform', field_value: { label: '小红书', value: 'xhs' } },
        { field_key: 'contact', field_value: contactValue }
      ] }], pagination: { page_num: 1, page_size: 50, total: 1 } });
    }
    throw new Error('unexpected endpoint');
  };
  const service = createFeishuWorkbench({ connectionStore, maintainerStore, fetchImpl: transport, now: () => timestamp,
    getRow: async (run, id) => { onGetRow();
      const row = run === 'run' ? id === 'row' ? local : extraRows[id] : extraRuns[run]?.[id];
      return row ? JSON.parse(JSON.stringify(row)) : null; },
    loadJournal: () => journalByReference ? journal : JSON.parse(JSON.stringify(journal)),
    saveJournal: v => { onSave(v); journal = JSON.parse(JSON.stringify(v)); snapshots.push(journal); } });
  return { service, calls, snapshots, journal: () => journal, writes: () => writes,
    mutateJournal: fn => fn(journal), onQuery: fn => { onQuery = fn; }, onUpdate: fn => { onUpdate = fn; },
    loseDelete: () => { loseDelete = true; }, removeRemote: () => { remote = null; },
    setRemote: value => { remote = structuredClone(value); }, setQueryResponse: fn => { queryResponse = fn; },
    onSave: fn => { onSave = fn; },
    mutateLocal: f => f(local), mutateRemote: f => f(remote), setMalformed: () => { malformed = true; },
    loseCreate: () => { loseCreate = true; }, setError: n => { errorCode = n; }, advance: n => { timestamp += n; },
    setContact: v => { contactValue = v; }, onGetRow: fn => { onGetRow = fn; },
    setUsers: v => { users = v; }, setRoles: v => { roles = v; }, denyOperator: () => { denyOperator = true; },
    onOperator: fn => { onOperator = fn; }, onCreate: fn => { onCreate = fn; },
    setOperatorHttp: n => { operatorHttp = n; }, setRolesHttp: n => { rolesHttp = n; },
    setRolesFailure: fn => { rolesFailure = fn; }, setCreateFailure: fn => { createFailure = fn; },
    setDuplicateResponse: fn => { duplicateResponse = fn; } };
}
async function selectPerson(f, name = 'Fixture Operator') {
  const result = await f.service.searchMaintainers({ name });
  if (!result.ok) return result;
  return f.service.inspectOperator({ candidateToken: result.candidates[0].token });
}
async function prepareCreate(f, overrides = {}) {
  const operator = await selectPerson(f);
  assert.equal(operator.ok, true);
  return f.service.prepare({ action: 'create', runDir: 'run', rowId: 'row', values: values(), safetyConfirmed: true,
    operatorToken: operator.token, operatorConfirmed: true, ...overrides });
}
async function create(f) {
  assert.equal((await f.service.connect(config())).ok, true);
  const p = await prepareCreate(f);
  assert.equal(p.ok, true);
  return { p, result: await f.service.execute({ token: p.token, confirmed: true }) };
}
const contactTimeField = () => ({ field_key: 'contact_time', field_name: '建联时间', field_type_key: 'date', is_required: 2 });

async function enrichmentFixture() {
  const f = setup(); await f.service.connect(config());
  const operator = await selectPerson(f);
  f.setRemote({id:41,project_key:'project',work_item_type_key:'creator',name:'Existing Fixture',
    updated_at:200,updated_by:'another-user',created_at:100,created_by:'another-user',work_item_status:{state_key:'active'},
    fields:[
      {field_key:'account',field_type_key:'text',field_value:'001234'},
      {field_key:'platform',field_type_key:'select',field_value:{value:'xhs'}},
      {field_key:'contact',field_type_key:'text',field_value:'微信：existing'},
      {field_key:'role_owners',field_type_key:'role_owners',field_value:[{role:'fixture-maintainer',owners:['fixture-assignee']}]},
      {field_key:'note',field_type_key:'text',field_value:'unrelated'}
    ]});
  f.prepareEnrichment = overrides => f.service.prepare({action:'enrich',runDir:'run',rowId:'row',
    operatorToken:operator.token,operatorConfirmed:true,values:{...values(),contact:'邮箱：new@example.invalid'},...overrides});
  return f;
}

test('enrichment: discovers same owner, previews delta and preserves old contacts without timestamp or author matching', async () => {
  const f=await enrichmentFixture(), p=await f.prepareEnrichment();
  assert.equal(p.ok,true);assert.equal(p.recordId,'41');assert.equal(p.fields.length,1);
  assert.equal(p.fields[0].before,'微信：existing');
  assert.equal(p.fields[0].field_value,'微信：existing\n邮箱：new@example.invalid');
  f.mutateRemote(r=>{r.updated_at++;r.updated_by='third-user';r.name='New display name';r.work_item_status={state_key:'changed'};
    r.fields.find(x=>x.field_key==='note').field_value='someone else changed an unrelated note';});
  f.mutateLocal(r=>{r.priority='high';r.contactCollectionStatus='completed';});
  const result=await f.service.execute({token:p.token,confirmed:true,safetyConfirmed:true});
  assert.equal(result.ok,true);assert.equal(result.status,'verified');assert.equal(f.writes(),1);
  const put=f.calls.find(c=>c.method==='PUT');assert.equal(put.body.update_fields.length,1);
  assert.equal(put.body.update_fields[0].field_key,'contact');
  assert.equal(f.journal().entries[0].recordMode,'production');
  assert.equal((await f.service.execute({token:p.token,confirmed:true,safetyConfirmed:true})).ok,false);
  assert.equal((await f.service.prepare({action:'delete',recordId:'41',safetyConfirmed:true})).code,'FEISHU_PRODUCTION_RECORD_PROTECTED');
  const again=await f.prepareEnrichment();assert.equal(again.ok,true);assert.equal(again.noChanges,true);
});

test('enrichment: only touched-field conflicts and changed target identity block a write', async () => {
  for (const change of ['contact','account','owner','local']) {
    const f=await enrichmentFixture(),p=await f.prepareEnrichment();assert.equal(p.ok,true);
    if(change==='local')f.mutateLocal(r=>{r.email='different@example.invalid';});
    else f.mutateRemote(r=>{
      if(change==='owner')r.fields.find(x=>x.field_key==='role_owners').field_value[0].owners=['other-owner'];
      else r.fields.find(x=>x.field_key===change).field_value='changed';
    });
    const result=await f.service.execute({token:p.token,confirmed:true,safetyConfirmed:true});
    assert.equal(result.ok,false,change);assert.equal(f.writes(),0,change);
  }
});

test('enrichment: final remote check follows local reads and ignores unrelated role metadata', async () => {
  const f=await enrichmentFixture();
  f.mutateRemote(r=>r.fields.find(x=>x.field_key==='role_owners').field_value.push({role:'fixture-reviewer'}));
  const p=await f.prepareEnrichment();assert.equal(p.ok,true);
  assert.match(p.entryId,/^[a-f0-9-]{36}$/);
  let reads=0;f.onGetRow(()=>{if(++reads===2)f.mutateRemote(r=>r.fields.find(x=>x.field_key==='contact').field_value='concurrent');});
  const result=await f.service.execute({token:p.token,confirmed:true,safetyConfirmed:true});
  assert.equal(result.code,'FEISHU_ENRICH_FIELDS_CHANGED');assert.equal(f.writes(),0);
});

test('enrichment: unknown readback keeps exact record and reconciliation never repeats the write', async () => {
  const f=await enrichmentFixture(),p=await f.prepareEnrichment();
  f.onUpdate(r=>{r.fields.find(x=>x.field_key==='contact').field_value='not the expected value';});
  const result=await f.service.execute({token:p.token,confirmed:true,safetyConfirmed:true});
  assert.equal(result.status,'unknown');assert.equal(f.writes(),1);
  assert.equal(result.entryId,p.entryId);
  assert.equal((await f.prepareEnrichment()).code,'FEISHU_ENRICH_PENDING');
  f.mutateRemote(r=>{r.updated_by='another-user';delete r.updated_at;
    r.fields.find(x=>x.field_key==='contact').field_value=p.fields[0].field_value;});
  assert.equal((await f.service.reconcile({entryId:result.entryId})).ok,true);
  assert.equal(f.writes(),1);
});

test('enrichment: requires approval and does not clear fields or touch name, workflow or ownership', async () => {
  const f=await enrichmentFixture();
  const p=await f.prepareEnrichment({values:{...values(),contact:'',note:'new note',name:'rename'}});
  assert.equal(p.ok,true);assert.equal(p.noChanges,true);assert.equal(f.writes(),0);
  const plan=await f.prepareEnrichment();
  assert.equal((await f.service.execute({token:plan.token,confirmed:true})).code,'FEISHU_WRITE_SAFETY_REQUIRED');
  assert.equal(f.writes(),0);
  f.mutateRemote(r=>{r.name='[AI测试] fixture';});
  assert.equal((await f.prepareEnrichment()).code,'FEISHU_ENRICH_TEST_RECORD');
});

test('production create: nickname only, missing contact omitted, time generated at dispatch', async () => {
  const f = setup({ extraFields: [contactTimeField()] });
  assert.equal((await f.service.connect(config())).ok, true);
  const p = await prepareCreate(f, { recordMode: 'production', values: { ...values(), contact: '' } });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(p.name, values().name);
  assert.equal(p.recordMode, 'production');
  const previewTime = p.fields.find(p => p.field_key === 'contact_time').field_value;
  f.advance(5000);
  const result = await f.service.execute({ token: p.token, confirmed: true });
  assert.equal(result.ok, true, JSON.stringify(result));
  const call = f.calls.find(c => c.url.endsWith('/create'));
  assert.equal(call.body.name, values().name);
  assert.equal(call.body.required_mode, 1);
  assert.equal(call.body.field_value_pairs.some(p => p.field_key === 'contact'), false);
  assert.equal(call.body.field_value_pairs.find(p => p.field_key === 'contact_time').field_value, previewTime + 5000);
  assert.equal(f.journal().entries[0].recordMode, 'production');
  assert.equal(f.journal().entries[0].name, values().name);
});

test('production create: invalid mode and unknown or ambiguous time schema cannot write', async () => {
  for (const extraFields of [[], [{ ...contactTimeField(), field_type_key: 'text' }],
    [contactTimeField(), { ...contactTimeField(), field_key: 'second_time' }]]) {
    const f = setup({ extraFields });
    assert.equal((await f.service.connect(config())).ok, true);
    assert.equal((await prepareCreate(f, { recordMode: 'production' })).code, 'FEISHU_CONTACT_TIME_SCHEMA_UNSUPPORTED');
    assert.equal(f.writes(), 0);
  }
  const f = setup({ extraFields: [contactTimeField()] });
  assert.equal((await f.service.connect(config())).ok, true);
  assert.equal((await prepareCreate(f, { recordMode: 'invalid' })).code, 'FEISHU_RECORD_MODE_INVALID');
});

test('production record cannot be updated, deleted or manually cleaned as an AI test', async () => {
  const f = setup({ extraFields: [contactTimeField()] });
  assert.equal((await f.service.connect(config())).ok, true);
  const p = await prepareCreate(f, { recordMode: 'production' });
  const result = await f.service.execute({ token: p.token, confirmed: true });
  assert.equal(result.ok, true);
  const entry = f.journal().entries[0];
  for (const action of ['update', 'delete']) {
    assert.equal((await f.service.prepare({ action, recordId: result.recordId, values: { note: 'fixture update' }, safetyConfirmed: true })).code,
      'FEISHU_PRODUCTION_RECORD_PROTECTED');
  }
  assert.equal((await f.service.prepareManualCleanup({ target: entry.target, entryId: entry.entryId,
    recordId: entry.recordId, safetyConfirmed: true })).code, 'FEISHU_PRODUCTION_RECORD_PROTECTED');
  f.mutateJournal(j => { j.entries[0].batch = 'AI_TEST_deceptive'; j.entries[0].name = '[AI测试] AI_TEST_deceptive Fixture'; });
  assert.equal((await f.service.verifyOwnedAbsence({ target: entry.target, entryId: entry.entryId,
    recordId: entry.recordId, inspectCurrent: true })).code, 'FEISHU_PRODUCTION_RECORD_PROTECTED');
  assert.equal((await f.service.prepareManualCleanup({ target: entry.target, entryId: entry.entryId,
    recordId: entry.recordId, safetyConfirmed: true })).code, 'FEISHU_PRODUCTION_RECORD_PROTECTED');
  assert.equal(f.writes(), 1);
});

test('production and test modes retain the same maintainer dedup key', async () => {
  const f = setup({ extraFields: [contactTimeField()] });
  assert.equal((await f.service.connect(config())).ok, true);
  const p = await prepareCreate(f, { recordMode: 'production' });
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).ok, true);
  assert.equal((await prepareCreate(f, { recordMode: 'test' })).code, 'FEISHU_ALREADY_SUBMITTED');
  f.setUsers([{ user_key: 'fixture-other-assignee', name_cn: 'Fixture Operator', status: 'activated' }]);
  assert.equal((await prepareCreate(f, { recordMode: 'production' })).ok, true);
  assert.equal(f.writes(), 1);
});

test('production unknown create without an acknowledged ID never claims a namesake', async () => {
  const f = setup({ extraFields: [contactTimeField()] });
  assert.equal((await f.service.connect(config())).ok, true);
  const p = await prepareCreate(f, { recordMode: 'production' });
  f.loseCreate();
  const result = await f.service.execute({ token: p.token, confirmed: true });
  assert.equal(result.status, 'unknown');
  const readback = await f.service.reconcile({ entryId: result.entryId });
  assert.equal(readback.code, 'FEISHU_RECONCILE_UNCERTAIN');
  assert.equal(f.calls.filter(c => c.body?.search_group?.search_params.some(p => p.param_key === 'name')).length, 0);
  assert.equal((await prepareCreate(f, { recordMode: 'production' })).code, 'FEISHU_ALREADY_SUBMITTED');
  assert.equal(f.writes(), 1);
});

test('production missing contact never changes required_mode or bypasses cloud mandatory metadata', async () => {
  for (const requiredContact of [1, 3, undefined, 0]) {
    const f = setup({ requiredContact: requiredContact ?? 0, extraFields: [contactTimeField()] });
    assert.equal((await f.service.connect(config())).ok, true);
    const result = await prepareCreate(f, { recordMode: 'production', values: { ...values(), contact: '' } });
    assert.equal(result.code, 'FEISHU_CONTACT_REQUIRED_BY_PROJECT');
    assert.equal(f.writes(), 0);
  }
  const f = setup({ extraFields: [contactTimeField()] });
  assert.equal((await f.service.connect(config())).ok, true);
  assert.equal((await prepareCreate(f, { values: { ...values(), contact: '' } })).code, 'FEISHU_CONTACT_REQUIRED');
  assert.equal((await prepareCreate(f, { recordMode: 'production', values: { ...values(), contact: '', source: '' } })).code,
    'FEISHU_REQUIRED_MISSING');
});

test('production allows empty optional contacts but does not manufacture contact values from placeholders', async () => {
  for (const requiredContact of [1, 2]) {
    const f = setup({ requiredContact, extraFields: [contactTimeField()] });
    assert.equal((await f.service.connect(config())).ok, true);
    for (const contact of ['待填', '待补', '待定', '后台邀约', '蒲公英邀约', '暂无', '无']) {
      assert.equal((await prepareCreate(f, { recordMode: 'production', values: { ...values(), contact } })).code, 'FEISHU_CONTACT_REQUIRED');
    }
    assert.equal(f.writes(), 0);
  }
});

test('production time readback mismatch keeps acknowledged ID unknown and can reconcile without a test title', async () => {
  const f = setup({ extraFields: [contactTimeField()] });
  assert.equal((await f.service.connect(config())).ok, true);
  const p = await prepareCreate(f, { recordMode: 'production' });
  f.onCreate(record => { record.fields.find(p => p.field_key === 'contact_time').field_value += 86400000; });
  const result = await f.service.execute({ token: p.token, confirmed: true });
  assert.equal(result.code, 'FEISHU_CONTACT_TIME_READBACK_MISMATCH');
  assert.equal(result.recordId, '41');
  assert.equal(result.status, 'unknown');
  f.mutateRemote(record => { record.fields.find(p => p.field_key === 'contact_time').field_value = f.journal().entries[0].expectedPairs.find(p => p.field_key === 'contact_time').field_value; });
  assert.equal((await f.service.reconcile({ entryId: result.entryId })).ok, true);
  assert.equal(f.writes(), 1);
});

test('first connection: missing copied fields are identified before any network call', async () => {
  for (const field of Object.keys(config())) {
    const f = setup(), input = config(); input[field] = '';
    const result = await f.service.connect(input);
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'connection_config');
    assert.deepEqual(result.configFields, [field]);
    assert.equal(f.calls.length, 0); assert.equal(f.writes(), 0);
    assert.equal(input.pluginSecret, '');
    assert.equal(JSON.stringify(result).includes('fixture-secret'), false);
  }
});

test('first connection: separately saved clean installations accept the same complete copied fields', async () => {
  for (let machine = 0; machine < 2; machine++) {
    const connectionStore = memoryStore(), f = setup({ connectionStore });
    assert.equal(connectionStore.read(), null);
    const input = Object.fromEntries(Object.entries(config()).map(([name, value]) => [name, ` \r\n${value}\t `]));
    const result = await f.service.connect(input);
    assert.equal(result.ok, true); assert.equal(result.target, 'project/creator');
    assert.deepEqual(connectionStore.read().config, config());
    assert.equal(f.calls[1].headers['X-USER-KEY'], 'fixture-user');
    assert.equal(f.writes(), 0); assert.equal(input.pluginSecret, '');
    assert.doesNotMatch(JSON.stringify(result), /fixture-secret|fixture-user|p-fixture/);
  }
});

test('first connection: malformed pasted keys reject locally without removing interior data or exposing it', async () => {
  for (const [field, value] of [['projectKey', 'https://fixture.invalid/project'], ['workItemTypeKey', 'fixture type'],
    ['userKey', 'fixture\u200buser'], ['pluginId', '"fixture-plugin"'], ['pluginSecret', 'fixture secret']]) {
    const f = setup(), input = { ...config(), [field]: value };
    const result = await f.service.connect(input);
    assert.deepEqual(result.configFields, [field]); assert.equal(result.stage, 'connection_config');
    assert.equal(f.calls.length, 0); assert.equal(f.writes(), 0);
    assert.equal(JSON.stringify(result).includes(value), false);
  }
});

test('first connection: authentication, project metadata and local storage failures remain distinct and private', async () => {
  for (const stage of ['connection_auth', 'connection_metadata', 'connection_storage']) {
    let requests = 0;
    const service = createFeishuWorkbench({
      connectionStore: { write() { throw Object.assign(new Error('private storage body'), { code: 'FEISHU_STORAGE_SAVE_FAILED' }); } },
      fetchImpl: async url => {
        requests++;
        if (url.endsWith('/plugin_token')) return Response.json(stage === 'connection_auth'
          ? { error: { code: 17, msg: 'fixture-private-secret' } }
          : { error: { code: 0 }, data: { token: 'p-fixture', expire_time: 1800 } });
        assert.ok(url.endsWith('/meta'));
        return Response.json(stage === 'connection_metadata' ? { err_code: 10001, err_msg: 'fixture-private-user' }
          : { err_code: 0, data: metadata() });
      }
    });
    const input = config(), result = await service.connect(input);
    assert.equal(result.ok, false); assert.equal(result.stage, stage);
    assert.equal(requests, stage === 'connection_auth' ? 1 : 2);
    assert.equal((await service.status()).connected, false);
    assert.equal(input.pluginSecret, '');
    assert.doesNotMatch(JSON.stringify(result), /fixture-private|fixture-secret|p-fixture|storage body/);
  }
});

test('connection diagnostics: only bounded field names and known stages reach the renderer', () => {
  const result = safeError({ code: 'FEISHU_CONFIG_INVALID', stage: 'connection_config',
    configFields: ['userKey'], config: config(), message: 'fixture-secret' });
  assert.deepEqual(result, { ok: false, code: 'FEISHU_CONFIG_INVALID', stage: 'connection_config', configFields: ['userKey'] });
  for (const configFields of [['fixture-private-value'], ['userKey', 'userKey'], ['userKey', { value: 'secret' }],
    Array(6).fill('userKey'), 'pluginSecret']) {
    assert.equal(safeError({ code: 'FEISHU_CONFIG_INVALID', stage: 'connection_config', configFields }).configFields, undefined);
  }
  assert.equal(safeError({ code: 'FEISHU_CONFIG_INVALID', stage: 'fixture-private', configFields: ['userKey'] }).stage, undefined);
  assert.equal(safeError({ code: 'FEISHU_HTTP_ERROR', stage: 'connection_config', configFields: ['userKey'] }).configFields, undefined);
});

test('maintainer lease reply is bounded and backend still rejects the exact five-minute expiry', async () => {
  const f = setup({ expires: 1800 }); await f.service.connect(config());
  const operator = await selectPerson(f);
  assert.equal(operator.ok, true); assert.equal(operator.remainingLeaseMs, 300000);
  assert.ok(Number.isFinite(Date.parse(operator.checkedAt)));
  f.advance(300000);
  const preview = await f.service.prepare({ action: 'create', runDir: 'run', rowId: 'row', values: values(),
    safetyConfirmed: true, operatorToken: operator.token, operatorConfirmed: true });
  assert.equal(preview.ok, false); assert.equal(preview.code, 'FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
  assert.equal(f.writes(), 0);
});

test('saved choice survives operation expiry and readonly refresh cannot revive an old write plan', async () => {
  const f = setup({ expires: 1800 }); await f.service.connect(config());
  const first = await selectPerson(f);
  const old = await f.service.prepare({ action: 'create', runDir: 'run', rowId: 'row', values: values(),
    deferWriteConfirmation: true, operatorToken: first.token, operatorConfirmed: true });
  assert.equal(old.ok, true);
  f.advance(300001);
  assert.equal((await f.service.status()).maintainer.token, first.choice.token);
  const fresh = await f.service.refreshOperator({ choiceToken: first.choice.token });
  assert.equal(fresh.ok, true); assert.equal(fresh.choice.token, first.choice.token);
  assert.notEqual(fresh.token, first.token);
  assert.equal((await f.service.execute({ token: old.token, confirmed: true, safetyConfirmed: true })).ok, false);
  assert.equal(f.writes(), 0);
});

test('encrypted choice adapter restores only same connection scope, never write authority', async () => {
  let saved;
  const maintainerStore = { write: (scope, person) => { saved = { scope, person: structuredClone(person) }; },
    read: scope => saved?.scope === scope ? structuredClone(saved.person) : null };
  const f = setup({ expires: 1800, maintainerStore }); await f.service.connect(config());
  const first = await selectPerson(f);
  assert.equal(Object.hasOwn(saved.person, 'token'), false);
  assert.equal(Object.hasOwn(saved.person, 'expiresAt'), false);
  const restarted = setup({ expires: 1800, maintainerStore });
  const result = await restarted.service.connect(config());
  assert.equal(result.maintainer.name, first.name);
  assert.equal((await restarted.service.prepare({ action: 'create', runDir: 'run', rowId: 'row', values: values(),
    safetyConfirmed: true, operatorToken: first.token, operatorConfirmed: true })).ok, false);
  assert.equal((await restarted.service.refreshOperator({ choiceToken: result.maintainer.token })).ok, true);
  const other = await restarted.service.connect({ ...config(), userKey: 'different-fixture-actor' });
  assert.equal(other.maintainer, null);
  assert.equal(restarted.writes(), 0);
});

test('choice refresh rejects forged handles, changed members or roles and stale candidate replacement', async () => {
  for (const change of [f => f.setUsers([{ user_key: 'different', name_cn: 'Fixture Operator', status: 'activated' }]),
    f => f.setUsers([{ user_key: 'fixture-assignee', name_cn: 'Fixture Operator', status: 'disabled' }]),
    f => f.setRoles([{ id: 'changed-role', name: '现维护经纪人' }])]) {
    const f = setup({ expires: 1800 }); await f.service.connect(config());
    const chosen = await selectPerson(f); change(f);
    assert.equal((await f.service.refreshOperator({ choiceToken: chosen.choice.token })).ok, false);
    assert.equal(f.writes(), 0);
  }
  const f = setup({ expires: 1800 }); await f.service.connect(config());
  const old = await selectPerson(f), fresh = await selectPerson(f);
  assert.equal((await f.service.refreshOperator({ choiceToken: old.choice.token })).ok, false);
  assert.equal((await f.service.refreshOperator({ choiceToken: 'fixture-assignee' })).ok, false);
  assert.equal((await f.service.refreshOperator({ choiceToken: fresh.choice.token })).ok, true);
});

test('automatic token refresh keeps selected identity handle but regenerates action authority', async () => {
  const f = setup({ expires: 60, connectionStore: memoryStore() }); await f.service.connect(config());
  const chosen = await selectPerson(f); f.advance(60001);
  const fresh = await f.service.refreshOperator({ choiceToken: chosen.choice.token });
  assert.equal(fresh.ok, true); assert.equal(fresh.choice.token, chosen.choice.token);
  assert.notEqual(fresh.token, chosen.token); assert.equal(f.writes(), 0);
});

test('choice persistence failure does not grant a successful selection or authority', async () => {
  const f = setup({ maintainerStore: { read: () => null, write: () => { throw Object.assign(new Error(), { code: 'FEISHU_MAINTAINER_SAVE_FAILED' }); } } });
  await f.service.connect(config());
  assert.equal((await selectPerson(f)).code, 'FEISHU_MAINTAINER_SAVE_FAILED');
  assert.equal((await f.service.status()).maintainer, null); assert.equal(f.writes(), 0);
});

test('a slow synchronous journal save crossing expiry cannot dispatch a cloud mutation', async () => {
  const f = setup({ expires: 1800 }); await f.service.connect(config());
  const plan = await prepareCreate(f); assert.equal(plan.ok, true);
  f.onSave(() => f.advance(300000));
  const result = await f.service.execute({ token: plan.token, confirmed: true });
  assert.equal(result.ok, false); assert.equal(result.code, 'FEISHU_CONFIRMATION_REQUIRED');
  assert.equal(f.writes(), 0);
  assert.equal(result.status, 'unknown', 'durable journal must not silently authorize a retry');
  assert.equal(f.journal().entries[0].status, 'unknown');
});

test('literal contact: readonly cloud prepare, execute, exact readback and cleanup retain CRLF and surrounding whitespace', async () => {
  for (const literal of ['fixture first\r\nfixture second', '  fixture original  ', '\tfixture\nsecond\r\nlast \t', 'x'.repeat(4096)]) {
    const f = setup(); await f.service.connect(config());
    f.mutateLocal(row => { row.contactRaw = literal; });
    const preview = await prepareCreate(f, { values: { ...values(), contact: literal },
      deferWriteConfirmation: true, safetyConfirmed: false });
    assert.equal(preview.ok, true);
    assert.equal(preview.fields.find(field => field.field_key === 'contact').field_value, literal);
    assert.equal(f.writes(), 0);
    const result = await f.service.execute({ token: preview.token, confirmed: true, safetyConfirmed: true });
    assert.equal(result.status, 'verified'); assert.equal(result.cleanupBlocked, false);
    const sent = f.calls.find(call => call.url.endsWith('/create')).body.field_value_pairs;
    assert.equal(sent.find(field => field.field_key === 'contact').field_value, literal);
    const entry = f.journal().entries[0];
    assert.equal(entry.expectedPairs.find(field => field.field_key === 'contact').field_value, literal);
    assert.equal(entry.expectedFieldTypes.contact, 'text'); assert.equal(entry.stampVersion, 2);
    const cleanup = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    assert.equal(cleanup.ok, true);
    assert.equal((await f.service.execute({ token: cleanup.token, confirmed: true })).status, 'deleted');
    assert.equal(f.writes(), 2);
  }
});
test('literal contact: update readback is exact and later normalization still invalidates the owned cleanup baseline', async () => {
  const f = setup(), { result } = await create(f), literal = '  original\r\nsecond  ';
  const preview = await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: literal } });
  assert.equal(preview.ok, true);
  const updated = await f.service.execute({ token: preview.token, confirmed: true });
  assert.equal(updated.ok, true); assert.equal(updated.status, 'verified');
  assert.equal(f.journal().entries[0].expectedPairs.find(field => field.field_key === 'contact').field_value, literal);
  f.mutateRemote(record => { record.fields.find(field => field.field_key === 'contact').field_value = literal.trim().replace(/\r\n/g, '\n'); });
  const stamp = f.journal().entries[0].stamp;
  assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code, 'FEISHU_REMOTE_CHANGED');
  assert.equal(f.journal().entries[0].stamp, stamp); assert.equal(f.writes(), 2);
});
test('literal contact: normalized or wrong-type first readback remains unknown and cannot qualify for cleanup', async () => {
  for (const change of ['newline', 'trim', 'type']) {
    const f = setup(), literal = '  original\r\nsecond  '; await f.service.connect(config());
    f.onCreate(record => {
      const field = record.fields.find(field => field.field_key === 'contact');
      if (change === 'newline') field.field_value = literal.replace(/\r\n/g, '\n');
      if (change === 'trim') field.field_value = literal.trim();
      if (change === 'type') field.field_type_key = 'link';
    });
    const preview = await prepareCreate(f, { values: { ...values(), contact: literal } });
    assert.equal(preview.ok, true);
    const result = await f.service.execute({ token: preview.token, confirmed: true });
    assert.equal(result.status, 'unknown'); assert.equal(result.code, 'FEISHU_READBACK_MISMATCH');
    assert.equal(f.journal().entries[0].stamp, undefined);
    assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).ok, false);
    assert.equal(f.writes(), 1);
  }
});
test('literal contact: bare CR, controls, invalid shapes, oversize and whitespace-only values are rejected before dispatch', async () => {
  const invalid = ['first\rsecond', 'first\r\r\nsecond', 'first\r', 'x\u0000y', 'x\u000by', 'x\u001fy',
    'x\u007fy', 'x\u0085y', 'x'.repeat(4097), ' \r\n\t ', null, {}, [], 0];
  for (const contact of invalid) {
    const f = setup(); await f.service.connect(config());
    const preview = await prepareCreate(f, { values: { ...values(), contact } });
    assert.equal(preview.code, 'FEISHU_FIELDS_INVALID'); assert.equal(f.writes(), 0);
  }
});
test('literal contact: identity, title, link, select and non-contact text retain their strict validation', () => {
  const fields = formFields([...metadata(), { field_key: 'link', field_name: '后台链接', field_type_key: 'link', is_required: 2 }], 'creator');
  for (const field of ['account', 'name', 'platform', 'source', 'note', 'link']) {
    for (const value of [' leading or trailing ', 'first\r\nsecond']) {
      assert.throws(() => validateValues(fields, { ...values(), contact: '  original\r\nsecond  ', [field]: value }, { create: true }),
        { code: 'FEISHU_FIELDS_INVALID' }, field);
    }
  }
  for (const type of ['link', 'select']) {
    const changed = fields.map(field => field.key === 'contact' ? { ...field, type } : field);
    assert.throws(() => validateValues(changed, { ...values(), contact: ' literal ' }, { create: true }), { code: 'FEISHU_FIELDS_INVALID' });
  }
  const renamedTitle = fields.map(field => field.key === 'name' ? { ...field, name: '联系方式' } : field);
  assert.throws(() => validateValues(renamedTitle, { ...values(), name: ' literal title ' }, { create: true }), { code: 'FEISHU_FIELDS_INVALID' });
});
test('literal contact: wrapped placeholders cannot bypass required real-contact checks', async () => {
  for (const contact of [' 待填 ', '\r\n待补\r\n', ' \t后台邀约 \r\n', ' 暂无 ']) {
    const f = setup(); await f.service.connect(config());
    const preview = await prepareCreate(f, { values: { ...values(), contact } });
    assert.equal(preview.code, 'FEISHU_CONTACT_REQUIRED'); assert.equal(f.writes(), 0);
  }
});
test('literal contact: allowing written literals does not loosen non-written default or creation ownership proof', async () => {
  const f = setup({ extraFields: [{ field_key: 'literal-default', field_name: 'Fixture default', field_type_key: 'text', default_value: 'server\r\ndefault' }] });
  await f.service.connect(config());
  f.onCreate(record => record.fields.push({ field_key: 'literal-default', field_type_key: 'text', field_value: 'server\r\ndefault' }));
  const preview = await prepareCreate(f, { values: { ...values(), contact: '  original\r\nsecond  ' } });
  assert.equal(preview.ok, true);
  const result = await f.service.execute({ token: preview.token, confirmed: true });
  assert.equal(result.status, 'verified'); assert.equal(result.cleanupBlocked, true);
  assert.equal(result.cleanupDiagnostic, 'FIELD_DEFAULT_UNVERIFIED'); assert.equal(f.journal().entries[0].stamp, undefined);
  assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code, 'FEISHU_CLEANUP_BLOCKED');
  assert.equal(f.writes(), 1);
});
test('create cleanup diagnostic: first rejection is durable and safely returned without changing blocked behavior', async () => {
  const cases = [
    ['CREATE_ORIGIN_UNVERIFIED', r => { r.updated_by = 'fixture-private-actor'; r.work_item_status = null; }],
    ['INITIAL_WORKFLOW_UNVERIFIED', r => { r.work_item_status.history = [workflowStatus()]; }],
    ['FIELD_SCHEMA_UNVERIFIED', r => r.fields.push({ field_key: 'fixture-private-key', field_type_key: 'text', field_value: 'fixture-private-contact' })],
    ['ROLE_DEFAULT_UNVERIFIED', r => { r.fields.find(f => f.field_key === 'role_owners').field_value[1].owners = ['fixture-private-owner']; }],
    ['FIELD_DEFAULT_UNVERIFIED', r => r.fields.push({ field_key: 'note', field_type_key: 'text', field_value: 'fixture-private-secret' })]
  ];
  for (const [reason, change] of cases) {
    const f = setup(); f.onCreate(change); const { result } = await create(f);
    assert.equal(result.ok, true); assert.equal(result.status, 'verified'); assert.equal(result.cleanupBlocked, true);
    assert.equal(result.cleanupDiagnostic, reason);
    const entry = structuredClone(f.journal().entries[0]);
    assert.equal(entry.cleanupDiagnostic, reason); assert.equal(entry.stamp, undefined); assert.equal(entry.stampVersion, undefined);
    assert.equal((await f.service.listRecords()).records[0].cleanupDiagnostic, reason);
    const denied = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    assert.deepEqual(denied, { ok: false, code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: true, cleanupDiagnostic: reason,
      ...(reason === 'CREATE_ORIGIN_UNVERIFIED' ? { cleanupOriginDiagnostic: 'UPDATER_MISMATCH' } : {}) });
    for (const value of ['fixture-private-actor', 'fixture-private-key', 'fixture-private-contact', 'fixture-private-owner', 'fixture-private-secret']) {
      assert.equal(JSON.stringify(denied).includes(value), false);
      assert.equal(JSON.stringify(result).includes(value), false);
    }
    f.service.clear(); assert.equal((await f.service.connect(config())).ok, true);
    assert.equal((await f.service.listRecords()).records[0].cleanupDiagnostic, reason);
    assert.deepEqual(f.journal().entries[0], entry);
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0);
  }
});

test('create cleanup diagnostic: a proven initial create has no rejection diagnostic and retains exact cleanup', async () => {
  const f = setup(); const { result } = await create(f);
  assert.equal(result.cleanupBlocked, false); assert.equal(Object.hasOwn(result, 'cleanupDiagnostic'), false);
  assert.equal(Object.hasOwn(result, 'cleanupOriginDiagnostic'), false);
  assert.equal(Object.hasOwn(f.journal().entries[0], 'cleanupDiagnostic'), false);
  assert.equal(Object.hasOwn(f.journal().entries[0], 'cleanupOriginDiagnostic'), false);
  assert.equal(Object.hasOwn((await f.service.listRecords()).records[0], 'cleanupDiagnostic'), false);
  const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
  assert.equal(p.ok, true); assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'deleted');
  assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 1);
});

test('create cleanup diagnostic: public projection and safe errors accept only known enum strings on blocked entries', async () => {
  const f = setup(); await create(f);
  for (const cleanupDiagnostic of ['fixture-private-secret', 'CREATE_ORIGIN_UNVERIFIED\nfixture-private-contact',
    { reason: 'CREATE_ORIGIN_UNVERIFIED', actor: 'fixture-private-actor' }, null, true, ['CREATE_ORIGIN_UNVERIFIED']]) {
    f.mutateJournal(j => { j.entries[0].cleanupBlocked = true; j.entries[0].cleanupDiagnostic = cleanupDiagnostic; });
    assert.equal(Object.hasOwn((await f.service.listRecords()).records[0], 'cleanupDiagnostic'), false);
    assert.deepEqual(safeError({ code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: true, cleanupDiagnostic,
      expectedPairs: values(), token: 'fixture-private-secret' }), { ok: false, code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: true });
  }
  const reason = 'INITIAL_WORKFLOW_UNVERIFIED';
  f.mutateJournal(j => { j.entries[0].cleanupDiagnostic = reason; });
  assert.equal((await f.service.listRecords()).records[0].cleanupDiagnostic, reason);
  assert.deepEqual(safeError({ code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: true, cleanupDiagnostic: reason }),
    { ok: false, code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: true, cleanupDiagnostic: reason });
  for (const code of ['FEISHU_OPERATION_FAILED', 'FEISHU_ALREADY_SUBMITTED']) {
    assert.equal(Object.hasOwn(safeError({ code, cleanupBlocked: true, cleanupDiagnostic: reason }), 'cleanupDiagnostic'), false);
  }
  f.mutateJournal(j => { j.entries[0].cleanupBlocked = false; });
  assert.equal(Object.hasOwn((await f.service.listRecords()).records[0], 'cleanupDiagnostic'), false);
  assert.equal(Object.hasOwn(safeError({ code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: false, cleanupDiagnostic: reason }), 'cleanupDiagnostic'), false);
});

test('create cleanup diagnostic: legacy blocked entries never gain a reason or a rebased stamp on later reads', async () => {
  const f = setup(); f.onCreate(r => { r.updated_by = 'fixture-human'; }); const { result } = await create(f);
  f.mutateJournal(j => { delete j.entries[0].cleanupDiagnostic; });
  const entry = structuredClone(f.journal().entries[0]);
  f.mutateRemote(r => { r.updated_by = 'fixture-user'; });
  f.service.clear(); assert.equal((await f.service.connect(config())).ok, true);
  assert.equal(Object.hasOwn((await f.service.listRecords()).records[0], 'cleanupDiagnostic'), false);
  const denied = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
  assert.equal(denied.code, 'FEISHU_CLEANUP_BLOCKED'); assert.equal(Object.hasOwn(denied, 'cleanupDiagnostic'), false);
  assert.equal((await f.service.reconcile({ entryId: entry.entryId })).code, 'FEISHU_NOT_OWNED');
  assert.deepEqual(f.journal().entries[0], entry); assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0);
});

test('create origin diagnostic: first eligibility failure persists only its finite subreason', async () => {
  const cases = [
    ['CREATOR_MISSING', r => { delete r.created_by; }],
    ['CREATOR_MISSING', r => { r.created_by = null; }],
    ['CREATOR_INVALID', r => { r.created_by = { user_key: 'fixture-private-actor' }; }],
    ['CREATOR_INVALID', r => { r.created_by = 123; }],
    ['CREATOR_INVALID', r => { r.created_by = ''; }],
    ['CREATOR_MISMATCH', r => { r.created_by = 'fixture-private-actor'; }],
    ['UPDATER_MISSING', r => { delete r.updated_by; }],
    ['UPDATER_MISSING', r => { r.updated_by = null; }],
    ['UPDATER_INVALID', r => { r.updated_by = ['fixture-private-actor']; }],
    ['UPDATER_INVALID', r => { r.updated_by = ''; }],
    ['UPDATER_MISMATCH', r => { r.updated_by = 'fixture-private-actor'; }],
    ['CREATED_AT_INVALID', r => { delete r.created_at; }],
    ['CREATED_AT_INVALID', r => { r.created_at = 'fixture-private-timestamp'; }],
    ['CREATED_AT_INVALID', r => { r.created_at = 0; }],
    ['CREATED_AT_INVALID', r => { r.created_at = 100.5; }],
    ['CREATED_AT_INVALID', r => { r.created_at = Number.MAX_SAFE_INTEGER + 1; }],
    ['UPDATED_AT_INVALID', r => { r.updated_at = 0; }],
    ['CREATOR_MISSING', r => { delete r.created_by; delete r.updated_by; delete r.created_at; }]
  ];
  for (const [subreason, change] of cases) {
    const f = setup(); f.onCreate(change); const { result } = await create(f);
    assert.equal(result.ok, true); assert.equal(result.cleanupBlocked, true);
    assert.equal(result.cleanupDiagnostic, 'CREATE_ORIGIN_UNVERIFIED');
    assert.equal(result.cleanupOriginDiagnostic, subreason);
    const entry = structuredClone(f.journal().entries[0]);
    assert.equal(entry.cleanupOriginDiagnostic, subreason);
    assert.equal(entry.stamp, undefined); assert.equal(entry.stampVersion, undefined);
    assert.equal(f.snapshots.at(-1).entries[0].cleanupOriginDiagnostic, subreason);
    assert.equal((await f.service.listRecords()).records[0].cleanupOriginDiagnostic, subreason);
    const denied = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    assert.deepEqual(denied, { ok: false, code: 'FEISHU_CLEANUP_BLOCKED', cleanupBlocked: true,
      cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED', cleanupOriginDiagnostic: subreason });
    assert.doesNotMatch(JSON.stringify([result, denied]), /fixture-private-actor|fixture-private-timestamp|created_by|updated_by|created_at|updated_at/);
    f.service.clear(); assert.equal((await f.service.connect(config())).ok, true);
    assert.equal((await f.service.listRecords()).records[0].cleanupOriginDiagnostic, subreason);
    assert.deepEqual(f.journal().entries[0], entry); assert.equal(f.writes(), 1);
  }
});

test('acknowledged create accepts independent initialization clocks and preserves exact update/delete checks', async () => {
  for (const delay of [-1, 1, 1000, 60000]) {
    const f = setup();
    f.onCreate(r => { r.updated_at += delay; r.work_item_status.updated_at = r.updated_at; });
    const { result } = await create(f);
    assert.equal(result.ok, true);
    assert.equal(result.cleanupBlocked, false, 'different initialization times do not prove an external edit');
    const update = await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: 'Fixture updated contact' } });
    assert.equal(update.ok, true);
    assert.equal((await f.service.execute({ token: update.token, confirmed: true })).status, 'verified');
    const deletion = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    assert.equal(deletion.ok, true);
    assert.equal((await f.service.execute({ token: deletion.token, confirmed: true })).status, 'deleted');
    assert.equal(f.writes(), 3);
  }
});

test('independent initialization clocks do not authorize later remote changes or another actor', async () => {
  const f = setup(); f.onCreate(r => { r.updated_at++; });
  const { result } = await create(f);
  assert.equal(result.cleanupBlocked, false);
  const deletion = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
  assert.equal(deletion.ok, true);
  f.mutateRemote(r => { r.updated_at++; });
  assert.equal((await f.service.execute({ token: deletion.token, confirmed: true })).code, 'FEISHU_REMOTE_CHANGED');
  assert.equal(f.writes(), 1);
  const changed = setup(); changed.onCreate(r => { r.updated_at++; r.updated_by = 'fixture-human'; });
  assert.equal((await create(changed)).result.cleanupBlocked, true);
});

test('create origin diagnostic: projection and sanitizer reject untrusted or inapplicable subreasons', async () => {
  const f = setup(); await create(f);
  const base = { cleanupBlocked: true, cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED' };
  for (const cleanupOriginDiagnostic of ['CREATOR_MISSING', 'CREATOR_INVALID', 'CREATOR_MISMATCH',
    'UPDATER_MISSING', 'UPDATER_INVALID', 'UPDATER_MISMATCH', 'CREATED_AT_INVALID', 'TIMESTAMPS_UNEQUAL']) {
    f.mutateJournal(j => Object.assign(j.entries[0], base, { cleanupOriginDiagnostic }));
    assert.equal((await f.service.listRecords()).records[0].cleanupOriginDiagnostic, cleanupOriginDiagnostic);
    assert.deepEqual(safeError({ code: 'FEISHU_CLEANUP_BLOCKED', ...base, cleanupOriginDiagnostic }),
      { ok: false, code: 'FEISHU_CLEANUP_BLOCKED', ...base, cleanupOriginDiagnostic });
  }
  for (const cleanupOriginDiagnostic of [undefined, null, true, 1, '', 'fixture-private-actor',
    'CREATOR_MISSING\nfixture-private-actor', ' CREATOR_MISSING', 'CREATOR_MISSING ',
    ['CREATOR_MISSING'], { reason: 'CREATOR_MISSING', actor: 'fixture-private-actor' }]) {
    f.mutateJournal(j => Object.assign(j.entries[0], base, { cleanupOriginDiagnostic }));
    assert.equal(Object.hasOwn((await f.service.listRecords()).records[0], 'cleanupOriginDiagnostic'), false);
    assert.deepEqual(safeError({ code: 'FEISHU_CLEANUP_BLOCKED', ...base, cleanupOriginDiagnostic,
      actor: 'fixture-private-actor', created_at: 123 }), { ok: false, code: 'FEISHU_CLEANUP_BLOCKED', ...base });
  }
  for (const invalidBase of [{ cleanupBlocked: false, cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED' },
    { cleanupBlocked: true, cleanupDiagnostic: undefined },
    { cleanupBlocked: true, cleanupDiagnostic: 'fixture-private-reason' },
    { cleanupBlocked: true, cleanupDiagnostic: 'INITIAL_WORKFLOW_UNVERIFIED' }]) {
    f.mutateJournal(j => Object.assign(j.entries[0], invalidBase, { cleanupOriginDiagnostic: 'CREATOR_MISSING' }));
    assert.equal(Object.hasOwn((await f.service.listRecords()).records[0], 'cleanupOriginDiagnostic'), false);
    assert.equal(Object.hasOwn(safeError({ code: 'FEISHU_CLEANUP_BLOCKED', ...invalidBase,
      cleanupOriginDiagnostic: 'CREATOR_MISSING' }), 'cleanupOriginDiagnostic'), false);
  }
  for (const code of ['FEISHU_OPERATION_FAILED', 'FEISHU_ALREADY_SUBMITTED']) {
    assert.equal(Object.hasOwn(safeError({ code, ...base, cleanupOriginDiagnostic: 'CREATOR_MISSING' }), 'cleanupOriginDiagnostic'), false);
  }
});

test('create origin diagnostic: later details never recompute first or absent legacy subreasons', async () => {
  for (const legacy of ['first', 'missing-subreason', 'missing-reason']) {
    const f = setup(); f.onCreate(r => { r.updated_by = 'fixture-private-actor'; }); const { result } = await create(f);
    f.mutateJournal(j => {
      if (legacy !== 'first') delete j.entries[0].cleanupOriginDiagnostic;
      if (legacy === 'missing-reason') delete j.entries[0].cleanupDiagnostic;
    });
    const entry = structuredClone(f.journal().entries[0]);
    f.mutateRemote(r => { delete r.created_by; r.updated_by = 'fixture-user'; });
    f.service.clear(); assert.equal((await f.service.connect(config())).ok, true);
    const listed = (await f.service.listRecords()).records[0];
    assert.equal(listed.cleanupOriginDiagnostic, legacy === 'first' ? 'UPDATER_MISMATCH' : undefined);
    const absent = await f.service.verifyOwnedAbsence({ entryId: entry.entryId, recordId: result.recordId, target: entry.target });
    assert.equal(absent.ok, true); assert.equal(absent.exists, true);
    const denied = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    assert.equal(denied.code, 'FEISHU_CLEANUP_BLOCKED');
    assert.equal(denied.cleanupOriginDiagnostic, legacy === 'first' ? 'UPDATER_MISMATCH' : undefined);
    assert.deepEqual(f.journal().entries[0], entry); assert.equal(f.writes(), 1);
    f.mutateJournal(j => { j.entries[0].status = 'unknown'; });
    const reconciled = await f.service.reconcile({ entryId: entry.entryId });
    assert.equal(reconciled.ok, true); assert.equal(reconciled.cleanupBlocked, true);
    assert.equal(reconciled.cleanupOriginDiagnostic, legacy === 'first' ? 'UPDATER_MISMATCH' : undefined);
    assert.equal(f.journal().entries[0].cleanupOriginDiagnostic, legacy === 'first' ? 'UPDATER_MISMATCH' : undefined);
    if (legacy === 'missing-reason') assert.equal(f.journal().entries[0].cleanupDiagnostic, undefined);
  }
  const f = setup(); f.loseCreate(); const { result } = await create(f);
  assert.equal(result.status, 'unknown');
  f.mutateRemote(r => { delete r.created_by; });
  const reconciled = await f.service.reconcile({ entryId: result.entryId });
  assert.equal(reconciled.ok, true); assert.equal(reconciled.cleanupBlocked, true);
  assert.equal(Object.hasOwn(reconciled, 'cleanupDiagnostic'), false);
  assert.equal(Object.hasOwn(reconciled, 'cleanupOriginDiagnostic'), false);
  assert.equal(Object.hasOwn(f.journal().entries[0], 'cleanupOriginDiagnostic'), false);
});

test('create origin diagnostic: failed detail validation never produces or later reconstructs eligibility diagnostics', async () => {
  for (const updated_at of [undefined, null, '100', 100.5, Number.MAX_SAFE_INTEGER + 1]) {
    const f = setup(); f.onCreate(r => { r.updated_at = updated_at; }); const { result } = await create(f);
    assert.equal(result.ok, false); assert.equal(result.code, 'FEISHU_READBACK_INVALID');
    assert.equal(result.status, 'unknown');
    assert.equal(Object.hasOwn(result, 'cleanupOriginDiagnostic'), false);
    assert.equal(Object.hasOwn(f.journal().entries[0], 'cleanupDiagnostic'), false);
    assert.equal(Object.hasOwn(f.journal().entries[0], 'cleanupOriginDiagnostic'), false);
    f.mutateRemote(r => { r.updated_at = 100; });
    const reconciled = await f.service.reconcile({ entryId: result.entryId });
    assert.equal(reconciled.ok, true); assert.equal(reconciled.cleanupBlocked, true);
    assert.equal(Object.hasOwn(reconciled, 'cleanupDiagnostic'), false);
    assert.equal(Object.hasOwn(reconciled, 'cleanupOriginDiagnostic'), false);
    assert.equal(Object.hasOwn(f.journal().entries[0], 'cleanupOriginDiagnostic'), false);
    assert.equal(f.writes(), 1);
  }
});

test('create cleanup provenance: another actor before first readback cannot become a deletion baseline', async () => {
  const f = setup();
  f.onCreate(r => { r.updated_by = 'fixture-human'; });
  const { result } = await create(f);
  assert.equal(result.ok, true); assert.equal(result.status, 'verified'); assert.equal(result.cleanupBlocked, true);
  const entry = structuredClone(f.journal().entries[0]);
  assert.equal(entry.stamp, undefined); assert.equal(entry.stampVersion, undefined);
  assert.equal((await f.service.listRecords()).records[0].cleanupBlocked, true);
  for (const action of ['delete', 'update']) {
    assert.equal((await f.service.prepare({ action, recordId: result.recordId, safetyConfirmed: true,
      values: { contact: 'fixture changed' } })).code, 'FEISHU_CLEANUP_BLOCKED');
  }
  assert.equal((await f.service.reconcile({ entryId: entry.entryId })).code, 'FEISHU_NOT_OWNED');
  f.service.clear(); assert.equal((await f.service.connect(config())).ok, true);
  assert.equal((await f.service.listRecords()).records[0].cleanupBlocked, true);
  assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code,
    'FEISHU_CLEANUP_BLOCKED');
  assert.deepEqual(f.journal().entries[0], entry);
  assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0); assert.equal(f.writes(), 1);
});

test('create cleanup provenance: unexpected non-written data cannot be absorbed even with the API actor', async () => {
  const changes = [
    r => r.fields.push({ field_key: 'note', field_type_key: 'text', field_value: 'fixture human business' }),
    r => r.fields.push({ field_key: 'unmapped', field_type_key: 'text', field_value: 'fixture human business' }),
    r => { r.fields.find(f => f.field_key === 'role_owners').field_value[1].owners = ['fixture-human']; },
    r => { r.fields.find(f => f.field_key === 'role_owners').field_value.push({ role: 'fixture-extra', owners: ['fixture-human'] }); }
  ];
  for (const change of changes) {
    const f = setup(); f.onCreate(change); const { result } = await create(f);
    assert.equal(result.status, 'verified'); assert.equal(result.cleanupBlocked, true);
    assert.equal(f.journal().entries[0].stamp, undefined);
    assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code,
      'FEISHU_CLEANUP_BLOCKED');
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0); assert.equal(f.writes(), 1);
  }
});

test('create cleanup provenance: absent or conflicting creation origin stays blocked, never invented from updated fields', async () => {
  for (const change of [r => { delete r.created_by; }, r => { delete r.created_at; },
    r => { delete r.updated_by; }, r => { r.created_by = 'fixture-human'; },
    r => { r.created_at = 0; }, r => { r.created_at = '100'; },
    r => { r.created_at = 100.5; }, r => { r.created_by = { user_key: 'fixture-user' }; }]) {
    const f = setup(); f.onCreate(change); const { result } = await create(f);
    assert.equal(result.ok, true); assert.equal(result.cleanupBlocked, true);
    assert.equal(f.journal().entries[0].stamp, undefined); assert.equal(f.journal().entries[0].stampVersion, undefined);
    assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code,
      'FEISHU_CLEANUP_BLOCKED');
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0);
  }
});

test('create cleanup provenance: coherent new creation with typed metadata defaults and empty fields supports exact cleanup', async () => {
  const extraFields = [
    { field_key: 'fixture-default', field_name: 'Fixture default', field_type_key: 'select', is_required: 2,
      default_value: { value: 'fixture-initial', label: 'Fixture Initial' } },
    { field_key: 'fixture-empty', field_name: 'Fixture empty', field_type_key: 'text', is_required: 2 }
  ];
  const f = setup({ extraFields });
  f.onCreate(r => {
    r.fields.push({ field_key: 'fixture-default', field_type_key: 'select',
      field_value: { label: 'Fixture Initial', value: 'fixture-initial' } },
    { field_key: 'fixture-empty', field_type_key: 'text', field_value: null });
    r.fields.find(f => f.field_key === 'role_owners').field_value.push({ role: 'fixture-unassigned', owners: null });
    r.work_item_status = workflowStatus();
  });
  const { result } = await create(f);
  assert.equal(result.cleanupBlocked, false); assert.equal(f.journal().entries[0].stampVersion, 2);
  assert.equal(typeof f.journal().entries[0].stamp, 'string');
  const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
  assert.equal(p.ok, true);
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'deleted');
  assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 1);
});

test('create cleanup provenance: default mismatches, wrong types and ambiguous extra roles never qualify as server defaults', async () => {
  const extraFields = [{ field_key: 'fixture-default', field_name: 'Fixture default', field_type_key: 'text',
    is_required: 2, default_value: 'fixture initial' }];
  for (const extra of [
    { field_key: 'fixture-default', field_type_key: 'text', field_value: 'fixture modified' },
    { field_key: 'fixture-default', field_type_key: 'computed', field_value: 'fixture initial' },
    { field_key: 'fixture-default', field_type_key: 'text' }
  ]) {
    const f = setup({ extraFields }); f.onCreate(r => r.fields.push(extra)); const { result } = await create(f);
    assert.equal(result.cleanupBlocked, true); assert.equal(f.journal().entries[0].stamp, undefined);
  }
  for (const extraRole of [
    { role: 'fixture-reviewer', owners: ['other-fixture'] },
    { role: 'fixture-empty' }, { role: 'fixture-empty', owners: null, private: 'fixture data' },
    { role: 'fixture-empty', owners: '' }
  ]) {
    const f = setup(); f.onCreate(r => r.fields.find(f => f.field_key === 'role_owners').field_value.push(extraRole));
    const { result } = await create(f);
    assert.equal(result.cleanupBlocked, true); assert.equal(f.journal().entries[0].stamp, undefined);
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0);
  }
});

test('create cleanup provenance: first-readback workflow changes cannot hide behind identical creator, updater and timestamps', async () => {
  for (const change of [r => { r.work_item_status.state_key = 'fixture-progressed'; r.work_item_status.is_init_state = false; },
    r => { r.work_item_status.history.push(workflowStatus()); },
    r => { r.work_item_status.extra = 'fixture human workflow data'; }, r => { delete r.work_item_status; }]) {
    const f = setup(); f.onCreate(change); const { result } = await create(f);
    assert.equal(result.ok, true); assert.equal(result.cleanupBlocked, true);
    assert.equal(f.journal().entries[0].stamp, undefined);
    assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code,
      'FEISHU_CLEANUP_BLOCKED');
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0);
  }
});

test('create cleanup provenance: official record evidence supports cleanup independently of missing or static workflow metadata', async () => {
  for (const workflowMetadata of [null,
    { field_key: 'work_item_status', field_name: 'Fixture initial workflow', field_type_key: 'text', is_required: 2,
      default_value: workflowStatus() },
    { field_key: 'work_item_status', field_name: 'Fixture initial workflow', field_type_key: 'work_item_status', is_required: 2 },
    { field_key: 'work_item_status', field_name: 'Fixture static workflow', field_type_key: 'work_item_status', is_required: 2,
      default_value: { ...workflowStatus(), state_key: 'fixture-other', updated_at: 1, updated_by: 'fixture-config-user' } },
    { field_key: 'work_item_status', field_name: 'Fixture empty workflow default', field_type_key: 'work_item_status',
      is_required: 2, default_value: null }
  ]) {
    const f = setup({ workflowMetadata }); const { result } = await create(f);
    assert.equal(result.status, 'verified'); assert.equal(result.cleanupBlocked, false);
    assert.equal(f.journal().entries[0].stampVersion, 2);
    const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    assert.equal(p.ok, true);
    assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'deleted');
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 1);
  }
});

for (const [label, initialStatus] of [['null', null], ['empty string', ''], ['empty object', {}], ['empty array', []]]) {
  test(`create cleanup provenance: empty record workflow ${label} cannot authorize cleanup`, async () => {
    const f = setup({ initialStatus }); const { result } = await create(f);
    assert.equal(result.ok, true); assert.equal(result.status, 'verified'); assert.equal(result.cleanupBlocked, true);
    assert.equal(f.journal().entries[0].stamp, undefined); assert.equal(f.journal().entries[0].stampVersion, undefined);
    const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    if (p.ok) await f.service.execute({ token: p.token, confirmed: true });
    assert.equal(p.code, 'FEISHU_CLEANUP_BLOCKED');
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0);
  });
}

test('create cleanup provenance: record needs explicit initial flags, no nonempty history and matching audit regardless of metadata', async () => {
  const invalid = [
    { state: 'fixture-initial' },
    ...['state_key', 'is_init_state', 'is_archived_state', 'updated_by', 'updated_at'].map(k => {
      const status = workflowStatus(); delete status[k]; return status;
    }),
    ...[
      ['state_key', ''], ['state_key', 'fixture invalid'], ['state_key', 1],
      ['is_init_state', false], ['is_init_state', 'true'], ['is_archived_state', true], ['is_archived_state', 0],
      ['history', [workflowStatus()]], ['history', {}], ['history', ''],
      ['updated_by', 'fixture-human'], ['updated_by', { user_key: 'fixture-user' }],
      ['updated_at', '100'], ['updated_at', 0], ['updated_at', 100.5],
      ['state', 'fixture-initial'], ['extra', 'fixture workflow business']
    ].map(([k, v]) => ({ ...workflowStatus(), [k]: v }))
  ];
  for (const initialStatus of invalid) for (const workflowMetadata of [null,
    { field_key: 'work_item_status', field_name: 'Fixture initial workflow', field_type_key: 'work_item_status',
      is_required: 2, default_value: workflowStatus() }]) {
    const f = setup({ initialStatus, workflowMetadata }); const { result } = await create(f);
    assert.equal(result.cleanupBlocked, true, JSON.stringify(initialStatus));
    assert.equal(f.journal().entries[0].stamp, undefined);
    assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code,
      'FEISHU_CLEANUP_BLOCKED');
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0);
  }
});

test('create cleanup provenance: explicit initial workflow permits omitted, empty or null history and retains version guards', async () => {
  for (const history of [undefined, [], null]) {
    const f = setup({ initialStatus: { ...workflowStatus(), history } }); const { result } = await create(f);
    assert.equal(result.cleanupBlocked, false); assert.equal(f.journal().entries[0].stampVersion, 2);
    const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    assert.equal(p.ok, true);
    f.mutateRemote(r => { r.work_item_status.history = [workflowStatus()]; });
    assert.equal((await f.service.execute({ token: p.token, confirmed: true })).code, 'FEISHU_REMOTE_CHANGED');
    f.mutateRemote(r => { if (history === undefined) delete r.work_item_status.history; else r.work_item_status.history = history; });
    const retry = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    assert.equal((await f.service.execute({ token: retry.token, confirmed: true })).status, 'deleted');
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 1);
  }
});

test('create cleanup provenance: equal defaults with illegal supported type shapes never authorize DELETE', async () => {
  for (const [type, value] of [
    ['text', { private: 'fixture business' }], ['text', ['fixture business']], ['text', 1],
    ['number', 'fixture-not-numeric'], ['number', '12.5'], ['number', true], ['number', {}], ['number', ''],
    ['select', {}], ['select', { label: 'Fixture' }], ['select', { value: '' }],
    ['select', 'fixture-option'], ['select', []], ['select', { value: 'fixture-option', private: 'fixture business' }],
    ['link', { url: 'https://www.xiaohongshu.com/fixture' }], ['link', 'not-a-link']
  ]) {
    const f = setup({ extraFields: [{ field_key: 'fixture-default', field_name: 'Fixture default',
      field_type_key: type, is_required: 2, default_value: value }] });
    f.onCreate(r => r.fields.push({ field_key: 'fixture-default', field_type_key: type, field_value: value }));
    const { result } = await create(f);
    assert.equal(result.cleanupBlocked, true, `${type}: ${JSON.stringify(value)}`);
    assert.equal(f.journal().entries[0].stamp, undefined);
    assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code,
      'FEISHU_CLEANUP_BLOCKED');
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0);
  }
});

test('create cleanup provenance: unsupported default types stay blocked even for empty or exactly equal values', async () => {
  for (const [type, value] of [['computed', 'fixture default'], ['computed', 1], ['computed', null],
    ['computed', ''], ['multi_select', []], ['fixture-unsupported', { value: 'fixture-default' }]]) {
    const f = setup({ extraFields: [{ field_key: 'fixture-default', field_name: 'Fixture default',
      field_type_key: type, is_required: 2, default_value: value }] });
    f.onCreate(r => r.fields.push({ field_key: 'fixture-default', field_type_key: type, field_value: value }));
    const { result } = await create(f);
    assert.equal(result.cleanupBlocked, true, type); assert.equal(f.journal().entries[0].stamp, undefined);
    assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code,
      'FEISHU_CLEANUP_BLOCKED');
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0);
  }
});

test('create cleanup provenance: legitimate supported default shapes retain precise cleanup', async () => {
  for (const [type, value] of [['text', 'fixture server default'], ['text', ''], ['number', 0], ['number', 12.5],
    ['number', null], ['select', { value: 'fixture-initial', label: 'Fixture Initial' }], ['select', null],
    ['link', 'https://www.xiaohongshu.com/fixture'], ['link', null]]) {
    const f = setup({ extraFields: [{ field_key: 'fixture-default', field_name: 'Fixture default',
      field_type_key: type, is_required: 2, default_value: value }] });
    f.onCreate(r => r.fields.push({ field_key: 'fixture-default', field_type_key: type, field_value: value }));
    const { result } = await create(f);
    assert.equal(result.cleanupBlocked, false, `${type}: ${JSON.stringify(value)}`);
    const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    assert.equal(p.ok, true);
    assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'deleted');
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 1);
  }
});

test('create cleanup provenance: a clean baseline still rejects changes after its first readback', async () => {
  const f = setup(); const { result } = await create(f);
  assert.equal(result.cleanupBlocked, false);
  f.mutateRemote(r => { r.fields.push({ field_key: 'note', field_type_key: 'text', field_value: 'fixture human business' }); });
  assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code,
    'FEISHU_REMOTE_CHANGED');
  assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0);
});

test('repair: new record stamps ignore only object key order and remain stable through delete preview', async () => {
  const f = setup();
  const { result } = await create(f);
  assert.equal(f.journal().entries[0].stampVersion, 2);
  f.mutateRemote(r => {
    for (const field of r.fields) {
      if (field.field_key === 'platform') field.field_value = { ...field.field_value };
      if (field.field_key === 'role_owners') field.field_value = field.field_value.map(x => ({ owners: x.owners, role: x.role }));
    }
    r.work_item_status = { history: [], updated_by: 'fixture-user', updated_at: 100,
      is_init_state: true, is_archived_state: false, state_key: 'fixture-initial' };
  });
  const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
  assert.equal(p.ok, true);
  assert.equal(f.writes(), 1);
  f.mutateRemote(r => { r.work_item_status = workflowStatus(); });
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'deleted');
  assert.equal(f.writes(), 2);
});

test('repair: canonical stamps retain all values, array order, metadata, time and writer', () => {
  const r = { name: 'fixture', updated_at: 1, updated_by: 'fixture-user', work_item_status: workflowStatus(),
    fields: [{ field_key: 'role', field_type_key: 'role_owners', field_value: [{ role: 'maintainer', owners: ['one', 'two'] }] }] };
  const stamp = recordStamp(r, 2);
  for (const change of [x => { x.updated_at++; }, x => { x.updated_by = 'other'; },
    x => { x.name += 'changed'; }, x => { x.work_item_status.state_key = 'fixture-closed'; },
    x => { x.fields[0].field_type_key = 'text'; }, x => { x.fields[0].field_value[0].owners.reverse(); },
    x => { x.fields[0].field_value[0].role = 'other'; }, x => { x.fields[0].field_value[0].extra = true; }]) {
    const changed = structuredClone(r); change(changed);
    assert.notEqual(recordStamp(changed, 2), stamp);
  }
  for (const version of [null, 0, 3, '2']) assert.throws(() => recordStamp(r, version), { code: 'FEISHU_READBACK_INVALID' });
});

test('repair: legacy stamps remain strict and are never rebuilt from a mismatched current record', async () => {
  for (const reorder of [false, true]) {
    const f = setup(); const { result } = await create(f);
    let legacy;
    f.mutateRemote(r => { legacy = recordStamp(r, 1); });
    f.mutateJournal(j => { j.entries[0].stamp = legacy; delete j.entries[0].stampVersion; });
    if (reorder) f.mutateRemote(r => {
      r.fields.find(x => x.field_key === 'role_owners').field_value = r.fields.find(x => x.field_key === 'role_owners')
        .field_value.map(x => ({ owners: x.owners, role: x.role }));
    });
    const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    assert.equal(p.ok, !reorder);
    if (reorder) assert.equal(p.code, 'FEISHU_REMOTE_CHANGED');
    assert.equal(f.journal().entries[0].stamp, legacy);
    assert.equal(f.journal().entries[0].stampVersion, undefined);
    assert.equal(f.writes(), 1);
  }
});
test('repair: changed canonical records and unknown journal stamp versions still cannot dispatch deletion', async () => {
  for (const change of [r => { r.updated_at++; }, r => { r.updated_by = 'fixture-human'; },
    r => { r.fields.find(x => x.field_key === 'role_owners').field_value.reverse(); },
    r => { r.fields.find(x => x.field_key === 'platform').field_value.extra = 'new'; }]) {
    const f = setup(); const { result } = await create(f);
    const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
    assert.equal(p.ok, true); f.mutateRemote(change);
    assert.equal((await f.service.execute({ token: p.token, confirmed: true })).code, 'FEISHU_REMOTE_CHANGED');
    assert.equal(f.writes(), 1);
  }
  const f = setup(); const { result } = await create(f);
  f.mutateJournal(j => { j.entries[0].stampVersion = 3; });
  assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code, 'FEISHU_READBACK_INVALID');
  assert.equal(f.writes(), 1);
});
test('repair: unknown update cannot absorb non-written fields, roles, status or another writer', async () => {
  for (const change of [
    r => r.fields.push({ field_key: 'note', field_type_key: 'text', field_value: 'fixture human business' }),
    r => { r.fields = r.fields.filter(f => f.field_key !== 'source'); },
    r => { r.fields.find(f => f.field_key === 'source').field_type_key = 'text'; },
    r => { r.fields.find(f => f.field_key === 'role_owners').field_value[1].owners = ['fixture-new-reviewer']; },
    r => { r.fields.find(f => f.field_key === 'role_owners').field_value[0].owners = ['fixture-new-maintainer']; },
    r => { r.updated_by = 'fixture-human'; },
    r => { delete r.updated_by; },
    r => { r.work_item_status = { ...workflowStatus(), state_key: 'fixture-human-progress', is_init_state: false }; }
  ]) {
    const f = setup({ expires: 1800 }); const { result } = await create(f);
    const before = f.journal().entries[0].stamp;
    const p = await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: 'changed_fixture' } });
    f.onUpdate(() => { throw new Error('fixture lost update response'); });
    assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'unknown');
    f.mutateRemote(change);
    assert.equal((await f.service.reconcile({ entryId: f.journal().entries[0].entryId })).ok, false);
    assert.equal(f.journal().entries[0].status, 'unknown');
    assert.equal(f.journal().entries[0].stamp, before);
    assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).ok, false);
    assert.equal(f.writes(), 2);
  }
});

test('repair: unknown update with unchanged baseline and API writer can reconcile without blocking cleanup', async () => {
  const f = setup(); const { result } = await create(f);
  const p = await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: 'changed_fixture' } });
  f.onUpdate(() => { throw new Error('fixture lost update response'); });
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'unknown');
  const r = await f.service.reconcile({ entryId: f.journal().entries[0].entryId });
  assert.equal(r.ok, true); assert.equal(r.cleanupBlocked, false);
  assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).ok, true);
  assert.equal(f.writes(), 2);
});

test('repair: legacy unknown update without baseline cannot adopt the current record', async () => {
  const f = setup(); const { result } = await create(f);
  const p = await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: 'changed_fixture' } });
  f.onUpdate(() => { throw new Error('fixture lost update response'); });
  await f.service.execute({ token: p.token, confirmed: true });
  f.mutateJournal(j => { delete j.entries[0].mutationBaseline; });
  assert.equal((await f.service.reconcile({ entryId: f.journal().entries[0].entryId })).code, 'FEISHU_RECONCILE_UNCERTAIN');
  assert.equal(f.journal().entries[0].status, 'unknown');
});

test('repair: unknown create has no no-intervention proof and remains cleanup-blocked after reconciliation', async () => {
  for (const intervention of [false, true]) {
    const f = setup(); f.loseCreate(); await create(f);
    if (intervention) f.mutateRemote(r => {
      r.fields.push({ field_key: 'note', field_type_key: 'text', field_value: 'fixture human business' });
      r.updated_at++; r.updated_by = 'fixture-human';
    });
    const r = await f.service.reconcile({ entryId: f.journal().entries[0].entryId });
    assert.equal(r.ok, true); assert.equal(r.status, 'verified'); assert.equal(r.cleanupBlocked, true);
    const listed = await f.service.listRecords(); assert.equal(listed.records[0].cleanupBlocked, true);
    for (const action of ['update', 'delete']) {
      const p = await f.service.prepare({ action, recordId: r.recordId, safetyConfirmed: true, values: { contact: 'changed_fixture' } });
      assert.equal(p.code, 'FEISHU_CLEANUP_BLOCKED');
    }
    assert.equal(f.writes(), 1);
  }
});

for (const action of ['update', 'delete']) test(`repair: ${action} approval expiring during owned read cannot dispatch`, async () => {
  const f = setup({ expires: 1800 }); const { result } = await create(f);
  const p = await f.service.prepare({ action, recordId: result.recordId, safetyConfirmed: true, values: { contact: 'changed_fixture' } });
  f.advance(299000); f.onQuery(() => f.advance(2000));
  const r = await f.service.execute({ token: p.token, confirmed: true });
  assert.equal(r.code, 'FEISHU_CONFIRMATION_REQUIRED'); assert.equal(f.writes(), 1);
  assert.equal(f.journal().entries[0].status, 'verified');
});

test('repair: unknown delete blocks the immutable creation identity across runs even after remote absence', async () => {
  const f = setup({ extraRuns: { 'other-run': { other: { rowId: 'other', creatorName: 'Fixture Creator' } } } });
  const { result } = await create(f);
  const original = structuredClone(f.journal().entries[0].creationIdentity);
  assert.ok(original);
  const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
  f.loseDelete(); assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'unknown');
  const start = f.calls.length;
  const blocked = await prepareCreate(f, { runDir: 'other-run', rowId: 'other' });
  assert.equal(blocked.status, 'unknown'); assert.equal(blocked.entryId, f.journal().entries[0].entryId);
  assert.deepEqual(f.journal().entries[0].creationIdentity, original);
  assert.equal(f.calls.slice(start).some(c => c.body?.fields?.includes('role_owners')), false);
  assert.equal(f.writes(), 2);
});

test('repair: unknown update retains creation identity independently from mutation pairs', async () => {
  const f = setup({ extraRows: { other: { rowId: 'other' } } }); const { result } = await create(f);
  const original = structuredClone(f.journal().entries[0].creationIdentity); assert.ok(original);
  const p = await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: 'changed_fixture' } });
  f.onUpdate(() => { throw new Error('fixture lost update response'); });
  await f.service.execute({ token: p.token, confirmed: true });
  assert.deepEqual(f.journal().entries[0].creationIdentity, original);
  assert.deepEqual(f.journal().entries[0].expectedPairs, [{ field_key: 'contact', field_value: 'changed_fixture' }]);
  assert.equal((await prepareCreate(f, { rowId: 'other' })).status, 'unknown'); assert.equal(f.writes(), 2);
});

test('repair: verified history reads current maintainer before deciding and keeps the journal', async () => {
  const f = setup(); await create(f);
  const original = structuredClone(f.journal());
  f.mutateRemote(r => { r.fields.find(f => f.field_key === 'role_owners').field_value[0].owners = ['fixture-other-assignee']; });
  const start = f.calls.length;
  const p = await prepareCreate(f); assert.equal(p.ok, true, JSON.stringify(p));
  assert.ok(f.calls.slice(start).some(c => c.url.endsWith('/query')));
  assert.ok(f.calls.slice(start).some(c => c.body?.fields?.includes('role_owners')));
  assert.deepEqual(f.journal(), original); assert.equal(f.writes(), 1);
});

test('repair: verified history absence is checked remotely without erasing the journal', async () => {
  const f = setup(); await create(f); const original = structuredClone(f.journal());
  f.removeRemote(); assert.equal((await prepareCreate(f)).ok, true);
  assert.deepEqual(f.journal(), original); assert.equal(f.writes(), 1);
});

test('repair: verified history permission failure cannot be treated as changed ownership or absence', async () => {
  const f = setup(); await create(f); const original = structuredClone(f.journal());
  f.onQuery(() => { throw Object.assign(new Error(), { code: 'FEISHU_HTTP_ERROR', status: 403 }); });
  const r = await prepareCreate(f); assert.equal(r.ok, false); assert.equal(r.code, 'FEISHU_HTTP_ERROR');
  assert.deepEqual(f.journal(), original); assert.equal(f.writes(), 1);
});

const absencePayload = f => ({ entryId: f.journal().entries[0].entryId,
  recordId: f.journal().entries[0].recordId, target: f.journal().entries[0].target });
function assertDetailOnly(f, start, recordId) {
  assert.equal(f.calls.length, start + 1);
  const call = f.calls[start];
  assert.equal(call.url, 'https://project.feishu.cn/open_api/project/work_item/creator/query');
  assert.equal(call.method, 'POST');
  assert.deepEqual(call.body, { work_item_ids: [Number(recordId)] });
  assert.equal(f.writes(), 1);
}

test('external absence: exact 30005 retires only the known verified legacy entry without rebasing or deleting remotely', async () => {
  const f = setup(); await create(f);
  f.mutateJournal(j => { delete j.entries[0].stampVersion; j.entries[0].stamp = 'fixture-unrecoverable-legacy-hash'; });
  const payload = absencePayload(f), original = structuredClone(f.journal()), saves = f.snapshots.length;
  f.removeRemote(); const start = f.calls.length;
  assert.deepEqual(await f.service.verifyOwnedAbsence(payload), {
    ok: true, ...payload, exists: false, status: 'deleted', externalAbsenceVerified: true
  });
  assertDetailOnly(f, start, payload.recordId);
  const expected = structuredClone(original);
  expected.entries[0].status = 'deleted'; expected.entries[0].externalAbsenceVerified = true;
  assert.deepEqual(f.journal(), expected); assert.equal(f.snapshots.length, saves + 1);
  const projected = (await f.service.listRecords()).records[0];
  assert.equal(projected.status, 'deleted'); assert.equal(projected.externalAbsenceVerified, true);
  assert.equal(projected.stamp, undefined); assert.equal(projected.expectedPairs, undefined);
  const after = f.calls.length;
  assert.equal((await f.service.verifyOwnedAbsence(payload)).code, 'FEISHU_NOT_OWNED');
  assert.equal(f.calls.length, after); assert.deepEqual(f.journal(), expected);
});

test('current blocked inspection returns only safe reasons and never grants a new baseline', async () => {
  const f = setup(); f.onCreate(r => { r.updated_by = 'fixture-human'; });
  const { result } = await create(f);
  const entry = structuredClone(f.journal().entries[0]);
  const identity = { entryId: entry.entryId, recordId: entry.recordId, target: entry.target, inspectCurrent: true };
  const denied = await f.service.verifyOwnedAbsence(identity);
  assert.deepEqual(denied.currentInspection, { matches: false, cleanupDiagnostic: 'CREATE_ORIGIN_UNVERIFIED',
    cleanupOriginDiagnostic: 'UPDATER_MISMATCH', workflowIssues: [], defaults: { matches: true } });
  assert.doesNotMatch(JSON.stringify(denied), /fixture-human|fixture_contact/);
  f.mutateRemote(r => { r.updated_by = 'fixture-user'; });
  assert.deepEqual((await f.service.verifyOwnedAbsence(identity)).currentInspection, { matches: true, workflowIssues: [], defaults: { matches: true } });
  assert.deepEqual(f.journal().entries[0], entry);
  assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true })).code,
    'FEISHU_CLEANUP_BLOCKED');
  assert.equal(f.writes(), 1);
  f.mutateRemote(r => {
    r.updated_by = 'fixture-human';
    r.work_item_status = { state_key: 'fixture-initial', is_init_state: true, is_archived_state: false };
  });
  const workflow = await f.service.verifyOwnedAbsence(identity);
  assert.deepEqual(workflow.currentInspection.workflowIssues, ['STATUS_TIME_INVALID', 'STATUS_ACTOR_MISSING']);
  assert.doesNotMatch(JSON.stringify(workflow), /fixture-human|fixture-initial/);
  assert.deepEqual(f.journal().entries[0], entry);
  f.mutateRemote(r => { r.fields.push({ field_key: 'fixture-private-key', field_type_key: 'fixture-private-type', field_value: 'fixture-private-value' }); });
  const schema = (await f.service.verifyOwnedAbsence(identity)).currentInspection.defaults.schema;
  assert.deepEqual(schema, { ordinal: 6, slot: 'OTHER', metadataFound: false, valuePresent: true,
    actualType: 'OTHER', expectedType: 'OTHER' });
  f.mutateRemote(r => { r.fields.pop(); });
  f.mutateRemote(r => { r.name = 'Fixture real business'; });
  assert.equal((await f.service.verifyOwnedAbsence(identity)).code, 'FEISHU_READBACK_MISMATCH');
  assert.deepEqual(f.journal().entries[0], entry);
});

test('manual cleanup: exact owned blocked test can be reviewed and deleted without repairing its old baseline', async () => {
  const f = setup({ expires: 1800 }); f.onCreate(r => { r.updated_by = 'fixture-human'; });
  const { result } = await create(f), identity = absencePayload(f), original = structuredClone(f.journal().entries[0]);
  const request = { ...identity, safetyConfirmed: true };
  const preview = await f.service.prepareManualCleanup(request);
  assert.equal(preview.ok, true); assert.equal(preview.manualCleanup, true);
  assert.equal(preview.updaterChanged, true); assert.equal(preview.reviewFields.length, 5);
  assert.match(JSON.stringify(preview.reviewFields), /fixture_contact/);
  assert.deepEqual(f.journal().entries[0], original);
  assert.equal((await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: 'changed' } })).code, 'FEISHU_CLEANUP_BLOCKED');
  assert.equal((await f.service.execute({ token: preview.token, confirmed: true })).code, 'FEISHU_CONFIRMATION_REQUIRED');
  const approved = await f.service.prepareManualCleanup(request);
  const removed = await f.service.execute({ token: approved.token, confirmed: true,
    manualCleanupConfirmed: true, reviewedRecordId: result.recordId });
  assert.equal(removed.status, 'deleted'); assert.equal(f.writes(), 2);
  assert.equal(f.journal().entries[0].stamp, original.stamp);
  assert.equal(f.journal().entries[0].stampVersion, original.stampVersion);
  assert.equal(f.journal().entries[0].cleanupBlocked, true);
  assert.equal(f.journal().entries[0].mutationBaseline, undefined);
  assert.equal(typeof f.journal().entries[0].cleanupReview.stamp, 'string');
  const archived = await f.service.archiveDeletedRecords({ target: identity.target, entryIds: [identity.entryId], confirmed: true });
  assert.equal(archived.ok, true); assert.equal(archived.count, 1);
  assert.equal((await f.service.listRecords()).records[0].hiddenFromPicker, true);
  assert.equal(f.journal().entries.length, 1); assert.equal(f.writes(), 2);
});

test('manual cleanup: role and owner permutations do not change the reviewed assignment', async () => {
  const f = setup({ expires: 1800 });
  f.onCreate(r => {
    r.updated_by = 'fixture-human';
    r.fields.find(x => x.field_key === 'role_owners').field_value[1].owners.push('fixture-second-reviewer');
  });
  await create(f);
  const identity = absencePayload(f), original = structuredClone(f.journal());
  const p = await f.service.prepareManualCleanup({ ...identity, safetyConfirmed: true });
  assert.equal(p.ok, true);
  f.onQuery(r => {
    if (!r) return;
    r.fields.reverse();
    const roles = r.fields.find(x => x.field_key === 'role_owners').field_value;
    roles.reverse();
    for (const role of roles) role.owners.reverse();
  });
  const result = await f.service.execute({ token: p.token, confirmed: true,
    manualCleanupConfirmed: true, reviewedRecordId: identity.recordId });
  assert.equal(result.status, 'deleted');
  assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 1);
  assert.equal(f.journal().entries[0].stamp, original.entries[0].stamp);
  assert.equal(f.journal().entries[0].cleanupBlocked, true);
});

test('manual cleanup: role normalization cannot hide changed membership, metadata or ordered business arrays', async () => {
  for (const change of [
    r => { r.fields.find(x => x.field_key === 'role_owners').field_value[1].owners = ['fixture-new-reviewer']; },
    r => { r.fields.find(x => x.field_key === 'role_owners').field_value[1].role = 'fixture-new-role'; },
    r => { r.fields.find(x => x.field_key === 'role_owners').field_value[1].extra = 'fixture-added'; },
    r => { r.fields.find(x => x.field_key === 'fixture-array').field_value.reverse(); },
    r => { r.updated_by = 'fixture-another-writer'; },
    r => { r.updated_at++; },
    r => { r.fields.find(x => x.field_key === 'role_owners').field_value.find(x => x.role === 'fixture-unassigned').owners = []; }
  ]) {
    const f = setup({ expires: 1800 });
    f.onCreate(r => {
      r.updated_by = 'fixture-human';
      r.fields.push({ field_key: 'fixture-array', field_type_key: 'fixture-ordered', field_value: ['a', 'b'] });
      r.fields.find(x => x.field_key === 'role_owners').field_value.push({ role: 'fixture-unassigned', owners: null });
    });
    await create(f);
    const identity = absencePayload(f), original = structuredClone(f.journal());
    const p = await f.service.prepareManualCleanup({ ...identity, safetyConfirmed: true });
    assert.equal(p.ok, true); f.mutateRemote(change);
    const result = await f.service.execute({ token: p.token, confirmed: true,
      manualCleanupConfirmed: true, reviewedRecordId: identity.recordId });
    assert.equal(result.ok, false);
    assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 0);
    assert.deepEqual(f.journal(), original);
  }
});

test('manual cleanup: ambiguous or malformed role collections cannot be normalized', async () => {
  for (const change of [
    roles => { roles.push(structuredClone(roles[1])); },
    roles => { roles[1].owners.push(roles[1].owners[0]); },
    roles => { roles[1].owners = [42]; },
    roles => { delete roles[1].role; },
    roles => { delete roles[1].owners; }
  ]) {
    const f = setup({ expires: 1800 }); f.onCreate(r => { r.updated_by = 'fixture-human'; });
    await create(f); const original = structuredClone(f.journal());
    f.mutateRemote(r => change(r.fields.find(x => x.field_key === 'role_owners').field_value));
    const result = await f.service.prepareManualCleanup({ ...absencePayload(f), safetyConfirmed: true });
    assert.equal(result.ok, false); assert.equal(f.writes(), 1);
    assert.deepEqual(f.journal(), original);
  }
});

test('manual cleanup: explicit null unassigned owners are preserved, not converted to empty arrays', async () => {
  const f = setup({ expires: 1800 });
  f.onCreate(r => {
    r.updated_by = 'fixture-human';
    r.fields.find(x => x.field_key === 'role_owners').field_value.push({ role: 'fixture-unassigned', owners: null });
  });
  await create(f); const identity = absencePayload(f);
  const p = await f.service.prepareManualCleanup({ ...identity, safetyConfirmed: true });
  assert.equal(p.ok, true);
  assert.match(JSON.stringify(p.reviewFields), /fixture-unassigned/);
  f.mutateRemote(r => r.fields.find(x => x.field_key === 'role_owners').field_value.reverse());
  const result = await f.service.execute({ token: p.token, confirmed: true,
    manualCleanupConfirmed: true, reviewedRecordId: identity.recordId });
  assert.equal(result.status, 'deleted'); assert.equal(f.writes(), 2);
});

test('manual cleanup: missing approval, forged identities, changed business data and advanced flow cannot prepare', async () => {
  for (const mutate of [r => { r.name += ' real business'; }, r => { r.created_by = 'fixture-human'; },
    r => { r.fields.find(x => x.field_key === 'contact').field_value = 'fixture new business'; },
    r => { r.work_item_status.is_init_state = false; },
    r => { r.work_item_status.history = [workflowStatus()]; },
    r => { r.fields.find(x => x.field_key === 'role_owners').field_value[0].owners = ['another-fixture']; }]) {
    const f = setup(); f.onCreate(r => { r.updated_by = 'fixture-human'; }); await create(f);
    const identity = absencePayload(f), original = structuredClone(f.journal());
    assert.equal((await f.service.prepareManualCleanup(identity)).code, 'FEISHU_WRITE_SAFETY_REQUIRED');
    assert.equal((await f.service.prepareManualCleanup({ ...identity, target: 'other/creator', safetyConfirmed: true })).code, 'FEISHU_NOT_OWNED');
    f.mutateRemote(mutate);
    assert.equal((await f.service.prepareManualCleanup({ ...identity, safetyConfirmed: true })).ok, false);
    assert.deepEqual(f.journal(), original); assert.equal(f.writes(), 1);
  }
});

test('manual cleanup: later remote/local changes, expiry and missing exact confirmation stop dispatch', async () => {
  for (const mode of ['remote', 'local', 'expiry', 'confirmation']) {
    const f = setup({ expires: 1800 }); f.onCreate(r => { r.updated_by = 'fixture-human'; }); await create(f);
    const identity = absencePayload(f), p = await f.service.prepareManualCleanup({ ...identity, safetyConfirmed: true });
    assert.equal(p.ok, true);
    if (mode === 'remote') f.mutateRemote(r => { r.updated_at++; });
    if (mode === 'local') f.mutateJournal(j => { j.entries[0].maintainerName += ' changed'; });
    if (mode === 'expiry') f.advance(300001);
    const result = await f.service.execute({ token: p.token, confirmed: true, manualCleanupConfirmed: true,
      reviewedRecordId: mode === 'confirmation' ? '42' : identity.recordId });
    assert.equal(result.ok, false, mode); assert.equal(f.writes(), 1);
    assert.equal(f.journal().entries[0].status, 'verified');
    assert.equal(f.journal().entries[0].stamp, undefined);
  }
});

test('manual cleanup: complete current fields are reviewed, never converted into creation proof', async () => {
  const f = setup({ expires: 1800 }); f.onCreate(r => {
    r.fields.push({ field_key: 'fixture-extra', field_type_key: 'fixture-computed', field_value: { fixture: 'current data' } });
  });
  await create(f); const identity = absencePayload(f), original = structuredClone(f.journal());
  const p = await f.service.prepareManualCleanup({ ...identity, safetyConfirmed: true });
  assert.equal(p.ok, true); assert.equal(p.reviewFields.length, 6);
  assert.deepEqual(p.reviewFields.at(-1), { label: '字段 6', displayValue: '{"fixture":"current data"}' });
  assert.deepEqual(f.journal(), original);
  assert.equal((await f.service.prepare({ action: 'delete', recordId: identity.recordId, safetyConfirmed: true })).code, 'FEISHU_CLEANUP_BLOCKED');
});

test('external absence: existing record returns only existence and never adopts a changed legacy snapshot', async () => {
  const f = setup(); await create(f); const payload = absencePayload(f);
  f.mutateJournal(j => { delete j.entries[0].stampVersion; j.entries[0].stamp = 'fixture-old-hash'; });
  f.mutateRemote(r => { r.name = 'fixture-private-current-title'; r.updated_by = 'fixture-private-writer'; });
  const original = structuredClone(f.journal()), saves = f.snapshots.length, start = f.calls.length;
  const result = await f.service.verifyOwnedAbsence(payload);
  assert.deepEqual(result, { ok: true, ...payload, exists: true, status: 'verified', externalAbsenceVerified: false });
  assert.equal(JSON.stringify(result).includes('fixture-private'), false);
  assertDetailOnly(f, start, payload.recordId);
  assert.deepEqual(f.journal(), original); assert.equal(f.snapshots.length, saves);
});

test('external absence: missing, forged, numeric and wrong-scope payloads never read or change the journal', async () => {
  const changes = [() => undefined, () => null, p => ({ ...p, entryId: 'fixture-forged' }),
    p => ({ ...p, entryId: undefined }), p => ({ ...p, recordId: '42' }), p => ({ ...p, recordId: 41 }),
    p => ({ ...p, recordId: '041' }), p => ({ ...p, target: 'project/other' }),
    p => ({ ...p, target: 'other/creator' }), p => ({ ...p, target: undefined })];
  for (const change of changes) {
    const f = setup(); await create(f); f.removeRemote();
    const original = structuredClone(f.journal()), start = f.calls.length;
    assert.equal((await f.service.verifyOwnedAbsence(change(absencePayload(f)))).code, 'FEISHU_NOT_OWNED');
    assert.equal(f.calls.length, start); assert.deepEqual(f.journal(), original); assert.equal(f.writes(), 1);
  }
});

test('external absence: persisted title and batch must identify the exact AI test before any read', async () => {
  for (const change of [e => { e.name = 'Fixture real title'; }, e => { e.name = `[AI测试] other ${e.name}`; },
    e => { e.name = `[AI测试] ${e.batch} `; }, e => { e.batch = ''; }, e => { e.batch = 'not-a-test'; },
    e => { e.batch += '\n'; }, e => { e.target = 'other/creator'; }]) {
    const f = setup(); await create(f); const payload = absencePayload(f);
    f.mutateJournal(j => change(j.entries[0])); f.removeRemote();
    const original = structuredClone(f.journal()), start = f.calls.length;
    assert.equal((await f.service.verifyOwnedAbsence(payload)).code, 'FEISHU_NOT_OWNED');
    assert.equal(f.calls.length, start); assert.deepEqual(f.journal(), original); assert.equal(f.writes(), 1);
  }
});

test('external absence: unknown, failed, deleted and ambiguous journal identities cannot be retired', async () => {
  const changes = ['unknown', 'failed', 'deleted'].map(status => j => { j.entries[0].status = status; });
  changes.push(j => { j.entries.push(structuredClone(j.entries[0])); },
    j => { j.entries.push({ ...j.entries[0], entryId: 'fixture-second-entry' }); },
    j => { j.entries.push({ ...j.entries[0], recordId: '42' }); });
  for (const change of changes) {
    const f = setup(); await create(f); const payload = absencePayload(f);
    f.mutateJournal(change); f.removeRemote();
    const original = structuredClone(f.journal()), start = f.calls.length;
    assert.equal((await f.service.verifyOwnedAbsence(payload)).code, 'FEISHU_NOT_OWNED');
    assert.equal(f.calls.length, start); assert.deepEqual(f.journal(), original); assert.equal(f.writes(), 1);
  }
});

test('external absence: unknown deletion still requires original readonly reconciliation', async () => {
  const f = setup(); const { result } = await create(f);
  const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
  f.loseDelete(); await f.service.execute({ token: p.token, confirmed: true });
  const payload = absencePayload(f), original = structuredClone(f.journal()), start = f.calls.length;
  assert.equal((await f.service.verifyOwnedAbsence(payload)).code, 'FEISHU_NOT_OWNED');
  assert.equal(f.calls.length, start); assert.deepEqual(f.journal(), original);
  assert.equal((await f.service.reconcile({ entryId: payload.entryId })).status, 'deleted');
  assert.equal(f.journal().entries[0].externalAbsenceVerified, undefined); assert.equal(f.writes(), 2);
});

test('external absence: HTTP/API failures, malformed or partial detail and timeouts never count as 30005 proof', async () => {
  const cases = [
    [() => new Response(JSON.stringify({ err_code: 30005 }), { status: 403 }), 'FEISHU_HTTP_ERROR'],
    [() => Response.json({ err_code: 10001 }), 'FEISHU_API_ERROR'],
    [() => Response.json({ err_code: '30005' }), 'FEISHU_RESPONSE_INVALID'],
    [() => Response.json({ err_code: 0, data: [] }), 'FEISHU_READBACK_INVALID'],
    [() => new Response('fixture malformed json'), 'FEISHU_RESPONSE_INVALID'],
    [() => { throw Object.assign(new Error('fixture-private-timeout'), { code: 'FEISHU_REQUEST_TIMEOUT' }); }, 'FEISHU_REQUEST_TIMEOUT'],
    [() => { throw new Error('fixture-private-network'); }, 'FEISHU_OPERATION_FAILED']
  ];
  for (const [response, code] of cases) {
    const f = setup(); await create(f); const payload = absencePayload(f);
    f.setQueryResponse(response);
    const original = structuredClone(f.journal()), saves = f.snapshots.length, start = f.calls.length;
    const result = await f.service.verifyOwnedAbsence(payload);
    assert.equal(result.code, code); assert.equal(JSON.stringify(result).includes('fixture-private'), false);
    assertDetailOnly(f, start, payload.recordId);
    assert.deepEqual(f.journal(), original); assert.equal(f.snapshots.length, saves);
  }
  for (const change of [r => { r.id = 42; }, r => { r.project_key = 'other'; },
    r => { r.work_item_type_key = 'other'; }, r => { r.deleted_at = 1; }, r => { r.fields = null; }]) {
    const f = setup(); await create(f); const payload = absencePayload(f); f.mutateRemote(change);
    const original = structuredClone(f.journal()), start = f.calls.length;
    assert.equal((await f.service.verifyOwnedAbsence(payload)).code, 'FEISHU_READBACK_INVALID');
    assertDetailOnly(f, start, payload.recordId); assert.deepEqual(f.journal(), original);
  }
});

test('external absence: generation and session expiry after detail stop both existence and retirement results', async () => {
  for (const absent of [false, true]) {
    for (const change of ['generation', 'expiry']) {
      const f = setup(); await create(f); const payload = absencePayload(f);
      if (absent) f.removeRemote();
      f.onQuery(() => { if (change === 'generation') f.service.clear(); else f.advance(61000); });
      const original = structuredClone(f.journal()), saves = f.snapshots.length, start = f.calls.length;
      assert.equal((await f.service.verifyOwnedAbsence(payload)).code, 'FEISHU_SESSION_EXPIRED');
      assertDetailOnly(f, start, payload.recordId); assert.deepEqual(f.journal(), original);
      assert.equal(f.snapshots.length, saves);
    }
  }
});

test('external absence: payload changes during detail cannot redirect retirement', async () => {
  const f = setup(); await create(f); f.removeRemote();
  const payload = absencePayload(f), captured = { ...payload }, start = f.calls.length;
  f.onQuery(() => { payload.recordId = '42'; payload.target = 'other/creator'; payload.entryId = 'fixture-forged'; });
  const result = await f.service.verifyOwnedAbsence(payload);
  assert.deepEqual(result, { ok: true, ...captured, exists: false, status: 'deleted', externalAbsenceVerified: true });
  assertDetailOnly(f, start, captured.recordId); assert.equal(f.journal().entries[0].recordId, captured.recordId);
});

test('external absence: changed entry during detail fails closed but unrelated latest journal entries survive retirement', async () => {
  const f = setup(); await create(f); f.removeRemote(); const payload = absencePayload(f);
  f.onQuery(() => f.mutateJournal(j => { j.entries[0].status = 'unknown'; }));
  assert.equal((await f.service.verifyOwnedAbsence(payload)).code, 'FEISHU_NOT_OWNED');
  assert.equal(f.journal().entries[0].status, 'unknown'); assert.equal(f.journal().entries[0].externalAbsenceVerified, undefined);
  f.mutateJournal(j => { j.entries[0].status = 'verified'; });
  f.onQuery(() => f.mutateJournal(j => { j.entries[0].name += ' fixture concurrent change'; }));
  assert.equal((await f.service.verifyOwnedAbsence(payload)).code, 'FEISHU_LOCAL_CHANGED');
  assert.equal(f.journal().entries[0].status, 'verified');
  const other = { entryId: 'fixture-other-entry', recordId: '99', target: 'other/creator', status: 'unknown' };
  f.onQuery(() => f.mutateJournal(j => { j.entries.push(structuredClone(other)); }));
  assert.equal((await f.service.verifyOwnedAbsence(payload)).ok, true);
  assert.deepEqual(f.journal().entries[1], other); assert.equal(f.writes(), 1);
});

test('external absence: failed local save cannot mutate shared journal or poison a later ordinary save', async () => {
  const f = setup({ journalByReference: true }); const { result } = await create(f);
  let remote; f.mutateRemote(r => { remote = structuredClone(r); }); f.removeRemote();
  const payload = absencePayload(f), shared = f.journal(), original = structuredClone(shared), saves = f.snapshots.length;
  f.onSave(v => {
    assert.notEqual(v, shared); assert.notEqual(v.entries[0], shared.entries[0]);
    throw new Error('fixture-private-save-failure');
  });
  assert.deepEqual(await f.service.verifyOwnedAbsence(payload), { ok: false, code: 'FEISHU_OPERATION_FAILED' });
  assert.equal(f.journal(), shared); assert.deepEqual(shared, original); assert.equal(f.snapshots.length, saves);
  f.onSave(() => {}); f.setRemote(remote);
  const p = await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: 'fixture updated' } });
  assert.equal(p.ok, true);
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'verified');
  assert.equal(f.journal().entries[0].externalAbsenceVerified, undefined); assert.equal(f.writes(), 2);
});

test('external absence: retirement preserves audit identity, removes mutation eligibility and permits readonly reprepare', async () => {
  const f = setup(); const { result } = await create(f); f.removeRemote();
  const payload = absencePayload(f), original = structuredClone(f.journal().entries[0]);
  assert.equal((await f.service.verifyOwnedAbsence(payload)).ok, true);
  assert.deepEqual(f.journal().entries[0].creationIdentity, original.creationIdentity);
  assert.equal(f.journal().entries[0].stamp, original.stamp);
  for (const action of ['update', 'delete']) {
    assert.equal((await f.service.prepare({ action, recordId: result.recordId, safetyConfirmed: true,
      values: { contact: 'fixture updated' } })).code, 'FEISHU_NOT_OWNED');
  }
  assert.equal((await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: false })).ok, true);
  assert.equal(f.writes(), 1);
});

test('repair: absent old verified ID never hides another remote same-owner match', async () => {
  const f = setup(); await create(f); f.removeRemote();
  const original = structuredClone(f.journal()), start = f.calls.length;
  f.setDuplicateResponse(() => Response.json(duplicateEnvelope()));
  assert.equal((await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: false })).code,
    'FEISHU_DUPLICATE_MAINTAINER');
  assert.ok(f.calls.slice(start).some(c => c.url.endsWith('/query')));
  assert.ok(f.calls.slice(start).some(c => c.url.endsWith('/search/params')));
  assert.deepEqual(f.journal(), original); assert.equal(f.writes(), 1);
});

test('repair: old verified ID restored after readonly prepare blocks execution before journal or write', async () => {
  const f = setup(); await create(f); let remote; f.mutateRemote(r => { remote = structuredClone(r); });
  f.removeRemote(); const original = structuredClone(f.journal()), saves = f.snapshots.length;
  const p = await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: false }); assert.equal(p.ok, true);
  f.setRemote(remote);
  const result = await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true });
  assert.equal(result.code, 'FEISHU_ALREADY_SUBMITTED');
  assert.deepEqual(f.journal(), original); assert.equal(f.snapshots.length, saves); assert.equal(f.writes(), 1);
});

const missingHttpResponse = () => Response.json({ err_code: 30005, err_msg: 'fixture-private-response' }, { status: 400 });

test('missing HTTP: exact 400/30005 retires a verified legacy entry without rebasing or remote deletion', async () => {
  const f = setup(); await create(f);
  f.mutateJournal(j => { delete j.entries[0].stampVersion; j.entries[0].stamp = 'fixture-legacy-hash'; });
  f.removeRemote(); f.setQueryResponse(missingHttpResponse);
  const payload = absencePayload(f), original = structuredClone(f.journal()), start = f.calls.length;
  const saves = f.snapshots.length;
  assert.deepEqual(await f.service.verifyOwnedAbsence(payload), {
    ok: true, ...payload, exists: false, status: 'deleted', externalAbsenceVerified: true
  });
  assertDetailOnly(f, start, payload.recordId);
  original.entries[0].status = 'deleted'; original.entries[0].externalAbsenceVerified = true;
  assert.deepEqual(f.journal(), original); assert.equal(f.snapshots.length, saves + 1);
  assert.equal((await f.service.listRecords()).records[0].externalAbsenceVerified, true);
});

test('missing HTTP: absent verified ID permits readonly prepare but execute still blocks a remote same-owner record', async () => {
  const f = setup(); await create(f); f.removeRemote(); f.setQueryResponse(missingHttpResponse);
  const original = structuredClone(f.journal()), saves = f.snapshots.length, start = f.calls.length;
  const p = await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: false });
  assert.equal(p.ok, true);
  assert.ok(f.calls.slice(start).some(c => c.url.endsWith('/search/params')));
  assert.deepEqual(f.journal(), original); assert.equal(f.snapshots.length, saves);
  f.setDuplicateResponse(() => Response.json(duplicateEnvelope()));
  const result = await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true });
  assert.equal(result.code, 'FEISHU_DUPLICATE_MAINTAINER');
  assert.deepEqual(f.journal(), original); assert.equal(f.snapshots.length, saves); assert.equal(f.writes(), 1);
});

test('missing HTTP: absent verified ID never hides a remote same-owner match during prepare', async () => {
  const f = setup(); await create(f); f.removeRemote(); f.setQueryResponse(missingHttpResponse);
  f.setDuplicateResponse(() => Response.json(duplicateEnvelope()));
  const original = structuredClone(f.journal()), saves = f.snapshots.length, start = f.calls.length;
  assert.equal((await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: false })).code,
    'FEISHU_DUPLICATE_MAINTAINER');
  assert.ok(f.calls.slice(start).some(c => c.url.endsWith('/search/params')));
  assert.deepEqual(f.journal(), original); assert.equal(f.snapshots.length, saves); assert.equal(f.writes(), 1);
});

test('missing HTTP: old ID restored after readonly prepare blocks execute before journal or write', async () => {
  const f = setup(); await create(f); let remote; f.mutateRemote(r => { remote = structuredClone(r); });
  f.removeRemote(); f.setQueryResponse(missingHttpResponse);
  const original = structuredClone(f.journal()), saves = f.snapshots.length;
  const p = await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: false }); assert.equal(p.ok, true);
  f.setQueryResponse(null); f.setRemote(remote);
  assert.equal((await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true })).code,
    'FEISHU_ALREADY_SUBMITTED');
  assert.deepEqual(f.journal(), original); assert.equal(f.snapshots.length, saves); assert.equal(f.writes(), 1);
});

test('missing HTTP: delete readback accepts exact 400/30005 without claiming external absence', async () => {
  const f = setup(); const { result } = await create(f);
  const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
  assert.equal(p.ok, true);
  f.onQuery(() => { if (f.writes() === 2) f.setQueryResponse(missingHttpResponse); });
  const deleted = await f.service.execute({ token: p.token, confirmed: true });
  assert.equal(deleted.ok, true); assert.equal(deleted.status, 'deleted');
  assert.equal(f.journal().entries[0].externalAbsenceVerified, undefined); assert.equal(f.writes(), 2);
  assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 1);
});

test('missing HTTP: unknown delete reconciles exact 400/30005 readonly and never resends deletion', async () => {
  const f = setup(); const { result } = await create(f);
  const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
  f.loseDelete(); assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'unknown');
  f.setQueryResponse(missingHttpResponse);
  const payload = absencePayload(f), original = structuredClone(f.journal()), start = f.calls.length;
  assert.equal((await f.service.verifyOwnedAbsence(payload)).code, 'FEISHU_NOT_OWNED');
  assert.equal((await prepareCreate(f)).status, 'unknown');
  assert.equal(f.calls.slice(start).filter(c => c.url.endsWith('/query')).length, 0);
  assert.deepEqual(f.journal(), original);
  const before = f.calls.length;
  assert.equal((await f.service.reconcile({ entryId: payload.entryId })).status, 'deleted');
  assert.equal(f.calls.length, before + 1);
  assert.deepEqual(f.calls[before].body, { work_item_ids: [Number(payload.recordId)] });
  assert.equal(f.journal().entries[0].externalAbsenceVerified, undefined); assert.equal(f.writes(), 2);
  assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 1);
});

test('missing HTTP: every detail absence path rejects other status, API code and ambiguous bodies', async () => {
  const cases = [
    ...[401, 403, 404, 429, 500, 503].map(status => [status, { err_code: 30005 }]),
    [400, { err_code: 10001 }], [400, { err_code: 0 }], [400, { err_code: '30005' }],
    [400, { err_code: null }], [400, {}], [400, 'fixture-private-malformed']
  ];
  for (const [status, body] of cases) {
    for (const path of ['absence', 'prepare', 'create-execute', 'delete-readback', 'delete-reconcile']) {
      const label = `${path}: HTTP ${status}, ${JSON.stringify(body)}`;
      const f = setup(); const { result } = await create(f);
      let p;
      if (path === 'create-execute') { f.removeRemote(); p = await prepareCreate(f); assert.equal(p.ok, true); }
      if (path.startsWith('delete')) {
        p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
        assert.equal(p.ok, true);
      }
      if (path === 'delete-reconcile') {
        f.loseDelete(); assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'unknown');
      }
      const response = () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
      if (path === 'delete-readback') f.onQuery(() => { if (f.writes() === 2) f.setQueryResponse(response); });
      else f.setQueryResponse(response);
      const original = structuredClone(f.journal()), saves = f.snapshots.length, start = f.calls.length;
      let rejected;
      if (path === 'absence') rejected = await f.service.verifyOwnedAbsence(absencePayload(f));
      else if (path === 'prepare') rejected = await prepareCreate(f);
      else if (path === 'delete-reconcile') rejected = await f.service.reconcile({ entryId: result.entryId });
      else rejected = await f.service.execute({ token: p.token, confirmed: true });
      assert.equal(rejected.ok, false, label); assert.equal(rejected.code, 'FEISHU_HTTP_ERROR', label);
      assert.equal(rejected.apiCode, Number.isSafeInteger(body?.err_code) && body.err_code !== 0 ? body.err_code : undefined, label);
      assert.equal(JSON.stringify(rejected).includes('fixture-private'), false, label);
      assert.equal(f.calls.slice(start).some(c => c.url.endsWith('/search/params')), false, label);
      if (path === 'delete-readback') {
        assert.equal(rejected.status, 'unknown', label); assert.equal(f.journal().entries[0].status, 'unknown', label);
        assert.equal(f.journal().entries[0].stamp, original.entries[0].stamp, label);
        assert.equal(f.journal().entries[0].externalAbsenceVerified, undefined, label); assert.equal(f.writes(), 2, label);
      } else {
        assert.deepEqual(f.journal(), original, label); assert.equal(f.snapshots.length, saves, label);
        assert.equal(f.writes(), path === 'delete-reconcile' ? 2 : 1, label);
      }
    }
  }
});

test('missing HTTP: create and update unknown reconciliation cannot treat missing as write verification', async () => {
  for (const action of ['create', 'update']) {
    const f = setup();
    if (action === 'create') f.onCreate(() => f.setQueryResponse(missingHttpResponse));
    const { result } = await create(f);
    if (action === 'update') {
      const p = await f.service.prepare({ action, recordId: result.recordId, values: { contact: 'fixture update' } });
      f.onUpdate(() => f.setQueryResponse(missingHttpResponse));
      assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'unknown');
    } else { assert.equal(result.status, 'unknown'); assert.equal(result.recordId, '41'); }
    const original = structuredClone(f.journal()), saves = f.snapshots.length, writes = f.writes(), start = f.calls.length;
    assert.equal((await f.service.reconcile({ entryId: result.entryId })).code, 'FEISHU_HTTP_ERROR');
    assert.equal((await prepareCreate(f)).status, 'unknown');
    assert.equal(f.calls.slice(start).filter(c => c.url.endsWith('/query')).length, 1);
    assert.deepEqual(f.journal(), original); assert.equal(f.snapshots.length, saves); assert.equal(f.writes(), writes);
  }
});

test('missing HTTP: create dispatch and library search never consume detail-only absence proof', async () => {
  for (const [response, code, status] of [
    [missingHttpResponse, 'FEISHU_HTTP_ERROR', 'unknown'],
    [() => Response.json({ err_code: 30005 }), 'FEISHU_API_ERROR', 'failed']
  ]) {
    const f = setup(); f.setCreateFailure(response);
    const { result } = await create(f);
    assert.equal(result.ok, false); assert.equal(result.code, code); assert.equal(result.apiCode, 30005);
    assert.equal(result.status, status); assert.equal(f.journal().entries[0].status, status);
    assert.equal(f.journal().entries[0].recordId, undefined);
    assert.equal(f.journal().entries[0].externalAbsenceVerified, undefined); assert.equal(f.writes(), 1);

    const g = setup(); await create(g); g.removeRemote(); g.setQueryResponse(missingHttpResponse);
    g.setDuplicateResponse(response);
    const original = structuredClone(g.journal()), saves = g.snapshots.length;
    const rejected = await prepareCreate(g);
    assert.equal(rejected.ok, false); assert.equal(rejected.code, code); assert.equal(rejected.apiCode, 30005);
    assert.deepEqual(g.journal(), original); assert.equal(g.snapshots.length, saves); assert.equal(g.writes(), 1);
  }
});

test('missing HTTP: session and generation changes after detail cannot retire a verified entry', async () => {
  for (const change of ['generation', 'expiry']) {
    const f = setup(); await create(f); f.setQueryResponse(missingHttpResponse);
    const payload = absencePayload(f), original = structuredClone(f.journal()), saves = f.snapshots.length;
    f.onQuery(() => { if (change === 'generation') f.service.clear(); else f.advance(61000); });
    assert.equal((await f.service.verifyOwnedAbsence(payload)).code, 'FEISHU_SESSION_EXPIRED');
    assert.deepEqual(f.journal(), original); assert.equal(f.snapshots.length, saves); assert.equal(f.writes(), 1);
  }
});

test('repair: text quote readback binds original metadata type through reconnect and reconciliation', async () => {
  const extraFields = [{ field_key: 'image', field_name: '图文平台价', field_type_key: 'text', is_required: 2 }];
  const f = setup({ extraFields }); await f.service.connect(config());
  f.onCreate(r => { r.fields.find(f => f.field_key === 'image').field_type_key = 'computed'; });
  const p = await prepareCreate(f, { values: { ...values(), image: '4800' } });
  const r = await f.service.execute({ token: p.token, confirmed: true });
  assert.equal(r.code, 'FEISHU_READBACK_MISMATCH'); assert.equal(r.status, 'unknown');
  assert.equal((await f.service.reconcile({ entryId: f.journal().entries[0].entryId })).code, 'FEISHU_READBACK_MISMATCH');
  f.mutateRemote(r => { r.fields.find(f => f.field_key === 'image').field_type_key = 'text'; });
  extraFields[0].field_type_key = 'number'; await f.service.connect(config());
  const reconciled = await f.service.reconcile({ entryId: f.journal().entries[0].entryId });
  assert.equal(reconciled.ok, true); assert.equal(reconciled.cleanupBlocked, true); assert.equal(f.writes(), 1);
});

test('repair: UI journal projection preserves immutable account and selected name without credentials or mutation fields', async () => {
  const f = setup(); const { result } = await create(f);
  assert.equal(result.entryId, f.journal().entries[0].entryId);
  const p = await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: 'changed_fixture' } });
  f.onUpdate(() => { throw new Error('fixture lost update response'); });
  const unknown = await f.service.execute({ token: p.token, confirmed: true });
  assert.equal(unknown.entryId, result.entryId);
  const list = await f.service.listRecords(); const record = list.records[0];
  assert.equal(record.target, 'project/creator'); assert.equal(record.accountNumber, '001234');
  assert.equal(record.maintainerName, 'Fixture Operator'); assert.equal(record.cleanupBlocked, false);
  const blocked = await prepareCreate(f);
  assert.equal(blocked.maintainerName, 'Fixture Operator'); assert.equal(blocked.entryId, result.entryId);
  for (const privateValue of ['changed_fixture', 'fixture_contact', 'fixture-user', 'p-fixture', 'expectedPairs', 'expectedMaintainer']) {
    assert.equal(JSON.stringify(list).includes(privateValue), false);
  }
  f.mutateJournal(j => { delete j.entries[0].maintainerName; delete j.entries[0].creationIdentity; });
  const legacy = (await f.service.listRecords()).records[0];
  assert.equal(legacy.maintainerName, ''); assert.equal(legacy.accountNumber, '');
});

test('repair: only already-submitted unknown errors expose a bounded control-free maintainer name', () => {
  const base = { code: 'FEISHU_ALREADY_SUBMITTED', status: 'unknown', maintainerName: 'Fixture Operator' };
  assert.equal(safeError(base).maintainerName, 'Fixture Operator');
  for (const maintainerName of ['', 'x'.repeat(257), 'Fixture\nOperator', 'Fixture\tOperator', 'Fixture\x7fOperator', { name: 'Fixture' }]) {
    assert.equal(Object.hasOwn(safeError({ ...base, maintainerName }), 'maintainerName'), false);
  }
  for (const error of [{ ...base, status: 'verified' }, { ...base, code: 'FEISHU_HTTP_ERROR' }]) {
    assert.equal(Object.hasOwn(safeError(error), 'maintainerName'), false);
  }
});

test('repair: journal projection sanitizes malformed public identity and name and never uses actor as a name', async () => {
  const f = setup(); await create(f);
  f.mutateJournal(j => {
    j.entries[0].maintainerName = 'Fixture\nOperator';
    j.entries[0].creationIdentity = { ...j.entries[0].creationIdentity, identity: 'fixture\naccount' };
  });
  const record = (await f.service.listRecords()).records[0];
  assert.equal(record.maintainerName, ''); assert.equal(record.accountNumber, '');
  assert.equal(record.target, 'project/creator'); assert.equal(record.cleanupBlocked, false);
});

test('repair: legacy mutation journals never invent a creation account from a current remote snapshot', async () => {
  const f = setup(); const { result } = await create(f);
  const old = await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: 'changed_fixture' } });
  assert.equal((await f.service.execute({ token: old.token, confirmed: true })).ok, true);
  f.mutateJournal(j => { delete j.entries[0].creationIdentity; });
  const p = await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: 'second_fixture' } });
  f.onUpdate(() => { throw new Error('fixture lost update response'); });
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'unknown');
  assert.equal(f.journal().entries[0].creationIdentity, undefined);
  assert.equal((await f.service.listRecords()).records[0].accountNumber, '');
  assert.equal((await prepareCreate(f)).status, 'unknown');
});

test('repair: legacy unknown quote without original metadata types stays uncertain instead of guessing current schema', async () => {
  const f = setup({ extraFields: [{ field_key: 'image', field_name: '图文平台价', field_type_key: 'text', is_required: 2 }] });
  await f.service.connect(config()); f.loseCreate();
  const p = await prepareCreate(f, { values: { ...values(), image: '4800' } });
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'unknown');
  f.mutateJournal(j => { delete j.entries[0].expectedFieldTypes; });
  const r = await f.service.reconcile({ entryId: f.journal().entries[0].entryId });
  assert.equal(r.code, 'FEISHU_RECONCILE_UNCERTAIN');
  assert.equal(f.journal().entries[0].status, 'unknown'); assert.equal(f.writes(), 1);
});

test('session returns no tokens/user credentials, secret cleared, expires and clears', async () => {
  const f = setup(), c = config(), r = await f.service.connect(c);
  assert.equal(r.ok, true); assert.equal(c.pluginSecret, '');
  assert.ok(!JSON.stringify(r).includes('p-fixture'));
  assert.ok(!JSON.stringify(r).includes('fixture-user'));
  f.advance(61000); assert.equal((await f.service.listRecords()).code, 'FEISHU_SESSION_EXPIRED');
});

test('independent batch previews survive later row lookups and are single-use', async () => {
  const f = setup({ extraRows: { other: { rowId: 'other', creatorName: 'Other Fixture' } } });
  await f.service.connect(config());
  const first = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
  const second = await f.service.lookup({ runDir: 'run', rowId: 'other', accountNumber: '001234' });
  for (const [rowId, token] of [['row', first.token], ['other', second.token]]) {
    const payload = { runDir: 'run', rowId, token, recordId: '5', kind: 'wechat' };
    assert.equal((await f.service.applyContact(payload)).ok, true);
    assert.equal((await f.service.applyContact(payload)).code, 'FEISHU_PREVIEW_EXPIRED');
  }
  assert.equal(f.writes(), 0);
});

test('re-query invalidates only the same row; identity changes block stale contact application', async () => {
  const f = setup(); await f.service.connect(config());
  const old = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
  const fresh = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
  const p = { runDir: 'run', rowId: 'row', recordId: '5', kind: 'wechat' };
  assert.equal((await f.service.applyContact({ ...p, token: old.token })).code, 'FEISHU_PREVIEW_EXPIRED');
  f.mutateLocal(r => { r.creatorName = 'Different Fixture'; });
  assert.equal((await f.service.applyContact({ ...p, token: fresh.token })).code, 'FEISHU_LOCAL_CHANGED');
  assert.equal(f.writes(), 0);
});

test('batch preview cache is bounded to 50, expires and cannot cross rows or runs', async () => {
  const extraRows = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`r${i}`, { rowId: `r${i}`, creatorName: `Fixture ${i}` }]));
  const f = setup({ expires: 1800, extraRows }); await f.service.connect(config());
  const previews = [];
  for (let i = 0; i < 51; i++) previews.push(await f.service.lookup({ runDir: 'run', rowId: `r${i}`, accountNumber: '001234' }));
  const p = { runDir: 'run', rowId: 'r0', token: previews[0].token, recordId: '5', kind: 'wechat' };
  assert.equal((await f.service.applyContact(p)).code, 'FEISHU_PREVIEW_EXPIRED');
  assert.equal((await f.service.applyContact({ ...p, rowId: 'r49', token: previews[50].token })).code, 'FEISHU_PREVIEW_EXPIRED');
  assert.equal((await f.service.applyContact({ ...p, runDir: 'other', rowId: 'r50', token: previews[50].token })).code, 'FEISHU_PREVIEW_EXPIRED');
  f.advance(301000);
  assert.equal((await f.service.applyContact({ ...p, rowId: 'r50', token: previews[50].token })).code, 'FEISHU_PREVIEW_EXPIRED');
  assert.equal(f.writes(), 0);
});

test('saved connection restores in a new workbench without returning credentials or writing records', async () => {
  const store = memoryStore(), first = setup({ connectionStore: store });
  const result = await first.service.connect(config());
  assert.equal(result.saved, true); first.service.clear();
  const restarted = setup({ connectionStore: store });
  const restored = await restarted.service.restoreConnection();
  assert.equal(restored.connected, true); assert.equal(restored.saved, true);
  assert.equal(restored.target, 'project/creator'); assert.equal(restarted.writes(), 0);
  assert.equal(restarted.calls.filter(c => c.url.endsWith('/plugin_token')).length, 1);
  for (const value of ['fixture-user', 'fixture-secret', 'p-fixture']) assert.equal(JSON.stringify(restored).includes(value), false);
});
test('connection revocation: storage errors revoke session, leases, plans and local apply without automatic revival', async () => {
  for (const method of ['disconnect', 'forgetConnection']) for (const asynchronous of [false, true]) {
    const store = memoryStore(), f = setup({ connectionStore: store });
    assert.equal((await f.service.connect(config())).ok, true);
    const people = await f.service.searchMaintainers({ name: 'Fixture Operator' });
    const candidateToken = people.candidates[0].token;
    const lease = await f.service.inspectOperator({ candidateToken });
    const plan = await f.service.prepare({ action: 'create', runDir: 'run', rowId: 'row', values: values(),
      safetyConfirmed: true, operatorToken: lease.token, operatorConfirmed: true });
    assert.equal(plan.ok, true);
    const lookup = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
    assert.equal(lookup.ok, true);
    const original = store.read(), originalJournal = structuredClone(f.journal());
    const rejectStorage = () => { throw Object.assign(new Error('fixture-private-storage-error'), { code: 'FEISHU_STORAGE_SAVE_FAILED' }); };
    store[method === 'disconnect' ? 'suspend' : 'forget'] = asynchronous ? async () => rejectStorage() : rejectStorage;
    assert.deepEqual(await f.service[method](), { ok: false, code: 'FEISHU_STORAGE_SAVE_FAILED', sessionRevoked: true });
    const requests = f.calls.length;
    assert.equal((await f.service.status()).connected, false);
    assert.equal((await f.service.execute({ token: plan.token, confirmed: true })).code, 'FEISHU_SESSION_EXPIRED');
    assert.equal((await f.service.applyContact({ token: lookup.token, runDir: 'run', rowId: 'row', recordId: 5, kind: 'wechat' })).code,
      'FEISHU_SESSION_EXPIRED');
    assert.equal((await f.service.inspectOperator({ candidateToken })).code, 'FEISHU_SESSION_EXPIRED');
    assert.equal((await f.service.restoreConnection({ manual: false })).connected, false);
    assert.equal((await f.service.restoreConnection()).connected, false);
    assert.equal(f.calls.length, requests); assert.equal(f.writes(), 0);
    assert.deepEqual(store.read(), original); assert.deepEqual(f.journal(), originalJournal);
    assert.equal((await f.service.restoreConnection({ manual: true })).connected, true);
    assert.equal((await f.service.execute({ token: plan.token, confirmed: true })).code, 'FEISHU_CONFIRMATION_REQUIRED');
    assert.equal((await f.service.inspectOperator({ candidateToken })).code, 'FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
    assert.equal((await f.service.prepare({ action: 'create', runDir: 'run', rowId: 'row', values: values(),
      safetyConfirmed: true, operatorToken: lease.token, operatorConfirmed: true })).code, 'FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
    assert.equal((await f.service.applyContact({ token: lookup.token, runDir: 'run', rowId: 'row', recordId: 5, kind: 'wechat' })).code,
      'FEISHU_PREVIEW_EXPIRED');
    assert.equal(f.writes(), 0); assert.deepEqual(store.read(), original); assert.deepEqual(f.journal(), originalJournal);
  }
});

test('connection revocation: pending storage is awaited and cannot revive authority after rejection', async () => {
  for (const method of ['disconnect', 'forgetConnection']) {
    const store = memoryStore(), f = setup({ connectionStore: store });
    assert.equal((await f.service.connect(config())).ok, true);
    const plan = await prepareCreate(f), original = store.read();
    let reject, settled = false;
    store[method === 'disconnect' ? 'suspend' : 'forget'] = () => new Promise((_, fail) => { reject = fail; });
    const revocation = f.service[method]().then(result => { settled = true; return result; });
    await Promise.resolve(); assert.equal(settled, false); assert.equal(typeof reject, 'function');
    assert.equal((await f.service.execute({ token: plan.token, confirmed: true })).code, 'FEISHU_BUSY');
    reject(Object.assign(new Error('fixture-private-storage-error'), { code: 'FEISHU_STORAGE_SAVE_FAILED' }));
    assert.deepEqual(await revocation, { ok: false, code: 'FEISHU_STORAGE_SAVE_FAILED', sessionRevoked: true });
    assert.equal((await f.service.status()).connected, false);
    assert.equal((await f.service.execute({ token: plan.token, confirmed: true })).code, 'FEISHU_SESSION_EXPIRED');
    assert.equal((await f.service.restoreConnection()).connected, false);
    assert.deepEqual(store.read(), original); assert.equal(f.writes(), 0);
  }
});

test('connection revocation: busy dispatched writes retain durable unknown results and reconcile without resending', async () => {
  for (const method of ['disconnect', 'forgetConnection']) for (const action of ['create', 'update', 'delete']) {
    const store = memoryStore(), f = setup({ connectionStore: store });
    let plan, revoked, storageCalls = 0;
    if (action === 'create') {
      await f.service.connect(config()); plan = await prepareCreate(f);
    } else {
      const { result } = await create(f);
      plan = await f.service.prepare({ action, recordId: result.recordId, safetyConfirmed: true,
        values: action === 'update' ? { contact: 'fixture changed' } : undefined });
    }
    assert.equal(plan.ok, true);
    const original = store.read();
    store[method === 'disconnect' ? 'suspend' : 'forget'] = () => { storageCalls++; throw new Error('fixture storage error'); };
    const revoke = () => { revoked = f.service[method](); };
    if (action === 'create') f.onCreate(revoke);
    else if (action === 'update') f.onUpdate(revoke);
    else f.onQuery(record => { if (!record) revoke(); });
    const result = await f.service.execute({ token: plan.token, confirmed: true });
    assert.deepEqual(await revoked, { ok: false, code: 'FEISHU_BUSY', sessionRevoked: true });
    assert.equal(storageCalls, 0); assert.deepEqual(store.read(), original);
    assert.equal(result.status, 'unknown'); assert.equal(result.code, 'FEISHU_SESSION_EXPIRED');
    const entry = f.journal().entries[0];
    assert.equal(entry.status, 'unknown'); assert.equal(entry.action, action); assert.equal(entry.recordId, '41');
    assert.equal(entry.entryId, result.entryId); assert.equal(f.journal().entries.length, 1);
    const writes = f.writes(), requests = f.calls.length;
    assert.equal(writes, action === 'create' ? 1 : 2);
    assert.equal((await f.service.status()).connected, false);
    assert.equal((await f.service.restoreConnection()).connected, false); assert.equal(f.calls.length, requests);
    assert.equal((await f.service.restoreConnection({ manual: true })).connected, true);
    f.onQuery(() => {});
    const reconciled = await f.service.reconcile({ entryId: entry.entryId });
    assert.equal(reconciled.ok, true); assert.equal(reconciled.status, action === 'delete' ? 'deleted' : 'verified');
    if (action === 'create') assert.equal(reconciled.cleanupBlocked, true);
    assert.equal(f.writes(), writes);
  }
});

test('connection revocation: successful disconnect and forget report revoked session without changing storage policy', async () => {
  for (const method of ['disconnect', 'forgetConnection']) {
    const store = memoryStore(), f = setup({ connectionStore: store });
    await f.service.connect(config()); const original = store.read();
    assert.deepEqual(await f.service[method](), { ok: true, sessionRevoked: true });
    assert.equal((await f.service.status()).connected, false);
    assert.deepEqual(store.read(), method === 'disconnect' ? { ...original, autoConnect: false } : null);
  }
});

test('disconnect preserves configuration but suppresses startup reconnect until explicitly restored', async () => {
  const store = memoryStore(), f = setup({ connectionStore: store });
  await f.service.connect(config()); await f.service.disconnect();
  assert.equal(store.read().autoConnect, false);
  const restarted = setup({ connectionStore: store });
  assert.equal((await restarted.service.restoreConnection()).connected, false);
  assert.equal((await restarted.service.status()).connected, false); assert.equal(restarted.calls.length, 0);
  assert.equal((await restarted.service.restoreConnection({ manual: true })).connected, true);
  assert.equal(store.read().autoConnect, true);
  await restarted.service.forgetConnection();
  assert.equal(store.read(), null); assert.equal((await restarted.service.status()).connected, false);
});
test('temporary actor is not reused when restoring a different saved actor', async () => {
  const store = memoryStore(), f = setup({ connectionStore: store });
  await f.service.connect(config());
  await f.service.connect({ ...config(), userKey: 'other-fixture-user', rememberConnection: false });
  const before = f.calls.filter(c => c.url.endsWith('/plugin_token')).length;
  assert.equal((await f.service.restoreConnection({ manual: true })).connected, true);
  assert.equal(f.calls.filter(c => c.url.endsWith('/plugin_token')).length, before + 1);
  assert.equal(f.calls.at(-1).headers['X-USER-KEY'], 'fixture-user');
});
test('expiry may refresh credentials but cannot replay an old write approval', async () => {
  const store = memoryStore(), f = setup({ connectionStore: store });
  await f.service.connect(config()); const preview = await prepareCreate(f);
  f.advance(61000);
  assert.equal((await f.service.execute({ token: preview.token, confirmed: true })).ok, false);
  assert.equal(f.writes(), 0); assert.equal((await f.service.status()).connected, true);
});
test('failed automatic restore keeps saved connection and does not repeatedly retry', async () => {
  const store = memoryStore(); store.write(config());
  let calls = 0;
  const f = createFeishuWorkbench({ connectionStore: store, fetchImpl: async () => {
    calls++; throw new Error('fixture-private-value');
  } });
  const result = await f.restoreConnection(); assert.equal(result.ok, false); assert.equal(result.saved, true);
  assert.ok(store.read()); assert.equal(JSON.stringify(result).includes('fixture-private-value'), false);
  await f.status(); await f.listRecords(); assert.equal(calls, 1);
});

test('operator HTTP errors identify the failed read stage without leaking transport data', async () => {
  for (const [setter, stage, status] of [['setOperatorHttp', 'maintainer_search', 403], ['setRolesHttp', 'maintainer_roles', 404]]) {
    const f = setup(); await f.service.connect(config()); f[setter](status);
    assert.deepEqual(await selectPerson(f), { ok: false, code: 'FEISHU_HTTP_ERROR', status, stage });
    assert.equal(f.writes(), 0);
    assert.equal((await f.service.status()).connected, true);
    assert.equal((await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' })).ok, true);
  }
});

test('non-2xx role responses retain only numeric API diagnostics and never authorize assignment', async () => {
  const f = setup(); await f.service.connect(config());
  f.setRolesFailure(() => Response.json({ err_code: 10301, err_msg: 'private response credential',
    err: { token: 'fixture-private-token' }, data: [{ id: 'fake-role', name: '现维护经纪人' }] }, { status: 401 }));
  const result = await selectPerson(f);
  assert.deepEqual(result, { ok: false, code: 'FEISHU_HTTP_ERROR', status: 401, apiCode: 10301, stage: 'maintainer_roles' });
  assert.equal(f.writes(), 0);
  assert.equal(f.calls.filter(c => c.url.endsWith('/flow_roles/creator')).length, 1);
  assert.equal(f.calls.at(-1).headers['x-auth-mode'], '1');
  assert.equal(f.calls.at(-1).headers['X-USER-KEY'], 'fixture-user');
  assert.equal((await f.service.status()).connected, true);
});

test('non-numeric, zero, malformed and oversized error bodies preserve the HTTP error', async () => {
  const bodies = [JSON.stringify({ err_code: '10301' }), JSON.stringify({ err_code: 0 }),
    JSON.stringify({ err_code: Number.MAX_SAFE_INTEGER + 1 }), 'private response credential',
    JSON.stringify({ err_code: 10301, err_msg: 'x'.repeat(65536) })];
  for (const body of bodies) {
    const f = setup(); await f.service.connect(config());
    f.setRolesFailure(() => new Response(body, { status: 401 }));
    assert.deepEqual(await selectPerson(f), { ok: false, code: 'FEISHU_HTTP_ERROR', status: 401, stage: 'maintainer_roles' });
    assert.equal(f.writes(), 0);
  }
});

test('oversized and broken HTTP error streams are canceled and cannot leak their payload', async () => {
  for (const broken of [false, true]) {
    const f = setup(); await f.service.connect(config()); let canceled = false;
    f.setRolesFailure(() => new Response(new ReadableStream({ pull(controller) {
      if (broken) controller.error(new Error('fixture-private-token'));
      else controller.enqueue(new Uint8Array(65537));
    }, cancel() { canceled = true; } }), { status: 503 }));
    assert.deepEqual(await selectPerson(f), { ok: false, code: 'FEISHU_HTTP_ERROR', status: 503, stage: 'maintainer_roles' });
    if (!broken) assert.equal(canceled, true);
  }
});

test('an HTTP error with a stalled body stays bounded and cancels without a retry', { timeout: 25000 }, async () => {
  const f = setup(); await f.service.connect(config()); let canceled = false;
  f.setRolesFailure(() => new Response(new ReadableStream({
    pull() { return new Promise(() => {}); }, cancel() { canceled = true; }
  }), { status: 401 }));
  const result = await selectPerson(f);
  assert.deepEqual(result, { ok: false, code: 'FEISHU_REQUEST_TIMEOUT', stage: 'maintainer_roles' });
  assert.equal(canceled, true); assert.equal(f.writes(), 0);
  assert.equal(f.calls.filter(c => c.url.endsWith('/flow_roles/creator')).length, 1);
});

test('HTTP errors with API codes do not turn uncertain cloud writes into retryable business failures', async () => {
  const f = setup();
  f.setCreateFailure(() => Response.json({ err_code: 10301, err_msg: 'private response credential' }, { status: 401 }));
  const { p, result } = await create(f);
  assert.equal(result.code, 'FEISHU_HTTP_ERROR'); assert.equal(result.apiCode, 10301);
  assert.equal(result.status, 'unknown'); assert.equal(f.journal().entries[0].status, 'unknown');
  assert.equal(f.writes(), 1);
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).ok, false);
  assert.equal(f.writes(), 1);
});
test('fixture client path: query -> confirm local patch -> marked create -> readback -> update -> exact cleanup', async () => {
  const f = setup(); await f.service.connect(config());
  const l = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
  assert.equal(l.preview.candidates.length, 1); assert.equal(f.writes(), 0);
  const patch = await f.service.applyContact({ runDir: 'run', rowId: 'row', token: l.token, recordId: '5', kind: 'wechat' });
  assert.equal(patch.ok, true); assert.equal(patch.patch.wechatId, 'fixture_contact'); assert.equal(f.writes(), 0);
  const { p, result } = await create(f);
  assert.equal(result.ok, true); assert.match(result.name, /^\[AI测试\] AI_TEST_/);
  const call = f.calls.find(c => c.url.endsWith('/create'));
  assert.equal(call.body.required_mode, 1); assert.equal(call.body.role_mode, 1); assert.equal(call.body.name, p.name);
  assert.deepEqual(call.body.field_value_pairs.find(f => f.field_key === 'role_owners').field_value,
    [{ role: 'fixture-maintainer', owners: ['fixture-assignee'] }]);
  assert.equal(call.headers['X-USER-KEY'], 'fixture-user', 'API actor must not become the selected assignee');
  assert.equal(p.maintainer.name, 'Fixture Operator');
  assert.ok(call.headers['X-IDEM-UUID']);
  let planned = await f.service.prepare({ action: 'update', recordId: result.recordId, values: { contact: '微信：changed_fixture' } });
  assert.equal(planned.ok, true); assert.equal(f.writes(), 1);
  assert.equal((await f.service.execute({ token: planned.token, confirmed: true })).ok, true);
  planned = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
  assert.equal(planned.ok, true); assert.equal(f.writes(), 2);
  assert.equal((await f.service.execute({ token: planned.token, confirmed: true })).status, 'deleted');
  assert.equal(f.writes(), 3); assert.equal(f.journal().entries[0].status, 'deleted');
});
test('without safety confirmation no new object; preview does not write', async () => {
  const f = setup(); await f.service.connect(config());
  assert.equal((await f.service.prepare({ action: 'create', runDir: 'run', rowId: 'row', values: values() })).code, 'FEISHU_WRITE_SAFETY_REQUIRED');
  assert.equal(f.writes(), 0);
});
test('deferred create: readonly preview needs an explicit boolean opt-in and never saves a journal', async () => {
  for (const safetyConfirmed of [undefined, false]) {
    const f = setup(); await f.service.connect(config()); const operator = await selectPerson(f);
    const payload = { action: 'create', runDir: 'run', rowId: 'row', values: values(), deferWriteConfirmation: true,
      operatorToken: operator.token, operatorConfirmed: true, safetyConfirmed };
    if (safetyConfirmed === undefined) delete payload.safetyConfirmed;
    const p = await f.service.prepare(payload);
    assert.equal(p.ok, true, JSON.stringify(p)); assert.match(p.name, /^\[AI测试\] AI_TEST_/);
    assert.ok(f.calls.some(c => c.body?.fields?.includes('role_owners')), 'preview must still check duplicates');
    assert.equal(f.writes(), 0); assert.equal(f.journal().entries.length, 0); assert.equal(f.snapshots.length, 0);
  }
  for (const deferWriteConfirmation of [undefined, false, 'true', 1, {}]) {
    const f = setup(); await f.service.connect(config());
    const p = await prepareCreate(f, { safetyConfirmed: false, deferWriteConfirmation });
    assert.equal(p.code, 'FEISHU_WRITE_SAFETY_REQUIRED');
    assert.equal(f.writes(), 0); assert.equal(f.snapshots.length, 0);
  }
});
test('deferred create: execution requires exact true before reads or mutations and consumes denied tokens', async () => {
  for (const preparedSafety of [undefined, true]) {
    for (const safetyConfirmed of [undefined, false, 'true', 1, null]) {
      const f = setup(); await f.service.connect(config());
      const p = await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: preparedSafety });
      assert.equal(p.ok, true, JSON.stringify(p));
      const calls = f.calls.length;
      const payload = { token: p.token, confirmed: true, safetyConfirmed };
      if (safetyConfirmed === undefined) delete payload.safetyConfirmed;
      assert.equal((await f.service.execute(payload)).code, 'FEISHU_WRITE_SAFETY_REQUIRED');
      assert.equal(f.calls.length, calls); assert.equal(f.writes(), 0);
      assert.equal(f.journal().entries.length, 0); assert.equal(f.snapshots.length, 0);
      assert.equal((await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true })).code,
        'FEISHU_CONFIRMATION_REQUIRED');
      assert.equal(f.writes(), 0); assert.equal(f.snapshots.length, 0);
    }
  }
});
test('deferred create: caller mutation cannot remove the internal execution confirmation flag', async () => {
  const f = setup(); await f.service.connect(config()); const operator = await selectPerson(f);
  const payload = { action: 'create', runDir: 'run', rowId: 'row', values: values(), deferWriteConfirmation: true,
    operatorToken: operator.token, operatorConfirmed: true };
  const p = await f.service.prepare(payload); assert.equal(p.ok, true, JSON.stringify(p));
  payload.deferWriteConfirmation = false; payload.safetyConfirmed = true;
  p.deferWriteConfirmation = false;
  assert.equal((await f.service.execute({ token: p.token, confirmed: true, deferWriteConfirmation: false })).code,
    'FEISHU_WRITE_SAFETY_REQUIRED');
  assert.equal(f.writes(), 0); assert.equal(f.snapshots.length, 0);
});
test('deferred create: explicit execution approval succeeds only with marked exact field and maintainer readback', async () => {
  const f = setup(); await f.service.connect(config());
  const p = await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: false });
  assert.equal(p.ok, true, JSON.stringify(p)); assert.equal(f.writes(), 0);
  const r = await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true });
  assert.equal(r.ok, true); assert.equal(r.status, 'verified'); assert.equal(r.name, p.name);
  assert.equal(f.writes(), 1); assert.equal(f.journal().entries[0].stampVersion, 2);
  const dispatched = f.calls.find(c => c.url.endsWith('/create'));
  assert.equal(dispatched.body.name, p.name);
  assert.deepEqual(dispatched.body.field_value_pairs, [...p.fields,
    { field_key: 'role_owners', field_value: [{ role: 'fixture-maintainer', owners: ['fixture-assignee'] }] }]);
  assert.ok(f.calls.some(c => c.url.endsWith('/query') && c.body.work_item_ids.includes(41)));
  assert.equal((await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true })).code,
    'FEISHU_CONFIRMATION_REQUIRED'); assert.equal(f.writes(), 1);
});
test('deferred create: validation and operator authority still gate readonly preview', async () => {
  for (const [extra, code] of [
    [{ values: { ...values(), contact: '' } }, 'FEISHU_CONTACT_REQUIRED'],
    [{ values: { ...values(), source: 'not-an-option' } }, 'FEISHU_OPTION_INVALID'],
    [{ operatorConfirmed: false }, 'FEISHU_OPERATOR_CONFIRMATION_REQUIRED'],
    [{ operatorToken: 'forged' }, 'FEISHU_OPERATOR_CONFIRMATION_REQUIRED']
  ]) {
    const f = setup(); await f.service.connect(config());
    const p = await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: false, ...extra });
    assert.equal(p.ok, false); assert.equal(p.code, code);
    assert.equal(f.writes(), 0); assert.equal(f.snapshots.length, 0);
  }
});
test('deferred create: same-owner duplicates still block both preview and approved execution', async () => {
  for (const phase of ['prepare', 'execute']) {
    const f = setup(); await f.service.connect(config());
    const extra = { deferWriteConfirmation: true, safetyConfirmed: false };
    const p = phase === 'execute' ? await prepareCreate(f, extra) : null;
    if (p) assert.equal(p.ok, true, JSON.stringify(p));
    f.setDuplicateResponse(() => Response.json(duplicateEnvelope()));
    const r = p ? await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true })
      : await prepareCreate(f, extra);
    assert.equal(r.code, 'FEISHU_DUPLICATE_MAINTAINER');
    assert.equal(f.writes(), 0); assert.equal(f.journal().entries.length, 0); assert.equal(f.snapshots.length, 0);
  }
});
test('deferred create: expired plan, changed person and changed local row cannot dispatch', async () => {
  for (const change of ['expiry', 'person', 'renamed', 'local', 'reinspection']) {
    const f = setup({ expires: 1800 }); await f.service.connect(config());
    const p = await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: false });
    assert.equal(p.ok, true, JSON.stringify(p));
    if (change === 'expiry') f.advance(301000);
    if (change === 'person') f.setUsers([{ user_key: 'fixture-assignee', name_cn: 'Fixture Operator', status: 'activated', username: 'changed-fixture' }]);
    if (change === 'renamed') f.setUsers([{ user_key: 'fixture-assignee', name_cn: 'Changed Fixture', status: 'activated' }]);
    if (change === 'local') f.mutateLocal(r => { r.note = 'fixture manual change'; });
    if (change === 'reinspection') await selectPerson(f);
    const r = await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true });
    assert.equal(r.ok, false, change);
    assert.equal(r.code, change === 'expiry' ? 'FEISHU_CONFIRMATION_REQUIRED' : change === 'local'
      ? 'FEISHU_LOCAL_CHANGED' : change === 'reinspection' ? 'FEISHU_CONFIRMATION_REQUIRED'
        : change === 'renamed' ? 'FEISHU_OPERATOR_INVALID' : 'FEISHU_OPERATOR_CHANGED');
    assert.equal(f.writes(), 0); assert.equal(f.journal().entries.length, 0); assert.equal(f.snapshots.length, 0);
  }
});
test('deferred create: changes during final duplicate read still stop approved dispatch', async () => {
  for (const change of ['row', 'session', 'expiry']) {
    const f = setup({ expires: 1800 }); await f.service.connect(config());
    const p = await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: false });
    assert.equal(p.ok, true, JSON.stringify(p));
    f.setDuplicateResponse(() => {
      if (change === 'row') f.mutateLocal(r => { r.note = 'fixture changed during read'; });
      if (change === 'session') f.service.clear();
      if (change === 'expiry') f.advance(301000);
      return Response.json(duplicateEnvelope(['fixture-other']));
    });
    assert.equal((await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true })).ok, false, change);
    assert.equal(f.writes(), 0); assert.equal(f.snapshots.length, 0);
  }
});
test('deferred create: mismatched field or maintainer readback remains unknown', async () => {
  for (const change of [r => { r.fields.find(x => x.field_key === 'contact').field_value = 'wrong fixture'; },
    r => { r.fields.find(x => x.field_key === 'role_owners').field_value[0].owners = ['wrong-fixture']; }]) {
    const f = setup(); await f.service.connect(config());
    const p = await prepareCreate(f, { deferWriteConfirmation: true, safetyConfirmed: false });
    assert.equal(p.ok, true, JSON.stringify(p)); f.onCreate(change);
    assert.equal((await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true })).status, 'unknown');
    assert.equal(f.journal().entries[0].status, 'unknown'); assert.equal(f.journal().entries[0].stampVersion, undefined);
    assert.equal(f.writes(), 1);
  }
});
test('deferred create: unknown result forbids replay and reprepare, reconciliation stays readonly and cleanup blocked', async () => {
  const f = setup(); await f.service.connect(config());
  const extra = { deferWriteConfirmation: true, safetyConfirmed: false };
  const p = await prepareCreate(f, extra); assert.equal(p.ok, true, JSON.stringify(p)); f.loseCreate();
  const r = await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true });
  assert.equal(r.status, 'unknown'); assert.equal(f.journal().entries[0].status, 'unknown'); assert.equal(f.writes(), 1);
  assert.equal((await f.service.execute({ token: p.token, confirmed: true, safetyConfirmed: true })).code,
    'FEISHU_CONFIRMATION_REQUIRED');
  assert.equal((await prepareCreate(f, extra)).code, 'FEISHU_ALREADY_SUBMITTED');
  const reconciled = await f.service.reconcile({ entryId: r.entryId });
  assert.equal(reconciled.ok, true); assert.equal(reconciled.cleanupBlocked, true); assert.equal(f.writes(), 1);
});
test('deferred create: opt-in does not change legacy create, delete or update gates', async () => {
  const f = setup(); const { result } = await create(f);
  assert.equal(result.status, 'verified', 'legacy prepare approval still permits execution without a new safety field');
  assert.equal((await f.service.prepare({ action: 'delete', recordId: result.recordId, deferWriteConfirmation: true })).code,
    'FEISHU_WRITE_SAFETY_REQUIRED');
  const p = await f.service.prepare({ action: 'update', recordId: result.recordId, deferWriteConfirmation: true,
    values: { contact: 'fixture changed' } });
  assert.equal(p.ok, true);
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).status, 'verified'); assert.equal(f.writes(), 2);
});
test('missing required fields, wrong option, nickname-as-key and arbitrary field reject', () => {
  const fields = formFields(metadata(), 'creator');
  for (const mutation of [v => delete v.source, v => v.platform = '小红书', v => v.anything = 'private', v => delete v.name]) {
    const v = values(); mutation(v); assert.throws(() => validateValues(fields, v, { create: true }));
  }
});
test('source candidate ID can never become a write/delete target', async () => {
  const f = setup(); await f.service.connect(config());
  for (const action of ['update', 'delete']) assert.equal((await f.service.prepare({ action, recordId: '5', safetyConfirmed: true, values: { contact: 'x' } })).code, 'FEISHU_NOT_OWNED');
  assert.equal(f.writes(), 0);
});
test('local edit after preview and replay both reject before dispatch', async () => {
  const f = setup(); await f.service.connect(config());
  const p = await prepareCreate(f);
  f.mutateLocal(r => { r.note = 'new manual edit'; });
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).code, 'FEISHU_LOCAL_CHANGED');
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).code, 'FEISHU_CONFIRMATION_REQUIRED');
  assert.equal(f.writes(), 0);
});
test('duplicate click/reprepare after successful create cannot create twice', async () => {
  const f = setup(); const { p, result } = await create(f); assert.equal(result.ok, true);
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).ok, false);
  assert.equal((await prepareCreate(f)).code, 'FEISHU_ALREADY_SUBMITTED');
  assert.equal(f.writes(), 1);
});

test('same account and maintainer across local rows blocks another create, different maintainer on same row is allowed', async () => {
  const f = setup({ extraRows: { other: { rowId: 'other', creatorName: 'Renamed Fixture' } } });
  assert.equal((await create(f)).result.ok, true);
  assert.equal((await prepareCreate(f, { rowId: 'other', values: { ...values(), name: 'Renamed Fixture' } })).code,
    'FEISHU_ALREADY_SUBMITTED');
  f.setUsers([{ user_key: 'fixture-other-assignee', name_cn: 'Fixture Operator', status: 'activated' }]);
  const plan = await prepareCreate(f);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.ok(f.calls.some(c => c.url.endsWith('/search/params') && c.body.fields.includes('role_owners')));
  assert.equal(f.writes(), 1);
});

function duplicateEnvelope(owners = ['fixture-assignee']) {
  return { err_code: 0, data: [{ id: 99, project_key: 'project', work_item_type_key: 'creator', fields: [
    { field_key: 'account', field_value: '001234' }, { field_key: 'platform', field_value: { value: 'xhs' } },
    { field_key: 'role_owners', field_type_key: 'role_owners', field_value: [{ role: 'fixture-maintainer', owners }] }
  ] }], pagination: { page_num: 1, page_size: 50, total: 1 } };
}
test('remote same-owner duplicate blocks prepare and a duplicate appearing after preview blocks dispatch', async () => {
  for (const phase of ['prepare', 'execute']) {
    const f = setup(); await f.service.connect(config());
    const plan = phase === 'execute' ? await prepareCreate(f) : null;
    f.setDuplicateResponse(() => Response.json(duplicateEnvelope()));
    const result = phase === 'execute' ? await f.service.execute({ token: plan.token, confirmed: true }) : await prepareCreate(f);
    assert.equal(result.code, 'FEISHU_DUPLICATE_MAINTAINER');
    assert.equal(f.writes(), 0); assert.equal(f.journal().entries.length, 0);
  }
});
test('duplicate lookup permission errors and missing ownership cannot authorize creation', async () => {
  for (const response of [() => Response.json({ err_code: 10301 }), () => {
    const body = duplicateEnvelope(); body.data[0].fields.pop(); return Response.json(body);
  }]) {
    const f = setup(); await f.service.connect(config()); f.setDuplicateResponse(response);
    const result = await prepareCreate(f); assert.equal(result.ok, false);
    assert.equal(f.writes(), 0); assert.equal(f.journal().entries.length, 0);
  }
});
test('fresh local changes and session invalidation during duplicate lookup stop dispatch', async () => {
  for (const change of ['row', 'session', 'expiry']) {
    const f = setup({ expires: 1800 }); await f.service.connect(config()); const plan = await prepareCreate(f);
    f.setDuplicateResponse(() => {
      if (change === 'row') f.mutateLocal(r => { r.note = 'changed during read'; });
      if (change === 'session') f.service.clear();
      if (change === 'expiry') f.advance(301000);
      return Response.json(duplicateEnvelope(['fixture-other']));
    });
    const result = await f.service.execute({ token: plan.token, confirmed: true });
    assert.equal(result.ok, false, change);
    assert.equal(f.writes(), 0); assert.equal(f.journal().entries.length, 0);
  }
});

test('all matching remote pages are reviewed; later duplicate or changing pagination prevents create', async () => {
  for (const unstable of [false, true]) {
    const f = setup(); await f.service.connect(config());
    f.setDuplicateResponse(query => {
      const template = duplicateEnvelope(['fixture-other']).data[0];
      const data = query.page_num === 1
        ? Array.from({ length: 50 }, (_, i) => ({ ...structuredClone(template), id: i + 100 }))
        : duplicateEnvelope().data;
      return Response.json({ err_code: 0, data, pagination: { page_num: query.page_num,
        page_size: 50, total: unstable && query.page_num === 2 ? 52 : 51 } });
    });
    const result = await prepareCreate(f);
    assert.equal(result.code, unstable ? 'FEISHU_DUPLICATE_REVIEW_REQUIRED' : 'FEISHU_DUPLICATE_MAINTAINER');
    assert.deepEqual(f.calls.filter(c => c.body?.fields?.includes('role_owners')).map(c => c.body.page_num), [1, 2]);
    assert.equal(f.writes(), 0);
  }
});

test('unknown prior creation blocks another local row with same business identity before search', async () => {
  const f = setup({ extraRows: { other: { rowId: 'other', creatorName: 'Other Fixture' } } });
  f.loseCreate(); assert.equal((await create(f)).result.status, 'unknown');
  const before = f.calls.length;
  const blocked = await prepareCreate(f, { rowId: 'other' });
  assert.equal(blocked.code, 'FEISHU_ALREADY_SUBMITTED');
  assert.equal(blocked.status, 'unknown');
  assert.equal(blocked.entryId, f.journal().entries[0].entryId);
  assert.equal(f.calls.slice(before).some(c => c.body?.fields?.includes('role_owners')), false);
  assert.equal(f.writes(), 1);
});

test('numeric platform quote creation/readback accepts zero and rejects changed values or wrong field types', async () => {
  for (const corrupt of ['none', 'value', 'type']) {
    const f = setup({ extraFields: [
      { field_key: 'image', field_name: '图文平台价', field_type_key: 'number', is_required: 2 },
      { field_key: 'video', field_name: '视频平台价', field_type_key: 'number', is_required: 2 }
    ] });
    await f.service.connect(config());
    if (corrupt !== 'none') f.onCreate(record => {
      const quote = record.fields.find(p => p.field_key === 'image');
      if (corrupt === 'value') quote.field_value = 1;
      else quote.field_type_key = 'text';
    });
    const plan = await prepareCreate(f, { values: { ...values(), image: '0', video: '¥9,800' } });
    assert.equal(plan.fields.find(p => p.field_key === 'image').field_value, 0);
    assert.equal(plan.fields.find(p => p.field_key === 'video').field_value, 9800);
    const result = await f.service.execute({ token: plan.token, confirmed: true });
    assert.equal(result.ok, corrupt === 'none');
    assert.equal(result.status, corrupt === 'none' ? 'verified' : 'unknown');
    assert.equal(f.writes(), 1);
  }
});

test('explicit unquoted platform prices create and read back as zero without blocking the row', async () => {
  const f = setup({ extraFields: [
    { field_key: 'image', field_name: '图文平台价', field_type_key: 'number', is_required: 2 },
    { field_key: 'video', field_name: '视频平台价', field_type_key: 'number', is_required: 2 }
  ] });
  await f.service.connect(config());
  const plan = await prepareCreate(f, { values: { ...values(), image: '暂未报价', video: '暂无报价' } });
  assert.equal(plan.fields.find(field => field.field_key === 'image').field_value, 0);
  assert.equal(plan.fields.find(field => field.field_key === 'video').field_value, 0);
  const result = await f.service.execute({ token: plan.token, confirmed: true });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'verified');
  assert.equal(f.writes(), 1);
});

test('cloud previews are independently bounded by row, reprepare invalidates only that row, and execution rechecks duplicates', async () => {
  const f = setup({ expires: 1800, extraRows: { other: { rowId: 'other', creatorName: 'Other Fixture' } } });
  await f.service.connect(config()); const operator = await selectPerson(f);
  const payload = { action: 'create', runDir: 'run', rowId: 'row', values: values(), safetyConfirmed: true,
    operatorToken: operator.token, operatorConfirmed: true };
  const old = await f.service.prepare(payload);
  const other = await f.service.prepare({ ...payload, rowId: 'other' });
  const fresh = await f.service.prepare(payload);
  assert.equal((await f.service.execute({ token: old.token, confirmed: true })).code, 'FEISHU_CONFIRMATION_REQUIRED');
  assert.equal((await f.service.execute({ token: other.token, confirmed: true })).ok, true);
  assert.equal((await f.service.execute({ token: fresh.token, confirmed: true })).code, 'FEISHU_ALREADY_SUBMITTED');
  assert.equal(f.writes(), 1);
});

test('cloud preview cache evicts oldest beyond fifty and never revives expired approval', async () => {
  const extraRows = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`p${i}`, { rowId: `p${i}` }]));
  const f = setup({ expires: 1800, extraRows }); await f.service.connect(config()); const operator = await selectPerson(f);
  const previews = [];
  for (let i = 0; i < 51; i++) previews.push(await f.service.prepare({ action: 'create', runDir: 'run', rowId: `p${i}`,
    values: values(), safetyConfirmed: true, operatorToken: operator.token, operatorConfirmed: true }));
  assert.equal((await f.service.execute({ token: previews[0].token, confirmed: true })).code, 'FEISHU_CONFIRMATION_REQUIRED');
  f.advance(301000);
  assert.equal((await f.service.execute({ token: previews.at(-1).token, confirmed: true })).code, 'FEISHU_CONFIRMATION_REQUIRED');
  assert.equal(f.writes(), 0);
});
test('another operator changing even an unedited field stops cleanup', async () => {
  const f = setup(); const { result } = await create(f);
  const p = await f.service.prepare({ action: 'delete', recordId: result.recordId, safetyConfirmed: true });
  f.mutateRemote(r => { r.fields.push({ field_key: 'notes', field_value: 'human-owned edit' }); });
  assert.equal((await f.service.execute({ token: p.token, confirmed: true })).code, 'FEISHU_REMOTE_CHANGED');
  assert.equal(f.writes(), 1);
});
test('identity/name cannot be overwritten by update and marker stays immutable', async () => {
  const f = setup(); const { result } = await create(f);
  for (const v of [{ name: 'hide marker' }, { account: 'other' }, { platform: 'xhs' }]) {
    assert.equal((await f.service.prepare({ action: 'update', recordId: result.recordId, values: v })).ok, false);
  }
  assert.equal(f.writes(), 1);
});
test('failed readback has durable ID and unknown state, no automatic retry', async () => {
  const f = setup(); f.setMalformed();
  const { result } = await create(f);
  assert.equal(result.ok, false); assert.equal(result.status, 'unknown'); assert.equal(result.recordId, '41');
  assert.equal(f.journal().entries[0].recordId, '41'); assert.equal(f.writes(), 1);
  assert.equal((await prepareCreate(f)).code, 'FEISHU_ALREADY_SUBMITTED');
});
test('lost create response can be reconciled read-only by exact batch title, never resubmitted', async () => {
  const f = setup(); f.loseCreate();
  const { result } = await create(f); assert.equal(result.status, 'unknown'); assert.equal(result.recordId, '');
  const r = await f.service.reconcile({ entryId: f.journal().entries[0].entryId });
  assert.equal(r.ok, true); assert.equal(r.recordId, '41'); assert.equal(f.writes(), 1);
});
test('fresh local conflict blocks human contact application and stale run/token rejects', async () => {
  const f = setup(); await f.service.connect(config());
  const l = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
  f.mutateLocal(r => { r.wechatId = 'human_entered'; });
  assert.equal((await f.service.applyContact({ runDir: 'run', rowId: 'row', token: l.token, recordId: '5', kind: 'wechat' })).code, 'FEISHU_LOCAL_CONFLICT');
  assert.equal((await f.service.applyContact({ runDir: 'other', rowId: 'row', token: l.token, recordId: '5', kind: 'wechat' })).code, 'FEISHU_PREVIEW_EXPIRED');
});
test('raw contact: scoped explicit application returns raw-only patch with no cloud mutation or typed overwrite', async () => {
  const f = setup(), value = '001234\n代理备注  原值'; f.setContact(value);
  f.mutateLocal(row => Object.assign(row, { wechatId: 'manual_wechat', email: 'manual@example.test', phone: '123456789', contactSource: 'manual' }));
  await f.service.connect(config());
  const lookup = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
  const result = await f.service.applyContact({ runDir: 'run', rowId: 'row', token: lookup.token, recordId: '5', kind: 'unclassified' });
  assert.equal(result.ok, true); assert.equal(result.patch.contactRaw, value);
  assert.equal(result.patch.contactRawSource, '飞书项目 / project/creator / 5');
  assert.equal(result.patch.contactRawCollectedAt, lookup.checkedAt);
  for (const field of ['wechatId', 'email', 'phone', 'contactSource']) assert.equal(Object.hasOwn(result.patch, field), false);
  assert.equal(f.writes(), 0);
});
test('raw contact: fresh raw conflict, changed identity, wrong row/run and typed source remain blocked', async () => {
  for (const change of ['raw', 'identity', 'run', 'row', 'record', 'typed', 'session']) {
    const f = setup(); f.setContact(change === 'typed' ? '微信：fixture_contact' : '12345678');
    await f.service.connect(config());
    const lookup = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
    const payload = { runDir: 'run', rowId: 'row', token: lookup.token, recordId: '5', kind: 'unclassified' };
    if (change === 'raw') f.mutateLocal(row => { row.contactRaw = 'different'; });
    if (change === 'identity') f.mutateLocal(row => { row.creatorName = 'Replacement'; });
    if (change === 'run') payload.runDir = 'other';
    if (change === 'row') payload.rowId = 'other';
    if (change === 'record') payload.recordId = '6';
    if (change === 'session') f.onGetRow(() => f.service.clear());
    const result = await f.service.applyContact(payload);
    assert.equal(result.ok, false, change); assert.equal(result.patch, undefined, change);
    assert.equal(f.writes(), 0);
  }
});
test('raw contact: preview expiring during fresh local read cannot return a patch', async () => {
  const f = setup({ expires: 3600 }); f.setContact('12345678'); await f.service.connect(config());
  const lookup = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
  f.onGetRow(() => f.advance(300001));
  const result = await f.service.applyContact({ runDir: 'run', rowId: 'row', token: lookup.token, recordId: '5', kind: 'unclassified' });
  assert.equal(result.code, 'FEISHU_PREVIEW_EXPIRED'); assert.equal(result.patch, undefined); assert.equal(f.writes(), 0);
});
test('disconnect invalidates prepared writes and lookup tokens', async () => {
  const f = setup(); await f.service.connect(config());
  const p = await prepareCreate(f);
  f.service.clear(); assert.equal((await f.service.execute({ token: p.token, confirmed: true })).code, 'FEISHU_SESSION_EXPIRED'); assert.equal(f.writes(), 0);
});
test('private transport bodies and secrets never enter safe error replies', async () => {
  const f = setup(); f.setError(10001); const { result } = await create(f);
  assert.equal(result.ok, false); assert.equal(result.apiCode, 10001); assert.equal(result.status, 'failed');
  assert.ok(!JSON.stringify(result).includes('private rejected value'));
  assert.ok(!JSON.stringify(f.journal()).includes('fixture-secret'));
});

test('explicit email/phone labels round trip into the confirmed local contact field', async () => {
  for (const [raw, kind, field, value] of [
    ['邮箱：fixture@example.test', 'email', 'email', 'fixture@example.test'],
    ['手机：+86 12345678901', 'phone', 'phone', '+86 12345678901']
  ]) {
    const f = setup(); f.setContact(raw); await f.service.connect(config());
    const l = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
    assert.equal(l.preview.candidates[0].kind, kind);
    const r = await f.service.applyContact({ runDir: 'run', rowId: 'row', token: l.token, recordId: '5', kind });
    assert.equal(r.ok, true); assert.equal(r.patch[field], value); assert.equal(f.writes(), 0);
  }
});

test('disconnect during fresh local read invalidates contact application', async () => {
  const f = setup(); await f.service.connect(config());
  const l = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
  f.onGetRow(() => f.service.clear());
  const r = await f.service.applyContact({ runDir: 'run', rowId: 'row', token: l.token, recordId: '5', kind: 'wechat' });
  assert.equal(r.code, 'FEISHU_SESSION_EXPIRED'); assert.equal(r.patch, undefined);
});

test('creation identity rejects embedded control characters and oversized values', async () => {
  const f = setup(); await f.service.connect(config());
  for (const account of ['001234\nother', '001234\tother', '1'.repeat(513)]) {
    const r = await prepareCreate(f, { values: { ...values(), account } });
    assert.equal(r.code, 'FEISHU_IDENTITY_INVALID');
  }
  assert.equal(f.writes(), 0);
});

test('person lookup uses the manually entered name in the connected project without exposing identifiers or contacts', async () => {
  const f = setup(); await f.service.connect(config());
  f.setUsers([{ user_key: 'fixture-assignee', name_cn: 'Fixture Operator', status: 'activated',
    email: 'private@example.test', out_id: 'private-out-id' }]);
  const person = await selectPerson(f);
  assert.equal(person.ok, true); assert.equal(person.roleName, '现维护经纪人');
  assert.equal(person.name, 'Fixture Operator');
  for (const privateValue of ['fixture-user', 'fixture-assignee', 'fixture-maintainer', 'private@example.test', 'private-out-id', 'p-fixture']) {
    assert.ok(!JSON.stringify(person).includes(privateValue));
  }
  assert.deepEqual(f.calls.find(c => c.url.endsWith('/user/search')).body, { project_key: 'project', query: 'Fixture Operator' });
  assert.ok(!f.calls.some(c => c.url.endsWith('/user/query')));
  assert.equal(f.writes(), 0);
});

test('missing, forged or unchecked operator confirmation cannot authorize create', async () => {
  const f = setup(); await f.service.connect(config());
  const payload = { action: 'create', runDir: 'run', rowId: 'row', values: values(), safetyConfirmed: true };
  assert.equal((await f.service.prepare(payload)).code, 'FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
  const person = await selectPerson(f);
  for (const extra of [{ operatorToken: 'forged', operatorConfirmed: true }, { operatorToken: person.token },
    { operatorToken: person.token, operatorConfirmed: false }]) {
    assert.equal((await f.service.prepare({ ...payload, ...extra })).code, 'FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
  }
  assert.equal(f.writes(), 0);
});

test('missing, ambiguous, inactive and wrong-key users fail closed', async () => {
  for (const users of [[], [{ user_key: 'another', name_cn: 'Fixture', status: 'activated' }],
    [{ user_key: 'fixture-user', name_cn: 'Fixture', status: 'deactivated' }],
    [{ user_key: 'fixture-user', name_cn: 'Fixture' }],
    [{ user_key: 'fixture-user', name_cn: 'Fixture', status: 'activated' }, { user_key: 'fixture-user', name_cn: 'Fixture', status: 'activated' }]]) {
    const f = setup(); await f.service.connect(config()); f.setUsers(users);
    assert.equal((await selectPerson(f)).ok, false); assert.equal(f.writes(), 0);
  }
});

test('maintainer role requires exact unique live name and ID, never the multi-user field', async () => {
  for (const roles of [[], [{ id: 'wrong', name: '商务经纪/达人运营' }],
    [{ id: 'one', name: '现维护经纪人' }, { id: 'two', name: '现维护经纪人' }],
    [{ id: 'one', name: '现维护经纪人' }, { id: 'one', name: '其他角色' }]]) {
    const f = setup(); await f.service.connect(config()); f.setRoles(roles);
    assert.equal((await selectPerson(f)).code, 'FEISHU_MAINTAINER_ROLE_INVALID');
    assert.equal(f.writes(), 0);
  }
  assert.throws(() => validateValues(formFields(metadata(), 'creator'),
    { ...values(), role_owners: 'other-person' }, { create: true }), /FEISHU_FIELDS_INVALID/);
});

test('user/role permission failure leaves existing read-only contact path usable', async () => {
  const f = setup(); await f.service.connect(config()); f.denyOperator();
  assert.equal((await selectPerson(f)).code, 'FEISHU_API_ERROR');
  const result = await f.service.lookup({ runDir: 'run', rowId: 'row', accountNumber: '001234' });
  assert.equal(result.ok, true); assert.equal(f.writes(), 0); assert.equal((await f.service.status()).connected, true);
});

test('identity/name/status or role changes after preview stop dispatch', async () => {
  for (const change of [f => f.setUsers([{ user_key: 'fixture-assignee', name_cn: 'Renamed Fixture', status: 'activated' }]),
    f => f.setUsers([{ user_key: 'fixture-assignee', name_cn: 'Fixture Operator', status: 'deactivated' }]),
    f => f.setRoles([{ id: 'changed-role', name: '现维护经纪人' }])]) {
    const f = setup(); await f.service.connect(config()); const p = await prepareCreate(f); assert.equal(p.ok, true);
    change(f); const result = await f.service.execute({ token: p.token, confirmed: true });
    assert.equal(result.ok, false); assert.equal(f.writes(), 0); assert.equal(f.journal().entries.length, 0);
  }
});

test('role object key order does not invalidate confirmed create authority', async () => {
  const f = setup(); await f.service.connect(config());
  f.setRoles([{ id: 'fixture-maintainer', name: '\u73b0\u7ef4\u62a4\u7ecf\u7eaa\u4eba',
    settings: { required: true, flags: { visible: true, editable: false } } }]);
  const person = await selectPerson(f); assert.equal(person.ok, true);
  f.setRoles([{ settings: { flags: { editable: false, visible: true }, required: true },
    name: '\u73b0\u7ef4\u62a4\u7ecf\u7eaa\u4eba', id: 'fixture-maintainer' }]);
  const plan = await f.service.prepare({ action: 'create', runDir: 'run', rowId: 'row',
    values: values(), safetyConfirmed: true, operatorToken: person.token, operatorConfirmed: true });
  assert.equal(plan.ok, true, JSON.stringify(plan));
  f.setRoles([{ name: '\u73b0\u7ef4\u62a4\u7ecf\u7eaa\u4eba', id: 'fixture-maintainer',
    settings: { required: true, flags: { visible: true, editable: false } } }]);
  const result = await f.service.execute({ token: plan.token, confirmed: true });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.writes(), 1);
});

test('role configuration changes still invalidate confirmed create authority', async () => {
  for (const phase of ['prepare', 'execute']) {
    const f = setup(); await f.service.connect(config());
    f.setRoles([{ id: 'fixture-maintainer', name: '\u73b0\u7ef4\u62a4\u7ecf\u7eaa\u4eba',
      settings: { required: true, sequence: ['first', 'second'] } }]);
    const person = await selectPerson(f); assert.equal(person.ok, true);
    const payload = { action: 'create', runDir: 'run', rowId: 'row', values: values(),
      safetyConfirmed: true, operatorToken: person.token, operatorConfirmed: true };
    const plan = phase === 'execute' ? await f.service.prepare(payload) : null;
    if (plan) assert.equal(plan.ok, true);
    f.setRoles([{ id: 'fixture-maintainer', name: '\u73b0\u7ef4\u62a4\u7ecf\u7eaa\u4eba',
      settings: { required: true, sequence: ['second', 'first'] } }]);
    const result = phase === 'execute'
      ? await f.service.execute({ token: plan.token, confirmed: true }) : await f.service.prepare(payload);
    assert.equal(result.code, 'FEISHU_OPERATOR_CHANGED');
    assert.equal(f.writes(), 0);
    assert.equal(f.journal().entries.length, 0);
  }
});

test('operator reinspection and expiry invalidate pending create authority', async () => {
  for (const expire of [false, true]) {
    const f = setup({ expires: 1800 }); await f.service.connect(config()); const p = await prepareCreate(f);
    if (expire) f.advance(301000); else await selectPerson(f);
    assert.equal((await f.service.execute({ token: p.token, confirmed: true })).ok, false);
    assert.equal(f.writes(), 0);
  }
});

test('disconnect during person lookup cannot return a stale identity', async () => {
  const f = setup(); await f.service.connect(config()); f.onOperator(() => f.service.clear());
  assert.equal((await selectPerson(f)).code, 'FEISHU_SESSION_EXPIRED');
  assert.equal((await f.service.status()).connected, false);
});

test('wrong role owner after creation stays unknown and cannot reconcile as successful', async () => {
  const f = setup(); f.onCreate(r => { r.fields.find(x => x.field_key === 'role_owners').field_value[0].owners = ['another-fixture']; });
  const { result } = await create(f);
  assert.equal(result.code, 'FEISHU_MAINTAINER_READBACK_MISMATCH');
  assert.equal(result.status, 'unknown'); assert.equal(result.recordId, '41');
  const reconciled = await f.service.reconcile({ entryId: f.journal().entries[0].entryId });
  assert.equal(reconciled.code, 'FEISHU_MAINTAINER_READBACK_MISMATCH');
  assert.equal(f.journal().entries[0].status, 'unknown'); assert.equal(f.writes(), 1);
  f.mutateRemote(r => { r.fields.find(x => x.field_key === 'role_owners').field_value[0].owners = ['fixture-assignee']; });
  assert.equal((await f.service.reconcile({ entryId: f.journal().entries[0].entryId })).ok, true);
  assert.equal(f.writes(), 1);
});

test('duplicate roles, extra owners and missing role fields never pass role readback', async () => {
  for (const mutate of [r => r.fields.splice(r.fields.findIndex(x => x.field_key === 'role_owners'), 1),
    r => r.fields.find(x => x.field_key === 'role_owners').field_value[0].owners.push('another-fixture'),
    r => r.fields.find(x => x.field_key === 'role_owners').field_value.push({ role: 'fixture-maintainer', owners: ['fixture-assignee'] })]) {
    const f = setup(); f.onCreate(mutate); const { result } = await create(f);
    assert.equal(result.code, 'FEISHU_MAINTAINER_READBACK_MISMATCH'); assert.equal(result.status, 'unknown');
    assert.equal(f.writes(), 1);
  }
});

test('manual search never defaults to the actor and refuses empty or forged choices', async () => {
  const f = setup(); await f.service.connect(config());
  const before = f.calls.length;
  for (const name of ['', ' ', 'Fixture\nOperator', 'x'.repeat(257)]) {
    assert.equal((await f.service.searchMaintainers({ name })).code, 'FEISHU_MAINTAINER_NAME_REQUIRED');
  }
  assert.equal(f.calls.length, before);
  const search = await f.service.searchMaintainers({ name: 'Fixture Operator' });
  assert.equal(search.candidates.length, 1);
  assert.ok(!JSON.stringify(search).includes('fixture-assignee'));
  assert.equal((await f.service.inspectOperator()).code, 'FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
  assert.equal((await f.service.inspectOperator({ candidateToken: 'fixture-assignee' })).code, 'FEISHU_OPERATOR_CONFIRMATION_REQUIRED');
  assert.equal(f.writes(), 0);
});

test('same-name users require explicit distinct account selection; no first-match assignment', async () => {
  const f = setup(); await f.service.connect(config());
  f.setUsers([
    { user_key: 'choice-one', name_cn: 'Fixture Operator', username: 'fixture.one', status: 'activated' },
    { user_key: 'choice-two', name_cn: 'Fixture Operator', username: 'fixture.two', status: 'activated' }
  ]);
  const search = await f.service.searchMaintainers({ name: 'Fixture Operator' });
  assert.equal(search.candidates.length, 2);
  const chosen = await f.service.inspectOperator({ candidateToken: search.candidates[1].token });
  const plan = await f.service.prepare({ action: 'create', runDir: 'run', rowId: 'row', values: values(),
    safetyConfirmed: true, operatorToken: chosen.token, operatorConfirmed: true });
  assert.equal((await f.service.execute({ token: plan.token, confirmed: true })).ok, true);
  assert.deepEqual(f.calls.find(c => c.url.endsWith('/create')).body.field_value_pairs.at(-1).field_value,
    [{ role: 'fixture-maintainer', owners: ['choice-two'] }]);
  f.setUsers([
    { user_key: 'choice-one', name_cn: 'Fixture Operator', status: 'activated' },
    { user_key: 'choice-two', name_cn: 'Fixture Operator', status: 'activated' }
  ]);
  assert.equal((await f.service.searchMaintainers({ name: 'Fixture Operator' })).code, 'FEISHU_MAINTAINER_AMBIGUOUS');
});

test('changed account labels, new searches, expiry and unbounded results invalidate candidate authority', async () => {
  for (const change of ['username', 'search', 'expiry']) {
    const f = setup({ expires: 1800 }); await f.service.connect(config());
    const search = await f.service.searchMaintainers({ name: 'Fixture Operator' });
    if (change === 'username') f.setUsers([{ user_key: 'fixture-assignee', name_cn: 'Fixture Operator', username: 'renamed', status: 'activated' }]);
    if (change === 'search') await f.service.searchMaintainers({ name: 'Different Fixture' });
    if (change === 'expiry') f.advance(301000);
    assert.equal((await f.service.inspectOperator({ candidateToken: search.candidates[0].token })).ok, false);
    assert.equal(f.writes(), 0);
  }
  const f = setup(); await f.service.connect(config());
  f.setUsers(Array.from({ length: 51 }, (_, i) => ({ user_key: `fixture-${i}`, name_cn: 'Fixture Operator', status: 'activated' })));
  assert.equal((await f.service.searchMaintainers({ name: 'Fixture Operator' })).code, 'FEISHU_MAINTAINER_RESULTS_INVALID');
  assert.equal(f.writes(), 0);
});
