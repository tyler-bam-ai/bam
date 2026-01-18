/**
 * Database Connection - SQLite (local) or PostgreSQL (Railway)
 * 
 * Uses sql.js for local development (pure JavaScript SQLite)
 * Uses pg for production when DATABASE_URL is set (Railway PostgreSQL)
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Check if we should use PostgreSQL (Railway)
const USE_POSTGRES = !!process.env.DATABASE_URL;

if (USE_POSTGRES) {
    console.log('[DB] PostgreSQL mode detected (DATABASE_URL set)');
} else {
    console.log('[DB] SQLite mode (local development)');
}

// Database file path (for SQLite)
const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'bam.db');

// Ensure data directory exists (for SQLite)
if (!USE_POSTGRES && !fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Database instance (initialized async)
let db = null;
let SQL = null;
let initPromise = null;
let pgPool = null;

// Import pg for PostgreSQL
const { Pool } = USE_POSTGRES ? require('pg') : { Pool: null };

/**
 * Initialize the database (call this before using db)
 */
async function initializeDatabase() {
    if (USE_POSTGRES) {
        if (pgPool) return pgPool;

        console.log('[DB] Connecting to PostgreSQL...');
        pgPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Test connection
        try {
            const client = await pgPool.connect();
            console.log('[DB] PostgreSQL connected successfully');
            client.release();
        } catch (err) {
            console.error('[DB] PostgreSQL connection failed:', err);
            throw err;
        }

        // Initialize PostgreSQL schema
        await initializePostgresSchema();

        return pgPool;
    }

    // SQLite path (local development)
    if (db) return db;

    if (initPromise) return initPromise;

    initPromise = (async () => {
        console.log('[DB] Initializing sql.js...');
        SQL = await initSqlJs();

        // Load existing database or create new one
        if (fs.existsSync(DB_PATH)) {
            const fileBuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(fileBuffer);
            console.log('[DB] Loaded existing database from:', DB_PATH);
        } else {
            db = new SQL.Database();
            console.log('[DB] Created new database');
        }

        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');

        // Initialize schema
        initializeSchema();

        // Schedule periodic saves
        setInterval(() => saveDatabase(), 30000); // Save every 30 seconds

        return db;
    })();

    return initPromise;
}

/**
 * Initialize PostgreSQL schema
 */
async function initializePostgresSchema() {
    const client = await pgPool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL DEFAULT '',
                name TEXT,
                role TEXT NOT NULL DEFAULT 'knowledge_consumer',
                company_id TEXT,
                google_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS companies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                industry TEXT,
                plan TEXT DEFAULT 'starter',
                status TEXT DEFAULT 'active',
                contact_name TEXT,
                contact_email TEXT,
                contact_phone TEXT,
                website TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS clients (
                id TEXT PRIMARY KEY,
                company_name TEXT NOT NULL,
                contact_name TEXT,
                contact_email TEXT,
                contact_phone TEXT,
                industry TEXT,
                website TEXT,
                plan TEXT DEFAULT 'starter',
                seats INTEGER DEFAULT 5,
                status TEXT DEFAULT 'active',
                responses TEXT,
                knowledge_base TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                client_id TEXT,
                brain_type TEXT,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS knowledge_items (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                file_path TEXT,
                file_size INTEGER,
                mime_type TEXT,
                status TEXT DEFAULT 'processing',
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS onboarding_responses (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                section TEXT,
                question_id TEXT NOT NULL,
                response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('[DB] PostgreSQL schema initialized');
    } finally {
        client.release();
    }
}

/**
 * Save database to disk
 */
function saveDatabase() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
        console.error('[DB] Error saving database:', err);
    }
}

/**
 * Get database instance (sync - assumes already initialized)
 */
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
}

/**
 * Helper to run a query and return results as array of objects
 */
function all(sql, params = []) {
    if (USE_POSTGRES) {
        // Convert ? to $1, $2, etc
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
        return pgPool.query(pgSql, params).then(res => res.rows);
    }

    const stmt = db.prepare(sql);
    if (params.length > 0) {
        stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(row);
    }
    stmt.free();
    return results;
}

/**
 * Helper to get first row
 */
function get(sql, params = []) {
    if (USE_POSTGRES) {
        return all(sql, params).then(rows => rows[0] || null);
    }
    const results = all(sql, params);
    return results[0] || null;
}

/**
 * Helper to run a statement (INSERT/UPDATE/DELETE)
 */
function run(sql, params = []) {
    if (USE_POSTGRES) {
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
        return pgPool.query(pgSql, params).then(res => ({
            changes: res.rowCount,
            lastInsertRowid: null
        }));
    }

    db.run(sql, params);
    saveDatabase(); // Auto-save on writes
    return {
        changes: db.getRowsModified(),
        lastInsertRowid: null // sql.js doesn't easily expose this
    };
}

/**
 * Prepare a statement (sql.js compatible wrapper)
 * Returns sync for SQLite, async for PostgreSQL
 */
function prepare(sql) {
    return {
        run: (...params) => run(sql, params),
        get: (...params) => get(sql, params),
        all: (...params) => all(sql, params)
    };
}

/**
 * Execute raw SQL (for schema creation)
 */
function exec(sql) {
    if (USE_POSTGRES) {
        return pgPool.query(sql);
    }
    db.exec(sql);
    saveDatabase();
}

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
            google_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
            contact_phone TEXT,
            website TEXT,
            transcript TEXT,
            settings TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Conversations table (for AI chat)
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            company_id TEXT,
            brain_type TEXT,
            title TEXT,
            pinned INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Messages table
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Knowledge items
        CREATE TABLE IF NOT EXISTS knowledge_items (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            file_path TEXT,
            file_size INTEGER,
            mime_type TEXT,
            status TEXT DEFAULT 'processing',
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Widgets table
        CREATE TABLE IF NOT EXISTS widgets (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            name TEXT NOT NULL,
            config TEXT,
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Social accounts table
        CREATE TABLE IF NOT EXISTS social_accounts (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            account_id TEXT,
            username TEXT,
            display_name TEXT,
            access_token_enc TEXT,
            refresh_token_enc TEXT,
            token_expires_at TEXT,
            status TEXT DEFAULT 'active',
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Scheduled posts table
        CREATE TABLE IF NOT EXISTS scheduled_posts (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            platforms TEXT NOT NULL,
            content TEXT NOT NULL,
            media_paths TEXT,
            scheduled_for TEXT,
            status TEXT DEFAULT 'draft',
            approval_status TEXT DEFAULT 'pending',
            posted_at TEXT,
            error_message TEXT,
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Content campaigns table
        CREATE TABLE IF NOT EXISTS campaigns (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'draft',
            config TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Videos table
        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            campaign_id TEXT,
            company_id TEXT,
            title TEXT,
            file_path TEXT NOT NULL,
            thumbnail_path TEXT,
            duration INTEGER,
            status TEXT DEFAULT 'uploading',
            source TEXT DEFAULT 'upload',
            source_url TEXT,
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Clips table
        CREATE TABLE IF NOT EXISTS clips (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            title TEXT,
            description TEXT,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            duration REAL,
            virality_score INTEGER,
            virality_hook INTEGER DEFAULT 0,
            virality_emotion INTEGER DEFAULT 0,
            virality_insight INTEGER DEFAULT 0,
            virality_cta INTEGER DEFAULT 0,
            virality_quality INTEGER DEFAULT 0,
            aspect_ratio TEXT DEFAULT '9:16',
            caption_style TEXT,
            file_path TEXT,
            thumbnail_path TEXT,
            transcript TEXT,
            ai_title TEXT,
            ai_description TEXT,
            ai_analysis TEXT,
            status TEXT DEFAULT 'pending',
            scheduled_for TEXT,
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Video transcripts table
        CREATE TABLE IF NOT EXISTS video_transcripts (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            full_text TEXT,
            language TEXT DEFAULT 'en',
            duration REAL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Word-level timings
        CREATE TABLE IF NOT EXISTS transcript_words (
            id TEXT PRIMARY KEY,
            transcript_id TEXT NOT NULL,
            word TEXT NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL
        );

        -- Segment-level timings
        CREATE TABLE IF NOT EXISTS transcript_segments (
            id TEXT PRIMARY KEY,
            transcript_id TEXT NOT NULL,
            text TEXT NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL
        );

        -- Onboarding responses table
        CREATE TABLE IF NOT EXISTS onboarding_responses (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            section TEXT NOT NULL,
            question_id TEXT NOT NULL,
            response TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Activity log table
        CREATE TABLE IF NOT EXISTS activity_log (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            company_id TEXT,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            details TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes
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

    saveDatabase();
    console.log('✅ Database schema initialized');
}

/**
 * Seed demo accounts if they don't exist
 */
function seedDemoAccounts(bcrypt) {
    const existingAdmin = get('SELECT id FROM users WHERE email = ?', ['admin@bam.ai']);

    if (!existingAdmin) {
        const { v4: uuidv4 } = require('uuid');
        const passwordHash = bcrypt.hashSync('demo123', 10);

        // Create demo company
        const companyId = uuidv4();
        run(`
            INSERT INTO companies (id, name, industry, plan, status, contact_name, contact_email)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [companyId, 'Demo Company', 'Technology', 'professional', 'active', 'Demo Admin', 'admin@bam.ai']);

        // Create demo users
        run(`
            INSERT INTO users (id, email, password_hash, name, role, company_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [uuidv4(), 'admin@bam.ai', passwordHash, 'BAM Admin', 'bam_admin', companyId]);

        run(`
            INSERT INTO users (id, email, password_hash, name, role, company_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [uuidv4(), 'provider@demo.com', passwordHash, 'Knowledge Provider', 'knowledge_provider', companyId]);

        run(`
            INSERT INTO users (id, email, password_hash, name, role, company_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [uuidv4(), 'consumer@demo.com', passwordHash, 'Knowledge Consumer', 'knowledge_consumer', companyId]);

        console.log('✅ Demo accounts seeded');
    }
}

// Create a db-like object with prepare method for compatibility
const dbWrapper = {
    prepare: prepare,
    exec: exec,
    run: run,
    get: get,
    all: all,
    pragma: () => { }, // No-op for sql.js
    close: () => {
        if (db) {
            saveDatabase();
            db.close();
            db = null;
        }
    }
};

module.exports = {
    db: dbWrapper,
    initializeDatabase,
    initializeSchema,
    seedDemoAccounts,
    saveDatabase,
    getDb
};
