'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import type { PluginRegistration } from '@/hooks/usePlugins';

export default function PluginFallbackPage() {
  const { plugin: pluginName } = useParams<{ plugin: string }>();
  const [plugin, setPlugin] = useState<PluginRegistration | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get('/plugins')
      .then((res) => {
        const found = (res.data as PluginRegistration[]).find(
          (p) => p.name === pluginName || p.route === `/dashboard/${pluginName}`,
        );
        if (found) setPlugin(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [pluginName]);

  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950 p-8">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Plugin no encontrado</p>
          <p className="text-xs text-gray-400 mt-1">
            No existe ningún plugin registrado en <code className="font-mono">/dashboard/{pluginName}</code>
          </p>
        </div>
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Plugin has a bundled frontend — render it fullscreen in an iframe
  if (plugin.hasFrontend) {
    return (
      <iframe
        src={`/api/v1/p/${plugin.name}/ui/`}
        className="flex-1 w-full border-0"
        style={{ height: '100%' }}
        title={plugin.name}
        allow="same-origin"
      />
    );
  }

  // Backend-only plugin — show informational placeholder
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-gray-50 dark:bg-gray-950 p-8">
      <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>

      <div className="text-center max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-1">
          <p className="text-base font-semibold text-gray-800 dark:text-gray-100 capitalize">{plugin.name}</p>
          <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
            v{plugin.version}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{plugin.description}</p>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-left">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
            Plugin solo-backend activo
          </p>
          <p className="text-xs text-blue-600/80 dark:text-blue-500/80">
            Para incluir una UI, agrega una carpeta <code className="font-mono">frontend/</code> al plugin
            con un build de Vite. El core la servirá automáticamente al subir el zip.
          </p>
        </div>

        <p className="text-[11px] text-gray-400 mt-4">
          API disponible en{' '}
          <code className="font-mono text-gray-500">/api/v1/p/{plugin.name}/</code>
        </p>
      </div>
    </div>
  );
}
