'use strict';
/**
 * CIPHERTRACE desktop app: main process.
 *
 * Starts the Python worker (backend/app/worker.py) and relays the UI's calls to
 * it, one JSON line per request over stdin/stdout. The worker still runs
 * blockchain/client/cli.js for every ledger call, on this app's own Node
 * (ELECTRON_RUN_AS_NODE), so no separate Node.js install is needed.
 *
 * The UI has no Node access and no network server to talk to: everything goes
 * through the three functions preload.js exposes.
 *
 * Development (`npm start`): the worker runs from backend/.venv and keeps its
 * data in backend/ as before. Packaged: a frozen worker ships in the app's
 * resources and data lives in the OS app-data folder.
 */
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const REPO = path.resolve(__dirname, '..');
// Set to the Vite dev server (http://127.0.0.1:5173) to get hot reload while working on the UI.
const DEV_URL = process.env.CIPHERTRACE_DEV_URL;
const RENDERER = app.isPackaged ? path.join(__dirname, 'renderer') : path.join(REPO, 'frontend', 'dist');

// Methods that write a file: the destination always comes from a save dialog shown here.
const SAVE_METHODS = new Set(['documents.save_envelope', 'decryption.save_copy', 'forensics.save_evidence']);
const QUIT_GRACE_MS = 5000;
// Each user's cli.js connects to their own org's peer; blockchain/client/ledger.js has the same defaults.
const DEFAULT_LEDGER = { host: 'localhost', org1Port: 7051, org2Port: 9051 };
const MIN_UPTIME_FOR_RESTART_MS = 10000;

let mainWindow = null;
let worker = null;
let quitting = false;
let logStream = null;

function log(line) {
  const text = `${new Date().toISOString()} ${line}\n`;
  if (logStream) logStream.write(text);
  if (!app.isPackaged) process.stderr.write(text);
}

// ── Worker ────────────────────────────────────────────────────────────────

function workerCommand() {
  if (app.isPackaged) {
    const dir = path.join(process.resourcesPath, 'worker');
    const exe = process.platform === 'win32' ? 'ciphertrace-worker.exe' : 'ciphertrace-worker';
    return { command: path.join(dir, exe), args: [], cwd: dir };
  }
  // backend/.venv if there is one (see README), else the Python on PATH (setup/install_dependencies.bat).
  const venv = path.join(REPO, 'backend', '.venv');
  const venvPython = process.platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python');
  const python = process.env.CIPHERTRACE_PYTHON
    || (fs.existsSync(venvPython) ? venvPython : (process.platform === 'win32' ? 'python' : 'python3'));
  return { command: python, args: [path.join(REPO, 'backend', 'run_worker.py')], cwd: path.join(REPO, 'backend') };
}

// ── Ledger connection (the cog on the sign-in page) ─────────────────────
// Saved as {host, port} in the app's user-data folder. With no port, each org
// keeps its default port on the given host. With nothing saved, cli.js uses
// ORG1_PEER / ORG2_PEER from the environment, or its defaults.

function ledgerSettingsFile() {
  return path.join(app.getPath('userData'), 'ledger-connection.json');
}

function validLedgerSettings(value) {
  if (value === null || typeof value !== 'object') return null;
  const host = typeof value.host === 'string' ? value.host.trim() : '';
  const port = value.port === null || value.port === undefined || value.port === '' ? null : Number(value.port);
  if (!/^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/.test(host)) return null;
  if (port !== null && !(Number.isInteger(port) && port >= 1 && port <= 65535)) return null;
  return { host, port };
}

function loadLedgerSettings() {
  try {
    return validLedgerSettings(JSON.parse(fs.readFileSync(ledgerSettingsFile(), 'utf8')));
  } catch {
    return null;
  }
}

/** The peer addresses cli.js will dial: {org1, org2}. */
function ledgerPeers(saved = loadLedgerSettings()) {
  if (saved) {
    return {
      org1: `${saved.host}:${saved.port ?? DEFAULT_LEDGER.org1Port}`,
      org2: `${saved.host}:${saved.port ?? DEFAULT_LEDGER.org2Port}`
    };
  }
  return {
    org1: process.env.ORG1_PEER || `${DEFAULT_LEDGER.host}:${DEFAULT_LEDGER.org1Port}`,
    org2: process.env.ORG2_PEER || `${DEFAULT_LEDGER.host}:${DEFAULT_LEDGER.org2Port}`
  };
}

function workerEnv() {
  const peers = ledgerPeers();
  const env = {
    ...process.env,
    NODE_BIN: process.env.NODE_BIN || process.execPath,
    ELECTRON_RUN_AS_NODE: '1',
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    ORG1_PEER: peers.org1,
    ORG2_PEER: peers.org2
  };
  if (app.isPackaged) {
    const data = path.join(app.getPath('userData'), 'data');
    fs.mkdirSync(data, { recursive: true });
    Object.assign(env, {
      LEDGER_CLI_PATH: path.join(process.resourcesPath, 'ledger-client', 'cli.js'),
      CIPHERTRACE_DB_PATH: path.join(data, 'ciphertrace.db'),
      KEYSTORE_DIR: path.join(data, 'keystores'),
      BUNDLES_DIR: path.join(data, 'bundles'),
      UPLOAD_DIR: path.join(data, 'uploads'),
      RETURNS_DIR: path.join(data, 'returns')
    });
  }
  return env;
}

class Worker {
  constructor() {
    this.pending = new Map();
    this.nextId = 1;
    this.retiring = false; // stopped on purpose, to be replaced
    this.startedAt = Date.now();
    this.failure = null;
    this.ready = new Promise((resolve, reject) => {
      this.markReady = resolve;
      this.markFailed = reject;
    });
    this.ready.catch(() => {}); // failures are reported through call() and the startup dialog

    const { command, args, cwd } = workerCommand();
    log(`[worker] starting ${command} ${args.join(' ')}`);
    this.proc = spawn(command, args, { cwd, env: workerEnv(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.exited = new Promise((resolve) => this.proc.once('exit', resolve));

    this.proc.on('error', (err) => this.fail(`Could not start the CIPHERTRACE worker (${command}): ${err.message}`));
    this.proc.stdin.on('error', () => {}); // EPIPE after the worker died; handled by 'exit'
    readline.createInterface({ input: this.proc.stdout }).on('line', (line) => this.onLine(line));
    readline.createInterface({ input: this.proc.stderr }).on('line', (line) => log(`[worker] ${line}`));
    this.proc.on('exit', (code, signal) => this.onExit(code, signal));
  }

  onLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      log(`[worker] unexpected output: ${line.slice(0, 200)}`);
      return;
    }
    if (message.event === 'ready') {
      log(`[worker] ready (boot ${message.boot_id})`);
      this.markReady();
    } else if (message.event === 'fatal') {
      this.fail(`The CIPHERTRACE worker failed its startup checks: ${message.detail}`);
    } else {
      const resolve = this.pending.get(message.id);
      if (resolve) {
        this.pending.delete(message.id);
        resolve(message);
      }
    }
  }

  fail(reason) {
    if (!this.failure) {
      this.failure = reason;
      log(`[worker] ${reason}`);
      this.markFailed(new Error(reason));
    }
  }

  onExit(code, signal) {
    log(`[worker] exited (code ${code}, signal ${signal})`);
    this.fail(`The CIPHERTRACE worker stopped (exit code ${code}).`);
    for (const resolve of this.pending.values()) {
      resolve({ ok: false, status: 503, detail: this.failure });
    }
    this.pending.clear();
    if (worker === this && !quitting && !this.retiring) onWorkerLost(this);
  }

  async call(method, params) {
    try {
      await this.ready;
    } catch (err) {
      return { ok: false, status: 503, detail: err.message };
    }
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.proc.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }

  /** Closes stdin so the worker finishes what it is doing and exits; kills it if that takes too long. */
  async stop() {
    if (this.proc.exitCode !== null || this.proc.signalCode !== null) return;
    this.proc.stdin.end();
    const timer = setTimeout(() => this.proc.kill(), QUIT_GRACE_MS);
    await this.exited;
    clearTimeout(timer);
  }
}

function onWorkerLost(lost) {
  // A crash after a healthy run gets a fresh worker; the UI sees the new boot ID and signs out.
  // A worker that dies right after starting would only die again, so show why instead.
  if (Date.now() - lost.startedAt >= MIN_UPTIME_FOR_RESTART_MS) {
    worker = new Worker();
    worker.ready.catch((err) => showStartupError(err.message));
  } else {
    showStartupError(lost.failure);
  }
}

function showStartupError(reason) {
  const logFile = path.join(app.getPath('logs'), 'worker.log');
  dialog.showErrorBox('CIPHERTRACE could not start', `${reason}\n\nDetails are in ${logFile}`);
}

// ── IPC: the UI's only way in ────────────────────────────────────────────

function isParams(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

ipcMain.handle('ct:call', (_event, method, params) => {
  if (typeof method !== 'string' || !isParams(params)) {
    return { ok: false, status: 400, detail: 'Invalid call' };
  }
  if (SAVE_METHODS.has(method)) {
    return { ok: false, status: 400, detail: `${method} writes a file; use saveAs` };
  }
  if ('dest' in params) {
    return { ok: false, status: 400, detail: 'Only a save dialog may choose where files are written' };
  }
  return worker.call(method, params);
});

ipcMain.handle('ct:saveAs', async (event, method, params, suggestedName) => {
  if (!SAVE_METHODS.has(method) || !isParams(params)) {
    return { ok: false, status: 400, detail: 'Invalid save request' };
  }
  const name = path.basename(String(suggestedName || 'download'));
  const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    defaultPath: path.join(app.getPath('downloads'), name)
  });
  if (canceled || !filePath) {
    return { ok: true, result: null, canceled: true };
  }
  return worker.call(method, { ...params, dest: filePath });
});

ipcMain.handle('ct:getLedgerConnection', () => ({
  saved: loadLedgerSettings(),
  peers: ledgerPeers(),
  defaults: DEFAULT_LEDGER
}));

// Saving restarts the worker so every later cli.js call uses the new address.
// The cog is only on the sign-in page, so no session is lost.
ipcMain.handle('ct:setLedgerConnection', async (_event, value) => {
  let saved = null;
  if (value !== null) {
    saved = validLedgerSettings(value);
    if (!saved) {
      return { ok: false, status: 400, detail: 'Enter a host name or IPv4 address, and a port from 1 to 65535 (or leave the port empty).' };
    }
    fs.mkdirSync(path.dirname(ledgerSettingsFile()), { recursive: true });
    fs.writeFileSync(ledgerSettingsFile(), JSON.stringify(saved, null, 2));
  } else {
    fs.rmSync(ledgerSettingsFile(), { force: true });
  }
  log(`[ledger] connection set to ${JSON.stringify(ledgerPeers(saved))}`);

  const old = worker;
  old.retiring = true;
  await old.stop();
  worker = new Worker();
  worker.ready.catch((err) => showStartupError(err.message));
  return { ok: true, result: { saved, peers: ledgerPeers(saved), defaults: DEFAULT_LEDGER } };
});

// ── Window ────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#000000',
    title: 'CIPHERTRACE',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  const contents = mainWindow.webContents;
  // The UI is a single page: no popups, no navigating away from it.
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (url !== contents.getURL()) event.preventDefault();
  });
  contents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  if (DEV_URL && !app.isPackaged) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(RENDERER, 'index.html'));
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────

// One instance only: two workers would share the same database and keystores.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    fs.mkdirSync(app.getPath('logs'), { recursive: true });
    logStream = fs.createWriteStream(path.join(app.getPath('logs'), 'worker.log'), { flags: 'a' });

    if (!app.isPackaged && !DEV_URL && !fs.existsSync(path.join(RENDERER, 'index.html'))) {
      dialog.showErrorBox('CIPHERTRACE UI not built', 'Run `npm run build` in frontend/ first (or use `npm start` in desktop/).');
    }

    worker = new Worker();
    worker.ready.catch((err) => showStartupError(err.message));
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());

  // Let the worker finish (for example a ledger commit in progress) before exiting.
  app.on('before-quit', (event) => {
    if (quitting || !worker) return;
    quitting = true;
    event.preventDefault();
    worker.stop().finally(() => app.quit());
  });
}
