'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { usePlugins } from '@/hooks/usePlugins';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { UserRole } from '@vla/shared';

interface FullPlugin {
  name: string;
  version: string;
  description: string;
  route?: string;
  icon?: string;
  adminOnly: boolean;
  isActive: boolean;
  installedAt: string;
}

type Tab = 'users' | 'plugins' | 'system';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  bitrixMapping: { bitrixUserId: number } | null;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  STAFF: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PROFESSOR: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  STUDENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const plugins = usePlugins();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Plugins tab state
  const [allPlugins, setAllPlugins] = useState<FullPlugin[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [togglingPlugin, setTogglingPlugin] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guard: admin only
  useEffect(() => {
    if (user && user.role !== UserRole.ADMIN) router.replace('/dashboard/welcome');
  }, [user, router]);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'plugins') loadAllPlugins();
  }, [tab]);

  async function loadAllPlugins() {
    setLoadingPlugins(true);
    try {
      const res = await api.get('/plugins/all');
      setAllPlugins(res.data);
    } finally {
      setLoadingPlugins(false);
    }
  }

  async function togglePlugin(p: FullPlugin) {
    setTogglingPlugin(p.name);
    try {
      const endpoint = p.isActive ? `/plugins/${p.name}/deactivate` : `/plugins/${p.name}/activate`;
      await api.post(endpoint);
      setAllPlugins((prev) => prev.map((x) => x.name === p.name ? { ...x, isActive: !p.isActive } : x));
    } finally {
      setTogglingPlugin(null);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/plugins/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadMsg({ ok: true, text: res.data.message });
    } catch (err: any) {
      setUploadMsg({ ok: false, text: err?.response?.data?.message ?? 'Error al subir el plugin' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function toggleActive(u: User) {
    await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
  }

  async function saveRole(id: string) {
    setSaving(true);
    try {
      await api.patch(`/users/${id}`, { role: editRole });
      setUsers((prev) => prev.map((x) => x.id === id ? { ...x, role: editRole } : x));
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  const filtered = users.filter((u) =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Usuarios' },
    { key: 'plugins', label: 'Módulos' },
    { key: 'system', label: 'Sistema' },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div>
          <h1 className="font-bold text-gray-900 dark:text-white text-base">Panel de Administración</h1>
          <p className="text-xs text-gray-400">Gestión del sistema VLA</p>
        </div>
        <div className="flex items-center gap-1 ml-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                tab === t.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <input
                type="text"
                placeholder="Buscar usuario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 w-72"
              />
              <span className="text-xs text-gray-400">{filtered.length} usuarios</span>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Nombre</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Rol</th>
                      <th className="px-4 py-3 text-left">Bitrix</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id} className={cn(
                        'border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors',
                        !u.isActive && 'opacity-50',
                      )}>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {u.firstName} {u.lastName}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          {editingId === u.id ? (
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value)}
                              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                              {Object.values(UserRole).map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600')}>
                              {u.role}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {u.bitrixMapping ? `#${u.bitrixMapping.bitrixUserId}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                            u.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500')}>
                            {u.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {editingId === u.id ? (
                              <>
                                <button
                                  onClick={() => saveRole(u.id)}
                                  disabled={saving}
                                  className="px-2 py-1 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs disabled:opacity-60"
                                >
                                  {saving ? '...' : 'Guardar'}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => { setEditingId(u.id); setEditRole(u.role); }}
                                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                  Rol
                                </button>
                                <button
                                  onClick={() => toggleActive(u)}
                                  disabled={u.id === user?.id}
                                  title={u.id === user?.id ? 'No puedes desactivar tu propia cuenta' : ''}
                                  className={cn(
                                    'px-2 py-1 rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed',
                                    u.isActive
                                      ? 'border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                      : 'border border-green-200 dark:border-green-800 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20',
                                  )}
                                >
                                  {u.isActive ? 'Desactivar' : 'Activar'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── PLUGINS TAB ── */}
        {tab === 'plugins' && (
          <div className="max-w-3xl mx-auto space-y-4">

            {/* Upload card */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Instalar plugin externo</p>
              <p className="text-xs text-gray-400 mb-3">Sube un archivo <code className="font-mono">.vla.zip</code> que contenga <code className="font-mono">plugin.json</code> y <code className="font-mono">dist/index.js</code>. El servidor reiniciará automáticamente.</p>
              <div className="flex items-center gap-3">
                <label className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors',
                  uploading
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white',
                )}>
                  {uploading ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Subiendo...</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Seleccionar .vla.zip</>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    disabled={uploading}
                    onChange={handleUpload}
                  />
                </label>
                {uploadMsg && (
                  <span className={cn('text-xs px-3 py-1.5 rounded-lg', uploadMsg.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400')}>
                    {uploadMsg.text}
                  </span>
                )}
              </div>
            </div>

            {/* Plugin list */}
            {loadingPlugins ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              allPlugins.map((p) => (
                <div key={p.name} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{p.name}</span>
                      <span className="text-xs text-gray-400 font-mono">v{p.version}</span>
                      {p.adminOnly && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium">Admin</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.description}</p>
                    {p.route && <p className="text-xs text-gray-400 font-mono mt-0.5">{p.route}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                      p.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')}>
                      {p.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                    <button
                      onClick={() => togglePlugin(p)}
                      disabled={togglingPlugin === p.name}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50',
                        p.isActive
                          ? 'border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : 'border border-green-200 dark:border-green-800 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20',
                      )}
                    >
                      {togglingPlugin === p.name ? '...' : p.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── SYSTEM TAB ── */}
        {tab === 'system' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Plataforma', value: 'VLA System' },
                { label: 'Módulos activos', value: String(plugins.length) },
                { label: 'Total usuarios', value: String(users.length || '—') },
                { label: 'Usuarios activos', value: String(users.filter((u) => u.isActive).length || '—') },
                { label: 'Integración Bitrix24', value: 'Conectado' },
                { label: 'WebSocket', value: 'Socket.IO' },
              ].map((item) => (
                <div key={item.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                  <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Stack técnico</p>
              <div className="flex flex-wrap gap-2">
                {['NestJS', 'Next.js', 'PostgreSQL', 'Redis', 'Prisma', 'Socket.IO', 'Passport.js', 'Google OAuth'].map((tech) => (
                  <span key={tech} className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 font-medium">
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Desarrollar e instalar un plugin</p>
              <ol className="text-xs text-amber-600 dark:text-amber-500 space-y-1 list-decimal list-inside">
                <li>Crear proyecto con <code className="font-mono">npm init</code> e instalar <code className="font-mono">@vla/plugin-sdk</code></li>
                <li>Implementar <code className="font-mono">PluginDefinition</code> con <code className="font-mono">register(ctx)</code> y exportar como default</li>
                <li>Añadir <code className="font-mono">plugin.json</code> con el manifiesto del plugin</li>
                <li>Compilar con <code className="font-mono">tsc</code> → genera <code className="font-mono">dist/index.js</code></li>
                <li>Empaquetar: <code className="font-mono">zip -r mi-plugin.vla.zip plugin.json dist/</code></li>
                <li>Subir desde la pestaña <strong>Módulos</strong> → el servidor reinicia automáticamente</li>
              </ol>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
