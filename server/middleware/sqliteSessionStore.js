const session = require('express-session');

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

class SqliteSessionStore extends session.Store {
    constructor(db, options = {}) {
        super();

        if (!db) {
            throw new Error('A database connection is required for the SQLite session store');
        }

        this.db = db;
        this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                session_data TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        `);

        this.getStatement = this.db.prepare(`
            SELECT session_data, expires_at
            FROM sessions
            WHERE session_id = ?
        `);
        this.setStatement = this.db.prepare(`
            INSERT INTO sessions (session_id, session_data, expires_at, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(session_id) DO UPDATE SET
                session_data = excluded.session_data,
                expires_at = excluded.expires_at,
                updated_at = datetime('now')
        `);
        this.destroyStatement = this.db.prepare('DELETE FROM sessions WHERE session_id = ?');
        this.touchStatement = this.db.prepare(`
            UPDATE sessions
            SET expires_at = ?, updated_at = datetime('now')
            WHERE session_id = ?
        `);
        this.pruneStatement = this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
    }

    getExpiry(sessionData) {
        const cookieExpiry = sessionData?.cookie?.expires;
        const parsedExpiry = cookieExpiry ? new Date(cookieExpiry).getTime() : NaN;
        return Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + this.ttlMs;
    }

    get(sessionId, callback) {
        try {
            const row = this.getStatement.get(sessionId);
            if (!row) {
                return callback(null, null);
            }

            if (row.expires_at <= Date.now()) {
                this.destroyStatement.run(sessionId);
                return callback(null, null);
            }

            return callback(null, JSON.parse(row.session_data));
        } catch (error) {
            return callback(error);
        }
    }

    set(sessionId, sessionData, callback = () => {}) {
        try {
            this.pruneStatement.run(Date.now());
            this.setStatement.run(
                sessionId,
                JSON.stringify(sessionData),
                this.getExpiry(sessionData)
            );
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    touch(sessionId, sessionData, callback = () => {}) {
        try {
            this.touchStatement.run(this.getExpiry(sessionData), sessionId);
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    destroy(sessionId, callback = () => {}) {
        try {
            this.destroyStatement.run(sessionId);
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    clear(callback = () => {}) {
        try {
            this.db.prepare('DELETE FROM sessions').run();
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    length(callback) {
        try {
            this.pruneStatement.run(Date.now());
            const result = this.db.prepare('SELECT COUNT(*) AS count FROM sessions').get();
            callback(null, result.count);
        } catch (error) {
            callback(error);
        }
    }
}

module.exports = SqliteSessionStore;
