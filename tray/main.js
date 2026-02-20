// Load .env file before any other requires that use process.env
const fs = require('fs');
const envPath = require('path').join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const config = require('./config');
const api = require('./api');
const { createTray, updateTray, destroyTray } = require('./tray');
const { startPolling, stopPolling } = require('./poller');
const { notify } = require('./notifier');
const workerManager = require('./worker-manager');

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let popupWindow = null;
let loginWindow = null;

function createPopupWindow(trayBounds) {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.show();
    popupWindow.focus();
    return popupWindow;
  }

  const width = 380;
  const height = 560;

  // Position near tray icon (bottom-right on Windows)
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - width / 2);
  let y = Math.round(trayBounds.y - height - 4);

  // Clamp to screen bounds so the popup never goes off-screen
  const { screen } = require('electron');
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const workArea = display.workArea;
  if (x < workArea.x) x = workArea.x;
  if (x + width > workArea.x + workArea.width) x = workArea.x + workArea.width - width;
  if (y < workArea.y) y = workArea.y;
  if (y + height > workArea.y + workArea.height) y = workArea.y + workArea.height - height;

  popupWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    transparent: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  popupWindow.loadFile(path.join(__dirname, 'popup.html'));

  popupWindow.once('ready-to-show', () => {
    popupWindow.show();
  });

  popupWindow.on('blur', () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.hide();
    }
  });

  popupWindow.on('closed', () => {
    popupWindow = null;
  });

  return popupWindow;
}

function showLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return;
  }

  loginWindow = new BrowserWindow({
    width: 400,
    height: 360,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: '3Dify — Login',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  loginWindow.setMenuBarVisibility(false);
  loginWindow.loadFile(path.join(__dirname, 'login.html'));

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

// --- IPC Handlers ---

ipcMain.handle('pause-worker', async () => {
  try {
    await api.pauseWorker();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('resume-worker', async () => {
  try {
    await api.resumeWorker();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('start-local-worker', () => {
  return workerManager.start();
});

ipcMain.handle('stop-local-worker', () => {
  return workerManager.stop();
});

ipcMain.handle('get-local-worker-status', () => {
  return {
    running: workerManager.isRunning(),
    output: workerManager.getOutput(),
  };
});

function safeOpenExternal(url) {
  if (/^https?:\/\//i.test(url)) {
    shell.openExternal(url);
  }
}

ipcMain.handle('open-admin', () => {
  safeOpenExternal(`${config.getServerUrl()}/admin`);
});

ipcMain.handle('open-site', () => {
  safeOpenExternal(config.getServerUrl());
});

ipcMain.handle('login', async (_e, serverUrl, username, password) => {
  try {
    if (serverUrl) config.setServerUrl(serverUrl);
    await api.login(username, password);
    // Close login window
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.close();
    }
    // Start polling now that we're authenticated
    startPolling(onStateChange, onAuthRequired);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('get-server-url', () => {
  return config.getServerUrl();
});

// --- State management ---

let lastState = null;

function sanitizeStateForRenderer(state) {
  // Strip internal/raw fields — only send normalized data to renderer
  const { _rawDashboard, _rawGpu, _rawJobs, ...safe } = state;
  return safe;
}

function onStateChange(state) {
  // Attach local worker status to state
  state.localWorkerRunning = workerManager.isRunning();
  lastState = state;

  // Update tray icon & tooltip
  updateTray(state);

  // Forward sanitized state to popup if open
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('state-update', sanitizeStateForRenderer(state));
  }
}

// Called by poller when auth fails
function onAuthRequired() {
  stopPolling();
  showLoginWindow();
}

// Called by tray on left-click
function onTrayClick(bounds) {
  if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) {
    popupWindow.hide();
    return;
  }
  const win = createPopupWindow(bounds);
  // Send current state immediately
  if (lastState) {
    const safe = sanitizeStateForRenderer(lastState);
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('state-update', safe);
    });
    // Also send if already loaded
    if (win.webContents.isLoading() === false) {
      win.webContents.send('state-update', safe);
    }
  }
}

// Called by tray context menu
async function onMenuAction(action) {
  switch (action) {
    case 'pause':
      await api.pauseWorker().catch(() => {});
      break;
    case 'resume':
      await api.resumeWorker().catch(() => {});
      break;
    case 'open-admin':
      safeOpenExternal(`${config.getServerUrl()}/admin`);
      break;
    case 'open-site':
      safeOpenExternal(config.getServerUrl());
      break;
    case 'start-worker':
      workerManager.start();
      break;
    case 'stop-worker':
      workerManager.stop();
      break;
    case 'quit':
      app.quit();
      break;
  }
}

// --- App lifecycle ---

app.on('second-instance', () => {
  // If user tries to open a second instance, show popup
  if (lastState) {
    notify('3Dify Monitor', '3Dify tray monitor is already running.');
  }
});

app.whenReady().then(() => {
  config.load();

  // Kill any orphaned worker processes from previous sessions
  workerManager.killOrphans();

  // Create tray icon
  createTray(onTrayClick, onMenuAction);

  // Check if we have a token
  if (config.getToken()) {
    startPolling(onStateChange, onAuthRequired);
  } else {
    showLoginWindow();
  }
});

app.on('window-all-closed', (e) => {
  // Don't quit when windows close — we're a tray app
  e.preventDefault?.();
});

app.on('before-quit', () => {
  workerManager.forceStop();
  stopPolling();
  destroyTray();
});
