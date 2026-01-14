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
    version: '1.0.0',
};

export default {
    API_URL,
    WS_URL,
    FEATURES,
    ENV,
};
