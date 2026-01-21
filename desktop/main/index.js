const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, Menu, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { fork } = require('child_process');

// Wrap auto-updater in try-catch for Windows compatibility
let autoUpdater = null;
let electronLog = null;

try {
  const { autoUpdater: updater } = require('electron-updater');
  autoUpdater = updater;

  try {
    electronLog = require('electron-log');
    autoUpdater.logger = electronLog;
    autoUpdater.logger.transports.file.level = 'info';
  } catch (logErr) {
    console.log('[MAIN] electron-log not available, using console');
  }

  autoUpdater.autoDownload = true;  // Automatically download updates
  autoUpdater.autoInstallOnAppQuit = true;  // Install on app quit
} catch (err) {
  console.log('[MAIN] Auto-updater not available:', err.message);
}

// Initialize secure storage with unique name for BAM.ai
const store = new Store({
  encryptionKey: 'bam-ai-unique-secure-key-2024',
  name: 'bam-ai-config-v1'
});

let mainWindow;
let backendProcess = null;

// =====================================================
// AUTO-UPDATER CONFIGURATION
// =====================================================

function setupAutoUpdater() {
  if (!autoUpdater) {
    console.log('[UPDATER] Auto-updater not available, skipping setup');
    return;
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('[UPDATER] Checking for updates...');
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[UPDATER] Update available:', info.version);
    // Notify UI that update is downloading
    if (mainWindow) {
      mainWindow.webContents.send('update-status', {
        status: 'downloading',
        version: info.version,
        percent: 0
      });
    }
    // Auto-download is enabled, so download starts automatically
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[UPDATER] App is up to date');
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { status: 'up-to-date' });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    console.log(`[UPDATER] Download progress: ${percent}%`);
    if (mainWindow) {
      mainWindow.webContents.send('update-status', {
        status: 'downloading',
        percent: percent
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[UPDATER] Update downloaded:', info.version);
    console.log('[UPDATER] Update will be installed on next restart');
    if (mainWindow) {
      mainWindow.webContents.send('update-status', {
        status: 'ready',
        version: info.version
      });
    }
    // Auto-install on app quit is enabled, so it will install on next restart
    // Optionally show a subtle notification to let user know
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('show-toast', {
        type: 'success',
        message: `Update v${info.version} ready! It will install on restart.`
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[UPDATER] Error:', err.message);
    // Suppress expected errors silently
    if (err.message?.includes('ENOENT') ||
      err.message?.includes('no such file') ||
      err.message?.includes('No published versions') ||
      err.message?.includes('net::ERR') ||
      err.message?.includes('ENOTFOUND')) {
      console.log('[UPDATER] Suppressing expected error (offline or first run)');
      return;
    }
    // Only log unexpected errors, don't show dialogs
    console.error('[UPDATER] Unexpected error during update check');
  });
}

function checkForUpdates(isManual = false) {
  if (!autoUpdater) {
    console.log('[UPDATER] Auto-updater not available');
    if (isManual && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Updates Not Available',
        message: 'Auto-update is not available in development mode.',
        buttons: ['OK']
      });
    }
    return;
  }

  console.log('[UPDATER] Checking for updates... (manual:', isManual, ')');

  // For manual checks, add one-time handlers with dialog feedback
  if (isManual) {
    const onUpdateAvailable = (info) => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available!`,
        detail: 'The update is downloading in the background. You will be notified when it\'s ready.',
        buttons: ['OK']
      });
    };

    const onUpdateNotAvailable = () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No Updates',
        message: 'You are running the latest version!',
        detail: `Current version: ${app.getVersion()}`,
        buttons: ['OK']
      });
    };

    const onError = (err) => {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Could not check for updates.',
        detail: err.message || 'Please check your internet connection and try again.',
        buttons: ['OK']
      });
    };

    // Add one-time listeners for manual check feedback
    autoUpdater.once('update-available', onUpdateAvailable);
    autoUpdater.once('update-not-available', onUpdateNotAvailable);
    autoUpdater.once('error', onError);

    // Remove listeners after 30 seconds to avoid memory leaks
    setTimeout(() => {
      autoUpdater.removeListener('update-available', onUpdateAvailable);
      autoUpdater.removeListener('update-not-available', onUpdateNotAvailable);
      autoUpdater.removeListener('error', onError);
    }, 30000);
  }

  // Actually check for updates
  autoUpdater.checkForUpdates().catch(err => {
    console.error('[UPDATER] Check failed:', err.message);
    if (isManual && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Could not check for updates.',
        detail: err.message,
        buttons: ['OK']
      });
    }
  });
}

// =====================================================
// APPLICATION MENU
// =====================================================
function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates(true)
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
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
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates(true)
        },
        { type: 'separator' },
        {
          label: 'About BAM.ai',
          click: async () => {
            const { version } = require('../package.json');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About BAM.ai',
              message: 'BAM.ai',
              detail: `Version: ${version}\n\nAI-Powered Employee Knowledge Cloning Platform`,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// =====================================================
// BACKEND SERVER
// =====================================================
function startBackendServer() {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    let backendPath;

    if (app.isPackaged) {
      backendPath = path.join(process.resourcesPath, 'backend', 'src', 'server.js');
    } else {
      backendPath = path.join(__dirname, '..', '..', 'backend', 'src', 'server.js');
    }

    const backendDir = path.dirname(backendPath);
    console.log('[BACKEND] Platform:', process.platform);
    console.log('[BACKEND] App packaged:', app.isPackaged);
    console.log('[BACKEND] Electron path:', process.execPath);
    console.log('[BACKEND] Starting backend server from:', backendPath);
    console.log('[BACKEND] Working directory:', backendDir);

    // Check if backend file exists
    const fs = require('fs');
    if (!fs.existsSync(backendPath)) {
      const errMsg = `Backend file not found: ${backendPath}`;
      console.error('[BACKEND]', errMsg);
      dialog.showErrorBox('Backend Error', errMsg);
      reject(new Error(errMsg));
      return;
    }
    console.log('[BACKEND] Backend file exists: true');

    // Use spawn with ELECTRON_RUN_AS_NODE for packaged apps
    // This makes Electron run as a Node.js instance
    const { spawn } = require('child_process');

    try {
      const env = {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '3001'
      };

      // In packaged apps, use ELECTRON_RUN_AS_NODE to run Electron as Node
      if (app.isPackaged) {
        env.ELECTRON_RUN_AS_NODE = '1';
      }

      console.log('[BACKEND] Spawning with ELECTRON_RUN_AS_NODE:', env.ELECTRON_RUN_AS_NODE);

      backendProcess = spawn(process.execPath, [backendPath], {
        cwd: backendDir,
        env: env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let startupOutput = '';
      let hasError = false;

      backendProcess.stdout?.on('data', (data) => {
        const msg = data.toString();
        startupOutput += msg;
        console.log('[Backend]:', msg.trim());
      });

      backendProcess.stderr?.on('data', (data) => {
        const msg = data.toString();
        startupOutput += msg;
        console.error('[Backend Error]:', msg.trim());
        // Check for common errors
        if (msg.includes('Cannot find module') || msg.includes('ERR_MODULE_NOT_FOUND')) {
          hasError = true;
        }
      });

      backendProcess.on('error', (err) => {
        console.error('[BACKEND] Spawn error:', err);
        dialog.showErrorBox('Backend Failed to Start',
          `Could not start the backend server:\n\n${err.message}\n\nPath: ${backendPath}`
        );
        reject(err);
      });

      backendProcess.on('exit', (code, signal) => {
        console.log('[BACKEND] Process exited with code:', code, 'signal:', signal);
        if (code !== 0 && code !== null) {
          console.error('[BACKEND] Startup output:', startupOutput);
          if (!hasError) {
            dialog.showMessageBox({
              type: 'error',
              title: 'Backend Crashed',
              message: `Backend server exited with code: ${code}`,
              detail: startupOutput.slice(-500), // Last 500 chars
              buttons: ['OK']
            });
          }
        }
        backendProcess = null;
      });

      // Health check - actually verify the server is responding
      const checkBackendHealth = async (attempts = 0) => {
        const maxAttempts = 15; // More attempts for slower Windows startup
        const http = require('http');

        return new Promise((resolveHealth) => {
          const req = http.get('http://localhost:3001/api/system/health', (res) => {
            console.log('[BACKEND] Health check passed, status:', res.statusCode);
            resolveHealth(true);
          });

          req.on('error', (err) => {
            if (attempts < maxAttempts) {
              console.log(`[BACKEND] Health check attempt ${attempts + 1}/${maxAttempts} failed, retrying...`);
              setTimeout(() => {
                checkBackendHealth(attempts + 1).then(resolveHealth);
              }, 500);
            } else {
              console.error('[BACKEND] Health check failed after', maxAttempts, 'attempts');
              console.error('[BACKEND] Last error:', err.message);
              resolveHealth(false);
            }
          });

          req.setTimeout(2000, () => {
            req.destroy();
          });
        });
      };

      // Wait a bit then do health check
      setTimeout(async () => {
        const healthy = await checkBackendHealth();
        if (healthy) {
          console.log('[BACKEND] Server started successfully and responding');
          resolve();
        } else {
          console.error('[BACKEND] Server did not respond to health checks');
          console.error('[BACKEND] Startup output was:', startupOutput);
          // Only show warning if we don't see successful initialization
          const dbInitialized = startupOutput.includes('Database initialized successfully') ||
            startupOutput.includes('Database schema initialized');
          if (!dbInitialized) {
            // Show dialog with startup output for debugging
            dialog.showMessageBox({
              type: 'warning',
              title: 'Backend Warning',
              message: 'Backend server may not have started correctly',
              detail: `Features requiring the backend may not work.\n\nStartup output:\n${startupOutput.slice(-800)}`,
              buttons: ['OK']
            });
          } else {
            console.log('[BACKEND] DB initialized successfully - skipping warning dialog');
          }
          resolve(); // Still resolve so app continues
        }
      }, 2000); // Wait 2 seconds before first health check

    } catch (err) {
      console.error('[BACKEND] Exception during startup:', err);
      dialog.showErrorBox('Backend Error', `Failed to start backend:\n\n${err.message}`);
      reject(err);
    }
  });
}

function stopBackendServer() {
  if (backendProcess) {
    console.log('Stopping backend server...');
    backendProcess.kill();
    backendProcess = null;
  }
}

// =====================================================
// WINDOW CREATION
// =====================================================
function createWindow() {
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  const isMac = process.platform === 'darwin';

  const windowOptions = {
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload.js'),
      // IMPORTANT: webSecurity must be false for packaged apps
      // to allow fetch from file:// origin to https:// (Railway API)
      webSecurity: !app.isPackaged
    },
    backgroundColor: '#0a0a0f',
    show: true,
    title: 'BAM.ai'
  };

  if (isMac) {
    windowOptions.titleBarStyle = 'hiddenInset';
    windowOptions.trafficLightPosition = { x: 16, y: 16 };
  } else {
    windowOptions.frame = true;
    windowOptions.autoHideMenuBar = false; // Show menu on Windows for "Check for Updates"
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed!');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const currentUrl = mainWindow.webContents.getURL();
    console.log('[NAV] Page finished loading:', currentUrl);

    // Check if OAuth failed and redirected to login with error
    if (currentUrl.includes('login') && currentUrl.includes('error=')) {
      console.log('[NAV] *** OAUTH FAILED - Redirected to login with error ***');
      const urlObj = new URL(currentUrl);
      const error = urlObj.searchParams.get('error');
      console.log('[NAV] Error:', error);
      // Go back to local app's login page
      if (app.isPackaged) {
        const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
        mainWindow.loadFile(indexPath);
      } else {
        mainWindow.loadURL('http://localhost:3000');
      }
      return;
    }

    // Check if we landed on OAuth success page (fallback if other handlers didn't catch it)
    if (currentUrl.includes('/api/auth/success') && currentUrl.includes('token=')) {
      console.log('[NAV] *** CAUGHT OAUTH SUCCESS IN DID-FINISH-LOAD ***');

      const urlObj = new URL(currentUrl);
      const token = urlObj.searchParams.get('token');

      if (token) {
        console.log('[NAV] Token found, storing and reloading app');
        store.set('authToken', token);

        // Load local app
        const loadAndInjectToken = async () => {
          if (app.isPackaged) {
            const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
            await mainWindow.loadFile(indexPath);
          } else {
            await mainWindow.loadURL('http://localhost:3000');
          }

          // Wait for new page to load, then inject token
          mainWindow.webContents.once('did-finish-load', () => {
            const newUrl = mainWindow.webContents.getURL();
            // Only inject if we're no longer on the success page
            if (!newUrl.includes('/api/auth/success')) {
              mainWindow.webContents.executeJavaScript(`
                localStorage.setItem('bam_token', '${token}');
                localStorage.setItem('token', '${token}');
                console.log('[OAuth] Token injected from Electron, reloading...');
                window.location.reload();
              `);
            }
          });
        };

        loadAndInjectToken();
      }
    }
  });

  // Handle OAuth: catch server redirects and page navigation
  // Try multiple events to ensure we catch the success page

  // 1. will-redirect: fires when server sends 302 redirect
  mainWindow.webContents.on('will-redirect', (event, url) => {
    console.log('[NAV] Will redirect to:', url);

    if (url.includes('/api/auth/success') && url.includes('token=')) {
      console.log('[NAV] *** INTERCEPTING AUTH SUCCESS REDIRECT ***');
      event.preventDefault();

      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');

      if (token) {
        console.log('[NAV] Token extracted:', token.substring(0, 20) + '...');
        store.set('authToken', token);

        // Load local app and inject token
        setTimeout(async () => {
          if (app.isPackaged) {
            const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
            await mainWindow.loadFile(indexPath);
          } else {
            await mainWindow.loadURL('http://localhost:3000');
          }

          mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.executeJavaScript(`
              localStorage.setItem('bam_token', '${token}');
              localStorage.setItem('token', '${token}');
              console.log('[OAuth] Token injected from Electron');
              window.location.reload();
            `);
          });
        }, 100);
      }
      return;
    }
  });

  // 2. did-navigate: fires after navigation completes
  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('[NAV] Did navigate to:', url);

    if (url.includes('/api/auth/success') && url.includes('token=')) {
      console.log('[NAV] *** LANDED ON AUTH SUCCESS PAGE ***');

      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');

      if (token) {
        console.log('[NAV] Token found, injecting into app');
        store.set('authToken', token);

        // Load local app and inject token
        const loadAndInjectToken = async () => {
          if (app.isPackaged) {
            const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
            await mainWindow.loadFile(indexPath);
          } else {
            await mainWindow.loadURL('http://localhost:3000');
          }

          mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.executeJavaScript(`
              localStorage.setItem('bam_token', '${token}');
              localStorage.setItem('token', '${token}');
              console.log('[OAuth] Token injected, reloading for auth...');
              window.location.reload();
            `);
          });
        };

        loadAndInjectToken();
      }
    }
  });

  // Handle OAuth redirects: intercept navigation to Railway paths 
  // Extract token from URL if present and store in Electron store
  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log('[NAV] Will navigate to:', url);

    // Check if this is the auth success page with token
    if (url.includes('/api/auth/success') && url.includes('token=')) {
      console.log('[NAV] Intercepting auth success with token');
      event.preventDefault();

      // Extract token from URL
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');

      if (token) {
        console.log('[NAV] Storing token in Electron store');
        store.set('authToken', token);

        // Inject token into localStorage when app reloads
        // We'll do this via executeJavaScript after loading
        const loadAndInjectToken = async () => {
          if (app.isPackaged) {
            const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
            await mainWindow.loadFile(indexPath);
          } else {
            await mainWindow.loadURL('http://localhost:3000');
          }

          // Inject token into localStorage
          mainWindow.webContents.executeJavaScript(`
            localStorage.setItem('bam_token', '${token}');
            localStorage.setItem('token', '${token}');
            console.log('[OAuth] Token injected from Electron');
            // Trigger app to re-check auth
            window.location.reload();
          `);
        };

        loadAndInjectToken();
        return;
      }
    }

    // Also intercept /dashboard redirect from Railway (fallback)
    if (url.includes('railway.app/dashboard') || url.includes('railway.app/login')) {
      console.log('[NAV] Intercepting Railway redirect, reloading local app');
      event.preventDefault();

      // Reload the local React app
      if (app.isPackaged) {
        const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
        mainWindow.loadFile(indexPath);
      } else {
        mainWindow.loadURL('http://localhost:3000');
      }
    }
  });

  if (app.isPackaged) {
    const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
    console.log('Loading packaged app from:', indexPath);
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
      console.log('[LOAD] index.html exists, loading...');
      mainWindow.loadFile(indexPath).then(() => {
        console.log('[LOAD] loadFile completed successfully');
      }).catch(err => {
        console.error('[LOAD] loadFile error:', err);
        dialog.showErrorBox('Load Error', `Failed to load app: ${err.message}\n\nPath: ${indexPath}`);
      });
    } else {
      console.error('[LOAD] index.html NOT FOUND at:', indexPath);
      // List what's actually in the app directory
      const appPath = app.getAppPath();
      console.log('[LOAD] App path:', appPath);
      try {
        const contents = fs.readdirSync(appPath);
        console.log('[LOAD] App directory contents:', contents);
        const rendererPath = path.join(appPath, 'renderer');
        if (fs.existsSync(rendererPath)) {
          const rendererContents = fs.readdirSync(rendererPath);
          console.log('[LOAD] Renderer contents:', rendererContents);
        }
      } catch (e) {
        console.error('[LOAD] Error listing directory:', e);
      }
      dialog.showErrorBox('App Not Found', `Could not find the application files.\n\nExpected: ${indexPath}`);
    }
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '..', 'renderer', 'build', 'index.html');
    console.log('Loading from:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// =====================================================
// APP LIFECYCLE
// =====================================================
app.whenReady().then(() => {
  console.log('App ready, starting services...');

  // Setup auto-updater (won't crash if unavailable)
  setupAutoUpdater();

  // Create application menu
  createMenu();

  // Register IPC handlers FIRST
  require('./ipc-handlers')(ipcMain, null, store, desktopCapturer);

  // Create window IMMEDIATELY so app is visible (don't wait for backend)
  createWindow();
  console.log('Window created');

  require('./ipc-handlers').updateMainWindow?.(mainWindow);

  // Start backend server in background AFTER window is visible
  // This prevents Windows "Not Responding" freeze
  setImmediate(() => {
    startBackendServer().catch(err => {
      console.error('Backend failed to start:', err);
    });
  });

  // Check for updates on startup (optional - silent check)
  if (app.isPackaged && autoUpdater) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.log('[UPDATER] Startup check failed:', err.message);
      });
    }, 5000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackendServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
});
