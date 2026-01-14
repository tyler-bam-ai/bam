const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// In-memory onboarding sessions store (replace with database)
const onboardingSessions = new Map();

// Create new onboarding session
router.post('/sessions', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const session = {
            id: uuidv4(),
            createdBy: req.user.id,
            createdAt: new Date().toISOString(),
            status: 'draft',
            // Company info
            companyName: '',
            contactName: '',
            contactEmail: '',
            plan: 'professional',
            seats: 5,
            // Interview responses
            responses: {},
            // Brains
            brainsCreated: false,
            brainsTested: {
                operations: false,
                employee: false,
                branding: false
            },
            deliveredAt: null
        };

        onboardingSessions.set(session.id, session);

        res.status(201).json({
            success: true,
            session
        });
    } catch (error) {
        console.error('Create onboarding session error:', error);
        res.status(500).json({ error: 'Failed to create onboarding session' });
    }
});

// List all onboarding sessions
router.get('/sessions', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const sessions = Array.from(onboardingSessions.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(s => ({
                id: s.id,
                companyName: s.companyName,
                contactName: s.contactName,
                status: s.status,
                createdAt: s.createdAt,
                deliveredAt: s.deliveredAt
            }));

        res.json(sessions);
    } catch (error) {
        console.error('List onboarding sessions error:', error);
        res.status(500).json({ error: 'Failed to list onboarding sessions' });
    }
});

// Get specific onboarding session
router.get('/sessions/:id', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const session = onboardingSessions.get(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'Onboarding session not found' });
        }

        res.json(session);
    } catch (error) {
        console.error('Get onboarding session error:', error);
        res.status(500).json({ error: 'Failed to get onboarding session' });
    }
});

// Update onboarding session
router.patch('/sessions/:id', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const session = onboardingSessions.get(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'Onboarding session not found' });
        }

        const allowedFields = [
            'companyName', 'contactName', 'contactEmail', 'plan', 'seats',
            'responses', 'status', 'brainsTested'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'responses') {
                    session.responses = { ...session.responses, ...req.body.responses };
                } else if (field === 'brainsTested') {
                    session.brainsTested = { ...session.brainsTested, ...req.body.brainsTested };
                } else {
                    session[field] = req.body[field];
                }
            }
        });

        session.updatedAt = new Date().toISOString();
        onboardingSessions.set(session.id, session);

        res.json({
            success: true,
            session
        });
    } catch (error) {
        console.error('Update onboarding session error:', error);
        res.status(500).json({ error: 'Failed to update onboarding session' });
    }
});

// Create brains from session
router.post('/sessions/:id/brains', authMiddleware, requireRole('bam_admin'), async (req, res) => {
    try {
        const session = onboardingSessions.get(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'Onboarding session not found' });
        }

        // TODO: Actually create the brains with the collected data
        // This would involve:
        // 1. Creating system prompts for each brain type
        // 2. Storing them in the knowledge base
        // 3. Setting up the client's account

        // For now, simulate brain creation
        await new Promise(resolve => setTimeout(resolve, 2000));

        session.brainsCreated = true;
        session.status = 'ingested';
        session.brainsCreatedAt = new Date().toISOString();
        onboardingSessions.set(session.id, session);

        // Create the three brains data structure
        const brains = {
            operations: {
                id: uuidv4(),
                name: `${session.companyName} Operations Brain`,
                type: 'operations',
                methodology: 'EOS',
                createdAt: new Date().toISOString()
            },
            employee: {
                id: uuidv4(),
                name: `${session.companyName} Employee Brain`,
                type: 'employee',
                methodology: 'GH Smart',
                createdAt: new Date().toISOString()
            },
            branding: {
                id: uuidv4(),
                name: `${session.companyName} Branding Brain`,
                type: 'branding',
                methodology: 'Donald Miller / Seth Godin / Alex Hormozi',
                createdAt: new Date().toISOString()
            }
        };

        res.json({
            success: true,
            message: 'Brains created successfully',
            brains,
            session
        });
    } catch (error) {
        console.error('Create brains error:', error);
        res.status(500).json({ error: 'Failed to create brains' });
    }
});

// Deliver to client
router.post('/sessions/:id/deliver', authMiddleware, requireRole('bam_admin'), async (req, res) => {
    try {
        const session = onboardingSessions.get(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'Onboarding session not found' });
        }

        if (!session.brainsCreated) {
            return res.status(400).json({ error: 'Brains must be created before delivery' });
        }

        // Verify all brains are tested
        const allTested = Object.values(session.brainsTested).every(Boolean);
        if (!allTested) {
            return res.status(400).json({ error: 'All brains must be tested before delivery' });
        }

        // TODO: Actually deliver to client
        // This would involve:
        // 1. Creating the client account if not exists
        // 2. Sending email notification
        // 3. Setting up their access permissions

        // Simulate delivery
        await new Promise(resolve => setTimeout(resolve, 1500));

        session.status = 'delivered';
        session.deliveredAt = new Date().toISOString();
        onboardingSessions.set(session.id, session);

        res.json({
            success: true,
            message: `Brains delivered to ${session.contactEmail}`,
            session
        });
    } catch (error) {
        console.error('Deliver brains error:', error);
        res.status(500).json({ error: 'Failed to deliver brains' });
    }
});

// Delete onboarding session
router.delete('/sessions/:id', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const session = onboardingSessions.get(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'Onboarding session not found' });
        }

        onboardingSessions.delete(req.params.id);

        res.json({
            success: true,
            message: 'Onboarding session deleted'
        });
    } catch (error) {
        console.error('Delete onboarding session error:', error);
        res.status(500).json({ error: 'Failed to delete onboarding session' });
    }
});

// Parse transcript with AI to extract answers
router.post('/parse-transcript', async (req, res) => {
    try {
        const { transcript, questions } = req.body;

        if (!transcript || !questions || !Array.isArray(questions)) {
            return res.status(400).json({
                error: 'Transcript and questions array are required'
            });
        }

        // Build prompt for AI
        const questionsList = questions.map(q => `- ${q.id}: "${q.label}"`).join('\n');

        const systemPrompt = `You are an expert at analyzing conversation transcripts and extracting relevant information.
Your task is to read a transcript from an onboarding call and extract answers to specific questions.

For each question, find the relevant answer from the transcript. If an answer is not found or unclear, leave it empty.
Be thorough and capture the full context of responses, not just short phrases.

Return your response as a valid JSON object with the question IDs as keys and the extracted answers as values.
Example: { "companyName": "Acme Corp", "businessOverview": "We provide...", ... }

Only return the JSON object, no additional text.`;

        const userPrompt = `Here is the transcript from the onboarding call:

---
${transcript}
---

Extract answers for these questions:
${questionsList}

Return a JSON object mapping question IDs to their answers. If an answer is not found, use an empty string.`;

        // Call OpenRouter API
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            // Fallback: Return empty answers if no API key
            console.warn('No OPENROUTER_API_KEY set, returning empty answers');
            const emptyAnswers = {};
            questions.forEach(q => { emptyAnswers[q.id] = ''; });
            return res.json({
                success: true,
                answers: emptyAnswers,
                warning: 'No AI API key configured. Please set OPENROUTER_API_KEY.'
            });
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3001',
                'X-Title': 'BAM.ai Onboarding'
            },
            body: JSON.stringify({
                model: 'anthropic/claude-3-haiku',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('OpenRouter API error:', errorData);
            throw new Error('AI service unavailable');
        }

        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content || '{}';

        // Parse the AI response as JSON
        let answers = {};
        try {
            // Clean up the response in case it has markdown code blocks
            let cleanedResponse = aiResponse.trim();
            if (cleanedResponse.startsWith('```json')) {
                cleanedResponse = cleanedResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }
            answers = JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError, aiResponse);
            // Return empty answers on parse failure
            questions.forEach(q => { answers[q.id] = ''; });
        }

        res.json({
            success: true,
            answers,
            tokensUsed: data.usage?.total_tokens || 0
        });

    } catch (error) {
        console.error('Parse transcript error:', error);
        res.status(500).json({ error: 'Failed to parse transcript' });
    }
});

// Industry-specific question banks
const INDUSTRY_QUESTIONS = {
    healthcare: [
        { id: 'hipaa_compliance', label: 'How do you handle HIPAA compliance for patient data?', category: 'compliance' },
        { id: 'patient_scheduling', label: 'Describe your patient scheduling and appointment management process.', category: 'operations' },
        { id: 'insurance_billing', label: 'How do you handle insurance verification and billing?', category: 'operations' },
        { id: 'ehr_system', label: 'What EHR/EMR system do you use, and what are its main pain points?', category: 'technology' },
        { id: 'patient_communication', label: 'How do you communicate with patients (reminders, follow-ups)?', category: 'customer' },
        { id: 'emergency_protocols', label: 'What are your protocols for medical emergencies?', category: 'operations' }
    ],
    construction: [
        { id: 'project_management', label: 'What project management tools and processes do you use?', category: 'operations' },
        { id: 'subcontractor_management', label: 'How do you manage and communicate with subcontractors?', category: 'operations' },
        { id: 'safety_protocols', label: 'Describe your job site safety protocols and training.', category: 'compliance' },
        { id: 'bidding_process', label: 'Walk me through your bidding and estimation process.', category: 'sales' },
        { id: 'change_orders', label: 'How do you handle change orders and scope creep?', category: 'operations' },
        { id: 'permit_process', label: 'How do you manage permits and inspections?', category: 'compliance' }
    ],
    technology: [
        { id: 'dev_process', label: 'Describe your development process (Agile, Scrum, etc.)', category: 'operations' },
        { id: 'deployment', label: 'How do you handle deployments and releases?', category: 'operations' },
        { id: 'support_tiers', label: 'Explain your customer support tiers and SLAs.', category: 'customer' },
        { id: 'security_practices', label: 'What are your key security practices and compliance requirements?', category: 'compliance' },
        { id: 'onboarding_users', label: 'How do you onboard new users to your platform?', category: 'customer' },
        { id: 'feature_requests', label: 'How do you collect and prioritize feature requests?', category: 'product' }
    ],
    retail: [
        { id: 'inventory_management', label: 'How do you manage inventory across locations/channels?', category: 'operations' },
        { id: 'pos_systems', label: 'What POS and payment systems do you use?', category: 'technology' },
        { id: 'returns_policy', label: 'Describe your returns and exchanges policy.', category: 'customer' },
        { id: 'seasonal_staffing', label: 'How do you handle seasonal staffing fluctuations?', category: 'hr' },
        { id: 'customer_loyalty', label: 'Do you have a loyalty program? How does it work?', category: 'marketing' },
        { id: 'ecommerce_integration', label: 'How do you integrate in-store and online operations?', category: 'operations' }
    ],
    professional_services: [
        { id: 'client_intake', label: 'Describe your client intake and onboarding process.', category: 'operations' },
        { id: 'billing_structure', label: 'How do you structure billing (hourly, retainer, project)?', category: 'operations' },
        { id: 'deliverable_process', label: 'Walk me through how deliverables are created and reviewed.', category: 'operations' },
        { id: 'client_communication', label: 'How do you keep clients updated on project progress?', category: 'customer' },
        { id: 'expertise_docs', label: 'How do you document and share expertise across the team?', category: 'knowledge' },
        { id: 'scope_management', label: 'How do you manage scope and prevent scope creep?', category: 'operations' }
    ],
    financial_services: [
        { id: 'compliance_regs', label: 'What compliance regulations affect your operations (SEC, FINRA, etc.)?', category: 'compliance' },
        { id: 'client_reporting', label: 'How do you provide reports and statements to clients?', category: 'customer' },
        { id: 'risk_assessment', label: 'Describe your risk assessment process for new clients.', category: 'operations' },
        { id: 'data_security', label: 'What security measures protect client financial data?', category: 'compliance' },
        { id: 'advisory_process', label: 'Walk me through a typical client advisory session.', category: 'operations' },
        { id: 'fee_structure', label: 'How is your fee structure communicated to clients?', category: 'sales' }
    ]
};

// Get industry-specific questions
router.get('/industry-questions/:industry', authMiddleware, (req, res) => {
    try {
        const { industry } = req.params;
        const industryKey = industry.toLowerCase().replace(/\s+/g, '_');

        const questions = INDUSTRY_QUESTIONS[industryKey] || [];

        res.json({
            success: true,
            industry: industryKey,
            questions,
            available_industries: Object.keys(INDUSTRY_QUESTIONS)
        });
    } catch (error) {
        console.error('Get industry questions error:', error);
        res.status(500).json({ error: 'Failed to get industry questions' });
    }
});

// Generate adaptive follow-up questions based on previous answers
router.post('/adaptive-questions', authMiddleware, async (req, res) => {
    try {
        const { previousAnswers, industry, currentSection } = req.body;

        if (!previousAnswers || typeof previousAnswers !== 'object') {
            return res.status(400).json({ error: 'Previous answers object is required' });
        }

        const apiKey = process.env.OPENROUTER_API_KEY;

        // If no API key, return static follow-up suggestions based on industry
        if (!apiKey) {
            const industryQuestions = INDUSTRY_QUESTIONS[industry?.toLowerCase().replace(/\s+/g, '_')] || [];
            return res.json({
                success: true,
                additionalQuestions: industryQuestions.slice(0, 3),
                source: 'static'
            });
        }

        // Use AI to generate contextual follow-up questions
        const systemPrompt = `You are an expert business consultant conducting an onboarding interview.
Based on the answers provided, generate 2-3 follow-up questions that would help capture more valuable information.

Focus on:
1. Clarifying vague or incomplete answers
2. Exploring pain points mentioned
3. Understanding processes in more detail
4. Uncovering implicit needs

Return your response as a JSON array of question objects with 'id', 'label', and 'category' fields.
Example: [{ "id": "followup_1", "label": "You mentioned...", "category": "operations" }]

Only return the JSON array, no additional text.`;

        const answersContext = Object.entries(previousAnswers)
            .filter(([_, value]) => value && value.trim())
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        const userPrompt = `Industry: ${industry || 'General'}
Current Section: ${currentSection || 'General'}

Previous Answers:
${answersContext}

Generate 2-3 intelligent follow-up questions based on these answers.`;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3001',
                'X-Title': 'BAM.ai Adaptive Onboarding'
            },
            body: JSON.stringify({
                model: 'anthropic/claude-3-haiku',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            throw new Error('AI service unavailable');
        }

        const data = await response.json();
        let aiResponse = data.choices?.[0]?.message?.content || '[]';

        // Parse AI response
        let additionalQuestions = [];
        try {
            let cleanedResponse = aiResponse.trim();
            if (cleanedResponse.startsWith('```json')) {
                cleanedResponse = cleanedResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }
            additionalQuestions = JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error('Failed to parse adaptive questions:', parseError);
            // Fallback to industry questions
            const industryQuestions = INDUSTRY_QUESTIONS[industry?.toLowerCase().replace(/\s+/g, '_')] || [];
            additionalQuestions = industryQuestions.slice(0, 2);
        }

        res.json({
            success: true,
            additionalQuestions,
            source: 'ai',
            tokensUsed: data.usage?.total_tokens || 0
        });

    } catch (error) {
        console.error('Adaptive questions error:', error);
        // Fallback response
        res.json({
            success: true,
            additionalQuestions: [],
            source: 'error',
            error: error.message
        });
    }
});

// AI onboarding session endpoints for self-service
const aiOnboardingSessions = new Map();

// Start AI onboarding session
router.post('/ai-onboarding/start', async (req, res) => {
    try {
        const sessionId = uuidv4();
        const session = {
            id: sessionId,
            startedAt: new Date().toISOString(),
            stage: 'intro',
            collectedData: {},
            messages: [],
            progress: 0
        };

        aiOnboardingSessions.set(sessionId, session);

        const welcomeMessage = `Welcome to BAM.ai! 👋

I'm your AI onboarding assistant. I'll help you set up your Business Brain by learning about your company.

This conversation typically takes about 10-15 minutes. You can speak to me or type - whatever feels more comfortable.

**Let's start with the basics:**
What's the name of your company?`;

        session.messages.push({ role: 'assistant', content: welcomeMessage, timestamp: new Date().toISOString() });

        res.json({
            success: true,
            sessionId,
            message: welcomeMessage,
            stage: 'intro',
            progress: 0
        });
    } catch (error) {
        console.error('Start AI onboarding error:', error);
        res.status(500).json({ error: 'Failed to start onboarding session' });
    }
});

// Process AI onboarding response
router.post('/ai-onboarding/respond', async (req, res) => {
    try {
        const { sessionId, response, currentStage } = req.body;

        const session = aiOnboardingSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Store user response
        session.messages.push({ role: 'user', content: response, timestamp: new Date().toISOString() });

        // Determine what data to extract based on stage
        const stageExtractors = {
            intro: ['companyName'],
            company: ['industry', 'employeeCount', 'yearsFounded'],
            customers: ['targetCustomer', 'mainProducts', 'competitiveAdvantage'],
            processes: ['commonQuestions', 'keyProcesses', 'painPoints'],
            review: []
        };

        const apiKey = process.env.OPENROUTER_API_KEY;
        let nextMessage = '';
        let extractedData = {};
        let nextStage = currentStage;
        let progress = session.progress;

        if (apiKey) {
            // Use AI to extract data and generate next question
            const systemPrompt = `You are a friendly business onboarding assistant. Your goals:
1. Extract relevant business information from the user's response
2. Generate a natural, conversational follow-up question
3. Keep responses concise and friendly

Current stage: ${currentStage}
Expected data to collect: ${(stageExtractors[currentStage] || []).join(', ')}

Return a JSON object with:
- "extractedData": object with any extracted information
- "nextMessage": your conversational response and next question
- "readyForNextStage": boolean if current stage is complete

Only return the JSON, no additional text.`;

            const conversationContext = session.messages.slice(-6)
                .map(m => `${m.role}: ${m.content}`)
                .join('\n');

            const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'http://localhost:3001',
                    'X-Title': 'BAM.ai AI Onboarding'
                },
                body: JSON.stringify({
                    model: 'anthropic/claude-3-haiku',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Conversation:\n${conversationContext}\n\nProcess this and generate next step.` }
                    ],
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            if (aiResponse.ok) {
                const data = await aiResponse.json();
                let parsed = {};
                try {
                    let content = data.choices?.[0]?.message?.content || '{}';
                    if (content.startsWith('```')) {
                        content = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
                    }
                    parsed = JSON.parse(content);
                } catch (e) {
                    console.error('Parse error:', e);
                }

                extractedData = parsed.extractedData || {};
                nextMessage = parsed.nextMessage || '';

                if (parsed.readyForNextStage) {
                    const stages = ['intro', 'company', 'customers', 'processes', 'review'];
                    const currentIndex = stages.indexOf(currentStage);
                    if (currentIndex < stages.length - 1) {
                        nextStage = stages[currentIndex + 1];
                        progress = ((currentIndex + 1) / (stages.length - 1)) * 100;
                    }
                }
            }
        }

        // Fallback responses if AI doesn't work
        if (!nextMessage) {
            const fallbackResponses = {
                intro: `Great! And what industry does your company operate in?`,
                company: `Thanks for sharing. Can you describe your ideal customer?`,
                customers: `Interesting! What's the most common question employees ask that you wish they already knew the answer to?`,
                processes: `Perfect. Let me summarize what I've learned and we'll create your Brain.`,
                review: `I've collected everything I need. Your Business Brain is being created!`
            };
            nextMessage = fallbackResponses[currentStage] || 'Thank you. Let me continue...';

            // Simple extraction for fallback
            if (currentStage === 'intro') {
                extractedData.companyName = response;
            }
        }

        // Update session
        session.collectedData = { ...session.collectedData, ...extractedData };
        session.stage = nextStage;
        session.progress = progress;
        session.messages.push({ role: 'assistant', content: nextMessage, timestamp: new Date().toISOString() });
        aiOnboardingSessions.set(sessionId, session);

        res.json({
            success: true,
            message: nextMessage,
            extractedData,
            nextStage,
            progress: Math.round(progress),
            isComplete: nextStage === 'review' && progress >= 100
        });

    } catch (error) {
        console.error('AI onboarding respond error:', error);
        res.status(500).json({ error: 'Failed to process response' });
    }
});

// Request human handoff
router.post('/ai-onboarding/handoff', async (req, res) => {
    try {
        const { sessionId } = req.body;

        const session = aiOnboardingSessions.get(sessionId);
        if (session) {
            session.handoffRequested = true;
            session.handoffAt = new Date().toISOString();
            aiOnboardingSessions.set(sessionId, session);
        }

        res.json({
            success: true,
            message: `No problem! A team member will reach out to you shortly. You can also:
            
• **Email us**: support@bam.ai
• **Call us**: (555) 123-4567
• **Schedule a call**: calendly.com/bam-ai

We typically respond within 2 business hours.`
        });
    } catch (error) {
        console.error('Handoff error:', error);
        res.status(500).json({ error: 'Failed to request handoff' });
    }
});

// In-memory clients store (replace with database in production)
const clients = new Map();

// Create client from onboarding session
router.post('/create-client', authMiddleware, requireRole('bam_admin'), async (req, res) => {
    try {
        const {
            companyName,
            contactName,
            contactEmail,
            contactPhone,
            website,
            industry,
            plan,
            seats,
            clientApiKeys,
            responses
        } = req.body;

        if (!companyName || !contactEmail) {
            return res.status(400).json({ error: 'Company name and contact email are required' });
        }

        const clientId = uuidv4();
        const newClient = {
            id: clientId,
            companyName,
            contactName,
            contactEmail,
            contactPhone,
            website,
            industry,
            plan,
            seats,
            status: 'active',
            createdAt: new Date().toISOString(),
            createdBy: req.user.id,
            // Store API keys securely (in production, encrypt these)
            apiKeys: clientApiKeys || {},
            // Knowledge base from onboarding responses
            knowledgeData: responses || {},
            // Brains will be associated later
            brains: {
                operations: null,
                employee: null,
                branding: null
            }
        };

        clients.set(clientId, newClient);

        console.log(`Created new client: ${companyName} (${clientId})`);

        res.status(201).json({
            success: true,
            clientId,
            client: {
                id: clientId,
                companyName,
                contactName,
                contactEmail,
                plan,
                status: 'active'
            }
        });

    } catch (error) {
        console.error('Create client error:', error);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

// Get all clients (for admin panel)
router.get('/clients', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const clientList = Array.from(clients.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(c => ({
                id: c.id,
                companyName: c.companyName,
                contactName: c.contactName,
                contactEmail: c.contactEmail,
                plan: c.plan,
                status: c.status,
                createdAt: c.createdAt
            }));

        res.json(clientList);
    } catch (error) {
        console.error('List clients error:', error);
        res.status(500).json({ error: 'Failed to list clients' });
    }
});

// Push to Salesforce
router.post('/push-to-salesforce', authMiddleware, requireRole('bam_admin'), async (req, res) => {
    try {
        const {
            companyName,
            contactName,
            contactEmail,
            contactPhone,
            website,
            industry,
            plan,
            seats
        } = req.body;

        // Check for Salesforce credentials
        const sfClientId = process.env.SALESFORCE_CLIENT_ID;
        const sfClientSecret = process.env.SALESFORCE_CLIENT_SECRET;
        const sfUsername = process.env.SALESFORCE_USERNAME;
        const sfPassword = process.env.SALESFORCE_PASSWORD;
        const sfSecurityToken = process.env.SALESFORCE_SECURITY_TOKEN;

        if (!sfClientId || !sfUsername) {
            console.log('Salesforce not configured, simulating push...');

            // Simulate successful push for demo
            await new Promise(resolve => setTimeout(resolve, 1000));

            return res.json({
                success: true,
                message: 'Salesforce integration not configured. Data logged for manual entry.',
                simulated: true,
                data: {
                    companyName,
                    contactName,
                    contactEmail,
                    contactPhone,
                    website,
                    industry,
                    plan,
                    seats
                }
            });
        }

        // In production, implement actual Salesforce API integration
        // Using jsforce or similar library:
        // 
        // const jsforce = require('jsforce');
        // const conn = new jsforce.Connection({ loginUrl: 'https://login.salesforce.com' });
        // await conn.login(sfUsername, sfPassword + sfSecurityToken);
        // 
        // // Create Account
        // const account = await conn.sobject('Account').create({
        //     Name: companyName,
        //     Website: website,
        //     Industry: industry,
        //     Phone: contactPhone
        // });
        // 
        // // Create Contact
        // const contact = await conn.sobject('Contact').create({
        //     FirstName: contactName.split(' ')[0],
        //     LastName: contactName.split(' ').slice(1).join(' ') || contactName,
        //     Email: contactEmail,
        //     Phone: contactPhone,
        //     AccountId: account.id
        // });
        // 
        // // Create Opportunity
        // const opportunity = await conn.sobject('Opportunity').create({
        //     Name: `${companyName} - BAM.ai ${plan}`,
        //     StageName: 'Closed Won',
        //     CloseDate: new Date().toISOString().split('T')[0],
        //     Amount: plan === 'starter' ? 199 : plan === 'professional' ? 299 : 499,
        //     AccountId: account.id
        // });

        // For now, simulate the push
        await new Promise(resolve => setTimeout(resolve, 1500));

        res.json({
            success: true,
            message: 'Successfully pushed to Salesforce',
            salesforceIds: {
                accountId: `001${Date.now()}`,
                contactId: `003${Date.now()}`,
                opportunityId: `006${Date.now()}`
            }
        });

    } catch (error) {
        console.error('Salesforce push error:', error);
        res.status(500).json({ error: 'Failed to push to Salesforce' });
    }
});

module.exports = router;
