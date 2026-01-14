/**
 * Analytics Routes
 * Dashboard value metrics, usage tracking, and ROI calculations
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// In-memory analytics store (replace with database)
const analyticsEvents = new Map();
const dailyMetrics = new Map();

// Value calculation constants
const VALUE_PER_QUESTION_ANSWERED = 2.50;  // $2.50 saved per question (employee time)
const VALUE_PER_CALL_RECOVERED = 75.00;    // $75 avg value of recovered call
const VALUE_PER_CONTENT_POST = 15.00;      // $15 value per social post (vs hiring)
const HOURS_PER_QUESTION = 0.034;          // ~2 minutes per question
const HOURS_PER_CALL = 0.25;               // 15 mins per call
const HOURS_PER_ONBOARDING = 2.0;          // 2 hours saved per employee onboarded

/**
 * Get dashboard metrics summary
 * GET /api/analytics/dashboard
 */
router.get('/dashboard', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'default-client-id';
        const range = req.query.range || '30d'; // 7d, 30d, 90d, all

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (range) {
            case '7d':
                startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
                break;
            case 'all':
                startDate = new Date(0);
                break;
            default: // 30d
                startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        }

        // Get events for this client in range
        const events = Array.from(analyticsEvents.values())
            .filter(e => e.clientId === clientId && new Date(e.timestamp) >= startDate);

        // Calculate metrics
        const questionsAnswered = events.filter(e => e.type === 'question_answered').length;
        const callsRecovered = events.filter(e => e.type === 'call_recovered').length;
        const contentPosted = events.filter(e => e.type === 'content_posted').length;
        const employeesOnboarded = events.filter(e => e.type === 'employee_onboarded').length;

        // Calculate hours saved
        const hoursSaved =
            (questionsAnswered * HOURS_PER_QUESTION) +
            (callsRecovered * HOURS_PER_CALL) +
            (employeesOnboarded * HOURS_PER_ONBOARDING);

        // Calculate value generated
        const valueGenerated =
            (questionsAnswered * VALUE_PER_QUESTION_ANSWERED) +
            (callsRecovered * VALUE_PER_CALL_RECOVERED) +
            (contentPosted * VALUE_PER_CONTENT_POST);

        // Get previous period for comparison
        const prevStartDate = new Date(startDate - (now - startDate));
        const prevEvents = Array.from(analyticsEvents.values())
            .filter(e => e.clientId === clientId &&
                new Date(e.timestamp) >= prevStartDate &&
                new Date(e.timestamp) < startDate);

        const prevQuestionsAnswered = prevEvents.filter(e => e.type === 'question_answered').length;
        const prevHoursSaved = prevQuestionsAnswered * HOURS_PER_QUESTION;

        // Generate weekly activity data
        const weeklyActivity = generateWeeklyActivity(events);

        // Get top questions
        const topQuestions = events
            .filter(e => e.type === 'question_answered' && e.question)
            .reduce((acc, e) => {
                const q = e.question.substring(0, 50);
                acc[q] = (acc[q] || 0) + 1;
                return acc;
            }, {});

        const topQuestionsList = Object.entries(topQuestions)
            .map(([question, count]) => ({ question, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        res.json({
            success: true,
            metrics: {
                hoursSaved: Math.round(hoursSaved * 10) / 10,
                hoursSavedDelta: Math.round((hoursSaved - prevHoursSaved) * 10) / 10,
                questionsAnswered,
                questionsAnsweredDelta: questionsAnswered - prevQuestionsAnswered,
                callsRecovered,
                callsRecoveredPercent: callsRecovered > 0 ? Math.round((callsRecovered / (callsRecovered + 10)) * 100) : 0,
                contentPosted,
                employeesOnboarded,
                estimatedValue: Math.round(valueGenerated),
                estimatedValueDelta: Math.round(valueGenerated * 0.15) // Mock delta
            },
            weeklyActivity,
            topQuestions: topQuestionsList
        });
    } catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({ error: 'Failed to get dashboard analytics' });
    }
});

/**
 * Track an analytics event
 * POST /api/analytics/track
 */
router.post('/track', authMiddleware, (req, res) => {
    try {
        const { type, metadata = {} } = req.body;
        const clientId = req.user.companyId || 'default-client-id';

        const validTypes = [
            'question_answered',
            'call_recovered',
            'call_missed',
            'content_posted',
            'content_scheduled',
            'employee_onboarded',
            'document_uploaded',
            'widget_interaction',
            'chat_escalated'
        ];

        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: `Invalid event type. Valid types: ${validTypes.join(', ')}` });
        }

        const event = {
            id: uuidv4(),
            clientId,
            userId: req.user.id,
            type,
            metadata,
            question: metadata.question || null,
            timestamp: new Date().toISOString()
        };

        analyticsEvents.set(event.id, event);

        res.json({
            success: true,
            eventId: event.id
        });
    } catch (error) {
        console.error('Track event error:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

/**
 * Get value breakdown
 * GET /api/analytics/value-breakdown
 */
router.get('/value-breakdown', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'default-client-id';

        const events = Array.from(analyticsEvents.values())
            .filter(e => e.clientId === clientId);

        const questionsAnswered = events.filter(e => e.type === 'question_answered').length;
        const callsRecovered = events.filter(e => e.type === 'call_recovered').length;
        const contentPosted = events.filter(e => e.type === 'content_posted').length;

        res.json({
            success: true,
            breakdown: [
                {
                    category: 'Questions Answered',
                    count: questionsAnswered,
                    valuePerUnit: VALUE_PER_QUESTION_ANSWERED,
                    totalValue: questionsAnswered * VALUE_PER_QUESTION_ANSWERED,
                    description: 'AI answered employee/customer questions'
                },
                {
                    category: 'Calls Recovered',
                    count: callsRecovered,
                    valuePerUnit: VALUE_PER_CALL_RECOVERED,
                    totalValue: callsRecovered * VALUE_PER_CALL_RECOVERED,
                    description: 'Missed calls converted by AI'
                },
                {
                    category: 'Content Posted',
                    count: contentPosted,
                    valuePerUnit: VALUE_PER_CONTENT_POST,
                    totalValue: contentPosted * VALUE_PER_CONTENT_POST,
                    description: 'Social media posts created'
                }
            ],
            total: (questionsAnswered * VALUE_PER_QUESTION_ANSWERED) +
                (callsRecovered * VALUE_PER_CALL_RECOVERED) +
                (contentPosted * VALUE_PER_CONTENT_POST)
        });
    } catch (error) {
        console.error('Value breakdown error:', error);
        res.status(500).json({ error: 'Failed to get value breakdown' });
    }
});

/**
 * Seed demo analytics data
 * POST /api/analytics/seed-demo
 */
router.post('/seed-demo', authMiddleware, (req, res) => {
    try {
        const clientId = req.user.companyId || 'default-client-id';

        // Clear existing events for this client
        for (const [id, event] of analyticsEvents) {
            if (event.clientId === clientId) {
                analyticsEvents.delete(id);
            }
        }

        // Generate realistic demo data
        const now = new Date();
        const eventTypes = [
            { type: 'question_answered', weight: 50 },
            { type: 'content_posted', weight: 15 },
            { type: 'call_recovered', weight: 5 },
            { type: 'employee_onboarded', weight: 2 }
        ];

        const sampleQuestions = [
            'What are our business hours?',
            'How do I book an appointment?',
            'What services do you offer?',
            'What is the cancellation policy?',
            'Do you offer gift cards?',
            'How do I process a refund?',
            'What are the employee benefits?',
            'How do I submit PTO?'
        ];

        // Generate events for last 30 days
        for (let day = 0; day < 30; day++) {
            const dateOffset = day * 24 * 60 * 60 * 1000;
            const eventDate = new Date(now - dateOffset);

            // Random number of events per day
            const numEvents = Math.floor(Math.random() * 15) + 5;

            for (let i = 0; i < numEvents; i++) {
                // Weighted random event type
                const rand = Math.random() * 72;
                let cumulative = 0;
                let selectedType = 'question_answered';

                for (const et of eventTypes) {
                    cumulative += et.weight;
                    if (rand <= cumulative) {
                        selectedType = et.type;
                        break;
                    }
                }

                const event = {
                    id: uuidv4(),
                    clientId,
                    userId: 'demo-user',
                    type: selectedType,
                    metadata: {},
                    question: selectedType === 'question_answered'
                        ? sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)]
                        : null,
                    timestamp: new Date(eventDate - Math.random() * 24 * 60 * 60 * 1000).toISOString()
                };

                analyticsEvents.set(event.id, event);
            }
        }

        res.json({
            success: true,
            message: 'Demo analytics data seeded',
            eventsCreated: Array.from(analyticsEvents.values()).filter(e => e.clientId === clientId).length
        });
    } catch (error) {
        console.error('Seed demo error:', error);
        res.status(500).json({ error: 'Failed to seed demo data' });
    }
});

// Helper: Generate weekly activity data
function generateWeeklyActivity(events) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const activity = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayName = days[date.getDay()];

        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayEvents = events.filter(e => {
            const eventDate = new Date(e.timestamp);
            return eventDate >= dayStart && eventDate <= dayEnd;
        });

        activity.push({
            day: dayName,
            questions: dayEvents.filter(e => e.type === 'question_answered').length,
            content: dayEvents.filter(e => e.type === 'content_posted').length
        });
    }

    return activity;
}

module.exports = router;
