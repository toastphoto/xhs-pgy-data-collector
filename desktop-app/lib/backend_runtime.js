const path = require('path');

function packagedBackendExecutable(resourcesPath, platform = process.platform) {
  const filename = platform === 'win32'
    ? 'xhs-pgy-backend.exe'
    : 'xhs-pgy-backend';
  return path.join(resourcesPath, 'content-analyzer-backend', filename);
}

function assessBackendHealth(response, {
  expectedToken = '',
  protocolVersion = '1'
} = {}) {
  if (!response?.ok) {
    return { ok: false, code: response?.code || 'BACKEND_NOT_READY' };
  }
  if (!expectedToken) {
    return { ok: true, pid: Number(response?.json?.pid || 0) || null };
  }
  if (!response?.json?.instance_token) {
    return { ok: false, code: 'BACKEND_IDENTITY_MISSING' };
  }
  if (
    response.json.protocol_version !== protocolVersion
    || response.json.instance_token !== expectedToken
  ) {
    return { ok: false, code: 'BACKEND_IDENTITY_MISMATCH' };
  }
  return { ok: true, pid: Number(response.json.pid || 0) || null };
}

module.exports = {
  assessBackendHealth,
  packagedBackendExecutable
};
