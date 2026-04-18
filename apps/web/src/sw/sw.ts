import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting:     true,
  clientsClaim:    true,
  navigationPreload: true,

  runtimeCaching: [
    {
      matcher:  /^\/api\/v1\//,
      handler: 'NetworkFirst',
      options: {
        cacheName:            'vla-api-cache',
        networkTimeoutSeconds: 5,
        expiration:           { maxEntries: 60, maxAgeSeconds: 86400 },
        cacheableResponse:    { statuses: [0, 200] },
      },
    },
    {
      matcher:  /^\/api\/v1\/p\/.*\/ui\//,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName:  'vla-plugin-ui-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
      },
    },
    {
      matcher:  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName:  'vla-images-cache',
        expiration: { maxEntries: 60, maxAgeSeconds: 2592000 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    ...defaultCache,
  ],

  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }: { request: Request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  const { title, body, icon, url } = event.data.json() as {
    title: string; body: string; icon?: string; url?: string;
  };
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  icon  ?? '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data:  { url },
    }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url: string = event.notification.data?.url ?? '/dashboard';
  event.waitUntil(
    (self.clients as any).openWindow(url),
  );
});
