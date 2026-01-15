/**
 * Transcription Routes
 * 
 * Handles audio transcription using OpenAI Whisper API
 * API key from Settings (not .env) for flexibility
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Configure multer for audio file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit for Whisper
});

// Get OpenAI client - accepts API key from request or falls back to env
const getOpenAIClient = (apiKey) => {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
        throw new Error('OpenAI API key not provided. Please set it in Settings.');
    }
    return new OpenAI({ apiKey: key });
};

/**
 * POST /api/transcription/transcribe
 * Transcribe audio using OpenAI Whisper
 * 
 * Body: multipart/form-data with 'audio' file
 * Header: x-openai-key (optional, from Settings)
 * Returns: { text: string, success: boolean }
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
    try {
        console.log('[WHISPER] === TRANSCRIBE CALLED ===');
        console.log('[WHISPER] File received:', req.file ? `${req.file.size} bytes, ${req.file.mimetype}` : 'NO FILE');
        console.log('[WHISPER] Original filename:', req.file?.originalname || 'N/A');
        console.log('[WHISPER] API key from header:', req.headers['x-openai-key'] ? `${req.headers['x-openai-key'].substring(0, 10)}...` : 'NOT PROVIDED');

        if (!req.file) {
            console.log('[WHISPER] ERROR: No audio file provided');
            return res.status(400).json({ error: 'No audio file provided' });
        }

        // Check if file has actual content (first bytes should be webm signature)
        const buffer = req.file.buffer;
        const firstBytes = buffer.slice(0, 4).toString('hex');
        console.log('[WHISPER] First 4 bytes (hex):', firstBytes);

        // WebM files start with 1A 45 DF A3 (EBML header)
        if (firstBytes !== '1a45dfa3') {
            console.log('[WHISPER] WARNING: File does not start with EBML header - may be corrupted');
        }

        // Get API key from header (sent from Settings) or env
        const apiKey = req.headers['x-openai-key'] || process.env.OPENAI_API_KEY;
        console.log('[WHISPER] Final API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NONE');
        const openai = getOpenAIClient(apiKey);

        // Write to temp file
        const tempDir = os.tmpdir();
        const tempWebm = path.join(tempDir, `whisper_${Date.now()}.webm`);
        const tempMp3 = path.join(tempDir, `whisper_${Date.now()}.mp3`);
        fs.writeFileSync(tempWebm, buffer);
        console.log('[WHISPER] Written to temp file:', tempWebm, '- Size:', fs.statSync(tempWebm).size, 'bytes');

        let audioFileToSend = tempWebm;

        // Try to convert with ffmpeg to ensure valid format
        try {
            console.log('[WHISPER] Converting to MP3 with ffmpeg...');
            await execAsync(`ffmpeg -y -i "${tempWebm}" -acodec libmp3lame -ab 128k "${tempMp3}" 2>/dev/null`);
            if (fs.existsSync(tempMp3) && fs.statSync(tempMp3).size > 0) {
                audioFileToSend = tempMp3;
                console.log('[WHISPER] Converted to MP3:', tempMp3, '- Size:', fs.statSync(tempMp3).size, 'bytes');
            }
        } catch (ffmpegError) {
            console.log('[WHISPER] ffmpeg conversion failed, using original file:', ffmpegError.message);
        }

        try {
            // Call Whisper API with file stream
            console.log('[WHISPER] Calling OpenAI Whisper API with:', audioFileToSend);
            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(audioFileToSend),
                model: 'whisper-1',
                language: 'en',
                response_format: 'json'
            });

            // Clean up temp files
            if (fs.existsSync(tempWebm)) fs.unlinkSync(tempWebm);
            if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);

            console.log('[WHISPER] SUCCESS - Transcription:', transcription.text?.substring(0, 100) || '(empty)');

            res.json({
                text: transcription.text,
                success: true
            });
        } catch (whisperError) {
            // Clean up temp files on error
            if (fs.existsSync(tempWebm)) fs.unlinkSync(tempWebm);
            if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
            console.error('[WHISPER] API ERROR:', whisperError.message);
            console.error('[WHISPER] Full error:', JSON.stringify(whisperError, null, 2));
            throw whisperError;
        }
    } catch (error) {
        console.error('Transcription error:', error);
        console.error('Error type:', error.constructor.name);
        console.error('Error status:', error.status);
        console.error('Error code:', error.code);

        if (error.message.includes('API key')) {
            return res.status(503).json({
                error: 'OpenAI API key not configured. Please add it in Settings.',
                text: ''
            });
        }

        // Surface detailed OpenAI errors
        let errorMessage = error.message || 'Unknown error';
        let errorCode = error.code || error.status || 500;

        // Check for common OpenAI errors
        if (error.status === 401 || errorMessage.includes('Incorrect API key')) {
            errorMessage = 'Invalid OpenAI API key. Please check your key in Settings.';
            errorCode = 401;
        } else if (error.status === 429 || errorMessage.includes('Rate limit')) {
            errorMessage = 'OpenAI rate limit exceeded. Please wait and try again.';
            errorCode = 429;
        } else if (error.status === 402 || errorMessage.includes('insufficient_quota')) {
            errorMessage = 'OpenAI account has no credits. Please add billing to your OpenAI account.';
            errorCode = 402;
        }

        res.status(500).json({
            error: 'Transcription failed',
            details: errorMessage,
            openaiError: error.error || null,
            code: errorCode,
            text: ''
        });
    }
});

/**
 * POST /api/transcription/process-transcript
 * Smart answer routing - AI determines which questions each answer belongs to
 * Uses GPT-5.2 to analyze transcript against ALL questions
 * 
 * Body: { 
 *   transcript: string, 
 *   questions: [{ id: string, label: string, existingAnswer?: string }],
 *   apiKey?: string
 * }
 * Returns: { answers: { questionId: answerText, ... } }
 */
router.post('/process-transcript', async (req, res) => {
    try {
        const { transcript, questions, apiKey } = req.body;

        console.log('[TRANSCRIPTION] === PROCESS-TRANSCRIPT CALLED ===');
        console.log('[TRANSCRIPTION] Transcript length:', transcript?.length || 0);
        console.log('[TRANSCRIPTION] Questions count:', questions?.length || 0);
        console.log('[TRANSCRIPTION] API key from body:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT PROVIDED');
        console.log('[TRANSCRIPTION] API key from header:', req.headers['x-openai-key'] ? `${req.headers['x-openai-key'].substring(0, 10)}...` : 'NOT PROVIDED');

        if (!transcript || !questions || questions.length === 0) {
            console.log('[TRANSCRIPTION] ERROR: Missing transcript or questions');
            return res.status(400).json({ error: 'Missing transcript or questions' });
        }

        // Get API key from body or header or env
        const key = apiKey || req.headers['x-openai-key'] || process.env.OPENAI_API_KEY;
        console.log('[TRANSCRIPTION] Final API key selected:', key ? `${key.substring(0, 10)}...` : 'NONE');
        const openai = getOpenAIClient(key);

        // Build questions list for the prompt
        const questionsText = questions.map((q, i) =>
            `[${q.id}]: "${q.label}"`
        ).join('\n');

        // Log the questions being sent for debugging
        console.log('[TRANSCRIPTION] Questions being sent to GPT (first 10):');
        questions.slice(0, 10).forEach(q => console.log(`  - ${q.id}: ${q.label}`));
        console.log(`[TRANSCRIPTION] Total questions: ${questions.length}`);
        console.log(`[TRANSCRIPTION] Transcript being analyzed: "${transcript}"`);

        const systemPrompt = `Extract answers from speech for a business onboarding form.

AVAILABLE FIELDS:
${questionsText}

TASK: Match the transcript to ANY field above and return the value.

EXAMPLES:
- "seven" or "7 seats" → {"numberOfSeats": "7"}
- "the company is Acme" → {"companyName": "Acme"}
- "enterprise plan" → {"pricingPlan": "Enterprise"}
- "John Smith" (if asking about contact) → {"contactName": "John Smith"}
- "we sell software" → {"businessOverview": "Software sales"}

RULES:
1. Extract just the VALUE, not a sentence
2. Numbers can be written or spoken ("seven" = "7")
3. ANY mention of seats/users/licenses → numberOfSeats
4. ANY mention of plan/tier/subscription → pricingPlan
5. Be generous - if it might match, include it

Return JSON: {"fieldId": "value", ...}
If no match: {}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-5.2',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Transcript: "${transcript}"` }
            ],
            max_completion_tokens: 1000,
            temperature: 0.3, // Lower for more reliable extraction
            response_format: { type: 'json_object' }
        });

        let answers = {};
        try {
            const content = response.choices[0]?.message?.content?.trim() || '{}';
            console.log('[TRANSCRIPTION] GPT raw response:', content);
            answers = JSON.parse(content);
            console.log('[TRANSCRIPTION] Parsed answers:', JSON.stringify(answers));
            console.log('[TRANSCRIPTION] Number of answers found:', Object.keys(answers).length);
        } catch (parseError) {
            console.error('[TRANSCRIPTION] Failed to parse GPT response:', parseError);
            answers = {};
        }

        console.log('[TRANSCRIPTION] Sending response with', Object.keys(answers).length, 'answers');
        res.json({
            answers,
            success: true,
            questionsProcessed: questions.length
        });
    } catch (error) {
        console.error('Smart answer routing error:', error);

        if (error.message.includes('API key')) {
            return res.status(503).json({
                error: 'OpenAI API key not configured. Please add it in Settings.',
                answers: {}
            });
        }

        res.status(500).json({
            error: 'Answer processing failed',
            details: error.message,
            answers: {}
        });
    }
});

/**
 * POST /api/transcription/extract-answer (legacy - single question)
 * Extract and paraphrase an answer from transcript for a specific question
 */
router.post('/extract-answer', async (req, res) => {
    try {
        const { transcript, question, existingAnswer, apiKey } = req.body;

        if (!transcript || !question) {
            return res.status(400).json({ error: 'Missing transcript or question' });
        }

        const key = apiKey || req.headers['x-openai-key'] || process.env.OPENAI_API_KEY;
        const openai = getOpenAIClient(key);

        const systemPrompt = `You are an assistant helping to extract answers from a conversation transcript during a business onboarding call.

Your task:
1. Read the transcript of what the customer just said
2. Determine if it contains an answer or relevant information for the given question
3. If yes, provide a clear, professional paraphrase of the answer (NOT verbatim)
4. If there's an existing answer, incorporate new details without repeating

Rules:
- Be concise but capture key details
- Use professional business language
- Don't include filler words, stammering, or off-topic content
- If the transcript doesn't contain a relevant answer, return ONLY the existing answer unchanged
- Never make up information - only extract what was actually said

Question: "${question}"

${existingAnswer ? `Existing answer (enhance if new info available): "${existingAnswer}"` : 'No existing answer yet.'}

Respond with ONLY the answer text, nothing else. If no relevant content, respond with the existing answer or empty string.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-5.2',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Transcript: "${transcript}"` }
            ],
            max_completion_tokens: 500,
            temperature: 0.3
        });

        const answer = response.choices[0]?.message?.content?.trim() || existingAnswer || '';
        const hasNewContent = answer !== (existingAnswer || '') && answer.length > 0;

        res.json({
            answer,
            hasNewContent,
            success: true
        });
    } catch (error) {
        console.error('Answer extraction error:', error);

        if (error.message.includes('API key')) {
            return res.status(503).json({
                error: 'OpenAI API key not configured. Please add it in Settings.',
                answer: req.body.existingAnswer || ''
            });
        }

        res.status(500).json({
            error: 'Answer extraction failed',
            answer: req.body.existingAnswer || ''
        });
    }
});

module.exports = router;
