/**
 * Clip Editor Service
 * 
 * Advanced editing features for video clips:
 * - Timeline editing (adjust start/end times)
 * - Transcript-based editing 
 * - Animated captions with word-by-word highlighting
 * - Filler word detection and removal
 * - Aspect ratio conversion
 */

const { db } = require('../db/db');
const videoProcessor = require('./videoProcessor');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Caption style presets
const CAPTION_STYLES = {
    minimal: {
        fontSize: 'medium',
        fontFamily: 'Inter',
        color: '#FFFFFF',
        backgroundColor: 'transparent',
        position: 'bottom',
        animation: 'none'
    },
    bold: {
        fontSize: 'large',
        fontFamily: 'Inter',
        fontWeight: 'bold',
        color: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.8)',
        position: 'bottom',
        animation: 'word-by-word'
    },
    modern: {
        fontSize: 'large',
        fontFamily: 'Montserrat',
        color: '#FFFFFF',
        backgroundColor: 'transparent',
        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
        position: 'center',
        animation: 'pop'
    },
    neon: {
        fontSize: 'xlarge',
        fontFamily: 'Bebas Neue',
        color: '#00FF00',
        textShadow: '0 0 10px #00FF00, 0 0 20px #00FF00',
        position: 'center',
        animation: 'glow'
    },
    minimal_top: {
        fontSize: 'medium',
        fontFamily: 'Inter',
        color: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.5)',
        position: 'top',
        animation: 'fade'
    }
};

// Common filler words to detect
const FILLER_WORDS = [
    'um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally',
    'so', 'right', 'okay', 'well', 'i mean', 'kind of', 'sort of'
];

/**
 * Get a clip with its editing data
 * @param {string} clipId - Clip ID
 * @returns {Object} - Clip with transcript and timeline data
 */
function getClipForEditing(clipId) {
    const clip = db.prepare(`
        SELECT c.*, v.file_path as video_path, v.duration as video_duration
        FROM clips c
        JOIN videos v ON c.video_id = v.id
        WHERE c.id = ?
    `).get(clipId);

    if (!clip) return null;

    const metadata = clip.metadata ? JSON.parse(clip.metadata) : {};

    return {
        id: clip.id,
        videoId: clip.video_id,
        videoPath: clip.video_path,
        title: clip.title,
        startTime: clip.start_time,
        endTime: clip.end_time,
        duration: clip.duration,
        transcript: clip.transcript,
        transcriptSegments: metadata.transcriptSegments || [],
        captionStyle: metadata.captionStyle || CAPTION_STYLES.bold,
        suggestedCaption: metadata.suggestedCaption,
        aspectRatio: metadata.aspectRatio || '9:16',
        status: clip.status,
        viralityScore: clip.virality_score
    };
}

/**
 * Update clip timeline (start/end times)
 * @param {string} clipId - Clip ID
 * @param {number} startTime - New start time in seconds
 * @param {number} endTime - New end time in seconds
 * @returns {Object} - Updated clip
 */
function updateClipTimeline(clipId, startTime, endTime) {
    const duration = endTime - startTime;

    if (duration <= 0) {
        throw new Error('End time must be greater than start time');
    }

    if (duration > 180) {
        throw new Error('Clip duration cannot exceed 3 minutes');
    }

    db.prepare(`
        UPDATE clips 
        SET start_time = ?, end_time = ?, duration = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(startTime, endTime, duration, clipId);

    return getClipForEditing(clipId);
}

/**
 * Update clip transcript
 * @param {string} clipId - Clip ID
 * @param {string} transcript - New transcript text
 * @param {Array} segments - Optional transcript segments with timing
 * @returns {Object} - Updated clip
 */
function updateClipTranscript(clipId, transcript, segments = null) {
    const clip = db.prepare('SELECT metadata FROM clips WHERE id = ?').get(clipId);
    if (!clip) throw new Error('Clip not found');

    const metadata = clip.metadata ? JSON.parse(clip.metadata) : {};

    if (segments) {
        metadata.transcriptSegments = segments;
    }

    db.prepare(`
        UPDATE clips SET transcript = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(transcript, JSON.stringify(metadata), clipId);

    return getClipForEditing(clipId);
}

/**
 * Update clip caption style
 * @param {string} clipId - Clip ID
 * @param {string|Object} style - Style preset name or custom style object
 * @returns {Object} - Updated clip
 */
function updateClipCaptionStyle(clipId, style) {
    const clip = db.prepare('SELECT metadata FROM clips WHERE id = ?').get(clipId);
    if (!clip) throw new Error('Clip not found');

    const metadata = clip.metadata ? JSON.parse(clip.metadata) : {};

    if (typeof style === 'string' && CAPTION_STYLES[style]) {
        metadata.captionStyle = { ...CAPTION_STYLES[style], preset: style };
    } else if (typeof style === 'object') {
        metadata.captionStyle = { ...CAPTION_STYLES.bold, ...style, preset: 'custom' };
    } else {
        throw new Error('Invalid caption style');
    }

    db.prepare(`
        UPDATE clips SET metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(JSON.stringify(metadata), clipId);

    return getClipForEditing(clipId);
}

/**
 * Detect filler words in transcript
 * @param {string} transcript - Transcript text
 * @returns {Array} - Detected filler words with positions
 */
function detectFillerWords(transcript) {
    const results = [];
    const lowerTranscript = transcript.toLowerCase();

    for (const filler of FILLER_WORDS) {
        let index = 0;
        while ((index = lowerTranscript.indexOf(filler, index)) !== -1) {
            // Check it's a whole word (not part of another word)
            const before = index === 0 ? ' ' : lowerTranscript[index - 1];
            const after = index + filler.length >= lowerTranscript.length ? ' ' : lowerTranscript[index + filler.length];

            if (/[\s,.]/.test(before) && /[\s,.]/.test(after)) {
                results.push({
                    word: filler,
                    position: index,
                    length: filler.length
                });
            }
            index += filler.length;
        }
    }

    return results.sort((a, b) => a.position - b.position);
}

/**
 * Remove filler words from transcript
 * @param {string} transcript - Original transcript
 * @param {Array} fillers - Filler positions to remove (from detectFillerWords)
 * @returns {string} - Cleaned transcript
 */
function removeFillerWords(transcript, fillers = null) {
    if (!fillers) {
        fillers = detectFillerWords(transcript);
    }

    // Remove from end to start to preserve positions
    let result = transcript;
    for (let i = fillers.length - 1; i >= 0; i--) {
        const { position, length } = fillers[i];
        result = result.slice(0, position) + result.slice(position + length);
    }

    // Clean up extra spaces
    return result.replace(/\s+/g, ' ').trim();
}

/**
 * Convert clip to different aspect ratio
 * @param {string} clipId - Clip ID
 * @param {string} aspectRatio - Target aspect ratio ('9:16', '1:1', '4:5', '16:9')
 * @returns {Object} - Updated clip with new aspect ratio setting
 */
function setClipAspectRatio(clipId, aspectRatio) {
    const validRatios = ['9:16', '1:1', '4:5', '16:9'];
    if (!validRatios.includes(aspectRatio)) {
        throw new Error(`Invalid aspect ratio. Valid options: ${validRatios.join(', ')}`);
    }

    const clip = db.prepare('SELECT metadata FROM clips WHERE id = ?').get(clipId);
    if (!clip) throw new Error('Clip not found');

    const metadata = clip.metadata ? JSON.parse(clip.metadata) : {};
    metadata.aspectRatio = aspectRatio;

    db.prepare(`
        UPDATE clips SET metadata = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(JSON.stringify(metadata), clipId);

    return getClipForEditing(clipId);
}

/**
 * Generate the final clip video file
 * @param {string} clipId - Clip ID
 * @returns {Promise<Object>} - Generated clip info
 */
async function generateClipFile(clipId) {
    const clip = getClipForEditing(clipId);
    if (!clip) throw new Error('Clip not found');

    const outputFilename = `${clipId}.mp4`;
    const outputPath = path.join(videoProcessor.CLIPS_DIR, outputFilename);

    // Extract the clip with the specified aspect ratio
    await videoProcessor.extractClip(
        clip.videoPath,
        clip.startTime,
        clip.endTime,
        outputPath,
        { aspectRatio: clip.aspectRatio || '9:16' }
    );

    // Update clip with file path
    db.prepare(`
        UPDATE clips SET file_path = ?, status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(outputPath, clipId);

    // Generate thumbnail
    const thumbnailPath = path.join(videoProcessor.THUMBNAILS_DIR, `${clipId}.jpg`);
    await videoProcessor.generateThumbnail(outputPath, 0, thumbnailPath);

    db.prepare(`
        UPDATE clips SET thumbnail_path = ? WHERE id = ?
    `).run(thumbnailPath, clipId);

    return {
        id: clipId,
        filePath: outputPath,
        thumbnailPath,
        status: 'ready'
    };
}

/**
 * Create transcript segments for word-by-word captions
 * @param {string} transcript - Full transcript text
 * @param {number} startTime - Clip start time
 * @param {number} duration - Clip duration
 * @returns {Array} - Word segments with timing
 */
function createWordSegments(transcript, startTime, duration) {
    const words = transcript.split(/\s+/).filter(w => w.length > 0);
    const avgWordDuration = duration / words.length;

    return words.map((word, index) => ({
        word,
        start: startTime + (index * avgWordDuration),
        end: startTime + ((index + 1) * avgWordDuration),
        index
    }));
}

/**
 * Get available caption style presets
 * @returns {Object} - Available caption styles
 */
function getCaptionStylePresets() {
    return Object.entries(CAPTION_STYLES).map(([name, style]) => ({
        name,
        ...style
    }));
}

/**
 * Duplicate a clip for A/B testing
 * @param {string} clipId - Source clip ID
 * @param {string} newTitle - Title for the duplicate
 * @returns {Object} - New clip
 */
function duplicateClip(clipId, newTitle = null) {
    const original = db.prepare('SELECT * FROM clips WHERE id = ?').get(clipId);
    if (!original) throw new Error('Clip not found');

    const newId = uuidv4();
    const title = newTitle || `${original.title} (copy)`;

    db.prepare(`
        INSERT INTO clips (id, video_id, title, start_time, end_time, duration, virality_score, transcript, status, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(newId, original.video_id, title, original.start_time, original.end_time,
        original.duration, original.virality_score, original.transcript, original.metadata);

    return getClipForEditing(newId);
}

module.exports = {
    getClipForEditing,
    updateClipTimeline,
    updateClipTranscript,
    updateClipCaptionStyle,
    detectFillerWords,
    removeFillerWords,
    setClipAspectRatio,
    generateClipFile,
    createWordSegments,
    getCaptionStylePresets,
    duplicateClip,
    CAPTION_STYLES,
    FILLER_WORDS
};
