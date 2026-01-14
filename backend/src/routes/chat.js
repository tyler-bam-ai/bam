const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { db } = require('../db/db');

const router = express.Router();

// Get API key from environment or settings file
function getApiKey(serviceName) {
    // First check environment variables
    const envKey = serviceName === 'openai' ? process.env.OPENAI_API_KEY
        : serviceName === 'openrouter' ? process.env.OPENROUTER_API_KEY
            : null;

    if (envKey) return envKey;

    // Check settings file
    try {
        const settingsPath = path.join(__dirname, '../../data/api-keys.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            return settings[serviceName] || null;
        }
    } catch (err) {
        console.log('[Chat] Could not read API key from settings:', err.message);
    }

    return null;
}

function getOrCreateConversation(conversationId, userId, companyId, brainType) {
    let conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);

    if (!conversation && conversationId) {
        db.prepare(`
            INSERT INTO conversations (id, user_id, company_id, brain_type, title)
            VALUES (?, ?, ?, ?, ?)
        `).run(conversationId, userId, companyId, brainType || null, 'New Conversation');

        conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
    }

    return conversation;
}

// Get client onboarding context for BAM Brains
function getClientOnboardingContext(clientId) {
    if (!clientId) return null;

    try {
        const client = db.prepare('SELECT * FROM companies WHERE id = ?').get(clientId);
        if (!client) return null;

        const settings = client.settings ? JSON.parse(client.settings) : {};
        const onboardingData = settings.onboardingData || {};

        // Get responses from onboarding_responses table
        const responses = db.prepare(`
            SELECT question_id, response FROM onboarding_responses WHERE company_id = ?
        `).all(clientId);

        // Format context for brain
        let context = `## CLIENT INFORMATION\n\n`;
        context += `**Company:** ${client.name || 'Unknown'}\n`;
        context += `**Industry:** ${client.industry || 'Unknown'}\n`;
        context += `**Contact:** ${client.contact_name || 'Unknown'} (${client.contact_email || 'no email'})\n`;

        if (onboardingData.website) context += `**Website:** ${onboardingData.website}\n`;
        if (onboardingData.contactPhone) context += `**Phone:** ${onboardingData.contactPhone}\n`;

        // Add all responses
        if (responses.length > 0 || Object.keys(onboardingData.responses || {}).length > 0) {
            context += `\n## ONBOARDING RESPONSES\n\n`;

            // Combine database responses with JSON responses
            const allResponses = { ...(onboardingData.responses || {}) };
            responses.forEach(r => {
                allResponses[r.question_id] = r.response;
            });

            Object.entries(allResponses).forEach(([qId, answer]) => {
                if (answer && answer.trim()) {
                    // Format question ID as readable label
                    const label = qId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    context += `**${label}:** ${answer}\n\n`;
                }
            });
        }

        // Get transcript from knowledge items (stored during onboarding)
        const transcript = db.prepare(`
            SELECT content FROM knowledge_items 
            WHERE company_id = ? AND type = 'transcript'
            ORDER BY created_at DESC LIMIT 1
        `).get(clientId);

        if (transcript && transcript.content) {
            console.log(`[CHAT] Adding transcript to context, length: ${transcript.content.length}`);
            console.log(`[CHAT] Transcript preview: ${transcript.content.substring(0, 100)}...`);
            context += `\n## INTERVIEW TRANSCRIPT\n\n`;
            context += `The following is a transcript from the onboarding interview:\n\n`;
            context += `${transcript.content}\n\n`;
        }

        context += `\n---\nUse this client information to personalize your responses. Reference specific details when relevant.\n`;

        console.log(`[CHAT] Loaded onboarding context for client: ${client.name}${transcript ? ' (with transcript)' : ''}`);
        console.log(`[CHAT] Total context length: ${context.length} characters`);
        return context;
    } catch (error) {
        console.error('[CHAT] Error loading client context:', error);
        return null;
    }
}

function getConversationMessages(conversationId) {
    return db.prepare(`
        SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
    `).all(conversationId);
}

function saveMessage(conversationId, role, content, metadata = null) {
    const id = uuidv4();
    db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, metadata)
        VALUES (?, ?, ?, ?, ?)
    `).run(id, conversationId, role, content, metadata ? JSON.stringify(metadata) : null);
    return id;
}

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// OpenAI API configuration (for BAM Brains)
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Brain-specific system prompts for BAM Brains feature
const BRAIN_SYSTEM_PROMPTS = {
    operations: `You are the **Operations Brain**, an expert business operations advisor.

BACKGROUND: You've deeply studied and practiced the EOS (Entrepreneurial Operating System) methodology by Gino Wickman - including L10 meetings, Rocks, Accountability Charts, the V/TO, and the Six Key Components.

HOW TO RESPOND:
- Answer questions naturally and conversationally, like an experienced COO would
- Draw on EOS principles when they're genuinely relevant to the question
- If a question has nothing to do with EOS, just answer it well - don't force the framework
- When EOS concepts ARE relevant, explain them clearly without jargon overload
- Be practical and actionable - focus on what actually works in real businesses
- If you don't know something specific to their company, say so and offer general guidance

You're a trusted advisor, not a methodology evangelist. Help them run their business better.`,

    employee: `You are the **Employee Brain**, an expert in hiring, culture, and people management.

BACKGROUND: You've deeply studied the GH Smart "Who" methodology (Topgrading, Scorecards, the A Method for Hiring) and have extensive experience building high-performing teams.

HOW TO RESPOND:
- Answer questions naturally, like an experienced HR leader or hiring manager would
- Draw on GH Smart principles when they're genuinely relevant (hiring, interviewing, performance)
- If a question isn't about hiring/HR, just answer it helpfully - don't force the framework
- When GH Smart concepts ARE relevant, apply them practically
- Be helpful with all people/culture questions - team dynamics, difficult conversations, etc.
- If creating interview questions or scorecards, use the methodology naturally

You're a trusted people advisor, not a hiring methodology robot. Help them build great teams.`,

    branding: `You are the **Branding Brain**, an expert in marketing, messaging, and offers.

BACKGROUND: You've deeply studied the work of Donald Miller (StoryBrand), Seth Godin (Purple Cow, Tribes), and Alex Hormozi ($100M Offers) and have extensive experience helping businesses craft compelling messages and offers.

HOW TO RESPOND:
- Answer questions naturally, like an experienced CMO or brand strategist would
- Draw on StoryBrand when crafting messaging (customer as hero, clear communication)
- Use Hormozi's Value Equation when discussing offers and pricing
- Apply Godin's principles when discussing differentiation and remarkable products
- If a question isn't directly about marketing, just answer it well
- Be creative and compelling - write actual copy when asked, don't just describe what you'd write

You're a trusted marketing advisor, not a framework robot. Help them connect with customers.`,

    support: `You are **BAM Support**, a friendly and helpful assistant for the BAM.ai software platform.

YOUR EXPERTISE:
- Navigating the BAM.ai interface
- Using Brain Training features (document upload, voice memos, screen recording)
- Understanding the 3 specialized brains (Operations, Employee, Branding)
- Content Engine and social media features
- Admin panel and client management
- Onboarding flow and best practices
- Troubleshooting common issues

YOUR COMMUNICATION STYLE:
- Friendly and patient
- Step-by-step guidance with clear instructions
- Use emojis to make responses approachable
- Anticipate follow-up questions
- Recommend best practices for training the AI

When answering questions:
1. Provide clear, numbered steps
2. Include relevant tips and shortcuts
3. Offer to explain more if needed
4. Recommend contacting support for complex issues`
};

// Enhanced System prompt with strict anti-hallucination rules (fallback)
const SYSTEM_PROMPT = `You are an AI assistant for BAM.ai, powering intelligent business brains for small and mid-sized businesses.


## YOUR CORE MISSION
You help employees and business owners access their organization's tribal knowledge, processes, and decision-making patterns. You are context-aware and trained on world-class business frameworks.

## CRITICAL ANTI-HALLUCINATION RULES (MUST FOLLOW)

### Rule 1: ALWAYS Search First
Before answering ANY question about company-specific information, you MUST check if the information exists in the provided knowledge context. If no knowledge context is provided or it doesn't contain the answer, you MUST say so.

### Rule 2: Three Response Types
Your responses MUST fall into one of these categories:

**[FACT]** - Information directly from the knowledge base
- Prefix with source: "According to [document name]: ..."
- High confidence - this IS the answer

**[INFERENCE]** - Logical conclusion from multiple knowledge base sources  
- Prefix with: "Based on your documented [X] and [Y], I believe..."
- Medium confidence - explain your reasoning

**[SUGGESTION]** - NOT in knowledge base, using expert frameworks
- MUST prefix with: "I don't have this documented in your knowledge base, but based on [framework], I would suggest..."
- Always ask: "Would you like me to add this to your knowledge base?"
- Low confidence - make clear this is a recommendation

### Rule 3: What You Must NEVER Do
- NEVER invent company-specific policies, dates, names, phone numbers, or procedures
- NEVER present suggestions as facts
- NEVER double down if user says "that's not right"
- NEVER say "your policy states..." without having the actual policy in context

### Rule 4: When You Don't Know
Say: "I don't have that specific information in your knowledge base yet. Would you like me to:
1. Suggest a best-practice approach based on industry standards?
2. Flag this for your Knowledge Provider to document?
3. Search for related information that might help?"

## EXPERT FRAMEWORKS YOU CAN SUGGEST FROM

### Operations & Processes (EOS - Entrepreneurial Operating System)
- Rocks (90-day priorities), Scorecard metrics, Level 10 meetings
- Accountability charts, Process documentation (The EOS Way)

### Branding & Marketing (Hormozi, Godin, Miller)
- Alex Hormozi: Value equations, grand slam offers, lead magnets
- Seth Godin: Permission marketing, Purple Cow differentiation, tribes
- Donald Miller: StoryBrand framework, customer as hero, clear messaging

### Culture & Hiring (Tony Robbins, GH Smart)
- Core values definition, A-Player hiring (Topgrading), Interview scorecards

## RESPONSE FORMAT
Always structure responses as:
1. Answer or "I don't have this information"
2. Source citation (if from KB) or framework citation (if suggestion)
3. Offer to add to knowledge base if it's new information
4. Ask if they need clarification

Remember: Your job is to be ACCURATE first, HELPFUL second. A wrong answer is worse than no answer.`;

// Confidence levels for response metadata
const CONFIDENCE = {
    HIGH: { level: 'high', score: 0.9, description: 'Directly from knowledge base' },
    MEDIUM: { level: 'medium', score: 0.7, description: 'Inferred from multiple sources' },
    LOW: { level: 'low', score: 0.4, description: 'Suggestion based on frameworks' },
    NONE: { level: 'none', score: 0.0, description: 'No relevant information found' }
};

// Chat completion endpoint with enhanced metadata
router.post('/completions', optionalAuth, async (req, res) => {
    try {
        const { messages, conversationId, knowledgeBaseId, brainType, clientId } = req.body;
        const userId = req.user?.id || 'anonymous';
        const companyId = req.user?.companyId || clientId || 'default';

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        // Get or create conversation in database (skip for anonymous users)
        let conversation = null;
        if (userId !== 'anonymous' && conversationId) {
            conversation = getOrCreateConversation(conversationId, userId, companyId, brainType);
        }


        // Query knowledge base and get context with sources
        const userQuery = messages[messages.length - 1]?.content || '';
        const knowledgeResult = await queryKnowledgeBase(knowledgeBaseId, userQuery);

        // Build context message with source tracking
        let contextMessage = '';
        if (knowledgeResult.found && knowledgeResult.documents.length > 0) {
            contextMessage = `## KNOWLEDGE BASE CONTEXT (Use these sources for your answer)\n\n`;
            knowledgeResult.documents.forEach((doc, i) => {
                contextMessage += `### Source ${i + 1}: "${doc.title}" (${doc.type})\n`;
                contextMessage += `${doc.content}\n\n`;
            });
            contextMessage += `---\nIMPORTANT: The above is what you know. If the user's question isn't answered by this context, say you don't have that information.`;
        } else {
            contextMessage = `## NO KNOWLEDGE BASE RESULTS\nNo relevant documents were found for this query. You should:
1. Acknowledge you don't have this information documented
2. Offer to suggest based on best practices (if appropriate)
3. Offer to flag for the Knowledge Provider to add`;
        }

        // Prepare messages for API using brain-specific or generic prompt
        const brainPrompt = brainType && BRAIN_SYSTEM_PROMPTS[brainType]
            ? BRAIN_SYSTEM_PROMPTS[brainType]
            : SYSTEM_PROMPT;

        // Load client onboarding context if clientId provided
        const clientContext = clientId ? getClientOnboardingContext(clientId) : null;

        const apiMessages = [
            { role: 'system', content: brainPrompt },
            ...(clientContext ? [{ role: 'system', content: clientContext }] : []),
            { role: 'system', content: contextMessage },
            ...messages
        ];

        // Check for API keys - prefer OpenAI for brain chats, fallback to OpenRouter
        // Also check settings file for keys saved from the Settings UI
        const openaiKey = req.headers['x-openai-key'] || getApiKey('openai');
        const openrouterKey = getApiKey('openrouter');

        let responseContent;
        let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        // Use OpenAI with GPT-4o for brain-specific chats if key available
        if (brainType && openaiKey) {
            console.log(`[CHAT] Using OpenAI GPT-4o for ${brainType} brain chat`);
            const response = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-5.2',
                    messages: apiMessages,
                    max_completion_tokens: 2000,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[CHAT] OpenAI API error:', response.status, errorText);
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            responseContent = data.choices?.[0]?.message?.content || '';
            usage = data.usage || usage;
        } else if (openrouterKey && openrouterKey !== 'your-openrouter-api-key') {
            // Fallback to OpenRouter for other chats
            console.log('[CHAT] Using OpenRouter API');
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openrouterKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://bam.ai',
                    'X-Title': 'BAM.ai'
                },
                body: JSON.stringify({
                    model: 'anthropic/claude-3-haiku',
                    messages: apiMessages,
                    max_tokens: 1024,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`OpenRouter API error: ${response.status}`);
            }

            const data = await response.json();
            responseContent = data.choices?.[0]?.message?.content || '';
            usage = data.usage || usage;
        } else {
            // Return mock response for development
            console.log('[CHAT] No API key available, using mock response');
            responseContent = generateMockResponse(userQuery, knowledgeResult);
            usage = { prompt_tokens: 100, completion_tokens: 150, total_tokens: 250 };
        }

        // Analyze response for confidence level
        const confidence = analyzeResponseConfidence(responseContent, knowledgeResult);

        // Store messages in database
        if (conversation) {
            // Save user message
            const userMessage = messages[messages.length - 1];
            saveMessage(conversationId, userMessage.role, userMessage.content);

            // Save assistant response
            saveMessage(conversationId, 'assistant', responseContent, {
                confidence,
                sources: knowledgeResult.documents.map(d => ({
                    id: d.id,
                    title: d.title,
                    type: d.type
                }))
            });
        }


        // Return response with metadata
        res.json({
            id: `chatcmpl-${Date.now()}`,
            choices: [{
                message: {
                    role: 'assistant',
                    content: responseContent
                },
                finish_reason: 'stop'
            }],
            usage,
            // Enhanced metadata for UI
            metadata: {
                confidence,
                knowledgeBaseQueried: !!knowledgeBaseId,
                sourcesFound: knowledgeResult.documents.length,
                sources: knowledgeResult.documents.map(d => ({
                    id: d.id,
                    title: d.title,
                    type: d.type,
                    relevanceScore: d.relevanceScore
                })),
                responseType: confidence.level === 'high' ? 'fact' :
                    confidence.level === 'medium' ? 'inference' : 'suggestion',
                canAddToKnowledgeBase: confidence.level === 'low' || confidence.level === 'none'
            }
        });
    } catch (error) {
        console.error('Chat completion error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

// Get conversation history
router.get('/conversations/:id', authMiddleware, (req, res) => {
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);

    if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages for this conversation
    const messages = getConversationMessages(req.params.id);

    res.json({
        ...conversation,
        messages: messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            metadata: m.metadata ? JSON.parse(m.metadata) : null,
            createdAt: m.created_at
        }))
    });
});

// List user's conversations
router.get('/conversations', authMiddleware, (req, res) => {
    const { brainType } = req.query;

    let query = `
        SELECT c.*, 
               (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
               (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM conversations c 
        WHERE c.user_id = ?
    `;
    const params = [req.user.id];

    if (brainType) {
        query += ' AND c.brain_type = ?';
        params.push(brainType);
    }

    query += ' ORDER BY c.updated_at DESC';

    const conversations = db.prepare(query).all(...params);

    res.json(conversations.map(c => ({
        id: c.id,
        title: c.title,
        brainType: c.brain_type,
        pinned: c.pinned === 1,
        messageCount: c.message_count,
        lastMessage: c.last_message?.substring(0, 100),
        createdAt: c.created_at,
        updatedAt: c.updated_at
    })));
});


// Add knowledge from chat conversation
router.post('/add-to-knowledge', authMiddleware, async (req, res) => {
    try {
        const { content, title, category, conversationId } = req.body;

        if (!content || !title) {
            return res.status(400).json({ error: 'Content and title are required' });
        }

        // In production, this would add to the vector database
        // For now, log and return success
        console.log('Adding to knowledge base:', { title, category, content: content.substring(0, 100) });

        res.json({
            success: true,
            message: 'Content flagged for addition to knowledge base',
            document: {
                id: `doc-${Date.now()}`,
                title,
                category: category || 'General',
                addedFrom: 'chat',
                conversationId,
                status: 'pending_review'
            }
        });
    } catch (error) {
        console.error('Add to knowledge error:', error);
        res.status(500).json({ error: 'Failed to add to knowledge base' });
    }
});

// Helper: Query knowledge base with semantic search
async function queryKnowledgeBase(knowledgeBaseId, query) {
    // In production, this would:
    // 1. Embed the query using OpenAI/Cohere embeddings
    // 2. Query Pinecone/Weaviate for similar documents
    // 3. Return ranked results with relevance scores

    // Mock implementation with sample knowledge
    const mockKnowledgeBase = {
        documents: [
            {
                id: 'doc-1',
                title: 'Employee Handbook - PTO Policy',
                type: 'document',
                content: 'Employees receive 15 days of PTO annually, accruing at 1.25 days per month. PTO requests must be submitted 2 weeks in advance for approval. Unused PTO does not roll over.',
                relevanceScore: 0.85
            },
            {
                id: 'doc-2',
                title: 'Customer Refund Policy',
                type: 'document',
                content: 'Customer refunds should be processed within 24 hours of request approval. Refunds over $500 require manager approval. Full refunds are available within 30 days of purchase.',
                relevanceScore: 0.78
            },
            {
                id: 'doc-3',
                title: 'Onboarding Checklist',
                type: 'process',
                content: 'New client onboarding checklist: 1) Contract signing, 2) Payment setup, 3) Welcome call within 48 hours, 4) Kickoff meeting, 5) First deliverable within 2 weeks.',
                relevanceScore: 0.72
            },
            {
                id: 'doc-4',
                title: 'Weekly Report Guidelines',
                type: 'policy',
                content: 'Weekly reports should be submitted by Friday 5PM. Include: completed tasks, blockers, next week priorities. Use the standard template in the shared drive.',
                relevanceScore: 0.65
            }
        ]
    };

    // Simple keyword matching for mock (would be semantic search in production)
    const queryLower = query.toLowerCase();
    const relevantDocs = mockKnowledgeBase.documents.filter(doc => {
        const contentLower = (doc.title + ' ' + doc.content).toLowerCase();
        return queryLower.split(' ').some(word =>
            word.length > 3 && contentLower.includes(word)
        );
    });

    return {
        found: relevantDocs.length > 0,
        documents: relevantDocs.slice(0, 3), // Top 3 results
        searchQuery: query
    };
}

// Helper: Analyze response to determine confidence level
function analyzeResponseConfidence(responseContent, knowledgeResult) {
    const content = responseContent.toLowerCase();

    // Check for markers that indicate source type
    if (content.includes('according to') || content.includes('your documentation states') ||
        content.includes('based on your') || content.includes('[fact]')) {
        return CONFIDENCE.HIGH;
    }

    if (content.includes('based on') && content.includes('and') &&
        (content.includes('infer') || content.includes('conclude'))) {
        return CONFIDENCE.MEDIUM;
    }

    if (content.includes("don't have") || content.includes('not documented') ||
        content.includes('suggest') || content.includes('would you like me to') ||
        content.includes('[suggestion]')) {
        return knowledgeResult.found ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;
    }

    // Default based on whether knowledge was found
    return knowledgeResult.found ? CONFIDENCE.MEDIUM : CONFIDENCE.NONE;
}

// Helper: Generate mock response for development
function generateMockResponse(userQuery, knowledgeResult) {
    const queryLower = userQuery.toLowerCase();

    // If asking about something in the mock knowledge base
    if (queryLower.includes('pto') || queryLower.includes('time off') || queryLower.includes('vacation')) {
        return `**[FACT]** According to your Employee Handbook - PTO Policy:

Employees receive **15 days of PTO annually**, accruing at 1.25 days per month. 

Key points:
- PTO requests must be submitted **2 weeks in advance** for approval
- Unused PTO **does not roll over** to the next year

Is there anything specific about the PTO policy you'd like clarified?`;
    }

    if (queryLower.includes('refund') || queryLower.includes('return')) {
        return `**[FACT]** According to your Customer Refund Policy:

- Refunds should be processed within **24 hours** of request approval
- Refunds over **$500** require manager approval
- Full refunds available within **30 days** of purchase

Would you like me to walk you through how to process a specific refund?`;
    }

    if (queryLower.includes('onboard') || queryLower.includes('new client')) {
        return `**[FACT]** According to your Onboarding Checklist:

1. Contract signing
2. Payment setup
3. Welcome call within 48 hours
4. Kickoff meeting
5. First deliverable within 2 weeks

Is there a specific step you need help with?`;
    }

    // If no knowledge found, offer suggestions
    if (!knowledgeResult.found || knowledgeResult.documents.length === 0) {
        return `**[SUGGESTION]** I don't have specific information about "${userQuery}" in your knowledge base yet.

Would you like me to:
1. **Suggest a best-practice approach** based on industry standards (using frameworks like EOS or StoryBrand)?
2. **Flag this for your Knowledge Provider** to document?
3. **Search for related information** that might help?

Let me know how you'd like to proceed!`;
    }

    // Generic response with knowledge context
    return `Based on the documentation I reviewed, here's what I found relevant to your question:

${knowledgeResult.documents.map(d => `**${d.title}:** ${d.content.substring(0, 150)}...`).join('\n\n')}

Would you like me to elaborate on any of these points?`;
}

// ==================== CONSENSUS ENGINE INTEGRATION ====================

const {
    ConsensusEngine,
    getClientConfig,
    setClientConfig,
    createEngineForClient,
    DEFAULT_MODELS,
    FAST_MODELS
} = require('../services/consensusEngine');

/**
 * Get consensus settings for the client
 * GET /api/chat/consensus/settings
 */
router.get('/consensus/settings', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'default-client-id';
        const config = getClientConfig(clientId);

        res.json({
            success: true,
            settings: config,
            availableModels: {
                default: DEFAULT_MODELS,
                fast: FAST_MODELS
            }
        });
    } catch (error) {
        console.error('Get consensus settings error:', error);
        res.status(500).json({ error: 'Failed to get consensus settings' });
    }
});

/**
 * Update consensus settings
 * PATCH /api/chat/consensus/settings
 */
router.patch('/consensus/settings', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'default-client-id';

        const allowedUpdates = [
            'enabled', 'modelCount', 'modelTier', 'consensusThreshold',
            'timeout', 'models'
        ];

        const updates = {};
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const newConfig = setClientConfig(clientId, updates);

        res.json({
            success: true,
            settings: newConfig,
            message: 'Consensus settings updated'
        });
    } catch (error) {
        console.error('Update consensus settings error:', error);
        res.status(500).json({ error: 'Failed to update consensus settings' });
    }
});

/**
 * Chat completions with multi-model consensus (anti-hallucination)
 * POST /api/chat/consensus
 */
router.post('/consensus', authMiddleware, async (req, res) => {
    try {
        const { messages, conversationId, knowledgeBaseId } = req.body;
        const userId = req.user.id;
        const clientId = req.user.companyId || 'default-client-id';

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        // Check if consensus is enabled
        const config = getClientConfig(clientId);
        if (!config.enabled) {
            return res.status(400).json({
                error: 'Consensus mode is not enabled',
                hint: 'Enable consensus in settings first'
            });
        }

        // Get API key
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                error: 'OpenRouter API key not configured',
                hint: 'Set OPENROUTER_API_KEY environment variable'
            });
        }

        // Get or create conversation in database
        const conversation = getOrCreateConversation(conversationId, userId, clientId, 'consensus');

        // Query knowledge base for context
        const userQuery = messages[messages.length - 1]?.content || '';
        const knowledgeResult = await queryKnowledgeBase(knowledgeBaseId, userQuery);

        // Build RAG context
        const ragContext = {
            ragResults: knowledgeResult.found ? knowledgeResult.documents.map(d => ({
                source: d.title,
                content: d.content
            })) : []
        };

        // Create consensus engine and query
        const engine = createEngineForClient(clientId, apiKey);
        const consensusResult = await engine.getConsensusAnswer(
            userQuery,
            SYSTEM_PROMPT,
            ragContext
        );

        // Store messages in database
        if (conversation) {
            const userMessage = messages[messages.length - 1];
            saveMessage(conversationId, userMessage.role, userMessage.content);

            saveMessage(conversationId, 'assistant', consensusResult.answer, {
                consensusMethod: consensusResult.method,
                consensusConfidence: consensusResult.confidence,
                modelsUsed: consensusResult.details?.modelsQueried,
                outliers: consensusResult.details?.outliers,
                sources: knowledgeResult.documents?.map(d => ({
                    id: d.id,
                    title: d.title
                }))
            });
        }


        // Return response
        res.json({
            id: `chatcmpl-consensus-${Date.now()}`,
            choices: [{
                message: {
                    role: 'assistant',
                    content: consensusResult.answer
                },
                finish_reason: 'stop'
            }],
            consensus: {
                method: consensusResult.method,
                confidence: consensusResult.confidence,
                modelsQueried: consensusResult.details?.modelsQueried,
                responsesReceived: consensusResult.details?.responsesReceived,
                agreementScore: consensusResult.details?.agreementScore,
                outliers: consensusResult.details?.outliers,
                duration: consensusResult.duration
            },
            sources: knowledgeResult.documents?.map(d => ({
                id: d.id,
                title: d.title,
                relevance: d.relevance
            })),
            usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                note: 'Usage tracked per-model in consensus'
            }
        });
    } catch (error) {
        console.error('Consensus chat error:', error);
        res.status(500).json({ error: 'Failed to generate consensus response' });
    }
});

/**
 * Test consensus engine with a sample query
 * POST /api/chat/consensus/test
 */
router.post('/consensus/test', authMiddleware, async (req, res) => {
    try {
        const { query = 'What is 2 + 2?' } = req.body;
        const clientId = req.user.companyId || 'default-client-id';

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                error: 'OpenRouter API key not configured'
            });
        }

        const engine = createEngineForClient(clientId, apiKey);
        engine.debug = true;

        const result = await engine.getConsensusAnswer(
            query,
            'You are a helpful assistant. Give a brief, direct answer.'
        );

        res.json({
            success: true,
            query,
            result
        });
    } catch (error) {
        console.error('Consensus test error:', error);
        res.status(500).json({ error: 'Consensus test failed' });
    }
});

module.exports = router;

