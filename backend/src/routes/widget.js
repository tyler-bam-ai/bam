/**
 * Widget Routes
 * Public-facing customer chat widget endpoints
 * These endpoints are designed to be embedded on client websites
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// In-memory stores
const widgetSessions = new Map();
const widgetConfigs = new Map();

// Initialize some demo widget configs
widgetConfigs.set('demo-widget', {
    id: 'demo-widget',
    clientId: 'demo-client',
    name: 'Demo Chat Widget',
    greeting: 'Hi! How can I help you today?',
    primaryColor: '#8b5cf6',
    position: 'bottom-right',
    allowFileUpload: false,
    showAgentName: true,
    agentName: 'BAM Assistant',
    offlineMessage: 'We\'ll get back to you soon!',
    placeholderText: 'Type your message...'
});

/**
 * Get widget configuration (public, no auth required)
 * GET /api/widget/:widgetId/config
 */
router.get('/:widgetId/config', (req, res) => {
    try {
        const config = widgetConfigs.get(req.params.widgetId);

        if (!config) {
            return res.status(404).json({ error: 'Widget not found' });
        }

        // Return only public-facing config
        res.json({
            success: true,
            config: {
                greeting: config.greeting,
                primaryColor: config.primaryColor,
                position: config.position,
                showAgentName: config.showAgentName,
                agentName: config.agentName,
                offlineMessage: config.offlineMessage,
                placeholderText: config.placeholderText,
                allowFileUpload: config.allowFileUpload
            }
        });
    } catch (error) {
        console.error('Get widget config error:', error);
        res.status(500).json({ error: 'Failed to get widget config' });
    }
});

/**
 * Start a new chat session (public, no auth required)
 * POST /api/widget/:widgetId/session
 */
router.post('/:widgetId/session', (req, res) => {
    try {
        const config = widgetConfigs.get(req.params.widgetId);

        if (!config) {
            return res.status(404).json({ error: 'Widget not found' });
        }

        const { visitorName, visitorEmail, metadata = {} } = req.body;

        const session = {
            id: uuidv4(),
            widgetId: req.params.widgetId,
            clientId: config.clientId,
            visitorName: visitorName || 'Visitor',
            visitorEmail: visitorEmail || null,
            metadata,
            messages: [],
            status: 'active',
            createdAt: new Date().toISOString(),
            lastMessageAt: new Date().toISOString()
        };

        // Add greeting message
        session.messages.push({
            id: uuidv4(),
            role: 'assistant',
            content: config.greeting,
            timestamp: new Date().toISOString()
        });

        widgetSessions.set(session.id, session);

        res.json({
            success: true,
            sessionId: session.id,
            greeting: config.greeting,
            agentName: config.agentName
        });
    } catch (error) {
        console.error('Start session error:', error);
        res.status(500).json({ error: 'Failed to start chat session' });
    }
});

/**
 * Send a message in a chat session (public, no auth required)
 * POST /api/widget/:widgetId/session/:sessionId/message
 */
router.post('/:widgetId/session/:sessionId/message', async (req, res) => {
    try {
        const session = widgetSessions.get(req.params.sessionId);

        if (!session || session.widgetId !== req.params.widgetId) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Add user message
        const userMessage = {
            id: uuidv4(),
            role: 'user',
            content: message.trim(),
            timestamp: new Date().toISOString()
        };
        session.messages.push(userMessage);
        session.lastMessageAt = userMessage.timestamp;

        // Generate AI response
        // In production, this would call the actual AI with the client's knowledge base
        const aiResponse = await generateWidgetResponse(session, message.trim());

        const assistantMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: aiResponse.content,
            suggestedActions: aiResponse.suggestedActions,
            timestamp: new Date().toISOString()
        };
        session.messages.push(assistantMessage);
        session.lastMessageAt = assistantMessage.timestamp;

        widgetSessions.set(session.id, session);

        // Track for analytics
        // In production: analyticsService.track('question_answered', { clientId: session.clientId, question: message });

        res.json({
            success: true,
            message: assistantMessage,
            sessionId: session.id
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/**
 * Get chat history for a session
 * GET /api/widget/:widgetId/session/:sessionId/messages
 */
router.get('/:widgetId/session/:sessionId/messages', (req, res) => {
    try {
        const session = widgetSessions.get(req.params.sessionId);

        if (!session || session.widgetId !== req.params.widgetId) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({
            success: true,
            messages: session.messages,
            status: session.status
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

/**
 * Request human handover
 * POST /api/widget/:widgetId/session/:sessionId/handover
 */
router.post('/:widgetId/session/:sessionId/handover', (req, res) => {
    try {
        const session = widgetSessions.get(req.params.sessionId);

        if (!session || session.widgetId !== req.params.widgetId) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const { reason } = req.body;

        session.status = 'handover_requested';
        session.handoverRequestedAt = new Date().toISOString();
        session.handoverReason = reason || 'Customer requested human support';

        // Add system message
        session.messages.push({
            id: uuidv4(),
            role: 'system',
            content: 'You\'ve been connected to our support team. Someone will be with you shortly!',
            timestamp: new Date().toISOString()
        });

        widgetSessions.set(session.id, session);

        res.json({
            success: true,
            message: 'Handover requested. A human agent will join shortly.',
            status: session.status
        });
    } catch (error) {
        console.error('Handover error:', error);
        res.status(500).json({ error: 'Failed to request handover' });
    }
});

/**
 * End chat session
 * POST /api/widget/:widgetId/session/:sessionId/end
 */
router.post('/:widgetId/session/:sessionId/end', (req, res) => {
    try {
        const session = widgetSessions.get(req.params.sessionId);

        if (!session || session.widgetId !== req.params.widgetId) {
            return res.status(404).json({ error: 'Session not found' });
        }

        session.status = 'ended';
        session.endedAt = new Date().toISOString();

        // Add closing message
        session.messages.push({
            id: uuidv4(),
            role: 'system',
            content: 'Thank you for chatting with us! If you need anything else, just start a new conversation.',
            timestamp: new Date().toISOString()
        });

        widgetSessions.set(session.id, session);

        res.json({
            success: true,
            message: 'Chat session ended',
            status: session.status
        });
    } catch (error) {
        console.error('End session error:', error);
        res.status(500).json({ error: 'Failed to end session' });
    }
});

/**
 * Submit feedback for a session
 * POST /api/widget/:widgetId/session/:sessionId/feedback
 */
router.post('/:widgetId/session/:sessionId/feedback', (req, res) => {
    try {
        const session = widgetSessions.get(req.params.sessionId);

        if (!session || session.widgetId !== req.params.widgetId) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const { rating, comment } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        session.feedback = {
            rating,
            comment: comment || null,
            submittedAt: new Date().toISOString()
        };

        widgetSessions.set(session.id, session);

        res.json({
            success: true,
            message: 'Thank you for your feedback!'
        });
    } catch (error) {
        console.error('Submit feedback error:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// Helper: Generate AI response for widget
async function generateWidgetResponse(session, userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    // Simple intent detection for demo
    // In production, this would use the actual LLM with RAG from the client's knowledge base

    let content;
    let suggestedActions = [];

    if (lowerMessage.includes('hours') || lowerMessage.includes('open')) {
        content = "Our business hours are Monday through Friday, 9 AM to 6 PM, and Saturday 10 AM to 4 PM. We're closed on Sundays and major holidays.";
        suggestedActions = ['Book an appointment', 'View services'];
    } else if (lowerMessage.includes('appointment') || lowerMessage.includes('book')) {
        content = "I'd be happy to help you book an appointment! You can schedule directly through our online booking system, or I can have someone from our team call you. Which would you prefer?";
        suggestedActions = ['Book online', 'Request callback'];
    } else if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
        content = "Our pricing varies depending on the service. For a personalized quote, I'd recommend speaking with our team. Would you like me to have someone reach out, or would you prefer to view our service menu?";
        suggestedActions = ['View pricing', 'Get a quote', 'Talk to human'];
    } else if (lowerMessage.includes('location') || lowerMessage.includes('where') || lowerMessage.includes('address')) {
        content = "We're located at 123 Main Street, Suite 100. There's parking available in the rear lot. Would you like directions or would you like to schedule a visit?";
        suggestedActions = ['Get directions', 'Book appointment'];
    } else if (lowerMessage.includes('help') || lowerMessage.includes('human') || lowerMessage.includes('person') || lowerMessage.includes('agent')) {
        content = "I understand you'd like to speak with a human. Let me connect you with one of our team members. In the meantime, is there anything specific I can help you with?";
        suggestedActions = ['Connect to agent', 'Continue with AI'];
    } else if (lowerMessage.includes('cancel') || lowerMessage.includes('refund')) {
        content = "For cancellations or refund requests, please provide your booking reference and I'll assist you. Alternatively, you can reach our support team directly.";
        suggestedActions = ['Talk to support', 'View cancellation policy'];
    } else if (lowerMessage.includes('thank')) {
        content = "You're welcome! Is there anything else I can help you with today?";
        suggestedActions = ['End chat', 'Ask another question'];
    } else {
        content = "Thank you for your question! I'm here to help with information about our services, booking appointments, hours, and more. Could you provide a bit more detail about what you're looking for?";
        suggestedActions = ['View services', 'Book appointment', 'Talk to human'];
    }

    return { content, suggestedActions };
}

// ==================== WIDGET MANAGEMENT (AUTHENTICATED) ====================

const { authMiddleware } = require('../middleware/auth');

/**
 * List all widgets for the client
 * GET /api/widget/manage/list
 */
router.get('/manage/list', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'default-client-id';

        const clientWidgets = Array.from(widgetConfigs.values())
            .filter(w => w.clientId === clientId)
            .map(w => ({
                id: w.id,
                name: w.name,
                greeting: w.greeting,
                primaryColor: w.primaryColor,
                createdAt: w.createdAt || new Date().toISOString()
            }));

        res.json({
            success: true,
            widgets: clientWidgets
        });
    } catch (error) {
        console.error('List widgets error:', error);
        res.status(500).json({ error: 'Failed to list widgets' });
    }
});

/**
 * Get a widget's full configuration
 * GET /api/widget/manage/:widgetId
 */
router.get('/manage/:widgetId', authMiddleware, (req, res) => {
    try {
        const config = widgetConfigs.get(req.params.widgetId);

        if (!config) {
            return res.status(404).json({ error: 'Widget not found' });
        }

        // Verify ownership
        const clientId = req.user.companyId || 'default-client-id';
        if (config.clientId !== clientId && req.user.role !== 'bam_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
            success: true,
            widget: config,
            embedCode: `<script src="${process.env.API_URL || 'http://localhost:3001'}/widget.js" data-widget-id="${config.id}"></script>`
        });
    } catch (error) {
        console.error('Get widget error:', error);
        res.status(500).json({ error: 'Failed to get widget' });
    }
});

/**
 * Create a new widget
 * POST /api/widget/manage
 */
router.post('/manage', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'default-client-id';
        const {
            name,
            greeting = 'Hi! How can I help you today?',
            primaryColor = '#8b5cf6',
            position = 'bottom-right',
            agentName = 'BAM Assistant',
            placeholderText = 'Type your message...',
            offlineMessage = "We'll get back to you soon!",
            allowFileUpload = false,
            showAgentName = true
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Widget name is required' });
        }

        const widgetId = `widget-${uuidv4().substring(0, 8)}`;

        const widget = {
            id: widgetId,
            clientId,
            name,
            greeting,
            primaryColor,
            position,
            agentName,
            placeholderText,
            offlineMessage,
            allowFileUpload,
            showAgentName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: req.user.id
        };

        widgetConfigs.set(widgetId, widget);

        res.status(201).json({
            success: true,
            widget,
            embedCode: `<script src="${process.env.API_URL || 'http://localhost:3001'}/widget.js" data-widget-id="${widgetId}"></script>`
        });
    } catch (error) {
        console.error('Create widget error:', error);
        res.status(500).json({ error: 'Failed to create widget' });
    }
});

/**
 * Update a widget's configuration
 * PATCH /api/widget/manage/:widgetId
 */
router.patch('/manage/:widgetId', authMiddleware, (req, res) => {
    try {
        const config = widgetConfigs.get(req.params.widgetId);

        if (!config) {
            return res.status(404).json({ error: 'Widget not found' });
        }

        // Verify ownership
        const clientId = req.user.companyId || 'default-client-id';
        if (config.clientId !== clientId && req.user.role !== 'bam_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const allowedUpdates = [
            'name', 'greeting', 'primaryColor', 'position', 'agentName',
            'placeholderText', 'offlineMessage', 'allowFileUpload', 'showAgentName'
        ];

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                config[field] = req.body[field];
            }
        });

        config.updatedAt = new Date().toISOString();
        widgetConfigs.set(config.id, config);

        res.json({
            success: true,
            widget: config
        });
    } catch (error) {
        console.error('Update widget error:', error);
        res.status(500).json({ error: 'Failed to update widget' });
    }
});

/**
 * Delete a widget
 * DELETE /api/widget/manage/:widgetId
 */
router.delete('/manage/:widgetId', authMiddleware, (req, res) => {
    try {
        const config = widgetConfigs.get(req.params.widgetId);

        if (!config) {
            return res.status(404).json({ error: 'Widget not found' });
        }

        // Verify ownership
        const clientId = req.user.companyId || 'default-client-id';
        if (config.clientId !== clientId && req.user.role !== 'bam_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        widgetConfigs.delete(config.id);

        res.json({
            success: true,
            message: 'Widget deleted successfully'
        });
    } catch (error) {
        console.error('Delete widget error:', error);
        res.status(500).json({ error: 'Failed to delete widget' });
    }
});

/**
 * Get widget analytics
 * GET /api/widget/manage/:widgetId/analytics
 */
router.get('/manage/:widgetId/analytics', authMiddleware, (req, res) => {
    try {
        const config = widgetConfigs.get(req.params.widgetId);

        if (!config) {
            return res.status(404).json({ error: 'Widget not found' });
        }

        // Get sessions for this widget
        const widgetSessionsList = Array.from(widgetSessions.values())
            .filter(s => s.widgetId === config.id);

        const totalSessions = widgetSessionsList.length;
        const completedSessions = widgetSessionsList.filter(s => s.status === 'ended').length;
        const handoverSessions = widgetSessionsList.filter(s => s.status === 'handover_requested').length;

        const totalMessages = widgetSessionsList.reduce((sum, s) =>
            sum + s.messages.filter(m => m.role === 'user').length, 0);

        const avgMessagesPerSession = totalSessions > 0
            ? Math.round(totalMessages / totalSessions * 10) / 10
            : 0;

        const feedbackSessions = widgetSessionsList.filter(s => s.feedback);
        const avgRating = feedbackSessions.length > 0
            ? Math.round(feedbackSessions.reduce((sum, s) => sum + s.feedback.rating, 0) / feedbackSessions.length * 10) / 10
            : null;

        res.json({
            success: true,
            analytics: {
                totalSessions,
                completedSessions,
                handoverSessions,
                handoverRate: totalSessions > 0 ? Math.round(handoverSessions / totalSessions * 100) : 0,
                totalMessages,
                avgMessagesPerSession,
                avgRating,
                feedbackCount: feedbackSessions.length
            }
        });
    } catch (error) {
        console.error('Widget analytics error:', error);
        res.status(500).json({ error: 'Failed to get widget analytics' });
    }
});

module.exports = router;

