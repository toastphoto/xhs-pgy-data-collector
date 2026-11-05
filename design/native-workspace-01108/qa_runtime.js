const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

const QA_APP_ID = 'com.solo.contentanalyzer.qa';
const QA_NAME = 'pgy-workbench-qa';
const QA_PORT = '18010';

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function configureQaRuntime(app, metadata, env = process.env) {
  if (metadata.buildFlavor !== 'coexist-qa') return { active: false };
  // Only immutable package metadata selects QA. Environment variables cannot turn
  // the production application into QA or redirect QA back to production data.
  const qaRoot = path.join(app.getPath('appData'), QA_NAME);
  const requested = app.commandLine.getSwitchValue('user-data-dir');
  const userData = requested ? path.resolve(requested) : path.join(qaRoot, 'profile');
  const fixtureRoot = path.join(os.tmpdir());
  const fixtureName = path.basename(userData);
  const fixture = inside(fixtureRoot, userData) && /^pgy-(qa|invite-flow)-[a-zA-Z0-9_-]+$/.test(fixtureName);
  if (!inside(qaRoot, userData) && !fixture) throw new Error('QA_PROFILE_OUTSIDE_ISOLATED_ROOT');
  const sessionData = path.join(userData, 'sessions');
  const crashDumps = path.join(userData, 'crashes');
  for (const dir of [userData, sessionData, crashDumps]) fs.mkdirSync(dir, { recursive: true });
  app.setName(QA_NAME);
  app.setPath('userData', userData);
  app.setPath('sessionData', sessionData);
  app.setPath('crashDumps', crashDumps);
  env.API_HOST = '127.0.0.1';
  env.API_PORT = QA_PORT;
  for (const [key, dir] of [['DATA_DIR', 'data'], ['OUTPUT_DIR', 'output'], ['LOG_DIR', 'logs']]) {
    env[key] = path.join(userData, 'content-analyzer', dir);
  }
  return { active: true, appId: QA_APP_ID, userData, sessionData, port: QA_PORT };
}

function backendPortAvailable(port = QA_PORT) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port: Number(port), exclusive: true }, () => server.close(() => resolve(true)));
  });
}

module.exports = { QA_APP_ID, QA_NAME, QA_PORT, configureQaRuntime, backendPortAvailable };
