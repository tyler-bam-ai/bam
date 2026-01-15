/**
 * Application Configuration
 * 
 * Centralized config for API URLs and environment settings.
 * Automatically switches between development and production.
 */

// Railway production backend URL - ALWAYS use this for packaged apps
const RAILWAY_API_URL = 'https://bam-production-c677.up.railway.app';
const RAILWAY_WS_URL = 'wss://bam-production-c677.up.railway.app';

// Detect if this is a PACKAGED Electron app (not dev mode)
// Packaged apps load from file:// or app:// protocol
const isPackagedApp = typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' ||
        window.location.protocol === 'app:' ||
        window.navigator.userAgent.includes('Electron'));

// Only use localhost if we're on http://localhost (webpack dev server)
const isWebpackDevServer = typeof window !== 'undefined' &&
    window.location.protocol === 'http:' &&
    window.location.hostname === 'localhost' &&
    !window.navigator.userAgent.includes('Electron');

// DECISION: Use Railway unless we're definitely on webpack dev server
const useLocalBackend = isWebpackDevServer && !isPackagedApp;

// API Configuration
export const API_URL = useLocalBackend
    ? 'http://localhost:3001'
    : RAILWAY_API_URL;

// WebSocket Configuration
export const WS_URL = useLocalBackend
    ? 'ws://localhost:3001'
    : RAILWAY_WS_URL;

// Detect Electron for other purposes
const isElectron = typeof window !== 'undefined' &&
    (window.navigator.userAgent.includes('Electron') ||
        window.location.protocol === 'file:' ||
        window.location.protocol === 'app:');

// Log for debugging
if (typeof window !== 'undefined') {
    console.log('[CONFIG] Protocol:', window.location.protocol);
    console.log('[CONFIG] Hostname:', window.location.hostname);
    console.log('[CONFIG] User Agent includes Electron:', window.navigator.userAgent.includes('Electron'));
    console.log('[CONFIG] isPackagedApp:', isPackagedApp);
    console.log('[CONFIG] isWebpackDevServer:', isWebpackDevServer);
    console.log('[CONFIG] useLocalBackend:', useLocalBackend);
    console.log('[CONFIG] API_URL:', API_URL);
}

// Retry fetch helper - retries on network errors (useful when backend is starting)
export const retryFetch = async (url, options = {}, maxRetries = 3, delayMs = 1000) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (err) {
            lastError = err;
            console.log(`[RETRY] Fetch attempt ${attempt}/${maxRetries} failed:`, err.message);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    throw lastError;
};

// Feature Flags
export const FEATURES = {
    voiceMode: true,
    screenRecording: true,
    socialMediaPosting: true,
    contentEngine: true,
};

// Environment info
export const ENV = {
    isDevelopment: useLocalBackend,
    isProduction: !useLocalBackend,
    isElectron,
    version: '1.0.9',
};

export default {
    API_URL,
    WS_URL,
    FEATURES,
    ENV,
    retryFetch,
};
