/**
 * Application Configuration
 * 
 * Centralized config for API URLs and environment settings.
 * Automatically switches between development and production.
 */

// Detect environment - check for Electron or localhost
const isElectron = typeof window !== 'undefined' &&
    (window.navigator.userAgent.includes('Electron') ||
        window.location.protocol === 'file:' ||
        window.location.protocol === 'app:');

const isDevelopment = process.env.NODE_ENV !== 'production' ||
    window.location.hostname === 'localhost' ||
    isElectron;

// API Configuration - always use localhost:3001 for Electron/development
export const API_URL = isDevelopment || isElectron
    ? 'http://localhost:3001'
    : (process.env.REACT_APP_API_URL || 'https://api.bam.ai');

// WebSocket Configuration
export const WS_URL = isDevelopment || isElectron
    ? 'ws://localhost:3001'
    : (process.env.REACT_APP_WS_URL || 'wss://api.bam.ai');

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
    isDevelopment,
    isProduction: !isDevelopment,
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
