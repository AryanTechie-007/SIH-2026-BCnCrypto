'use strict';
/**
 * Freezes the Python worker with PyInstaller into backend/dist/ciphertrace-worker/,
 * using backend/.venv (or CIPHERTRACE_PYTHON). Installs PyInstaller into that
 * environment first if it is missing. Run on the OS you are packaging for.
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const backend = path.resolve(__dirname, '..', '..', 'backend');
const python = process.env.CIPHERTRACE_PYTHON || (process.platform === 'win32'
  ? path.join(backend, '.venv', 'Scripts', 'python.exe')
  : path.join(backend, '.venv', 'bin', 'python'));

const run = (args) => execFileSync(python, args, { cwd: backend, stdio: 'inherit' });
const works = (command, args) => {
  try {
    execFileSync(command, args, { cwd: backend, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

if (!works(python, ['-c', 'import PyInstaller'])) {
  console.log('Installing PyInstaller into the backend environment...');
  if (works(python, ['-m', 'pip', '--version'])) {
    run(['-m', 'pip', 'install', '-r', 'requirements-build.txt']);
  } else {
    // Environments created by uv have no pip.
    execFileSync('uv', ['pip', 'install', '--python', python, '-r', 'requirements-build.txt'], { cwd: backend, stdio: 'inherit' });
  }
}

run(['-m', 'PyInstaller', '--noconfirm', '--clean', 'ciphertrace-worker.spec']);
