# ==========================================
# Stage 1: Production Dependencies
# ==========================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install production dependencies only using package-lock.json
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# Production environment configuration
ENV NODE_ENV=production \
    HTTP_HOST=0.0.0.0 \
    HTTP_PORT=4000

# Create app data directory and set permissions for the unprivileged node user (UID 1000)
RUN mkdir -p /app/data && chown -R node:node /app

# Copy production dependencies from deps stage
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# Copy application source code and scripts with proper ownership
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

# Switch to non-root user
USER node

# Expose HTTP API port
EXPOSE 4000

# Health check using native Node.js fetch against the health route
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.HTTP_PORT || 4000) + '/api/v1/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Exec form: launches node as PID 1 to receive and handle OS signals (SIGTERM, SIGINT) cleanly
CMD ["node", "src/index.js"]
