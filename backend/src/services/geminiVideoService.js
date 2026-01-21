/**
 * Gemini Video Analysis Service
 * 
 * Analyzes screen recordings using Gemini 2.0 Flash to generate
 * comprehensive transcripts with visual descriptions.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

/**
 * Get Gemini API key from various sources
 * Priority: request header > local storage > Railway env
 */
function getGeminiApiKey(requestKey = null) {
    // 1. Check request header (passed from frontend)
    if (requestKey && requestKey.trim()) {
        return requestKey;
    }

    // 2. Check Railway environment variable
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
        return process.env.GEMINI_API_KEY;
    }

    // 3. Check legacy Google API key env
    if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim()) {
        return process.env.GOOGLE_API_KEY;
    }

    return null;
}

/**
 * Analyze a video file using Gemini 2.0 Flash
 * @param {string} videoPath - Path to the video file
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<{transcript: string, summary: string}>}
 */
async function analyzeVideo(videoPath, apiKey) {
    if (!apiKey) {
        throw new Error('Gemini API key is required for video analysis');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Use gemini-2.0-flash for video understanding
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Read video file as base64
    const videoBuffer = fs.readFileSync(videoPath);
    const videoBase64 = videoBuffer.toString('base64');

    // Determine MIME type from extension
    const ext = path.extname(videoPath).toLowerCase();
    const mimeTypes = {
        '.webm': 'video/webm',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo'
    };
    const mimeType = mimeTypes[ext] || 'video/webm';

    console.log(`[GEMINI] Analyzing video: ${path.basename(videoPath)} (${mimeType})`);
    console.log(`[GEMINI] Video size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Create the prompt for detailed video analysis
    const prompt = `You are analyzing a screen recording. Your task is to create a comprehensive, detailed transcript that captures EVERYTHING happening in the video.

For each moment in the video, describe:
1. **Spoken Words**: Transcribe exactly what the person says, word for word
2. **Visual Actions**: Describe every mouse movement, click, scroll, and keyboard action
3. **Screen Content**: Describe what is visible on screen, including:
   - Window titles and application names
   - Button labels, menu items, and text visible
   - Any changes in the UI when something is clicked
   - Error messages or notifications that appear

Format your response as a timeline transcript like this:

[00:00] *Screen shows [describe initial screen state]*
[00:02] "Hello, I'm going to show you..." *Mouse moves to the top menu bar*
[00:05] *Clicks on "File" menu* The dropdown opens showing options: New, Open, Save...
[00:08] "First, we click on Settings..." *Cursor moves down to "Settings", clicks*
[00:10] *Settings window opens, showing tabs for General, Appearance, Advanced*

Continue this format for the ENTIRE video. Be EXTREMELY detailed and descriptive. 
Every mouse movement, every click, every word spoken should be captured.
Use *asterisks* for visual descriptions and "quotes" for spoken words.

If there is no audio or the person doesn't speak, focus entirely on the visual descriptions.

At the end, provide a brief 2-3 sentence summary of what the recording demonstrates.`;

    try {
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: mimeType,
                    data: videoBase64
                }
            },
            { text: prompt }
        ]);

        const response = await result.response;
        const text = response.text();

        console.log(`[GEMINI] Analysis complete. Transcript length: ${text.length} chars`);

        // Extract summary from the end if present
        const summaryMatch = text.match(/(?:Summary|In summary|This recording)[:.]?\s*(.+)$/is);
        const summary = summaryMatch ? summaryMatch[1].trim() : '';

        return {
            transcript: text,
            summary: summary || 'Screen recording analyzed successfully.',
            model: 'gemini-2.0-flash',
            analyzedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('[GEMINI] Video analysis error:', error);

        // Check for specific error types
        if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('Invalid API key')) {
            throw new Error('Invalid Gemini API key. Please check your key in Settings.');
        }

        if (error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('quota')) {
            throw new Error('Gemini API quota exceeded. Please wait or upgrade your plan.');
        }

        if (error.message?.includes('too large') || error.message?.includes('size')) {
            throw new Error('Video file too large for Gemini. Try a shorter recording (under 2 minutes).');
        }

        throw new Error(`Video analysis failed: ${error.message}`);
    }
}

/**
 * Analyze video from a Buffer (for uploaded files)
 * @param {Buffer} videoBuffer - Video file buffer
 * @param {string} mimeType - MIME type of the video
 * @param {string} apiKey - Gemini API key
 */
async function analyzeVideoBuffer(videoBuffer, mimeType, apiKey) {
    if (!apiKey) {
        throw new Error('Gemini API key is required for video analysis');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const videoBase64 = videoBuffer.toString('base64');

    console.log(`[GEMINI] Analyzing video buffer (${mimeType})`);
    console.log(`[GEMINI] Video size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    const prompt = `You are analyzing a screen recording. Your task is to create a comprehensive, detailed transcript that captures EVERYTHING happening in the video.

For each moment in the video, describe:
1. **Spoken Words**: Transcribe exactly what the person says, word for word
2. **Visual Actions**: Describe every mouse movement, click, scroll, and keyboard action
3. **Screen Content**: Describe what is visible on screen, including:
   - Window titles and application names
   - Button labels, menu items, and text visible
   - Any changes in the UI when something is clicked
   - Error messages or notifications that appear

Format your response as a timeline transcript like this:

[00:00] *Screen shows [describe initial screen state]*
[00:02] "Hello, I'm going to show you..." *Mouse moves to the top menu bar*
[00:05] *Clicks on "File" menu* The dropdown opens showing options: New, Open, Save...
[00:08] "First, we click on Settings..." *Cursor moves down to "Settings", clicks*
[00:10] *Settings window opens, showing tabs for General, Appearance, Advanced*

Continue this format for the ENTIRE video. Be EXTREMELY detailed and descriptive. 
Every mouse movement, every click, every word spoken should be captured.
Use *asterisks* for visual descriptions and "quotes" for spoken words.

If there is no audio or the person doesn't speak, focus entirely on the visual descriptions.

At the end, provide a brief 2-3 sentence summary of what the recording demonstrates.`;

    try {
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: mimeType || 'video/webm',
                    data: videoBase64
                }
            },
            { text: prompt }
        ]);

        const response = await result.response;
        const text = response.text();

        console.log(`[GEMINI] Analysis complete. Transcript length: ${text.length} chars`);

        const summaryMatch = text.match(/(?:Summary|In summary|This recording)[:.]?\s*(.+)$/is);
        const summary = summaryMatch ? summaryMatch[1].trim() : '';

        return {
            transcript: text,
            summary: summary || 'Screen recording analyzed successfully.',
            model: 'gemini-2.0-flash',
            analyzedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('[GEMINI] Video analysis error:', error);

        if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('Invalid API key')) {
            throw new Error('Invalid Gemini API key. Please check your key in Settings.');
        }

        if (error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('quota')) {
            throw new Error('Gemini API quota exceeded. Please wait or upgrade your plan.');
        }

        if (error.message?.includes('too large') || error.message?.includes('size')) {
            throw new Error('Video file too large for Gemini. Try a shorter recording (under 2 minutes).');
        }

        throw new Error(`Video analysis failed: ${error.message}`);
    }
}

module.exports = {
    getGeminiApiKey,
    analyzeVideo,
    analyzeVideoBuffer
};
