/**
 * TikTok API Service
 * 
 * Handles OAuth 2.0 authentication and posting to TikTok
 * Uses TikTok Content Posting API
 */

const axios = require('axios');

// OAuth 2.0 configuration
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_ID;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const TIKTOK_CALLBACK_URL = process.env.TIKTOK_CALLBACK_URL || 'http://localhost:3001/api/social/oauth/tiktok/callback';

// TikTok API URLs
const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const API_URL = 'https://open.tiktokapis.com/v2';

// In-memory store for OAuth state
const oauthStates = new Map();

/**
 * Generate TikTok OAuth authorization URL
 * @param {string} companyId - Company initiating the connection
 * @returns {Object} - Auth URL and state
 */
function getAuthorizationUrl(companyId) {
    if (!TIKTOK_CLIENT_KEY) {
        throw new Error('TikTok client key not configured');
    }

    const state = Buffer.from(JSON.stringify({
        companyId,
        random: Math.random().toString(36).substring(7)
    })).toString('base64');

    // Code verifier for PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    oauthStates.set(state, {
        companyId,
        codeVerifier,
        createdAt: Date.now()
    });

    // Clean up old states
    for (const [key, value] of oauthStates.entries()) {
        if (Date.now() - value.createdAt > 10 * 60 * 1000) {
            oauthStates.delete(key);
        }
    }

    // TikTok scopes
    const scopes = [
        'user.info.basic',
        'video.list',
        'video.publish',
        'video.upload'
    ].join(',');

    const authUrl = `${AUTH_URL}?` + new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        response_type: 'code',
        scope: scopes,
        redirect_uri: TIKTOK_CALLBACK_URL,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
    }).toString();

    return { authUrl, state };
}

/**
 * Generate PKCE code verifier
 */
function generateCodeVerifier() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let verifier = '';
    for (let i = 0; i < 64; i++) {
        verifier += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return verifier;
}

/**
 * Generate PKCE code challenge from verifier
 */
function generateCodeChallenge(verifier) {
    const crypto = require('crypto');
    return crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from callback
 * @param {string} state - State parameter for verification
 * @returns {Object} - Token info and user profile
 */
async function handleCallback(code, state) {
    const storedState = oauthStates.get(state);

    if (!storedState) {
        throw new Error('Invalid or expired OAuth state');
    }

    const { companyId, codeVerifier } = storedState;
    oauthStates.delete(state);

    // Exchange code for tokens
    const tokenResponse = await axios.post(TOKEN_URL, new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: TIKTOK_CALLBACK_URL,
        code_verifier: codeVerifier
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    const { access_token, refresh_token, expires_in, open_id } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Get user profile
    const profile = await getProfile(access_token, open_id);

    return {
        companyId,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        openId: open_id,
        user: profile
    };
}

/**
 * Refresh an expired access token
 * @param {string} refreshToken - Refresh token
 * @returns {Object} - New token info
 */
async function refreshAccessToken(refreshToken) {
    const tokenResponse = await axios.post(TOKEN_URL, new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt
    };
}

/**
 * Get TikTok user profile
 * @param {string} accessToken - User's access token
 * @param {string} openId - User's TikTok open ID
 * @returns {Object} - User profile
 */
async function getProfile(accessToken, openId) {
    const response = await axios.get(`${API_URL}/user/info/`, {
        params: {
            fields: 'open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count'
        },
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    const data = response.data.data?.user || {};
    return {
        id: openId || data.open_id,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        followers: data.follower_count,
        following: data.following_count,
        likes: data.likes_count
    };
}

/**
 * Initialize video upload to TikTok
 * @param {string} accessToken - User's access token
 * @param {number} fileSize - Size of video file in bytes
 * @returns {Object} - Upload info
 */
async function initVideoUpload(accessToken, fileSize) {
    const response = await axios.post(`${API_URL}/post/publish/inbox/video/init/`, {
        source_info: {
            source: 'FILE_UPLOAD',
            video_size: fileSize,
            chunk_size: 10 * 1024 * 1024 // 10MB chunks
        }
    }, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
        }
    });

    return {
        publishId: response.data.data.publish_id,
        uploadUrl: response.data.data.upload_url
    };
}

/**
 * Upload video chunk to TikTok
 * @param {string} uploadUrl - Upload URL from init
 * @param {Buffer} chunk - Video chunk data
 * @param {number} start - Byte offset start
 * @param {number} end - Byte offset end
 * @param {number} totalSize - Total file size
 */
async function uploadVideoChunk(uploadUrl, chunk, start, end, totalSize) {
    await axios.put(uploadUrl, chunk, {
        headers: {
            'Content-Type': 'video/mp4',
            'Content-Range': `bytes ${start}-${end}/${totalSize}`
        }
    });
}

/**
 * Publish uploaded video to TikTok
 * @param {string} accessToken - User's access token
 * @param {string} publishId - Publish ID from init
 * @param {string} caption - Video caption (hashtags included)
 * @returns {Object} - Published video info
 */
async function publishVideo(accessToken, publishId, caption) {
    const response = await axios.post(`${API_URL}/post/publish/video/`, {
        publish_id: publishId,
        post_info: {
            title: caption,
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_stitch: false,
            disable_comment: false
        }
    }, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
        }
    });

    return {
        publishId: response.data.data.publish_id,
        status: 'PROCESSING'
    };
}

/**
 * Check video publish status
 * @param {string} accessToken - User's access token
 * @param {string} publishId - Publish ID
 * @returns {Object} - Publish status
 */
async function checkPublishStatus(accessToken, publishId) {
    const response = await axios.post(`${API_URL}/post/publish/status/fetch/`, {
        publish_id: publishId
    }, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
        }
    });

    return {
        status: response.data.data.status,
        videoId: response.data.data.video_id,
        failReason: response.data.data.fail_reason
    };
}

/**
 * Get user's recent videos
 * @param {string} accessToken - User's access token
 * @param {number} maxCount - Maximum number of videos
 * @returns {Array} - List of videos
 */
async function getVideos(accessToken, maxCount = 10) {
    const response = await axios.post(`${API_URL}/video/list/`, {
        max_count: maxCount,
        fields: ['id', 'create_time', 'cover_image_url', 'share_url', 'title', 'duration', 'like_count', 'comment_count', 'share_count', 'view_count']
    }, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
        }
    });

    return (response.data.data?.videos || []).map(v => ({
        id: v.id,
        title: v.title,
        coverUrl: v.cover_image_url,
        shareUrl: v.share_url,
        duration: v.duration,
        createdAt: new Date(v.create_time * 1000).toISOString(),
        likes: v.like_count,
        comments: v.comment_count,
        shares: v.share_count,
        views: v.view_count
    }));
}

module.exports = {
    getAuthorizationUrl,
    handleCallback,
    refreshAccessToken,
    getProfile,
    initVideoUpload,
    uploadVideoChunk,
    publishVideo,
    checkPublishStatus,
    getVideos
};
