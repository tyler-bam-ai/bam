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
            createdAt: new Date().toISOString()
        });

        console.log(`[KNOWLEDGE] Attempting to save to DB: itemId=${itemId}, clientId=${clientId}`);

        try {
            await db.prepare(`
                INSERT INTO knowledge_items (id, company_id, type, title, content, status, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(itemId, clientId, 'voice_memo', itemTitle, transcription, 'ready', metadata);
            console.log(`[KNOWLEDGE] Saved voice memo ${itemId} for client ${clientId}`);
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
                transcription: transcription.substring(0, 200) + (transcription.length > 200 ? '...' : '')
            }
        });
    } catch (error) {
        console.error('[KNOWLEDGE] Voice upload error:', error);
        console.error('[KNOWLEDGE] Full error:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to process voice memo', details: error.message });
    }
});

/**
 * Upload and analyze video
 * POST /api/knowledge/video
 * Uses Gemini via OpenRouter for video analysis
 */
router.post('/video', optionalAuth, upload.single('video'), async (req, res) => {
    try {
        const { clientId, title } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }

        if (!clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        console.log(`[KNOWLEDGE] Video upload for client ${clientId}: ${req.file.size} bytes, ${req.file.mimetype}`);

        // Get API keys
        const openrouterKey = req.headers['x-openrouter-key'] || process.env.OPENROUTER_API_KEY;
        const openaiKey = req.headers['x-openai-key'] || process.env.OPENAI_API_KEY;

        let description = '';
        let transcription = '';

        // First, try to transcribe audio with Whisper
        if (openaiKey) {
            try {
                const OpenAI = require('openai');
                const openai = new OpenAI({ apiKey: openaiKey });

                // Extract audio and transcribe
                const tempVideoPath = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);
                const tempAudioPath = path.join(os.tmpdir(), `audio_${Date.now()}.mp3`);

                fs.writeFileSync(tempVideoPath, req.file.buffer);

                // Try to extract audio with ffmpeg
                const { exec } = require('child_process');
                const { promisify } = require('util');
                const execAsync = promisify(exec);

                try {
                    await execAsync(`ffmpeg -i "${tempVideoPath}" -vn -acodec libmp3lame -y "${tempAudioPath}" 2>/dev/null`);

                    if (fs.existsSync(tempAudioPath) && fs.statSync(tempAudioPath).size > 0) {
                        const result = await openai.audio.transcriptions.create({
                            file: fs.createReadStream(tempAudioPath),
                            model: 'whisper-1',
                            language: 'en'
                        });
                        transcription = result.text;
                        fs.unlinkSync(tempAudioPath);
                    }
                } catch (ffmpegError) {
                    console.log('[KNOWLEDGE] Audio extraction failed:', ffmpegError.message);
                }

                fs.unlinkSync(tempVideoPath);
                console.log(`[KNOWLEDGE] Transcribed video audio: ${transcription.split(' ').length} words`);
            } catch (whisperError) {
                console.error('[KNOWLEDGE] Video transcription failed:', whisperError.message);
            }
        }

        // Then, analyze video with Gemini via OpenRouter
        if (openrouterKey) {
            try {
                const fetch = require('node-fetch');

                // Convert video to base64 for Gemini
                const videoBase64 = req.file.buffer.toString('base64');
                const mimeType = req.file.mimetype;

                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openrouterKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://bam.ai',
                        'X-Title': 'BAM.ai Brain Training'
                    },
                    body: JSON.stringify({
                        model: 'google/gemini-2.0-flash-001',
                        messages: [{
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: `Analyze this video and provide a detailed description of:
1. What is visually happening in the video
2. Any text, diagrams, or UI elements shown
3. The main topic or purpose of the video
4. Key information that would be useful for a knowledge base

Be thorough but concise. This will be used to train an AI assistant.`
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:${mimeType};base64,${videoBase64}`
                                    }
                                }
                            ]
                        }],
                        max_tokens: 2000
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    description = data.choices?.[0]?.message?.content || '';
                    console.log(`[KNOWLEDGE] Gemini analysis: ${description.length} chars`);
                } else {
                    const errorData = await response.text();
                    console.error('[KNOWLEDGE] OpenRouter error:', errorData);
                }
            } catch (geminiError) {
                console.error('[KNOWLEDGE] Gemini analysis failed:', geminiError.message);
            }
        }

        // Combine transcription and description
        const fullContent = [
            description ? `## Video Analysis\n${description}` : '',
            transcription ? `## Audio Transcription\n${transcription}` : ''
        ].filter(Boolean).join('\n\n---\n\n') || '[No analysis available - check API keys]';

        // Save to knowledge_items table
        const itemId = uuidv4();
        const itemTitle = title || `Video - ${new Date().toLocaleString()}`;
        const metadata = JSON.stringify({
            type: 'video',
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            hasDescription: !!description,
            hasTranscription: !!transcription,
            wordCount: fullContent.split(/\s+/).filter(w => w).length,
            source: 'brain_training',
            createdAt: new Date().toISOString()
        });

        await db.prepare(`
            INSERT INTO knowledge_items (id, company_id, type, title, content, status, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(itemId, clientId, 'video', itemTitle, fullContent, 'ready', metadata);

        console.log(`[KNOWLEDGE] Saved video ${itemId} for client ${clientId}`);

        res.json({
            success: true,
            item: {
                id: itemId,
                title: itemTitle,
                type: 'video',
                hasDescription: !!description,
                hasTranscription: !!transcription,
                wordCount: fullContent.split(/\s+/).filter(w => w).length,
                preview: fullContent.substring(0, 300) + (fullContent.length > 300 ? '...' : '')
            }
        });
    } catch (error) {
        console.error('[KNOWLEDGE] Video upload error:', error);
        res.status(500).json({ error: 'Failed to process video' });
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

        const items = await db.prepare(`
            SELECT id, type, title, content, status, metadata, created_at
            FROM knowledge_items 
            WHERE company_id = ?
            ORDER BY created_at DESC
        `).all(clientId);

        const formattedItems = items.map(item => {
            const metadata = item.metadata ? JSON.parse(item.metadata) : {};
            return {
                id: item.id,
                type: item.type,
                title: item.title,
                wordCount: metadata.wordCount || item.content?.split(/\s+/).filter(w => w).length || 0,
                source: metadata.source || 'unknown',
                createdAt: item.created_at,
                preview: item.content?.substring(0, 150) + (item.content?.length > 150 ? '...' : '')
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
 * Delete a knowledge item
 * DELETE /api/knowledge/item/:itemId
 */
router.delete('/item/:itemId', optionalAuth, async (req, res) => {
    try {
        const { itemId } = req.params;

        await db.prepare('DELETE FROM knowledge_items WHERE id = ?').run(itemId);

        res.json({ success: true, message: 'Knowledge item deleted' });
    } catch (error) {
        console.error('[KNOWLEDGE] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete knowledge item' });
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

module.exports = router;
