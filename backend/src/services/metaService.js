/**
 * Meta (Instagram/Facebook) API Service
 * 
 * Handles OAuth for Facebook/Instagram and posting
 * Uses the Graph API for Instagram and Facebook
 */

const axios = require('axios');

// OAuth 2.0 configuration
const META_APP_ID = process.env.FACEBOOK_CLIENT_ID || process.env.INSTAGRAM_CLIENT_ID;
const META_APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET || process.env.INSTAGRAM_CLIENT_SECRET;
const META_CALLBACK_URL = process.env.META_CALLBACK_URL || 'http://localhost:3001/api/social/oauth/meta/callback';

// Graph API base URL
const GRAPH_API = 'https://graph.facebook.com/v19.0';
const OAUTH_URL = 'https://www.facebook.com/v19.0/dialog/oauth';

// In-memory store for OAuth state
const oauthStates = new Map();

/**
 * Generate Meta OAuth authorization URL
 * Requests permissions for both Facebook and Instagram
 * @param {string} companyId - Company initiating the connection
 * @param {string} platform - 'facebook', 'instagram', or 'both'
 * @returns {Object} - Auth URL and state
 */
function getAuthorizationUrl(companyId, platform = 'both') {
    if (!META_APP_ID) {
        throw new Error('Meta App ID not configured');
    }

    const state = Buffer.from(JSON.stringify({
        companyId,
        platform,
        random: Math.random().toString(36).substring(7)
    })).toString('base64');

    oauthStates.set(state, {
        companyId,
        platform,
        createdAt: Date.now()
    });

    // Clean up old states
    for (const [key, value] of oauthStates.entries()) {
        if (Date.now() - value.createdAt > 10 * 60 * 1000) {
            oauthStates.delete(key);
        }
    }

    // Permissions needed
    const scopes = [
        'public_profile',
        'email',
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',        // Facebook posting
        'instagram_basic',
        'instagram_content_publish', // Instagram posting
        'instagram_manage_comments',
        'business_management'
    ].join(',');

    const authUrl = `${OAUTH_URL}?` + new URLSearchParams({
        client_id: META_APP_ID,
        redirect_uri: META_CALLBACK_URL,
        state,
        scope: scopes,
        response_type: 'code'
    }).toString();

    return { authUrl, state };
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from callback
 * @param {string} state - State parameter for verification
 * @returns {Object} - Token info and connected accounts
 */
async function handleCallback(code, state) {
    const storedState = oauthStates.get(state);

    if (!storedState) {
        throw new Error('Invalid or expired OAuth state');
    }

    const { companyId, platform } = storedState;
    oauthStates.delete(state);

    // Exchange code for short-lived token
    const tokenResponse = await axios.get(`${GRAPH_API}/oauth/access_token`, {
        params: {
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            redirect_uri: META_CALLBACK_URL,
            code
        }
    });

    const shortLivedToken = tokenResponse.data.access_token;

    // Exchange for long-lived token (60 days)
    const longLivedResponse = await axios.get(`${GRAPH_API}/oauth/access_token`, {
        params: {
            grant_type: 'fb_exchange_token',
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            fb_exchange_token: shortLivedToken
        }
    });

    const { access_token: accessToken, expires_in } = longLivedResponse.data;
    const expiresAt = new Date(Date.now() + (expires_in || 60 * 24 * 60 * 60) * 1000).toISOString();

    // Get user's Facebook profile and connected pages
    const profileResponse = await axios.get(`${GRAPH_API}/me`, {
        params: {
            fields: 'id,name,email,picture',
            access_token: accessToken
        }
    });

    // Get connected Instagram Business accounts
    const accounts = await getConnectedAccounts(accessToken);

    return {
        companyId,
        platform,
        accessToken,
        expiresAt,
        user: {
            id: profileResponse.data.id,
            name: profileResponse.data.name,
            email: profileResponse.data.email,
            profileImageUrl: profileResponse.data.picture?.data?.url
        },
        accounts // Facebook pages and Instagram accounts
    };
}

/**
 * Get connected Facebook pages and Instagram accounts
 * @param {string} accessToken - User's access token
 * @returns {Array} - List of connected accounts
 */
async function getConnectedAccounts(accessToken) {
    const accounts = [];

    // Get Facebook Pages
    const pagesResponse = await axios.get(`${GRAPH_API}/me/accounts`, {
        params: {
            fields: 'id,name,access_token,instagram_business_account{id,name,username,profile_picture_url}',
            access_token: accessToken
        }
    });

    for (const page of pagesResponse.data.data || []) {
        // Add Facebook Page
        accounts.push({
            platform: 'facebook',
            type: 'page',
            id: page.id,
            name: page.name,
            accessToken: page.access_token
        });

        // Add connected Instagram account if exists
        if (page.instagram_business_account) {
            const ig = page.instagram_business_account;
            accounts.push({
                platform: 'instagram',
                type: 'business',
                id: ig.id,
                username: ig.username,
                name: ig.name || ig.username,
                profileImageUrl: ig.profile_picture_url,
                pageAccessToken: page.access_token // Instagram uses page token
            });
        }
    }

    return accounts;
}

/**
 * Create a Facebook Page post
 * @param {string} pageAccessToken - Page access token
 * @param {string} pageId - Facebook Page ID
 * @param {string} message - Post content
 * @param {Object} options - Additional options
 * @returns {Object} - Post data
 */
async function createFacebookPost(pageAccessToken, pageId, message, options = {}) {
    const postData = { message };

    if (options.link) {
        postData.link = options.link;
    }

    const response = await axios.post(`${GRAPH_API}/${pageId}/feed`, postData, {
        params: { access_token: pageAccessToken }
    });

    return {
        id: response.data.id,
        message,
        url: `https://facebook.com/${response.data.id}`
    };
}

/**
 * Create an Instagram post (image required)
 * @param {string} pageAccessToken - Page access token (used for IG)
 * @param {string} igAccountId - Instagram Business Account ID
 * @param {string} imageUrl - Public URL of the image
 * @param {string} caption - Post caption
 * @returns {Object} - Post data
 */
async function createInstagramPost(pageAccessToken, igAccountId, imageUrl, caption) {
    // Step 1: Create media container
    const containerResponse = await axios.post(`${GRAPH_API}/${igAccountId}/media`, null, {
        params: {
            image_url: imageUrl,
            caption,
            access_token: pageAccessToken
        }
    });

    const containerId = containerResponse.data.id;

    // Step 2: Wait for container to be ready (simple polling)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Publish the container
    const publishResponse = await axios.post(`${GRAPH_API}/${igAccountId}/media_publish`, null, {
        params: {
            creation_id: containerId,
            access_token: pageAccessToken
        }
    });

    return {
        id: publishResponse.data.id,
        caption,
        containerId
    };
}

/**
 * Create an Instagram Reel
 * @param {string} pageAccessToken - Page access token
 * @param {string} igAccountId - Instagram Business Account ID
 * @param {string} videoUrl - Public URL of the video
 * @param {string} caption - Reel caption
 * @returns {Object} - Reel data
 */
async function createInstagramReel(pageAccessToken, igAccountId, videoUrl, caption) {
    // Step 1: Create reel container
    const containerResponse = await axios.post(`${GRAPH_API}/${igAccountId}/media`, null, {
        params: {
            media_type: 'REELS',
            video_url: videoUrl,
            caption,
            access_token: pageAccessToken
        }
    });

    const containerId = containerResponse.data.id;

    // Step 2: Check container status and wait until ready
    let status = 'IN_PROGRESS';
    let attempts = 0;
    while (status === 'IN_PROGRESS' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

        const statusResponse = await axios.get(`${GRAPH_API}/${containerId}`, {
            params: {
                fields: 'status_code',
                access_token: pageAccessToken
            }
        });

        status = statusResponse.data.status_code;
        attempts++;
    }

    if (status !== 'FINISHED') {
        throw new Error(`Reel processing failed with status: ${status}`);
    }

    // Step 3: Publish the container
    const publishResponse = await axios.post(`${GRAPH_API}/${igAccountId}/media_publish`, null, {
        params: {
            creation_id: containerId,
            access_token: pageAccessToken
        }
    });

    return {
        id: publishResponse.data.id,
        caption,
        containerId
    };
}

/**
 * Get Instagram account insights
 * @param {string} pageAccessToken - Page access token
 * @param {string} igAccountId - Instagram Business Account ID
 * @returns {Object} - Account insights
 */
async function getInstagramInsights(pageAccessToken, igAccountId) {
    const response = await axios.get(`${GRAPH_API}/${igAccountId}`, {
        params: {
            fields: 'followers_count,follows_count,media_count,username,name,profile_picture_url',
            access_token: pageAccessToken
        }
    });

    return {
        followers: response.data.followers_count,
        following: response.data.follows_count,
        posts: response.data.media_count,
        username: response.data.username,
        name: response.data.name,
        profileImageUrl: response.data.profile_picture_url
    };
}

module.exports = {
    getAuthorizationUrl,
    handleCallback,
    getConnectedAccounts,
    createFacebookPost,
    createInstagramPost,
    createInstagramReel,
    getInstagramInsights
};
