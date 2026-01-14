/**
 * Unified Social Posting Queue Service
 * 
 * Manages scheduling, queuing, and multi-platform posting
 * Integrates with all social media services
 */

const { db } = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Import platform services
const twitterService = require('./twitterService');
const linkedinService = require('./linkedinService');
const metaService = require('./metaService');
const tiktokService = require('./tiktokService');

// Encryption for storing tokens
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-key-32-chars-long!!';

/**
 * Encrypt sensitive data (tokens)
 */
function encrypt(text) {
    if (!text) return null;
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data
 */
function decrypt(encryptedText) {
    if (!encryptedText) return null;
    try {
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const [ivHex, encrypted] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error('Decryption failed:', e);
        return null;
    }
}

/**
 * Save or update a connected social account
 * @param {Object} accountData - Account data from OAuth callback
 * @returns {Object} - Saved account
 */
function saveAccount(accountData) {
    const { companyId, platform, user, accessToken, refreshToken, expiresAt, metadata } = accountData;

    // Check if account already exists
    const existing = db.prepare(`
        SELECT id FROM social_accounts 
        WHERE company_id = ? AND platform = ? AND account_id = ?
    `).get(companyId, platform, user.id);

    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = encrypt(refreshToken);
    const metadataJson = JSON.stringify(metadata || {});

    if (existing) {
        // Update existing account
        db.prepare(`
            UPDATE social_accounts 
            SET access_token_enc = ?, refresh_token_enc = ?, token_expires_at = ?,
                username = ?, display_name = ?, metadata = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(encryptedAccess, encryptedRefresh, expiresAt, user.username, user.name, metadataJson, existing.id);

        return { id: existing.id, updated: true };
    } else {
        // Create new account
        const id = uuidv4();
        db.prepare(`
            INSERT INTO social_accounts (id, company_id, platform, account_id, username, display_name, 
                access_token_enc, refresh_token_enc, token_expires_at, status, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        `).run(id, companyId, platform, user.id, user.username || user.email, user.name,
            encryptedAccess, encryptedRefresh, expiresAt, metadataJson);

        return { id, created: true };
    }
}

/**
 * Get connected accounts for a company
 * @param {string} companyId - Company ID
 * @param {string} platform - Optional platform filter
 * @returns {Array} - Connected accounts
 */
function getAccounts(companyId, platform = null) {
    let query = `SELECT * FROM social_accounts WHERE company_id = ? AND status = 'active'`;
    const params = [companyId];

    if (platform) {
        query += ' AND platform = ?';
        params.push(platform);
    }

    const accounts = db.prepare(query).all(...params);

    return accounts.map(a => ({
        id: a.id,
        platform: a.platform,
        accountId: a.account_id,
        username: a.username,
        displayName: a.display_name,
        tokenExpiresAt: a.token_expires_at,
        status: a.status,
        metadata: a.metadata ? JSON.parse(a.metadata) : {},
        createdAt: a.created_at
    }));
}

/**
 * Get decrypted tokens for an account
 * @param {string} accountId - Account ID
 * @returns {Object} - Decrypted tokens
 */
function getAccountTokens(accountId) {
    const account = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(accountId);
    if (!account) return null;

    return {
        accessToken: decrypt(account.access_token_enc),
        refreshToken: decrypt(account.refresh_token_enc),
        expiresAt: account.token_expires_at
    };
}

/**
 * Schedule a post for later publishing
 * @param {Object} postData - Post data
 * @returns {Object} - Scheduled post
 */
function schedulePost(postData) {
    const { companyId, platforms, content, mediaPath, scheduledFor } = postData;

    const id = uuidv4();
    const platformsJson = JSON.stringify(platforms);
    const mediaPaths = mediaPath ? JSON.stringify([mediaPath]) : null;

    db.prepare(`
        INSERT INTO scheduled_posts (id, company_id, platforms, content, media_paths, scheduled_for, status)
        VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
    `).run(id, companyId, platformsJson, content, mediaPaths, scheduledFor);

    return {
        id,
        platforms,
        content,
        scheduledFor,
        status: 'scheduled'
    };
}

/**
 * Get scheduled posts for a company
 * @param {string} companyId - Company ID
 * @param {Object} filters - Optional filters
 * @returns {Array} - Scheduled posts
 */
function getScheduledPosts(companyId, filters = {}) {
    let query = `SELECT * FROM scheduled_posts WHERE company_id = ?`;
    const params = [companyId];

    if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
    }

    if (filters.upcoming) {
        query += ' AND scheduled_for > CURRENT_TIMESTAMP';
    }

    query += ' ORDER BY scheduled_for ASC';

    const posts = db.prepare(query).all(...params);

    return posts.map(p => ({
        id: p.id,
        platforms: JSON.parse(p.platforms),
        content: p.content,
        mediaPaths: p.media_paths ? JSON.parse(p.media_paths) : [],
        scheduledFor: p.scheduled_for,
        status: p.status,
        postedAt: p.posted_at,
        error: p.error_message,
        createdAt: p.created_at
    }));
}

/**
 * Process due posts (called by scheduler)
 * @returns {Array} - Results of processed posts
 */
async function processDuePosts() {
    const duePosts = db.prepare(`
        SELECT * FROM scheduled_posts 
        WHERE status = 'scheduled' AND scheduled_for <= CURRENT_TIMESTAMP
    `).all();

    const results = [];

    for (const post of duePosts) {
        const platforms = JSON.parse(post.platforms);
        const result = await publishToMultiplePlatforms(post.company_id, platforms, post.content, post.media_paths);

        // Update post status
        if (result.success) {
            db.prepare(`
                UPDATE scheduled_posts SET status = 'posted', posted_at = CURRENT_TIMESTAMP, 
                    metadata = ? WHERE id = ?
            `).run(JSON.stringify(result.platformResults), post.id);
        } else {
            db.prepare(`
                UPDATE scheduled_posts SET status = 'failed', error_message = ? WHERE id = ?
            `).run(result.error, post.id);
        }

        results.push({ postId: post.id, ...result });
    }

    return results;
}

/**
 * Publish content to multiple platforms
 * @param {string} companyId - Company ID
 * @param {Array} platforms - Array of platform names
 * @param {string} content - Post content
 * @param {string} mediaPath - Optional media path
 * @returns {Object} - Publish results
 */
async function publishToMultiplePlatforms(companyId, platforms, content, mediaPath = null) {
    const results = {};
    let allSuccess = true;

    for (const platform of platforms) {
        try {
            results[platform] = await publishToPlatform(companyId, platform, content, mediaPath);
        } catch (error) {
            console.error(`Failed to publish to ${platform}:`, error);
            results[platform] = { error: error.message };
            allSuccess = false;
        }
    }

    return {
        success: allSuccess,
        platformResults: results
    };
}

/**
 * Publish to a single platform
 * @param {string} companyId - Company ID
 * @param {string} platform - Platform name
 * @param {string} content - Post content
 * @param {string} mediaPath - Optional media path
 * @returns {Object} - Platform-specific result
 */
async function publishToPlatform(companyId, platform, content, mediaPath = null) {
    // Get connected account for this platform
    const accounts = getAccounts(companyId, platform);
    if (accounts.length === 0) {
        throw new Error(`No ${platform} account connected`);
    }

    const account = accounts[0]; // Use first connected account
    const tokens = getAccountTokens(account.id);

    if (!tokens || !tokens.accessToken) {
        throw new Error(`No valid tokens for ${platform} account`);
    }

    // Check if token is expired and refresh if needed
    if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
        await refreshAccountToken(account.id, platform, tokens.refreshToken);
        // Re-fetch tokens
        const newTokens = getAccountTokens(account.id);
        tokens.accessToken = newTokens.accessToken;
    }

    // Publish based on platform
    switch (platform) {
        case 'twitter':
            return await twitterService.postTweet(tokens.accessToken, content);

        case 'linkedin':
            const metadata = account.metadata || {};
            return await linkedinService.createPost(tokens.accessToken, `urn:li:person:${account.accountId}`, content);

        case 'facebook':
            // For Facebook, we need page access token
            return await metaService.createFacebookPost(tokens.accessToken, account.accountId, content);

        case 'instagram':
            if (!mediaPath) {
                throw new Error('Instagram requires an image for posting');
            }
            return await metaService.createInstagramPost(tokens.accessToken, account.accountId, mediaPath, content);

        case 'tiktok':
            if (!mediaPath) {
                throw new Error('TikTok requires a video for posting');
            }
            // TikTok video upload is more complex - this is simplified
            throw new Error('TikTok video posting requires file upload - use dedicated endpoint');

        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}

/**
 * Refresh an expired account token
 * @param {string} accountId - Account ID
 * @param {string} platform - Platform name
 * @param {string} refreshToken - Refresh token
 */
async function refreshAccountToken(accountId, platform, refreshToken) {
    let newTokens;

    switch (platform) {
        case 'twitter':
            newTokens = await twitterService.refreshAccessToken(refreshToken);
            break;
        case 'linkedin':
            newTokens = await linkedinService.refreshAccessToken(refreshToken);
            break;
        case 'tiktok':
            newTokens = await tiktokService.refreshAccessToken(refreshToken);
            break;
        default:
            throw new Error(`Token refresh not supported for ${platform}`);
    }

    // Update tokens in database
    db.prepare(`
        UPDATE social_accounts 
        SET access_token_enc = ?, refresh_token_enc = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(encrypt(newTokens.accessToken), encrypt(newTokens.refreshToken), newTokens.expiresAt, accountId);
}

/**
 * Disconnect a social account
 * @param {string} accountId - Account ID
 */
function disconnectAccount(accountId) {
    db.prepare(`UPDATE social_accounts SET status = 'disconnected' WHERE id = ?`).run(accountId);
    return { disconnected: true };
}

/**
 * Cancel a scheduled post
 * @param {string} postId - Post ID
 */
function cancelScheduledPost(postId) {
    const result = db.prepare(`
        UPDATE scheduled_posts SET status = 'cancelled' WHERE id = ? AND status = 'scheduled'
    `).run(postId);

    return { cancelled: result.changes > 0 };
}

/**
 * Start the scheduling worker (call this on server startup)
 * Checks for due posts every minute
 */
function startScheduler() {
    console.log('📅 Starting social posting scheduler...');

    // Check for due posts every minute
    setInterval(async () => {
        try {
            const processed = await processDuePosts();
            if (processed.length > 0) {
                console.log(`📤 Processed ${processed.length} scheduled posts`);
            }
        } catch (error) {
            console.error('Scheduler error:', error);
        }
    }, 60 * 1000); // Every minute
}

module.exports = {
    // Account management
    saveAccount,
    getAccounts,
    getAccountTokens,
    disconnectAccount,

    // Scheduling
    schedulePost,
    getScheduledPosts,
    cancelScheduledPost,
    processDuePosts,

    // Publishing
    publishToMultiplePlatforms,
    publishToPlatform,

    // Scheduler
    startScheduler,

    // Utilities
    encrypt,
    decrypt
};
