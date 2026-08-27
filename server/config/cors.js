function parseAllowedOrigins() {
    const configuredOrigins = process.env.CORS_ORIGINS
        ?.split(',')
        .map(origin => origin.trim())
        .filter(Boolean) || [];

    if (process.env.NODE_ENV !== 'production') {
        configuredOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
    }

    return new Set(configuredOrigins);
}

function createCorsOptions() {
    const allowedOrigins = parseAllowedOrigins();

    return {
        credentials: true,
        origin(origin, callback) {
            // Requests without an Origin header include same-origin server calls,
            // health checks and command-line clients.
            if (!origin || allowedOrigins.has(origin)) {
                return callback(null, true);
            }

            return callback(null, false);
        },
    };
}

module.exports = { createCorsOptions, parseAllowedOrigins };
