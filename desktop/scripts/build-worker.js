'use strict';
/**
 * Freezes the Python worker with PyInstaller into backend/dist/ciphertrace-worker/.
 * Runs `uv sync --locked` in backend/ first, which installs the worker's packages
 * and PyInstaller (the dev group) exactly as uv.lock pins them. Set
 * CIPHERTRACE_PYTHON to freeze with another environment instead; it must already
 * have PyInstaller. Run on the OS you are packaging for.
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const backend = path.resolve(__dirname, '..', '..', 'backend');
let python = process.env.CIPHERTRACE_PYTHON;

if (!python) {
  execFileSync('uv', ['sync', '--locked'], { cwd: backend, stdio: 'inherit' });
  python = process.platform === 'win32'
    ? path.join(backend, '.venv', 'Scripts', 'python.exe')
    : path.join(backend, '.venv', 'bin', 'python');
}

execFileSync(python, ['-m', 'PyInstaller', '--noconfirm', '--clean', 'ciphertrace-worker.spec'], { cwd: backend, stdio: 'inherit' });
