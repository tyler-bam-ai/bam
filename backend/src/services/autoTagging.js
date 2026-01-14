/**
 * Auto-Tagging Rules Engine
 * 
 * Automated content tagging based on rules:
 * - Platform-specific hashtag rules
 * - Content categorization
 * - Trend detection
 * - Custom client rules
 */

const { db } = require('../db/db');
const { v4: uuidv4 } = require('uuid');

// Default hashtag sets by category
const DEFAULT_HASHTAGS = {
    business: ['#business', '#entrepreneur', '#smallbusiness', '#startup', '#success'],
    wellness: ['#wellness', '#health', '#selfcare', '#mindfulness', '#healthylifestyle'],
    fitness: ['#fitness', '#workout', '#gym', '#fitnessmotivation', '#healthylifestyle'],
    beauty: ['#beauty', '#skincare', '#makeup', '#beautytips', '#glowup'],
    food: ['#food', '#foodie', '#cooking', '#recipe', '#delicious'],
    tech: ['#tech', '#technology', '#innovation', '#ai', '#digital'],
    education: ['#education', '#learning', '#knowledge', '#tips', '#howto'],
    motivation: ['#motivation', '#inspiration', '#mindset', '#success', '#goals']
};

// Platform-specific hashtag limits and best practices
const PLATFORM_RULES = {
    instagram: {
        maxHashtags: 30,
        recommendedHashtags: 11,
        positionInCaption: 'end',
        allowEmojis: true
    },
    tiktok: {
        maxHashtags: 5,
        recommendedHashtags: 4,
        positionInCaption: 'end',
        allowEmojis: true,
        trendingFirst: true
    },
    twitter: {
        maxHashtags: 3,
        recommendedHashtags: 2,
        positionInCaption: 'inline',
        allowEmojis: true
    },
    linkedin: {
        maxHashtags: 5,
        recommendedHashtags: 3,
        positionInCaption: 'end',
        allowEmojis: false
    },
    facebook: {
        maxHashtags: 3,
        recommendedHashtags: 2,
        positionInCaption: 'end',
        allowEmojis: true
    }
};

/**
 * Create a tagging rule
 * @param {Object} ruleData - Rule configuration
 * @returns {Object} - Created rule
 */
function createTaggingRule(ruleData) {
    const {
        companyId,
        name,
        triggerType, // 'keyword', 'category', 'platform', 'time'
        triggerValue,
        hashtags,
        mentions,
        priority = 0,
        enabled = true
    } = ruleData;

    const id = uuidv4();
    const config = JSON.stringify({
        triggerType,
        triggerValue,
        hashtags: hashtags || [],
        mentions: mentions || [],
        priority
    });

    // Store rules in a generic way (we'll use knowledge_items table with type 'tagging_rule')
    db.prepare(`
        INSERT INTO knowledge_items (id, company_id, type, title, content, status)
        VALUES (?, ?, 'tagging_rule', ?, ?, ?)
    `).run(id, companyId, name, config, enabled ? 'active' : 'disabled');

    return {
        id,
        name,
        ...ruleData
    };
}

/**
 * Get all tagging rules for a company
 * @param {string} companyId - Company ID
 * @returns {Array} - Tagging rules
 */
function getTaggingRules(companyId) {
    const rules = db.prepare(`
        SELECT * FROM knowledge_items 
        WHERE company_id = ? AND type = 'tagging_rule' AND status != 'deleted'
        ORDER BY title
    `).all(companyId);

    return rules.map(formatRule);
}

/**
 * Apply tagging rules to content
 * @param {string} companyId - Company ID
 * @param {string} content - Content text
 * @param {string} platform - Target platform
 * @param {Object} context - Additional context (category, time, etc.)
 * @returns {Object} - Suggested hashtags and mentions
 */
function applyTaggingRules(companyId, content, platform, context = {}) {
    const rules = getTaggingRules(companyId);
    const platformRules = PLATFORM_RULES[platform] || PLATFORM_RULES.instagram;

    const contentLower = content.toLowerCase();
    const matchedHashtags = new Set();
    const matchedMentions = new Set();

    // Apply custom rules
    for (const rule of rules) {
        if (!rule.enabled) continue;

        let matches = false;

        switch (rule.config.triggerType) {
            case 'keyword':
                matches = contentLower.includes(rule.config.triggerValue.toLowerCase());
                break;
            case 'category':
                matches = context.category === rule.config.triggerValue;
                break;
            case 'platform':
                matches = platform === rule.config.triggerValue;
                break;
            case 'always':
                matches = true;
                break;
        }

        if (matches) {
            rule.config.hashtags?.forEach(h => matchedHashtags.add(h));
            rule.config.mentions?.forEach(m => matchedMentions.add(m));
        }
    }

    // Add category-based defaults if few matches
    if (matchedHashtags.size < 3 && context.category) {
        const categoryTags = DEFAULT_HASHTAGS[context.category] || [];
        categoryTags.forEach(h => matchedHashtags.add(h));
    }

    // Limit to platform max
    const hashtags = Array.from(matchedHashtags).slice(0, platformRules.maxHashtags);
    const mentions = Array.from(matchedMentions);

    return {
        hashtags,
        mentions,
        platformRules,
        recommended: hashtags.slice(0, platformRules.recommendedHashtags)
    };
}

/**
 * Analyze content and suggest category
 * @param {string} content - Content text
 * @returns {Object} - Suggested categories with confidence
 */
function analyzeContent(content) {
    const contentLower = content.toLowerCase();
    const categoryScores = {};

    // Simple keyword matching for category detection
    const categoryKeywords = {
        business: ['business', 'company', 'profit', 'revenue', 'client', 'customer', 'growth', 'strategy'],
        wellness: ['wellness', 'health', 'meditation', 'mental', 'stress', 'peace', 'calm', 'balance'],
        fitness: ['workout', 'exercise', 'gym', 'muscle', 'training', 'cardio', 'fit', 'strong'],
        beauty: ['beauty', 'skin', 'makeup', 'glow', 'facial', 'cosmetic', 'hair', 'nails'],
        food: ['food', 'recipe', 'cook', 'eat', 'delicious', 'meal', 'restaurant', 'taste'],
        tech: ['tech', 'software', 'app', 'digital', 'ai', 'automation', 'code', 'data'],
        education: ['learn', 'teach', 'education', 'course', 'training', 'knowledge', 'tips', 'how to'],
        motivation: ['motivation', 'inspire', 'goal', 'dream', 'success', 'mindset', 'believe', 'achieve']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        let score = 0;
        for (const keyword of keywords) {
            if (contentLower.includes(keyword)) {
                score += 1;
            }
        }
        if (score > 0) {
            categoryScores[category] = score / keywords.length;
        }
    }

    // Sort by score and return top categories
    const sorted = Object.entries(categoryScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([category, score]) => ({ category, confidence: Math.min(score * 2, 1) }));

    return {
        primaryCategory: sorted[0]?.category || 'general',
        categories: sorted,
        hashtags: sorted[0] ? (DEFAULT_HASHTAGS[sorted[0].category] || []) : []
    };
}

/**
 * Generate caption with hashtags
 * @param {string} caption - Original caption
 * @param {Array} hashtags - Hashtags to add
 * @param {string} platform - Target platform
 * @returns {string} - Caption with hashtags
 */
function generateCaptionWithHashtags(caption, hashtags, platform) {
    const rules = PLATFORM_RULES[platform] || PLATFORM_RULES.instagram;
    const limitedHashtags = hashtags.slice(0, rules.maxHashtags);
    const hashtagString = limitedHashtags.join(' ');

    if (rules.positionInCaption === 'inline') {
        // For Twitter, integrate naturally
        return `${caption} ${limitedHashtags.slice(0, 2).join(' ')}`;
    } else {
        // For others, add at end with spacing
        return `${caption}\n\n${hashtagString}`;
    }
}

/**
 * Delete a tagging rule
 * @param {string} ruleId - Rule ID
 */
function deleteTaggingRule(ruleId) {
    db.prepare("UPDATE knowledge_items SET status = 'deleted' WHERE id = ?").run(ruleId);
    return { deleted: true };
}

/**
 * Update a tagging rule
 * @param {string} ruleId - Rule ID
 * @param {Object} updates - Fields to update
 */
function updateTaggingRule(ruleId, updates) {
    const existing = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(ruleId);
    if (!existing) throw new Error('Rule not found');

    const config = JSON.parse(existing.content);

    if (updates.triggerType) config.triggerType = updates.triggerType;
    if (updates.triggerValue) config.triggerValue = updates.triggerValue;
    if (updates.hashtags) config.hashtags = updates.hashtags;
    if (updates.mentions) config.mentions = updates.mentions;
    if (updates.priority !== undefined) config.priority = updates.priority;

    db.prepare(`
        UPDATE knowledge_items 
        SET title = COALESCE(?, title), content = ?, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(updates.name, JSON.stringify(config), updates.enabled === false ? 'disabled' : updates.enabled === true ? 'active' : null, ruleId);

    return formatRule({ ...existing, title: updates.name || existing.title, content: JSON.stringify(config) });
}

function formatRule(row) {
    const config = JSON.parse(row.content);
    return {
        id: row.id,
        name: row.title,
        enabled: row.status === 'active',
        config,
        createdAt: row.created_at
    };
}

module.exports = {
    createTaggingRule,
    getTaggingRules,
    applyTaggingRules,
    analyzeContent,
    generateCaptionWithHashtags,
    deleteTaggingRule,
    updateTaggingRule,
    DEFAULT_HASHTAGS,
    PLATFORM_RULES
};
