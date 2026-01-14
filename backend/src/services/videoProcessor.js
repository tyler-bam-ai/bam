/**
 * Video Processing Service
 * 
 * Handles video operations using FFmpeg:
 * - Extract clips from videos
 * - Generate thumbnails
 * - Get video metadata
 * - Convert to web-compatible formats
 */

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

// Configure FFmpeg path if needed
// ffmpeg.setFfmpegPath('/usr/local/bin/ffmpeg');
// ffmpeg.setFfprobePath('/usr/local/bin/ffprobe');

// Ensure directories exist
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
const CLIPS_DIR = path.join(UPLOADS_DIR, 'clips');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');

[VIDEOS_DIR, CLIPS_DIR, THUMBNAILS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

/**
 * Get video metadata (duration, dimensions, codec, etc.)
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Object>} - Video metadata
 */
function getVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }

            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

            resolve({
                duration: metadata.format.duration,
                size: metadata.format.size,
                bitrate: metadata.format.bit_rate,
                format: metadata.format.format_name,
                video: videoStream ? {
                    codec: videoStream.codec_name,
                    width: videoStream.width,
                    height: videoStream.height,
                    fps: eval(videoStream.r_frame_rate),
                    aspectRatio: videoStream.display_aspect_ratio
                } : null,
                audio: audioStream ? {
                    codec: audioStream.codec_name,
                    sampleRate: audioStream.sample_rate,
                    channels: audioStream.channels
                } : null
            });
        });
    });
}

/**
 * Extract a clip from a video
 * @param {string} videoPath - Path to source video
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {string} outputPath - Path for output clip
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Clip info
 */
function extractClip(videoPath, startTime, endTime, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
        const duration = endTime - startTime;

        let command = ffmpeg(videoPath)
            .setStartTime(startTime)
            .setDuration(duration)
            .output(outputPath);

        // Apply aspect ratio transformation if specified
        if (options.aspectRatio) {
            const filters = [];

            switch (options.aspectRatio) {
                case '9:16': // Vertical (TikTok, Reels, Shorts)
                    filters.push('scale=1080:1920:force_original_aspect_ratio=decrease');
                    filters.push('pad=1080:1920:(ow-iw)/2:(oh-ih)/2');
                    break;
                case '1:1': // Square (Instagram)
                    filters.push('scale=1080:1080:force_original_aspect_ratio=decrease');
                    filters.push('pad=1080:1080:(ow-iw)/2:(oh-ih)/2');
                    break;
                case '4:5': // Portrait (Instagram)
                    filters.push('scale=1080:1350:force_original_aspect_ratio=decrease');
                    filters.push('pad=1080:1350:(ow-iw)/2:(oh-ih)/2');
                    break;
                case '16:9': // Landscape (YouTube)
                default:
                    filters.push('scale=1920:1080:force_original_aspect_ratio=decrease');
                    filters.push('pad=1920:1080:(ow-iw)/2:(oh-ih)/2');
                    break;
            }

            command = command.videoFilters(filters);
        }

        // Set output options
        command
            .outputOptions([
                '-c:v libx264',
                '-preset fast',
                '-crf 23',
                '-c:a aac',
                '-b:a 128k'
            ])
            .on('start', (cmd) => {
                console.log('FFmpeg command:', cmd);
            })
            .on('progress', (progress) => {
                if (options.onProgress) {
                    options.onProgress(progress);
                }
            })
            .on('end', () => {
                resolve({
                    path: outputPath,
                    startTime,
                    endTime,
                    duration,
                    aspectRatio: options.aspectRatio || '16:9'
                });
            })
            .on('error', (err) => {
                reject(err);
            })
            .run();
    });
}

/**
 * Generate a thumbnail from a video
 * @param {string} videoPath - Path to the video
 * @param {number} timestamp - Time in seconds for thumbnail
 * @param {string} outputPath - Path for output thumbnail
 * @returns {Promise<string>} - Path to generated thumbnail
 */
function generateThumbnail(videoPath, timestamp, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .screenshots({
                timestamps: [timestamp],
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: '640x360'
            })
            .on('end', () => {
                resolve(outputPath);
            })
            .on('error', (err) => {
                reject(err);
            });
    });
}

/**
 * Generate multiple thumbnails for clip selection
 * @param {string} videoPath - Path to the video
 * @param {number} count - Number of thumbnails to generate
 * @param {string} outputDir - Directory for output thumbnails
 * @returns {Promise<string[]>} - Array of thumbnail paths
 */
function generateThumbnails(videoPath, count = 8, outputDir) {
    return new Promise((resolve, reject) => {
        const outputPattern = path.join(outputDir, 'thumb_%i.jpg');

        ffmpeg(videoPath)
            .screenshots({
                count,
                folder: outputDir,
                filename: 'thumb_%i.jpg',
                size: '320x180'
            })
            .on('end', () => {
                const thumbnails = [];
                for (let i = 1; i <= count; i++) {
                    thumbnails.push(path.join(outputDir, `thumb_${i}.jpg`));
                }
                resolve(thumbnails);
            })
            .on('error', (err) => {
                reject(err);
            });
    });
}

/**
 * Convert video to web-compatible format (H.264 MP4)
 * @param {string} inputPath - Path to input video
 * @param {string} outputPath - Path for output video
 * @returns {Promise<string>} - Path to converted video
 */
function convertToWeb(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .output(outputPath)
            .outputOptions([
                '-c:v libx264',
                '-preset medium',
                '-crf 23',
                '-c:a aac',
                '-b:a 128k',
                '-movflags +faststart' // Enable fast start for web playback
            ])
            .on('end', () => {
                resolve(outputPath);
            })
            .on('error', (err) => {
                reject(err);
            })
            .run();
    });
}

/**
 * Extract audio from video for transcription
 * @param {string} videoPath - Path to the video
 * @param {string} outputPath - Path for output audio file
 * @returns {Promise<string>} - Path to extracted audio
 */
function extractAudio(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .output(outputPath)
            .outputOptions([
                '-vn', // No video
                '-acodec pcm_s16le', // WAV format for transcription
                '-ar 16000', // 16kHz sample rate (good for speech recognition)
                '-ac 1' // Mono
            ])
            .on('end', () => {
                resolve(outputPath);
            })
            .on('error', (err) => {
                reject(err);
            })
            .run();
    });
}

/**
 * Download video from YouTube using yt-dlp
 * @param {string} url - YouTube video URL
 * @param {string} outputDir - Directory to save the video
 * @returns {Promise<Object>} - Video info and path
 */
async function downloadFromYouTube(url, outputDir = VIDEOS_DIR) {
    const outputTemplate = path.join(outputDir, '%(id)s.%(ext)s');

    try {
        // First get video info
        const { stdout: infoJson } = await execAsync(`yt-dlp --dump-json "${url}"`);
        const info = JSON.parse(infoJson);

        // Download the video
        await execAsync(`yt-dlp -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best" -o "${outputTemplate}" "${url}"`);

        const videoPath = path.join(outputDir, `${info.id}.mp4`);

        return {
            id: info.id,
            title: info.title,
            description: info.description,
            duration: info.duration,
            thumbnail: info.thumbnail,
            uploader: info.uploader,
            uploadDate: info.upload_date,
            viewCount: info.view_count,
            path: videoPath,
            source: 'youtube',
            sourceUrl: url
        };
    } catch (error) {
        console.error('YouTube download error:', error);
        throw new Error(`Failed to download video: ${error.message}`);
    }
}

/**
 * Get YouTube video info without downloading
 * @param {string} url - YouTube video URL
 * @returns {Promise<Object>} - Video metadata
 */
async function getYouTubeVideoInfo(url) {
    try {
        const { stdout } = await execAsync(`yt-dlp --dump-json "${url}"`);
        const info = JSON.parse(stdout);

        return {
            id: info.id,
            title: info.title,
            description: info.description,
            duration: info.duration,
            thumbnail: info.thumbnail,
            uploader: info.uploader,
            uploadDate: info.upload_date,
            viewCount: info.view_count,
            likeCount: info.like_count,
            categories: info.categories,
            tags: info.tags
        };
    } catch (error) {
        throw new Error(`Failed to get video info: ${error.message}`);
    }
}

module.exports = {
    getVideoMetadata,
    extractClip,
    generateThumbnail,
    generateThumbnails,
    convertToWeb,
    extractAudio,
    downloadFromYouTube,
    getYouTubeVideoInfo,
    VIDEOS_DIR,
    CLIPS_DIR,
    THUMBNAILS_DIR
};
