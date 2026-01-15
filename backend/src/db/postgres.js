/**
 * PostgreSQL Database Connection for Railway
 * 
 * Uses the pg library to connect to PostgreSQL when DATABASE_URL is set.
 * Falls back to SQLite for local development.
 */

const { Pool } = require('pg');

// PostgreSQL connection pool
let pool = null;

/**
 * Initialize PostgreSQL connection
 */
async function initializePostgres() {
    if (pool) return pool;

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable not set');
    }

    console.log('[PG] Connecting to PostgreSQL...');

    pool = new Pool({
        connectionString,
        ssl: {
            rejectUnauthorized: false // Required for Railway
        }
    });

    // Test connection
    try {
        const client = await pool.connect();
        console.log('[PG] Connected to PostgreSQL successfully');
        client.release();
    } catch (err) {
        console.error('[PG] Failed to connect:', err);
        throw err;
    }

    // Initialize schema
    await initializeSchema();

    return pool;
}

/**
 * Initialize PostgreSQL schema
 */
async function initializeSchema() {
    const client = await pool.connect();
    try {
        await client.query(`
            -- Users table
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Conversations table
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                client_id TEXT,
                brain_type TEXT,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Messages table
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Knowledge items table
            CREATE TABLE IF NOT EXISTS knowledge_items (
                id TEXT PRIMARY KEY,
                client_id TEXT,
                type TEXT NOT NULL,
                title TEXT,
                content TEXT,
                metadata TEXT,
                embedding TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Clients table (for onboarding)
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('[PG] Schema initialized');
    } finally {
        client.release();
    }
}

/**
 * Query helper - returns array of rows
 */
async function query(sql, params = []) {
    const client = await pool.connect();
    try {
        // Convert ? placeholders to $1, $2, etc for PostgreSQL
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);

        const result = await client.query(pgSql, params);
        return result.rows;
    } finally {
        client.release();
    }
}

/**
 * Get single row
 */
async function get(sql, params = []) {
    const rows = await query(sql, params);
    return rows[0] || null;
}

/**
 * Run a statement (INSERT, UPDATE, DELETE)
 */
async function run(sql, params = []) {
    const client = await pool.connect();
    try {
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);

        const result = await client.query(pgSql, params);
        return { changes: result.rowCount, lastID: null };
    } finally {
        client.release();
    }
}

/**
 * Check if using PostgreSQL
 */
function isPostgres() {
    return !!process.env.DATABASE_URL;
}

/**
 * Get pool for direct access
 */
function getPool() {
    return pool;
}

module.exports = {
    initializePostgres,
    query,
    get,
    run,
    isPostgres,
    getPool
};
