const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db, seedDemoAccounts } = require('../db/db');

const router = express.Router();

// Seed demo accounts on startup
seedDemoAccounts(bcrypt);

// Generate JWT token
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            companyId: user.company_id
        },
        process.env.JWT_SECRET || 'dev-secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Query user from database (await for PostgreSQL compatibility)
        const user = await db.prepare(`
            SELECT u.*, c.name as company_name 
            FROM users u 
            LEFT JOIN companies c ON u.company_id = c.id 
            WHERE LOWER(u.email) = LOWER(?)
        `).get(email);

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken(user);

        // Return user without password
        const userResponse = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.company_id,
            companyName: user.company_name
        };

        res.json({
            success: true,
            user: userResponse,
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, companyName } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        // Check if user exists
        const existingUser = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);

        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        const companyId = uuidv4();

        // Create company first
        await db.prepare(`
            INSERT INTO companies (id, name, plan, status)
            VALUES (?, ?, ?, ?)
        `).run(companyId, companyName || 'My Company', 'starter', 'active');

        // Create user
        await db.prepare(`
            INSERT INTO users (id, email, password_hash, name, role, company_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, email.toLowerCase(), hashedPassword, name, 'client_admin', companyId);

        const newUser = {
            id: userId,
            email: email.toLowerCase(),
            name,
            role: 'client_admin',
            companyId,
            companyName: companyName || 'My Company'
        };

        const token = generateToken({ ...newUser, company_id: companyId });

        res.status(201).json({
            success: true,
            user: newUser,
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Verify token
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

        // Get user from database
        const user = await db.prepare(`
            SELECT u.*, c.name as company_name 
            FROM users u 
            LEFT JOIN companies c ON u.company_id = c.id 
            WHERE u.id = ?
        `).get(decoded.id);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        const userResponse = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.company_id,
            companyName: user.company_name
        };

        res.json({
            valid: true,
            user: userResponse
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user profile
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

        const user = await db.prepare(`
            SELECT u.*, c.name as company_name, c.industry, c.plan
            FROM users u 
            LEFT JOIN companies c ON u.company_id = c.id 
            WHERE u.id = ?
        `).get(decoded.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                companyId: user.company_id,
                companyName: user.company_name,
                profilePicture: user.profile_picture,
                company: {
                    id: user.company_id,
                    name: user.company_name,
                    industry: user.industry,
                    plan: user.plan
                }
            }
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// ============================================
// Google OAuth Routes
// ============================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';

// Initiate Google OAuth
router.get('/google', (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
        return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent'
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.redirect(authUrl);
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
    try {
        const { code, error: authError } = req.query;

        if (authError) {
            console.error('[GOOGLE AUTH] Error:', authError);
            return res.redirect('/login?error=google_auth_failed');
        }

        if (!code) {
            return res.redirect('/login?error=no_code');
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: GOOGLE_REDIRECT_URI
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('[GOOGLE AUTH] Token exchange failed:', errorText);
            return res.redirect('/login?error=token_exchange_failed');
        }

        const tokens = await tokenResponse.json();

        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        if (!userInfoResponse.ok) {
            return res.redirect('/login?error=user_info_failed');
        }

        const googleUser = await userInfoResponse.json();
        console.log('[GOOGLE AUTH] User info:', googleUser.email, googleUser.name, 'picture:', googleUser.picture);

        // Check if user exists
        let user = await db.prepare(`
            SELECT u.*, c.name as company_name 
            FROM users u 
            LEFT JOIN companies c ON u.company_id = c.id 
            WHERE LOWER(u.email) = LOWER(?)
        `).get(googleUser.email);

        if (!user) {
            // Create new user
            const userId = uuidv4();
            const companyId = uuidv4();

            // Create company
            await db.prepare(`
                INSERT INTO companies (id, name, plan, status)
                VALUES (?, ?, ?, ?)
            `).run(companyId, `${googleUser.name}'s Company`, 'starter', 'active');

            // Create user with profile picture
            await db.prepare(`
                INSERT INTO users (id, email, password_hash, name, role, company_id, google_id, profile_picture)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, googleUser.email.toLowerCase(), '', googleUser.name, 'client_admin', companyId, googleUser.id, googleUser.picture);

            user = {
                id: userId,
                email: googleUser.email.toLowerCase(),
                name: googleUser.name,
                role: 'client_admin',
                company_id: companyId,
                company_name: `${googleUser.name}'s Company`,
                profile_picture: googleUser.picture
            };

            console.log('[GOOGLE AUTH] Created new user:', user.email);
        } else {
            // Always update name and profile picture from Google
            await db.prepare(`
                UPDATE users SET name = ?, profile_picture = ?, google_id = COALESCE(google_id, ?)
                WHERE id = ?
            `).run(googleUser.name, googleUser.picture, googleUser.id, user.id);
            user.name = googleUser.name;
            user.profile_picture = googleUser.picture;
            console.log('[GOOGLE AUTH] Updated existing user:', user.email, 'name:', user.name);
        }

        // Generate JWT token
        const token = generateToken(user);

        // Redirect to frontend with token
        // For Electron app: redirect to a success page on the same server that 
        // allows the app to capture the token via the external browser window
        const frontendUrl = process.env.FRONTEND_URL;
        if (frontendUrl && frontendUrl !== 'http://localhost:3000') {
            // Web app deployment - redirect to frontend
            res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
        } else {
            // Electron app or no FRONTEND_URL set - use auth success page
            res.redirect(`/api/auth/success?token=${token}`);
        }

    } catch (error) {
        console.error('[GOOGLE AUTH] Callback error:', error);
        res.redirect('/login?error=callback_failed');
    }
});

// Get Google auth URL (for frontend to redirect)
router.get('/google/url', (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
        return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account'
    });

    res.json({
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    });
});
// Auth success page - for in-app OAuth flow
// Token is in URL - Electron will extract it via did-navigate handler
router.get('/success', (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).send('No token provided');
    }

    // Simple page that Electron will intercept
    // The did-navigate handler extracts token from URL before this page renders
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Signing in... - BAM.ai</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #f8fafc;
        }
        .container { text-align: center; padding: 2rem; }
        .spinner {
            width: 48px; height: 48px;
            border: 4px solid rgba(139, 92, 246, 0.3);
            border-top-color: #8b5cf6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        h2 { font-size: 1.25rem; font-weight: 500; }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h2>Signing you in...</h2>
    </div>
    <script>
        // Token is: ${token.substring(0, 20)}...
        // Electron's did-navigate handler should intercept this page
        // and extract the token from the URL before we get here.
        // If we're still here after 3 seconds, something went wrong.
        console.log('[OAuth Success] Page loaded - Electron should intercept');
        
        // Fallback for non-Electron browsers (web app)
        setTimeout(() => {
            console.log('[OAuth Success] Fallback - storing token and redirecting');
            try {
                localStorage.setItem('bam_token', '${token}');
                localStorage.setItem('token', '${token}');
            } catch(e) {}
            window.location.href = '/dashboard';
        }, 3000);
    </script>
</body>
</html>
    `);
});

module.exports = router;
