/**
 * Clients Management Routes
 * Per-client management with API key tracking and usage monitoring
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth, requireRole } = require('../middleware/auth');
const { getClientUsageSummary, getAllClientsUsage } = require('../services/apiTracking');
const { db } = require('../db/db');

const router = express.Router();

/**
 * Create a new client (company)
 * POST /api/clients
 */
router.post('/', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const {
            companyName,
            industry,
            contactEmail,
            contactName,
            plan = 'starter'
        } = req.body;

        if (!companyName || !contactEmail) {
            return res.status(400).json({
                error: 'Company name and contact email are required'
            });
        }

        const id = uuidv4();
        const settings = JSON.stringify({
            apiKeys: {
                openrouter: { enabled: true, monthlyLimit: null },
                elevenlabs: { enabled: true, monthlyLimit: null },
                gemini: { enabled: true, monthlyLimit: null }
            },
            seatsIncluded: 5,
            pricePerSeat: 19.99
        });

        db.prepare(`
            INSERT INTO companies (id, name, industry, plan, status, contact_name, contact_email, settings)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, companyName, industry || null, plan, 'active', contactName || null, contactEmail, settings);

        const client = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);

        res.status(201).json({
            success: true,
            client: formatClient(client)
        });
    } catch (error) {
        console.error('Create client error:', error);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

/**
 * Create a new client from onboarding session
 * POST /api/clients/from-onboarding
 * This saves ALL onboarding data including responses AND full transcript
 */
router.post('/from-onboarding', (req, res) => {
    try {
        const {
            companyName,
            contactName,
            contactEmail,
            contactPhone,
            website,
            industry,
            numberOfSeats,
            pricingPlan,
            responses = {},
            transcript = '' // Full interview transcript
        } = req.body;

        if (!companyName) {
            return res.status(400).json({
                error: 'Company name is required'
            });
        }

        const id = uuidv4();

        // Store all onboarding data in settings JSON
        const settings = JSON.stringify({
            apiKeys: {
                openrouter: { enabled: true, monthlyLimit: null },
                elevenlabs: { enabled: true, monthlyLimit: null },
                gemini: { enabled: true, monthlyLimit: null }
            },
            seatsIncluded: parseInt(numberOfSeats) || 5,
            pricePerSeat: 19.99,
            phone: contactPhone,
            website: website,
            // Store ALL onboarding data here for BAM Brains access
            onboardingData: {
                companyName,
                contactName,
                contactEmail,
                contactPhone,
                website,
                industry,
                numberOfSeats,
                pricingPlan,
                responses, // All the detailed interview responses
                hasTranscript: !!transcript,
                completedAt: new Date().toISOString()
            }
        });

        db.prepare(`
            INSERT INTO companies (id, name, industry, plan, status, contact_name, contact_email, settings)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, companyName, industry || null, pricingPlan || 'starter', 'active', contactName || null, contactEmail || null, settings);

        // Save individual responses to onboarding_responses table for easier querying
        Object.entries(responses).forEach(([questionId, response]) => {
            if (response && response.trim()) {
                const responseId = uuidv4();
                try {
                    db.prepare(`
                        INSERT INTO onboarding_responses (id, company_id, section, question_id, response)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(responseId, id, 'interview', questionId, response);
                } catch (e) {
                    console.warn(`Failed to save response ${questionId}:`, e.message);
                }
            }
        });

        // Save the full transcript as a knowledge item for BAM Brains
        if (transcript && transcript.trim()) {
            const transcriptId = uuidv4();
            const transcriptMetadata = JSON.stringify({
                source: 'onboarding_interview',
                questionCount: Object.keys(responses).length,
                wordCount: transcript.split(/\s+/).length,
                createdBy: 'onboarding_wizard'
            });

            try {
                db.prepare(`
                    INSERT INTO knowledge_items (id, company_id, type, title, content, status, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    transcriptId,
                    id,
                    'transcript',
                    `${companyName} - Onboarding Interview Transcript`,
                    transcript,
                    'ready',
                    transcriptMetadata
                );
                console.log(`[ONBOARDING] Saved transcript as knowledge item: ${transcriptId}`);
            } catch (e) {
                console.warn('Failed to save transcript as knowledge item:', e.message);
            }

            // Also save a summary/index of all Q&A pairs as a separate knowledge item
            const qaSummary = Object.entries(responses)
                .filter(([_, answer]) => answer && answer.trim())
                .map(([questionId, answer]) => `Q: ${questionId}\nA: ${answer}`)
                .join('\n\n---\n\n');

            if (qaSummary) {
                const qaId = uuidv4();
                const qaMetadata = JSON.stringify({
                    source: 'onboarding_qa',
                    questionCount: Object.keys(responses).filter(k => responses[k]).length
                });

                try {
                    db.prepare(`
                        INSERT INTO knowledge_items (id, company_id, type, title, content, status, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        qaId,
                        id,
                        'qa_summary',
                        `${companyName} - Onboarding Q&A Summary`,
                        qaSummary,
                        'ready',
                        qaMetadata
                    );
                    console.log(`[ONBOARDING] Saved Q&A summary as knowledge item: ${qaId}`);
                } catch (e) {
                    console.warn('Failed to save Q&A summary as knowledge item:', e.message);
                }
            }
        }

        const client = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);

        console.log(`[ONBOARDING] Created new client: ${companyName} (${id}) with ${transcript ? 'transcript' : 'no transcript'}`);

        res.status(201).json({
            success: true,
            message: `Client "${companyName}" created successfully`,
            client: formatClient(client),
            clientId: id,
            hasTranscript: !!transcript
        });
    } catch (error) {
        console.error('Create client from onboarding error:', error);
        res.status(500).json({ error: 'Failed to create client from onboarding' });
    }
});

/**
 * Append transcript to existing client's knowledge base
 * POST /api/clients/:id/transcript
 * Used by Onboarding "Upload Transcript" and Brain Training
 */
router.post('/:id/transcript', (req, res) => {
    try {
        const { id } = req.params;
        const { transcript, title, source } = req.body;

        if (!transcript || !transcript.trim()) {
            return res.status(400).json({ error: 'Transcript text is required' });
        }

        const client = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const transcriptId = uuidv4();
        const transcriptMetadata = JSON.stringify({
            source: source || 'uploaded_transcript',
            wordCount: transcript.split(/\s+/).length,
            uploadedAt: new Date().toISOString()
        });

        db.prepare(`
            INSERT INTO knowledge_items (id, company_id, type, title, content, status, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            transcriptId,
            id,
            'transcript',
            title || `${client.name} - Uploaded Transcript`,
            transcript,
            'ready',
            transcriptMetadata
        );

        console.log(`[TRANSCRIPT] Added transcript to client ${client.name}: ${transcriptId}`);

        res.json({
            success: true,
            message: 'Transcript added to knowledge base',
            transcriptId,
            wordCount: transcript.split(/\s+/).length
        });
    } catch (error) {
        console.error('Add transcript error:', error);
        res.status(500).json({ error: 'Failed to add transcript' });
    }
});

/**
 * Get onboarding data for a client (used by BAM Brains)
 * GET /api/clients/:id/onboarding
 */
router.get('/:id/onboarding', (req, res) => {
    try {
        const client = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const settings = client.settings ? JSON.parse(client.settings) : {};
        const onboardingData = settings.onboardingData || {};

        // Also get responses from onboarding_responses table
        const responses = db.prepare(`
            SELECT question_id, response FROM onboarding_responses WHERE company_id = ?
        `).all(req.params.id);

        const responsesMap = {};
        responses.forEach(r => {
            responsesMap[r.question_id] = r.response;
        });

        // Get transcript from knowledge_items table
        const transcriptItem = db.prepare(`
            SELECT content FROM knowledge_items 
            WHERE company_id = ? AND type = 'transcript' 
            ORDER BY created_at DESC LIMIT 1
        `).get(req.params.id);

        res.json({
            clientId: client.id,
            companyName: client.name,
            industry: client.industry,
            ...onboardingData,
            responses: { ...onboardingData.responses, ...responsesMap },
            transcript: transcriptItem?.content || null
        });
    } catch (error) {
        console.error('Get onboarding data error:', error);
        res.status(500).json({ error: 'Failed to get onboarding data' });
    }
});

/**
 * Get all clients
 * GET /api/clients
 */
router.get('/', optionalAuth, (req, res) => {
    try {
        const clients = db.prepare(`
            SELECT c.*, 
                   (SELECT COUNT(*) FROM users WHERE company_id = c.id) as user_count,
                   (SELECT COUNT(*) FROM knowledge_items WHERE company_id = c.id) as knowledge_count
            FROM companies c 
            WHERE c.status != 'deleted'
            ORDER BY c.created_at DESC
        `).all();

        const clientList = clients.map(client => {
            const usage = getClientUsageSummary(client.id);
            return {
                ...formatClient(client),
                userCount: client.user_count,
                knowledgeCount: client.knowledge_count,
                usage: {
                    totalTokens: usage?.totals?.tokens || 0,
                    totalCost: usage?.totals?.cost || 0,
                    requestCount: usage?.totals?.requests || 0
                }
            };
        });

        res.json({ clients: clientList });
    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ error: 'Failed to get clients' });
    }
});

/**
 * Get a specific client
 * GET /api/clients/:id
 */
router.get('/:id', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const client = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json(formatClient(client));
    } catch (error) {
        console.error('Get client error:', error);
        res.status(500).json({ error: 'Failed to get client' });
    }
});

/**
 * Update a client
 * PATCH /api/clients/:id
 */
router.patch('/:id', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const client = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const { companyName, industry, contactEmail, contactName, plan, status } = req.body;

        db.prepare(`
            UPDATE companies 
            SET name = COALESCE(?, name),
                industry = COALESCE(?, industry),
                contact_email = COALESCE(?, contact_email),
                contact_name = COALESCE(?, contact_name),
                plan = COALESCE(?, plan),
                status = COALESCE(?, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(companyName, industry, contactEmail, contactName, plan, status, req.params.id);

        const updatedClient = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);

        res.json({
            success: true,
            client: formatClient(updatedClient)
        });
    } catch (error) {
        console.error('Update client error:', error);
        res.status(500).json({ error: 'Failed to update client' });
    }
});

/**
 * Update client API key configuration
 * PATCH /api/clients/:id/api-keys
 */
router.patch('/:id/api-keys', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const client = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const { service, enabled, monthlyLimit } = req.body;

        if (!service || !['openrouter', 'elevenlabs', 'gemini'].includes(service)) {
            return res.status(400).json({
                error: 'Valid service name required (openrouter, elevenlabs, gemini)'
            });
        }

        // Parse existing settings
        const settings = client.settings ? JSON.parse(client.settings) : { apiKeys: {} };

        // Update the specific service
        settings.apiKeys = settings.apiKeys || {};
        settings.apiKeys[service] = {
            ...settings.apiKeys[service],
            enabled: enabled !== undefined ? enabled : (settings.apiKeys[service]?.enabled ?? true),
            monthlyLimit: monthlyLimit !== undefined ? monthlyLimit : (settings.apiKeys[service]?.monthlyLimit ?? null)
        };

        // Save back
        db.prepare(`
            UPDATE companies SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(JSON.stringify(settings), req.params.id);

        res.json({
            success: true,
            apiKeys: settings.apiKeys
        });
    } catch (error) {
        console.error('Update client API keys error:', error);
        res.status(500).json({ error: 'Failed to update API keys' });
    }
});

/**
 * Get client usage statistics
 * GET /api/clients/:id/usage
 */
router.get('/:id/usage', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const client = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

        const usage = getClientUsageSummary(client.id, { startDate, endDate });

        res.json({
            client: {
                id: client.id,
                companyName: client.name
            },
            usage
        });
    } catch (error) {
        console.error('Get client usage error:', error);
        res.status(500).json({ error: 'Failed to get usage statistics' });
    }
});

/**
 * Get aggregated usage across all clients (admin dashboard)
 * GET /api/clients/usage/aggregate
 */
router.get('/usage/aggregate', authMiddleware, requireRole('bam_admin'), (req, res) => {
    try {
        const aggregated = getAllClientsUsage();
        res.json(aggregated);
    } catch (error) {
        console.error('Get aggregated usage error:', error);
        res.status(500).json({ error: 'Failed to get aggregated usage' });
    }
});

/**
 * Delete a client
 * DELETE /api/clients/:id
 */
router.delete('/:id', optionalAuth, (req, res) => {
    try {
        const client = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // Soft delete - just mark as deleted
        db.prepare(`
            UPDATE companies SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(req.params.id);

        res.json({
            success: true,
            message: 'Client deleted successfully'
        });
    } catch (error) {
        console.error('Delete client error:', error);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});

// Helper function to format client for response
function formatClient(client) {
    const settings = client.settings ? JSON.parse(client.settings) : {};
    const apiKeys = settings.apiKeys || {};

    return {
        id: client.id,
        companyName: client.name,
        industry: client.industry,
        contactEmail: client.contact_email,
        contactName: client.contact_name,
        plan: client.plan,
        status: client.status,
        apiKeys: {
            openrouter: {
                configured: !!apiKeys.openrouter?.keyId,
                enabled: apiKeys.openrouter?.enabled ?? true,
                monthlyLimit: apiKeys.openrouter?.monthlyLimit ?? null
            },
            elevenlabs: {
                configured: !!apiKeys.elevenlabs?.keyId,
                enabled: apiKeys.elevenlabs?.enabled ?? true,
                monthlyLimit: apiKeys.elevenlabs?.monthlyLimit ?? null
            },
            gemini: {
                configured: !!apiKeys.gemini?.keyId,
                enabled: apiKeys.gemini?.enabled ?? true,
                monthlyLimit: apiKeys.gemini?.monthlyLimit ?? null
            }
        },
        seatsIncluded: settings.seatsIncluded || 5,
        pricePerSeat: settings.pricePerSeat || 19.99,
        createdAt: client.created_at,
        updatedAt: client.updated_at
    };
}

module.exports = router;
