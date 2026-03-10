/**
 * @name         Port Pilot
 * @license      BSL 1.1 — See LICENSE.md
 * @description  Electron main process — visual localhost port manager for Windows.
 * @author       Cloud Nimbus LLC
 */
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const Store = require('electron-store');

const store = new Store({
  defaults: {
    settings: {
      refreshInterval: 3,       // seconds
      startMinimized: false,
      showEstablished: false,    // show ESTABLISHED connections too (not just LISTENING)
      pinnedPorts: [],           // ports the user wants highlighted
    },
    notes: {},  // { "port:pid": "My API server" }
  },
});

let mainWindow = null;
let tray = null;

// --- Icon ---

function createTrayIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const isBorder = x === 0 || x === size - 1 || y === 0 || y === size - 1;
      canvas[i]     = isBorder ? 30  : 59;   // R
      canvas[i + 1] = isBorder ? 120 : 130;  // G
      canvas[i + 2] = isBorder ? 220 : 246;  // B
      canvas[i + 3] = 255;
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

// --- Window ---

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: createTrayIcon(),
    title: 'Port Pilot',
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// --- Tray ---

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Port Pilot');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Port Pilot', click: () => createWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => createWindow());
}

// --- PowerShell ---

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${command.replace(/"/g, '\\"')}"`;
    exec(psCmd, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

// --- Port scanning ---

const KNOWN_PORTS = {
  80: 'HTTP',
  443: 'HTTPS',
  3000: 'React / Express',
  3001: 'React (alt)',
  4200: 'Angular',
  5000: 'Flask / ASP.NET',
  5173: 'Vite',
  5174: 'Vite (alt)',
  5432: 'PostgreSQL',
  5500: 'Live Server',
  8000: 'Django / FastAPI',
  8080: 'HTTP Proxy / Tomcat',
  8443: 'HTTPS (alt)',
  8888: 'Jupyter',
  9000: 'PHP-FPM / SonarQube',
  9229: 'Node Inspector',
  27017: 'MongoDB',
  6379: 'Redis',
  3306: 'MySQL',
  1433: 'SQL Server',
  5672: 'RabbitMQ',
  15672: 'RabbitMQ Management',
  2181: 'Zookeeper',
  9092: 'Kafka',
  4000: 'Phoenix / GraphQL',
  19006: 'Expo',
};

async function getListeningPorts(includeEstablished) {
  const states = includeEstablished ? "'Listen','Established'" : "'Listen'";
  const cmd = `Get-NetTCPConnection -State ${states} -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess | ConvertTo-Json -Compress`;

  try {
    const raw = await runPowerShell(cmd);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const connections = Array.isArray(parsed) ? parsed : [parsed];

    // Get process info for all unique PIDs
    const pids = [...new Set(connections.map(c => c.OwningProcess))];
    const processMap = await getProcessInfo(pids);

    return connections.map(c => ({
      localAddress: c.LocalAddress,
      port: c.LocalPort,
      remoteAddress: c.RemoteAddress,
      remotePort: c.RemotePort,
      state: c.State === 2 ? 'Listen' : c.State === 5 ? 'Established' : String(c.State),
      pid: c.OwningProcess,
      processName: processMap[c.OwningProcess]?.name || 'Unknown',
      processPath: processMap[c.OwningProcess]?.path || '',
      hint: KNOWN_PORTS[c.LocalPort] || '',
    }));
  } catch (e) {
    console.error('Port scan error:', e.message);
    return [];
  }
}

async function getProcessInfo(pids) {
  if (pids.length === 0) return {};
  const pidFilter = pids.join(',');
  const cmd = `Get-Process -Id ${pidFilter} -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path | ConvertTo-Json -Compress`;

  try {
    const raw = await runPowerShell(cmd);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const procs = Array.isArray(parsed) ? parsed : [parsed];
    const map = {};
    for (const p of procs) {
      map[p.Id] = { name: p.ProcessName, path: p.Path || '' };
    }
    return map;
  } catch (e) {
    return {};
  }
}

async function killProcess(pid) {
  try {
    await runPowerShell(`Stop-Process -Id ${pid} -Force -ErrorAction Stop`);
    return { status: 'ok', pid };
  } catch (e) {
    return { status: 'error', pid, message: e.message };
  }
}

async function openInBrowser(port) {
  try {
    exec(`start http://localhost:${port}`, { shell: true });
    return { status: 'ok' };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

// --- Notes ---

function getNote(port, pid) {
  const notes = store.get('notes', {});
  return notes[`${port}:${pid}`] || notes[`${port}`] || '';
}

function setNote(port, pid, text) {
  const notes = store.get('notes', {});
  if (text) {
    notes[`${port}:${pid}`] = text;
  } else {
    delete notes[`${port}:${pid}`];
    delete notes[`${port}`];
  }
  store.set('notes', notes);
  return { status: 'ok' };
}

// --- IPC Handlers ---

ipcMain.handle('get-ports', async () => {
  const settings = store.get('settings');
  return await getListeningPorts(settings.showEstablished);
});

ipcMain.handle('kill-process', (_, pid) => killProcess(pid));
ipcMain.handle('open-browser', (_, port) => openInBrowser(port));

ipcMain.handle('get-note', (_, { port, pid }) => getNote(port, pid));
ipcMain.handle('set-note', (_, { port, pid, text }) => setNote(port, pid, text));

ipcMain.handle('get-settings', () => store.get('settings'));
ipcMain.handle('save-settings', (_, settings) => {
  store.set('settings', settings);
  return { status: 'ok' };
});

ipcMain.handle('get-pinned', () => store.get('settings.pinnedPorts', []));
ipcMain.handle('toggle-pin', (_, port) => {
  const settings = store.get('settings');
  const pinned = settings.pinnedPorts || [];
  if (pinned.includes(port)) {
    settings.pinnedPorts = pinned.filter(p => p !== port);
  } else {
    settings.pinnedPorts = [...pinned, port];
  }
  store.set('settings', settings);
  return { status: 'ok', pinned: settings.pinnedPorts };
});

ipcMain.handle('copy-to-clipboard', (_, text) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
  return { status: 'ok' };
});

// --- App lifecycle ---

app.whenReady().then(() => {
  createTray();

  const settings = store.get('settings');
  if (!settings.startMinimized) {
    createWindow();
  }
});

app.on('window-all-closed', () => { /* keep running in tray */ });
app.on('activate', () => createWindow());
app.on('before-quit', () => { app.isQuitting = true; });
