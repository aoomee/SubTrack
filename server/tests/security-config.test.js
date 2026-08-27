const { createCorsOptions, parseAllowedOrigins } = require('../config/cors');
const { createSessionMiddleware } = require('../middleware/session');
const SqliteSessionStore = require('../middleware/sqliteSessionStore');
const Database = require('better-sqlite3');

describe('production security configuration', () => {
    const originalEnv = {
        NODE_ENV: process.env.NODE_ENV,
        SESSION_SECRET: process.env.SESSION_SECRET,
        CORS_ORIGINS: process.env.CORS_ORIGINS,
    };

    afterEach(() => {
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    });

    test('requires an explicit session secret in production', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.SESSION_SECRET;

        expect(() => createSessionMiddleware()).toThrow('SESSION_SECRET is required in production');
    });

    test('allows only explicitly configured cross-origin clients in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.CORS_ORIGINS = 'https://subtrack.example.com, https://admin.example.com';

        expect(parseAllowedOrigins()).toEqual(new Set([
            'https://subtrack.example.com',
            'https://admin.example.com',
        ]));

        const options = createCorsOptions();
        const checkOrigin = origin => new Promise((resolve, reject) => {
            options.origin(origin, (error, allowed) => {
                if (error) reject(error);
                else resolve(allowed);
            });
        });

        return expect(Promise.all([
            checkOrigin('https://subtrack.example.com'),
            checkOrigin('https://untrusted.example.com'),
            checkOrigin(undefined),
        ])).resolves.toEqual([true, false, true]);
    });

    test('persists and destroys production sessions in SQLite', async () => {
        const db = new Database(':memory:');
        const store = new SqliteSessionStore(db);
        const sessionData = {
            cookie: { expires: new Date(Date.now() + 60_000).toISOString() },
            user: { username: 'admin', role: 'admin' },
        };

        const callStore = (method, ...args) => new Promise((resolve, reject) => {
            store[method](...args, (error, value) => {
                if (error) reject(error);
                else resolve(value);
            });
        });

        try {
            await callStore('set', 'session-1', sessionData);
            await expect(callStore('get', 'session-1')).resolves.toMatchObject({
                user: { username: 'admin', role: 'admin' },
            });
            await expect(callStore('length')).resolves.toBe(1);

            await callStore('destroy', 'session-1');
            await expect(callStore('get', 'session-1')).resolves.toBeNull();
        } finally {
            db.close();
        }
    });
});
