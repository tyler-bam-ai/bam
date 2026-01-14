# BAM.ai

## AI-Powered Employee Knowledge Cloning Platform

BAM.ai creates digital clones of employees, enabling business continuity when key personnel are unavailable. The platform captures institutional knowledge through documents, screen recordings, voice recordings, and API integrations—then makes this knowledge accessible through an AI-powered assistant.

![BAM.ai Screenshot](docs/screenshot.png)

## Features

### Knowledge Provider Mode
- **Screen Recording** - Capture workflows with voice narration
- **Document Upload** - Upload PDFs, Word docs, spreadsheets, and more
- **Voice Memos** - Quick audio explanations for processes
- **API Integration** - Connect business tools for automation

### Knowledge Consumer Mode
- **AI Chat** - Natural language Q&A with your knowledge base
- **Voice Chat** - Talk to the AI assistant using ElevenLabs voices
- **Daily Tasks** - Checkbox-driven task management
- **Semi-Automated Actions** - AI-assisted task execution

### BAM Admin Mode
- **Client Management** - Manage multiple client accounts
- **Knowledge Health Dashboard** - Track knowledge base completeness
- **Onboarding Tools** - Guide clients through setup

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/bam-ai/bam-ai.git
cd bam-ai

# Install all dependencies
npm run install:all

# Copy environment template
cp backend/.env.example backend/.env
```

### Configuration

Edit `backend/.env` with your API keys:

```env
# Required for AI chat
OPENROUTER_API_KEY=your-openrouter-api-key

# Required for voice features
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# JWT secret (change in production!)
JWT_SECRET=your-super-secret-jwt-key
```

### Development

```bash
# Run both backend and desktop app
npm run dev

# Or run separately:
npm run dev:backend  # Backend on http://localhost:3001
npm run dev:desktop  # Electron app with React dev server
```

### Demo Accounts

The app includes demo accounts for testing:

| Role | Email | Password |
|------|-------|----------|
| BAM Admin | admin@bam.ai | demo123 |
| Knowledge Provider | provider@demo.com | demo123 |
| Knowledge Consumer | consumer@demo.com | demo123 |

## Project Structure

```
bam-ai/
├── desktop/                 # Electron + React desktop app
│   ├── main/               # Electron main process
│   ├── renderer/           # React application
│   └── preload.js          # Electron preload script
├── backend/                 # Node.js API server
│   └── src/
│       ├── routes/         # API endpoints
│       ├── middleware/     # Auth, etc.
│       └── server.js       # Express server
└── shared/                  # Shared types/utilities
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop App | Electron 28 + React 18 |
| Backend | Node.js + Express |
| LLM | OpenRouter.ai |
| Voice | ElevenLabs |
| Styling | Vanilla CSS with custom design system |

## Building for Production

```bash
# Build the desktop app
npm run build:desktop

# Outputs to desktop/dist/
# - Windows: .exe installer
# - macOS: .dmg and .zip
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Verify JWT token

### Chat
- `POST /api/chat/completions` - AI chat completion
- `GET /api/chat/conversations` - List conversations

### Knowledge
- `POST /api/knowledge/documents` - Upload document
- `POST /api/knowledge/recordings` - Upload recording
- `GET /api/knowledge/stats` - Knowledge base stats

### Voice
- `POST /api/voice/synthesize` - Text-to-speech
- `GET /api/voice/voices` - List available voices

### Tasks
- `GET /api/tasks/today` - Today's tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id/toggle` - Toggle completion

## Roadmap

### Phase 1: MVP (January 2025) ✓
- [x] Knowledge Provider: Screen recording, document upload, audio recording
- [x] Knowledge Consumer: Chat interface, voice chat, daily task list
- [x] BAM Admin: Account management, basic tools
- [x] Desktop apps: Windows + macOS

### Phase 2: Enhanced Automation (February 2025)
- [ ] Semi-automated task execution via APIs
- [ ] Google Workspace integration
- [ ] Mobile apps (iOS + Android)
- [ ] AWS backend migration

### Phase 3: Full Autonomy (March 2025)
- [ ] Fully autonomous mode with scheduled tasks
- [ ] Voice cloning feature
- [ ] Advanced analytics dashboard
- [ ] Real-time onboarding assistant

## License

Proprietary - All rights reserved.

## Support

For support, email support@bam.ai or visit our [documentation](https://docs.bam.ai).
