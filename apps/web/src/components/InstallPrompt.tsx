'use client';

import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'vla-pwa-install-dismissed';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOS,       setShowIOS]         = useState(false);
  const [visible,       setVisible]         = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const ua         = navigator.userAgent;
    const isIOS      = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isStandalone = (window.navigator as any).standalone === true;

    if (isIOS && !isStandalone) {
      setShowIOS(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    const { outcome } = await (deferredPrompt as any).userChoice;
    if (outcome === 'accepted') dismiss();
    else setVisible(false); // banner consumed its one prompt() call — hide for the session
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-xl flex items-center gap-3 md:max-w-sm md:left-auto md:right-4">
      <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
        VLA
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
          Instalar VLA Office
        </p>
        {showIOS ? (
          <p className="text-xs text-gray-500 mt-0.5">
            Toca <strong>Compartir</strong> → <strong>Agregar a inicio</strong>
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-0.5">Disponible como app nativa</p>
        )}
      </div>

      {!showIOS && (
        <button
          onClick={install}
          className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap"
        >
          Instalar
        </button>
      )}

      <button
        onClick={dismiss}
        aria-label="Cerrar"
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 flex-shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
