/**
 * @name         Port Pilot
 * @license      BSL 1.1 — See LICENSE.md
 * @description  Preload script — exposes IPC bridge to the renderer process.
 * @author       Cloud Nimbus LLC
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getPorts: () => ipcRenderer.invoke('get-ports'),
  killProcess: (pid) => ipcRenderer.invoke('kill-process', pid),
  openBrowser: (port) => ipcRenderer.invoke('open-browser', port),

  getNote: (port, pid) => ipcRenderer.invoke('get-note', { port, pid }),
  setNote: (port, pid, text) => ipcRenderer.invoke('set-note', { port, pid, text }),

  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),

  getPinned: () => ipcRenderer.invoke('get-pinned'),
  togglePin: (port) => ipcRenderer.invoke('toggle-pin', port),

  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
});
