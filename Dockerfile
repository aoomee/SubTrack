# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy frontend package files first (for better caching)
COPY package*.json ./

# Install the exact dependency versions from package-lock.json
RUN npm ci

# Copy configuration files
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY components.json ./
COPY index.html ./
COPY env.d.ts ./

# Copy frontend source code (most likely to change)
COPY src/ ./src/
COPY public/ ./public/

# Build frontend
RUN npm run build

# Build stage for backend preparation
FROM node:20-alpine AS backend-builder

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app/server

# Copy backend package files
COPY server/package*.json ./

# Install the exact production dependency versions from package-lock.json
RUN npm ci --omit=dev

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

WORKDIR /app

# Copy server application files
COPY --chown=nodeuser:nodejs server/ ./server/

# Copy backend dependencies from builder stage
COPY --from=backend-builder --chown=nodeuser:nodejs /app/server/node_modules ./server/node_modules

# Copy frontend build output
COPY --from=frontend-builder --chown=nodeuser:nodejs /app/dist ./public

# Create data directory and set proper permissions
RUN mkdir -p /app/data && \
    chmod +x ./server/start.sh && \
    chown -R nodeuser:nodejs ./server/db && \
    chmod 755 ./server/db && \
    chown -R nodeuser:nodejs /app/data && \
    chmod 755 /app/data

# Switch to non-root user
USER nodeuser

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production

# Health check - the endpoint is intentionally protected, so either 200
# (authenticated) or 401 (service reached without a session) means the app is up.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "const http=require('http');const options={hostname:'localhost',port:process.env.PORT||3001,path:'/api/health',timeout:2000};const req=http.request(options,res=>{process.exit(res.statusCode===200||res.statusCode===401?0:1)});req.on('error',()=>process.exit(1));req.end();"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["sh", "/app/server/start.sh"]
