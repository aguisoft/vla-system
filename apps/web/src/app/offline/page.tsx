export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 p-8">
      <div className="w-16 h-16 rounded-2xl bg-green-500 flex items-center justify-center text-white font-bold text-xl">
        VLA
      </div>
      <div className="text-center max-w-sm">
        <h1 className="text-lg font-semibold text-gray-800 mb-2">Sin conexión</h1>
        <p className="text-sm text-gray-500">
          No hay conexión a internet. Los datos mostrados pueden ser de tu última sesión.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728" />
        </svg>
        Reconectando automáticamente…
      </div>
    </div>
  );
}
