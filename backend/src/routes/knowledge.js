const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads', req.user?.companyId || 'default');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/markdown',
            'image/jpeg',
            'image/png',
            'image/gif',
            'video/webm',
            'video/mp4',
            'audio/webm',
            'audio/mp3',
            'audio/mpeg'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} not allowed`), false);
        }
    }
});

// In-memory document store (replace with database)
const documents = new Map();
const recordings = new Map();
const knowledgeBases = new Map();

// Upload document
router.post('/documents', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const document = {
            id: uuidv4(),
            userId: req.user.id,
            companyId: req.user.companyId,
            filename: req.file.originalname,
            storagePath: req.file.path,
            mimetype: req.file.mimetype,
            size: req.file.size,
            status: 'processing', // processing, ready, error
            category: req.body.category || 'uncategorized',
            createdAt: new Date().toISOString()
        };

        documents.set(document.id, document);

        // Simulate processing (in production, this triggers document processing pipeline)
        setTimeout(() => {
            const doc = documents.get(document.id);
            if (doc) {
                doc.status = 'ready';
                doc.processedAt = new Date().toISOString();
            }
        }, 2000);

        res.status(201).json({
            success: true,
            document: {
                id: document.id,
                filename: document.filename,
                status: document.status,
                createdAt: document.createdAt
            }
        });
    } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
});

// Upload recording
router.post('/recordings', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const recording = {
            id: uuidv4(),
            userId: req.user.id,
            companyId: req.user.companyId,
            filename: req.file.originalname,
            storagePath: req.file.path,
            mimetype: req.file.mimetype,
            size: req.file.size,
            duration: req.body.duration || null,
            type: req.body.type || 'screen', // screen, voice
            status: 'processing',
            transcription: null,
            createdAt: new Date().toISOString()
        };

        recordings.set(recording.id, recording);

        // Simulate transcription (in production, this triggers transcription service)
        setTimeout(() => {
            const rec = recordings.get(recording.id);
            if (rec) {
                rec.status = 'ready';
                rec.transcription = 'This is a mock transcription of the recording. In production, this would be the actual transcribed content from the audio/video file.';
                rec.processedAt = new Date().toISOString();
            }
        }, 3000);

        res.status(201).json({
            success: true,
            recording: {
                id: recording.id,
                filename: recording.filename,
                type: recording.type,
                status: recording.status,
                createdAt: recording.createdAt
            }
        });
    } catch (error) {
        console.error('Recording upload error:', error);
        res.status(500).json({ error: 'Failed to upload recording' });
    }
});

// List documents
router.get('/documents', authMiddleware, (req, res) => {
    const userDocs = Array.from(documents.values())
        .filter(d => d.companyId === req.user.companyId)
        .map(d => ({
            id: d.id,
            filename: d.filename,
            mimetype: d.mimetype,
            size: d.size,
            status: d.status,
            category: d.category,
            createdAt: d.createdAt
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(userDocs);
});

// List recordings
router.get('/recordings', authMiddleware, (req, res) => {
    const userRecs = Array.from(recordings.values())
        .filter(r => r.companyId === req.user.companyId)
        .map(r => ({
            id: r.id,
            filename: r.filename,
            type: r.type,
            duration: r.duration,
            status: r.status,
            createdAt: r.createdAt
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(userRecs);
});

// Get document by ID
router.get('/documents/:id', authMiddleware, (req, res) => {
    const document = documents.get(req.params.id);

    if (!document) {
        return res.status(404).json({ error: 'Document not found' });
    }

    if (document.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    res.json(document);
});

// Delete document
router.delete('/documents/:id', authMiddleware, (req, res) => {
    const document = documents.get(req.params.id);

    if (!document) {
        return res.status(404).json({ error: 'Document not found' });
    }

    if (document.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file from storage
    if (fs.existsSync(document.storagePath)) {
        fs.unlinkSync(document.storagePath);
    }

    documents.delete(req.params.id);

    res.json({ success: true, message: 'Document deleted' });
});

// Get knowledge base stats
router.get('/stats', authMiddleware, (req, res) => {
    const companyDocs = Array.from(documents.values())
        .filter(d => d.companyId === req.user.companyId);

    const companyRecs = Array.from(recordings.values())
        .filter(r => r.companyId === req.user.companyId);

    const stats = {
        totalDocuments: companyDocs.length,
        processingDocuments: companyDocs.filter(d => d.status === 'processing').length,
        totalRecordings: companyRecs.length,
        processingRecordings: companyRecs.filter(r => r.status === 'processing').length,
        totalStorageBytes: [...companyDocs, ...companyRecs].reduce((sum, item) => sum + (item.size || 0), 0),
        completionScore: calculateCompletionScore(companyDocs, companyRecs)
    };

    res.json(stats);
});

// Helper: Calculate knowledge base completion score
function calculateCompletionScore(docs, recs) {
    const hasDocuments = docs.length > 0;
    const hasRecordings = recs.length > 0;
    const hasManyDocs = docs.length >= 5;
    const hasManyRecs = recs.length >= 3;

    let score = 0;
    if (hasDocuments) score += 25;
    if (hasRecordings) score += 25;
    if (hasManyDocs) score += 25;
    if (hasManyRecs) score += 25;

    return score;
}

module.exports = router;
