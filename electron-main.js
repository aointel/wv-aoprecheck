const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const isDev = require('electron-is-dev');

// Enable live reload for Electron in development
if (isDev) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

let mainWindow;

// Configure auto-updater
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://aoirail-production-baa2.up.railway.app/downloads/updates'
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
});

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message);
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
  
  // Auto-restart after download
  setTimeout(() => {
    autoUpdater.quitAndInstall(true, true);
  }, 3000);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#f9fafb',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'electron-preload.js'),
      webSecurity: true
    },
    titleBarStyle: 'default',
    show: false
  });

  // Stamp UA so the server can unambiguously identify Electron requests
  mainWindow.webContents.setUserAgent(
    mainWindow.webContents.getUserAgent() + ' AOIElectron/1'
  );

  // Load the web app
  const serverUrl = isDev ? 'http://localhost:5000' : 'https://aoirail-production-baa2.up.railway.app';

  mainWindow.loadURL(serverUrl).then(() => {
    console.log('AO Intelligence loaded successfully');
    mainWindow.show();
    // In dev: open DevTools so you can see Console (errors), Network (what GET / returned), and router state
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
    // Production: use Ctrl+Shift+I or F12 to open DevTools if you need to debug
    mainWindow.webContents.on('did-finish-load', () => {
      const url = mainWindow.webContents.getURL();
      console.log('Page finished loading:', url);
    });
    // Check for updates after the app loads
    if (!isDev) {
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify();
      }, 3000);
    }
  }).catch((error) => {
    console.error('Failed to load AO Intelligence:', error);
    
    // Show error dialog and retry
    dialog.showErrorBox('Connection Error', 
      `Unable to connect to AO Intelligence.\nPlease check your internet connection and try again.\n\nError: ${error.message}`
    );
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const serverDomain = isDev ? 'localhost:5000' : 'aoirail-production-baa2.up.railway.app';
    
    if (!navigationUrl.includes(serverDomain)) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // Window event handlers
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle('AO Intelligence Desktop');
  });
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// IPC handlers for app functionality
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', () => {
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
  return { success: true };
});

ipcMain.handle('quit-and-install', () => {
  autoUpdater.quitAndInstall(true, true);
});

ipcMain.handle('open-firewall-settings', () => {
  // Open Windows Firewall "Allow an app" dialog so agent can whitelist AO Intelligence
  const { exec } = require('child_process');
  exec('control firewall.cpl', (err) => {
    if (err) {
      shell.openExternal('ms-settings:windowsdefender').catch(() => {});
    }
  });
  return { success: true };
});

// Set up application menu
const template = [
  {
    label: 'AO Intelligence',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { 
        label: 'Check for Updates...',
        click: () => {
          if (!isDev) {
            autoUpdater.checkForUpdatesAndNotify();
          }
        }
      },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectall' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forcereload' },
      { role: 'toggledevtools' },
      { type: 'separator' },
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' }
    ]
  }
];

if (process.platform === 'darwin') {
  template[0].submenu.unshift({ role: 'about' });
  template[3].submenu.push(
    { type: 'separator' },
    { role: 'front' }
  );
}

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.includes('aoirail-production-baa2.up.railway.app')) {
    // Ignore certificate errors for our domain in production
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});