import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import os from 'os';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'APEX NOVA — Autonomous Incident Operations',
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL(devUrl).catch(() => {
      // Fallback to loading file if dev server is not ready
      const distIndex = path.join(__dirname, '../dist/index.html');
      mainWindow?.loadFile(distIndex);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers - Safe, typed, no arbitrary execution
ipcMain.handle('app:version', () => {
  return app.getVersion();
});

ipcMain.handle('system:info', () => {
  return {
    platform: os.platform(),
    arch: os.arch(),
    totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
    freeMemoryMb: Math.round(os.freemem() / (1024 * 1024))
  };
});

ipcMain.on('app:log', (_event, message: string) => {
  console.log(`[Desktop-Renderer] ${message}`);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

