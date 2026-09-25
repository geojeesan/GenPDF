const { app, BrowserWindow, ipcMain, dialog, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  const isWin = process.platform === 'win32';
  const isLinux = process.platform === 'linux';

  const windowOptions = {
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: 'GenPDF',
    backgroundColor: '#00000000', // transparent for Mica on Windows
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // allow loading local blob/file streams
    },
    frame: false, // Custom Fluent / GTK titlebar
    titleBarStyle: 'hidden',
  };

  if (isWin) {
    // Windows 11 Mica backdrop effect
    windowOptions.backgroundMaterial = 'mica';
  }

  mainWindow = new BrowserWindow(windowOptions);

  if (isWin && typeof mainWindow.setBackgroundMaterial === 'function') {
    try {
      mainWindow.setBackgroundMaterial('mica');
    } catch (e) {
      // ignored if not supported
    }
  }

  // Check if Vite dev server is running or load dist
  const devUrl = 'http://localhost:5173';
  mainWindow.loadURL(devUrl).catch(() => {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-change', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Dialog Handlers
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open PDF Document',
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    properties: ['openFile', 'multiSelections'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  return result.filePaths.map((fp) => ({
    name: path.basename(fp),
    path: fp,
    data: fs.readFileSync(fp).buffer,
  }));
});

ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save PDF Document',
    defaultPath: defaultName || 'document.pdf',
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });

  return result.canceled ? null : result.filePath;
});

ipcMain.handle('fs:writeFile', async (event, filePath, buffer) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return { success: true, data: buffer.buffer, name: path.basename(filePath) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('system:getAccentColor', () => {
  if (process.platform === 'win32' && systemPreferences && typeof systemPreferences.getAccentColor === 'function') {
    try {
      const color = systemPreferences.getAccentColor();
      if (color) {
        // Return 6-digit hex color
        return '#' + color.slice(0, 6);
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
});
