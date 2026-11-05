// Only this lifetime's spawned backend and cleanup helper handles are owned.
function createSupervisor({ spawn, platform, send, exit, setTimer = setInterval }) {
  let child = null, started = false, stopping = false, attempt = null;
  let parentGone = false, orphanAttempts = 0;
  const live = p => p && p.exitCode === null && p.signalCode === null;
  function failed(a, code = 'STOP_FAILED') {
    if (attempt !== a) return;
    attempt = null;
    send({ type: 'stop-failed', code });
  }
  function stop() {
    stopping = true;
    if (attempt) return; // never overlap cleanup helpers, including termination
    if (!live(child)) return exit(0);
    const a = { helper: null, ticks: 0, terminating: false };
    attempt = a;
    if (platform !== 'win32') {
      try { if (!child.kill('SIGTERM')) failed(a); } catch (_) { failed(a); }
      return;
    }
    try {
      const helper = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      a.helper = helper;
      const finished = code => {
        if (attempt !== a) return;
        if (a.terminating || code !== 0) return failed(a, a.terminating ? 'STOP_HELPER_TIMEOUT' : 'STOP_FAILED');
        attempt = null;
        if (!live(child)) exit(0);
      };
      helper.once('error', () => {
        // A spawn error with no PID means no helper is alive. A live helper's
        // error does not authorize starting another until exit/close arrives.
        if (!helper.pid) failed(a);
        else { a.terminating = true; try { helper.kill(); } catch (_) {} }
      });
      helper.once('exit', finished);
      helper.once('close', finished);
    } catch (_) { failed(a); }
  }
  function tick(parentPid) {
    if (!parentGone) { try { process.kill(parentPid, 0); } catch (_) { parentGone = true; } }
    if (attempt) {
      const a = attempt;
      if (++a.ticks >= 10 && !a.terminating) {
        a.terminating = true;
        // Failed spawn/test doubles have no OS PID. Never terminate a guessed PID.
        if (!a.helper?.pid) failed(a, 'STOP_HELPER_TIMEOUT');
        else {
          // Retain the attempt until this exact helper confirms exit/close.
          // kill failure or missing completion forbids overlapping retries.
          send({ type: 'stop-failed', code: 'STOP_HELPER_TIMEOUT' });
          try { a.helper.kill(); } catch (_) {}
        }
      }
    }
    // Parent-loss recovery is finite. A connected parent's explicit stop is the
    // only retry authority otherwise; watcher ticks never retry it indefinitely.
    if (parentGone && !attempt && orphanAttempts < 3) { orphanAttempts++; stop(); }
  }
  function start(message) {
    if (started || stopping || !Number.isSafeInteger(message.parentPid) || message.parentPid <= 0) return;
    started = true;
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    child = spawn(message.executable, [], { cwd: message.cwd, env, windowsHide: true, stdio: 'ignore' });
    child.once('error', () => { if (!child?.pid) { child = null; exit(1); } });
    child.once('exit', code => { child = null; if (!attempt) exit(code || 0); });
    const watch = setTimer(() => tick(message.parentPid), 500); watch.unref?.();
  }
  return { start, stop };
}
module.exports = { createSupervisor };
if (require.main === module) {
  const controller = createSupervisor({ spawn: require('child_process').spawn, platform: process.platform,
    send: m => { if (process.connected) process.send(m); }, exit: code => process.exit(code) });
  process.on('message', m => { if (m?.type === 'start') controller.start(m); if (m?.type === 'stop') controller.stop(); });
  process.on('disconnect', controller.stop);
  process.on('SIGTERM', controller.stop);
}
