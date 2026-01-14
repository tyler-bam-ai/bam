const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Authentication
    auth: {
        getUser: () => ipcRenderer.invoke('auth:get-user'),
        setUser: (user) => ipcRenderer.invoke('auth:set-user', user),
        logout: () => ipcRenderer.invoke('auth:logout'),
        getToken: () => ipcRenderer.invoke('auth:get-token'),
        setToken: (token) => ipcRenderer.invoke('auth:set-token', token)
    },

    // Screen Recording
    recording: {
        getSources: () => ipcRenderer.invoke('recording:get-sources'),
        checkPermissions: () => ipcRenderer.invoke('recording:check-permissions'),
        requestMicPermission: () => ipcRenderer.invoke('recording:request-mic-permission')
    },

    // File System
    fs: {
        getRecordingsPath: () => ipcRenderer.invoke('fs:get-recordings-path'),
        saveRecording: (data) => ipcRenderer.invoke('fs:save-recording', data),
        getDocumentsPath: () => ipcRenderer.invoke('fs:get-documents-path')
    },

    // Settings
    settings: {
        get: (key) => ipcRenderer.invoke('settings:get', key),
        set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
        getAll: () => ipcRenderer.invoke('settings:get-all')
    },

    // API Keys (Secure)
    apiKeys: {
        get: (service) => ipcRenderer.invoke('apikeys:get', service),
        set: (service, key) => ipcRenderer.invoke('apikeys:set', service, key),
        delete: (service) => ipcRenderer.invoke('apikeys:delete', service),
        list: () => ipcRenderer.invoke('apikeys:list')
    },

    // Dialog (Native file pickers)
    dialog: {
        openFile: (options) => ipcRenderer.invoke('dialog:open-file', options)
    },

    // App Info
    app: {
        getVersion: () => ipcRenderer.invoke('app:get-version'),
        getPlatform: () => ipcRenderer.invoke('app:get-platform')
    }
});

// Add platform detection for CSS
window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add(`platform-${process.platform}`);
});
