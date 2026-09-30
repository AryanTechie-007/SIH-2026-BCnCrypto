'use strict';
/**
 * Opens the app from a source checkout.
 *
 *   node scripts/launch.js         the built UI (frontend/dist)
 *   node scripts/launch.js --dev   the Vite dev server, for hot reload; start it
 *                                  first with `npm run dev` in frontend/
 *
 * Clears ELECTRON_RUN_AS_NODE, which editors built on Electron (VS Code and
 * others) can leave set: with it, Electron starts as plain Node and no window opens.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const electron = require('electron'); // the Electron binary's path, when required from Node

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
if (process.argv.includes('--dev')) {
  env.CIPHERTRACE_DEV_URL = env.CIPHERTRACE_DEV_URL || 'http://127.0.0.1:5173';
}

const child = spawn(electron, [path.resolve(__dirname, '..')], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
