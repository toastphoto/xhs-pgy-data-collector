// QA-only child supervisor. Parent IPC closure is the crash boundary; never find
// or stop a backend by its executable name, port, or an on-disk stale PID.
const { spawn } = require('child_process');
let child = null;
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  if (!child || child.exitCode !== null) return process.exit(0);
  const ownedPid = child.pid;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/PID', String(ownedPid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.on('error', () => process.exit(1));
    killer.on('exit', code => process.exit(code === 0 ? 0 : 1));
  } else {
    child.kill('SIGTERM');
    child.once('exit', () => process.exit(0));
  }
}
process.on('message', message => {
  if (message?.type === 'stop') return stop();
  if (message?.type !== 'start' || child || stopping) return;
  const parentPid = message.parentPid;
  if (!Number.isSafeInteger(parentPid) || parentPid <= 0) return process.exit(1);
  const parentWatch = setInterval(() => {
    try { process.kill(parentPid, 0); } catch (_) { clearInterval(parentWatch); stop(); }
  }, 500);
  parentWatch.unref();
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  child = spawn(message.executable, [], { cwd: message.cwd, env, windowsHide: true, stdio: 'ignore' });
  child.once('error', () => process.exit(1));
  child.once('exit', code => { child = null; if (!stopping) process.exit(code || 0); });
});
process.on('disconnect', stop);
process.on('SIGTERM', stop);
