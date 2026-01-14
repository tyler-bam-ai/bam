/**
 * Content Engine Routes
 * Video processing, clip generation, and campaign management
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { logUsage } = require('../services/apiTracking');
const { db } = require('../db/db');
const videoProcessor = require('../services/videoProcessor');
const transcriptionService = require('../services/transcriptionService');
const clipDetectionService = require('../services/clipDetectionService');
const captionService = require('../services/captionService');
const geminiVideoService = require('../services/geminiVideoService');

const router = express.Router();


// Configure video upload - use data directory which is writable in packaged app
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use data/uploads which is writable even in packaged app
        const uploadDir = path.join(__dirname, '../../data/uploads');
        console.log('[Content] Video upload directory:', uploadDir);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        cb(null, uniqueName);
    }
});

const videoUpload = multer({
    storage: videoStorage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only MP4, MOV, AVI, WebM, and MKV are allowed.'));
        }
    }
});

// ==================== CAMPAIGNS ====================

/**
 * Create a new content campaign
 * POST /api/content/campaigns
 */
router.post('/campaigns', authMiddleware, (req, res) => {
    try {
        const { name, description, targetPlatforms = [] } = req.body;
        const companyId = req.user.companyId;

        if (!name) {
            return res.status(400).json({ error: 'Campaign name is required' });
        }

        const id = uuidv4();
        const config = JSON.stringify({
            targetPlatforms,
            settings: {}
        });

        db.prepare(`
            INSERT INTO campaigns (id, company_id, name, description, status, config)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, companyId, name, description || '', 'draft', config);

        const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);

        res.status(201).json({
            success: true,
            campaign: formatCampaign(campaign)
        });
    } catch (error) {
        console.error('Create campaign error:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

/**
 * Get all campaigns
 * GET /api/content/campaigns
 */
router.get('/campaigns', authMiddleware, (req, res) => {
    try {
        const companyId = req.user.companyId;

        const campaigns = db.prepare(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM videos WHERE campaign_id = c.id) as video_count,
                   (SELECT COUNT(*) FROM clips cl 
                    JOIN videos v ON cl.video_id = v.id 
                    WHERE v.campaign_id = c.id) as clip_count
            FROM campaigns c 
            WHERE c.company_id = ? AND c.status != 'deleted'
            ORDER BY c.created_at DESC
        `).all(companyId);

        res.json(campaigns.map(formatCampaign));
    } catch (error) {
        console.error('Get campaigns error:', error);
        res.status(500).json({ error: 'Failed to get campaigns' });
    }
});

// Helper to format campaign for response
function formatCampaign(campaign) {
    const config = campaign.config ? JSON.parse(campaign.config) : {};
    return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        targetPlatforms: config.targetPlatforms || [],
        settings: config.settings || {},
        videoCount: campaign.video_count || 0,
        clipCount: campaign.clip_count || 0,
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at
    };
}

/**

 * Get a specific campaign
 * GET /api/content/campaigns/:id
 */
router.get('/campaigns/:id', authMiddleware, (req, res) => {
    try {
        const campaign = campaigns.get(req.params.id);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Get videos for this campaign
        const campaignVideos = Array.from(videos.values())
            .filter(v => v.campaignId === campaign.id);

        res.json({
            ...campaign,
            videos: campaignVideos
        });
    } catch (error) {
        console.error('Get campaign error:', error);
        res.status(500).json({ error: 'Failed to get campaign' });
    }
});

/**
 * Update a campaign
 * PATCH /api/content/campaigns/:id
 */
router.patch('/campaigns/:id', authMiddleware, (req, res) => {
    try {
        const campaign = campaigns.get(req.params.id);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const allowedUpdates = ['name', 'description', 'status', 'targetPlatforms', 'settings'];
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                campaign[field] = req.body[field];
            }
        });

        campaign.updatedAt = new Date().toISOString();
        campaigns.set(campaign.id, campaign);

        res.json({
            success: true,
            campaign
        });
    } catch (error) {
        console.error('Update campaign error:', error);
        res.status(500).json({ error: 'Failed to update campaign' });
    }
});

/**
 * Delete a campaign
 * DELETE /api/content/campaigns/:id
 */
router.delete('/campaigns/:id', authMiddleware, (req, res) => {
    try {
        const campaign = campaigns.get(req.params.id);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        campaigns.delete(campaign.id);

        res.json({
            success: true,
            message: 'Campaign deleted successfully'
        });
    } catch (error) {
        console.error('Delete campaign error:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});

// In-memory store for AI campaign sessions
const aiCampaignSessions = new Map();

/**
 * AI-Guided Campaign Creation - Step-by-step conversation flow
 * POST /api/content/campaigns/ai-guide
 */
router.post('/campaigns/ai-guide', authMiddleware, async (req, res) => {
    try {
        const { sessionId, step, userResponse } = req.body;
        const clientId = req.user.companyId || 'default-client-id';

        // Initialize or retrieve session
        let session;
        if (sessionId && aiCampaignSessions.has(sessionId)) {
            session = aiCampaignSessions.get(sessionId);
        } else {
            session = {
                id: uuidv4(),
                clientId,
                currentStep: 'name',
                data: {},
                createdAt: new Date().toISOString()
            };
            aiCampaignSessions.set(session.id, session);
        }

        // Process based on current step
        let response = {};

        switch (session.currentStep) {
            case 'name':
                if (userResponse) {
                    session.data.name = userResponse;
                    session.currentStep = 'duration';
                    response = {
                        message: `Great! "${userResponse}" sounds like an exciting campaign.`,
                        question: 'How long do you want this campaign to run?',
                        options: ['1 week', '2 weeks', '3 weeks', '4 weeks', 'Ongoing'],
                        step: 'duration'
                    };
                } else {
                    response = {
                        message: "Let's create your campaign! I'll guide you through a few questions.",
                        question: "What would you like to name this campaign?",
                        placeholder: "e.g., Valentine's Wellness 2025",
                        step: 'name'
                    };
                }
                break;

            case 'duration':
                if (userResponse) {
                    session.data.duration = userResponse;
                    session.currentStep = 'frequency';
                    response = {
                        message: `Perfect, a ${userResponse} campaign.`,
                        question: 'How many posts per week do you want to publish?',
                        options: ['1-2 posts/week', '3-5 posts/week', '5-7 posts/week', 'Daily'],
                        recommendation: 'I recommend 3-5 posts per week for optimal engagement.',
                        step: 'frequency'
                    };
                }
                break;

            case 'frequency':
                if (userResponse) {
                    session.data.frequency = userResponse;
                    session.currentStep = 'promotions';
                    response = {
                        message: `Got it! ${userResponse} is a solid posting schedule.`,
                        question: 'Are there any sales, promotions, or events you want to highlight?',
                        placeholder: 'e.g., 20% off couples massage, Free consultation week',
                        optional: true,
                        step: 'promotions'
                    };
                }
                break;

            case 'promotions':
                session.data.promotions = userResponse || '';
                session.currentStep = 'topics';

                // Generate AI topic suggestions based on campaign info
                const topicSuggestions = generateTopicSuggestions(session.data);
                session.data.suggestedTopics = topicSuggestions;

                response = {
                    message: userResponse
                        ? "Great! I'll make sure to highlight those in the content."
                        : "No problem! Let's focus on engaging content.",
                    question: 'Here are some topics I suggest you cover. Select the ones you want to discuss or add your own:',
                    topics: topicSuggestions,
                    step: 'topics'
                };
                break;

            case 'topics':
                if (userResponse) {
                    session.data.selectedTopics = Array.isArray(userResponse) ? userResponse : [userResponse];
                    session.currentStep = 'platforms';
                    response = {
                        message: `Excellent choices! These topics will resonate well with your audience.`,
                        question: 'Which platforms do you want to post to?',
                        options: [
                            { id: 'instagram', label: 'Instagram', recommended: true },
                            { id: 'tiktok', label: 'TikTok', recommended: true },
                            { id: 'facebook', label: 'Facebook' },
                            { id: 'youtube', label: 'YouTube' },
                            { id: 'linkedin', label: 'LinkedIn' },
                            { id: 'twitter', label: 'Twitter/X' }
                        ],
                        multiSelect: true,
                        step: 'platforms'
                    };
                }
                break;

            case 'platforms':
                if (userResponse) {
                    session.data.platforms = Array.isArray(userResponse) ? userResponse : [userResponse];
                    session.currentStep = 'complete';

                    // Calculate clips needed
                    const weeksMap = { '1 week': 1, '2 weeks': 2, '3 weeks': 3, '4 weeks': 4, 'Ongoing': 8 };
                    const frequencyMap = { '1-2 posts/week': 1.5, '3-5 posts/week': 4, '5-7 posts/week': 6, 'Daily': 7 };
                    const weeks = weeksMap[session.data.duration] || 2;
                    const postsPerWeek = frequencyMap[session.data.frequency] || 4;
                    const clipsNeeded = Math.ceil(weeks * postsPerWeek);
                    session.data.clipsNeeded = clipsNeeded;

                    // Create the actual campaign
                    const campaign = {
                        id: uuidv4(),
                        clientId,
                        name: session.data.name,
                        description: `${session.data.duration} campaign with ${session.data.frequency}. Topics: ${session.data.selectedTopics?.join(', ')}`,
                        targetPlatforms: session.data.platforms,
                        status: 'draft',
                        videoCount: 0,
                        clipCount: 0,
                        settings: {
                            duration: session.data.duration,
                            frequency: session.data.frequency,
                            promotions: session.data.promotions,
                            topics: session.data.selectedTopics,
                            clipsNeeded
                        },
                        createdBy: req.user.id,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };

                    campaigns.set(campaign.id, campaign);
                    session.data.campaignId = campaign.id;

                    response = {
                        message: `🎉 Your "${session.data.name}" campaign is ready!`,
                        summary: {
                            name: session.data.name,
                            duration: session.data.duration,
                            frequency: session.data.frequency,
                            platforms: session.data.platforms,
                            topics: session.data.selectedTopics,
                            clipsNeeded,
                            promotions: session.data.promotions
                        },
                        nextSteps: [
                            `You need approximately ${clipsNeeded} clips for this campaign`,
                            'Record a 10-15 minute video covering your selected topics',
                            'Upload the video and I\'ll create viral clips automatically',
                            'Review and approve clips, then schedule to your calendar'
                        ],
                        campaignId: campaign.id,
                        step: 'complete'
                    };

                    // Clean up session
                    aiCampaignSessions.delete(session.id);
                }
                break;

            default:
                response = {
                    error: 'Unknown step',
                    step: session.currentStep
                };
        }

        res.json({
            success: true,
            sessionId: session.id,
            ...response
        });
    } catch (error) {
        console.error('AI campaign guide error:', error);
        res.status(500).json({ error: 'Failed to process campaign guide' });
    }
});

/**
 * Get topic suggestions for a campaign
 * POST /api/content/campaigns/suggest-topics
 */
router.post('/campaigns/suggest-topics', authMiddleware, async (req, res) => {
    try {
        const { campaignName, industry, promotions } = req.body;

        const topics = generateTopicSuggestions({
            name: campaignName,
            promotions,
            industry
        });

        res.json({
            success: true,
            topics
        });
    } catch (error) {
        console.error('Suggest topics error:', error);
        res.status(500).json({ error: 'Failed to suggest topics' });
    }
});

// Helper: Generate topic suggestions based on campaign data
function generateTopicSuggestions(campaignData) {
    const { name = '', promotions = '', industry = '' } = campaignData;
    const nameLower = name.toLowerCase();

    // Base topics everyone should cover
    const basicsTopics = [
        'Behind the scenes of your business',
        'Meet the team / founder story',
        'Customer success story or testimonial',
        'Common myths in your industry debunked'
    ];

    // Holiday/event specific topics
    const holidayTopics = [];
    if (nameLower.includes('valentine')) {
        holidayTopics.push(
            'Self-care tips for couples',
            'Gift ideas from your business',
            'Love yourself first messaging',
            'Couples experiences you offer'
        );
    } else if (nameLower.includes('new year') || nameLower.includes('january')) {
        holidayTopics.push(
            'New year transformation tips',
            'Goal setting in your industry',
            'Fresh start / reset content',
            'What to expect this year'
        );
    } else if (nameLower.includes('summer')) {
        holidayTopics.push(
            'Summer preparation tips',
            'Seasonal services highlight',
            'Vacation-ready content',
            'Summer specials announcement'
        );
    }

    // Promotion-based topics
    const promoTopics = [];
    if (promotions) {
        promoTopics.push(
            'Announce your special offer',
            'Why this deal is valuable',
            'Limited time urgency content',
            'How to claim the offer'
        );
    }

    // Engagement topics
    const engagementTopics = [
        'FAQ answers from real customers',
        'Day in the life content',
        'Before and after transformation',
        'Quick tips your audience can use today'
    ];

    // Combine and limit
    const allTopics = [...holidayTopics, ...promoTopics, ...basicsTopics, ...engagementTopics];
    return allTopics.slice(0, 8);
}

// ==================== VIDEOS ====================


/**
 * Upload a video
 * POST /api/content/videos
 */
router.post('/videos', optionalAuth, videoUpload.single('video'), async (req, res) => {
    console.log('[Content] Video upload handler reached');
    console.log('[Content] User:', req.user ? req.user.email : 'anonymous');
    console.log('[Content] File:', req.file ? req.file.originalname : 'no file');
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }

        const id = uuidv4();
        const companyId = req.user?.companyId || null;

        // Get video metadata using FFmpeg
        let metadata = {};
        try {
            metadata = await videoProcessor.getVideoMetadata(req.file.path);
        } catch (e) {
            console.error('Failed to get video metadata:', e);
        }

        const videoMetadata = JSON.stringify({
            originalFilename: req.file.originalname,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            ...metadata
        });

        db.prepare(`
            INSERT INTO videos (id, campaign_id, company_id, title, file_path, duration, status, source, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            req.body.campaignId || null,
            companyId,
            req.file.originalname,
            req.file.path,
            metadata.duration || null,
            'processing',
            'upload',
            videoMetadata
        );

        // Start async processing
        processVideoAsync(id, companyId);

        const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(id);

        res.status(201).json({
            success: true,
            video: formatVideo(video)
        });
    } catch (error) {
        console.error('Video upload error:', error);
        res.status(500).json({ error: 'Failed to upload video' });
    }
});

/**
 * Import video from YouTube URL
 * POST /api/content/videos/youtube
 */
router.post('/videos/youtube', authMiddleware, async (req, res) => {
    try {
        const { url, campaignId } = req.body;
        const companyId = req.user.companyId;

        if (!url) {
            return res.status(400).json({ error: 'YouTube URL is required' });
        }

        // Validate it's a YouTube URL
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
        if (!youtubeRegex.test(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const id = uuidv4();

        // Create pending video record
        db.prepare(`
            INSERT INTO videos (id, campaign_id, company_id, title, file_path, status, source, source_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, campaignId || null, companyId, 'Downloading...', '', 'downloading', 'youtube', url);

        // Start async download
        downloadYouTubeVideo(id, url, companyId);

        res.status(202).json({
            success: true,
            message: 'Video download started',
            videoId: id,
            status: 'downloading'
        });
    } catch (error) {
        console.error('YouTube import error:', error);
        res.status(500).json({ error: 'Failed to import from YouTube' });
    }
});

/**
 * Download YouTube video in background
 */
async function downloadYouTubeVideo(videoId, url, companyId) {
    try {
        const videoInfo = await videoProcessor.downloadFromYouTube(url);

        db.prepare(`
            UPDATE videos 
            SET title = ?, file_path = ?, duration = ?, status = 'processing', 
                metadata = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            videoInfo.title,
            videoInfo.path,
            videoInfo.duration,
            JSON.stringify(videoInfo),
            videoId
        );

        // Continue to processing
        processVideoAsync(videoId, companyId);
    } catch (error) {
        console.error('YouTube download failed:', error);
        db.prepare(`
            UPDATE videos SET status = 'error', 
                metadata = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(JSON.stringify({ error: error.message }), videoId);
    }
}

// Helper to format video for response
function formatVideo(video) {
    const metadata = video.metadata ? JSON.parse(video.metadata) : {};
    return {
        id: video.id,
        campaignId: video.campaign_id,
        title: video.title,
        duration: video.duration,
        status: video.status,
        source: video.source,
        sourceUrl: video.source_url,
        thumbnailPath: video.thumbnail_path,
        metadata,
        createdAt: video.created_at,
        updatedAt: video.updated_at
    };
}



/**
 * Process video - extract metadata, generate thumbnails, analyze for clips
 * Uses Gemini AI to actually watch the video and detect viral moments
 */
async function processVideoAsync(videoId, companyId) {
    try {
        const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);
        if (!video) return;

        // Update status
        db.prepare(`UPDATE videos SET status = 'processing' WHERE id = ?`).run(videoId);

        // Generate thumbnail
        try {
            const thumbnailPath = path.join(videoProcessor.THUMBNAILS_DIR, `${videoId}.jpg`);
            await videoProcessor.generateThumbnail(video.file_path, 5, thumbnailPath);
            db.prepare(`UPDATE videos SET thumbnail_path = ? WHERE id = ?`).run(thumbnailPath, videoId);
        } catch (e) {
            console.error('Thumbnail generation failed:', e);
        }

        // Get video metadata if not already set
        if (!video.duration) {
            try {
                const metadata = await videoProcessor.getVideoMetadata(video.file_path);
                db.prepare(`UPDATE videos SET duration = ? WHERE id = ?`).run(metadata.duration, videoId);
            } catch (e) {
                console.error('Failed to get duration:', e);
            }
        }

        // Use Gemini AI to analyze video for viral clips
        let detectedClips = [];

        if (geminiVideoService.isGeminiAvailable()) {
            console.log(`[Content] Using Gemini AI to analyze video: ${videoId}`);
            db.prepare(`UPDATE videos SET status = 'analyzing' WHERE id = ?`).run(videoId);

            try {
                detectedClips = await geminiVideoService.analyzeVideoForClips(video.file_path);
                console.log(`[Content] Gemini detected ${detectedClips.length} viral moments`);
            } catch (aiError) {
                console.error('[Content] Gemini analysis failed, falling back to mock:', aiError.message);
                const duration = video.duration || 180;
                detectedClips = generateMockClips(duration);
            }
        } else {
            console.log(`[Content] Gemini API not configured, using mock clips`);
            const duration = video.duration || 180;
            detectedClips = generateMockClips(duration);
        }

        // Create clip records in database
        for (const clipData of detectedClips) {
            const clipId = uuidv4();
            const clipMetadata = JSON.stringify({
                reason: clipData.reason,
                suggestedCaption: clipData.suggestedCaption,
                hookType: clipData.hookType || 'insight',
                visualHighlight: clipData.visualHighlight || '',
                captionStyle: {
                    fontSize: 'large',
                    position: 'bottom',
                    animation: 'word-by-word'
                }
            });

            db.prepare(`
                INSERT INTO clips (id, video_id, title, start_time, end_time, duration, virality_score, transcript, status, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                clipId,
                videoId,
                clipData.suggestedCaption?.substring(0, 50) || 'Untitled Clip',
                clipData.startTime,
                clipData.endTime,
                clipData.duration || (clipData.endTime - clipData.startTime),
                clipData.viralityScore || 75,
                clipData.transcript || '',
                'pending',
                clipMetadata
            );
        }

        // Mark video as ready
        db.prepare(`UPDATE videos SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(videoId);

        console.log(`[Content] Video ${videoId} processed. Generated ${detectedClips.length} clips.`);
    } catch (error) {
        console.error('Video processing error:', error);
        db.prepare(`UPDATE videos SET status = 'error', metadata = ? WHERE id = ?`)
            .run(JSON.stringify({ error: error.message }), videoId);
    }
}

/**
 * Generate mock clips for demo purposes
 * In production, this would be replaced by AI analysis
 */
function generateMockClips(duration) {
    const clips = [];
    const numClips = Math.min(5, Math.floor(duration / 30)); // One clip per 30 seconds, max 5

    for (let i = 0; i < numClips; i++) {
        const startTime = i * (duration / numClips);
        const clipDuration = Math.min(45, duration / numClips); // 15-45 second clips

        clips.push({
            startTime: Math.round(startTime),
            endTime: Math.round(startTime + clipDuration),
            viralityScore: 0.7 + Math.random() * 0.25, // 70-95%
            reason: ['Key insight with engagement potential', 'Memorable quote', 'Strong hook', 'Emotional moment', 'Call to action'][i % 5],
            suggestedCaption: ['🔥 This changed everything...', '💡 The moment it clicked...', 'What nobody tells you...', '⚡ Game changer alert!', '👀 Pay attention to this...'][i % 5],
            transcript: 'Mock transcript for this segment.'
        });
    }

    return clips.sort((a, b) => b.viralityScore - a.viralityScore);
}


/**
 * Get all videos
 * GET /api/content/videos
 */
router.get('/videos', optionalAuth, (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { campaignId, status } = req.query;

        let query = `
            SELECT v.*, 
                   (SELECT COUNT(*) FROM clips WHERE video_id = v.id) as clip_count
            FROM videos v 
            WHERE 1=1
        `;
        const params = [];

        if (campaignId) {
            query += ' AND v.campaign_id = ?';
            params.push(campaignId);
        }

        if (status) {
            query += ' AND v.status = ?';
            params.push(status);
        }

        query += ' ORDER BY v.created_at DESC';

        const videos = db.prepare(query).all(...params);

        res.json(videos.map(v => ({
            ...formatVideo(v),
            clipCount: v.clip_count
        })));
    } catch (error) {
        console.error('Get videos error:', error);
        res.status(500).json({ error: 'Failed to get videos' });
    }
});

/**
 * Get video processing status
 * GET /api/content/videos/:id/status
 */
router.get('/videos/:id/status', authMiddleware, (req, res) => {
    try {
        const video = db.prepare('SELECT id, status, metadata FROM videos WHERE id = ?').get(req.params.id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const metadata = video.metadata ? JSON.parse(video.metadata) : {};

        res.json({
            id: video.id,
            status: video.status,
            error: metadata.error || null
        });
    } catch (error) {
        console.error('Get video status error:', error);
        res.status(500).json({ error: 'Failed to get video status' });
    }
});


/**
 * Get a specific video with its clips
 * GET /api/content/videos/:id
 */
router.get('/videos/:id', authMiddleware, (req, res) => {
    try {
        const video = videos.get(req.params.id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const videoClips = Array.from(clips.values())
            .filter(c => c.videoId === video.id)
            .sort((a, b) => b.viralityScore - a.viralityScore);

        res.json({
            ...video,
            clips: videoClips
        });
    } catch (error) {
        console.error('Get video error:', error);
        res.status(500).json({ error: 'Failed to get video' });
    }
});

// ==================== TRANSCRIPTION ====================

/**
 * Trigger transcription for a video
 * POST /api/content/videos/:id/transcribe
 */
router.post('/videos/:id/transcribe', authMiddleware, async (req, res) => {
    try {
        const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        if (!video.file_path || !fs.existsSync(video.file_path)) {
            return res.status(400).json({ error: 'Video file not available for transcription' });
        }

        // Check if already transcribed
        const existingTranscript = transcriptionService.getTranscript(req.params.id);
        if (existingTranscript) {
            return res.json({
                success: true,
                status: 'already_transcribed',
                transcript: existingTranscript
            });
        }

        // Update status to transcribing
        db.prepare(`UPDATE videos SET status = 'transcribing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(req.params.id);

        // Start async transcription
        transcribeVideoAsync(req.params.id, req.user.companyId);

        res.status(202).json({
            success: true,
            message: 'Transcription started',
            videoId: req.params.id,
            status: 'transcribing'
        });
    } catch (error) {
        console.error('Transcription start error:', error);
        res.status(500).json({ error: 'Failed to start transcription' });
    }
});

/**
 * Async transcription handler
 */
async function transcribeVideoAsync(videoId, companyId) {
    try {
        const result = await transcriptionService.transcribeVideo(videoId);

        // Update video status
        db.prepare(`
            UPDATE videos SET status = 'transcribed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(videoId);

        console.log(`[Transcription] Video ${videoId} transcribed: ${result.wordCount} words`);
    } catch (error) {
        console.error(`[Transcription] Failed for video ${videoId}:`, error);

        db.prepare(`
            UPDATE videos SET status = 'transcription_error', 
                metadata = json_set(COALESCE(metadata, '{}'), '$.transcriptionError', ?),
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(error.message, videoId);
    }
}

/**
 * Get transcript for a video
 * GET /api/content/videos/:id/transcript
 */
router.get('/videos/:id/transcript', authMiddleware, (req, res) => {
    try {
        const video = db.prepare('SELECT id, status FROM videos WHERE id = ?').get(req.params.id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const transcript = transcriptionService.getTranscript(req.params.id);

        if (!transcript) {
            // Check if transcription is in progress
            if (video.status === 'transcribing') {
                return res.json({
                    status: 'transcribing',
                    message: 'Transcription in progress'
                });
            }
            return res.status(404).json({ error: 'Transcript not found. Trigger transcription first.' });
        }

        res.json({
            success: true,
            transcript
        });
    } catch (error) {
        console.error('Get transcript error:', error);
        res.status(500).json({ error: 'Failed to get transcript' });
    }
});

/**
 * Get clip transcript (subset of video transcript for a time range)
 * GET /api/content/videos/:id/transcript/clip
 */
router.get('/videos/:id/transcript/clip', authMiddleware, (req, res) => {
    try {
        const { startTime, endTime } = req.query;

        if (!startTime || !endTime) {
            return res.status(400).json({ error: 'startTime and endTime query params required' });
        }

        const clipTranscript = transcriptionService.getClipTranscript(
            req.params.id,
            parseFloat(startTime),
            parseFloat(endTime)
        );

        if (!clipTranscript) {
            return res.status(404).json({ error: 'Transcript not found for this video' });
        }

        res.json({
            success: true,
            clipTranscript
        });
    } catch (error) {
        console.error('Get clip transcript error:', error);
        res.status(500).json({ error: 'Failed to get clip transcript' });
    }
});

// ==================== AI CLIP DETECTION ====================

/**
 * Analyze video for viral clips using AI
 * POST /api/content/videos/:id/analyze
 */
router.post('/videos/:id/analyze', authMiddleware, async (req, res) => {
    try {
        const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Check if video has been transcribed
        const transcript = transcriptionService.getTranscript(req.params.id);
        if (!transcript) {
            return res.status(400).json({
                error: 'Video must be transcribed first',
                suggestion: 'POST /api/content/videos/:id/transcribe'
            });
        }

        // Update status to analyzing
        db.prepare(`UPDATE videos SET status = 'analyzing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(req.params.id);

        // Start async analysis
        analyzeVideoAsync(req.params.id, req.user.companyId);

        res.status(202).json({
            success: true,
            message: 'AI clip analysis started',
            videoId: req.params.id,
            status: 'analyzing'
        });
    } catch (error) {
        console.error('Video analysis start error:', error);
        res.status(500).json({ error: 'Failed to start video analysis' });
    }
});

/**
 * Async video analysis handler
 */
async function analyzeVideoAsync(videoId, companyId) {
    try {
        const result = await clipDetectionService.analyzeVideoForClips(videoId);
        console.log(`[ClipDetection] Video ${videoId} analyzed: ${result.clipCount} clips found`);
    } catch (error) {
        console.error(`[ClipDetection] Failed for video ${videoId}:`, error);

        db.prepare(`
            UPDATE videos SET status = 'analysis_error', 
                metadata = json_set(COALESCE(metadata, '{}'), '$.analysisError', ?),
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(error.message, videoId);
    }
}

/**
 * Regenerate clips for a video (re-run AI analysis)
 * POST /api/content/videos/:id/regenerate-clips
 */
router.post('/videos/:id/regenerate-clips', authMiddleware, async (req, res) => {
    try {
        const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Check if video has been transcribed
        const transcript = transcriptionService.getTranscript(req.params.id);
        if (!transcript) {
            return res.status(400).json({
                error: 'Video must be transcribed first'
            });
        }

        // Update status
        db.prepare(`UPDATE videos SET status = 'analyzing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(req.params.id);

        // Regenerate clips (deletes old ones first)
        const result = await clipDetectionService.regenerateClips(req.params.id);

        res.json({
            success: true,
            message: 'Clips regenerated successfully',
            ...result
        });
    } catch (error) {
        console.error('Regenerate clips error:', error);
        res.status(500).json({ error: 'Failed to regenerate clips' });
    }
});

/**
 * Get clips for a video (using clipDetectionService)
 * GET /api/content/videos/:videoId/clips
 */
router.get('/videos/:videoId/clips', authMiddleware, (req, res) => {
    try {
        const clips = clipDetectionService.getVideoClips(req.params.videoId);
        res.json(clips);
    } catch (error) {
        console.error('Get clips error:', error);
        res.status(500).json({ error: 'Failed to get clips' });
    }
});

// ==================== CLIPS ====================

/**
 * Get clips for a video
 * GET /api/content/videos/:videoId/clips
 */
router.get('/videos/:videoId/clips', authMiddleware, (req, res) => {
    try {
        const videoClips = Array.from(clips.values())
            .filter(c => c.videoId === req.params.videoId)
            .sort((a, b) => b.viralityScore - a.viralityScore);

        res.json(videoClips);
    } catch (error) {
        console.error('Get clips error:', error);
        res.status(500).json({ error: 'Failed to get clips' });
    }
});

/**
 * Update clip status (approve/reject)
 * PATCH /api/content/clips/:id
 */
router.patch('/clips/:id', authMiddleware, (req, res) => {
    try {
        const clip = clips.get(req.params.id);

        if (!clip) {
            return res.status(404).json({ error: 'Clip not found' });
        }

        const { status, subtitleText, suggestedCaption, subtitleStyle } = req.body;

        if (status && ['pending_review', 'approved', 'rejected'].includes(status)) {
            clip.status = status;
            if (status === 'approved') {
                clip.approvedBy = req.user.id;
                clip.approvedAt = new Date().toISOString();
            }
        }

        if (subtitleText !== undefined) clip.subtitleText = subtitleText;
        if (suggestedCaption !== undefined) clip.suggestedCaption = suggestedCaption;
        if (subtitleStyle !== undefined) clip.subtitleStyle = subtitleStyle;

        clips.set(clip.id, clip);

        res.json({
            success: true,
            clip
        });
    } catch (error) {
        console.error('Update clip error:', error);
        res.status(500).json({ error: 'Failed to update clip' });
    }
});

/**
 * Bulk approve clips
 * POST /api/content/clips/bulk-approve
 */
router.post('/clips/bulk-approve', authMiddleware, (req, res) => {
    try {
        const { clipIds } = req.body;

        if (!clipIds || !Array.isArray(clipIds)) {
            return res.status(400).json({ error: 'clipIds array is required' });
        }

        const updated = [];
        clipIds.forEach(clipId => {
            const clip = clips.get(clipId);
            if (clip) {
                clip.status = 'approved';
                clip.approvedBy = req.user.id;
                clip.approvedAt = new Date().toISOString();
                clips.set(clipId, clip);
                updated.push(clipId);
            }
        });

        res.json({
            success: true,
            approvedCount: updated.length,
            approvedClipIds: updated
        });
    } catch (error) {
        console.error('Bulk approve clips error:', error);
        res.status(500).json({ error: 'Failed to approve clips' });
    }
});

/**
 * Export a clip with burned-in captions
 * POST /api/content/clips/:id/export
 */
router.post('/clips/:id/export', authMiddleware, async (req, res) => {
    try {
        const clipId = req.params.id;
        const { captionStyle, aspectRatio, wordsPerLine } = req.body;

        // Check if FFmpeg is available
        if (!captionService.checkFFmpegAvailable()) {
            return res.status(500).json({
                error: 'FFmpeg is not available. Install FFmpeg to export clips with captions.'
            });
        }

        // Start async export
        exportClipAsync(clipId, {
            captionStyle: captionStyle || 'animated',
            aspectRatio: aspectRatio || '9:16',
            wordsPerLine: wordsPerLine || 4
        });

        res.status(202).json({
            success: true,
            message: 'Clip export started',
            clipId,
            status: 'exporting'
        });
    } catch (error) {
        console.error('Export clip error:', error);
        res.status(500).json({ error: 'Failed to start clip export' });
    }
});

/**
 * Async export handler
 */
async function exportClipAsync(clipId, options) {
    try {
        const result = await captionService.exportClipWithCaptions(clipId, options);
        console.log(`[Export] Clip ${clipId} exported successfully: ${result.exportPath}`);
    } catch (error) {
        console.error(`[Export] Failed for clip ${clipId}:`, error);
        // Update clip status to error
        db.prepare(`
            UPDATE clips SET status = 'export_error', 
                metadata = json_set(COALESCE(metadata, '{}'), '$.exportError', ?),
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(error.message, clipId);
    }
}

/**
 * Get all approved clips (ready for scheduling)
 * GET /api/content/clips/approved
 */
router.get('/clips/approved', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'default-client-id';

        // Get videos for this client
        const clientVideoIds = Array.from(videos.values())
            .filter(v => v.clientId === clientId)
            .map(v => v.id);

        const approvedClips = Array.from(clips.values())
            .filter(c => c.status === 'approved' && clientVideoIds.includes(c.videoId))
            .sort((a, b) => b.viralityScore - a.viralityScore);

        res.json(approvedClips);
    } catch (error) {
        console.error('Get approved clips error:', error);
        res.status(500).json({ error: 'Failed to get approved clips' });
    }
});

/**
 * Bulk schedule clips to social media
 * POST /api/content/clips/bulk-schedule
 * 
 * This is the Content Engine → Social Media pipeline endpoint
 */
router.post('/clips/bulk-schedule', authMiddleware, async (req, res) => {
    try {
        const {
            clipIds,
            socialAccountIds,
            scheduleMode = 'auto', // 'auto', 'manual', 'spread'
            startDate,
            endDate,
            postsPerDay = 2,
            preferredTimes = ['09:00', '12:00', '17:00', '20:00']
        } = req.body;

        if (!clipIds || !Array.isArray(clipIds) || clipIds.length === 0) {
            return res.status(400).json({ error: 'clipIds array is required' });
        }

        if (!socialAccountIds || !Array.isArray(socialAccountIds) || socialAccountIds.length === 0) {
            return res.status(400).json({ error: 'socialAccountIds array is required' });
        }

        // Validate clips exist and are approved
        const validClips = clipIds
            .map(id => clips.get(id))
            .filter(clip => clip && clip.status === 'approved');

        if (validClips.length === 0) {
            return res.status(400).json({ error: 'No valid approved clips found' });
        }

        // Calculate schedule based on mode
        const scheduledPosts = [];
        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : new Date(start.getTime() + (14 * 24 * 60 * 60 * 1000)); // Default 2 weeks

        if (scheduleMode === 'auto' || scheduleMode === 'spread') {
            // Auto-schedule: spread clips evenly across time period
            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            let clipIndex = 0;

            for (let day = 0; day < daysDiff && clipIndex < validClips.length; day++) {
                const postsForDay = Math.min(postsPerDay, validClips.length - clipIndex);

                for (let slot = 0; slot < postsForDay && clipIndex < validClips.length; slot++) {
                    const clip = validClips[clipIndex];
                    const postDate = new Date(start);
                    postDate.setDate(postDate.getDate() + day);

                    // Parse preferred time
                    const timeString = preferredTimes[slot % preferredTimes.length];
                    const [hours, minutes] = timeString.split(':').map(Number);
                    postDate.setHours(hours, minutes, 0, 0);

                    // Create a post for each social account
                    socialAccountIds.forEach(accountId => {
                        scheduledPosts.push({
                            id: uuidv4(),
                            clipId: clip.id,
                            socialAccountId: accountId,
                            caption: clip.suggestedCaption || '',
                            scheduledAt: postDate.toISOString(),
                            status: 'scheduled',
                            source: 'content_engine',
                            createdAt: new Date().toISOString()
                        });
                    });

                    clipIndex++;
                }
            }
        } else {
            // Manual mode: schedule all clips at the specified start date
            const postTime = new Date(start);

            validClips.forEach((clip, index) => {
                // Stagger posts by 3 hours
                const clipPostTime = new Date(postTime.getTime() + (index * 3 * 60 * 60 * 1000));

                socialAccountIds.forEach(accountId => {
                    scheduledPosts.push({
                        id: uuidv4(),
                        clipId: clip.id,
                        socialAccountId: accountId,
                        caption: clip.suggestedCaption || '',
                        scheduledAt: clipPostTime.toISOString(),
                        status: 'scheduled',
                        source: 'content_engine',
                        createdAt: new Date().toISOString()
                    });
                });
            });
        }

        // In production, save these to the scheduled posts store
        // For now, return the scheduled posts info
        console.log(`Bulk scheduled ${scheduledPosts.length} posts from Content Engine`);

        res.json({
            success: true,
            summary: {
                clipsScheduled: validClips.length,
                accountsTargeted: socialAccountIds.length,
                totalPosts: scheduledPosts.length,
                dateRange: {
                    start: start.toISOString(),
                    end: end.toISOString()
                }
            },
            posts: scheduledPosts.slice(0, 10), // Return first 10 for preview
            allPostIds: scheduledPosts.map(p => p.id)
        });
    } catch (error) {
        console.error('Bulk schedule error:', error);
        res.status(500).json({ error: 'Failed to schedule clips' });
    }
});

/**
 * Get scheduling suggestions for clips
 * POST /api/content/clips/suggest-schedule
 */
router.post('/clips/suggest-schedule', authMiddleware, async (req, res) => {
    try {
        const { clipIds, socialAccountIds, preferences = {} } = req.body;

        if (!clipIds || clipIds.length === 0) {
            return res.status(400).json({ error: 'clipIds required' });
        }

        // Get clip details for scoring
        const clipDetails = clipIds
            .map(id => clips.get(id))
            .filter(Boolean);

        // Sort by virality score (highest potential first)
        const sortedClips = [...clipDetails].sort((a, b) => b.viralityScore - a.viralityScore);

        // Generate optimal schedule suggestions
        const suggestions = {
            bestTimes: {
                instagram: ['11:00', '13:00', '19:00'],
                tiktok: ['07:00', '12:00', '19:00', '22:00'],
                youtube: ['12:00', '15:00', '18:00'],
                facebook: ['09:00', '13:00', '16:00'],
                linkedin: ['07:30', '12:00', '17:00'],
                twitter: ['08:00', '12:00', '17:00']
            },
            recommendedOrder: sortedClips.map(clip => ({
                clipId: clip.id,
                viralityScore: clip.viralityScore,
                suggestedPlatforms: getRecommendedPlatforms(clip),
                reason: clip.reason
            })),
            weeklySchedule: generateWeeklySchedule(sortedClips.length, preferences.postsPerDay || 2)
        };

        res.json({
            success: true,
            suggestions
        });
    } catch (error) {
        console.error('Suggest schedule error:', error);
        res.status(500).json({ error: 'Failed to generate suggestions' });
    }
});

// Helper: Recommend platforms based on clip characteristics
function getRecommendedPlatforms(clip) {
    const platforms = [];
    const duration = clip.duration || (clip.endTime - clip.startTime);

    // Short clips (< 60s) good for most platforms
    if (duration <= 60) {
        platforms.push('tiktok', 'instagram', 'youtube_shorts');
    }

    // Medium clips (1-3 min) better for YouTube, LinkedIn
    if (duration > 60 && duration <= 180) {
        platforms.push('youtube', 'linkedin', 'facebook');
    }

    // High virality clips recommended for all platforms
    if (clip.viralityScore > 0.85) {
        if (!platforms.includes('instagram')) platforms.push('instagram');
        if (!platforms.includes('tiktok')) platforms.push('tiktok');
    }

    return platforms.length > 0 ? platforms : ['instagram', 'tiktok'];
}

// Helper: Generate weekly schedule template
function generateWeeklySchedule(clipCount, postsPerDay) {
    const schedule = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    let clipIndex = 0;
    days.forEach(day => {
        schedule[day] = [];
        for (let i = 0; i < postsPerDay && clipIndex < clipCount; i++) {
            schedule[day].push({
                clipIndex: clipIndex,
                suggestedTime: i === 0 ? '12:00' : '18:00'
            });
            clipIndex++;
        }
    });

    return schedule;
}

/**
 * Auto-schedule a campaign's approved clips based on campaign settings
 * POST /api/content/campaigns/:campaignId/auto-schedule
 */
router.post('/campaigns/:campaignId/auto-schedule', authMiddleware, async (req, res) => {
    try {
        const campaign = campaigns.get(req.params.campaignId);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const { socialAccountIds = [] } = req.body;

        // Get campaign settings
        const settings = campaign.settings || {};
        const duration = settings.duration || '2 weeks';
        const frequency = settings.frequency || '3-5 posts/week';
        const platforms = campaign.targetPlatforms || ['instagram', 'tiktok'];

        // Get approved clips from this campaign's videos
        const campaignVideos = Array.from(videos.values())
            .filter(v => v.campaignId === campaign.id)
            .map(v => v.id);

        const approvedClips = Array.from(clips.values())
            .filter(c => campaignVideos.includes(c.videoId) && c.status === 'approved')
            .sort((a, b) => b.viralityScore - a.viralityScore);

        if (approvedClips.length === 0) {
            return res.status(400).json({
                error: 'No approved clips found for this campaign',
                hint: 'Upload videos and approve clips before scheduling'
            });
        }

        // Calculate schedule based on settings
        const weeksMap = { '1 week': 1, '2 weeks': 2, '3 weeks': 3, '4 weeks': 4, 'Ongoing': 8 };
        const frequencyMap = { '1-2 posts/week': 2, '3-5 posts/week': 4, '5-7 posts/week': 6, 'Daily': 7 };

        const totalWeeks = weeksMap[duration] || 2;
        const postsPerWeek = frequencyMap[frequency] || 4;
        const totalPostSlots = totalWeeks * postsPerWeek;

        // Generate schedule
        const scheduledPosts = [];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 1); // Start tomorrow

        // Best posting times by platform
        const bestTimes = {
            instagram: ['12:00', '17:00', '19:00'],
            tiktok: ['12:00', '15:00', '19:00'],
            facebook: ['13:00', '16:00', '20:00'],
            youtube: ['14:00', '17:00'],
            linkedin: ['10:00', '12:00']
        };

        let clipIndex = 0;
        for (let slot = 0; slot < totalPostSlots && clipIndex < approvedClips.length; slot++) {
            const clip = approvedClips[clipIndex % approvedClips.length];
            const platform = platforms[slot % platforms.length];
            const platformTimes = bestTimes[platform] || ['12:00', '17:00'];
            const timeIndex = Math.floor(slot / platforms.length) % platformTimes.length;

            // Calculate date
            const daysOffset = Math.floor(slot * (7 / postsPerWeek));
            const postDate = new Date(startDate);
            postDate.setDate(postDate.getDate() + daysOffset);

            const [hours, minutes] = platformTimes[timeIndex].split(':');
            postDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            scheduledPosts.push({
                id: uuidv4(),
                clipId: clip.id,
                campaignId: campaign.id,
                platform,
                caption: clip.suggestedCaption || `Check out our latest content! #${campaign.name.replace(/\s+/g, '')}`,
                scheduledAt: postDate.toISOString(),
                status: 'scheduled'
            });

            clipIndex++;
        }

        // Update campaign status
        campaign.status = 'scheduled';
        campaign.scheduledPostCount = scheduledPosts.length;
        campaign.updatedAt = new Date().toISOString();
        campaigns.set(campaign.id, campaign);

        res.json({
            success: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status
            },
            schedule: {
                totalPosts: scheduledPosts.length,
                clipsUsed: Math.min(approvedClips.length, totalPostSlots),
                platforms,
                duration,
                frequency,
                dateRange: {
                    start: scheduledPosts[0]?.scheduledAt,
                    end: scheduledPosts[scheduledPosts.length - 1]?.scheduledAt
                }
            },
            posts: scheduledPosts.slice(0, 5), // Preview first 5
            message: `Campaign "${campaign.name}" scheduled with ${scheduledPosts.length} posts across ${platforms.join(', ')}`
        });
    } catch (error) {
        console.error('Campaign auto-schedule error:', error);
        res.status(500).json({ error: 'Failed to auto-schedule campaign' });
    }
});

// ==================== CLIP EDITOR (Phase 5) ====================

// Import clip editor service
const clipEditor = require('../services/clipEditor');

/**
 * Get clip for editing with full data
 * GET /api/content/clips/:id/edit
 */
router.get('/clips/:id/edit', authMiddleware, (req, res) => {
    try {
        const clip = clipEditor.getClipForEditing(req.params.id);
        if (!clip) {
            return res.status(404).json({ error: 'Clip not found' });
        }
        res.json(clip);
    } catch (error) {
        console.error('Get clip for editing error:', error);
        res.status(500).json({ error: 'Failed to get clip' });
    }
});

/**
 * Update clip timeline (start/end times)
 * PATCH /api/content/clips/:id/timeline
 */
router.patch('/clips/:id/timeline', authMiddleware, (req, res) => {
    try {
        const { startTime, endTime } = req.body;

        if (startTime === undefined || endTime === undefined) {
            return res.status(400).json({ error: 'startTime and endTime are required' });
        }

        const clip = clipEditor.updateClipTimeline(req.params.id, startTime, endTime);
        res.json({ success: true, clip });
    } catch (error) {
        console.error('Update timeline error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Update clip transcript
 * PATCH /api/content/clips/:id/transcript
 */
router.patch('/clips/:id/transcript', authMiddleware, (req, res) => {
    try {
        const { transcript, segments } = req.body;

        if (!transcript) {
            return res.status(400).json({ error: 'transcript is required' });
        }

        const clip = clipEditor.updateClipTranscript(req.params.id, transcript, segments);
        res.json({ success: true, clip });
    } catch (error) {
        console.error('Update transcript error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Update clip caption style
 * PATCH /api/content/clips/:id/captions
 */
router.patch('/clips/:id/captions', authMiddleware, (req, res) => {
    try {
        const { style } = req.body;

        if (!style) {
            return res.status(400).json({ error: 'style is required (preset name or style object)' });
        }

        const clip = clipEditor.updateClipCaptionStyle(req.params.id, style);
        res.json({ success: true, clip });
    } catch (error) {
        console.error('Update captions error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get available caption style presets
 * GET /api/content/caption-styles
 */
router.get('/caption-styles', authMiddleware, (req, res) => {
    res.json(clipEditor.getCaptionStylePresets());
});

/**
 * Detect filler words in clip transcript
 * GET /api/content/clips/:id/filler-words
 */
router.get('/clips/:id/filler-words', authMiddleware, (req, res) => {
    try {
        const clip = clipEditor.getClipForEditing(req.params.id);
        if (!clip) {
            return res.status(404).json({ error: 'Clip not found' });
        }

        const fillers = clipEditor.detectFillerWords(clip.transcript || '');
        res.json({
            transcript: clip.transcript,
            fillerWords: fillers,
            count: fillers.length
        });
    } catch (error) {
        console.error('Detect fillers error:', error);
        res.status(500).json({ error: 'Failed to detect filler words' });
    }
});

/**
 * Remove filler words from clip transcript
 * POST /api/content/clips/:id/remove-fillers
 */
router.post('/clips/:id/remove-fillers', authMiddleware, (req, res) => {
    try {
        const clip = clipEditor.getClipForEditing(req.params.id);
        if (!clip) {
            return res.status(404).json({ error: 'Clip not found' });
        }

        const fillers = clipEditor.detectFillerWords(clip.transcript || '');
        const cleanedTranscript = clipEditor.removeFillerWords(clip.transcript || '', fillers);

        // Update the transcript
        const updatedClip = clipEditor.updateClipTranscript(req.params.id, cleanedTranscript);

        res.json({
            success: true,
            removedCount: fillers.length,
            originalTranscript: clip.transcript,
            cleanedTranscript,
            clip: updatedClip
        });
    } catch (error) {
        console.error('Remove fillers error:', error);
        res.status(500).json({ error: 'Failed to remove filler words' });
    }
});

/**
 * Set clip aspect ratio
 * PATCH /api/content/clips/:id/aspect-ratio
 */
router.patch('/clips/:id/aspect-ratio', authMiddleware, (req, res) => {
    try {
        const { aspectRatio } = req.body;

        if (!aspectRatio) {
            return res.status(400).json({ error: 'aspectRatio is required (9:16, 1:1, 4:5, 16:9)' });
        }

        const clip = clipEditor.setClipAspectRatio(req.params.id, aspectRatio);
        res.json({ success: true, clip });
    } catch (error) {
        console.error('Set aspect ratio error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Generate the final clip video file
 * POST /api/content/clips/:id/generate
 */
router.post('/clips/:id/generate', authMiddleware, async (req, res) => {
    try {
        const result = await clipEditor.generateClipFile(req.params.id);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Generate clip error:', error);
        res.status(500).json({ error: 'Failed to generate clip: ' + error.message });
    }
});

/**
 * Duplicate a clip for A/B testing
 * POST /api/content/clips/:id/duplicate
 */
router.post('/clips/:id/duplicate', authMiddleware, (req, res) => {
    try {
        const { title } = req.body;
        const newClip = clipEditor.duplicateClip(req.params.id, title);
        res.status(201).json({ success: true, clip: newClip });
    } catch (error) {
        console.error('Duplicate clip error:', error);
        res.status(500).json({ error: 'Failed to duplicate clip' });
    }
});

module.exports = router;
