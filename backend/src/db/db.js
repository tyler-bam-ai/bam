/**
 * SQLite Database Connection
 * 
 * Uses better-sqlite3 for synchronous operations (faster for Electron).
 * Database file is stored in the backend directory.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database file path
const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'bam.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Create database connection
const db = new Database(DB_PATH);

// Enable foreign keys and WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Initialize database schema
 */
function initializeSchema() {
    db.exec(`
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            role TEXT NOT NULL DEFAULT 'knowledge_consumer',
            company_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        );

        -- Companies/Clients table
        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            industry TEXT,
            plan TEXT DEFAULT 'starter',
            status TEXT DEFAULT 'active',
            contact_name TEXT,
            contact_email TEXT,
            settings TEXT, -- JSON blob for flexible settings
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Conversations table (for AI chat)
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            company_id TEXT,
            brain_type TEXT, -- 'operations', 'employee', 'branding'
            title TEXT,
            pinned INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (company_id) REFERENCES companies(id)
        );

        -- Messages table
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL, -- 'user', 'assistant', 'system'
            content TEXT NOT NULL,
            metadata TEXT, -- JSON blob for sources, confidence, etc.
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        -- Knowledge items (documents, recordings, etc.)
        CREATE TABLE IF NOT EXISTS knowledge_items (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            type TEXT NOT NULL, -- 'document', 'recording', 'voice_memo', 'api'
            title TEXT NOT NULL,
            content TEXT, -- Extracted text content
            file_path TEXT, -- Path to original file
            file_size INTEGER,
            mime_type TEXT,
            status TEXT DEFAULT 'processing', -- 'processing', 'ready', 'error'
            metadata TEXT, -- JSON blob for additional info
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        );

        -- Tasks table
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            company_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            completed INTEGER DEFAULT 0,
            due_date TEXT,
            priority TEXT DEFAULT 'medium',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (company_id) REFERENCES companies(id)
        );

        -- Widgets table (customer chat widgets)
        CREATE TABLE IF NOT EXISTS widgets (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            name TEXT NOT NULL,
            config TEXT, -- JSON blob for widget configuration
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        );

        -- Social accounts table
        CREATE TABLE IF NOT EXISTS social_accounts (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            platform TEXT NOT NULL, -- 'twitter', 'linkedin', 'instagram', etc.
            account_id TEXT, -- Platform-specific account ID
            username TEXT,
            display_name TEXT,
            access_token_enc TEXT, -- Encrypted access token
            refresh_token_enc TEXT, -- Encrypted refresh token
            token_expires_at TEXT,
            status TEXT DEFAULT 'active',
            metadata TEXT, -- JSON blob for additional info
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        );

        -- Scheduled posts table
        CREATE TABLE IF NOT EXISTS scheduled_posts (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            platforms TEXT NOT NULL, -- JSON array of platform names
            content TEXT NOT NULL,
            media_paths TEXT, -- JSON array of media file paths
            scheduled_for TEXT,
            status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'posted', 'failed'
            approval_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
            posted_at TEXT,
            error_message TEXT,
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        );

        -- Content campaigns table
        CREATE TABLE IF NOT EXISTS campaigns (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'draft', -- 'draft', 'active', 'completed', 'archived'
            config TEXT, -- JSON blob for campaign settings
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        );

        -- Videos table (company_id can be NULL for local/unauthenticated uploads)
        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            campaign_id TEXT,
            company_id TEXT,
            title TEXT,
            file_path TEXT NOT NULL,
            thumbnail_path TEXT,
            duration INTEGER, -- Duration in seconds
            status TEXT DEFAULT 'uploading', -- 'uploading', 'processing', 'ready', 'error'
            source TEXT DEFAULT 'upload', -- 'upload', 'youtube', 'url'
            source_url TEXT,
            metadata TEXT, -- JSON blob for video metadata
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (company_id) REFERENCES companies(id)
        );

        -- Clips table
        CREATE TABLE IF NOT EXISTS clips (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            title TEXT,
            description TEXT,
            start_time REAL NOT NULL, -- Start time in seconds
            end_time REAL NOT NULL, -- End time in seconds
            duration REAL, -- Duration in seconds
            virality_score INTEGER, -- 0-100 score
            virality_hook INTEGER DEFAULT 0, -- Hook quality (0-25)
            virality_emotion INTEGER DEFAULT 0, -- Emotional impact (0-25)
            virality_insight INTEGER DEFAULT 0, -- Information density (0-20)
            virality_cta INTEGER DEFAULT 0, -- Call-to-action strength (0-15)
            virality_quality INTEGER DEFAULT 0, -- Video quality (0-15)
            aspect_ratio TEXT DEFAULT '9:16', -- '9:16', '16:9', '1:1'
            caption_style TEXT,
            file_path TEXT, -- Path to exported clip
            thumbnail_path TEXT,
            transcript TEXT, -- Clip transcript
            ai_title TEXT, -- AI-generated viral title
            ai_description TEXT, -- AI-generated description
            ai_analysis TEXT, -- JSON blob for AI analysis details
            status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'scheduled', 'exported'
            scheduled_for TEXT, -- Publish schedule datetime
            metadata TEXT, -- JSON blob for AI-generated metadata
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
        );

        -- Video transcripts table
        CREATE TABLE IF NOT EXISTS video_transcripts (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            full_text TEXT,
            language TEXT DEFAULT 'en',
            duration REAL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
        );

        -- Word-level timings for caption sync
        CREATE TABLE IF NOT EXISTS transcript_words (
            id TEXT PRIMARY KEY,
            transcript_id TEXT NOT NULL,
            word TEXT NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            FOREIGN KEY (transcript_id) REFERENCES video_transcripts(id) ON DELETE CASCADE
        );

        -- Segment-level timings (sentences/phrases)
        CREATE TABLE IF NOT EXISTS transcript_segments (
            id TEXT PRIMARY KEY,
            transcript_id TEXT NOT NULL,
            text TEXT NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            FOREIGN KEY (transcript_id) REFERENCES video_transcripts(id) ON DELETE CASCADE
        );

        -- Onboarding responses table
        CREATE TABLE IF NOT EXISTS onboarding_responses (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            section TEXT NOT NULL,
            question_id TEXT NOT NULL,
            response TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        );

        -- Activity log table
        CREATE TABLE IF NOT EXISTS activity_log (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            company_id TEXT,
            action TEXT NOT NULL,
            entity_type TEXT, -- 'document', 'video', 'post', etc.
            entity_id TEXT,
            details TEXT, -- JSON blob for additional details
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_knowledge_company ON knowledge_items(company_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
        CREATE INDEX IF NOT EXISTS idx_videos_campaign ON videos(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_clips_video ON clips(video_id);
        CREATE INDEX IF NOT EXISTS idx_posts_company ON scheduled_posts(company_id);
        CREATE INDEX IF NOT EXISTS idx_social_accounts_company ON social_accounts(company_id);
    `);

    console.log('✅ Database schema initialized');
}

/**
 * Seed demo accounts if they don't exist
 */
function seedDemoAccounts(bcrypt) {
    const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@bam.ai');

    if (!existingAdmin) {
        const { v4: uuidv4 } = require('uuid');
        const passwordHash = bcrypt.hashSync('demo123', 10);

        // Create demo company
        const companyId = uuidv4();
        db.prepare(`
            INSERT INTO companies (id, name, industry, plan, status, contact_name, contact_email)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(companyId, 'Demo Company', 'Technology', 'professional', 'active', 'Demo Admin', 'admin@bam.ai');

        // Create demo users
        db.prepare(`
            INSERT INTO users (id, email, password_hash, name, role, company_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), 'admin@bam.ai', passwordHash, 'BAM Admin', 'bam_admin', companyId);

        db.prepare(`
            INSERT INTO users (id, email, password_hash, name, role, company_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), 'provider@demo.com', passwordHash, 'Knowledge Provider', 'knowledge_provider', companyId);

        db.prepare(`
            INSERT INTO users (id, email, password_hash, name, role, company_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), 'consumer@demo.com', passwordHash, 'Knowledge Consumer', 'knowledge_consumer', companyId);

        console.log('✅ Demo accounts seeded');
    }
}

// Initialize schema on module load
initializeSchema();

module.exports = {
    db,
    initializeSchema,
    seedDemoAccounts
};
