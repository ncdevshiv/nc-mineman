# Dockerfile - nc-mineman production image
# Multi-stage build for optimized image size

# ============================================
# STAGE 1: Dependencies
# ============================================
FROM oven/bun:1.2-alpine AS deps

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    openjdk21-jre-headless

# Copy package files
COPY package.json bun.lock* ./
COPY patches ./patches

# Install dependencies
RUN bun install --frozen-lockfile --production=false

# ============================================
# STAGE 2: Build
# ============================================
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    openjdk21-jre-headless

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN bun run build

# ============================================
# STAGE 3: Production Runner
# ============================================
FROM oven/bun:1.2-alpine AS runner

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    openjdk21-jre-headless \
    curl \
    wget \
    procps \
    tzdata

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs ncmineman

# Create required directories
RUN mkdir -p /app/data /app/servers /app/backups /app/logs /app/Bin && \
    chown -R ncmineman:nodejs /app

# Copy SpacetimeDB binary (if exists)
COPY --chown=ncmineman:nodejs Bin/SpacetimeDB ./Bin/SpacetimeDB

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy additional required files
COPY --from=builder /app/package.json ./
COPY --chown=ncmineman:nodejs scripts ./scripts
COPY --chown=ncmineman:nodejs plugins ./plugins

# Set environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk

# Expose ports
EXPOSE 3000
EXPOSE 25565
EXPOSE 25575

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Switch to non-root user
USER ncmineman

# Start the application
CMD ["bun", "run", "scripts/start-server.ts"]
