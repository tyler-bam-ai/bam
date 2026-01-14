/**
 * Voice AI Routes
 * AI Phone Answering integration with Twilio and/or Vapi
 * Handles incoming calls, voice conversations, and call metrics
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// In-memory stores
const voiceCalls = new Map();
const voiceConfigs = new Map();
const callMetrics = new Map();

// Initialize demo voice config
voiceConfigs.set('demo-client', {
    clientId: 'demo-client',
    enabled: true,
    provider: 'twilio', // 'twilio' or 'vapi'
    greeting: "Hi! Thanks for calling. This is the BAM AI assistant. How can I help you today?",
    voiceId: 'Polly.Joanna', // AWS Polly voice
    language: 'en-US',
    transferNumber: '+15551234567',
    businessHours: {
        enabled: true,
        timezone: 'America/Denver',
        schedule: {
            monday: { start: '09:00', end: '18:00' },
            tuesday: { start: '09:00', end: '18:00' },
            wednesday: { start: '09:00', end: '18:00' },
            thursday: { start: '09:00', end: '18:00' },
            friday: { start: '09:00', end: '17:00' },
            saturday: { start: '10:00', end: '14:00' },
            sunday: null
        }
    },
    afterHoursMessage: "Thanks for calling! Our office is currently closed. Please leave a message or call back during business hours.",
    maxCallDuration: 300, // 5 minutes
    recordCalls: true,
    transcribeCalls: true
});

// ==================== TWILIO WEBHOOK ENDPOINTS ====================

/**
 * Incoming call webhook (Twilio)
 * POST /api/voice-ai/twilio/incoming
 * This is the webhook URL you configure in Twilio
 */
router.post('/twilio/incoming', async (req, res) => {
    try {
        const {
            CallSid,
            From,
            To,
            CallStatus,
            AccountSid
        } = req.body;

        console.log(`📞 Incoming call from ${From} to ${To} (${CallSid})`);

        // Look up client by phone number (To)
        // In production, map phone numbers to clients
        const clientId = 'demo-client';
        const config = voiceConfigs.get(clientId);

        if (!config || !config.enabled) {
            // Return simple message if voice AI not enabled
            return res.type('text/xml').send(`
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say>Sorry, this number is not configured for AI assistance. Goodbye.</Say>
                    <Hangup/>
                </Response>
            `);
        }

        // Check business hours
        const isBusinessHours = checkBusinessHours(config.businessHours);

        if (!isBusinessHours && config.businessHours.enabled) {
            return res.type('text/xml').send(`
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say voice="${config.voiceId}">${config.afterHoursMessage}</Say>
                    <Record maxLength="120" transcribe="true" playBeep="true"/>
                    <Say voice="${config.voiceId}">Thank you. We'll get back to you soon. Goodbye.</Say>
                    <Hangup/>
                </Response>
            `);
        }

        // Create call record
        const call = {
            id: uuidv4(),
            twilioCallSid: CallSid,
            clientId,
            from: From,
            to: To,
            status: 'in_progress',
            startTime: new Date().toISOString(),
            transcript: [],
            handled: 'ai',
            metadata: {
                accountSid: AccountSid
            }
        };
        voiceCalls.set(call.id, call);

        // Return TwiML for greeting and gathering input
        res.type('text/xml').send(`
            <?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say voice="${config.voiceId}">${config.greeting}</Say>
                <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/voice-ai/twilio/respond?callId=${call.id}" method="POST">
                    <Say voice="${config.voiceId}">I'm listening.</Say>
                </Gather>
                <Say voice="${config.voiceId}">I didn't hear anything. Goodbye.</Say>
                <Hangup/>
            </Response>
        `);
    } catch (error) {
        console.error('Incoming call error:', error);
        res.type('text/xml').send(`
            <?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say>Sorry, we're experiencing technical difficulties. Please try again later.</Say>
                <Hangup/>
            </Response>
        `);
    }
});

/**
 * Handle speech input and respond
 * POST /api/voice-ai/twilio/respond
 */
router.post('/twilio/respond', async (req, res) => {
    try {
        const { callId } = req.query;
        const { SpeechResult, Confidence } = req.body;

        const call = voiceCalls.get(callId);
        if (!call) {
            return res.type('text/xml').send(`
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say>Sorry, there was an error. Goodbye.</Say>
                    <Hangup/>
                </Response>
            `);
        }

        const config = voiceConfigs.get(call.clientId);
        const userMessage = SpeechResult || '';

        console.log(`🗣 User said: "${userMessage}" (confidence: ${Confidence})`);

        // Add to transcript
        call.transcript.push({
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString(),
            confidence: parseFloat(Confidence) || 0
        });

        // Generate AI response
        const response = await generateVoiceResponse(call, userMessage);

        // Add AI response to transcript
        call.transcript.push({
            role: 'assistant',
            content: response.text,
            timestamp: new Date().toISOString(),
            action: response.action
        });

        voiceCalls.set(call.id, call);

        // Handle different response actions
        if (response.action === 'transfer') {
            return res.type('text/xml').send(`
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say voice="${config.voiceId}">${response.text}</Say>
                    <Dial>${config.transferNumber}</Dial>
                </Response>
            `);
        }

        if (response.action === 'end') {
            call.status = 'completed';
            call.endTime = new Date().toISOString();
            voiceCalls.set(call.id, call);

            return res.type('text/xml').send(`
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say voice="${config.voiceId}">${response.text}</Say>
                    <Hangup/>
                </Response>
            `);
        }

        // Continue conversation
        res.type('text/xml').send(`
            <?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say voice="${config.voiceId}">${response.text}</Say>
                <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/voice-ai/twilio/respond?callId=${call.id}" method="POST">
                    <Say voice="${config.voiceId}">Is there anything else I can help you with?</Say>
                </Gather>
                <Say voice="${config.voiceId}">Thank you for calling. Have a great day!</Say>
                <Hangup/>
            </Response>
        `);
    } catch (error) {
        console.error('Respond error:', error);
        res.type('text/xml').send(`
            <?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say>Sorry, there was an error processing your request. Goodbye.</Say>
                <Hangup/>
            </Response>
        `);
    }
});

/**
 * Call status callback (Twilio)
 * POST /api/voice-ai/twilio/status
 */
router.post('/twilio/status', (req, res) => {
    try {
        const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;

        console.log(`📊 Call ${CallSid} status: ${CallStatus}`);

        // Find call by Twilio SID
        const call = Array.from(voiceCalls.values())
            .find(c => c.twilioCallSid === CallSid);

        if (call) {
            call.status = CallStatus;
            if (CallDuration) call.duration = parseInt(CallDuration);
            if (RecordingUrl) call.recordingUrl = RecordingUrl;
            if (CallStatus === 'completed') {
                call.endTime = new Date().toISOString();
            }
            voiceCalls.set(call.id, call);

            // Update metrics
            updateCallMetrics(call);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Status callback error:', error);
        res.status(500).send('Error');
    }
});

// ==================== VAPI WEBHOOK ENDPOINTS ====================

/**
 * Vapi incoming call webhook
 * POST /api/voice-ai/vapi/incoming
 */
router.post('/vapi/incoming', async (req, res) => {
    try {
        const { call, type, message } = req.body;

        if (type === 'call.started') {
            console.log(`📞 Vapi call started: ${call.id}`);

            const clientId = 'demo-client';
            const config = voiceConfigs.get(clientId);

            const callRecord = {
                id: uuidv4(),
                vapiCallId: call.id,
                clientId,
                from: call.customer?.number || 'unknown',
                status: 'in_progress',
                startTime: new Date().toISOString(),
                transcript: [],
                handled: 'ai'
            };
            voiceCalls.set(callRecord.id, callRecord);

            return res.json({
                assistant: {
                    firstMessage: config.greeting,
                    model: {
                        provider: 'openai',
                        model: 'gpt-4',
                        systemPrompt: getVoiceSystemPrompt(clientId)
                    },
                    voice: {
                        provider: 'playht',
                        voiceId: 'jennifer'
                    }
                }
            });
        }

        if (type === 'transcript') {
            // Handle transcript updates
            const callRecord = Array.from(voiceCalls.values())
                .find(c => c.vapiCallId === call.id);

            if (callRecord && message) {
                callRecord.transcript.push({
                    role: message.role,
                    content: message.content,
                    timestamp: new Date().toISOString()
                });
                voiceCalls.set(callRecord.id, callRecord);
            }
        }

        if (type === 'call.ended') {
            const callRecord = Array.from(voiceCalls.values())
                .find(c => c.vapiCallId === call.id);

            if (callRecord) {
                callRecord.status = 'completed';
                callRecord.endTime = new Date().toISOString();
                callRecord.duration = call.duration || 0;
                voiceCalls.set(callRecord.id, callRecord);
                updateCallMetrics(callRecord);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Vapi webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// ==================== MANAGEMENT ENDPOINTS (AUTHENTICATED) ====================

/**
 * Get voice AI configuration
 * GET /api/voice-ai/config
 */
router.get('/config', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'demo-client';
        const config = voiceConfigs.get(clientId);

        res.json({
            success: true,
            config: config || {
                enabled: false,
                greeting: "Hi! Thanks for calling. How can I help you?",
                voiceId: 'Polly.Joanna'
            }
        });
    } catch (error) {
        console.error('Get config error:', error);
        res.status(500).json({ error: 'Failed to get config' });
    }
});

/**
 * Update voice AI configuration
 * PATCH /api/voice-ai/config
 */
router.patch('/config', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'demo-client';
        let config = voiceConfigs.get(clientId) || { clientId };

        const allowedUpdates = [
            'enabled', 'provider', 'greeting', 'voiceId', 'language',
            'transferNumber', 'businessHours', 'afterHoursMessage',
            'maxCallDuration', 'recordCalls', 'transcribeCalls'
        ];

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                config[field] = req.body[field];
            }
        });

        voiceConfigs.set(clientId, config);

        res.json({
            success: true,
            config
        });
    } catch (error) {
        console.error('Update config error:', error);
        res.status(500).json({ error: 'Failed to update config' });
    }
});

/**
 * Get call history
 * GET /api/voice-ai/calls
 */
router.get('/calls', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'demo-client';
        const { limit = 50, offset = 0 } = req.query;

        const clientCalls = Array.from(voiceCalls.values())
            .filter(c => c.clientId === clientId)
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
            .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        res.json({
            success: true,
            calls: clientCalls.map(c => ({
                id: c.id,
                from: c.from,
                status: c.status,
                duration: c.duration,
                handled: c.handled,
                startTime: c.startTime,
                endTime: c.endTime,
                transcriptLength: c.transcript.length
            })),
            total: Array.from(voiceCalls.values()).filter(c => c.clientId === clientId).length
        });
    } catch (error) {
        console.error('Get calls error:', error);
        res.status(500).json({ error: 'Failed to get calls' });
    }
});

/**
 * Get call details with transcript
 * GET /api/voice-ai/calls/:callId
 */
router.get('/calls/:callId', authMiddleware, (req, res) => {
    try {
        const call = voiceCalls.get(req.params.callId);

        if (!call) {
            return res.status(404).json({ error: 'Call not found' });
        }

        const clientId = req.user.companyId || 'demo-client';
        if (call.clientId !== clientId && req.user.role !== 'bam_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
            success: true,
            call
        });
    } catch (error) {
        console.error('Get call error:', error);
        res.status(500).json({ error: 'Failed to get call' });
    }
});

/**
 * Get call metrics/analytics
 * GET /api/voice-ai/metrics
 */
router.get('/metrics', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'demo-client';
        const { range = '30d' } = req.query;

        // Calculate date range
        const now = new Date();
        const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
        const days = daysMap[range] || 30;
        const startDate = new Date(now - days * 24 * 60 * 60 * 1000);

        const clientCalls = Array.from(voiceCalls.values())
            .filter(c => c.clientId === clientId && new Date(c.startTime) >= startDate);

        const totalCalls = clientCalls.length;
        const completedCalls = clientCalls.filter(c => c.status === 'completed').length;
        const transferredCalls = clientCalls.filter(c => c.handled === 'transferred').length;
        const aiHandled = clientCalls.filter(c => c.handled === 'ai').length;

        const totalDuration = clientCalls.reduce((sum, c) => sum + (c.duration || 0), 0);
        const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

        res.json({
            success: true,
            metrics: {
                totalCalls,
                completedCalls,
                transferredCalls,
                aiHandledPercent: totalCalls > 0 ? Math.round(aiHandled / totalCalls * 100) : 0,
                avgDuration,
                totalDuration,
                range
            }
        });
    } catch (error) {
        console.error('Get metrics error:', error);
        res.status(500).json({ error: 'Failed to get metrics' });
    }
});

/**
 * Seed demo call data
 * POST /api/voice-ai/seed-demo
 */
router.post('/seed-demo', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'demo-client';

        // Generate sample calls
        const sampleCallers = [
            '+15551234567', '+15559876543', '+15555551234',
            '+15557778888', '+15553334444'
        ];

        const sampleTranscripts = [
            [
                { role: 'assistant', content: 'Hi! Thanks for calling. How can I help you?' },
                { role: 'user', content: 'What are your hours?' },
                { role: 'assistant', content: 'We are open Monday through Friday, 9 AM to 6 PM.' }
            ],
            [
                { role: 'assistant', content: 'Hi! Thanks for calling. How can I help you?' },
                { role: 'user', content: 'I need to book an appointment' },
                { role: 'assistant', content: 'I can help with that! When would you like to come in?' }
            ]
        ];

        for (let i = 0; i < 15; i++) {
            const daysAgo = Math.floor(Math.random() * 30);
            const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
            const duration = Math.floor(Math.random() * 180) + 30;

            const call = {
                id: uuidv4(),
                clientId,
                from: sampleCallers[Math.floor(Math.random() * sampleCallers.length)],
                to: '+15550001111',
                status: 'completed',
                startTime: startTime.toISOString(),
                endTime: new Date(startTime.getTime() + duration * 1000).toISOString(),
                duration,
                transcript: sampleTranscripts[Math.floor(Math.random() * sampleTranscripts.length)],
                handled: Math.random() > 0.2 ? 'ai' : 'transferred'
            };
            voiceCalls.set(call.id, call);
        }

        res.json({
            success: true,
            message: 'Demo call data seeded',
            callCount: 15
        });
    } catch (error) {
        console.error('Seed demo error:', error);
        res.status(500).json({ error: 'Failed to seed demo data' });
    }
});

// ==================== HELPER FUNCTIONS ====================

function checkBusinessHours(businessHours) {
    if (!businessHours || !businessHours.enabled) return true;

    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[now.getDay()];

    const schedule = businessHours.schedule[dayName];
    if (!schedule) return false;

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return currentTime >= schedule.start && currentTime <= schedule.end;
}

async function generateVoiceResponse(call, userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    // Simple intent detection for demo
    // In production, this would use LLM with RAG from the client's knowledge base

    if (lowerMessage.includes('hours') || lowerMessage.includes('open')) {
        return {
            text: "We're open Monday through Friday from 9 AM to 6 PM, and Saturday from 10 AM to 2 PM. We're closed on Sundays.",
            action: 'continue'
        };
    }

    if (lowerMessage.includes('appointment') || lowerMessage.includes('book') || lowerMessage.includes('schedule')) {
        return {
            text: "I'd be happy to help you schedule an appointment. We have availability this week. Would you like me to transfer you to our scheduling team?",
            action: 'continue'
        };
    }

    if (lowerMessage.includes('speak') || lowerMessage.includes('human') || lowerMessage.includes('person') || lowerMessage.includes('agent') || lowerMessage.includes('transfer')) {
        return {
            text: "Of course! I'll transfer you to a team member right now. Please hold.",
            action: 'transfer'
        };
    }

    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
        return {
            text: "Our pricing varies depending on the service. For a detailed quote, I can connect you with our team, or you can visit our website for our service menu.",
            action: 'continue'
        };
    }

    if (lowerMessage.includes('location') || lowerMessage.includes('address') || lowerMessage.includes('where')) {
        return {
            text: "We're located at 123 Main Street, Suite 100. There's parking available in the rear lot. Would you like directions?",
            action: 'continue'
        };
    }

    if (lowerMessage.includes('thank') || lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || lowerMessage.includes('that\'s all')) {
        return {
            text: "Thank you for calling! Have a wonderful day. Goodbye!",
            action: 'end'
        };
    }

    return {
        text: "I'm here to help with information about our services, scheduling appointments, hours, and directions. How can I assist you?",
        action: 'continue'
    };
}

function getVoiceSystemPrompt(clientId) {
    return `You are a helpful, friendly AI phone assistant for a business. 
Your role is to:
- Answer questions about business hours, services, and location
- Help schedule appointments
- Provide pricing information when available
- Transfer to a human when the caller requests it or when you cannot help

Keep responses conversational and concise - remember this is a phone call.
Be warm and professional. If you don't know something, offer to transfer to a team member.`;
}

function updateCallMetrics(call) {
    const clientId = call.clientId;
    let metrics = callMetrics.get(clientId) || {
        totalCalls: 0,
        aiHandled: 0,
        transferred: 0,
        totalDuration: 0
    };

    metrics.totalCalls++;
    if (call.handled === 'ai') metrics.aiHandled++;
    if (call.handled === 'transferred') metrics.transferred++;
    if (call.duration) metrics.totalDuration += call.duration;

    callMetrics.set(clientId, metrics);
}

module.exports = router;
