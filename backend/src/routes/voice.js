const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ElevenLabs API configuration
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Available voices
const VOICES = {
    default: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
    adam: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
    bella: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
    sam: { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam' }
};

// Text-to-speech endpoint
router.post('/synthesize', authMiddleware, async (req, res) => {
    try {
        const { text, voiceId = 'default', speed = 1.0 } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const voice = VOICES[voiceId] || VOICES.default;
        const apiKey = process.env.ELEVENLABS_API_KEY;

        if (!apiKey || apiKey === 'your-elevenlabs-api-key') {
            // Return mock audio for development
            return res.json({
                success: true,
                message: 'Audio synthesis simulated (no API key configured)',
                voiceName: voice.name,
                textLength: text.length,
                estimatedDuration: Math.ceil(text.length / 15) // Rough estimate: 15 chars/sec
            });
        }

        // Call ElevenLabs API
        const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voice.id}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    speed: speed
                }
            })
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        const audioBuffer = await response.arrayBuffer();

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.byteLength
        });

        res.send(Buffer.from(audioBuffer));
    } catch (error) {
        console.error('Voice synthesis error:', error);
        res.status(500).json({ error: 'Failed to synthesize speech' });
    }
});

// Get available voices
router.get('/voices', authMiddleware, (req, res) => {
    const voiceList = Object.entries(VOICES).map(([key, value]) => ({
        id: key,
        name: value.name,
        elevenlabsId: value.id
    }));

    res.json(voiceList);
});

// Stream voice response (for real-time voice chat)
router.post('/stream', authMiddleware, async (req, res) => {
    try {
        const { text, voiceId = 'default' } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const voice = VOICES[voiceId] || VOICES.default;
        const apiKey = process.env.ELEVENLABS_API_KEY;

        if (!apiKey || apiKey === 'your-elevenlabs-api-key') {
            return res.json({
                success: true,
                message: 'Streaming simulated (no API key configured)',
                voiceName: voice.name
            });
        }

        // Use streaming endpoint
        const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voice.id}/stream`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        res.set({
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked'
        });

        // Stream the response
        const reader = response.body.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }

        res.end();
    } catch (error) {
        console.error('Voice stream error:', error);
        res.status(500).json({ error: 'Failed to stream speech' });
    }
});

module.exports = router;
