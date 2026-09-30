'use strict';
/**
 * The UI's whole view of the desktop app (window.ciphertrace). Runs sandboxed,
 * with context isolation: the page gets these functions and nothing else.
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('ciphertrace', {
  /** Calls a worker method. Resolves to {ok: true, result} or {ok: false, status, detail}. */
  call: (method, params) => ipcRenderer.invoke('ct:call', method, params ?? {}),

  /** Shows a save dialog, then has the worker write the file there. {ok: true, canceled: true} if dismissed. */
  saveAs: (method, params, suggestedName) => ipcRenderer.invoke('ct:saveAs', method, params ?? {}, suggestedName),

  /** Where a picked or dropped File is on disk, so the worker can read it directly. */
  pathOf: (file) => webUtils.getPathForFile(file),

  /** The ledger peer address settings: {saved, peers, defaults}. */
  getLedgerConnection: () => ipcRenderer.invoke('ct:getLedgerConnection'),

  /** Saves {host, port} (port may be null), or null for the defaults. Restarts the worker. */
  setLedgerConnection: (value) => ipcRenderer.invoke('ct:setLedgerConnection', value ?? null)
});
