/**
 * Debug Routes - for troubleshooting
 */
const express = require('express');
const { db } = require('../db/db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * Debug endpoint - list all companies and users
 * GET /api/debug/clients
 */
router.get('/clients', optionalAuth, async (req, res) => {
    try {
        const companies = await db.prepare(`
            SELECT id, name, industry, plan, status, contact_name, contact_email, created_at
            FROM companies 
            ORDER BY created_at DESC
            LIMIT 50
        `).all();

        const users = await db.prepare(`
            SELECT id, email, name, role, company_id, created_at
            FROM users 
            ORDER BY created_at DESC
            LIMIT 50
        `).all();

        res.json({
            success: true,
            companies: companies,
            users: users
        });
    } catch (error) {
        console.error('[DEBUG] Error:', error);
        res.status(500).json({ error: 'Failed to get debug info', details: error.message });
    }
});

module.exports = router;
