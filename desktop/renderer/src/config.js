/**
 * Application Configuration
 * 
 * Centralized config for API URLs and environment settings.
 * Automatically switches between development and production.
 */

// Detect if running in Electron
const isElectron = typeof window !== 'undefined' &&
    (window.navigator.userAgent.includes('Electron') ||
        window.location.protocol === 'file:' ||
        window.location.protocol === 'app:');

// Check if running in LOCAL development:
// - Must be on localhost (http://localhost:3000 webpack dev server)
// - file:// protocol means packaged app, should use Railway
const isLocalDev = typeof window !== 'undefined' &&
    window.location.hostname === 'localhost' &&
    window.location.protocol === 'http:';

// Railway production backend URL
const RAILWAY_API_URL = 'https://bam-production-c677.up.railway.app';
const RAILWAY_WS_URL = 'wss://bam-production-c677.up.railway.app';

// API Configuration
// Use localhost ONLY when running webpack dev server (http://localhost:3000)
// Packaged Electron app uses Railway
export const API_URL = isLocalDev
    ? 'http://localhost:3001'
    : RAILWAY_API_URL;

// WebSocket Configuration
export const WS_URL = isLocalDev
    ? 'ws://localhost:3001'
    : RAILWAY_WS_URL;

// Log for debugging
if (typeof window !== 'undefined') {
    console.log('[CONFIG] Protocol:', window.location.protocol);
    console.log('[CONFIG] Hostname:', window.location.hostname);
    console.log('[CONFIG] isLocalDev:', isLocalDev);
    console.log('[CONFIG] API_URL:', isLocalDev ? 'http://localhost:3001' : RAILWAY_API_URL);
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
    isDevelopment: isLocalDev,
    isProduction: !isLocalDev,
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
