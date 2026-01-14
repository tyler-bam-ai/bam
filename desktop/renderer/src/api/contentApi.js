/**
 * Content Engine API Client
 * 
 * Frontend API client for interacting with the Content Engine backend.
 * Handles video upload, transcription, clip detection, and social publishing.
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Get auth headers with JWT token
 */
function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

/**
 * Handle API response, throw on error
 */
async function handleResponse(response) {
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || `API Error: ${response.status}`);
    }
    return data;
}

// ==================== CAMPAIGNS ====================

/**
 * Get all campaigns
 */
export async function getCampaigns() {
    const response = await fetch(`${API_BASE}/content/campaigns`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Create a new campaign
 */
export async function createCampaign(name, description, targetPlatforms = []) {
    const response = await fetch(`${API_BASE}/content/campaigns`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, description, targetPlatforms })
    });
    return handleResponse(response);
}

// ==================== VIDEOS ====================

/**
 * Get all videos
 */
export async function getVideos(campaignId = null) {
    const url = campaignId
        ? `${API_BASE}/content/videos?campaignId=${campaignId}`
        : `${API_BASE}/content/videos`;

    const response = await fetch(url, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Get a single video with its clips
 */
export async function getVideo(videoId) {
    const response = await fetch(`${API_BASE}/content/videos/${videoId}`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Get video processing status
 */
export async function getVideoStatus(videoId) {
    const response = await fetch(`${API_BASE}/content/videos/${videoId}/status`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Upload a video file
 * @param {File} file - Video file to upload
 * @param {string} campaignId - Optional campaign ID
 * @param {function} onProgress - Progress callback (0-100)
 */
export async function uploadVideo(file, campaignId = null, onProgress = null) {
    const token = localStorage.getItem('authToken');
    const formData = new FormData();
    formData.append('video', file);
    if (campaignId) {
        formData.append('campaignId', campaignId);
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(`Upload failed: ${xhr.status}`));
            }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

        xhr.open('POST', `${API_BASE}/content/videos`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
    });
}

/**
 * Import video from YouTube URL
 */
export async function importYouTube(url, campaignId = null) {
    const response = await fetch(`${API_BASE}/content/videos/youtube`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ url, campaignId })
    });
    return handleResponse(response);
}

/**
 * Delete a video
 */
export async function deleteVideo(videoId) {
    const response = await fetch(`${API_BASE}/content/videos/${videoId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

// ==================== TRANSCRIPTION ====================

/**
 * Trigger transcription for a video
 */
export async function transcribeVideo(videoId) {
    const response = await fetch(`${API_BASE}/content/videos/${videoId}/transcribe`, {
        method: 'POST',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Get transcript for a video
 */
export async function getTranscript(videoId) {
    const response = await fetch(`${API_BASE}/content/videos/${videoId}/transcript`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Get clip transcript (subset for time range)
 */
export async function getClipTranscript(videoId, startTime, endTime) {
    const response = await fetch(
        `${API_BASE}/content/videos/${videoId}/transcript/clip?startTime=${startTime}&endTime=${endTime}`,
        { headers: getAuthHeaders() }
    );
    return handleResponse(response);
}

// ==================== CLIP DETECTION ====================

/**
 * Trigger AI clip detection for a video
 */
export async function analyzeVideo(videoId) {
    const response = await fetch(`${API_BASE}/content/videos/${videoId}/analyze`, {
        method: 'POST',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Regenerate clips for a video (re-run AI analysis)
 */
export async function regenerateClips(videoId) {
    const response = await fetch(`${API_BASE}/content/videos/${videoId}/regenerate-clips`, {
        method: 'POST',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Get clips for a video
 */
export async function getClips(videoId) {
    const response = await fetch(`${API_BASE}/content/videos/${videoId}/clips`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

// ==================== CLIP ACTIONS ====================

/**
 * Update a clip (status, title, description, etc.)
 */
export async function updateClip(clipId, updates) {
    const response = await fetch(`${API_BASE}/content/clips/${clipId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
    });
    return handleResponse(response);
}

/**
 * Approve a clip
 */
export async function approveClip(clipId) {
    return updateClip(clipId, { status: 'approved' });
}

/**
 * Reject a clip
 */
export async function rejectClip(clipId) {
    return updateClip(clipId, { status: 'rejected' });
}

/**
 * Schedule a clip for posting
 */
export async function scheduleClip(clipId, scheduledFor, platforms) {
    const response = await fetch(`${API_BASE}/content/clips/${clipId}/schedule`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ scheduledFor, platforms })
    });
    return handleResponse(response);
}

/**
 * Export a clip (generate video file)
 */
export async function exportClip(clipId, options = {}) {
    const response = await fetch(`${API_BASE}/content/clips/${clipId}/export`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(options)
    });
    return handleResponse(response);
}

// ==================== SOCIAL MEDIA ====================

/**
 * Get connected social accounts
 */
export async function getSocialConnections() {
    const response = await fetch(`${API_BASE}/social/connections`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Get OAuth authorization URL for a platform
 */
export async function getSocialAuthUrl(platform) {
    const response = await fetch(`${API_BASE}/social/oauth/${platform}/authorize`, {
        method: 'POST',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Disconnect a social account
 */
export async function disconnectSocialAccount(platform) {
    const response = await fetch(`${API_BASE}/social/connections/${platform}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Get scheduled posts
 */
export async function getScheduledPosts() {
    const response = await fetch(`${API_BASE}/social/posts`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

/**
 * Create a scheduled post
 */
export async function createPost(content, platforms, scheduledFor, mediaPath = null) {
    const response = await fetch(`${API_BASE}/social/posts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content, platforms, scheduledFor, mediaPath })
    });
    return handleResponse(response);
}

/**
 * Get social analytics
 */
export async function getSocialAnalytics(platform = null, period = '7d') {
    const url = platform
        ? `${API_BASE}/social/analytics?platform=${platform}&period=${period}`
        : `${API_BASE}/social/analytics?period=${period}`;

    const response = await fetch(url, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
}

// ==================== POLLING HELPERS ====================

/**
 * Poll video status until it reaches a target status
 * @param {string} videoId - Video ID to poll
 * @param {string[]} targetStatuses - Statuses to stop polling on
 * @param {number} interval - Poll interval in ms (default 2000)
 * @param {number} timeout - Max time to poll in ms (default 300000 = 5 min)
 * @param {function} onStatusChange - Callback when status changes
 */
export async function pollVideoStatus(videoId, targetStatuses, interval = 2000, timeout = 300000, onStatusChange = null) {
    const startTime = Date.now();
    let lastStatus = null;

    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const result = await getVideoStatus(videoId);

                if (result.status !== lastStatus) {
                    lastStatus = result.status;
                    if (onStatusChange) onStatusChange(result.status);
                }

                if (targetStatuses.includes(result.status)) {
                    resolve(result);
                    return;
                }

                if (result.status.includes('error')) {
                    reject(new Error(result.error || `Video processing failed: ${result.status}`));
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    reject(new Error('Polling timeout'));
                    return;
                }

                setTimeout(poll, interval);
            } catch (error) {
                reject(error);
            }
        };

        poll();
    });
}

/**
 * Full video processing pipeline: upload → transcribe → analyze
 */
export async function processVideoFull(file, campaignId = null, onProgress = null) {
    // Step 1: Upload
    if (onProgress) onProgress({ step: 'uploading', progress: 0 });
    const uploadResult = await uploadVideo(file, campaignId, (percent) => {
        if (onProgress) onProgress({ step: 'uploading', progress: percent });
    });

    const videoId = uploadResult.video.id;

    // Step 2: Wait for processing
    if (onProgress) onProgress({ step: 'processing', progress: 0 });
    await pollVideoStatus(videoId, ['ready', 'transcribed', 'analyzed'], 2000, 300000, (status) => {
        if (onProgress) onProgress({ step: status, progress: 50 });
    });

    // Step 3: Transcribe
    if (onProgress) onProgress({ step: 'transcribing', progress: 60 });
    await transcribeVideo(videoId);
    await pollVideoStatus(videoId, ['transcribed', 'analyzed'], 2000, 300000);

    // Step 4: Analyze for clips
    if (onProgress) onProgress({ step: 'analyzing', progress: 80 });
    await analyzeVideo(videoId);
    await pollVideoStatus(videoId, ['analyzed'], 2000, 300000);

    // Step 5: Get clips
    if (onProgress) onProgress({ step: 'complete', progress: 100 });
    const clips = await getClips(videoId);

    return {
        videoId,
        clips
    };
}

// Export all functions
export default {
    // Campaigns
    getCampaigns,
    createCampaign,
    // Videos
    getVideos,
    getVideo,
    getVideoStatus,
    uploadVideo,
    importYouTube,
    deleteVideo,
    // Transcription
    transcribeVideo,
    getTranscript,
    getClipTranscript,
    // Clip Detection
    analyzeVideo,
    regenerateClips,
    getClips,
    // Clip Actions
    updateClip,
    approveClip,
    rejectClip,
    scheduleClip,
    exportClip,
    // Social Media
    getSocialConnections,
    getSocialAuthUrl,
    disconnectSocialAccount,
    getScheduledPosts,
    createPost,
    getSocialAnalytics,
    // Helpers
    pollVideoStatus,
    processVideoFull
};
