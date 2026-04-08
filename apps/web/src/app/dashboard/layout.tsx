'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { NavSidebar } from './components/NavSidebar';
import api from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, user, setUser, stopImpersonation } = useAuthStore();
  const router = useRouter();

  async function handleStopImpersonation() {
    try {
      await stopImpersonation();
      router.push('/dashboard/admin');
    } catch {
      // fallback: force logout and re-login
      await api.post('/auth/logout').catch(() => {});
      router.push('/login');
    }
  }

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, _hasHydrated, router]);

  if (!_hasHydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      {user?.isImpersonated && (
        <div className="flex items-center justify-between px-6 py-2 bg-amber-500 text-white text-xs font-medium flex-shrink-0 z-50">
          <span>
            Estás viendo la plataforma como <strong>{user.firstName} {user.lastName}</strong> ({user.email})
          </span>
          <button
            onClick={handleStopImpersonation}
            className="ml-4 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors font-semibold whitespace-nowrap"
          >
            ← Volver a mi cuenta
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <NavSidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
