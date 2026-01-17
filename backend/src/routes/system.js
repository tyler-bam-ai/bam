/**
 * System Routes
 * System utilities, health checks, and dependency management
 */

const express = require('express');
const { execSync, spawn } = require('child_process');
const os = require('os');

const router = express.Router();

/**
 * Check FFmpeg installation status
 * GET /api/system/ffmpeg-status
 */
router.get('/ffmpeg-status', (req, res) => {
    try {
        execSync('ffmpeg -version', { stdio: 'pipe' });
        res.json({ installed: true, version: getFFmpegVersion() });
    } catch {
        res.json({ installed: false });
    }
});

/**
 * Get FFmpeg version string
 */
function getFFmpegVersion() {
    try {
        const output = execSync('ffmpeg -version', { encoding: 'utf8' });
        const match = output.match(/ffmpeg version ([^\s]+)/);
        return match ? match[1] : 'unknown';
    } catch {
        return null;
    }
}

/**
 * Install FFmpeg automatically
 * POST /api/system/install-ffmpeg
 */
router.post('/install-ffmpeg', async (req, res) => {
    const platform = os.platform();

    try {
        if (platform === 'darwin') {
            // macOS: Use Homebrew
            console.log('[System] Installing FFmpeg via Homebrew...');

            // Check if Homebrew is installed
            try {
                execSync('which brew', { stdio: 'pipe' });
            } catch {
                // Install Homebrew first
                console.log('[System] Installing Homebrew first...');
                execSync('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', {
                    stdio: 'inherit',
                    shell: true
                });
            }

            // Install FFmpeg
            execSync('brew install ffmpeg', { stdio: 'inherit' });

            res.json({ success: true, message: 'FFmpeg installed successfully via Homebrew' });

        } else if (platform === 'win32') {
            // Windows: Use winget or direct download
            console.log('[System] Installing FFmpeg via winget...');

            try {
                // Try winget first (Windows 10/11)
                execSync('winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements', {
                    stdio: 'inherit'
                });
                res.json({ success: true, message: 'FFmpeg installed successfully via winget' });
            } catch (wingetErr) {
                // Fallback: provide manual instructions
                res.json({
                    success: false,
                    error: 'Automatic installation failed. Please download FFmpeg from https://ffmpeg.org/download.html and add it to your PATH.',
                    manual: true
                });
            }

        } else if (platform === 'linux') {
            // Linux: Use apt-get
            console.log('[System] Installing FFmpeg via apt-get...');
            execSync('sudo apt-get update && sudo apt-get install -y ffmpeg', { stdio: 'inherit' });
            res.json({ success: true, message: 'FFmpeg installed successfully via apt-get' });

        } else {
            res.json({
                success: false,
                error: `Unsupported platform: ${platform}. Please install FFmpeg manually.`
            });
        }
    } catch (error) {
        console.error('[System] FFmpeg installation error:', error);
        res.json({
            success: false,
            error: error.message,
            manual: true,
            instructions: 'Please install FFmpeg manually from https://ffmpeg.org/download.html'
        });
    }
});

/**
 * System health check
 * GET /api/system/health
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
    });
});

const fs = require('fs');
const path = require('path');
const { db } = require('../db/db');

// API keys file path (local fallback)
const API_KEYS_FILE = path.join(__dirname, '../../data/api-keys.json');

// Ensure data directory exists
function ensureDataDir() {
    const dataDir = path.dirname(API_KEYS_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

/**
 * Get an API key - checks database first (Railway), then local file
 * Used by other services as a fallback when client doesn't provide key
 */
async function getStoredApiKey(service) {
    try {
        // Check database first (Railway persistence)
        const dbResult = await db.prepare(
            'SELECT value FROM settings WHERE key = ?'
        ).get(`api_key_${service}`);

        if (dbResult?.value) {
            return dbResult.value;
        }

        // Fallback to local file
        if (fs.existsSync(API_KEYS_FILE)) {
            const keys = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
            if (keys[service]) {
                return keys[service];
            }
        }

        // Fallback to environment variable
        const envKey = process.env[`${service.toUpperCase()}_API_KEY`];
        if (envKey) {
            return envKey;
        }

        return null;
    } catch (error) {
        console.error(`[System] Error getting stored API key for ${service}:`, error);
        return null;
    }
}

/**
 * Save an API key
 * POST /api/system/api-keys
 */
router.post('/api-keys', async (req, res) => {
    try {
        const { service, key } = req.body;

        if (!service || !key) {
            return res.status(400).json({ error: 'Service and key are required' });
        }

        // Save to database (Railway persistence)
        try {
            await db.prepare(`
                INSERT OR REPLACE INTO settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `).run(`api_key_${service}`, key);
            console.log(`[System] Saved API key for ${service} to database`);
        } catch (dbError) {
            console.error(`[System] Database save failed:`, dbError);
        }

        // Also save to local file as backup
        try {
            ensureDataDir();
            let keys = {};
            if (fs.existsSync(API_KEYS_FILE)) {
                keys = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
            }
            keys[service] = key;
            fs.writeFileSync(API_KEYS_FILE, JSON.stringify(keys, null, 2));
            console.log(`[System] Saved API key for ${service} to file`);
        } catch (fileError) {
            console.error(`[System] File save failed:`, fileError);
        }

        res.json({ success: true, service });
    } catch (error) {
        console.error('[System] Save API key error:', error);
        res.status(500).json({ error: 'Failed to save API key' });
    }
});

/**
 * List configured API key services (not the actual keys)
 * GET /api/system/api-keys
 */
router.get('/api-keys', async (req, res) => {
    try {
        const services = new Set();

        // Check database
        try {
            const dbResults = await db.prepare(
                'SELECT key FROM settings WHERE key LIKE ?'
            ).all('api_key_%');

            dbResults.forEach(row => {
                const service = row.key.replace('api_key_', '');
                services.add(service);
            });
        } catch (dbError) {
            console.error('[System] Database read failed:', dbError);
        }

        // Check local file
        if (fs.existsSync(API_KEYS_FILE)) {
            const keys = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
            Object.keys(keys).filter(k => keys[k]).forEach(k => services.add(k));
        }

        res.json({ services: Array.from(services) });
    } catch (error) {
        console.error('[System] List API keys error:', error);
        res.status(500).json({ error: 'Failed to list API keys' });
    }
});

/**
 * Get a specific API key (for server-side use)
 * GET /api/system/api-keys/:service
 * NOTE: This should only be called internally, not exposed to clients
 */
router.get('/api-keys/:service', async (req, res) => {
    try {
        const { service } = req.params;
        const key = await getStoredApiKey(service);

        if (key) {
            res.json({ service, hasKey: true, key });
        } else {
            res.json({ service, hasKey: false });
        }
    } catch (error) {
        console.error('[System] Get API key error:', error);
        res.status(500).json({ error: 'Failed to get API key' });
    }
});

// Export helper function for use by other services
module.exports = router;
module.exports.getStoredApiKey = getStoredApiKey;

