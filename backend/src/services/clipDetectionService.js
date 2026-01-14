/**
 * Clip Detection Service
 * 
 * AI-powered clip detection using GPT-4 to analyze video transcripts
 * and identify viral-worthy moments with virality scoring.
 */

const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/db');
const transcriptionService = require('./transcriptionService');

// Lazy-initialize OpenAI client
let openai = null;

function getOpenAIClient() {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    return openai;
}

// Virality scoring weights
const VIRALITY_WEIGHTS = {
    hook: 25,      // First 3 seconds hook strength
    emotion: 25,   // Emotional impact
    insight: 20,   // Information density / key insights
    cta: 15,       // Call-to-action / shareability
    quality: 15    // Story completeness / video quality
};

/**
 * Analyze a video transcript and detect clip-worthy moments
 * @param {string} videoId - Video ID
 * @returns {Promise<Object>} - Detected clips with scores
 */
async function analyzeVideoForClips(videoId) {
    // Get transcript
    const transcript = transcriptionService.getTranscript(videoId);
    if (!transcript) {
        throw new Error(`No transcript found for video ${videoId}. Run transcription first.`);
    }

    console.log(`[ClipDetection] Analyzing video ${videoId} (${transcript.segments.length} segments)`);

    // Get video info
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);
    if (!video) {
        throw new Error(`Video not found: ${videoId}`);
    }

    // Use AI to detect key moments
    const clipCandidates = await detectKeyMoments(transcript, video);
    console.log(`[ClipDetection] Found ${clipCandidates.length} potential clips`);

    // Score each candidate for virality
    const scoredClips = await Promise.all(
        clipCandidates.map(clip => scoreViralPotential(clip, transcript))
    );

    // Sort by total score and take top candidates
    const topClips = scoredClips
        .sort((a, b) => b.viralityScore - a.viralityScore)
        .slice(0, 10); // Max 10 clips per video

    // Save clips to database
    for (const clip of topClips) {
        await saveClipToDatabase(videoId, clip);
    }

    // Update video status
    db.prepare(`
        UPDATE videos SET status = 'analyzed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(videoId);

    return {
        videoId,
        clipCount: topClips.length,
        clips: topClips.map(c => ({
            id: c.id,
            title: c.title,
            startTime: c.startTime,
            endTime: c.endTime,
            viralityScore: c.viralityScore,
            scores: c.scores
        }))
    };
}

/**
 * Use GPT-4 to detect key moments in a transcript
 * @param {Object} transcript - Video transcript with segments
 * @param {Object} video - Video metadata
 * @returns {Promise<Array>} - Array of clip candidates
 */
async function detectKeyMoments(transcript, video) {
    const client = getOpenAIClient();

    // Prepare transcript text with timestamps
    const transcriptWithTimestamps = transcript.segments.map(s =>
        `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`
    ).join('\n');

    const prompt = `You are an expert viral video editor. Analyze this transcript and identify the best moments to extract as short-form video clips (15-60 seconds each).

VIDEO TITLE: ${video.title || 'Untitled'}
DURATION: ${formatTime(transcript.duration)}

TRANSCRIPT:
${transcriptWithTimestamps}

For each clip candidate, identify:
1. The EXACT start and end timestamps (must match transcript timestamps)
2. Why this segment would perform well on TikTok/Reels/Shorts
3. A catchy hook or title for the clip
4. The emotional content (humor, inspiration, surprise, education, controversy)

Find 5-10 of the BEST moments. Prioritize:
- Strong opening hooks (first 3 seconds grab attention)
- Complete thoughts (don't cut mid-sentence)
- Emotional peaks (laughter, revelation, surprise)
- Actionable insights (tips viewers can use)
- Controversial or debate-worthy statements
- Story arcs with beginning/middle/end

Return as JSON array:
[
  {
    "startTime": 45.5,
    "endTime": 75.2,
    "title": "Catchy Title Here",
    "description": "Why this clip would go viral",
    "emotionalContent": "inspiration",
    "hookStrength": "strong",
    "transcript": "The actual text from this segment"
  }
]`;

    try {
        const response = await client.chat.completions.create({
            model: 'gpt-5.2',
            messages: [
                { role: 'system', content: 'You are a viral video expert. Return only valid JSON, no markdown.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        const content = response.choices[0].message.content.trim();

        // Parse JSON response
        let clips;
        try {
            // Handle potential markdown code blocks
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            clips = JSON.parse(jsonMatch ? jsonMatch[0] : content);
        } catch (parseError) {
            console.error('[ClipDetection] Failed to parse AI response:', content);
            throw new Error('Failed to parse clip detection response');
        }

        return clips.map(clip => ({
            ...clip,
            id: uuidv4()
        }));
    } catch (error) {
        console.error('[ClipDetection] AI analysis failed:', error);
        throw error;
    }
}

/**
 * Score a clip candidate for viral potential
 * @param {Object} clip - Clip candidate
 * @param {Object} transcript - Full transcript for context
 * @returns {Object} - Clip with virality scores
 */
async function scoreViralPotential(clip, transcript) {
    // Calculate individual scores
    const scores = {
        hook: calculateHookScore(clip),
        emotion: calculateEmotionScore(clip),
        insight: calculateInsightScore(clip),
        cta: calculateCtaScore(clip),
        quality: calculateQualityScore(clip)
    };

    // Calculate weighted total (0-100)
    const viralityScore = Math.round(
        (scores.hook / 100 * VIRALITY_WEIGHTS.hook) +
        (scores.emotion / 100 * VIRALITY_WEIGHTS.emotion) +
        (scores.insight / 100 * VIRALITY_WEIGHTS.insight) +
        (scores.cta / 100 * VIRALITY_WEIGHTS.cta) +
        (scores.quality / 100 * VIRALITY_WEIGHTS.quality)
    );

    // Generate AI title and description
    const { aiTitle, aiDescription } = await generateAIContent(clip);

    return {
        ...clip,
        viralityScore,
        scores,
        aiTitle,
        aiDescription,
        duration: clip.endTime - clip.startTime
    };
}

/**
 * Calculate hook strength score (0-100)
 */
function calculateHookScore(clip) {
    const hookStrengthMap = {
        'very_strong': 95,
        'strong': 85,
        'medium': 70,
        'weak': 50,
        'very_weak': 30
    };

    // Check for hook indicators in title/description
    const hookIndicators = ['secret', 'never', 'always', 'truth', 'mistake', 'how to', 'why', 'what if'];
    const titleLower = (clip.title || '').toLowerCase();
    const hasHookWord = hookIndicators.some(word => titleLower.includes(word));

    const baseScore = hookStrengthMap[clip.hookStrength] || 70;
    return Math.min(100, baseScore + (hasHookWord ? 10 : 0));
}

/**
 * Calculate emotional impact score (0-100)
 */
function calculateEmotionScore(clip) {
    const emotionScores = {
        'humor': 90,
        'surprise': 88,
        'inspiration': 85,
        'controversy': 82,
        'education': 75,
        'story': 78,
        'motivation': 80,
        'fear': 70,
        'neutral': 50
    };

    return emotionScores[clip.emotionalContent] || 65;
}

/**
 * Calculate insight/value score (0-100)
 */
function calculateInsightScore(clip) {
    const description = (clip.description || '').toLowerCase();
    const transcript = (clip.transcript || '').toLowerCase();

    let score = 60;

    // Actionable content indicators
    const actionWords = ['step', 'tip', 'trick', 'hack', 'method', 'strategy', 'secret'];
    if (actionWords.some(w => description.includes(w) || transcript.includes(w))) {
        score += 20;
    }

    // Numbers and specifics
    if (/\d+/.test(transcript)) {
        score += 10;
    }

    // Length - optimal is 20-45 seconds
    const duration = clip.endTime - clip.startTime;
    if (duration >= 20 && duration <= 45) {
        score += 10;
    }

    return Math.min(100, score);
}

/**
 * Calculate call-to-action/shareability score (0-100)
 */
function calculateCtaScore(clip) {
    const description = (clip.description || '').toLowerCase();

    let score = 60;

    // Shareability indicators
    const shareWords = ['share', 'tell', 'tag', 'send', 'save', 'follow'];
    if (shareWords.some(w => description.includes(w))) {
        score += 15;
    }

    // Debate potential
    if (description.includes('controversial') || description.includes('debate')) {
        score += 20;
    }

    // Relatability
    if (description.includes('relatable') || description.includes('everyone')) {
        score += 15;
    }

    return Math.min(100, score);
}

/**
 * Calculate content quality score (0-100)
 */
function calculateQualityScore(clip) {
    let score = 70;

    const duration = clip.endTime - clip.startTime;

    // Optimal duration (15-60 seconds)
    if (duration >= 15 && duration <= 60) {
        score += 15;
    } else if (duration < 10 || duration > 90) {
        score -= 20;
    }

    // Has complete thought (indicated by proper ending)
    const transcript = (clip.transcript || '');
    if (transcript.endsWith('.') || transcript.endsWith('!') || transcript.endsWith('?')) {
        score += 10;
    }

    // Reasonable word count for engagement
    const wordCount = transcript.split(/\s+/).length;
    if (wordCount >= 30 && wordCount <= 150) {
        score += 5;
    }

    return Math.min(100, score);
}

/**
 * Generate AI title and description for a clip
 */
async function generateAIContent(clip) {
    const client = getOpenAIClient();

    try {
        const response = await client.chat.completions.create({
            model: 'gpt-5.2-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Generate viral-optimized titles and descriptions. Use emojis sparingly. Keep titles under 60 chars. Return JSON only.'
                },
                {
                    role: 'user',
                    content: `Create a viral title and description for this clip:
                    
Original Title: ${clip.title}
Transcript: ${clip.transcript}
Emotion: ${clip.emotionalContent}

Return JSON: {"aiTitle": "...", "aiDescription": "..."}`
                }
            ],
            temperature: 0.8,
            max_tokens: 200
        });

        const content = response.choices[0].message.content.trim();
        const result = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));

        return {
            aiTitle: result.aiTitle || clip.title,
            aiDescription: result.aiDescription || clip.description
        };
    } catch (error) {
        console.error('[ClipDetection] AI content generation failed:', error);
        return {
            aiTitle: clip.title,
            aiDescription: clip.description
        };
    }
}

/**
 * Save a clip to the database
 */
async function saveClipToDatabase(videoId, clip) {
    const clipId = clip.id || uuidv4();

    const aiAnalysis = JSON.stringify({
        emotionalContent: clip.emotionalContent,
        hookStrength: clip.hookStrength,
        reason: clip.description,
        scores: clip.scores
    });

    db.prepare(`
        INSERT INTO clips (
            id, video_id, title, description, start_time, end_time, duration,
            virality_score, virality_hook, virality_emotion, virality_insight, 
            virality_cta, virality_quality, transcript, ai_title, ai_description,
            ai_analysis, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        clipId,
        videoId,
        clip.title,
        clip.description,
        clip.startTime,
        clip.endTime,
        clip.duration,
        clip.viralityScore,
        clip.scores.hook,
        clip.scores.emotion,
        clip.scores.insight,
        clip.scores.cta,
        clip.scores.quality,
        clip.transcript,
        clip.aiTitle,
        clip.aiDescription,
        aiAnalysis,
        'pending'
    );

    return clipId;
}

/**
 * Regenerate clips for a video with different parameters
 */
async function regenerateClips(videoId, options = {}) {
    // Delete existing clips
    db.prepare('DELETE FROM clips WHERE video_id = ?').run(videoId);

    // Re-run analysis
    return analyzeVideoForClips(videoId);
}

/**
 * Get clips for a video from database
 */
function getVideoClips(videoId) {
    const clips = db.prepare(`
        SELECT * FROM clips WHERE video_id = ? ORDER BY virality_score DESC
    `).all(videoId);

    return clips.map(clip => ({
        id: clip.id,
        videoId: clip.video_id,
        title: clip.title,
        description: clip.description,
        startTime: clip.start_time,
        endTime: clip.end_time,
        duration: clip.duration,
        viralityScore: clip.virality_score,
        scores: {
            hook: clip.virality_hook,
            emotion: clip.virality_emotion,
            insight: clip.virality_insight,
            cta: clip.virality_cta,
            quality: clip.virality_quality
        },
        transcript: clip.transcript,
        aiTitle: clip.ai_title,
        aiDescription: clip.ai_description,
        aspectRatio: clip.aspect_ratio,
        captionStyle: clip.caption_style,
        status: clip.status,
        scheduledFor: clip.scheduled_for,
        createdAt: clip.created_at
    }));
}

// Helper function
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

module.exports = {
    analyzeVideoForClips,
    detectKeyMoments,
    scoreViralPotential,
    regenerateClips,
    getVideoClips,
    VIRALITY_WEIGHTS
};
