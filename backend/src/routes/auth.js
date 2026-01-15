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

// ============================================
// Password Reset Routes
// ============================================

// Request password reset
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if user exists
        const user = await db.prepare('SELECT id, email, name FROM users WHERE LOWER(email) = LOWER(?)').get(email);

        if (!user) {
            // Don't reveal if email exists or not for security
            return res.json({
                success: true,
                message: 'If an account exists with this email, you will receive a password reset link.'
            });
        }

        // Generate reset token (expires in 1 hour)
        const resetToken = jwt.sign(
            { userId: user.id, email: user.email, purpose: 'password-reset' },
            process.env.JWT_SECRET || 'dev-secret',
            { expiresIn: '1h' }
        );

        // Store reset token in database (optional - for token invalidation)
        await db.prepare(`
            UPDATE users SET reset_token = ?, reset_token_expires = datetime('now', '+1 hour')
            WHERE id = ?
        `).run(resetToken, user.id);

        // Build reset URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

        // TODO: Send email with reset link
        // For now, log to console (replace with actual email service)
        console.log('===========================================');
        console.log('PASSWORD RESET REQUESTED');
        console.log('Email:', user.email);
        console.log('Name:', user.name);
        console.log('Reset URL:', resetUrl);
        console.log('===========================================');

        res.json({
            success: true,
            message: 'If an account exists with this email, you will receive a password reset link.',
            // Include resetUrl in dev mode for testing
            ...(process.env.NODE_ENV !== 'production' && { resetUrl })
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        } catch (err) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        if (decoded.purpose !== 'password-reset') {
            return res.status(400).json({ error: 'Invalid reset token' });
        }

        // Get user and verify token matches
        const user = await db.prepare('SELECT id, reset_token FROM users WHERE id = ?').get(decoded.userId);

        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear reset token
        await db.prepare(`
            UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL
            WHERE id = ?
        `).run(hashedPassword, user.id);

        console.log('[PASSWORD RESET] Password updated for user:', decoded.email);

        res.json({
            success: true,
            message: 'Password has been reset successfully. You can now log in with your new password.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
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
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            company: {
                id: user.company_id,
                name: user.company_name,
                industry: user.industry,
                plan: user.plan
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
        console.log('[GOOGLE AUTH] User info:', googleUser.email, googleUser.name);

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

            // Create user (no password for OAuth users)
            await db.prepare(`
                INSERT INTO users (id, email, password_hash, name, role, company_id, google_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(userId, googleUser.email.toLowerCase(), '', googleUser.name, 'client_admin', companyId, googleUser.id);

            user = {
                id: userId,
                email: googleUser.email.toLowerCase(),
                name: googleUser.name,
                role: 'client_admin',
                company_id: companyId,
                company_name: `${googleUser.name}'s Company`
            };

            console.log('[GOOGLE AUTH] Created new user:', user.email);
        } else {
            console.log('[GOOGLE AUTH] Existing user login:', user.email);
        }

        // Generate JWT token
        const token = generateToken(user);

        // Return HTML page with token embedded as data attribute
        // Electron's main process can extract this
        const userJson = JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.company_id,
            companyName: user.company_name
        });

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Login Successful - BAM.ai</title>
                <meta name="bam-token" content="${token}">
                <meta name="bam-user" content='${userJson.replace(/'/g, "&apos;")}'>
                <style>
                    * { box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
                        color: white;
                        min-height: 100vh;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                        padding: 20px;
                    }
                    .container { 
                        text-align: center;
                        background: rgba(255,255,255,0.05);
                        padding: 40px;
                        border-radius: 16px;
                        max-width: 400px;
                    }
                    .checkmark {
                        width: 60px;
                        height: 60px;
                        background: linear-gradient(135deg, #a855f7, #ec4899);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 20px;
                        font-size: 30px;
                    }
                    h2 { margin: 0 0 10px; font-size: 24px; }
                    .email { color: #a855f7; margin-bottom: 20px; }
                    p { color: #888; margin: 10px 0; }
                    .btn {
                        background: linear-gradient(135deg, #a855f7, #ec4899);
                        border: none;
                        color: white;
                        padding: 12px 32px;
                        border-radius: 8px;
                        font-size: 16px;
                        cursor: pointer;
                        margin-top: 20px;
                        width: 100%;
                    }
                    .btn:hover { opacity: 0.9; }
                    .spinner {
                        width: 20px;
                        height: 20px;
                        border: 2px solid rgba(255,255,255,0.3);
                        border-top-color: white;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        display: inline-block;
                        margin-right: 8px;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    .status { margin-top: 15px; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="checkmark">✓</div>
                    <h2>Welcome, ${user.name}!</h2>
                    <p class="email">${user.email}</p>
                    <p>You're now signed in to BAM.ai</p>
                    <button class="btn" onclick="returnToApp()">
                        <span class="spinner" id="spinner" style="display:none"></span>
                        <span id="btnText">Return to App</span>
                    </button>
                    <p class="status" id="status">Click the button above to continue</p>
                </div>
                <script>
                    // Store auth data
                    const token = '${token}';
                    const userData = ${userJson};
                    
                    function returnToApp() {
                        document.getElementById('spinner').style.display = 'inline-block';
                        document.getElementById('btnText').textContent = 'Returning...';
                        document.getElementById('status').textContent = 'Closing this window...';
                        
                        // Try to communicate with Electron via window object
                        if (window.electronAPI) {
                            // If in Electron with preload, use IPC
                            window.electronAPI.auth.setToken(token);
                            window.electronAPI.auth.setUser(userData);
                        }
                        
                        // Store in sessionStorage (will be available when we navigate)
                        sessionStorage.setItem('oauth_token', token);
                        sessionStorage.setItem('oauth_user', JSON.stringify(userData));
                        
                        // Navigate back to origin
                        setTimeout(() => {
                            // This will trigger Electron's navigation listener
                            window.location.href = 'bam-auth://callback?token=' + token;
                        }, 500);
                        
                        // Fallback: just close after delay
                        setTimeout(() => {
                            document.getElementById('status').textContent = 'If the app doesn\\'t open, please close this window manually.';
                        }, 3000);
                    }
                    
                    // Auto-click after 2 seconds 
                    setTimeout(() => {
                        returnToApp();
                    }, 2000);
                </script>
            </body>
            </html>
        `);

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
        prompt: 'consent'
    });

    res.json({
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    });
});

module.exports = router;
