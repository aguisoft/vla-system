# VLA Plugin Development Guide

VLA is a **plugin-first platform**: every user-facing feature is a plugin.
The kernel only provides auth, users, the hook bus, and the plugin registry.
Everything else lives in plugins.

There are **two ways** to build a VLA plugin:

| | Internal plugin | External plugin (.vla.zip) |
|---|---|---|
| **Where** | `apps/api/src/modules/` | Any repo, uploaded via admin UI |
| **API** | Full NestJS module | `@vla/plugin-sdk` PluginDefinition |
| **Install** | Add to AppModule + redeploy | Upload zip → auto restart |
| **Power** | Full NestJS (DI, guards, etc.) | Full Prisma + Redis + Hooks + Cron |
| **Best for** | Core team features | Third-party / customer plugins |

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [How plugins work](#2-how-plugins-work)
3. [Creating an internal plugin (NestJS module)](#3-creating-an-internal-plugin-nestjs-module)
4. [Creating an external plugin (.vla.zip)](#4-creating-an-external-plugin-vlazip)
5. [Hook system reference](#5-hook-system-reference)
6. [Available core hooks](#6-available-core-hooks)
7. [Available office plugin hooks](#7-available-office-plugin-hooks)
8. [Plugin lifecycle](#8-plugin-lifecycle)
9. [Plugin configuration](#9-plugin-configuration)
10. [Frontend integration](#10-frontend-integration)
11. [REST API reference](#11-rest-api-reference)

---

## 1. Architecture overview

```
┌──────────────────────────────────────────────────────────────┐
│                        VLA Kernel                            │
│  PrismaModule · RedisModule · HookModule                     │
│  AuthModule · UsersModule                                    │
│  PluginRegistryModule · PluginLoaderModule                   │
└────────────┬──────────────────────┬───────────────────────────┘
             │                      │
   (internal NestJS modules)  (external .vla.zip plugins)
       ┌─────┼─────┐             scanned from storage/plugins/
       ▼     ▼     ▼                  at server startup
  [office] [admin] [your-module]       ▼
   module  module    module     [uploaded-plugin]
```

**Internal plugins** are NestJS modules in `apps/api/src/modules/` — full power,
imported in `AppModule`, deployed with the codebase.

**External plugins** are `.vla.zip` packages uploaded via the admin UI and extracted
to `storage/plugins/`. They export a `PluginDefinition` object (from `@vla/plugin-sdk`)
and are loaded dynamically by `PluginLoaderModule` on every server start.

---

## 2. How plugins work

### Registration flow

1. Plugin module calls `pluginRegistry.register(pluginDefinition)` in `onModuleInit()`.
2. Registry upserts the plugin record in the `core.plugins` DB table.
3. If it's the first install, `onInstall()` then `onActivate()` are called.
4. On subsequent boots, `onActivate()` is called only if the plugin is active.

### Communication between plugins

Plugins **never import each other's services directly**.
They communicate exclusively through the hook bus:

- **Actions** — fire-and-forget notifications (`doAction`)
- **Filters** — data-transformation chains (`applyFilter`)

This keeps coupling zero: a plugin can be disabled without breaking others.

---

## 3. Creating an internal plugin (NestJS module)

### Step 1 — Create the module folder

```
apps/api/src/modules/my-plugin/
├── my-plugin.module.ts       ← NestJS module + registration
├── my-plugin.service.ts      ← Business logic
├── my-plugin.controller.ts   ← REST endpoints
├── my-plugin.hooks.ts        ← Hook name constants
└── dto/
    └── ...
```

### Step 2 — Declare your hook constants (`my-plugin.hooks.ts`)

```typescript
export const MY_PLUGIN_HOOKS = {
  /** Payload: { itemId, userId } */
  ITEM_CREATED: 'my-plugin.item.created',
  /** Payload: { itemId } */
  ITEM_DELETED: 'my-plugin.item.deleted',
} as const;
```

### Step 3 — Write the service (`my-plugin.service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { HookService } from '../../core/hooks/hook.service';
import { MY_PLUGIN_HOOKS } from './my-plugin.hooks';

@Injectable()
export class MyPluginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hooks: HookService,
  ) {}

  async createItem(userId: string, data: any) {
    // ... your DB logic here ...
    const item = { id: '123', ...data };

    // Fire the action — any plugin can react to this
    await this.hooks.doAction(MY_PLUGIN_HOOKS.ITEM_CREATED, { itemId: item.id, userId });

    return item;
  }
}
```

### Step 4 — Write the module (`my-plugin.module.ts`)

```typescript
import { Module, OnModuleInit } from '@nestjs/common';
import { PluginRegistryService } from '../../core/plugin-registry/plugin-registry.service';
import { HookService } from '../../core/hooks/hook.service';
import { MyPluginService } from './my-plugin.service';
import { MyPluginController } from './my-plugin.controller';
import { MY_PLUGIN_HOOKS } from './my-plugin.hooks';
import { CORE_HOOKS } from '../../core/hooks/hook.constants';

@Module({
  controllers: [MyPluginController],
  providers: [MyPluginService],
  exports: [MyPluginService],
})
export class MyPluginModule implements OnModuleInit {
  constructor(
    private readonly pluginRegistry: PluginRegistryService,
    private readonly hooks: HookService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pluginRegistry.register({
      name: 'my-plugin',
      version: '1.0.0',
      description: 'My awesome plugin',
      route: '/dashboard/my-plugin',
      icon: 'star',
      dependencies: [],            // other plugin names required

      onActivate: async () => {
        // Called on every boot (if active) and on manual activate
        this.registerHooks();
      },

      onDeactivate: async () => {
        // Called on manual deactivate
        // Clean up resources, cancel scheduled jobs, etc.
      },
    });

    this.registerHooks();
  }

  private registerHooks(): void {
    // React to a core event
    this.hooks.registerAction(
      CORE_HOOKS.USER_CREATED,
      async ({ user }) => {
        // Do something when a new user is created
      },
      { pluginName: 'my-plugin', priority: 10 },
    );

    // React to an office event
    this.hooks.registerAction(
      'office.user.checked_in',
      async ({ userId }) => {
        // Do something when someone enters the office
      },
      { pluginName: 'my-plugin', priority: 10 },
    );

    // Declare hooks this plugin emits (for introspection at GET /plugins/hooks)
    Object.values(MY_PLUGIN_HOOKS).forEach((hookName) => {
      this.hooks.registerAction(hookName, async () => {}, {
        pluginName: 'my-plugin',
        priority: 999,
      });
    });
  }
}
```

### Step 5 — Register in AppModule

```typescript
// apps/api/src/app.module.ts
import { MyPluginModule } from './modules/my-plugin/my-plugin.module';

@Module({
  imports: [
    // ... existing imports ...
    MyPluginModule,   // ← add here
  ],
})
export class AppModule {}
```

That's it. On next boot the plugin is registered, its row is created in the DB,
and its hooks are live.

---

## 4. Creating an external plugin (.vla.zip)

External plugins use the `@vla/plugin-sdk` package and are uploaded at runtime
without changing the core codebase.

### Step 1 — Bootstrap the project

```bash
mkdir my-vla-plugin && cd my-vla-plugin
npm init -y
npm install --save-dev typescript @vla/plugin-sdk
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

### Step 2 — Write the manifest (`plugin.json`)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What my plugin does",
  "author": "Your Name",
  "vlaMinVersion": "1.0.0",
  "route": "/dashboard/my-plugin",
  "icon": "star",
  "adminOnly": false,
  "permissions": ["read:users"],
  "hooks": {
    "listens": ["office.user.checked_in"],
    "emits":   ["my-plugin.item.created"]
  }
}
```

**Permissions** control which Prisma models are available via `ctx.prisma`.
Declare only what you need — the runtime enforces this.

| Permission | Access granted |
|---|---|
| `read:users` | `ctx.prisma.user.findMany` etc. |
| `write:users` | `ctx.prisma.user.update` etc. |
| `read:presence` | `ctx.prisma.presenceStatus.findMany` etc. |
| `write:presence` | `ctx.prisma.presenceStatus.update` etc. |
| `read:checkins` | `ctx.prisma.checkInRecord.findMany` etc. |
| `write:checkins` | `ctx.prisma.checkInRecord.create` etc. |

### Step 3 — Implement `src/index.ts`

```typescript
import type { PluginDefinition } from '@vla/plugin-sdk';

const plugin: PluginDefinition = {
  async register(ctx) {
    ctx.logger.log('Hello from my-plugin!');

    // ── REST routes ──────────────────────────────────────────────────────────
    ctx.router.get('/hello', ctx.requireAuth(), (req, res) => {
      res.json({ hello: 'world', user: (req as any).user });
    });

    ctx.router.get('/users', ctx.requireAuth('ADMIN'), async (_req, res) => {
      const users = await ctx.prisma.user.findMany({ take: 10 });
      res.json(users);
    });

    // ── Hook listeners ────────────────────────────────────────────────────────
    ctx.hooks.registerAction('office.user.checked_in', async ({ userId }) => {
      ctx.logger.log(`User ${userId} just checked in`);
      await ctx.redis.setJson('lastCheckin', { userId, at: new Date() }, 300);
    });

    // ── Cron jobs ──────────────────────────────────────────────────────────────
    ctx.cron('0 9 * * 1-5', async () => {
      ctx.logger.log('Monday-Friday 9am job running');
    });
  },

  async onDeactivate() {
    // Clean up resources here
  },
};

export default plugin;
```

> Routes are mounted at `/api/v1/p/my-plugin/`. The example above creates:
> - `GET /api/v1/p/my-plugin/hello`
> - `GET /api/v1/p/my-plugin/users`

### Step 4 — Build and package

```bash
npx tsc                    # compiles src/ → dist/
zip -r my-plugin.vla.zip plugin.json dist/
```

The zip **must** contain at the root level:
- `plugin.json` — manifest
- `dist/index.js` — compiled entry point (CommonJS)

### Step 5 — Upload

Go to **Admin → Módulos** in the VLA dashboard, click **Seleccionar .vla.zip**,
and upload your package. The server will:
1. Validate the manifest and zip contents
2. Extract the package to `storage/plugins/my-plugin/`
3. Perform a graceful restart (process exits with code 0; PM2/Docker restarts it)
4. On next boot, `PluginLoaderModule` discovers and loads the plugin automatically

### PluginContext reference

The `ctx` object passed to `register()` provides:

| Property | Type | Description |
|---|---|---|
| `ctx.router` | `express.Router` | Mount HTTP routes here |
| `ctx.hooks` | `PluginHookService` | Register/emit actions and filters |
| `ctx.prisma` | `PrismaClient` | DB access (permission-gated at runtime) |
| `ctx.redis` | `PluginRedisClient` | Namespaced Redis (`plugin:name:*`) |
| `ctx.logger` | Logger | Prefixed logger `[my-plugin]` |
| `ctx.cron(expr, fn)` | `void` | Create a cron job (auto-cleaned on deactivate) |
| `ctx.requireAuth(role?)` | Middleware | JWT auth + optional role check |
| `ctx.plugin.name` | `string` | Plugin name |
| `ctx.plugin.version` | `string` | Plugin version |
| `ctx.plugin.config` | `Record` | DB-stored configuration |

---

## 5. Hook system reference

> These apply to both internal (NestJS) and external (SDK) plugins.
> Internal plugins use `HookService` directly; external plugins use `ctx.hooks`.

### Actions — `doAction` / `registerAction`

Use for **one-way notifications**. The emitter does not receive a return value.

```typescript
// Emitting
await this.hooks.doAction('my-plugin.item.created', { itemId, userId });

// Listening
this.hooks.registerAction(
  'my-plugin.item.created',
  async (payload: { itemId: string; userId: string }) => {
    await sendNotification(payload.userId);
  },
  { pluginName: 'notifications', priority: 10 },
);
```

### Filters — `HookService.applyFilter` / `registerFilter`

Use when you need to **transform data** as it passes through.
Each listener receives the current value and must return it (modified or not).

```typescript
// Emitting (in the producer)
const enrichedUser = await this.hooks.applyFilter(CORE_HOOKS.USER_SERIALIZE, rawUser);

// Listening (in your plugin)
this.hooks.registerFilter(
  'core.user.serialize',
  async (user) => ({
    ...user,
    displayName: `${user.firstName} ${user.lastName}`,
  }),
  { pluginName: 'profile', priority: 10 },
);
```

### Priority

Lower numbers run first (like WordPress). Default is `10`.
Use `1` for critical setup, `50`+ for decorators, `999` for no-ops.

| Range | Use case |
|---|---|
| 1–5 | Critical / security hooks |
| 10 | Default |
| 20–50 | Decorators, enrichment |
| 100+ | Logging, analytics |
| 999 | No-ops / hook declaration markers |

---

## 6. Available core hooks

Import from `../../core/hooks/hook.constants` (backend) or `@vla/shared` (shared).

| Constant | String key | Type | Payload |
|---|---|---|---|
| `CORE_HOOKS.USER_CREATED` | `core.user.created` | Action | `{ user }` |
| `CORE_HOOKS.USER_UPDATED` | `core.user.updated` | Action | `{ userId, changes }` |
| `CORE_HOOKS.USER_SERIALIZE` | `core.user.serialize` | Filter | `user` object |
| `CORE_HOOKS.AUTH_LOGIN` | `core.auth.login` | Action | `{ user, token }` |
| `CORE_HOOKS.AUTH_GOOGLE_LOGIN` | `core.auth.google_login` | Action | `{ user, isNew }` |
| `CORE_HOOKS.PLUGIN_ACTIVATED` | `core.plugin.activated` | Action | `{ pluginName }` |
| `CORE_HOOKS.PLUGIN_DEACTIVATED` | `core.plugin.deactivated` | Action | `{ pluginName }` |

---

## 7. Available office plugin hooks

Import from `../../modules/virtual-office/office.hooks` (backend) or use the
string keys directly via `VLA_HOOKS` in `@vla/shared`.

| Constant | String key | Type | Payload |
|---|---|---|---|
| `OFFICE_HOOKS.USER_CHECKED_IN` | `office.user.checked_in` | Action | `{ userId, user, source }` |
| `OFFICE_HOOKS.USER_CHECKED_OUT` | `office.user.checked_out` | Action | `{ userId }` |
| `OFFICE_HOOKS.USER_STATUS_CHANGED` | `office.user.status_changed` | Action | `{ userId, status }` |
| `OFFICE_HOOKS.USER_MOVED` | `office.user.moved` | Action | `{ userId, zoneId, positionX, positionY }` |

---

## 8. Plugin lifecycle

```
         install ──▶ onInstall()
                         │
                     DB row created (isActive=true)
                         │
         boot ───▶ onActivate()   ◀─── POST /plugins/:name/activate
                         │
                     plugin running
                         │
                     onDeactivate() ◀── POST /plugins/:name/deactivate
                         │
                     isActive=false (row kept in DB)
                         │
                     onActivate() again on re-enable
```

Lifecycle callbacks are **always called with a safety wrapper** — if they throw,
the error is logged but does not crash the application.

---

## 9. Plugin configuration

Plugins can store arbitrary JSON configuration in the DB:

```bash
# Admin only
PATCH /api/v1/plugins/my-plugin/config
Content-Type: application/json

{ "config": { "maxItems": 100, "enableNotifications": true } }
```

Read it back in your service:

```typescript
// The config is available via PluginRegistryService
const registration = await this.pluginRegistry.getAll();
const myConfig = registration.find(p => p.name === 'my-plugin')?.config;
```

---

## 10. Frontend integration

### Discovering installed plugins

```typescript
// apps/web/src/hooks/usePlugins.ts already exists
const plugins = usePlugins(); // returns PluginSummary[]
```

### Adding a plugin page

1. Create `apps/web/app/dashboard/my-plugin/page.tsx`.
2. The sidebar nav reads the plugin list from `GET /plugins` and renders links
   automatically using the `route` and `icon` fields.

### Listening to hooks from the frontend (WebSocket)

The office gateway broadcasts WebSocket events that map 1:1 to hook payloads.
If your plugin emits hooks, add corresponding socket emissions in your gateway:

```typescript
// In your WebSocket gateway
@SubscribeMessage('my-plugin:event')
async handleEvent(@ConnectedSocket() client: Socket) {
  // ...
  this.server.emit('my-plugin:broadcast', payload);
}
```

---

## 11. REST API reference

### Plugin management (admin only)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/plugins` | List active plugins (all authenticated users) |
| `GET` | `/api/v1/plugins/all` | List all plugins incl. inactive (admin) |
| `GET` | `/api/v1/plugins/hooks` | List all registered hook names (admin) |
| `POST` | `/api/v1/plugins/upload` | Upload a `.vla.zip` plugin package (admin) |
| `POST` | `/api/v1/plugins/:name/activate` | Activate a plugin (admin) |
| `POST` | `/api/v1/plugins/:name/deactivate` | Deactivate a plugin (admin) |
| `PATCH` | `/api/v1/plugins/:name/config` | Update plugin config (admin) |

Full Swagger docs available at `http://localhost:3001/api/docs` when running locally.

---

## Quick checklist — internal plugin (NestJS module)

- [ ] Created folder in `apps/api/src/modules/my-plugin/`
- [ ] Declared hook constants in `my-plugin.hooks.ts`
- [ ] Module calls `pluginRegistry.register()` in `onModuleInit()`
- [ ] Services emit hooks via `hookService.doAction()` (never EventEmitter directly)
- [ ] Hook listeners registered in module (not in service constructors)
- [ ] Module added to `AppModule` imports
- [ ] Frontend route matches the `route` field in the registration
- [ ] Tested activate/deactivate lifecycle via `POST /plugins/:name/activate`

## Quick checklist — external plugin (.vla.zip)

- [ ] `plugin.json` contains all required fields (`name`, `version`, `description`, `author`, `vlaMinVersion`, `permissions`)
- [ ] `name` is kebab-case (e.g. `my-plugin`)
- [ ] `vlaMinVersion` is `<= 1.0.0` (current core version)
- [ ] `src/index.ts` exports a `PluginDefinition` as default
- [ ] All routes are mounted on `ctx.router` (not a standalone Express app)
- [ ] `ctx.requireAuth()` used on protected routes
- [ ] `tsc` compiles without errors → `dist/index.js` exists
- [ ] Zip created with `plugin.json` and `dist/` at the root
- [ ] Uploaded via Admin → Módulos → server restarts and loads the plugin
