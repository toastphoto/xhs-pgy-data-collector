const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const desktopRoot = path.resolve(__dirname, '..');
const backendRoot = path.resolve(desktopRoot, '..', 'content-analyzer');
const requestedPlatform = process.argv.includes('--platform')
  ? process.argv[process.argv.indexOf('--platform') + 1]
  : process.platform;

if (requestedPlatform !== process.platform) {
  console.error(
    `[build-backend] ${requestedPlatform} backend must be built on ${requestedPlatform}; current platform is ${process.platform}.`
  );
  process.exit(1);
}

const localVenvPython = process.platform === 'win32'
  ? path.join(backendRoot, '.venv', 'Scripts', 'python.exe')
  : path.join(backendRoot, '.venv', 'bin', 'python');

const candidates = [];
if (process.env.PYTHON) candidates.push({ command: process.env.PYTHON, args: [] });
if (fs.existsSync(localVenvPython)) candidates.push({ command: localVenvPython, args: [] });
if (process.platform === 'win32') candidates.push({ command: 'py', args: ['-3'] });
candidates.push({ command: 'python', args: [] });
if (process.platform !== 'win32') candidates.push({ command: 'python3', args: [] });

function findPythonWithPyInstaller() {
  for (const candidate of candidates) {
    const result = spawnSync(
      candidate.command,
      [...candidate.args, '-c', 'import PyInstaller'],
      { cwd: backendRoot, stdio: 'ignore', windowsHide: true }
    );
    if (result.status === 0) return candidate;
  }
  return null;
}

const python = findPythonWithPyInstaller();
if (!python) {
  console.error(
    '[build-backend] No Python environment with PyInstaller was found. ' +
    'Create content-analyzer/.venv and install requirements_packaging_win.txt, ' +
    'or set PYTHON to an equivalent interpreter.'
  );
  process.exit(1);
}

const addData = `${path.join(backendRoot, 'app', 'static')}${path.delimiter}app/static`;
const args = [
  ...python.args,
  '-m',
  'PyInstaller',
  '--noconfirm',
  '--clean',
  '--onedir',
  '--name',
  'xhs-pgy-backend',
  '--distpath',
  path.join(backendRoot, 'dist-pyinstaller'),
  '--workpath',
  path.join(backendRoot, 'build-pyinstaller'),
  '--specpath',
  path.join(backendRoot, 'build-pyinstaller'),
  '--add-data',
  addData,
  path.join(backendRoot, 'main.py')
];

console.log(`[build-backend] Using ${python.command}`);
const result = spawnSync(python.command, args, {
  cwd: backendRoot,
  env: {
    ...process.env,
    PYTHONUTF8: process.env.PYTHONUTF8 || '1',
    PYTHONIOENCODING: process.env.PYTHONIOENCODING || 'utf-8'
  },
  stdio: 'inherit',
  windowsHide: true
});

if (result.error) {
  console.error('[build-backend] Failed to start PyInstaller:', result.error.message);
  process.exit(1);
}
process.exit(result.status || 0);
