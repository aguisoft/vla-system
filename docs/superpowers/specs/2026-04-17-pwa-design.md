# PWA — VLA Virtual Office Implementation Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert VLA Virtual Office into a full PWA — installable, offline-capable (shell + cached data), and push-notification-enabled (leads, timeman, admin events).

**Architecture:** `@serwist/next` manages the service worker and Workbox caching. A new NestJS `PushModule` stores browser subscriptions (Prisma) and sends Web Push notifications via `web-push`. The frontend registers on first login via a `usePushNotifications` hook mounted in the root layout.

**Tech Stack:** `@serwist/next` v9, `web-push`, `sharp` (icon generation), Next.js 14 Metadata API, Prisma, NestJS.

---

## 1. Icons

Source: `/mnt/ssd_extra/Users/Carlos/Documents/Projects/vlaSystem/logovla.svg` — horizontal (785×451), contains geometric VLA letters + "ACADEMY" text below.

Generated files (script: `apps/web/scripts/generate-icons.mjs`):

| File | Size | Notes |
|---|---|---|
| `public/icons/icon-192.png` | 192×192 | White background, VLA letters cropped (viewBox `0 0 785.6 305`) |
| `public/icons/icon-512.png` | 512×512 | Same |
| `public/icons/icon-maskable-512.png` | 512×512 | 20% safe-zone padding for Android adaptive icons |

Script uses `sharp` to render SVG → PNG. Runs via `npm run generate-icons` before build. Not run automatically in `next build` to avoid CI overhead (icons committed to repo).

---

## 2. Web App Manifest

File: `apps/web/src/app/manifest.ts` (Next.js 14 Metadata API — auto-served at `/manifest.webmanifest`).

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VLA Virtual Office',
    short_name: 'VLA Office',
    description: 'Oficina virtual interactiva de VLA Academy',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#22c55e',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

`layout.tsx` adds `<meta name="theme-color" content="#22c55e">` and `<meta name="apple-mobile-web-app-capable" content="yes">` for iOS standalone support.

---

## 3. Service Worker — Caching

Library: `@serwist/next` v9 (successor of next-pwa, App Router compatible, Next.js 14 standalone output compatible).

### 3a. next.config.js change

Wrap config with `withSerwist({...})`. Service worker entry: `src/sw/sw.ts`. Output: `public/sw.js`.

### 3b. `apps/web/src/sw/sw.ts`

```ts
import { defaultCache } from '@serwist/next/worker';
import { installSerwist } from '@serwist/sw';
import { pushHandler } from './push-handler';

installSerwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // API data — NetworkFirst, 24h cache, fallback to cache on failure
    {
      matcher: /^\/api\/v1\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'vla-api-cache',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Plugin UI static assets — StaleWhileRevalidate
    {
      matcher: /^\/api\/v1\/p\/.*\/ui\//,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'vla-plugin-ui-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
      },
    },
    // Images/icons — CacheFirst 30 days
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'vla-images-cache',
        expiration: { maxEntries: 60, maxAgeSeconds: 2592000 },
      },
    },
    ...defaultCache,
  ],
  fallbacks: {
    document: '/offline',
  },
});

// Push notification handler
self.addEventListener('push', pushHandler);
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/dashboard';
  event.waitUntil(clients.openWindow(url));
});
```

### 3c. `apps/web/src/sw/push-handler.ts`

```ts
export function pushHandler(event: PushEvent): void {
  if (!event.data) return;
  const { title, body, icon, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon ?? '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    })
  );
}
```

---

## 4. Offline Page

File: `apps/web/src/app/offline/page.tsx` — static page, always pre-cached by serwist precache manifest.

Simple centered message: logo VLA + "Sin conexión" + "Los datos mostrados pueden ser de tu última sesión." No fetch, no API calls.

---

## 5. Install Prompt

File: `apps/web/src/components/InstallPrompt.tsx`

- Listens for `beforeinstallprompt` event (Chrome/Android/Desktop)
- Stores `deferredPrompt` in ref
- Shows dismissible banner at bottom of screen on first visit (after 3s delay)
- On dismiss: saves `pwa-install-dismissed=true` to `localStorage`, never shows again
- On "Instalar": calls `deferredPrompt.prompt()`
- iOS: detects `navigator.standalone === false` + Safari UA → shows static instructions banner ("Toca Compartir → Agregar a inicio")
- Mounted in `apps/web/src/app/dashboard/layout.tsx` (only shows when logged in)

---

## 6. Push Notifications — Frontend

### 6a. `apps/web/src/hooks/usePushNotifications.ts`

```ts
// Responsibilities:
// 1. Check Notification.permission
// 2. If 'default': request permission on first login (after 5s delay, one-time)
// 3. If 'granted': subscribe via PushManager using VAPID public key
// 4. POST subscription to /api/v1/push/subscribe
// 5. On logout: DELETE /api/v1/push/subscribe
```

- VAPID public key injected via `NEXT_PUBLIC_VAPID_PUBLIC_KEY` env var
- Subscription saved in API, not localStorage (survives re-login on same device)
- One-time permission prompt: tracks in `localStorage` key `push-permission-asked`

### 6b. Registration point

`usePushNotifications()` called in `apps/web/src/app/dashboard/layout.tsx` — runs once when user enters dashboard, handles all subscription logic internally.

---

## 7. Push Notifications — Backend

### 7a. Prisma schema addition

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Migration: `npx prisma migrate dev --name add_push_subscriptions`.

### 7b. `apps/api/src/core/push/` module

**`push.controller.ts`:**
- `POST /api/v1/push/subscribe` — authenticated, body: `{ endpoint, keys: { p256dh, auth } }` → upsert by endpoint
- `DELETE /api/v1/push/subscribe` — authenticated, body: `{ endpoint }` → delete

**`push.service.ts`:**
```ts
// Dependencies: PrismaService, web-push library
// VAPID configured in onModuleInit() from env vars

async sendToUser(userId: string, payload: PushPayload): Promise<void>
// Finds all subscriptions for userId
// Calls webpush.sendNotification() for each
// On 404/410 response from push server: deletes stale subscription

async sendToAdmins(payload: PushPayload): Promise<void>
// Finds all users with role='ADMIN', calls sendToUser for each

async sendToAll(payload: PushPayload): Promise<void>
// Fetches all subscriptions, sends to each
// Handles stale subscriptions same way

interface PushPayload {
  title: string;
  body: string;
  icon?: string;   // default: '/icons/icon-192.png'
  url?: string;    // where to navigate on click
}
```

**`push.module.ts`:** exports `PushService` so other modules can import it.

**`app.module.ts`:** imports `PushModule`.

### 7c. VAPID keys

Generate once:
```bash
npx web-push generate-vapid-keys
```

Add to `.env`:
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:caguinaga@grupovla.com
```

Add to `docker-compose.prod.yml` API environment and `.env.prod.example`.

---

## 8. Notification Triggers

### 8a. Plugin `dashboards` — cron `*/15 * * * *`

Already runs leads report. Add at end of cron:
- If new leads since last run (compare count stored in Redis) → `pushService.sendToAdmins({title: 'Nuevos leads', body: `${newCount} leads nuevos`, url: '/dashboard/dashboards'})`
- If new won deals → same pattern

Redis key `dashboards:last_lead_count` and `dashboards:last_deal_count` for delta tracking.

### 8b. Plugin `office` — timeman sync cron `*/5 * * * *`

Already syncs timeman status. Add:
- If user transitions `CLOSED→OPENED` (arrives) → `pushService.sendToAll({title: '${name} está en la oficina', body: 'Acaba de llegar', url: '/dashboard/office'})`
- If `OPENED→CLOSED` (leaves) → same pattern

Only send if more than 1 hour since last notification for that user (Redis TTL key `office:push:${userId}`).

### 8c. Plugin `admin` (core) — plugin upload endpoint

After successful plugin install → `pushService.sendToAdmins({title: 'Plugin instalado', body: '${pluginName} v${version}', url: '/dashboard/admin'})`.

---

## 9. Environment Variables Summary

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `apps/web/.env` | Exposed to browser |
| `VAPID_PUBLIC_KEY` | `apps/api/.env` | Same value as above |
| `VAPID_PRIVATE_KEY` | `apps/api/.env` | Never expose to browser |
| `VAPID_SUBJECT` | `apps/api/.env` | `mailto:caguinaga@grupovla.com` |

---

## 10. Files Created / Modified

| Action | Path |
|---|---|
| Create | `apps/web/scripts/generate-icons.mjs` |
| Create | `apps/web/public/icons/icon-192.png` |
| Create | `apps/web/public/icons/icon-512.png` |
| Create | `apps/web/public/icons/icon-maskable-512.png` |
| Create | `apps/web/src/app/manifest.ts` |
| Modify | `apps/web/next.config.js` |
| Create | `apps/web/src/sw/sw.ts` |
| Create | `apps/web/src/sw/push-handler.ts` |
| Create | `apps/web/src/app/offline/page.tsx` |
| Create | `apps/web/src/components/InstallPrompt.tsx` |
| Create | `apps/web/src/hooks/usePushNotifications.ts` |
| Modify | `apps/web/src/app/layout.tsx` |
| Modify | `apps/web/src/app/dashboard/layout.tsx` |
| Modify | `apps/web/package.json` |
| Create | `apps/api/src/core/push/push.module.ts` |
| Create | `apps/api/src/core/push/push.controller.ts` |
| Create | `apps/api/src/core/push/push.service.ts` |
| Modify | `apps/api/src/app.module.ts` |
| Modify | `apps/api/prisma/schema.prisma` |
| Create | `apps/api/prisma/migrations/..._add_push_subscriptions` |
| Modify | `apps/api/package.json` |
| Modify | `vla-system/docker-compose.prod.yml` |
| Modify | `.env.prod.example` |
| Modify | `apps/api/storage/plugins/dashboards/src/` (cron trigger) |
| Modify | `apps/api/storage/plugins/office/src/` (timeman trigger) |
| Modify | `apps/api/src/core/plugin-registry/` (admin trigger on upload) |
