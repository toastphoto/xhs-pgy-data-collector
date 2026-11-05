const { exchangePluginToken } = require('../lib/feishu_plugin_auth');
const { createFeishuMetadataReader } = require('../lib/feishu_project_metadata');
const { platformDiagnostic } = require('../lib/feishu_platform_diagnostic');

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString('utf8');
    if (Buffer.byteLength(input) > 32768) throw new Error('INPUT_INVALID');
  }
  const config = JSON.parse(input);
  input = '';
  let authenticated = false;
  let authFailure;
  const reader = createFeishuMetadataReader({
    projectKey: config.projectKey, workItemTypeKey: config.workItemTypeKey,
    getCredentials: async () => {
      if (typeof config.userKey !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(config.userKey)) {
        throw new Error('USER_KEY_REQUIRED');
      }
      let auth;
      try { auth = await exchangePluginToken(config); }
      catch (error) { authFailure = error; throw error; }
      config.pluginSecret = '';
      authenticated = true;
      return { kind: 'plugin', token: auth.token, userKey: config.userKey };
    }, timeoutMs: 35000
  });
  try {
    const result = await reader.readMetadata();
    // Opt-in platform diagnostics exclude defaults, contacts and credentials.
    console.log(JSON.stringify({ ok: result.fields.length > 0, authenticated,
      fieldCount: result.fields.length, fields: result.requirements,
      emptyMetadata: result.fields.length === 0,
      ...(config.inspectPlatform === true ? { platformDiagnostic: platformDiagnostic(result.fields) } : {}) }));
    if (!result.fields.length) process.exitCode = 2;
  } catch (error) {
    if (authFailure) error = authFailure;
    const code = /^FEISHU_[A-Z_]+$/.test(error.code || '') ? error.code : 'FEISHU_PROBE_FAILED';
    console.log(JSON.stringify({ ok: false, authenticated, code,
      ...(Number.isSafeInteger(error.status) ? { status: error.status } : {}),
      ...(Number.isSafeInteger(error.apiCode) ? { apiCode: error.apiCode } : {}) }));
    process.exitCode = 1;
  } finally {
    config.pluginSecret = '';
  }
}
main().catch(() => {
  console.log(JSON.stringify({ ok: false, code: 'FEISHU_PROBE_INPUT_INVALID' }));
  process.exitCode = 1;
});
