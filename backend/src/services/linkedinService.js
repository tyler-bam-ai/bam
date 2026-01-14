/**
 * LinkedIn API Service
 * 
 * Handles OAuth 2.0 authentication and posting to LinkedIn
 */

const axios = require('axios');

// OAuth 2.0 configuration
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_CALLBACK_URL = process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:3001/api/social/oauth/linkedin/callback';

// LinkedIn API base URLs
const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const API_URL = 'https://api.linkedin.com/v2';

// In-memory store for OAuth state
const oauthStates = new Map();

/**
 * Generate LinkedIn OAuth 2.0 authorization URL
 * @param {string} companyId - Company initiating the connection
 * @returns {Object} - Auth URL and state
 */
function getAuthorizationUrl(companyId) {
    if (!LINKEDIN_CLIENT_ID) {
        throw new Error('LinkedIn client ID not configured');
    }

    // Generate random state for CSRF protection
    const state = Buffer.from(JSON.stringify({
        companyId,
        random: Math.random().toString(36).substring(7)
    })).toString('base64');

    // Store state for callback verification
    oauthStates.set(state, {
        companyId,
        createdAt: Date.now()
    });

    // Clean up old states
    for (const [key, value] of oauthStates.entries()) {
        if (Date.now() - value.createdAt > 10 * 60 * 1000) {
            oauthStates.delete(key);
        }
    }

    // LinkedIn OAuth scopes
    const scopes = [
        'openid',
        'profile',
        'email',
        'w_member_social'  // Required for posting
    ].join(' ');

    const authUrl = `${AUTH_URL}?` + new URLSearchParams({
        response_type: 'code',
        client_id: LINKEDIN_CLIENT_ID,
        redirect_uri: LINKEDIN_CALLBACK_URL,
        state,
        scope: scopes
    }).toString();

    return { authUrl, state };
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

    const { companyId } = storedState;
    oauthStates.delete(state);

    // Exchange code for tokens
    const tokenResponse = await axios.post(TOKEN_URL, new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: LINKEDIN_CALLBACK_URL,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    const { access_token, expires_in, refresh_token } = tokenResponse.data;

    // Get user profile
    const profileResponse = await axios.get(`${API_URL}/userinfo`, {
        headers: {
            'Authorization': `Bearer ${access_token}`
        }
    });

    const profile = profileResponse.data;

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    return {
        companyId,
        accessToken: access_token,
        refreshToken: refresh_token || null,
        expiresAt,
        user: {
            id: profile.sub,
            name: profile.name,
            email: profile.email,
            profileImageUrl: profile.picture
        }
    };
}

/**
 * Refresh an expired access token
 * @param {string} refreshToken - Refresh token
 * @returns {Object} - New token info
 */
async function refreshAccessToken(refreshToken) {
    const tokenResponse = await axios.post(TOKEN_URL, new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    const { access_token, expires_in, refresh_token } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    return {
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken,
        expiresAt
    };
}

/**
 * Create a text post on LinkedIn
 * @param {string} accessToken - User's access token
 * @param {string} authorUrn - LinkedIn member URN (urn:li:person:xxx)
 * @param {string} text - Post content
 * @returns {Object} - Post data
 */
async function createPost(accessToken, authorUrn, text) {
    const response = await axios.post(`${API_URL}/posts`, {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        visibility: 'PUBLIC',
        commentary: text,
        distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: []
        }
    }, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202401'
        }
    });

    return {
        id: response.headers['x-restli-id'] || response.data.id,
        text
    };
}

/**
 * Create a post with an image
 * @param {string} accessToken - User's access token
 * @param {string} authorUrn - LinkedIn member URN
 * @param {string} text - Post content
 * @param {Buffer} imageBuffer - Image data
 * @returns {Object} - Post data
 */
async function createPostWithImage(accessToken, authorUrn, text, imageBuffer) {
    // Step 1: Initialize upload
    const initResponse = await axios.post(`${API_URL}/images?action=initializeUpload`, {
        initializeUploadRequest: {
            owner: authorUrn
        }
    }, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
        }
    });

    const { uploadUrl, image } = initResponse.data.value;

    // Step 2: Upload image
    await axios.put(uploadUrl, imageBuffer, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream'
        }
    });

    // Step 3: Create post with image
    const response = await axios.post(`${API_URL}/posts`, {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        visibility: 'PUBLIC',
        commentary: text,
        content: {
            media: {
                id: image
            }
        },
        distribution: {
            feedDistribution: 'MAIN_FEED'
        }
    }, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202401'
        }
    });

    return {
        id: response.headers['x-restli-id'] || response.data.id,
        text,
        imageUrn: image
    };
}

/**
 * Get user's LinkedIn profile
 * @param {string} accessToken - User's access token
 * @returns {Object} - User profile
 */
async function getProfile(accessToken) {
    const response = await axios.get(`${API_URL}/userinfo`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    return {
        id: response.data.sub,
        name: response.data.name,
        email: response.data.email,
        profileImageUrl: response.data.picture,
        locale: response.data.locale
    };
}

/**
 * Delete a post
 * @param {string} accessToken - User's access token
 * @param {string} postUrn - URN of the post to delete
 */
async function deletePost(accessToken, postUrn) {
    await axios.delete(`${API_URL}/posts/${encodeURIComponent(postUrn)}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
        }
    });
    return { deleted: true };
}

module.exports = {
    getAuthorizationUrl,
    handleCallback,
    refreshAccessToken,
    createPost,
    createPostWithImage,
    getProfile,
    deletePost
};
