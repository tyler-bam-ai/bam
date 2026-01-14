# BAM.ai Deployment Guide

## Overview

This guide covers deploying the BAM.ai application for production use.

---

## Backend Deployment (Railway/Render)

### Option 1: Railway (Recommended)

1. **Create Railway Account**: https://railway.app

2. **Create New Project** → Deploy from GitHub

3. **Configure Environment Variables**:
   ```
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=your-secure-secret-here
   OPENROUTER_API_KEY=your-key
   OPENAI_API_KEY=your-whisper-key
   DATABASE_URL=postgresql://...
   ```

4. **Configure Build**:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`

5. **Get Your URL**: Railway provides a public URL like `your-app.up.railway.app`

### Option 2: Render

1. **Create Render Account**: https://render.com

2. **New Web Service** → Connect GitHub

3. **Configure**:
   - Environment: Node
   - Build: `npm install`
   - Start: `npm start`
   - Root: `backend`

4. **Add Environment Variables** (same as Railway)

---

## Database (PostgreSQL)

### Railway PostgreSQL
- Auto-provisions with `DATABASE_URL`
- Free tier: 500MB

### Supabase (Alternative)
1. Create project at https://supabase.com
2. Get connection string from Settings → Database
3. Set as `DATABASE_URL`

---

## File Storage (Cloudflare R2)

For video/audio uploads in production:

1. **Create R2 Bucket** at https://dash.cloudflare.com

2. **Add to Environment**:
   ```
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=your-access-key
   R2_SECRET_ACCESS_KEY=your-secret
   R2_BUCKET_NAME=bam-ai-uploads
   ```

3. **Update backend** to use R2 instead of local filesystem

---

## Desktop App Configuration

### Update API URL

Before building for production, update the API base URL:

**Create** `desktop/renderer/src/config.js`:
```javascript
export const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://your-app.up.railway.app'
  : 'http://localhost:3001';
```

### Build Distributable

```bash
cd desktop

# Mac
npm run build:mac

# Windows (from Mac, needs Wine)
npm run build:win

# Or both
npm run build
```

---

## Code Signing (Optional)

### macOS

1. **Apple Developer Account** ($99/year)
2. **Create Developer ID Certificate**
3. Add to package.json:
   ```json
   "mac": {
     "identity": "Developer ID Application: Your Name (TEAMID)"
   }
   ```

### Windows

1. **Purchase Code Signing Certificate** (Sectigo, DigiCert)
2. Configure in package.json:
   ```json
   "win": {
     "certificateFile": "./cert.pfx",
     "certificatePassword": "password"
   }
   ```

---

## Environment Variables Summary

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `PORT` | Server port (3001) |
| `JWT_SECRET` | Auth secret key |
| `DATABASE_URL` | PostgreSQL connection |
| `OPENROUTER_API_KEY` | For chat AI |
| `OPENAI_API_KEY` | For Whisper transcription |
| `R2_*` | Cloudflare R2 storage |
