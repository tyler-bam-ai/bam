/**
 * Knowledge Management Routes
 * 
 * Handles uploading and managing knowledge items for Brain Training:
 * - Voice memos (transcribed with Whisper)
 * - Videos (analyzed with Gemini via OpenRouter)
 * - Documents (text extraction)
 * 
 * All content saved to knowledge_items table in Railway database
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { db } = require('../db/db');

const router = express.Router();

// Configure multer for file uploads (memory storage for processing)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            // Documents
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/markdown',
            // Audio
            'audio/webm',
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/ogg',
            'audio/m4a',
            // Video
            'video/webm',
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo',
            // Images
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp'
        ];

        if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error(`File type not allowed: ${file.mimetype}`));
        }
    }
});

/**
 * Upload and transcribe voice memo
 * POST /api/knowledge/voice
 */
router.post('/voice', optionalAuth, upload.single('audio'), async (req, res) => {
    try {
        const { clientId, title } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        console.log(`[KNOWLEDGE] Voice upload for client ${clientId}: ${req.file.size} bytes`);

        // Get API key from header or settings
        const apiKey = req.headers['x-openai-key'] || process.env.OPENAI_API_KEY;

        let transcription = '';

        if (apiKey) {
            try {
                // Transcribe with Whisper
                const OpenAI = require('openai');
                const openai = new OpenAI({ apiKey });

                // Write to temp file for Whisper
                const tempPath = path.join(os.tmpdir(), `voice_${Date.now()}.webm`);
                fs.writeFileSync(tempPath, req.file.buffer);

                const result = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(tempPath),
                    model: 'whisper-1',
                    language: 'en'
                });

                transcription = result.text;

                // Cleanup temp file
                fs.unlinkSync(tempPath);

                console.log(`[KNOWLEDGE] Transcribed ${transcription.split(' ').length} words`);
            } catch (whisperError) {
                console.error('[KNOWLEDGE] Whisper transcription failed:', whisperError.message);
                transcription = '[Transcription failed - audio saved]';
            }
        } else {
            transcription = '[No API key - transcription skipped]';
        }

        // Get user ID from request (if authenticated)
        const userId = req.user?.id || null;

        // Save to knowledge_items table
        const itemId = uuidv4();
        const itemTitle = title || `Voice Memo - ${new Date().toLocaleString()}`;
        const metadata = JSON.stringify({
            type: 'voice_memo',
            duration: req.body.duration || 0,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            wordCount: transcription.split(/\s+/).filter(w => w).length,
            source: 'brain_training',
            layer: 'personal',  // Default to personal layer
            userId: userId,     // Track who created this item
            createdAt: new Date().toISOString()
        });

        console.log(`[KNOWLEDGE] Attempting to save to DB: itemId=${itemId}, clientId=${clientId}`);

        try {
            // Extract layer from request body (default to 'personal')
            // Store layer and userId in metadata for now (columns may not exist on old DBs)
            const layer = req.body.layer || 'personal';

            // Use await on the insert - backwards compatible INSERT (no user_id/layer columns)
            const insertResult = await db.prepare(`
                INSERT INTO knowledge_items (id, company_id, type, title, content, status, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(itemId, clientId, 'voice_memo', itemTitle, transcription, 'ready', metadata);
            console.log(`[KNOWLEDGE] Saved voice memo ${itemId} for client ${clientId}, layer: ${layer}`, insertResult);
        } catch (dbError) {
            console.error('[KNOWLEDGE] Database save error:', dbError);
            console.error('[KNOWLEDGE] DB Error details:', dbError.message, dbError.stack);
            throw dbError;
        }

        res.json({
            success: true,
            item: {
                id: itemId,
                title: itemTitle,
                type: 'voice_memo',
                wordCount: transcription.split(/\s+/).filter(w => w).length,
                transcription: transcription,  // Return FULL transcription for saving
                preview: transcription.substring(0, 200) + (transcription.length > 200 ? '...' : '')
            }
        });
    } catch (error) {
        console.error('[KNOWLEDGE] Voice upload error:', error);
        console.error('[KNOWLEDGE] Full error:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to process voice memo', details: error.message });
    }
});

/**
 * Save text content (transcription) from local processing
 * POST /api/knowledge/text
 * Used when audio is transcribed locally and only text needs to be saved
 */
router.post('/text', optionalAuth, async (req, res) => {
    try {
        const { clientId, type, title, content, wordCount } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        console.log(`[KNOWLEDGE] Saving text for client ${clientId}: ${content.length} chars, ${wordCount || 0} words`);

        // Get user ID from request (if authenticated)
        const userId = req.user?.id || null;

        // Save to knowledge_items table
        const itemId = uuidv4();
        const itemTitle = title || `${type || 'Text'} - ${new Date().toLocaleString()}`;
        const metadata = JSON.stringify({
            type: type || 'text',
            wordCount: wordCount || content.split(/\s+/).filter(w => w).length,
            source: 'brain_training',
            layer: 'personal',  // Default to personal layer
            userId: userId,     // Track who created this item
            createdAt: new Date().toISOString()
        });

        // Extract layer from request body (default to 'personal')
        // Store in metadata for backwards compatibility
        const layer = req.body.layer || 'personal';

        await db.prepare(`
            INSERT INTO knowledge_items (id, company_id, type, title, content, status, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(itemId, clientId, type || 'text', itemTitle, content, 'ready', metadata);

        console.log(`[KNOWLEDGE] Saved text item ${itemId} for client ${clientId}, layer: ${layer}`);


        res.json({
            success: true,
            item: {
                id: itemId,
                title: itemTitle,
                type: type || 'text',
                wordCount: wordCount || content.split(/\s+/).filter(w => w).length
            }
        });
    } catch (error) {
        console.error('[KNOWLEDGE] Text save error:', error);
        res.status(500).json({ error: 'Failed to save text', details: error.message });
    }
});

/**
 * Upload and analyze video/screen recording
 * POST /api/knowledge/video
 * Uses Gemini 2.0 Flash for screen recording analysis with detailed transcription
 */
router.post('/video', optionalAuth, upload.single('video'), async (req, res) => {
    try {
        const { clientId, title, duration, source } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        console.log(`[KNOWLEDGE] Video upload for client ${clientId}: ${req.file.size} bytes, ${req.file.mimetype}`);

        // Get Gemini API key - priority: request header > Railway env
        const geminiService = require('../services/geminiVideoService');
        const geminiKey = geminiService.getGeminiApiKey(req.headers['x-gemini-key']);

        if (!geminiKey) {
            return res.status(400).json({
                error: 'Gemini API key required',
                message: 'Screen recording analysis requires a Gemini API key. Please add your key in Settings → API Keys.',
                code: 'GEMINI_KEY_MISSING'
            });
        }

        console.log(`[KNOWLEDGE] Analyzing video with Gemini...`);

        // Analyze video with Gemini
        let analysis;
        try {
            analysis = await geminiService.analyzeVideoBuffer(
                req.file.buffer,
                req.file.mimetype,
                geminiKey
            );
            console.log(`[KNOWLEDGE] Gemini analysis complete: ${analysis.transcript.length} chars`);
        } catch (geminiError) {
            console.error('[KNOWLEDGE] Gemini analysis failed:', geminiError.message);
            return res.status(500).json({
                error: 'Video analysis failed',
                message: geminiError.message,
                code: 'GEMINI_ANALYSIS_FAILED'
            });
        }

        // Format the content with transcript and summary
        const fullContent = [
            '## Screen Recording Transcript\n',
            analysis.transcript,
            '\n\n---\n\n',
            '## Summary\n',
            analysis.summary,
            `\n\n*Analyzed with ${analysis.model} on ${analysis.analyzedAt}*`
        ].join('');

        // Save to knowledge_items table
        const itemId = uuidv4();
        const itemTitle = title || `Screen Recording - ${new Date().toLocaleString()}`;
        const metadata = JSON.stringify({
            type: 'screen_recording',
            source: source || 'Screen Recording',
            duration: duration || 0,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            hasTranscript: true,
            wordCount: fullContent.split(/\\s+/).filter(w => w).length,
            geminiModel: analysis.model,
            analyzedAt: analysis.analyzedAt,
            createdAt: new Date().toISOString()
        });

        await db.prepare(`
            INSERT INTO knowledge_items (id, company_id, type, title, content, status, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(itemId, clientId, 'screen_recording', itemTitle, fullContent, 'ready', metadata);

        console.log(`[KNOWLEDGE] Saved screen recording ${itemId} for client ${clientId}`);

        res.json({
            success: true,
            item: {
                id: itemId,
                title: itemTitle,
                type: 'screen_recording',
                hasTranscript: true,
                wordCount: fullContent.split(/\\s+/).filter(w => w).length,
                summary: analysis.summary,
                preview: fullContent.substring(0, 500) + (fullContent.length > 500 ? '...' : '')
            }
        });
    } catch (error) {
        console.error('[KNOWLEDGE] Video upload error:', error);
        res.status(500).json({ error: 'Failed to process video', details: error.message });
    }
});

/**
 * Upload and process document
 * POST /api/knowledge/document
 */
router.post('/document', optionalAuth, upload.single('file'), async (req, res) => {
    try {
        const { clientId, title } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        console.log(`[KNOWLEDGE] Document upload for client ${clientId}: ${req.file.originalname}, ${req.file.size} bytes`);

        let extractedText = '';
        const mimeType = req.file.mimetype;
        const filename = req.file.originalname;

        // Extract text based on file type
        if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
            extractedText = req.file.buffer.toString('utf-8');
        } else if (mimeType === 'application/pdf') {
            try {
                // Try to use pdf-parse for PDF extraction
                const pdfParse = require('pdf-parse');
                const data = await pdfParse(req.file.buffer);
                extractedText = data.text;
            } catch (pdfError) {
                console.error('[KNOWLEDGE] PDF parsing failed:', pdfError.message);
                extractedText = `[PDF file: ${filename} - text extraction requires pdf-parse package]`;
            }
        } else if (mimeType.includes('word') || mimeType.includes('document')) {
            try {
                // Try to use mammoth for Word documents
                const mammoth = require('mammoth');
                const result = await mammoth.extractRawText({ buffer: req.file.buffer });
                extractedText = result.value;
            } catch (wordError) {
                console.error('[KNOWLEDGE] Word parsing failed:', wordError.message);
                extractedText = `[Word file: ${filename} - text extraction requires mammoth package]`;
            }
        } else if (mimeType.includes('image')) {
            // For images, we could use OCR or Gemini - for now just note it
            extractedText = `[Image file: ${filename} - consider using video upload for AI analysis]`;
        } else {
            extractedText = `[File: ${filename} - unsupported format for text extraction]`;
        }

        // Save to knowledge_items table
        const itemId = uuidv4();
        const itemTitle = title || filename || `Document - ${new Date().toLocaleString()}`;
        const metadata = JSON.stringify({
            type: 'document',
            filename: filename,
            fileSize: req.file.size,
            mimeType: mimeType,
            wordCount: extractedText.split(/\s+/).filter(w => w).length,
            source: 'brain_training',
            createdAt: new Date().toISOString()
        });

        await db.prepare(`
            INSERT INTO knowledge_items (id, company_id, type, title, content, status, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(itemId, clientId, 'document', itemTitle, extractedText, 'ready', metadata);

        console.log(`[KNOWLEDGE] Saved document ${itemId} for client ${clientId}: ${extractedText.split(/\s+/).length} words`);

        res.json({
            success: true,
            item: {
                id: itemId,
                title: itemTitle,
                type: 'document',
                filename: filename,
                wordCount: extractedText.split(/\s+/).filter(w => w).length,
                preview: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : '')
            }
        });
    } catch (error) {
        console.error('[KNOWLEDGE] Document upload error:', error);
        res.status(500).json({ error: 'Failed to process document' });
    }
});

/**
 * Get all knowledge items for a client
 * GET /api/knowledge/:clientId
 */
router.get('/:clientId', optionalAuth, async (req, res) => {
    try {
        const { clientId } = req.params;

        console.log(`[KNOWLEDGE] GET items for clientId: ${clientId}`);

        // Use only base columns that definitely exist in all environments
        // Filter out deleted items (status = 'ready' means active)
        const items = await db.prepare(`
            SELECT id, type, title, content, status, metadata, created_at
            FROM knowledge_items 
            WHERE company_id = ? AND status = 'ready'
            ORDER BY created_at DESC
        `).all(clientId);

        console.log(`[KNOWLEDGE] Found ${items.length} items for company_id=${clientId}`);

        const formattedItems = items.map(item => {
            const metadata = item.metadata ? JSON.parse(item.metadata) : {};
            return {
                id: item.id,
                type: item.type,
                title: item.title,
                content: item.content, // Full content for viewing
                wordCount: metadata.wordCount || item.content?.split(/\s+/).filter(w => w).length || 0,
                source: metadata.source || 'unknown',
                createdAt: item.created_at,
                preview: item.content?.substring(0, 150) + (item.content?.length > 150 ? '...' : ''),
                // Knowledge Vault fields - defaults for now until DB migrated
                layer: metadata.layer || 'personal',
                upvotes: metadata.upvotes || 0,
                userId: metadata.userId || null
            };
        });

        res.json({
            success: true,
            clientId,
            count: formattedItems.length,
            items: formattedItems
        });
    } catch (error) {
        console.error('[KNOWLEDGE] Get items error:', error);
        res.status(500).json({ error: 'Failed to get knowledge items' });
    }
});

/**
 * Soft delete a knowledge item (moves to trash)
 * DELETE /api/knowledge/item/:itemId
 */
router.delete('/item/:itemId', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;

        // Soft delete by setting status to 'deleted'
        await db.run(`
            UPDATE knowledge_items 
            SET status = 'deleted', metadata = metadata || '{"deletedAt": "' || datetime('now') || '"}'
            WHERE id = ?
        `, itemId);

        res.json({ success: true, message: 'Item moved to trash' });
    } catch (error) {
        console.error('[KNOWLEDGE] Soft delete error:', error);
        res.status(500).json({ error: 'Failed to delete knowledge item' });
    }
});

/**
 * Get trash items for a client (admin only)
 * GET /api/knowledge/trash/:clientId
 */
router.get('/trash/:clientId', optionalAuth, async (req, res) => {
    try {
        const { clientId } = req.params;

        const items = await db.prepare(`
            SELECT id, type, title, content, metadata, layer, created_at
            FROM knowledge_items 
            WHERE (company_id = ? OR client_id = ?) AND status = 'deleted'
            ORDER BY created_at DESC
        `).all(clientId, clientId);

        res.json({ success: true, items, layer: 'trash' });
    } catch (error) {
        console.error('[KNOWLEDGE] Trash fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch trash items' });
    }
});

/**
 * Restore item from trash
 * POST /api/knowledge/trash/:itemId/restore
 */
router.post('/trash/:itemId/restore', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;

        await db.run(`
            UPDATE knowledge_items SET status = 'ready' WHERE id = ?
        `, itemId);

        res.json({ success: true, message: 'Item restored from trash' });
    } catch (error) {
        console.error('[KNOWLEDGE] Restore error:', error);
        res.status(500).json({ error: 'Failed to restore item' });
    }
});

/**
 * Empty trash (permanent delete, admin only)
 * DELETE /api/knowledge/trash/:clientId/empty
 */
router.delete('/trash/:clientId/empty', optionalAuth, async (req, res) => {
    try {
        const { clientId } = req.params;

        const result = await db.run(`
            DELETE FROM knowledge_items 
            WHERE (company_id = ? OR client_id = ?) AND status = 'deleted'
        `, clientId, clientId);

        res.json({ success: true, deletedCount: result.changes, message: 'Trash emptied' });
    } catch (error) {
        console.error('[KNOWLEDGE] Empty trash error:', error);
        res.status(500).json({ error: 'Failed to empty trash' });
    }
});

/**
 * Move item to vault (admin only)
 * POST /api/knowledge/item/:itemId/vault
 */
router.post('/item/:itemId/vault', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;

        await db.run(`
            UPDATE knowledge_items SET layer = 'vault', is_hidden = FALSE WHERE id = ?
        `, itemId);

        res.json({ success: true, message: 'Item moved to vault' });
    } catch (error) {
        console.error('[KNOWLEDGE] Move to vault error:', error);
        res.status(500).json({ error: 'Failed to move to vault' });
    }
});

/**
 * Download library item to personal (creates a copy)
 * POST /api/knowledge/library/:itemId/download
 */
router.post('/library/:itemId/download', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;
        const { userId, clientId } = req.body;

        if (!userId || !clientId) {
            return res.status(400).json({ error: 'userId and clientId required' });
        }

        // Get the library item
        const item = await db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Create a copy in personal layer
        const newId = uuidv4();
        const metadata = JSON.parse(item.metadata || '{}');
        metadata.copiedFrom = itemId;
        metadata.copiedAt = new Date().toISOString();

        await db.run(`
            INSERT INTO knowledge_items (id, company_id, client_id, user_id, type, title, content, metadata, layer, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'personal', 'ready')
        `, newId, clientId, clientId, userId, item.type, item.title, item.content, JSON.stringify(metadata));

        res.json({
            success: true,
            newId,
            message: 'Item downloaded to My Knowledge'
        });
    } catch (error) {
        console.error('[KNOWLEDGE] Download error:', error);
        res.status(500).json({ error: 'Failed to download item' });
    }
});

/**
 * Share a personal item to the library
 * POST /api/knowledge/item/:itemId/share
 */
router.post('/item/:itemId/share', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;
        const userId = req.user?.id;

        // Get the original item
        const item = await db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Create a copy with layer stored in metadata
        const newId = uuidv4();
        const now = new Date().toISOString();
        const originalMetadata = item.metadata ? JSON.parse(item.metadata) : {};
        const newMetadata = {
            ...originalMetadata,
            layer: 'library',
            sharedBy: userId,
            upvotes: 0,
            userId: userId
        };

        await db.run(`
            INSERT INTO knowledge_items (id, company_id, title, type, content, metadata, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'ready', ?)
        `, [newId, item.company_id, item.title, item.type, item.content, JSON.stringify(newMetadata), now]);

        console.log(`[KNOWLEDGE] Shared item ${itemId} to library as ${newId}`);

        res.json({ success: true, newItemId: newId });
    } catch (error) {
        console.error('[KNOWLEDGE] Share error:', error);
        res.status(500).json({ error: 'Failed to share item' });
    }
});

/**
 * Copy an item to personal knowledge or vault
 * POST /api/knowledge/item/:itemId/copy
 */
router.post('/item/:itemId/copy', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;
        const { targetLayer } = req.body; // 'personal' or 'vault'
        const userId = req.user?.id;
        const userRole = req.user?.role;

        // Only admins can copy to vault
        if (targetLayer === 'vault' && userRole !== 'bam_admin' && userRole !== 'client_admin') {
            return res.status(403).json({ error: 'Only admins can add to vault' });
        }

        // Get the original item
        const item = await db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Create a copy with layer in metadata
        const newId = uuidv4();
        const now = new Date().toISOString();
        const originalMetadata = item.metadata ? JSON.parse(item.metadata) : {};
        const newMetadata = {
            ...originalMetadata,
            layer: targetLayer,
            userId: userId
        };

        await db.run(`
            INSERT INTO knowledge_items (id, company_id, title, type, content, metadata, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'ready', ?)
        `, [newId, item.company_id, item.title, item.type, item.content, JSON.stringify(newMetadata), now]);

        console.log(`[KNOWLEDGE] Copied item ${itemId} to ${targetLayer} as ${newId}`);

        res.json({ success: true, newItemId: newId });
    } catch (error) {
        console.error('[KNOWLEDGE] Copy error:', error);
        res.status(500).json({ error: 'Failed to copy item' });
    }
});

/**
 * Get knowledge stats for a client
 * GET /api/knowledge/:clientId/stats
 */
router.get('/:clientId/stats', optionalAuth, async (req, res) => {
    try {
        const { clientId } = req.params;

        const items = await db.prepare(`
            SELECT type, COUNT(*) as count, metadata
            FROM knowledge_items 
            WHERE company_id = ?
            GROUP BY type
        `).all(clientId);

        const allItems = await db.prepare(`
            SELECT content FROM knowledge_items WHERE company_id = ?
        `).all(clientId);

        const totalWords = allItems.reduce((sum, item) => {
            return sum + (item.content?.split(/\s+/).filter(w => w).length || 0);
        }, 0);

        const stats = {
            totalItems: items.reduce((sum, i) => sum + i.count, 0),
            totalWords,
            byType: {}
        };

        items.forEach(item => {
            stats.byType[item.type] = item.count;
        });

        res.json({ success: true, stats });
    } catch (error) {
        console.error('[KNOWLEDGE] Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

/**
 * Debug endpoint - list all knowledge items (for troubleshooting)
 * GET /api/knowledge/debug/all
 */
router.get('/debug/all', optionalAuth, async (req, res) => {
    try {
        const items = await db.prepare(`
            SELECT id, company_id, type, title, status, created_at, 
                   SUBSTR(content, 1, 100) as content_preview
            FROM knowledge_items 
            ORDER BY created_at DESC
            LIMIT 50
        `).all();

        res.json({
            success: true,
            count: items.length,
            items: items
        });
    } catch (error) {
        console.error('[KNOWLEDGE] Debug error:', error);
        res.status(500).json({ error: 'Failed to get debug info', details: error.message });
    }
});

// ==========================================
// KNOWLEDGE VAULT SYSTEM ROUTES
// ==========================================

/**
 * Get Vault items (company-wide, admin-created)
 * GET /api/knowledge/vault/:clientId
 */
router.get('/vault/:clientId', optionalAuth, async (req, res) => {
    try {
        const { clientId } = req.params;
        const showHidden = req.query.showHidden === 'true';

        let query = `
            SELECT id, type, title, content, metadata, layer, is_hidden, upvotes, created_at
            FROM knowledge_items 
            WHERE (company_id = ? OR client_id = ?) AND layer = 'vault'
        `;

        if (!showHidden) {
            query += ` AND (is_hidden = FALSE OR is_hidden IS NULL)`;
        }

        query += ` ORDER BY created_at DESC`;

        const items = await db.prepare(query).all(clientId, clientId);

        res.json({ success: true, items, layer: 'vault' });
    } catch (error) {
        console.error('[KNOWLEDGE] Vault fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch vault items' });
    }
});

/**
 * Add item to Vault (admin only)
 * POST /api/knowledge/vault
 */
router.post('/vault', optionalAuth, async (req, res) => {
    try {
        const { clientId, title, content, type = 'text_note', isHidden = false } = req.body;

        if (!clientId || !content) {
            return res.status(400).json({ error: 'clientId and content are required' });
        }

        const itemId = uuidv4();
        const wordCount = content.split(/\s+/).filter(w => w).length;
        const metadata = JSON.stringify({
            type: type,
            wordCount,
            source: 'vault_direct',
            createdAt: new Date().toISOString()
        });

        await db.run(`
            INSERT INTO knowledge_items (id, company_id, client_id, type, title, content, metadata, layer, is_hidden, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'vault', ?, 'ready')
        `, itemId, clientId, clientId, type, title || 'Vault Item', content, metadata, isHidden);

        res.json({
            success: true,
            id: itemId,
            message: 'Added to vault'
        });
    } catch (error) {
        console.error('[KNOWLEDGE] Vault add error:', error);
        res.status(500).json({ error: 'Failed to add to vault' });
    }
});

/**
 * Toggle vault item visibility
 * PUT /api/knowledge/vault/:itemId/visibility
 */
router.put('/vault/:itemId/visibility', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;
        const { isHidden } = req.body;

        await db.run(`
            UPDATE knowledge_items SET is_hidden = ? WHERE id = ? AND layer = 'vault'
        `, isHidden, itemId);

        res.json({ success: true });
    } catch (error) {
        console.error('[KNOWLEDGE] Visibility toggle error:', error);
        res.status(500).json({ error: 'Failed to toggle visibility' });
    }
});

/**
 * Get Library items (shared by employees, visible to all)
 * GET /api/knowledge/library/:clientId
 */
router.get('/library/:clientId', optionalAuth, async (req, res) => {
    try {
        const { clientId } = req.params;

        const items = await db.prepare(`
            SELECT id, type, title, content, metadata, upvotes, shared_by, user_id, created_at
            FROM knowledge_items 
            WHERE (company_id = ? OR client_id = ?) AND layer = 'library'
            ORDER BY upvotes DESC, created_at DESC
        `).all(clientId, clientId);

        res.json({ success: true, items, layer: 'library' });
    } catch (error) {
        console.error('[KNOWLEDGE] Library fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch library items' });
    }
});

/**
 * Share item to Library
 * POST /api/knowledge/library/share
 */
router.post('/library/share', optionalAuth, async (req, res) => {
    try {
        const { itemId, userId, comment } = req.body;

        // Update existing item to library layer
        await db.run(`
            UPDATE knowledge_items 
            SET layer = 'library', shared_by = ?, metadata = metadata || ?
            WHERE id = ?
        `, userId, JSON.stringify({ sharedComment: comment }), itemId);

        res.json({ success: true, message: 'Shared to library' });
    } catch (error) {
        console.error('[KNOWLEDGE] Share error:', error);
        res.status(500).json({ error: 'Failed to share to library' });
    }
});

/**
 * Upvote a library item
 * POST /api/knowledge/library/:itemId/upvote
 */
router.post('/library/:itemId/upvote', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;

        await db.run(`
            UPDATE knowledge_items 
            SET upvotes = COALESCE(upvotes, 0) + 1 
            WHERE id = ? AND layer = 'library'
        `, itemId);

        const item = await db.prepare(`
            SELECT upvotes FROM knowledge_items WHERE id = ?
        `).get(itemId);

        res.json({ success: true, upvotes: item?.upvotes || 0 });
    } catch (error) {
        console.error('[KNOWLEDGE] Upvote error:', error);
        res.status(500).json({ error: 'Failed to upvote' });
    }
});

/**
 * Promote library item to vault (admin action)
 * POST /api/knowledge/library/:itemId/promote
 */
router.post('/library/:itemId/promote', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;

        await db.run(`
            UPDATE knowledge_items 
            SET layer = 'vault'
            WHERE id = ? AND layer = 'library'
        `, itemId);

        res.json({ success: true, message: 'Promoted to vault' });
    } catch (error) {
        console.error('[KNOWLEDGE] Promote error:', error);
        res.status(500).json({ error: 'Failed to promote to vault' });
    }
});

/**
 * Get personal knowledge (user's own uploads)
 * GET /api/knowledge/personal/:clientId/:userId
 */
router.get('/personal/:clientId/:userId', optionalAuth, async (req, res) => {
    try {
        const { clientId, userId } = req.params;

        const items = await db.prepare(`
            SELECT id, type, title, content, metadata, layer, created_at
            FROM knowledge_items 
            WHERE (company_id = ? OR client_id = ?) 
              AND user_id = ? 
              AND layer = 'personal'
            ORDER BY created_at DESC
        `).all(clientId, clientId, userId);

        res.json({ success: true, items, layer: 'personal' });
    } catch (error) {
        console.error('[KNOWLEDGE] Personal fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch personal items' });
    }
});

/**
 * Get all knowledge for AI context (respects layer priority)
 * Vault items trump personal items
 * GET /api/knowledge/ai-context/:clientId
 */
router.get('/ai-context/:clientId', optionalAuth, async (req, res) => {
    try {
        const { clientId } = req.params;
        const userId = req.query.userId;

        // Get vault items (highest priority, visible unless hidden)
        const vaultItems = await db.prepare(`
            SELECT id, type, title, content, 'vault' as layer
            FROM knowledge_items 
            WHERE (company_id = ? OR client_id = ?) 
              AND layer = 'vault' 
              AND (is_hidden = FALSE OR is_hidden IS NULL)
              AND status = 'ready'
            ORDER BY created_at DESC
        `).all(clientId, clientId);

        // Get personal items for this user (if userId provided)
        let personalItems = [];
        if (userId) {
            personalItems = await db.prepare(`
                SELECT id, type, title, content, 'personal' as layer
                FROM knowledge_items 
                WHERE (company_id = ? OR client_id = ?) 
                  AND user_id = ? 
                  AND layer = 'personal'
                  AND status = 'ready'
                ORDER BY created_at DESC
            `).all(clientId, clientId, userId);
        }

        // Get library items (supplemental)
        const libraryItems = await db.prepare(`
            SELECT id, type, title, content, 'library' as layer
            FROM knowledge_items 
            WHERE (company_id = ? OR client_id = ?) 
              AND layer = 'library'
              AND status = 'ready'
            ORDER BY upvotes DESC, created_at DESC
            LIMIT 20
        `).all(clientId, clientId);

        // Combine with priority: vault first, then personal, then library
        const allItems = [...vaultItems, ...personalItems, ...libraryItems];

        res.json({
            success: true,
            items: allItems,
            counts: {
                vault: vaultItems.length,
                personal: personalItems.length,
                library: libraryItems.length,
                total: allItems.length
            }
        });
    } catch (error) {
        console.error('[KNOWLEDGE] AI context error:', error);
        res.status(500).json({ error: 'Failed to get AI context' });
    }
});

module.exports = router;
