const fs = require('fs');
const path = require('path');
const os = require('os');

const BITABLE_APP_ID = 'com.solo.contentanalyzer.bitable';
const BITABLE_NAME = 'pgy-workbench-bitable';
const BITABLE_PORT = '28010';

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function configureBitableRuntime(app, metadata, env = process.env) {
  if (metadata.productVariant !== 'feishu-bitable') return { active: false };
  if (metadata.buildFlavor === 'coexist-qa') throw new Error('BITABLE_EDITION_CONFLICT');
  const root = path.join(app.getPath('appData'), BITABLE_NAME);
  const requested = app.commandLine.getSwitchValue('user-data-dir');
  const userData = requested ? path.resolve(requested) : path.join(root, 'profile');
  const fixture = inside(os.tmpdir(), userData)
    && /^pgy-bitable-[a-zA-Z0-9_-]+$/.test(path.basename(userData));
  if (!inside(root, userData) && !fixture) throw new Error('BITABLE_PROFILE_OUTSIDE_ISOLATED_ROOT');
  const sessionData = path.join(userData, 'sessions');
  const crashDumps = path.join(userData, 'crashes');
  for (const dir of [userData, sessionData, crashDumps]) fs.mkdirSync(dir, { recursive: true });
  app.setName(BITABLE_NAME);
  app.setPath('userData', userData);
  app.setPath('sessionData', sessionData);
  app.setPath('crashDumps', crashDumps);
  env.API_HOST = '127.0.0.1';
  env.API_PORT = BITABLE_PORT;
  for (const [key, dir] of [['DATA_DIR', 'data'], ['OUTPUT_DIR', 'output'], ['LOG_DIR', 'logs']]) {
    env[key] = path.join(userData, 'content-analyzer', dir);
  }
  return { active: true, appId: BITABLE_APP_ID, port: BITABLE_PORT, userData, sessionData };
}

module.exports = { BITABLE_APP_ID, BITABLE_NAME, BITABLE_PORT, configureBitableRuntime };
