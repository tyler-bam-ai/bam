const { desktopCapturer, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Store mainWindow reference for dialogs
let storedMainWindow = null;

function registerHandlers(ipcMain, mainWindow, store, desktopCapturerModule) {
    storedMainWindow = mainWindow;

    // ============================================
    // Authentication & User Management
    // ============================================

    ipcMain.handle('auth:get-user', async () => {
        return store.get('currentUser', null);
    });

    ipcMain.handle('auth:set-user', async (event, user) => {
        store.set('currentUser', user);
        return true;
    });

    ipcMain.handle('auth:logout', async () => {
        store.delete('currentUser');
        store.delete('authToken');
        return true;
    });

    ipcMain.handle('auth:get-token', async () => {
        return store.get('authToken', null);
    });

    ipcMain.handle('auth:set-token', async (event, token) => {
        store.set('authToken', token);
        return true;
    });

    // ============================================
    // Screen Recording
    // ============================================

    let mediaRecorder = null;
    let recordedChunks = [];
    let recordingStream = null;

    ipcMain.handle('recording:get-sources', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['window', 'screen'],
                thumbnailSize: { width: 320, height: 180 }
            });

            return sources.map(source => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail.toDataURL()
            }));
        } catch (error) {
            console.error('Error getting sources:', error);
            throw error;
        }
    });

    ipcMain.handle('recording:check-permissions', async () => {
        if (process.platform === 'darwin') {
            const screenStatus = systemPreferences.getMediaAccessStatus('screen');
            const micStatus = systemPreferences.getMediaAccessStatus('microphone');

            return {
                screen: screenStatus === 'granted',
                microphone: micStatus === 'granted'
            };
        }
        // Windows doesn't require explicit permissions check
        return { screen: true, microphone: true };
    });

    ipcMain.handle('recording:request-mic-permission', async () => {
        if (process.platform === 'darwin') {
            return await systemPreferences.askForMediaAccess('microphone');
        }
        return true;
    });

    // ============================================
    // File System Operations
    // ============================================

    ipcMain.handle('fs:get-recordings-path', async () => {
        const { app } = require('electron');
        const recordingsPath = path.join(app.getPath('userData'), 'recordings');

        if (!fs.existsSync(recordingsPath)) {
            fs.mkdirSync(recordingsPath, { recursive: true });
        }

        return recordingsPath;
    });

    ipcMain.handle('fs:save-recording', async (event, { buffer, filename }) => {
        const { app } = require('electron');
        const recordingsPath = path.join(app.getPath('userData'), 'recordings');

        if (!fs.existsSync(recordingsPath)) {
            fs.mkdirSync(recordingsPath, { recursive: true });
        }

        const filePath = path.join(recordingsPath, filename);
        fs.writeFileSync(filePath, Buffer.from(buffer));

        return filePath;
    });

    ipcMain.handle('fs:get-documents-path', async () => {
        const { app } = require('electron');
        const documentsPath = path.join(app.getPath('userData'), 'documents');

        if (!fs.existsSync(documentsPath)) {
            fs.mkdirSync(documentsPath, { recursive: true });
        }

        return documentsPath;
    });

    // ============================================
    // Settings & Configuration
    // ============================================

    ipcMain.handle('settings:get', async (event, key) => {
        return store.get(`settings.${key}`, null);
    });

    ipcMain.handle('settings:set', async (event, key, value) => {
        store.set(`settings.${key}`, value);
        return true;
    });

    ipcMain.handle('settings:get-all', async () => {
        return store.get('settings', {});
    });

    // ============================================
    // API Key Management (Encrypted Storage)
    // ============================================

    ipcMain.handle('apikeys:get', async (event, service) => {
        return store.get(`apikeys.${service}`, null);
    });

    ipcMain.handle('apikeys:set', async (event, service, key) => {
        store.set(`apikeys.${service}`, key);
        return true;
    });

    ipcMain.handle('apikeys:delete', async (event, service) => {
        store.delete(`apikeys.${service}`);
        return true;
    });

    ipcMain.handle('apikeys:list', async () => {
        const apikeys = store.get('apikeys', {});
        // Return only service names, not actual keys
        return Object.keys(apikeys);
    });

    // ============================================
    // App Info
    // ============================================

    ipcMain.handle('app:get-version', async () => {
        const { app } = require('electron');
        return app.getVersion();
    });

    ipcMain.handle('app:get-platform', async () => {
        return process.platform;
    });

    // ============================================
    // Dialog (Native File Pickers)
    // ============================================

    ipcMain.handle('dialog:open-file', async (event, options) => {
        const { dialog } = require('electron');

        const filters = options?.filters || [
            { name: 'All Files', extensions: ['*'] }
        ];

        const result = await dialog.showOpenDialog(storedMainWindow || undefined, {
            properties: ['openFile'],
            filters: filters
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return { filePath: result.filePaths[0] };
    });
}

// Export function and updateMainWindow helper
module.exports = registerHandlers;
module.exports.updateMainWindow = (win) => {
    storedMainWindow = win;
};
