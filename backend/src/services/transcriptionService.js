/**
 * Transcription Service
 * 
 * Uses OpenAI Whisper API to transcribe video audio with word-level timestamps.
 * Integrates with videoProcessor for audio extraction.
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/db');
const videoProcessor = require('./videoProcessor');

// Lazy-initialize OpenAI client (only when needed)
let openai = null;

function getOpenAIClient() {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set. Get your key at https://platform.openai.com/api-keys');
        }
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    return openai;
}

// Audio temp directory
const AUDIO_DIR = path.join(__dirname, '../../uploads/audio');
if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * Transcribe a video by extracting audio and sending to OpenAI Whisper
 * @param {string} videoId - Video ID from database
 * @returns {Promise<Object>} - Transcript with segments
 */
async function transcribeVideo(videoId) {
    // Get video from database
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);
    if (!video) {
        throw new Error(`Video not found: ${videoId}`);
    }

    if (!video.file_path || !fs.existsSync(video.file_path)) {
        throw new Error(`Video file not found: ${video.file_path}`);
    }

    console.log(`[Transcription] Starting transcription for video: ${video.title}`);

    // Extract audio from video
    const audioPath = path.join(AUDIO_DIR, `${videoId}.wav`);
    await videoProcessor.extractAudio(video.file_path, audioPath);
    console.log(`[Transcription] Audio extracted to: ${audioPath}`);

    try {
        // Transcribe with OpenAI Whisper
        const result = await transcribeAudio(audioPath);

        // Save transcript to database
        const transcriptId = await saveTranscript(videoId, result);

        // Update video status
        db.prepare(`
            UPDATE videos SET status = 'transcribed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(videoId);

        // Clean up audio file
        fs.unlinkSync(audioPath);

        return {
            transcriptId,
            text: result.text,
            duration: result.duration,
            segments: result.segments,
            wordCount: result.text.split(/\s+/).length
        };
    } catch (error) {
        // Clean up audio file on error
        if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
        }
        throw error;
    }
}

/**
 * Transcribe an audio file using OpenAI Whisper API
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<Object>} - Transcription result with word timings
 */
async function transcribeAudio(audioPath) {
    const audioFile = fs.createReadStream(audioPath);
    const model = process.env.TRANSCRIPTION_MODEL || 'whisper-1';

    console.log(`[Transcription] Sending to OpenAI (model: ${model})`);

    const client = getOpenAIClient();
    const response = await client.audio.transcriptions.create({
        file: audioFile,
        model: model,
        response_format: 'verbose_json',
        timestamp_granularity: ['word', 'segment']
    });

    return {
        text: response.text,
        language: response.language,
        duration: response.duration,
        segments: response.segments || [],
        words: response.words || []
    };
}

/**
 * Save transcript and word segments to database
 * @param {string} videoId - Video ID
 * @param {Object} transcription - Transcription result from OpenAI
 * @returns {string} - Transcript ID
 */
async function saveTranscript(videoId, transcription) {
    const transcriptId = uuidv4();

    // Save main transcript
    db.prepare(`
        INSERT INTO video_transcripts (id, video_id, full_text, language, duration)
        VALUES (?, ?, ?, ?, ?)
    `).run(transcriptId, videoId, transcription.text, transcription.language, transcription.duration);

    // Save word-level segments for caption sync
    if (transcription.words && transcription.words.length > 0) {
        const insertWord = db.prepare(`
            INSERT INTO transcript_words (id, transcript_id, word, start_time, end_time)
            VALUES (?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((words) => {
            for (const word of words) {
                insertWord.run(uuidv4(), transcriptId, word.word, word.start, word.end);
            }
        });

        insertMany(transcription.words);
        console.log(`[Transcription] Saved ${transcription.words.length} word timings`);
    }

    // Save segment-level data (sentences/phrases)
    if (transcription.segments && transcription.segments.length > 0) {
        const insertSegment = db.prepare(`
            INSERT INTO transcript_segments (id, transcript_id, text, start_time, end_time)
            VALUES (?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((segments) => {
            for (const seg of segments) {
                insertSegment.run(uuidv4(), transcriptId, seg.text, seg.start, seg.end);
            }
        });

        insertMany(transcription.segments);
        console.log(`[Transcription] Saved ${transcription.segments.length} segments`);
    }

    return transcriptId;
}

/**
 * Get transcript for a video
 * @param {string} videoId - Video ID
 * @returns {Object|null} - Transcript with words and segments
 */
function getTranscript(videoId) {
    const transcript = db.prepare(`
        SELECT * FROM video_transcripts WHERE video_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(videoId);

    if (!transcript) return null;

    // Get word timings
    const words = db.prepare(`
        SELECT word, start_time, end_time FROM transcript_words 
        WHERE transcript_id = ? ORDER BY start_time
    `).all(transcript.id);

    // Get segments
    const segments = db.prepare(`
        SELECT text, start_time, end_time FROM transcript_segments 
        WHERE transcript_id = ? ORDER BY start_time
    `).all(transcript.id);

    return {
        id: transcript.id,
        videoId: transcript.video_id,
        text: transcript.full_text,
        language: transcript.language,
        duration: transcript.duration,
        words: words.map(w => ({
            word: w.word,
            start: w.start_time,
            end: w.end_time
        })),
        segments: segments.map(s => ({
            text: s.text,
            start: s.start_time,
            end: s.end_time
        })),
        createdAt: transcript.created_at
    };
}

/**
 * Get transcript segment at a specific time
 * @param {string} transcriptId - Transcript ID
 * @param {number} time - Time in seconds
 * @returns {Object|null} - Segment containing the timestamp
 */
function getSegmentAtTime(transcriptId, time) {
    return db.prepare(`
        SELECT text, start_time, end_time FROM transcript_segments 
        WHERE transcript_id = ? AND start_time <= ? AND end_time >= ?
        LIMIT 1
    `).get(transcriptId, time, time);
}

/**
 * Get words within a time range (for clip transcripts)
 * @param {string} transcriptId - Transcript ID
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @returns {Array} - Words in the range
 */
function getWordsInRange(transcriptId, startTime, endTime) {
    return db.prepare(`
        SELECT word, start_time, end_time FROM transcript_words 
        WHERE transcript_id = ? AND start_time >= ? AND end_time <= ?
        ORDER BY start_time
    `).all(transcriptId, startTime, endTime);
}

/**
 * Generate clip transcript from video transcript
 * @param {string} videoId - Video ID
 * @param {number} startTime - Clip start time
 * @param {number} endTime - Clip end time
 * @returns {Object} - Clip transcript with adjusted timings
 */
function getClipTranscript(videoId, startTime, endTime) {
    const transcript = getTranscript(videoId);
    if (!transcript) return null;

    // Get words in clip range
    const clipWords = transcript.words.filter(
        w => w.start >= startTime && w.end <= endTime
    ).map(w => ({
        word: w.word,
        // Adjust timing relative to clip start
        start: w.start - startTime,
        end: w.end - startTime
    }));

    // Get segments in clip range
    const clipSegments = transcript.segments.filter(
        s => s.start < endTime && s.end > startTime
    ).map(s => ({
        text: s.text,
        start: Math.max(0, s.start - startTime),
        end: Math.min(endTime - startTime, s.end - startTime)
    }));

    // Build clip text
    const clipText = clipWords.map(w => w.word).join(' ');

    return {
        text: clipText,
        words: clipWords,
        segments: clipSegments,
        duration: endTime - startTime
    };
}

module.exports = {
    transcribeVideo,
    transcribeAudio,
    getTranscript,
    getSegmentAtTime,
    getWordsInRange,
    getClipTranscript
};
