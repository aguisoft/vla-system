# VLA System

Plugin-first platform for teams. Upload any feature as a `.vla.zip` plugin — no redeploy needed.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VLA Kernel                           │
│  Auth · Users · Hooks · Plugin Registry · Plugin Loader     │
│  Prisma · Redis · Admin Panel                               │
└───────────────┬─────────────────────────────────────────────┘
                │
     ┌──────────┼──────────┐
     ▼          ▼          ▼
  [plugin A] [plugin B] [plugin C]    ← .vla.zip packages
  uploaded    uploaded    uploaded       via admin panel
```

**The kernel** provides:
- JWT + Google OAuth authentication
- User management with roles (ADMIN / STAFF / PROFESSOR / STUDENT)
- Hook bus (actions + filters) for inter-plugin communication
- Plugin registry — DB-backed, activate/deactivate without restart
- Plugin loader — scans `storage/plugins/` at boot, mounts each plugin's Express router
- Admin panel (users + plugin management + upload)
- Redis and Prisma with multi-schema support

**Plugins** add every domain feature. See [vla-plugin-office](https://github.com/aguisoft/vla-plugin-office) for a production example.

## Stack

| Layer | Technology |
|---|---|
| API | NestJS 10, TypeScript, Passport.js |
| Database | PostgreSQL (multi-schema via Prisma) |
| Cache | Redis (ioredis) |
| Real-time | Socket.IO |
| Frontend | Next.js 14 (App Router), Tailwind CSS, Zustand |
| Plugin SDK | `@vla/plugin-sdk` (bundled in this repo) |

## Quick start

### Prerequisites

- Node.js 18+
- Docker (for Postgres + Redis) or running instances

### 1. Clone and install

```bash
git clone https://github.com/aguisoft/vla-system.git
cd vla-system
npm install
```

### 2. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit apps/api/.env with your Postgres and Redis credentials
```

### 3. Start infrastructure

```bash
docker compose up -d
```

### 4. Run database migrations and seed

```bash
npm run db:push -w @vla/api
npm run db:seed -w @vla/api
# Creates default admin: admin@vla.com / admin123
```

### 5. Start development servers

```bash
# API (port 3001)
npm run dev -w @vla/api

# Frontend (port 3000) — in a new terminal
npm run dev -w @vla/web
```

Open [http://localhost:3000](http://localhost:3000) and log in with `admin@vla.com` / `admin123`.

Swagger docs: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

## Installing plugins

1. Go to **Admin → Módulos → Seleccionar .vla.zip**
2. Upload any `.vla.zip` plugin package
3. The server restarts automatically and loads the plugin

See [vla-plugin-template](https://github.com/aguisoft/vla-plugin-template) to build your own plugin.

## Project structure

```
vla-system/
├── apps/
│   ├── api/                          # NestJS backend
│   │   ├── prisma/                   # Schema + migrations + seed
│   │   ├── src/
│   │   │   ├── core/
│   │   │   │   ├── auth/             # JWT + Google OAuth
│   │   │   │   ├── hooks/            # Hook bus (HookService)
│   │   │   │   ├── plugin-loader/    # Dynamic plugin loading
│   │   │   │   ├── plugin-registry/  # DB-backed registry + upload endpoint
│   │   │   │   ├── prisma/
│   │   │   │   ├── redis/
│   │   │   │   └── users/
│   │   │   └── modules/
│   │   │       └── admin/            # User + plugin management
│   │   └── storage/
│   │       └── plugins/              # Installed plugin packages live here
│   └── web/                          # Next.js frontend
│       └── src/app/
│           ├── dashboard/
│           │   ├── admin/            # Admin panel
│           │   └── components/       # NavSidebar (dynamic plugin links)
│           └── login/
├── packages/
│   ├── plugin-sdk/                   # @vla/plugin-sdk — types for plugin devs
│   └── shared/                       # Shared types (frontend + backend)
└── PLUGIN_DEVELOPMENT.md             # Full plugin development guide
```

## Hook system

Plugins communicate exclusively through the hook bus — never by importing each other's services.

```typescript
// Emit an action (fire-and-forget)
await ctx.hooks.doAction('my-plugin.something.happened', { id, userId });

// Listen to an action
ctx.hooks.registerAction('core.user.created', async ({ user }) => { ... });

// Apply a filter (transform data through a chain of handlers)
const enriched = await ctx.hooks.applyFilter('core.user.serialize', rawUser);
```

### Core hooks

| Hook | Type | Payload |
|---|---|---|
| `core.user.created` | Action | `{ user }` |
| `core.user.updated` | Action | `{ userId, changes }` |
| `core.user.serialize` | Filter | `user` object |
| `core.auth.login` | Action | `{ user, token }` |
| `core.plugin.activated` | Action | `{ pluginName }` |
| `core.plugin.deactivated` | Action | `{ pluginName }` |

## Plugin SDK

The SDK is available at `packages/plugin-sdk/` and bundled inside [vla-plugin-template](https://github.com/aguisoft/vla-plugin-template).

```typescript
import type { PluginDefinition } from '@vla/plugin-sdk';

const plugin: PluginDefinition = {
  async register(ctx) {
    ctx.router.get('/hello', ctx.requireAuth(), (req, res) => {
      res.json({ ok: true });
    });
  },
};

export default plugin;
```

## Building a plugin

See [vla-plugin-template](https://github.com/aguisoft/vla-plugin-template) — a ready-to-use starter with examples of all SDK features.

See [vla-plugin-office](https://github.com/aguisoft/vla-plugin-office) — a production plugin showing real-time presence, Bitrix24 integration, cron jobs, and hooks.

## License

MIT
