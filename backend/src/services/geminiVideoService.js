/**
 * Gemini Video Understanding Service
 * 
 * Uses Gemini's native video understanding to analyze videos
 * and detect viral-worthy moments by actually "watching" the video.
 */

const { GoogleGenerativeAI, FileState } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const fs = require('fs');
const path = require('path');

// Lazy-initialize Gemini client
let genAI = null;
let fileManager = null;
let cachedApiKey = null;

/**
 * Get API key from environment or settings file
 */
function getApiKey() {
    // First check environment variable
    if (process.env.GEMINI_API_KEY) {
        return process.env.GEMINI_API_KEY;
    }

    // Check for settings file (written by Electron store)
    try {
        const settingsPath = path.join(__dirname, '../../data/api-keys.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (settings.google) {
                return settings.google;
            }
        }
    } catch (err) {
        console.log('[GeminiVideo] Could not read settings file:', err.message);
    }

    return null;
}

function getGeminiClient() {
    const apiKey = getApiKey();

    // Reinitialize if API key changed
    if (apiKey && apiKey !== cachedApiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
        fileManager = new GoogleAIFileManager(apiKey);
        cachedApiKey = apiKey;
    }

    if (!genAI) {
        if (!apiKey) {
            throw new Error('Gemini API key not configured. Please add it in Settings > API Keys.');
        }
        genAI = new GoogleGenerativeAI(apiKey);
        fileManager = new GoogleAIFileManager(apiKey);
        cachedApiKey = apiKey;
    }

    return { genAI, fileManager };
}

// Viral clip detection prompt - asks Gemini to watch the video
const VIRAL_DETECTION_PROMPT = `You are an expert video editor and social media strategist. Watch this video carefully and identify 3-8 moments that would make excellent short-form clips for TikTok, Instagram Reels, or YouTube Shorts.

For each viral moment you detect, analyze BOTH the visual and audio elements:
- Visual: facial expressions, gestures, scene changes, product shots, b-roll
- Audio: tone, emphasis, pauses, emotional delivery, key phrases

Return your analysis as a JSON array with this exact structure:
{
  "clips": [
    {
      "startTime": <seconds as number>,
      "endTime": <seconds as number>,
      "viralityScore": <0-100 rating>,
      "hookType": "insight" | "emotion" | "surprise" | "humor" | "cta" | "story",
      "reason": "<why this moment is compelling, mentioning both visual and audio elements>",
      "suggestedCaption": "<viral-worthy caption with emoji for social media>",
      "transcript": "<what is said during this segment>",
      "visualHighlight": "<what makes this visually compelling>"
    }
  ]
}

SCORING CRITERIA:
- 90-100: Exceptional hook + high emotional impact + shareable insight
- 80-89: Strong hook with good engagement potential
- 70-79: Solid content, decent viral potential
- 60-69: Average content, moderate potential
- Below 60: Weak viral potential

Focus on:
1. Strong opening hooks (first 3 seconds must grab attention)
2. Emotional peaks (frustration, excitement, revelation)
3. Key insights or "aha" moments
4. Surprising or unexpected content
5. Clear calls to action
6. Story completeness (clip should feel self-contained)

IMPORTANT: Return ONLY valid JSON, no markdown formatting or extra text.`;

/**
 * Upload a video to Gemini Files API for analysis
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Object>} - Uploaded file info
 */
async function uploadVideoToGemini(videoPath) {
    const { fileManager } = getGeminiClient();

    // Get file info
    const stats = fs.statSync(videoPath);
    const fileName = path.basename(videoPath);
    const mimeType = getMimeType(videoPath);

    console.log(`[GeminiVideo] Uploading video: ${fileName} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);

    // Upload the file
    const uploadResult = await fileManager.uploadFile(videoPath, {
        mimeType: mimeType,
        displayName: fileName
    });

    console.log(`[GeminiVideo] Upload complete. File URI: ${uploadResult.file.uri}`);
    console.log(`[GeminiVideo] File state: ${uploadResult.file.state}`);

    // Wait for file to be processed if needed
    let file = uploadResult.file;
    while (file.state === FileState.PROCESSING) {
        console.log('[GeminiVideo] Waiting for file processing...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const getFileResult = await fileManager.getFile(file.name);
        file = getFileResult;
    }

    if (file.state === FileState.FAILED) {
        throw new Error('Video processing failed in Gemini');
    }

    console.log(`[GeminiVideo] File ready for analysis. State: ${file.state}`);
    return file;
}

/**
 * Analyze a video using Gemini's video understanding
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Array>} - Array of detected clips with virality scores
 */
async function analyzeVideoForClips(videoPath) {
    const { genAI } = getGeminiClient();

    console.log(`[GeminiVideo] Starting video analysis: ${videoPath}`);

    // Upload video to Gemini
    const uploadedFile = await uploadVideoToGemini(videoPath);

    // Get the generative model
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 8192
        }
    });

    console.log('[GeminiVideo] Sending video to Gemini for analysis...');

    // Generate content with video
    const result = await model.generateContent([
        {
            fileData: {
                fileUri: uploadedFile.uri,
                mimeType: uploadedFile.mimeType
            }
        },
        { text: VIRAL_DETECTION_PROMPT }
    ]);

    const responseText = result.response.text();
    console.log('[GeminiVideo] Received analysis response');

    // Parse the JSON response
    let clips = [];
    try {
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*"clips"[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            clips = parsed.clips || [];
        } else {
            // Try parsing as array directly
            const arrayMatch = responseText.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                clips = JSON.parse(arrayMatch[0]);
            }
        }
    } catch (parseError) {
        console.error('[GeminiVideo] Failed to parse response:', parseError);
        console.log('[GeminiVideo] Raw response:', responseText.substring(0, 500));
        throw new Error('Failed to parse Gemini response as JSON');
    }

    console.log(`[GeminiVideo] Detected ${clips.length} viral moments`);

    // Validate and normalize clips
    const validClips = clips
        .filter(clip =>
            typeof clip.startTime === 'number' &&
            typeof clip.endTime === 'number' &&
            clip.endTime > clip.startTime
        )
        .map(clip => ({
            startTime: Math.round(clip.startTime),
            endTime: Math.round(clip.endTime),
            duration: Math.round(clip.endTime - clip.startTime),
            viralityScore: Math.min(100, Math.max(0, clip.viralityScore || 75)),
            hookType: clip.hookType || 'insight',
            reason: clip.reason || 'Viral potential detected',
            suggestedCaption: clip.suggestedCaption || '🔥 Must watch!',
            transcript: clip.transcript || '',
            visualHighlight: clip.visualHighlight || ''
        }))
        .sort((a, b) => b.viralityScore - a.viralityScore);

    console.log(`[GeminiVideo] Returning ${validClips.length} validated clips`);

    // Clean up uploaded file (optional - Gemini auto-deletes after 48hrs)
    try {
        await fileManager.deleteFile(uploadedFile.name);
        console.log('[GeminiVideo] Cleaned up uploaded file');
    } catch (err) {
        console.log('[GeminiVideo] Note: Could not delete uploaded file:', err.message);
    }

    return validClips;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.m4v': 'video/x-m4v'
    };
    return mimeTypes[ext] || 'video/mp4';
}

/**
 * Check if Gemini API is available
 */
function isGeminiAvailable() {
    return !!getApiKey();
}

module.exports = {
    analyzeVideoForClips,
    uploadVideoToGemini,
    isGeminiAvailable,
    VIRAL_DETECTION_PROMPT
};
