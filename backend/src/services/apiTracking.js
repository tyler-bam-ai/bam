/**
 * API Usage Tracking Service
 * Tracks API usage per client for cost allocation and monitoring
 */

const { v4: uuidv4 } = require('uuid');

// In-memory store (replace with database)
const apiUsageLogs = [];

// Cost per 1K tokens (approximate, adjust based on actual pricing)
const COST_PER_1K_TOKENS = {
    'openrouter': {
        'anthropic/claude-3.5-sonnet': { prompt: 0.003, completion: 0.015 },
        'openai/gpt-4o': { prompt: 0.005, completion: 0.015 },
        'openai/gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
        'google/gemini-pro-1.5': { prompt: 0.00125, completion: 0.005 },
        'google/gemini-2.0-flash-exp': { prompt: 0.0, completion: 0.0 }, // Free during preview
        'default': { prompt: 0.001, completion: 0.002 }
    },
    'elevenlabs': {
        'default': { characters: 0.00003 } // ~$0.30 per 10K chars
    },
    'gemini': {
        'gemini-2.0-flash': { prompt: 0.0, completion: 0.0 },
        'default': { prompt: 0.00125, completion: 0.005 }
    }
};

/**
 * Log API usage for a client
 * @param {Object} params - Usage parameters
 * @param {string} params.clientId - Client UUID
 * @param {string} params.userId - User UUID (optional)
 * @param {string} params.service - Service name (openrouter, elevenlabs, gemini)
 * @param {string} params.model - Model name
 * @param {number} params.tokensPrompt - Prompt tokens used
 * @param {number} params.tokensCompletion - Completion tokens used
 * @param {string} params.endpoint - API endpoint called
 * @param {Object} params.metadata - Additional metadata
 */
function logUsage({
    clientId,
    userId = null,
    service,
    model = 'default',
    tokensPrompt = 0,
    tokensCompletion = 0,
    charactersUsed = 0,
    endpoint = '',
    metadata = {}
}) {
    const tokensTotal = tokensPrompt + tokensCompletion;

    // Calculate cost
    let costUsd = 0;
    const serviceCosts = COST_PER_1K_TOKENS[service] || {};
    const modelCosts = serviceCosts[model] || serviceCosts['default'] || { prompt: 0, completion: 0 };

    if (service === 'elevenlabs') {
        costUsd = (charactersUsed / 1000) * (modelCosts.characters || 0.00003);
    } else {
        costUsd = (tokensPrompt / 1000) * modelCosts.prompt +
            (tokensCompletion / 1000) * modelCosts.completion;
    }

    const logEntry = {
        id: uuidv4(),
        clientId,
        userId,
        service,
        model,
        tokensPrompt,
        tokensCompletion,
        tokensTotal,
        charactersUsed,
        costUsd: Math.round(costUsd * 1000000) / 1000000, // Round to 6 decimal places
        endpoint,
        metadata,
        createdAt: new Date().toISOString()
    };

    apiUsageLogs.push(logEntry);

    // Log for debugging
    console.log(`[API Usage] Client: ${clientId}, Service: ${service}, Model: ${model}, ` +
        `Tokens: ${tokensTotal}, Cost: $${logEntry.costUsd.toFixed(6)}`);

    return logEntry;
}

/**
 * Get usage summary for a client
 * @param {string} clientId - Client UUID
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for the query
 * @param {Date} options.endDate - End date for the query
 * @returns {Object} Usage summary
 */
function getClientUsageSummary(clientId, options = {}) {
    const { startDate, endDate } = options;

    let logs = apiUsageLogs.filter(l => l.clientId === clientId);

    if (startDate) {
        logs = logs.filter(l => new Date(l.createdAt) >= startDate);
    }
    if (endDate) {
        logs = logs.filter(l => new Date(l.createdAt) <= endDate);
    }

    // Aggregate by service
    const byService = {};
    logs.forEach(log => {
        if (!byService[log.service]) {
            byService[log.service] = {
                totalTokens: 0,
                totalCost: 0,
                requestCount: 0,
                byModel: {}
            };
        }
        byService[log.service].totalTokens += log.tokensTotal;
        byService[log.service].totalCost += log.costUsd;
        byService[log.service].requestCount += 1;

        // Aggregate by model within service
        if (!byService[log.service].byModel[log.model]) {
            byService[log.service].byModel[log.model] = {
                totalTokens: 0,
                totalCost: 0,
                requestCount: 0
            };
        }
        byService[log.service].byModel[log.model].totalTokens += log.tokensTotal;
        byService[log.service].byModel[log.model].totalCost += log.costUsd;
        byService[log.service].byModel[log.model].requestCount += 1;
    });

    // Calculate totals
    const totalTokens = logs.reduce((sum, l) => sum + l.tokensTotal, 0);
    const totalCost = logs.reduce((sum, l) => sum + l.costUsd, 0);
    const totalRequests = logs.length;

    // Calculate daily breakdown
    const dailyUsage = {};
    logs.forEach(log => {
        const date = log.createdAt.split('T')[0];
        if (!dailyUsage[date]) {
            dailyUsage[date] = { tokens: 0, cost: 0, requests: 0 };
        }
        dailyUsage[date].tokens += log.tokensTotal;
        dailyUsage[date].cost += log.costUsd;
        dailyUsage[date].requests += 1;
    });

    return {
        clientId,
        period: {
            start: startDate?.toISOString() || 'all-time',
            end: endDate?.toISOString() || 'now'
        },
        totals: {
            tokens: totalTokens,
            cost: Math.round(totalCost * 100) / 100,
            requests: totalRequests,
            averageCostPerRequest: totalRequests > 0 ?
                Math.round((totalCost / totalRequests) * 1000000) / 1000000 : 0
        },
        byService,
        dailyUsage: Object.entries(dailyUsage)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, data]) => ({ date, ...data }))
    };
}

/**
 * Get aggregated usage across all clients (admin view)
 * @returns {Object} Aggregated usage
 */
function getAllClientsUsage() {
    const byClient = {};

    apiUsageLogs.forEach(log => {
        if (!byClient[log.clientId]) {
            byClient[log.clientId] = {
                totalTokens: 0,
                totalCost: 0,
                requestCount: 0
            };
        }
        byClient[log.clientId].totalTokens += log.tokensTotal;
        byClient[log.clientId].totalCost += log.costUsd;
        byClient[log.clientId].requestCount += 1;
    });

    const totalCost = apiUsageLogs.reduce((sum, l) => sum + l.costUsd, 0);
    const totalTokens = apiUsageLogs.reduce((sum, l) => sum + l.tokensTotal, 0);

    return {
        totalClients: Object.keys(byClient).length,
        totalCost: Math.round(totalCost * 100) / 100,
        totalTokens,
        totalRequests: apiUsageLogs.length,
        byClient: Object.entries(byClient).map(([clientId, data]) => ({
            clientId,
            ...data,
            cost: Math.round(data.totalCost * 100) / 100
        })).sort((a, b) => b.totalCost - a.totalCost)
    };
}

/**
 * Create middleware to track API usage
 * @param {string} service - Service name
 * @param {Function} getClientId - Function to extract client ID from request
 */
function createTrackingMiddleware(service, getClientId) {
    return (req, res, next) => {
        // Store original json method
        const originalJson = res.json;

        res.json = function (data) {
            // Extract usage from response if available
            if (data?.usage) {
                const clientId = getClientId(req);
                if (clientId) {
                    logUsage({
                        clientId,
                        userId: req.user?.id,
                        service,
                        model: req.body?.model || data?.model || 'default',
                        tokensPrompt: data.usage.prompt_tokens || 0,
                        tokensCompletion: data.usage.completion_tokens || 0,
                        endpoint: req.originalUrl,
                        metadata: {
                            method: req.method,
                            userAgent: req.headers['user-agent']
                        }
                    });
                }
            }

            return originalJson.call(this, data);
        };

        next();
    };
}

module.exports = {
    logUsage,
    getClientUsageSummary,
    getAllClientsUsage,
    createTrackingMiddleware,
    COST_PER_1K_TOKENS
};
