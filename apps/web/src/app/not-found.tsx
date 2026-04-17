import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 text-white text-2xl font-bold mb-6">
          VLA
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">404</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Página no encontrada</p>
        <Link
          href="/login"
          className="inline-flex items-center px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
