# Multi-Stage Production Dockerfile for Cash-Flow Intelligence System
# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

# Copy package descriptors
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Run Type Checking and Build
RUN npm run lint
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security compliance
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 cashflow

# Copy built artifacts and necessary configuration
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/vite.config.ts ./
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/server ./server

# Set file permissions for non-root user
RUN chown -R cashflow:nodejs /app

USER cashflow

EXPOSE 3000

# Health check using HTTP endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["npm", "run", "preview", "--", "--port=3000", "--host=0.0.0.0"]
