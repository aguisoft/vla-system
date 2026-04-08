'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { usePlugins, PluginRegistration } from '@/hooks/usePlugins';
import { cn } from '@/lib/utils';
import { UserRole } from '@vla/shared';

// Icon map — add entries here when registering new plugins
const PLUGIN_ICONS: Record<string, React.ReactNode> = {
  office: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  tasks: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  reports: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  default: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
};

function PluginLabel({ name }: { name: string; description: string }) {
  const labels: Record<string, string> = {
    'admin': 'Admin',
  };
  return labels[name] ?? name;
}

function NavItem({ plugin, active }: { plugin: PluginRegistration; active: boolean }) {
  const icon = PLUGIN_ICONS[plugin.icon] ?? PLUGIN_ICONS.default;
  return (
    <Link
      href={plugin.route}
      className={cn(
        'group relative flex flex-col items-center gap-1 px-2 py-3 rounded-xl transition-all w-full',
        active
          ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
          : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300',
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-green-500 rounded-r-full" />
      )}
      {icon}
      <span className="text-[10px] font-medium leading-tight text-center">
        <PluginLabel name={plugin.name} description={plugin.description} />
      </span>
    </Link>
  );
}

export function NavSidebar() {
  const allPlugins = usePlugins();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const isAdmin = user?.role === UserRole.ADMIN;
  const plugins = allPlugins.filter((p) => !p.adminOnly || isAdmin);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';

  return (
    <aside className="w-16 flex flex-col items-center py-3 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-shrink-0 z-20">
      {/* Logo */}
      <Link href="/dashboard" className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center text-white font-bold text-xs mb-4 flex-shrink-0 hover:bg-green-600 transition-colors">
        VLA
      </Link>

      {/* Plugin nav items */}
      <nav className="flex flex-col items-center gap-1 w-full px-1 flex-1">
        {plugins.map((plugin) => (
          <NavItem
            key={plugin.name}
            plugin={plugin}
            active={pathname.startsWith(plugin.route)}
          />
        ))}
      </nav>

      {/* Bottom: user + logout */}
      <div className="flex flex-col items-center gap-2 mt-2">
        <div
          title={user ? `${user.firstName} ${user.lastName}` : ''}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        >
          {initials}
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
