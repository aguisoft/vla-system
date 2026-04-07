# ─── Stage 1: install all dependencies ───────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace manifests
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/plugin-sdk/package*.json ./packages/plugin-sdk/
COPY apps/api/package*.json ./apps/api/

RUN npm ci

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build internal packages first, then the API
RUN npm run build -w @vla/shared
RUN npm run build -w @vla/plugin-sdk
RUN npm run build -w @vla/api

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# ─── Stage 3: production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy node_modules (includes prisma CLI for migrations)
COPY --from=deps /app/node_modules ./node_modules

# Copy built output
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/plugin-sdk/dist ./packages/plugin-sdk/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma schema + generated client
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Shared tsconfig needed by path resolution
COPY tsconfig.base.json ./

# Plugin storage directory (mount a volume here in production)
RUN mkdir -p storage/plugins

# Entrypoint: run migrations then start the server
COPY apps/api/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
