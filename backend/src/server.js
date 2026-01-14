require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { WebSocketServer } = require('ws');
const http = require('http');

// Import routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const knowledgeRoutes = require('./routes/knowledge');
const voiceRoutes = require('./routes/voice');
const tasksRoutes = require('./routes/tasks');
const onboardingRoutes = require('./routes/onboarding');
const clientsRoutes = require('./routes/clients');
const contentRoutes = require('./routes/content');
const socialRoutes = require('./routes/social');
const aiOnboardingRoutes = require('./routes/aiOnboarding');
const analyticsRoutes = require('./routes/analytics');
const widgetRoutes = require('./routes/widget');
const voiceAIRoutes = require('./routes/voiceAI');
const systemRoutes = require('./routes/system');
const transcriptionRoutes = require('./routes/transcription');


const app = express();
const server = http.createServer(app);

// WebSocket server for real-time features
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable for dev, configure properly in production
}));
app.use(compression());
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? 'https://app.bam.ai'
        : ['http://localhost:3000', 'http://localhost:3001', '*'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Serve static files for widget embed
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/ai-onboarding', aiOnboardingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/widget', widgetRoutes);
app.use('/api/voice-ai', voiceAIRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/transcription', transcriptionRoutes);


// 404 handler

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleWebSocketMessage(ws, data);
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
});

function handleWebSocketMessage(ws, data) {
    switch (data.type) {
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
        case 'voice_start':
            // Handle voice session start
            ws.send(JSON.stringify({ type: 'voice_ready' }));
            break;
        default:
            console.log('Unknown WebSocket message type:', data.type);
    }
}

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║        🚀 BAM.ai Backend Server 🚀         ║
║                                           ║
║   Server:    http://localhost:${PORT}        ║
║   WebSocket: ws://localhost:${PORT}/ws       ║
║   Mode:      ${process.env.NODE_ENV || 'development'}                ║
║                                           ║
╚═══════════════════════════════════════════╝
  `);
});

module.exports = { app, server, wss };
