#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

echo "[entrypoint] Running production seed (idempotent — superadmin only)..."
NODE_ENV=production node apps/api/dist/prisma/seed.js

echo "[entrypoint] Starting VLA API..."
exec node apps/api/dist/main.js
