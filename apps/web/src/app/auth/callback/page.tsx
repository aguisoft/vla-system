'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  useEffect(() => {
    // Cookie was already set by the server during the OAuth redirect.
    // Just fetch the current user to hydrate the store.
    api
      .get('/auth/me')
      .then(({ data }) => {
        const user = data.user ?? data;
        setUser(user);
        router.replace(user.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/welcome');
      })
      .catch(() => {
        router.replace('/login?error=oauth_failed');
      });
  }, [router, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 text-white text-2xl font-bold mb-4">
          VLA
        </div>
        <p className="text-gray-600 mt-2">Iniciando sesión...</p>
      </div>
    </div>
  );
}
