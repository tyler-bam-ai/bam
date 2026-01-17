/**
 * User Settings Routes
 * 
 * Stores per-user settings and API keys in the database
 * so they persist across devices and sessions.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { db } = require('../db/db');

const router = express.Router();

/**
 * Get all settings for the authenticated user
 * GET /api/user/settings
 */
router.get('/settings', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const settings = await db.prepare(`
            SELECT key, value FROM user_settings WHERE user_id = ?
        `).all(userId);

        // Convert to key-value object
        const result = {};
        settings.forEach(row => {
            try {
                // Try to parse JSON values
                result[row.key] = JSON.parse(row.value);
            } catch {
                result[row.key] = row.value;
            }
        });

        res.json({ success: true, settings: result });
    } catch (error) {
        console.error('[USER-SETTINGS] Get all error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

/**
 * Get a specific setting
 * GET /api/user/settings/:key
 */
router.get('/settings/:key', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { key } = req.params;

        const row = await db.prepare(`
            SELECT value FROM user_settings WHERE user_id = ? AND key = ?
        `).get(userId, key);

        if (!row) {
            return res.json({ success: true, key, value: null });
        }

        let value;
        try {
            value = JSON.parse(row.value);
        } catch {
            value = row.value;
        }

        res.json({ success: true, key, value });
    } catch (error) {
        console.error('[USER-SETTINGS] Get error:', error);
        res.status(500).json({ error: 'Failed to get setting' });
    }
});

/**
 * Save a setting
 * POST /api/user/settings
 * Body: { key: string, value: any }
 */
router.post('/settings', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { key, value } = req.body;

        if (!key) {
            return res.status(400).json({ error: 'Key is required' });
        }

        // Convert value to string if it's an object
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

        // Upsert: INSERT OR REPLACE
        await db.prepare(`
            INSERT INTO user_settings (id, user_id, key, value, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
        `).run(uuidv4(), userId, key, valueStr);

        console.log(`[USER-SETTINGS] Saved ${key} for user ${userId}`);
        res.json({ success: true, key });
    } catch (error) {
        console.error('[USER-SETTINGS] Save error:', error);
        res.status(500).json({ error: 'Failed to save setting' });
    }
});

/**
 * Save multiple settings at once
 * POST /api/user/settings/bulk
 * Body: { settings: { key1: value1, key2: value2, ... } }
 */
router.post('/settings/bulk', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Settings object is required' });
        }

        const keys = Object.keys(settings);
        for (const key of keys) {
            const value = settings[key];
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

            await db.prepare(`
                INSERT INTO user_settings (id, user_id, key, value, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP
            `).run(uuidv4(), userId, key, valueStr);
        }

        console.log(`[USER-SETTINGS] Bulk saved ${keys.length} settings for user ${userId}`);
        res.json({ success: true, saved: keys });
    } catch (error) {
        console.error('[USER-SETTINGS] Bulk save error:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

/**
 * Delete a setting
 * DELETE /api/user/settings/:key
 */
router.delete('/settings/:key', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { key } = req.params;

        await db.prepare(`
            DELETE FROM user_settings WHERE user_id = ? AND key = ?
        `).run(userId, key);

        res.json({ success: true, deleted: key });
    } catch (error) {
        console.error('[USER-SETTINGS] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete setting' });
    }
});

/**
 * Get user's API keys (returns service names, not actual keys for security)
 * GET /api/user/api-keys
 */
router.get('/api-keys', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const settings = await db.prepare(`
            SELECT key FROM user_settings 
            WHERE user_id = ? AND key LIKE 'api_key_%'
        `).all(userId);

        const services = settings.map(row => row.key.replace('api_key_', ''));

        res.json({ success: true, services });
    } catch (error) {
        console.error('[USER-SETTINGS] Get API keys error:', error);
        res.status(500).json({ error: 'Failed to get API keys' });
    }
});

/**
 * Save an API key
 * PUT /api/user/api-keys/:service
 * Body: { key: string }
 */
router.put('/api-keys/:service', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { service } = req.params;
        const { key } = req.body;

        if (!key) {
            return res.status(400).json({ error: 'API key is required' });
        }

        const settingKey = `api_key_${service}`;

        await db.prepare(`
            INSERT INTO user_settings (id, user_id, key, value, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
        `).run(uuidv4(), userId, settingKey, key);

        console.log(`[USER-SETTINGS] Saved API key for ${service} for user ${userId}`);
        res.json({ success: true, service });
    } catch (error) {
        console.error('[USER-SETTINGS] Save API key error:', error);
        res.status(500).json({ error: 'Failed to save API key' });
    }
});

/**
 * Get a specific API key (for internal use)
 * GET /api/user/api-keys/:service
 */
router.get('/api-keys/:service', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { service } = req.params;

        const settingKey = `api_key_${service}`;

        const row = await db.prepare(`
            SELECT value FROM user_settings WHERE user_id = ? AND key = ?
        `).get(userId, settingKey);

        if (row?.value) {
            res.json({ success: true, service, hasKey: true, key: row.value });
        } else {
            res.json({ success: true, service, hasKey: false });
        }
    } catch (error) {
        console.error('[USER-SETTINGS] Get API key error:', error);
        res.status(500).json({ error: 'Failed to get API key' });
    }
});

module.exports = router;
