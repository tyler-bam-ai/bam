/**
 * Consensus Engine - Anti-Hallucination Multi-Model System
 * 
 * Queries multiple LLM models via OpenRouter and uses consensus voting
 * to identify and filter out hallucinations. If one model disagrees with
 * the majority, it's likely hallucinating.
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Popular OpenRouter models for consensus
const DEFAULT_MODELS = [
    'openai/gpt-4-turbo',
    'anthropic/claude-3-sonnet',
    'google/gemini-pro',
    'meta-llama/llama-3.1-70b-instruct'
];

// Faster/cheaper models for quick consensus
const FAST_MODELS = [
    'openai/gpt-4o-mini',
    'anthropic/claude-3-haiku',
    'google/gemini-flash-1.5',
    'meta-llama/llama-3.1-8b-instruct'
];

class ConsensusEngine {
    constructor(options = {}) {
        this.apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
        this.models = options.models || DEFAULT_MODELS;
        this.minModels = options.minModels || 3; // Minimum models for consensus
        this.consensusThreshold = options.consensusThreshold || 0.6; // 60% agreement required
        this.timeout = options.timeout || 30000; // 30 second timeout per model
        this.debug = options.debug || false;
    }

    /**
     * Query multiple models and return consensus answer
     * @param {string} prompt - The user's question
     * @param {string} systemPrompt - System context/instructions
     * @param {object} context - Additional context (RAG results, etc.)
     * @returns {object} - { answer, confidence, details }
     */
    async getConsensusAnswer(prompt, systemPrompt = '', context = {}) {
        const startTime = Date.now();

        // Query all models in parallel
        const modelPromises = this.models.slice(0, this.minModels).map(model =>
            this.queryModel(model, prompt, systemPrompt, context)
        );

        const results = await Promise.allSettled(modelPromises);

        // Extract successful responses
        const responses = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value);

        if (responses.length < 2) {
            // Not enough responses for consensus, return best available
            return {
                answer: responses[0]?.answer || "I'm sorry, I couldn't get a reliable answer at this time.",
                confidence: 0.5,
                method: 'single_model',
                details: {
                    modelsQueried: this.models.slice(0, this.minModels).length,
                    responsesReceived: responses.length
                }
            };
        }

        // Analyze responses for consensus
        const consensus = this.analyzeConsensus(responses);

        if (this.debug) {
            console.log('Consensus Analysis:', {
                responses: responses.map(r => ({ model: r.model, answer: r.answer.substring(0, 100) })),
                consensus
            });
        }

        return {
            answer: consensus.bestAnswer,
            confidence: consensus.confidence,
            method: 'consensus',
            duration: Date.now() - startTime,
            details: {
                modelsQueried: this.models.slice(0, this.minModels).length,
                responsesReceived: responses.length,
                agreementScore: consensus.agreementScore,
                outliers: consensus.outliers,
                allResponses: this.debug ? responses : undefined
            }
        };
    }

    /**
     * Query a single model via OpenRouter
     */
    async queryModel(model, prompt, systemPrompt, context) {
        try {
            const messages = [];

            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }

            // Add context if available
            if (context.ragResults && context.ragResults.length > 0) {
                const contextText = context.ragResults
                    .map(r => `[Source: ${r.source}]\n${r.content}`)
                    .join('\n\n');
                messages.push({
                    role: 'system',
                    content: `Use the following knowledge base context to answer:\n\n${contextText}`
                });
            }

            messages.push({ role: 'user', content: prompt });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://bam.ai',
                    'X-Title': 'BAM.ai Consensus Engine'
                },
                body: JSON.stringify({
                    model,
                    messages,
                    max_tokens: 1000,
                    temperature: 0.3 // Lower temperature for more consistent answers
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`OpenRouter API error: ${response.status}`);
            }

            const data = await response.json();
            const answer = data.choices?.[0]?.message?.content || '';

            return {
                model,
                answer,
                usage: data.usage
            };
        } catch (error) {
            console.error(`Model ${model} failed:`, error.message);
            return null;
        }
    }

    /**
     * Analyze responses to find consensus
     */
    analyzeConsensus(responses) {
        if (responses.length === 0) {
            return { bestAnswer: '', confidence: 0, agreementScore: 0, outliers: [] };
        }

        if (responses.length === 1) {
            return {
                bestAnswer: responses[0].answer,
                confidence: 0.5,
                agreementScore: 1,
                outliers: []
            };
        }

        // Extract key facts/claims from each response
        const extractedFacts = responses.map(r => ({
            model: r.model,
            answer: r.answer,
            keyPoints: this.extractKeyPoints(r.answer)
        }));

        // Calculate similarity matrix
        const similarities = this.calculateSimilarities(extractedFacts);

        // Find the response most similar to others (likely the truth)
        const avgSimilarities = similarities.map((row, i) => ({
            index: i,
            model: responses[i].model,
            avgSimilarity: row.reduce((a, b) => a + b, 0) / row.length
        }));

        avgSimilarities.sort((a, b) => b.avgSimilarity - a.avgSimilarity);

        const bestIndex = avgSimilarities[0].index;
        const bestAnswer = responses[bestIndex].answer;

        // Identify outliers (responses with low similarity to consensus)
        const outliers = avgSimilarities
            .filter(s => s.avgSimilarity < 0.5) // Less than 50% similarity
            .map(s => s.model);

        // Calculate confidence based on agreement
        const agreementScore = avgSimilarities[0].avgSimilarity;
        const confidence = this.calculateConfidence(agreementScore, responses.length, outliers.length);

        return {
            bestAnswer,
            confidence,
            agreementScore,
            outliers,
            modelScores: avgSimilarities
        };
    }

    /**
     * Extract key points from an answer for comparison
     */
    extractKeyPoints(answer) {
        // Simple extraction: sentences, numbers, proper nouns
        const points = [];

        // Extract sentences
        const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 10);
        points.push(...sentences.map(s => s.trim().toLowerCase()));

        // Extract numbers and data points
        const numbers = answer.match(/\d+(?:\.\d+)?%?/g) || [];
        points.push(...numbers);

        // Extract quoted text (likely specific facts)
        const quoted = answer.match(/"[^"]+"/g) || [];
        points.push(...quoted.map(q => q.toLowerCase()));

        return points;
    }

    /**
     * Calculate semantic similarity between responses
     */
    calculateSimilarities(extractedFacts) {
        const n = extractedFacts.length;
        const matrix = Array(n).fill(null).map(() => Array(n).fill(0));

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i === j) {
                    matrix[i][j] = 1;
                } else {
                    matrix[i][j] = this.jaccardSimilarity(
                        extractedFacts[i].keyPoints,
                        extractedFacts[j].keyPoints
                    );
                }
            }
        }

        return matrix;
    }

    /**
     * Jaccard similarity between two sets
     */
    jaccardSimilarity(set1, set2) {
        if (set1.length === 0 && set2.length === 0) return 1;
        if (set1.length === 0 || set2.length === 0) return 0;

        // Normalize and find overlapping content
        const normalize = (arr) => arr.map(s =>
            String(s).toLowerCase().replace(/[^\w\s]/g, '').trim()
        ).filter(s => s.length > 0);

        const a = new Set(normalize(set1));
        const b = new Set(normalize(set2));

        // Check for semantic overlap (words in common)
        let matches = 0;
        for (const item of a) {
            for (const other of b) {
                if (item.includes(other) || other.includes(item) ||
                    this.wordOverlap(item, other) > 0.5) {
                    matches++;
                    break;
                }
            }
        }

        const union = Math.max(a.size, b.size);
        return union > 0 ? matches / union : 0;
    }

    /**
     * Calculate word overlap between two strings
     */
    wordOverlap(str1, str2) {
        const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 3));
        const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 3));

        if (words1.size === 0 || words2.size === 0) return 0;

        let overlap = 0;
        for (const word of words1) {
            if (words2.has(word)) overlap++;
        }

        return overlap / Math.max(words1.size, words2.size);
    }

    /**
     * Calculate confidence score
     */
    calculateConfidence(agreementScore, totalModels, outlierCount) {
        // Base confidence from agreement
        let confidence = agreementScore;

        // Boost for more models agreeing
        if (totalModels >= 4 && outlierCount === 0) confidence += 0.1;
        if (totalModels >= 3 && outlierCount <= 1) confidence += 0.05;

        // Penalty for outliers
        confidence -= (outlierCount * 0.1);

        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Get available models list
     */
    static getAvailableModels(tier = 'default') {
        return tier === 'fast' ? FAST_MODELS : DEFAULT_MODELS;
    }
}

// Configuration storage
const clientConfigs = new Map();

// Default configuration
const DEFAULT_CONFIG = {
    enabled: true,
    modelCount: 3,
    modelTier: 'fast', // 'fast' or 'default'
    consensusThreshold: 0.6,
    timeout: 30000,
    models: null // null = use tier defaults
};

/**
 * Get consensus configuration for a client
 */
function getClientConfig(clientId) {
    return clientConfigs.get(clientId) || { ...DEFAULT_CONFIG };
}

/**
 * Update consensus configuration for a client
 */
function setClientConfig(clientId, config) {
    const current = getClientConfig(clientId);
    clientConfigs.set(clientId, { ...current, ...config });
    return clientConfigs.get(clientId);
}

/**
 * Create a ConsensusEngine instance for a client
 */
function createEngineForClient(clientId, apiKey) {
    const config = getClientConfig(clientId);

    const models = config.models || ConsensusEngine.getAvailableModels(config.modelTier);

    return new ConsensusEngine({
        apiKey,
        models,
        minModels: config.modelCount,
        consensusThreshold: config.consensusThreshold,
        timeout: config.timeout
    });
}

module.exports = {
    ConsensusEngine,
    getClientConfig,
    setClientConfig,
    createEngineForClient,
    DEFAULT_MODELS,
    FAST_MODELS
};
