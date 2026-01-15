const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, Menu, dialog, session } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { fork } = require('child_process');
const { autoUpdater } = require('electron-updater');

// Initialize secure storage with unique name for BAM.ai
const store = new Store({
  encryptionKey: 'bam-ai-unique-secure-key-2024',
  name: 'bam-ai-config-v1'
});

let mainWindow;
let backendProcess = null;

// Register custom protocol for OAuth callback
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('bam-auth', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('bam-auth');
}

// Handle the protocol. This is for macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('[OAUTH] Received protocol URL:', url);
  handleOAuthCallback(url);
});

function handleOAuthCallback(url) {
  console.log('[OAUTH] Handling callback URL:', url);

  try {
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');

    if (token) {
      console.log('[OAUTH] Token received, storing...');
      store.set('authToken', token);

      // Reload the main window to dashboard
      if (mainWindow) {
        if (app.isPackaged) {
          const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
          mainWindow.loadFile(indexPath).then(() => {
            mainWindow.webContents.executeJavaScript(`
              localStorage.setItem('bam_token', '${token}');
              localStorage.setItem('token', '${token}');
              window.location.hash = '#/dashboard';
              window.location.reload();
            `);
          });
        } else {
          mainWindow.loadURL('http://localhost:3000/#/dashboard');
        }
      }
    }
  } catch (error) {
    console.error('[OAUTH] Error handling callback:', error);
  }
}

// Setup OAuth response interceptor
function setupOAuthInterceptor() {
  const filter = {
    urls: ['*://bam-production-c677.up.railway.app/api/auth/google/callback*']
  };

  session.defaultSession.webRequest.onCompleted(filter, async (details) => {
    console.log('[OAUTH INTERCEPTOR] Callback completed:', details.url);

    // After the callback page loads, extract the token from meta tags
    if (mainWindow && details.statusCode === 200) {
      // Wait a moment for the page to render
      setTimeout(async () => {
        try {
          const result = await mainWindow.webContents.executeJavaScript(`
            (function() {
              const tokenMeta = document.querySelector('meta[name="bam-token"]');
              const userMeta = document.querySelector('meta[name="bam-user"]');
              return {
                token: tokenMeta ? tokenMeta.content : null,
                user: userMeta ? userMeta.content : null
              };
            })()
          `);

          console.log('[OAUTH INTERCEPTOR] Extracted:', result.token ? 'token found' : 'no token');

          if (result.token) {
            // Store the token
            store.set('authToken', result.token);

            if (result.user) {
              try {
                const user = JSON.parse(result.user.replace(/&apos;/g, "'"));
                store.set('currentUser', user);
              } catch (e) {
                console.error('[OAUTH INTERCEPTOR] Failed to parse user:', e);
              }
            }

            // Navigate back to local app
            if (app.isPackaged) {
              const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
              await mainWindow.loadFile(indexPath);

              // Inject the token into local localStorage and navigate to dashboard
              await mainWindow.webContents.executeJavaScript(`
                localStorage.setItem('bam_token', '${result.token}');
                localStorage.setItem('token', '${result.token}');
                window.location.hash = '/dashboard';
              `);

              console.log('[OAUTH INTERCEPTOR] Successfully returned to local app with token');
            } else {
              mainWindow.loadURL('http://localhost:3000/#/dashboard');
            }
          }
        } catch (err) {
          console.error('[OAUTH INTERCEPTOR] Error extracting token:', err);
        }
      }, 1500); // Wait 1.5 seconds for page to fully render
    }
  });

  console.log('[OAUTH] Interceptor setup complete');
}

// =====================================================
// AUTO-UPDATER CONFIGURATION
// =====================================================
autoUpdater.autoDownload = false; // Manual download after user confirms
autoUpdater.autoInstallOnAppQuit = true;

// Logging for debugging
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    console.log('[UPDATER] Checking for updates...');
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[UPDATER] Update available:', info.version);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: 'Would you like to download and install it now?',
      buttons: ['Download Now', 'Later'],
      defaultId: 0
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[UPDATER] No updates available');
    // Just log - no popup needed when already on latest version
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[UPDATER] Download progress: ${Math.round(progress.percent)}%`);
    if (mainWindow) {
      mainWindow.webContents.send('update-status', {
        status: 'downloading',
        percent: Math.round(progress.percent)
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[UPDATER] Update downloaded:', info.version);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: 'The app will restart to install the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[UPDATER] Error:', err);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates',
      detail: err.message,
      buttons: ['OK']
    });
  });
}

function checkForUpdates() {
  autoUpdater.checkForUpdates();
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
          click: () => checkForUpdates()
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
          click: () => checkForUpdates()
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
      // Disable webSecurity in packaged app to allow HTTPS requests to Railway
      // This is required because file:// origin can't make requests to https:// otherwise
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
    console.log('Page finished loading');
  });

  // Intercept OAuth callback navigation to extract token and return to local app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log('[OAUTH] Navigating to:', url);

    // Check if this is the bam-auth:// protocol callback
    if (url.startsWith('bam-auth://')) {
      console.log('[OAUTH] Intercepting bam-auth:// protocol');
      event.preventDefault();
      handleOAuthCallback(url);
      return;
    }

    // Check if this is an OAuth callback from Railway
    if (url.includes('/api/auth/google/callback') && url.includes('code=')) {
      console.log('[OAUTH] Detected OAuth callback, will fetch token...');
      // Let it proceed - the callback will handle token generation
    }

    // Check if this is the success redirect with token
    if (url.includes('/auth/success') && url.includes('token=')) {
      console.log('[OAUTH] Intercepting auth success URL with token');
      event.preventDefault();

      try {
        const urlObj = new URL(url);
        const token = urlObj.searchParams.get('token');
        const encodedUser = urlObj.searchParams.get('user');

        if (token) {
          console.log('[OAUTH] Token extracted from URL');
          store.set('authToken', token);

          if (encodedUser) {
            try {
              const user = JSON.parse(decodeURIComponent(encodedUser));
              store.set('currentUser', user);
              console.log('[OAUTH] User stored:', user.email);
            } catch (e) {
              console.error('[OAUTH] Failed to parse user:', e);
            }
          }

          // Navigate back to local app with token
          if (app.isPackaged) {
            const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
            mainWindow.loadFile(indexPath).then(() => {
              mainWindow.webContents.executeJavaScript(`
                localStorage.setItem('bam_token', '${token}');
                localStorage.setItem('token', '${token}');
                window.location.hash = '/dashboard';
              `);
            });
          } else {
            mainWindow.loadURL('http://localhost:3000/#/dashboard');
          }
        }
      } catch (err) {
        console.error('[OAUTH] Error extracting token from URL:', err);
      }
      return;
    }

    // Check if trying to navigate to /dashboard on Railway (wrong domain)
    if (url.includes('bam-production') && url.includes('/dashboard')) {
      console.log('[OAUTH] Intercepting Railway dashboard redirect - returning to local app');
      event.preventDefault();

      // Reload the local app
      if (app.isPackaged) {
        const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
        mainWindow.loadFile(indexPath, { hash: 'dashboard' });
      } else {
        mainWindow.loadURL('http://localhost:3000/#/dashboard');
      }
    }
  });

  // Also intercept did-navigate to handle post-OAuth state
  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('[OAUTH] Did navigate to:', url);

    // If we're on Railway after OAuth, extract token from page and return home
    if (url.includes('bam-production') && !url.includes('/api/auth/google')) {
      console.log('[OAUTH] On Railway post-OAuth, attempting to extract token...');

      // Execute script to get token from localStorage and send back
      mainWindow.webContents.executeJavaScript(`
        (function() {
          const token = localStorage.getItem('bam_token');
          const user = localStorage.getItem('bam_user');
          return { token, user };
        })()
      `).then(async (result) => {
        console.log('[OAUTH] Extracted from Railway localStorage:', result.token ? 'token found' : 'no token');

        if (result.token) {
          // Store in electron-store
          store.set('authToken', result.token);
          if (result.user) {
            try {
              const user = JSON.parse(result.user);
              store.set('currentUser', user);
            } catch (e) {
              console.error('[OAUTH] Failed to parse user:', e);
            }
          }

          // Now navigate back to local app
          if (app.isPackaged) {
            const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
            await mainWindow.loadFile(indexPath);

            // Inject the token into local localStorage
            await mainWindow.webContents.executeJavaScript(`
              localStorage.setItem('bam_token', '${result.token}');
              localStorage.setItem('token', '${result.token}');
              ${result.user ? `localStorage.setItem('bam_user', '${result.user.replace(/'/g, "\\'")}');` : ''}
              window.location.hash = '#/dashboard';
              window.location.reload();
            `);
          }
        }
      }).catch(err => {
        console.error('[OAUTH] Failed to extract token:', err);
      });
    }
  });

  if (app.isPackaged) {
    const indexPath = path.join(app.getAppPath(), 'renderer', 'build', 'index.html');
    console.log('Loading packaged app from:', indexPath);
    mainWindow.loadFile(indexPath);
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

  // Setup auto-updater
  setupAutoUpdater();

  // Create application menu
  createMenu();

  // Setup OAuth interceptor
  setupOAuthInterceptor();

  // Start backend server in background
  startBackendServer().catch(err => {
    console.error('Backend failed to start:', err);
  });

  // Register IPC handlers
  require('./ipc-handlers')(ipcMain, null, store, desktopCapturer);

  createWindow();
  console.log('Window created');

  require('./ipc-handlers').updateMainWindow?.(mainWindow);

  // Check for updates on startup (optional - silent check)
  if (app.isPackaged) {
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
