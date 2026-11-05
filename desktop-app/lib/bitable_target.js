function fail(code) { throw Object.assign(new Error(code), { code }); }
function id(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('BITABLE_TARGET_INVALID');
  return value;
}
function table(value) {
  if (typeof value !== 'string' || !/^tbl[A-Za-z0-9]+$/.test(value)) fail('BITABLE_TABLE_ID_INVALID');
  return value;
}

function parseBitableTarget(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return { kind: 'base', appToken: id(input.appToken), tableId: table(input.tableId), needsTableSelection: false };
  }
  if (typeof input !== 'string' || input.length > 4096) fail('BITABLE_TARGET_INVALID');
  let url;
  try { url = new URL(input.trim()); } catch (_) { fail('BITABLE_LINK_REQUIRED'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || !/^(?:[a-z0-9-]+\.)*feishu\.cn$/i.test(url.hostname) || url.hostname === 'project.feishu.cn') {
    fail('BITABLE_LINK_INVALID');
  }
  const match = /^\/(base|wiki)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
  if (!match) fail('BITABLE_LINK_INVALID');
  if (url.searchParams.getAll('table').length > 1) fail('BITABLE_TABLE_ID_INVALID');
  const tableId = url.searchParams.has('table') ? table(url.searchParams.get('table')) : '';
  const token = id(match[2]);
  // A wiki node token must be resolved through the authorized wiki API first.
  // It is not a Bitable app_token, even when a table query parameter is present.
  return { kind: match[1], ...(match[1] === 'base' ? { appToken: token } : { nodeToken: token }),
    tableId, needsTableSelection: !tableId };
}

module.exports = { parseBitableTarget };
