/**
 * Social Media Routes
 * Account management, scheduling, and posting automation
 */

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db/db');
const twitterService = require('../services/twitterService');
const linkedinService = require('../services/linkedinService');
const metaService = require('../services/metaService');
const tiktokService = require('../services/tiktokService');
const postingQueue = require('../services/postingQueue');
const approvalWorkflow = require('../services/approvalWorkflow');
const autoTagging = require('../services/autoTagging');

const router = express.Router();



// Encryption for storing tokens
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!!';

function encrypt(text) {
    try {
        const iv = crypto.randomBytes(16);
        const key = Buffer.alloc(32);
        Buffer.from(ENCRYPTION_KEY).copy(key);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

function decrypt(encryptedText) {
    try {
        const parts = encryptedText.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const key = Buffer.alloc(32);
        Buffer.from(ENCRYPTION_KEY).copy(key);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(parts[1], 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

// Platform configurations with OAuth details
const PLATFORMS = {
    instagram: {
        name: 'Instagram',
        icon: 'instagram',
        color: '#E4405F',
        supportsVideo: true,
        maxVideoLength: 90,
        aspectRatios: ['9:16', '1:1', '4:5'],
        requiresBusinessAccount: true,
        oauth: {
            authUrl: 'https://api.instagram.com/oauth/authorize',
            tokenUrl: 'https://api.instagram.com/oauth/access_token',
            scope: 'user_profile,user_media',
            clientIdEnv: 'INSTAGRAM_CLIENT_ID',
            clientSecretEnv: 'INSTAGRAM_CLIENT_SECRET'
        }
    },
    facebook: {
        name: 'Facebook',
        icon: 'facebook',
        color: '#1877F2',
        supportsVideo: true,
        maxVideoLength: 240 * 60,
        aspectRatios: ['16:9', '1:1', '9:16'],
        requiresBusinessAccount: false,
        oauth: {
            authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
            tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
            scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,publish_video',
            clientIdEnv: 'FACEBOOK_CLIENT_ID',
            clientSecretEnv: 'FACEBOOK_CLIENT_SECRET'
        }
    },
    tiktok: {
        name: 'TikTok',
        icon: 'music',
        color: '#000000',
        supportsVideo: true,
        maxVideoLength: 180,
        aspectRatios: ['9:16'],
        requiresBusinessAccount: true,
        oauth: {
            authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
            tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
            scope: 'user.info.basic,video.list,video.upload',
            clientIdEnv: 'TIKTOK_CLIENT_KEY',
            clientSecretEnv: 'TIKTOK_CLIENT_SECRET'
        }
    },
    linkedin: {
        name: 'LinkedIn',
        icon: 'linkedin',
        color: '#0A66C2',
        supportsVideo: true,
        maxVideoLength: 600,
        aspectRatios: ['16:9', '1:1', '9:16'],
        requiresBusinessAccount: false,
        oauth: {
            authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
            tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
            scope: 'r_liteprofile,w_member_social',
            clientIdEnv: 'LINKEDIN_CLIENT_ID',
            clientSecretEnv: 'LINKEDIN_CLIENT_SECRET'
        }
    },
    twitter: {
        name: 'Twitter/X',
        icon: 'twitter',
        color: '#1DA1F2',
        supportsVideo: true,
        maxVideoLength: 140,
        aspectRatios: ['16:9', '1:1'],
        requiresBusinessAccount: false,
        oauth: {
            authUrl: 'https://twitter.com/i/oauth2/authorize',
            tokenUrl: 'https://api.twitter.com/2/oauth2/token',
            scope: 'tweet.read,tweet.write,users.read,offline.access',
            clientIdEnv: 'TWITTER_CLIENT_ID',
            clientSecretEnv: 'TWITTER_CLIENT_SECRET',
            usePKCE: true
        }
    },
    youtube: {
        name: 'YouTube',
        icon: 'youtube',
        color: '#FF0000',
        supportsVideo: true,
        maxVideoLength: 12 * 60 * 60,
        aspectRatios: ['16:9', '9:16'],
        requiresBusinessAccount: true,
        oauth: {
            authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
            clientIdEnv: 'GOOGLE_CLIENT_ID',
            clientSecretEnv: 'GOOGLE_CLIENT_SECRET'
        }
    }
};

// OAuth state storage (in production, use Redis or database)
const oauthStates = new Map();
const pkceVerifiers = new Map();

// Base redirect URL
const getRedirectUri = (platform) => {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    return `${baseUrl}/api/social/oauth/${platform}/callback`;
};

// Generate PKCE code verifier and challenge
function generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

// ==================== PLATFORMS ====================

/**
 * Get available platforms with their configurations
 * GET /api/social/platforms
 */
router.get('/platforms', authMiddleware, (req, res) => {
    const platformList = Object.entries(PLATFORMS).map(([id, config]) => {
        const hasClientId = !!process.env[config.oauth?.clientIdEnv];
        return {
            id,
            name: config.name,
            icon: config.icon,
            color: config.color,
            supportsVideo: config.supportsVideo,
            maxVideoLength: config.maxVideoLength,
            aspectRatios: config.aspectRatios,
            requiresBusinessAccount: config.requiresBusinessAccount,
            oauthConfigured: hasClientId
        };
    });
    res.json(platformList);
});

// ==================== OAUTH FLOWS ====================

/**
 * Initiate OAuth flow - returns authorization URL
 * GET /api/social/oauth/:platform/authorize
 */
router.get('/oauth/:platform/authorize', authMiddleware, (req, res) => {
    try {
        const { platform } = req.params;
        const config = PLATFORMS[platform];

        if (!config) {
            return res.status(400).json({ error: 'Invalid platform' });
        }

        const clientId = process.env[config.oauth.clientIdEnv];
        if (!clientId) {
            return res.status(400).json({
                error: `${config.name} OAuth not configured. Set ${config.oauth.clientIdEnv} in environment.`,
                needsSetup: true
            });
        }

        // Generate state for CSRF protection
        const state = crypto.randomBytes(16).toString('hex');
        oauthStates.set(state, {
            platform,
            userId: req.user.id,
            clientId: req.user.companyId || 'default-client-id',
            createdAt: Date.now()
        });

        // Build authorization URL
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: getRedirectUri(platform),
            response_type: 'code',
            scope: config.oauth.scope,
            state
        });

        // Add PKCE for platforms that support it
        if (config.oauth.usePKCE) {
            const { verifier, challenge } = generatePKCE();
            pkceVerifiers.set(state, verifier);
            params.append('code_challenge', challenge);
            params.append('code_challenge_method', 'S256');
        }

        // Platform-specific params
        if (platform === 'youtube') {
            params.append('access_type', 'offline');
            params.append('prompt', 'consent');
        }
        if (platform === 'tiktok') {
            params.set('client_key', clientId);
            params.delete('client_id');
        }

        const authUrl = `${config.oauth.authUrl}?${params.toString()}`;

        res.json({ authUrl, state });
    } catch (error) {
        console.error('OAuth authorize error:', error);
        res.status(500).json({ error: 'Failed to initiate OAuth' });
    }
});

/**
 * OAuth callback - exchange code for tokens
 * GET /api/social/oauth/:platform/callback
 */
router.get('/oauth/:platform/callback', async (req, res) => {
    try {
        const { platform } = req.params;
        const { code, state, error: oauthError } = req.query;

        if (oauthError) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/social?error=${encodeURIComponent(oauthError)}`);
        }

        if (!code || !state) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/social?error=missing_params`);
        }

        const stateData = oauthStates.get(state);
        if (!stateData || stateData.platform !== platform) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/social?error=invalid_state`);
        }

        // Clean up state
        oauthStates.delete(state);

        const config = PLATFORMS[platform];
        const clientId = process.env[config.oauth.clientIdEnv];
        const clientSecret = process.env[config.oauth.clientSecretEnv];

        // Build token request
        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: getRedirectUri(platform)
        });

        // Platform-specific token request handling
        let tokenResponse;
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

        if (platform === 'tiktok') {
            tokenParams.append('client_key', clientId);
            tokenParams.append('client_secret', clientSecret);
        } else if (platform === 'twitter') {
            // Twitter uses Basic auth for token exchange
            headers['Authorization'] = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            if (pkceVerifiers.has(state)) {
                tokenParams.append('code_verifier', pkceVerifiers.get(state));
                pkceVerifiers.delete(state);
            }
        } else {
            tokenParams.append('client_id', clientId);
            tokenParams.append('client_secret', clientSecret);
        }

        // Exchange code for tokens
        const fetch = (await import('node-fetch')).default;
        tokenResponse = await fetch(config.oauth.tokenUrl, {
            method: 'POST',
            headers,
            body: tokenParams.toString()
        });

        const tokens = await tokenResponse.json();

        if (tokens.error || !tokens.access_token) {
            console.error('Token exchange error:', tokens);
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/social?error=token_exchange_failed`);
        }

        // Fetch user profile to get account handle
        let accountHandle = 'connected-account';
        let accountName = config.name + ' Account';

        try {
            const profileInfo = await fetchUserProfile(platform, tokens.access_token);
            accountHandle = profileInfo.handle || accountHandle;
            accountName = profileInfo.name || accountName;
        } catch (profileError) {
            console.warn('Could not fetch profile:', profileError.message);
        }

        // Save account
        const account = {
            id: uuidv4(),
            clientId: stateData.clientId,
            platform,
            accountHandle,
            accountName,
            accessTokenEncrypted: encrypt(tokens.access_token),
            refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
            tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
            scopes: config.oauth.scope.split(/[,\s]+/),
            status: 'active',
            lastSyncAt: new Date().toISOString(),
            postCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        socialAccounts.set(account.id, account);

        // Redirect back to frontend with success
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/social?connected=${platform}&account=${accountHandle}`);
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/social?error=callback_failed`);
    }
});

/**
 * Check OAuth configuration status
 * GET /api/social/oauth/status
 */
router.get('/oauth/status', authMiddleware, (req, res) => {
    const status = {};
    for (const [platform, config] of Object.entries(PLATFORMS)) {
        status[platform] = {
            configured: !!process.env[config.oauth.clientIdEnv],
            clientIdEnv: config.oauth.clientIdEnv,
            clientSecretEnv: config.oauth.clientSecretEnv
        };
    }
    res.json(status);
});

// Helper: Fetch user profile from platform
async function fetchUserProfile(platform, accessToken) {
    const fetch = (await import('node-fetch')).default;

    const endpoints = {
        instagram: {
            url: 'https://graph.instagram.com/me?fields=id,username',
            parseResponse: (data) => ({ handle: data.username, name: data.username })
        },
        facebook: {
            url: 'https://graph.facebook.com/me?fields=id,name',
            parseResponse: (data) => ({ handle: data.id, name: data.name })
        },
        tiktok: {
            url: 'https://open.tiktokapis.com/v2/user/info/?fields=display_name,username',
            parseResponse: (data) => ({ handle: data.data?.user?.username, name: data.data?.user?.display_name })
        },
        linkedin: {
            url: 'https://api.linkedin.com/v2/me',
            parseResponse: (data) => ({ handle: data.id, name: `${data.localizedFirstName} ${data.localizedLastName}` })
        },
        twitter: {
            url: 'https://api.twitter.com/2/users/me',
            parseResponse: (data) => ({ handle: data.data?.username, name: data.data?.name })
        },
        youtube: {
            url: 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
            parseResponse: (data) => ({
                handle: data.items?.[0]?.id,
                name: data.items?.[0]?.snippet?.title
            })
        }
    };

    const endpoint = endpoints[platform];
    if (!endpoint) return { handle: 'unknown', name: 'Unknown' };

    const response = await fetch(endpoint.url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const data = await response.json();
    return endpoint.parseResponse(data);
}

/**
 * Refresh access token for a platform
 * POST /api/social/accounts/:id/refresh-token
 */
router.post('/accounts/:id/refresh-token', authMiddleware, async (req, res) => {
    try {
        const account = socialAccounts.get(req.params.id);

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        if (!account.refreshTokenEncrypted) {
            return res.status(400).json({
                error: 'No refresh token available. Please reconnect the account.',
                requiresReconnect: true
            });
        }

        const config = PLATFORMS[account.platform];
        const refreshToken = decrypt(account.refreshTokenEncrypted);
        const clientId = process.env[config.oauth.clientIdEnv];
        const clientSecret = process.env[config.oauth.clientSecretEnv];

        if (!clientId || !clientSecret) {
            return res.status(400).json({
                error: 'OAuth not configured for this platform',
                requiresReconnect: true
            });
        }

        // Build token refresh request
        const tokenParams = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        });

        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

        // Platform-specific handling
        if (account.platform === 'twitter') {
            headers['Authorization'] = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        } else if (account.platform === 'tiktok') {
            tokenParams.append('client_key', clientId);
            tokenParams.append('client_secret', clientSecret);
        } else {
            tokenParams.append('client_id', clientId);
            tokenParams.append('client_secret', clientSecret);
        }

        const fetch = (await import('node-fetch')).default;
        const tokenResponse = await fetch(config.oauth.tokenUrl, {
            method: 'POST',
            headers,
            body: tokenParams.toString()
        });

        const tokens = await tokenResponse.json();

        if (tokens.error || !tokens.access_token) {
            console.error('Token refresh error:', tokens);

            // Mark account as needing reconnection
            account.status = 'expired';
            account.updatedAt = new Date().toISOString();
            socialAccounts.set(account.id, account);

            return res.status(401).json({
                error: 'Token refresh failed. Please reconnect the account.',
                requiresReconnect: true
            });
        }

        // Update account with new tokens
        account.accessTokenEncrypted = encrypt(tokens.access_token);
        if (tokens.refresh_token) {
            account.refreshTokenEncrypted = encrypt(tokens.refresh_token);
        }
        account.tokenExpiresAt = tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null;
        account.status = 'active';
        account.updatedAt = new Date().toISOString();
        socialAccounts.set(account.id, account);

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            expiresAt: account.tokenExpiresAt
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

/**
 * Check and refresh expired tokens for all accounts
 * POST /api/social/accounts/refresh-expired
 */
router.post('/accounts/refresh-expired', authMiddleware, async (req, res) => {
    try {
        const clientId = req.user.companyId || 'default-client-id';
        const accounts = Array.from(socialAccounts.values())
            .filter(a => a.clientId === clientId && a.status !== 'deleted');

        const results = {
            checked: 0,
            refreshed: [],
            expired: [],
            errors: []
        };

        const now = Date.now();
        const refreshThreshold = 5 * 60 * 1000; // Refresh if expiring within 5 minutes

        for (const account of accounts) {
            results.checked++;

            // Skip if no expiration info or no refresh token
            if (!account.tokenExpiresAt || !account.refreshTokenEncrypted) {
                continue;
            }

            const expiresAt = new Date(account.tokenExpiresAt).getTime();

            // Check if token is expired or expiring soon
            if (expiresAt - now <= refreshThreshold) {
                try {
                    // Attempt to refresh
                    const config = PLATFORMS[account.platform];
                    const refreshToken = decrypt(account.refreshTokenEncrypted);
                    const platformClientId = process.env[config.oauth.clientIdEnv];
                    const clientSecret = process.env[config.oauth.clientSecretEnv];

                    if (!platformClientId || !clientSecret) {
                        results.errors.push({ accountId: account.id, error: 'OAuth not configured' });
                        continue;
                    }

                    const tokenParams = new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: refreshToken,
                        client_id: platformClientId,
                        client_secret: clientSecret
                    });

                    const fetch = (await import('node-fetch')).default;
                    const tokenResponse = await fetch(config.oauth.tokenUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: tokenParams.toString()
                    });

                    const tokens = await tokenResponse.json();

                    if (tokens.access_token) {
                        account.accessTokenEncrypted = encrypt(tokens.access_token);
                        if (tokens.refresh_token) {
                            account.refreshTokenEncrypted = encrypt(tokens.refresh_token);
                        }
                        account.tokenExpiresAt = tokens.expires_in
                            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
                            : null;
                        account.status = 'active';
                        account.updatedAt = new Date().toISOString();
                        socialAccounts.set(account.id, account);
                        results.refreshed.push(account.id);
                    } else {
                        account.status = 'expired';
                        socialAccounts.set(account.id, account);
                        results.expired.push(account.id);
                    }
                } catch (refreshError) {
                    results.errors.push({ accountId: account.id, error: refreshError.message });
                }
            }
        }

        res.json({
            success: true,
            results
        });
    } catch (error) {
        console.error('Bulk token refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh tokens' });
    }
});



// ==================== ACCOUNTS ====================

/**
 * Connect a social media account (manual credential entry for MVP)
 * POST /api/social/accounts
 */
router.post('/accounts', authMiddleware, (req, res) => {
    try {
        const {
            platform,
            accountHandle,
            accountName,
            accessToken,
            refreshToken
        } = req.body;

        if (!platform || !PLATFORMS[platform]) {
            return res.status(400).json({
                error: 'Invalid platform. Supported: ' + Object.keys(PLATFORMS).join(', ')
            });
        }

        if (!accountHandle) {
            return res.status(400).json({ error: 'Account handle is required' });
        }

        if (!accessToken) {
            return res.status(400).json({ error: 'Access token is required' });
        }

        const account = {
            id: uuidv4(),
            clientId: req.user.companyId || 'default-client-id',
            platform,
            accountHandle,
            accountName: accountName || accountHandle,
            accessTokenEncrypted: encrypt(accessToken),
            refreshTokenEncrypted: refreshToken ? encrypt(refreshToken) : null,
            tokenExpiresAt: null,
            scopes: [],
            status: 'active',
            lastSyncAt: null,
            postCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        socialAccounts.set(account.id, account);

        res.status(201).json({
            success: true,
            account: sanitizeAccount(account)
        });
    } catch (error) {
        console.error('Connect account error:', error);
        res.status(500).json({ error: 'Failed to connect account' });
    }
});

/**
 * Get all connected accounts
 * GET /api/social/accounts
 */
router.get('/accounts', authMiddleware, (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { platform } = req.query;

        const accounts = postingQueue.getAccounts(companyId, platform);
        res.json(accounts);
    } catch (error) {
        console.error('Get accounts error:', error);
        res.status(500).json({ error: 'Failed to get accounts' });
    }
});

/**
 * Get a specific account
 * GET /api/social/accounts/:id
 */
router.get('/accounts/:id', authMiddleware, (req, res) => {
    try {
        const account = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(req.params.id);

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.json({
            id: account.id,
            platform: account.platform,
            accountId: account.account_id,
            username: account.username,
            displayName: account.display_name,
            tokenExpiresAt: account.token_expires_at,
            status: account.status,
            createdAt: account.created_at
        });
    } catch (error) {
        console.error('Get account error:', error);
        res.status(500).json({ error: 'Failed to get account' });

    }
});

/**
 * Update account credentials
 * PATCH /api/social/accounts/:id
 */
router.patch('/accounts/:id', authMiddleware, (req, res) => {
    try {
        const account = socialAccounts.get(req.params.id);

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const { accountName, accessToken, refreshToken, status } = req.body;

        if (accountName) account.accountName = accountName;
        if (accessToken) account.accessTokenEncrypted = encrypt(accessToken);
        if (refreshToken) account.refreshTokenEncrypted = encrypt(refreshToken);
        if (status && ['active', 'paused'].includes(status)) account.status = status;

        account.updatedAt = new Date().toISOString();
        socialAccounts.set(account.id, account);

        res.json({
            success: true,
            account: sanitizeAccount(account)
        });
    } catch (error) {
        console.error('Update account error:', error);
        res.status(500).json({ error: 'Failed to update account' });
    }
});

/**
 * Disconnect (delete) an account
 * DELETE /api/social/accounts/:id
 */
router.delete('/accounts/:id', authMiddleware, (req, res) => {
    try {
        const account = socialAccounts.get(req.params.id);

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Soft delete
        account.status = 'deleted';
        account.updatedAt = new Date().toISOString();
        socialAccounts.set(account.id, account);

        res.json({
            success: true,
            message: 'Account disconnected successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to disconnect account' });
    }
});

// ==================== SCHEDULING ====================

/**
 * Schedule a single post
 * POST /api/social/schedule
 */
router.post('/schedule', authMiddleware, (req, res) => {
    try {
        const {
            clipId,
            socialAccountIds,
            scheduledAt,
            caption,
            hashtags = []
        } = req.body;

        if (!clipId) {
            return res.status(400).json({ error: 'clipId is required' });
        }

        if (!socialAccountIds || !Array.isArray(socialAccountIds) || socialAccountIds.length === 0) {
            return res.status(400).json({ error: 'At least one social account ID is required' });
        }

        if (!scheduledAt) {
            return res.status(400).json({ error: 'scheduledAt is required' });
        }

        const scheduledDateTime = new Date(scheduledAt);
        if (scheduledDateTime <= new Date()) {
            return res.status(400).json({ error: 'Scheduled time must be in the future' });
        }

        const posts = socialAccountIds.map(accountId => {
            const account = socialAccounts.get(accountId);
            if (!account) {
                return { error: `Account ${accountId} not found` };
            }

            const post = {
                id: uuidv4(),
                clipId,
                socialAccountId: accountId,
                platform: account.platform,
                caption: caption || '',
                hashtags,
                scheduledAt: scheduledDateTime.toISOString(),
                postedAt: null,
                status: 'scheduled',
                platformPostId: null,
                platformUrl: null,
                engagementMetrics: {},
                errorMessage: null,
                retryCount: 0,
                createdBy: req.user.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            scheduledPosts.set(post.id, post);
            return post;
        });

        // Filter out errors
        const successfulPosts = posts.filter(p => !p.error);
        const errors = posts.filter(p => p.error);

        res.status(201).json({
            success: true,
            posts: successfulPosts,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Schedule post error:', error);
        res.status(500).json({ error: 'Failed to schedule post' });
    }
});

/**
 * Auto-schedule multiple clips across a time period
 * POST /api/social/auto-schedule
 */
router.post('/auto-schedule', authMiddleware, (req, res) => {
    try {
        const {
            clipIds,
            socialAccountIds,
            startDate,
            endDate,
            postsPerDay = 1,
            preferredTimes = [9, 12, 17, 20], // Hours in 24h format
            caption,
            hashtags = []
        } = req.body;

        if (!clipIds || !Array.isArray(clipIds) || clipIds.length === 0) {
            return res.status(400).json({ error: 'clipIds array is required' });
        }

        if (!socialAccountIds || !Array.isArray(socialAccountIds) || socialAccountIds.length === 0) {
            return res.status(400).json({ error: 'socialAccountIds array is required' });
        }

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start >= end) {
            return res.status(400).json({ error: 'endDate must be after startDate' });
        }

        // Calculate schedule
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const totalSlots = daysDiff * postsPerDay;

        const posts = [];
        let clipIndex = 0;

        for (let day = 0; day < daysDiff && clipIndex < clipIds.length; day++) {
            for (let slot = 0; slot < postsPerDay && clipIndex < clipIds.length; slot++) {
                const clipId = clipIds[clipIndex];
                const postDate = new Date(start);
                postDate.setDate(postDate.getDate() + day);

                // Set time based on preferred times
                const timeIndex = slot % preferredTimes.length;
                postDate.setHours(preferredTimes[timeIndex], 0, 0, 0);

                // Create post for each social account
                socialAccountIds.forEach(accountId => {
                    const account = socialAccounts.get(accountId);
                    if (account && account.status === 'active') {
                        const post = {
                            id: uuidv4(),
                            clipId,
                            socialAccountId: accountId,
                            platform: account.platform,
                            caption: caption || '',
                            hashtags,
                            scheduledAt: postDate.toISOString(),
                            postedAt: null,
                            status: 'scheduled',
                            platformPostId: null,
                            platformUrl: null,
                            engagementMetrics: {},
                            errorMessage: null,
                            retryCount: 0,
                            createdBy: req.user.id,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };

                        scheduledPosts.set(post.id, post);
                        posts.push(post);
                    }
                });

                clipIndex++;
            }
        }

        res.status(201).json({
            success: true,
            summary: {
                totalPosts: posts.length,
                clipsScheduled: clipIndex,
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                postsPerDay
            },
            posts
        });
    } catch (error) {
        console.error('Auto-schedule error:', error);
        res.status(500).json({ error: 'Failed to auto-schedule posts' });
    }
});

/**
 * Get all scheduled posts
 * GET /api/social/scheduled
 */
router.get('/scheduled', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'default-client-id';
        const { status, platform, startDate, endDate } = req.query;

        // Get accounts for this client
        const clientAccountIds = Array.from(socialAccounts.values())
            .filter(a => a.clientId === clientId)
            .map(a => a.id);

        let posts = Array.from(scheduledPosts.values())
            .filter(p => clientAccountIds.includes(p.socialAccountId));

        // Apply filters
        if (status) {
            posts = posts.filter(p => p.status === status);
        }

        if (platform) {
            posts = posts.filter(p => p.platform === platform);
        }

        if (startDate) {
            posts = posts.filter(p => new Date(p.scheduledAt) >= new Date(startDate));
        }

        if (endDate) {
            posts = posts.filter(p => new Date(p.scheduledAt) <= new Date(endDate));
        }

        // Sort by scheduled time
        posts = posts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

        // Enrich with account info
        posts = posts.map(p => {
            const account = socialAccounts.get(p.socialAccountId);
            return {
                ...p,
                account: account ? {
                    id: account.id,
                    platform: account.platform,
                    accountHandle: account.accountHandle,
                    accountName: account.accountName
                } : null
            };
        });

        res.json(posts);
    } catch (error) {
        console.error('Get scheduled posts error:', error);
        res.status(500).json({ error: 'Failed to get scheduled posts' });
    }
});

/**
 * Get calendar view of scheduled posts
 * GET /api/social/calendar
 */
router.get('/calendar', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'default-client-id';
        const { month, year } = req.query;

        const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const startOfMonth = new Date(targetYear, targetMonth, 1);
        const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

        // Get accounts for this client
        const clientAccountIds = Array.from(socialAccounts.values())
            .filter(a => a.clientId === clientId)
            .map(a => a.id);

        const posts = Array.from(scheduledPosts.values())
            .filter(p =>
                clientAccountIds.includes(p.socialAccountId) &&
                new Date(p.scheduledAt) >= startOfMonth &&
                new Date(p.scheduledAt) <= endOfMonth
            );

        // Group by date
        const calendar = {};
        posts.forEach(post => {
            const date = post.scheduledAt.split('T')[0];
            if (!calendar[date]) {
                calendar[date] = [];
            }
            const account = socialAccounts.get(post.socialAccountId);
            calendar[date].push({
                id: post.id,
                clipId: post.clipId,
                platform: post.platform,
                accountHandle: account?.accountHandle,
                scheduledAt: post.scheduledAt,
                status: post.status
            });
        });

        res.json({
            month: targetMonth + 1,
            year: targetYear,
            calendar
        });
    } catch (error) {
        console.error('Get calendar error:', error);
        res.status(500).json({ error: 'Failed to get calendar' });
    }
});

/**
 * Update a scheduled post
 * PATCH /api/social/scheduled/:id
 */
router.patch('/scheduled/:id', authMiddleware, (req, res) => {
    try {
        const post = scheduledPosts.get(req.params.id);

        if (!post) {
            return res.status(404).json({ error: 'Scheduled post not found' });
        }

        if (post.status === 'posted') {
            return res.status(400).json({ error: 'Cannot modify a post that has already been posted' });
        }

        const { scheduledAt, caption, hashtags, status } = req.body;

        if (scheduledAt) {
            const newDate = new Date(scheduledAt);
            if (newDate <= new Date()) {
                return res.status(400).json({ error: 'Scheduled time must be in the future' });
            }
            post.scheduledAt = newDate.toISOString();
        }

        if (caption !== undefined) post.caption = caption;
        if (hashtags !== undefined) post.hashtags = hashtags;
        if (status && ['scheduled', 'cancelled'].includes(status)) post.status = status;

        post.updatedAt = new Date().toISOString();
        scheduledPosts.set(post.id, post);

        res.json({
            success: true,
            post
        });
    } catch (error) {
        console.error('Update scheduled post error:', error);
        res.status(500).json({ error: 'Failed to update scheduled post' });
    }
});

/**
 * Cancel a scheduled post
 * DELETE /api/social/scheduled/:id
 */
router.delete('/scheduled/:id', authMiddleware, (req, res) => {
    try {
        const post = scheduledPosts.get(req.params.id);

        if (!post) {
            return res.status(404).json({ error: 'Scheduled post not found' });
        }

        if (post.status === 'posted') {
            return res.status(400).json({ error: 'Cannot cancel a post that has already been posted' });
        }

        post.status = 'cancelled';
        post.updatedAt = new Date().toISOString();
        scheduledPosts.set(post.id, post);

        res.json({
            success: true,
            message: 'Post cancelled successfully'
        });
    } catch (error) {
        console.error('Cancel post error:', error);
        res.status(500).json({ error: 'Failed to cancel post' });
    }
});

// ==================== POSTING (Mock) ====================

/**
 * Execute posting for due posts (would be called by a cron job)
 * POST /api/social/execute-posts
 * In production, this would be handled by a background worker
 */
router.post('/execute-posts', authMiddleware, async (req, res) => {
    try {
        const now = new Date();

        // Find posts that are due
        const duePosts = Array.from(scheduledPosts.values())
            .filter(p =>
                p.status === 'scheduled' &&
                new Date(p.scheduledAt) <= now
            );

        const results = [];

        for (const post of duePosts) {
            // In production, this would call the actual platform APIs
            // For now, we simulate posting
            const success = Math.random() > 0.1; // 90% success rate

            if (success) {
                post.status = 'posted';
                post.postedAt = new Date().toISOString();
                post.platformPostId = `mock-post-${uuidv4().slice(0, 8)}`;
                post.platformUrl = `https://${post.platform}.com/post/${post.platformPostId}`;

                // Update account post count
                const account = socialAccounts.get(post.socialAccountId);
                if (account) {
                    account.postCount = (account.postCount || 0) + 1;
                    account.lastSyncAt = new Date().toISOString();
                    socialAccounts.set(account.id, account);
                }

                results.push({ postId: post.id, status: 'posted' });
            } else {
                post.retryCount = (post.retryCount || 0) + 1;
                post.errorMessage = 'Mock posting failure - would retry';

                if (post.retryCount >= 3) {
                    post.status = 'failed';
                }

                results.push({ postId: post.id, status: 'failed', error: post.errorMessage });
            }

            post.updatedAt = new Date().toISOString();
            scheduledPosts.set(post.id, post);
        }

        res.json({
            success: true,
            processed: duePosts.length,
            results
        });
    } catch (error) {
        console.error('Execute posts error:', error);
        res.status(500).json({ error: 'Failed to execute posts' });
    }
});

// ==================== NEW POSTING ENDPOINTS ====================

/**
 * Publish content immediately to one or more platforms
 * POST /api/social/publish
 */
router.post('/publish', authMiddleware, async (req, res) => {
    try {
        const { platforms, content, mediaPath } = req.body;
        const companyId = req.user.companyId;

        if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
            return res.status(400).json({ error: 'At least one platform is required' });
        }

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const result = await postingQueue.publishToMultiplePlatforms(companyId, platforms, content, mediaPath);

        res.json({
            success: result.success,
            results: result.platformResults
        });
    } catch (error) {
        console.error('Publish error:', error);
        res.status(500).json({ error: 'Failed to publish: ' + error.message });
    }
});

/**
 * Schedule a post for later
 * POST /api/social/posts/schedule
 */
router.post('/posts/schedule', authMiddleware, (req, res) => {
    try {
        const { platforms, content, mediaPath, scheduledFor } = req.body;
        const companyId = req.user.companyId;

        if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
            return res.status(400).json({ error: 'At least one platform is required' });
        }

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        if (!scheduledFor) {
            return res.status(400).json({ error: 'scheduledFor date is required' });
        }

        const scheduledDate = new Date(scheduledFor);
        if (scheduledDate <= new Date()) {
            return res.status(400).json({ error: 'Scheduled time must be in the future' });
        }

        const post = postingQueue.schedulePost({
            companyId,
            platforms,
            content,
            mediaPath,
            scheduledFor: scheduledDate.toISOString()
        });

        res.status(201).json({
            success: true,
            post
        });
    } catch (error) {
        console.error('Schedule error:', error);
        res.status(500).json({ error: 'Failed to schedule post' });
    }
});

/**
 * Get all scheduled posts
 * GET /api/social/posts/scheduled
 */
router.get('/posts/scheduled', authMiddleware, (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { status, upcoming } = req.query;

        const posts = postingQueue.getScheduledPosts(companyId, {
            status,
            upcoming: upcoming === 'true'
        });

        res.json(posts);
    } catch (error) {
        console.error('Get scheduled posts error:', error);
        res.status(500).json({ error: 'Failed to get scheduled posts' });
    }
});

/**
 * Cancel a scheduled post
 * DELETE /api/social/posts/:id
 */
router.delete('/posts/:id', authMiddleware, (req, res) => {
    try {
        const result = postingQueue.cancelScheduledPost(req.params.id);

        if (result.cancelled) {
            res.json({ success: true, message: 'Post cancelled' });
        } else {
            res.status(400).json({ error: 'Could not cancel post (may already be posted or cancelled)' });
        }
    } catch (error) {
        console.error('Cancel post error:', error);
        res.status(500).json({ error: 'Failed to cancel post' });
    }
});

/**
 * Disconnect a social account
 * DELETE /api/social/accounts/:id
 */
router.delete('/accounts/:id', authMiddleware, (req, res) => {
    try {
        postingQueue.disconnectAccount(req.params.id);
        res.json({ success: true, message: 'Account disconnected' });
    } catch (error) {
        console.error('Disconnect error:', error);
        res.status(500).json({ error: 'Failed to disconnect account' });
    }
});

// Helper function to sanitize account for response
function sanitizeAccount(account) {
    const { accessTokenEncrypted, refreshTokenEncrypted, ...safe } = account;
    return {
        ...safe,
        hasAccessToken: !!accessTokenEncrypted,
        hasRefreshToken: !!refreshTokenEncrypted
    };
}

// ==================== APPROVAL WORKFLOWS (Phase 6) ====================

/**
 * Create an approval request
 * POST /api/social/approvals
 */
router.post('/approvals', authMiddleware, (req, res) => {
    try {
        const { contentType, contentId, approverIds, notes, priority } = req.body;
        const companyId = req.user.companyId;

        if (!contentType || !contentId || !approverIds) {
            return res.status(400).json({
                error: 'contentType, contentId, and approverIds are required'
            });
        }

        const approval = approvalWorkflow.createApprovalRequest({
            companyId,
            contentType,
            contentId,
            requesterId: req.user.id,
            approverIds,
            notes,
            priority
        });

        res.status(201).json({ success: true, approval });
    } catch (error) {
        console.error('Create approval error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get pending approvals for current user
 * GET /api/social/approvals/pending
 */
router.get('/approvals/pending', authMiddleware, (req, res) => {
    try {
        const approvals = approvalWorkflow.getPendingApprovals(req.user.id, req.user.companyId);
        res.json(approvals);
    } catch (error) {
        console.error('Get pending approvals error:', error);
        res.status(500).json({ error: 'Failed to get pending approvals' });
    }
});

/**
 * Get all approvals for company
 * GET /api/social/approvals
 */
router.get('/approvals', authMiddleware, (req, res) => {
    try {
        const { status, contentType, limit } = req.query;
        const approvals = approvalWorkflow.getApprovalRequests(req.user.companyId, {
            status,
            contentType,
            limit: limit ? parseInt(limit) : undefined
        });
        res.json(approvals);
    } catch (error) {
        console.error('Get approvals error:', error);
        res.status(500).json({ error: 'Failed to get approvals' });
    }
});

/**
 * Respond to an approval
 * POST /api/social/approvals/:id/respond
 */
router.post('/approvals/:id/respond', authMiddleware, (req, res) => {
    try {
        const { response, comments } = req.body;

        if (!response || !['approve', 'reject', 'request_revision'].includes(response)) {
            return res.status(400).json({
                error: 'Valid response required: approve, reject, or request_revision'
            });
        }

        const approval = approvalWorkflow.respondToApproval(
            req.params.id,
            req.user.id,
            response,
            comments
        );

        res.json({ success: true, approval });
    } catch (error) {
        console.error('Respond to approval error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Cancel an approval request
 * DELETE /api/social/approvals/:id
 */
router.delete('/approvals/:id', authMiddleware, (req, res) => {
    try {
        const result = approvalWorkflow.cancelApproval(req.params.id, req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Cancel approval error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get approval statistics
 * GET /api/social/approvals/stats
 */
router.get('/approvals/stats', authMiddleware, (req, res) => {
    try {
        const stats = approvalWorkflow.getApprovalStats(req.user.companyId);
        res.json(stats);
    } catch (error) {
        console.error('Get approval stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// ==================== AUTO-TAGGING (Phase 6) ====================

/**
 * Create a tagging rule
 * POST /api/social/tagging-rules
 */
router.post('/tagging-rules', authMiddleware, (req, res) => {
    try {
        const rule = autoTagging.createTaggingRule({
            companyId: req.user.companyId,
            ...req.body
        });
        res.status(201).json({ success: true, rule });
    } catch (error) {
        console.error('Create tagging rule error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all tagging rules
 * GET /api/social/tagging-rules
 */
router.get('/tagging-rules', authMiddleware, (req, res) => {
    try {
        const rules = autoTagging.getTaggingRules(req.user.companyId);
        res.json(rules);
    } catch (error) {
        console.error('Get tagging rules error:', error);
        res.status(500).json({ error: 'Failed to get rules' });
    }
});

/**
 * Update a tagging rule
 * PATCH /api/social/tagging-rules/:id
 */
router.patch('/tagging-rules/:id', authMiddleware, (req, res) => {
    try {
        const rule = autoTagging.updateTaggingRule(req.params.id, req.body);
        res.json({ success: true, rule });
    } catch (error) {
        console.error('Update tagging rule error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete a tagging rule
 * DELETE /api/social/tagging-rules/:id
 */
router.delete('/tagging-rules/:id', authMiddleware, (req, res) => {
    try {
        autoTagging.deleteTaggingRule(req.params.id);
        res.json({ success: true, message: 'Rule deleted' });
    } catch (error) {
        console.error('Delete tagging rule error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Analyze content and suggest hashtags
 * POST /api/social/analyze-content
 */
router.post('/analyze-content', authMiddleware, (req, res) => {
    try {
        const { content, platform } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'content is required' });
        }

        // Analyze for category
        const analysis = autoTagging.analyzeContent(content);

        // Apply rules and get hashtags
        const tagging = autoTagging.applyTaggingRules(
            req.user.companyId,
            content,
            platform || 'instagram',
            { category: analysis.primaryCategory }
        );

        res.json({
            analysis,
            suggestedHashtags: tagging.hashtags,
            recommendedHashtags: tagging.recommended,
            platformRules: tagging.platformRules
        });
    } catch (error) {
        console.error('Analyze content error:', error);
        res.status(500).json({ error: 'Failed to analyze content' });
    }
});

/**
 * Generate caption with hashtags
 * POST /api/social/generate-caption
 */
router.post('/generate-caption', authMiddleware, (req, res) => {
    try {
        const { caption, hashtags, platform } = req.body;

        if (!caption) {
            return res.status(400).json({ error: 'caption is required' });
        }

        let finalHashtags = hashtags;

        // If no hashtags provided, analyze and generate
        if (!finalHashtags || finalHashtags.length === 0) {
            const analysis = autoTagging.analyzeContent(caption);
            const tagging = autoTagging.applyTaggingRules(
                req.user.companyId,
                caption,
                platform || 'instagram',
                { category: analysis.primaryCategory }
            );
            finalHashtags = tagging.recommended;
        }

        const finalCaption = autoTagging.generateCaptionWithHashtags(
            caption,
            finalHashtags,
            platform || 'instagram'
        );

        res.json({
            originalCaption: caption,
            hashtags: finalHashtags,
            finalCaption
        });
    } catch (error) {
        console.error('Generate caption error:', error);
        res.status(500).json({ error: 'Failed to generate caption' });
    }
});

/**
 * Get default hashtags by category
 * GET /api/social/hashtags/:category
 */
router.get('/hashtags/:category', authMiddleware, (req, res) => {
    const category = req.params.category.toLowerCase();
    const hashtags = autoTagging.DEFAULT_HASHTAGS[category];

    if (!hashtags) {
        return res.status(404).json({
            error: 'Category not found',
            availableCategories: Object.keys(autoTagging.DEFAULT_HASHTAGS)
        });
    }

    res.json({ category, hashtags });
});

/**
 * Get platform rules
 * GET /api/social/platform-rules/:platform
 */
router.get('/platform-rules/:platform', authMiddleware, (req, res) => {
    const platform = req.params.platform.toLowerCase();
    const rules = autoTagging.PLATFORM_RULES[platform];

    if (!rules) {
        return res.status(404).json({
            error: 'Platform not found',
            availablePlatforms: Object.keys(autoTagging.PLATFORM_RULES)
        });
    }

    res.json({ platform, rules });
});

module.exports = router;
