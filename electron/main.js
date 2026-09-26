const { app, BrowserWindow, ipcMain, dialog, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow;

// Extract PDF files passed from CLI
function getCliPdfFiles() {
  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  const pdfFiles = [];
  for (const arg of args) {
    if (!arg.startsWith('-') && fs.existsSync(arg) && arg.toLowerCase().endsWith('.pdf')) {
      try {
        const absPath = path.resolve(arg);
        pdfFiles.push({
          name: path.basename(absPath),
          path: absPath,
          data: fs.readFileSync(absPath).buffer,
        });
      } catch (e) {
        console.error('Failed to read CLI argument PDF:', arg, e);
      }
    }
  }
  return pdfFiles;
}

function createWindow() {
  const isWin = process.platform === 'win32';
  const isLinux = process.platform === 'linux';
  const iconPath = path.join(__dirname, '../build/icon.png');

  const windowOptions = {
    width: 1280,
    height: 850,
    minWidth: 640,
    minHeight: 480,
    title: 'GenPDF Studio',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: isWin ? '#00000000' : '#242424', // transparent for Mica on Windows, dark GTK on Linux
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

  // Load Vite dev server if responsive, otherwise load built dist/index.html
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const distPath = path.join(__dirname, '../dist/index.html');

  const req = http.get(devUrl, (res) => {
    mainWindow.loadURL(devUrl);
  });
  req.on('error', () => {
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    } else {
      mainWindow.loadURL(devUrl).catch((err) => {
        console.warn('Vite dev server not found and dist/index.html does not exist yet. Run npm run build or npm run dev.');
      });
    }
  });
  req.setTimeout(350, () => {
    req.destroy();
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    }
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

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Return initial files opened via CLI
ipcMain.handle('app:getInitialFiles', () => {
  return getCliPdfFiles();
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
        return '#' + color.slice(0, 6);
      }
    } catch (e) {
      // ignore
    }
  } else if (process.platform === 'linux') {
    // Check GNOME accent color if configured
    try {
      const { execSync } = require('child_process');
      const accent = execSync('gsettings get org.gnome.desktop.interface accent-color 2>/dev/null', { timeout: 300 })
        .toString()
        .trim()
        .replace(/'/g, '');
      const gnomeColors = {
        blue: '#3584e4',
        teal: '#2190a4',
        green: '#3a944a',
        yellow: '#c88800',
        orange: '#ed5b00',
        red: '#e62d42',
        pink: '#d56199',
        purple: '#9141ac',
        slate: '#6f8396',
      };
      if (gnomeColors[accent]) return gnomeColors[accent];
    } catch (e) {
      // ignore
    }
    return '#3584e4'; // Adwaita Blue default
  }
  return null;
});
