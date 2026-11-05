const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const script = path.resolve(__dirname, '../scripts/probe-feishu-metadata.js');
const input = { pluginId: 'fixture', pluginSecret: 'fixture-private-secret',
  userKey: 'fixture-user', projectKey: 'fixture-project', workItemTypeKey: 'fixture-type' };

function run(authCode = 0, empty = false) {
  const stub = `globalThis.fetch = async (url) => new Response(JSON.stringify(
    url.endsWith('/plugin_token')
      ? {error:{code:${authCode},msg:'fixture-private-secret'},data:{token:'p-fixture',expire_time:7200}}
      : {err_code:0,data:${empty ? '[]' : "[{field_key:'field',field_name:'Name',field_type_key:'text',default_value:'fixture-private-default'}]"}}
  )); require(${JSON.stringify(script)});`;
  return spawnSync(process.execPath, ['-e', stub], {
    input: JSON.stringify(input), encoding: 'utf8', timeout: 5000
  });
}

test('probe connects auth and existing reader without outputting secrets/defaults', () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.ok(!result.stdout.includes('fixture-private'));
  const report = JSON.parse(result.stdout);
  assert.equal(report.authenticated, true);
  assert.equal(report.fieldCount, 1);
  assert.equal(report.fields[0].name, 'Name');
});
test('auth business code survives credential-provider error boundary', () => {
  const result = run(403);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: false, authenticated: false, code: 'FEISHU_AUTH_API', apiCode: 403
  });
});
test('empty metadata is not a successful live acceptance', () => {
  const result = run(0, true);
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).ok, false);
});
