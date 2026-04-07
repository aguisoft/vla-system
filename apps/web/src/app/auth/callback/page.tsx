'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');

    if (!token || !userParam) {
      router.replace('/login?error=oauth_failed');
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userParam));
      localStorage.setItem('vla_token', token);
      setUser(user, token);
      router.replace('/dashboard/office');
    } catch {
      router.replace('/login?error=oauth_failed');
    }
  }, [searchParams, router, setUser]);

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
