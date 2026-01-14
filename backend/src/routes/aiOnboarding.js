/**
 * AI Onboarding Routes (PLG - Product-Led Growth)
 * Self-service AI-driven onboarding without human intervention
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { logUsage } = require('../services/apiTracking');

const router = express.Router();

// In-memory store for AI onboarding sessions
const aiSessions = new Map();

// Interview sections and questions (same structure as human-assisted onboarding)
const INTERVIEW_SECTIONS = {
    businessFundamentals: {
        title: 'Business Fundamentals',
        description: 'Tell me about your business',
        duration: '5 min',
        questions: [
            { id: 'businessOverview', text: 'In 2-3 sentences, what does your business do and who do you serve?', type: 'open' },
            { id: 'yearsInBusiness', text: 'How long have you been in business?', type: 'short' },
            { id: 'teamSize', text: 'How many people are on your team?', type: 'short' },
            { id: 'primaryOfferings', text: 'What are your main products or services?', type: 'open' },
            { id: 'typicalDealSize', text: 'What\'s your typical deal size or average transaction?', type: 'short' }
        ]
    },
    customers: {
        title: 'Your Customers',
        description: 'Help me understand who you serve',
        duration: '5 min',
        questions: [
            { id: 'idealCustomer', text: 'Describe your ideal customer in detail.', type: 'open' },
            { id: 'customerDiscovery', text: 'How do customers typically find you?', type: 'open' },
            { id: 'topFAQs', text: 'What are the 3 most common questions customers ask you?', type: 'open' },
            { id: 'commonObjections', text: 'What objections or concerns do you hear most often?', type: 'open' }
        ]
    },
    operations: {
        title: 'Operations & Processes',
        description: 'How does your business run day-to-day',
        duration: '5 min',
        questions: [
            { id: 'keyProcesses', text: 'What are the 2-3 most important processes in your business?', type: 'open' },
            { id: 'currentTools', text: 'What software or tools does your team use daily?', type: 'open' },
            { id: 'biggestFrustration', text: 'What\'s your biggest operational frustration right now?', type: 'open' },
            { id: 'decisionMaking', text: 'How do you typically make important business decisions?', type: 'open' }
        ]
    },
    salesMarketing: {
        title: 'Sales & Marketing',
        description: 'How you attract and convert customers',
        duration: '5 min',
        questions: [
            { id: 'elevatorPitch', text: 'How do you pitch your business to someone who\'s never heard of you?', type: 'open' },
            { id: 'uniqueValue', text: 'What makes you different from competitors?', type: 'open' },
            { id: 'successStory', text: 'Tell me about a recent customer success story.', type: 'open' },
            { id: 'followUpProcess', text: 'How do you follow up with leads who don\'t immediately buy?', type: 'open' }
        ]
    }
};

// Calculate progress percentage
function calculateProgress(session) {
    const allSections = Object.keys(INTERVIEW_SECTIONS);
    const currentSectionIndex = allSections.indexOf(session.currentSection);
    const sectionProgress = currentSectionIndex / allSections.length;

    const currentSectionQuestions = INTERVIEW_SECTIONS[session.currentSection]?.questions || [];
    const questionProgress = session.currentQuestionIndex / currentSectionQuestions.length;

    const sectionWeight = 1 / allSections.length;
    const totalProgress = (sectionProgress + questionProgress * sectionWeight) * 100;

    return Math.round(Math.min(totalProgress, 100));
}

// Get current question
function getCurrentQuestion(session) {
    const section = INTERVIEW_SECTIONS[session.currentSection];
    if (!section) return null;

    const question = section.questions[session.currentQuestionIndex];
    if (!question) return null;

    return {
        id: question.id,
        text: question.text,
        type: question.type,
        section: {
            id: session.currentSection,
            title: section.title
        }
    };
}

// Move to next question
function advanceToNext(session) {
    const sectionKeys = Object.keys(INTERVIEW_SECTIONS);
    const currentSection = INTERVIEW_SECTIONS[session.currentSection];

    session.currentQuestionIndex++;

    // Check if we've finished current section
    if (session.currentQuestionIndex >= currentSection.questions.length) {
        const currentSectionIndex = sectionKeys.indexOf(session.currentSection);

        // Check if we've finished all sections
        if (currentSectionIndex >= sectionKeys.length - 1) {
            session.status = 'completed';
            session.completedAt = new Date().toISOString();
        } else {
            // Move to next section
            session.currentSection = sectionKeys[currentSectionIndex + 1];
            session.currentQuestionIndex = 0;
        }
    }

    return session;
}

// Generate brains from session data
async function generateBrains(session) {
    const brains = {
        operations: {
            id: uuidv4(),
            name: `${session.companyName} Operations Brain`,
            type: 'operations',
            methodology: 'EOS',
            knowledge: {
                processes: session.answers.keyProcesses || '',
                tools: session.answers.currentTools || '',
                decisionFramework: session.answers.decisionMaking || '',
                frustrations: session.answers.biggestFrustration || ''
            },
            createdAt: new Date().toISOString()
        },
        employee: {
            id: uuidv4(),
            name: `${session.companyName} Employee Brain`,
            type: 'employee',
            knowledge: {
                faqs: session.answers.topFAQs || '',
                objectionHandling: session.answers.commonObjections || '',
                successStories: session.answers.successStory || ''
            },
            createdAt: new Date().toISOString()
        },
        branding: {
            id: uuidv4(),
            name: `${session.companyName} Branding Brain`,
            type: 'branding',
            methodology: 'Alex Hormozi + Seth Godin',
            knowledge: {
                elevator: session.answers.elevatorPitch || '',
                differentiator: session.answers.uniqueValue || '',
                idealCustomer: session.answers.idealCustomer || '',
                offerings: session.answers.primaryOfferings || ''
            },
            createdAt: new Date().toISOString()
        }
    };

    return brains;
}

/**
 * Start a new AI onboarding session
 * POST /api/ai-onboarding/start
 */
router.post('/start', async (req, res) => {
    try {
        const { email, companyName, industry } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        if (!companyName) {
            return res.status(400).json({ error: 'Company name is required' });
        }

        const session = {
            id: uuidv4(),
            email,
            companyName,
            industry: industry || null,
            currentSection: 'businessFundamentals',
            currentQuestionIndex: 0,
            answers: {},
            conversationHistory: [],
            status: 'in_progress',
            startedAt: new Date().toISOString(),
            completedAt: null,
            brainsCreated: false,
            brains: null
        };

        aiSessions.set(session.id, session);

        const firstQuestion = getCurrentQuestion(session);
        const progress = calculateProgress(session);

        // Add to conversation history
        session.conversationHistory.push({
            role: 'assistant',
            message: `Welcome to BAM.ai! I'm going to ask you some questions about ${companyName} to build your AI business brain. Let's start!`,
            timestamp: new Date().toISOString()
        });
        session.conversationHistory.push({
            role: 'assistant',
            message: firstQuestion.text,
            questionId: firstQuestion.id,
            timestamp: new Date().toISOString()
        });

        res.status(201).json({
            success: true,
            sessionId: session.id,
            welcome: `Welcome to BAM.ai! I'm going to ask you some questions about ${companyName} to build your AI business brain.`,
            question: firstQuestion,
            progress,
            estimatedTimeRemaining: '20 minutes'
        });
    } catch (error) {
        console.error('Start AI onboarding error:', error);
        res.status(500).json({ error: 'Failed to start onboarding session' });
    }
});

/**
 * Submit a response to the current question
 * POST /api/ai-onboarding/respond
 */
router.post('/respond', async (req, res) => {
    try {
        const { sessionId, response, isVoice = false } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }

        const session = aiSessions.get(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.status === 'completed') {
            return res.status(400).json({ error: 'Session already completed' });
        }

        // Get current question and store answer
        const currentQuestion = getCurrentQuestion(session);
        if (currentQuestion) {
            session.answers[currentQuestion.id] = response;

            // Add to conversation history
            session.conversationHistory.push({
                role: 'user',
                message: response,
                questionId: currentQuestion.id,
                isVoice,
                timestamp: new Date().toISOString()
            });
        }

        // Check if answer needs clarification (mock AI analysis)
        const needsClarification = response.trim().length < 10 && currentQuestion?.type === 'open';

        if (needsClarification) {
            const clarificationMessage = `Could you tell me a bit more about that? A detailed answer helps me build a better brain for ${session.companyName}.`;

            session.conversationHistory.push({
                role: 'assistant',
                message: clarificationMessage,
                isClarification: true,
                timestamp: new Date().toISOString()
            });

            return res.json({
                type: 'clarification',
                message: clarificationMessage,
                question: currentQuestion,
                progress: calculateProgress(session)
            });
        }

        // Advance to next question
        advanceToNext(session);
        aiSessions.set(sessionId, session);

        // Check if we're done
        if (session.status === 'completed') {
            // Generate brains
            const brains = await generateBrains(session);
            session.brains = brains;
            session.brainsCreated = true;
            aiSessions.set(sessionId, session);

            // Log usage (mock)  
            logUsage({
                clientId: 'plg-onboarding',
                service: 'openrouter',
                model: 'anthropic/claude-3.5-sonnet',
                tokensPrompt: 3000,
                tokensCompletion: 1500,
                endpoint: '/api/ai-onboarding/complete'
            });

            return res.json({
                type: 'complete',
                message: `Congratulations! Your BAM brains for ${session.companyName} are ready!`,
                brains: {
                    operations: { id: brains.operations.id, name: brains.operations.name },
                    employee: { id: brains.employee.id, name: brains.employee.name },
                    branding: { id: brains.branding.id, name: brains.branding.name }
                },
                summary: {
                    questionsAnswered: Object.keys(session.answers).length,
                    duration: Math.round((new Date() - new Date(session.startedAt)) / 60000) + ' minutes'
                }
            });
        }

        // Get next question
        const nextQuestion = getCurrentQuestion(session);
        const progress = calculateProgress(session);

        // Generate transition message
        const section = INTERVIEW_SECTIONS[session.currentSection];
        const isNewSection = session.currentQuestionIndex === 0;

        let transitionMessage = '';
        if (isNewSection) {
            transitionMessage = `Great! Now let's talk about ${section.title.toLowerCase()}. `;
        } else {
            const transitions = ['Got it!', 'Thanks for sharing!', 'Perfect!', 'That\'s helpful!'];
            transitionMessage = transitions[Math.floor(Math.random() * transitions.length)] + ' ';
        }

        session.conversationHistory.push({
            role: 'assistant',
            message: transitionMessage + nextQuestion.text,
            questionId: nextQuestion.id,
            isNewSection,
            timestamp: new Date().toISOString()
        });

        res.json({
            type: 'next_question',
            message: transitionMessage,
            question: nextQuestion,
            progress,
            sectionsRemaining: Object.keys(INTERVIEW_SECTIONS).length -
                Object.keys(INTERVIEW_SECTIONS).indexOf(session.currentSection) - 1
        });
    } catch (error) {
        console.error('AI onboarding respond error:', error);
        res.status(500).json({ error: 'Failed to process response' });
    }
});

/**
 * Get session status
 * GET /api/ai-onboarding/:sessionId
 */
router.get('/:sessionId', (req, res) => {
    try {
        const session = aiSessions.get(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({
            id: session.id,
            companyName: session.companyName,
            status: session.status,
            progress: calculateProgress(session),
            currentSection: session.currentSection,
            questionsAnswered: Object.keys(session.answers).length,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
            brainsCreated: session.brainsCreated
        });
    } catch (error) {
        console.error('Get AI onboarding session error:', error);
        res.status(500).json({ error: 'Failed to get session' });
    }
});

/**
 * Get conversation history
 * GET /api/ai-onboarding/:sessionId/history
 */
router.get('/:sessionId/history', (req, res) => {
    try {
        const session = aiSessions.get(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({
            sessionId: session.id,
            history: session.conversationHistory
        });
    } catch (error) {
        console.error('Get conversation history error:', error);
        res.status(500).json({ error: 'Failed to get history' });
    }
});

/**
 * Request escalation to human
 * POST /api/ai-onboarding/:sessionId/escalate
 */
router.post('/:sessionId/escalate', (req, res) => {
    try {
        const session = aiSessions.get(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        session.status = 'escalated';
        session.escalatedAt = new Date().toISOString();
        session.escalationReason = req.body.reason || 'User requested human assistance';
        aiSessions.set(session.id, session);

        res.json({
            success: true,
            message: 'Your request has been sent to our team. Someone will contact you shortly at ' + session.email,
            sessionId: session.id
        });
    } catch (error) {
        console.error('Escalate AI onboarding error:', error);
        res.status(500).json({ error: 'Failed to escalate' });
    }
});

/**
 * Resume an existing session
 * POST /api/ai-onboarding/:sessionId/resume
 */
router.post('/:sessionId/resume', (req, res) => {
    try {
        const session = aiSessions.get(req.params.sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.status === 'completed') {
            return res.json({
                message: 'Session already completed',
                brains: session.brains ? {
                    operations: { id: session.brains.operations.id, name: session.brains.operations.name },
                    employee: { id: session.brains.employee.id, name: session.brains.employee.name },
                    branding: { id: session.brains.branding.id, name: session.brains.branding.name }
                } : null
            });
        }

        const currentQuestion = getCurrentQuestion(session);
        const progress = calculateProgress(session);

        res.json({
            sessionId: session.id,
            message: `Welcome back! Let's continue where we left off with ${session.companyName}.`,
            question: currentQuestion,
            progress,
            answeredCount: Object.keys(session.answers).length
        });
    } catch (error) {
        console.error('Resume AI onboarding error:', error);
        res.status(500).json({ error: 'Failed to resume session' });
    }
});

module.exports = router;
