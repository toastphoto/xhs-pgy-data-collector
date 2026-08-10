function guardOutputStream(stream) {
  if (!stream || typeof stream.on !== 'function') return false;
  stream.on('error', () => {
    // A packaged GUI may inherit a pipe that closes immediately after launch.
    // Logging must never terminate the Electron main process.
  });
  return true;
}

function installProcessStdioGuards(processLike = process) {
  return {
    stdout: guardOutputStream(processLike?.stdout),
    stderr: guardOutputStream(processLike?.stderr)
  };
}

module.exports = {
  guardOutputStream,
  installProcessStdioGuards
};
