#!/bin/sh
set -e

echo "[entrypoint] Applying database schema..."
npx prisma db push --schema=apps/api/prisma/schema.prisma --skip-generate --accept-data-loss=false

echo "[entrypoint] Starting VLA API..."
exec node apps/api/dist/main.js
