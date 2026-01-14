/**
 * Twitter/X API Service
 * 
 * Handles OAuth 2.0 authentication and posting to Twitter/X
 * Uses twitter-api-v2 library for API interactions
 */

const { TwitterApi } = require('twitter-api-v2');
const { db } = require('../db/db');

// OAuth 2.0 configuration
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const TWITTER_CALLBACK_URL = process.env.TWITTER_CALLBACK_URL || 'http://localhost:3001/api/social/oauth/twitter/callback';

// In-memory store for OAuth state (use Redis in production)
const oauthStates = new Map();

/**
 * Generate Twitter OAuth 2.0 authorization URL
 * @param {string} companyId - Company initiating the connection
 * @returns {Object} - Auth URL and state
 */
function getAuthorizationUrl(companyId) {
    if (!TWITTER_CLIENT_ID) {
        throw new Error('Twitter client ID not configured');
    }

    const client = new TwitterApi({
        clientId: TWITTER_CLIENT_ID,
        clientSecret: TWITTER_CLIENT_SECRET,
    });

    // Generate auth link with PKCE
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
        TWITTER_CALLBACK_URL,
        {
            scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
        }
    );

    // Store state for callback verification
    oauthStates.set(state, {
        companyId,
        codeVerifier,
        createdAt: Date.now()
    });

    // Clean up old states (older than 10 minutes)
    for (const [key, value] of oauthStates.entries()) {
        if (Date.now() - value.createdAt > 10 * 60 * 1000) {
            oauthStates.delete(key);
        }
    }

    return { authUrl: url, state };
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

    const client = new TwitterApi({
        clientId: TWITTER_CLIENT_ID,
        clientSecret: TWITTER_CLIENT_SECRET,
    });

    // Exchange code for tokens
    const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: TWITTER_CALLBACK_URL,
    });

    // Get user profile
    const loggedClient = new TwitterApi(accessToken);
    const { data: user } = await loggedClient.v2.me({
        'user.fields': ['profile_image_url', 'public_metrics']
    });

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return {
        companyId,
        accessToken,
        refreshToken,
        expiresAt,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            profileImageUrl: user.profile_image_url,
            metrics: user.public_metrics
        }
    };
}

/**
 * Refresh an expired access token
 * @param {string} refreshToken - Refresh token
 * @returns {Object} - New token info
 */
async function refreshAccessToken(refreshToken) {
    const client = new TwitterApi({
        clientId: TWITTER_CLIENT_ID,
        clientSecret: TWITTER_CLIENT_SECRET,
    });

    const { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn } =
        await client.refreshOAuth2Token(refreshToken);

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt
    };
}

/**
 * Post a tweet
 * @param {string} accessToken - User's access token
 * @param {string} text - Tweet text (max 280 chars)
 * @param {Object} options - Additional options (media, reply, etc.)
 * @returns {Object} - Tweet data
 */
async function postTweet(accessToken, text, options = {}) {
    const client = new TwitterApi(accessToken);

    const tweetData = { text };

    // Add media if provided
    if (options.mediaIds && options.mediaIds.length > 0) {
        tweetData.media = { media_ids: options.mediaIds };
    }

    // Add reply if this is a reply
    if (options.replyToTweetId) {
        tweetData.reply = { in_reply_to_tweet_id: options.replyToTweetId };
    }

    const { data: tweet } = await client.v2.tweet(tweetData);

    return {
        id: tweet.id,
        text: tweet.text,
        url: `https://twitter.com/i/status/${tweet.id}`
    };
}

/**
 * Upload media to Twitter
 * @param {string} accessToken - User's access token
 * @param {Buffer|string} media - Media buffer or file path
 * @param {string} type - 'image' or 'video'
 * @returns {string} - Media ID
 */
async function uploadMedia(accessToken, media, type = 'image') {
    const client = new TwitterApi(accessToken);

    // Upload media
    const mediaId = await client.v1.uploadMedia(media, {
        mimeType: type === 'video' ? 'video/mp4' : 'image/jpeg',
        target: 'tweet'
    });

    return mediaId;
}

/**
 * Get user's Twitter profile
 * @param {string} accessToken - User's access token
 * @returns {Object} - User profile
 */
async function getProfile(accessToken) {
    const client = new TwitterApi(accessToken);

    const { data: user } = await client.v2.me({
        'user.fields': ['profile_image_url', 'public_metrics', 'description', 'created_at']
    });

    return {
        id: user.id,
        username: user.username,
        name: user.name,
        bio: user.description,
        profileImageUrl: user.profile_image_url,
        followers: user.public_metrics?.followers_count,
        following: user.public_metrics?.following_count,
        tweets: user.public_metrics?.tweet_count
    };
}

/**
 * Delete a tweet
 * @param {string} accessToken - User's access token
 * @param {string} tweetId - ID of tweet to delete
 */
async function deleteTweet(accessToken, tweetId) {
    const client = new TwitterApi(accessToken);
    await client.v2.deleteTweet(tweetId);
    return { deleted: true };
}

/**
 * Get recent tweets from user's timeline
 * @param {string} accessToken - User's access token
 * @param {number} count - Number of tweets to fetch
 */
async function getTimeline(accessToken, count = 10) {
    const client = new TwitterApi(accessToken);

    const { data: user } = await client.v2.me();
    const tweets = await client.v2.userTimeline(user.id, {
        max_results: count,
        'tweet.fields': ['created_at', 'public_metrics']
    });

    return tweets.data?.map(t => ({
        id: t.id,
        text: t.text,
        createdAt: t.created_at,
        likes: t.public_metrics?.like_count,
        retweets: t.public_metrics?.retweet_count,
        replies: t.public_metrics?.reply_count
    })) || [];
}

module.exports = {
    getAuthorizationUrl,
    handleCallback,
    refreshAccessToken,
    postTweet,
    uploadMedia,
    getProfile,
    deleteTweet,
    getTimeline
};
