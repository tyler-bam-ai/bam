/**
 * Caption Service
 * 
 * Generates ASS/SRT subtitles with styling and uses FFmpeg to burn
 * captions into exported video clips.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/db');
const transcriptionService = require('./transcriptionService');

// Output directories
const EXPORTS_DIR = path.join(__dirname, '../../uploads/exports');
const SUBTITLES_DIR = path.join(__dirname, '../../uploads/subtitles');

// Ensure directories exist
[EXPORTS_DIR, SUBTITLES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Caption style presets
const CAPTION_STYLES = {
    animated: {
        fontName: 'Arial',
        fontSize: 18,
        primaryColor: '&H00FFFFFF', // White
        outlineColor: '&H00000000', // Black outline
        backColor: '&H80000000',    // Semi-transparent black
        outline: 3,
        shadow: 1,
        bold: true,
        alignment: 2, // Bottom center
        marginV: 50
    },
    bold: {
        fontName: 'Impact',
        fontSize: 24,
        primaryColor: '&H00FFFF00', // Yellow
        outlineColor: '&H00000000',
        backColor: '&H00000000',
        outline: 4,
        shadow: 2,
        bold: true,
        alignment: 2,
        marginV: 40
    },
    minimal: {
        fontName: 'Helvetica',
        fontSize: 14,
        primaryColor: '&H00FFFFFF',
        outlineColor: '&H00000000',
        backColor: '&H00000000',
        outline: 1,
        shadow: 0,
        bold: false,
        alignment: 2,
        marginV: 60
    },
    karaoke: {
        fontName: 'Arial',
        fontSize: 20,
        primaryColor: '&H0000FFFF', // Cyan
        secondaryColor: '&H00FFFFFF', // White for unhighlighted
        outlineColor: '&H00000000',
        backColor: '&H00000000',
        outline: 2,
        shadow: 1,
        bold: true,
        alignment: 2,
        marginV: 45
    },
    news: {
        fontName: 'Roboto',
        fontSize: 16,
        primaryColor: '&H00FFFFFF',
        outlineColor: '&H00000000',
        backColor: '&HCC000000', // Dark background
        outline: 0,
        shadow: 0,
        bold: false,
        alignment: 2,
        marginV: 30
    }
};

/**
 * Generate ASS (Advanced SubStation Alpha) subtitle file
 * @param {Array} words - Word-level timing data
 * @param {Object} options - Styling options
 * @returns {string} - Path to generated ASS file
 */
function generateASSSubtitles(words, options = {}) {
    const style = CAPTION_STYLES[options.style] || CAPTION_STYLES.animated;
    const assId = uuidv4();
    const assPath = path.join(SUBTITLES_DIR, `${assId}.ass`);

    // ASS Header
    let ass = `[Script Info]
Title: BAM.ai Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${style.fontSize},${style.primaryColor},${style.secondaryColor || style.primaryColor},${style.outlineColor},${style.backColor},${style.bold ? -1 : 0},0,0,0,100,100,0,0,1,${style.outline},${style.shadow},${style.alignment},10,10,${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Group words into caption segments (3-5 words per segment)
    const segments = groupWordsIntoSegments(words, options.wordsPerLine || 4);

    // Generate dialogue lines
    for (const segment of segments) {
        const startTime = formatASSTime(segment.start);
        const endTime = formatASSTime(segment.end);
        const text = segment.text.replace(/\n/g, '\\N');

        ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
    }

    fs.writeFileSync(assPath, ass);
    console.log(`[Captions] Generated ASS file: ${assPath}`);

    return assPath;
}

/**
 * Generate SRT subtitle file (simpler format)
 * @param {Array} words - Word-level timing data
 * @param {Object} options - Options
 * @returns {string} - Path to generated SRT file
 */
function generateSRTSubtitles(words, options = {}) {
    const srtId = uuidv4();
    const srtPath = path.join(SUBTITLES_DIR, `${srtId}.srt`);

    const segments = groupWordsIntoSegments(words, options.wordsPerLine || 5);

    let srt = '';
    let index = 1;

    for (const segment of segments) {
        const startTime = formatSRTTime(segment.start);
        const endTime = formatSRTTime(segment.end);

        srt += `${index}\n${startTime} --> ${endTime}\n${segment.text}\n\n`;
        index++;
    }

    fs.writeFileSync(srtPath, srt);
    console.log(`[Captions] Generated SRT file: ${srtPath}`);

    return srtPath;
}

/**
 * Group words into display segments
 */
function groupWordsIntoSegments(words, wordsPerLine = 4) {
    const segments = [];

    for (let i = 0; i < words.length; i += wordsPerLine) {
        const chunk = words.slice(i, i + wordsPerLine);
        if (chunk.length > 0) {
            segments.push({
                start: chunk[0].start,
                end: chunk[chunk.length - 1].end,
                text: chunk.map(w => w.word).join(' ')
            });
        }
    }

    return segments;
}

/**
 * Format time for ASS (h:mm:ss.cc)
 */
function formatASSTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/**
 * Format time for SRT (hh:mm:ss,mmm)
 */
function formatSRTTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Export a clip with burned-in captions
 * @param {string} clipId - Clip ID from database
 * @param {Object} options - Export options
 * @returns {Promise<Object>} - Export result with file path
 */
async function exportClipWithCaptions(clipId, options = {}) {
    // Get clip from database
    const clip = db.prepare('SELECT * FROM clips WHERE id = ?').get(clipId);
    if (!clip) {
        throw new Error(`Clip not found: ${clipId}`);
    }

    // Get video
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(clip.video_id);
    if (!video || !video.file_path || !fs.existsSync(video.file_path)) {
        throw new Error(`Video file not found for clip ${clipId}`);
    }

    console.log(`[Export] Starting export for clip: ${clip.title}`);

    // Get clip transcript with word timings
    const clipTranscript = transcriptionService.getClipTranscript(
        clip.video_id,
        clip.start_time,
        clip.end_time
    );

    if (!clipTranscript || !clipTranscript.words || clipTranscript.words.length === 0) {
        throw new Error('No transcript available for this clip. Run transcription first.');
    }

    // Generate subtitle file
    const subtitlePath = generateASSSubtitles(clipTranscript.words, {
        style: options.captionStyle || clip.caption_style || 'animated',
        wordsPerLine: options.wordsPerLine || 4
    });

    // Determine output settings
    const aspectRatio = options.aspectRatio || clip.aspect_ratio || '9:16';
    const { width, height } = getResolutionForAspectRatio(aspectRatio);

    const exportId = uuidv4();
    const outputPath = path.join(EXPORTS_DIR, `${exportId}.mp4`);

    // Build FFmpeg command
    const ffmpegArgs = buildFFmpegCommand({
        inputPath: video.file_path,
        subtitlePath,
        outputPath,
        startTime: clip.start_time,
        endTime: clip.end_time,
        width,
        height,
        aspectRatio
    });

    console.log(`[Export] Running FFmpeg with ${ffmpegArgs.length} args`);

    // Run FFmpeg
    await runFFmpeg(ffmpegArgs);

    // Clean up subtitle file
    if (fs.existsSync(subtitlePath)) {
        fs.unlinkSync(subtitlePath);
    }

    // Update clip in database
    db.prepare(`
        UPDATE clips SET 
            exported_path = ?,
            status = 'exported',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(outputPath, clipId);

    console.log(`[Export] Clip exported to: ${outputPath}`);

    return {
        clipId,
        exportPath: outputPath,
        duration: clip.end_time - clip.start_time,
        resolution: `${width}x${height}`,
        aspectRatio
    };
}

/**
 * Build FFmpeg command for clip export
 */
function buildFFmpegCommand(params) {
    const { inputPath, subtitlePath, outputPath, startTime, endTime, width, height, aspectRatio } = params;

    // Build filter chain
    let filterChain = [];

    // Trim to clip duration
    filterChain.push(`trim=start=${startTime}:end=${endTime}`);
    filterChain.push('setpts=PTS-STARTPTS');

    // Scale and crop for aspect ratio
    if (aspectRatio === '9:16') {
        // Vertical: scale height, crop width
        filterChain.push(`scale=-1:${height}`);
        filterChain.push(`crop=${width}:${height}`);
    } else if (aspectRatio === '1:1') {
        // Square: scale to larger dimension, crop
        filterChain.push(`scale='if(gt(iw,ih),${width},-1)':'if(gt(ih,iw),${height},-1)'`);
        filterChain.push(`crop=${width}:${height}`);
    } else {
        // Landscape: standard scale
        filterChain.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
        filterChain.push(`pad=${width}:${height}:-1:-1:color=black`);
    }

    // Add subtitles
    filterChain.push(`ass=${subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')}`);

    const videoFilter = filterChain.join(',');

    // Audio filter for trimming
    const audioFilter = `atrim=start=${startTime}:end=${endTime},asetpts=PTS-STARTPTS`;

    return [
        '-y',
        '-i', inputPath,
        '-filter_complex', `[0:v]${videoFilter}[v];[0:a]${audioFilter}[a]`,
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputPath
    ];
}

/**
 * Get resolution for aspect ratio
 */
function getResolutionForAspectRatio(aspectRatio) {
    const resolutions = {
        '9:16': { width: 1080, height: 1920 },  // Vertical (TikTok, Reels, Shorts)
        '16:9': { width: 1920, height: 1080 },  // Landscape (YouTube)
        '1:1': { width: 1080, height: 1080 },   // Square (Instagram Feed)
        '4:5': { width: 1080, height: 1350 }    // Portrait (Instagram)
    };
    return resolutions[aspectRatio] || resolutions['9:16'];
}

/**
 * Run FFmpeg with promise wrapper
 */
function runFFmpeg(args) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', args);

        let stderr = '';

        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                console.error('[FFmpeg] Error output:', stderr);
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(new Error(`FFmpeg spawn error: ${err.message}`));
        });
    });
}

/**
 * Check if FFmpeg is available
 */
function checkFFmpegAvailable() {
    try {
        execSync('ffmpeg -version', { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    generateASSSubtitles,
    generateSRTSubtitles,
    exportClipWithCaptions,
    checkFFmpegAvailable,
    CAPTION_STYLES
};
