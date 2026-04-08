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

# Generate Prisma client FIRST so types are available for tsc
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build internal packages, then the API
RUN npm run build -w @vla/shared
RUN npm run build -w @vla/plugin-sdk
RUN npm run build -w @vla/api

# Compile the seed script so it can run without ts-node in production
RUN npx tsc apps/api/prisma/seed.ts \
      --outDir apps/api/dist/prisma \
      --module commonjs --target es2017 \
      --esModuleInterop --resolveJsonModule --skipLibCheck

# ─── Stage 3: production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL required by Prisma engine binaries on Alpine (musl)
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 vla && \
    adduser --system --uid 1001 --ingroup vla vla

# Copy node_modules (includes prisma CLI for migrations)
COPY --from=deps /app/node_modules ./node_modules

# Copy built output
# package.json files are required so Node can resolve the workspace symlinks at runtime
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/plugin-sdk/package.json ./packages/plugin-sdk/package.json
COPY --from=builder /app/packages/plugin-sdk/dist ./packages/plugin-sdk/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma schema + generated client + engine binaries (avoids runtime downloads)
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines

# Shared tsconfig needed by path resolution
COPY tsconfig.base.json ./

# Plugin storage + fix ownership so vla user can run prisma CLI
RUN mkdir -p storage/plugins \
    && chown -R vla:vla storage \
    && chown -R vla:vla node_modules/.prisma \
    && chown -R vla:vla node_modules/@prisma/engines

# Entrypoint: run migrations then start the server
COPY apps/api/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER vla

EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
