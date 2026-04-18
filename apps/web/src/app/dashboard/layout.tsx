'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { NavSidebar } from './components/NavSidebar';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import api from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, user, stopImpersonation } = useAuthStore();
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const openDrawer  = useCallback(() => setIsDrawerOpen(true),  []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  usePushNotifications();

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
      {/* Impersonation banner */}
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

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-12 flex items-center justify-between px-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center text-white font-bold text-xs">
          VLA
        </div>
        <button
          onClick={openDrawer}
          aria-label="Abrir menú"
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Main layout row */}
      <div className="flex flex-1 overflow-hidden pt-12 md:pt-0">
        <NavSidebar isOpen={isDrawerOpen} onClose={closeDrawer} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
