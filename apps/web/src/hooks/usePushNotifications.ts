'use client';

import { useEffect } from 'react';
import api from '@/lib/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const ASKED_KEY = 'vla-push-asked';

export function usePushNotifications() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (localStorage.getItem(ASKED_KEY)) return;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return;

    const timer = setTimeout(async () => {
      try {
        const permission = await Notification.requestPermission();
        localStorage.setItem(ASKED_KEY, '1'); // mark asked regardless of outcome

        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
        });

        const json = subscription.toJSON() as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        };

        await api.post('/push/subscribe', {
          endpoint: json.endpoint,
          keys:     json.keys,
        });
      } catch (err) {
        console.error('[Push] Subscription failed:', err);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);
}
