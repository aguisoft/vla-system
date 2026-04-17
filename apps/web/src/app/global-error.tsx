'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center px-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 text-white text-2xl font-bold mb-6">
              VLA
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">500</h1>
            <p className="text-gray-500 mb-6">Error interno del servidor</p>
            <button
              onClick={reset}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
