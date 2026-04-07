'use client';

import { useAuthStore } from '@/stores/auth.store';

export default function WelcomePage() {
  const { user } = useAuthStore();

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center max-w-md px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 text-white text-2xl font-bold mb-6">
          VLA
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Bienvenido, {user?.firstName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No hay módulos activos disponibles en este momento. Contacta con el administrador del sistema para activar funcionalidades.
        </p>
      </div>
    </div>
  );
}
