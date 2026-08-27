const session = require('express-session');
const crypto = require('crypto');
const SqliteSessionStore = require('./sqliteSessionStore');

function createSessionMiddleware(db) {
    let sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('SESSION_SECRET is required in production');
        }
        sessionSecret = crypto.randomBytes(32).toString('hex');
        process.env.SESSION_SECRET = sessionSecret;
        console.warn('SESSION_SECRET not set. Generated a temporary secret for this process. Sessions will be invalidated on restart.');
    }

    const isProduction = process.env.NODE_ENV === 'production';

    const cookieSecureConfig = process.env.SESSION_COOKIE_SECURE ?? (isProduction ? 'auto' : 'false');
    const cookieSameSiteConfig = process.env.SESSION_COOKIE_SAMESITE ?? 'lax';

    const secure = cookieSecureConfig === 'auto'
        ? 'auto'
        : cookieSecureConfig === 'true';

    if (isProduction && !db) {
        throw new Error('A database connection is required for production session storage');
    }

    return session({
        name: 'sid',
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        store: isProduction ? new SqliteSessionStore(db) : undefined,
        cookie: {
            httpOnly: true,
            secure,
            sameSite: cookieSameSiteConfig,
            maxAge: 1000 * 60 * 60 * 12 // 12 hours
        }
    });
}

module.exports = { createSessionMiddleware };
