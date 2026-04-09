'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { usePlugins } from '@/hooks/usePlugins';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { UserRole, PresetRole } from '@vla/shared';

type PermissionEntry = { label: string; group: string; plugin?: string };

interface FullPlugin {
  name: string;
  version: string;
  description: string;
  route?: string;
  icon?: string;
  adminOnly: boolean;
  isActive: boolean;
  installedAt: string;
  hasFrontend?: boolean;
  hasSettings?: boolean;
}

type Tab = 'users' | 'roles' | 'plugins' | 'hooks' | 'integrations' | 'system';

interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  color: string;
  isSystem: boolean;
  _count?: { users: number };
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  customRoleId: string | null;
  customRole: { id: string; name: string; color: string } | null;
  bitrixMapping: { bitrixUserId: number } | null;
}


const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  STAFF: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PROFESSOR: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  STUDENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// ── Log Viewer ────────────────────────────────────────────────────────────────

interface LogEntry {
  id: number;
  ts: string;
  level: string;
  msg: string;
  context?: string;
}

type LogLevel = 'all' | 'error' | 'warn' | 'info';

const LEVEL_COLORS: Record<string, string> = {
  info:  'text-gray-300',
  debug: 'text-gray-500',
  trace: 'text-gray-600',
  warn:  'text-yellow-400',
  error: 'text-red-400',
  fatal: 'text-red-600',
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toTimeString().slice(0, 8);
  } catch {
    return iso;
  }
}

// ── Hooks Catalog Panel ──────────────────────────────────────────────────────

interface HookInfo {
  hookName: string;
  pluginName: string;
  type: 'action' | 'filter';
  description?: string;
  payload?: Record<string, string>;
  listeners: { pluginName: string; priority: number }[];
}

function HooksCatalogPanel() {
  const [hooks, setHooks] = useState<HookInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get('/plugins/hooks').then(r => setHooks(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 rounded-full border-[3px] border-green-500 border-t-transparent animate-spin" /></div>;

  // Group by plugin
  const byPlugin = new Map<string, HookInfo[]>();
  for (const h of hooks) {
    const key = h.pluginName;
    if (!byPlugin.has(key)) byPlugin.set(key, []);
    byPlugin.get(key)!.push(h);
  }

  const toggle = (name: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs text-gray-400">{hooks.length} hooks registrados en {byPlugin.size} módulos</p>
      </div>

      {Array.from(byPlugin.entries()).map(([plugin, pluginHooks]) => (
        <div key={plugin} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${plugin === 'core' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
              {plugin}
            </span>
            <span className="text-[10px] text-gray-400">{pluginHooks.length} hooks</span>
          </div>

          {pluginHooks.map(h => (
            <div key={h.hookName} className="border-t border-gray-50 dark:border-gray-800">
              <button
                onClick={() => toggle(h.hookName)}
                className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${h.type === 'filter' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-green-100 dark:bg-green-900/30 text-green-600'}`}>
                  {h.type}
                </span>
                <code className="text-xs font-mono text-gray-800 dark:text-gray-200 flex-1">{h.hookName}</code>
                {h.listeners.length > 0 && (
                  <span className="text-[10px] text-gray-400">{h.listeners.length} listener{h.listeners.length !== 1 ? 's' : ''}</span>
                )}
                <svg className={`w-3.5 h-3.5 text-gray-300 transition-transform ${expanded.has(h.hookName) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expanded.has(h.hookName) && (
                <div className="px-4 pb-3 space-y-2">
                  {h.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{h.description}</p>
                  )}
                  {h.payload && Object.keys(h.payload).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Payload</p>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 space-y-1">
                        {Object.entries(h.payload).map(([k, v]) => (
                          <div key={k} className="flex gap-2 text-[11px]">
                            <code className="font-mono text-indigo-600 dark:text-indigo-400">{k}</code>
                            <span className="text-gray-400">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {h.listeners.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Listeners</p>
                      <div className="flex flex-wrap gap-1.5">
                        {h.listeners.map((l, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-600 dark:text-gray-400 font-medium">
                            {l.pluginName} <span className="text-gray-300">p:{l.priority}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!h.description && !h.payload && h.listeners.length === 0 && (
                    <p className="text-[10px] text-gray-300 italic">Sin documentación</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Plugin Settings Panel (auto-generated from schema) ───────────────────────

function PluginSettingsPanel({ pluginName }: { pluginName: string }) {
  const [schema, setSchema] = useState<any>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/plugins/${pluginName}/settings-schema`).then(r => r.data),
      api.get('/plugins/all').then(r => {
        const p = (r.data as any[]).find((x: any) => x.name === pluginName);
        return p?.config ?? {};
      }),
    ]).then(([s, c]) => {
      setSchema(s);
      setConfig(c);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [pluginName]);

  if (!loaded) return <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-[3px] border-green-500 border-t-transparent animate-spin" /></div>;

  const fields: any[] = [
    ...(schema?.fields ?? []),
    ...(schema?.sections ?? []).flatMap((s: any) => s.fields ?? []),
  ];

  // No schema — fallback to iframe
  if (fields.length === 0) {
    return (
      <iframe
        key={pluginName}
        src={`/api/v1/p/${pluginName}/ui/?config=true`}
        className="flex-1 w-full border-0"
        title={`${pluginName} config`}
        allow="same-origin"
      />
    );
  }

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.patch(`/plugins/${pluginName}/config`, { config });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? 'Error');
    } finally { setSaving(false); }
  };

  const sections = schema?.sections?.length
    ? schema.sections
    : [{ title: 'Configuración', fields }];

  return (
    <div className="flex-1 overflow-auto p-5 space-y-5">
      {sections.map((section: any, si: number) => (
        <div key={si} className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-3">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{section.title}</p>
          {section.description && <p className="text-xs text-gray-400 -mt-1">{section.description}</p>}
          {(section.fields ?? []).map((field: any) => (
            <div key={field.key}>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">
                {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {field.type === 'boolean' ? (
                <button
                  onClick={() => setConfig(c => ({ ...c, [field.key]: !c[field.key] }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${config[field.key] ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${config[field.key] ? 'left-5' : 'left-0.5'}`} />
                </button>
              ) : field.type === 'select' ? (
                <select
                  value={config[field.key] ?? ''}
                  onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Seleccionar...</option>
                  {(field.options ?? []).map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : field.type === 'text' ? (
                <textarea
                  value={config[field.key] ?? ''}
                  onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value }))}
                  placeholder={field.placeholder ?? ''}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              ) : field.type === 'number' ? (
                <input
                  type="number"
                  value={config[field.key] ?? ''}
                  onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value ? Number(e.target.value) : '' }))}
                  placeholder={field.placeholder ?? ''}
                  min={field.min} max={field.max}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              ) : (
                <input
                  type={field.type === 'secret' ? 'password' : field.type === 'url' ? 'url' : 'text'}
                  value={config[field.key] ?? ''}
                  onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value }))}
                  placeholder={field.placeholder ?? ''}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              )}
              {field.description && <p className="text-[10px] text-gray-400 mt-1">{field.description}</p>}
            </div>
          ))}
        </div>
      ))}

      {error && <div className="rounded-xl bg-red-50 dark:bg-red-900/10 text-red-600 text-xs p-3">{error}</div>}
      {saved && <div className="rounded-xl bg-green-50 dark:bg-green-900/10 text-green-600 text-xs p-3">Configuración guardada</div>}

      <button onClick={handleSave} disabled={saving}
        className="w-full py-2.5 rounded-xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  );
}

// ── Bitrix Integration Panel ─────────────────────────────────────────────────

function BitrixIntegrationPanel() {
  const [status, setStatus] = useState<{ configured: boolean; domain?: string; tokenValid?: boolean; expiresAt?: number } | null>(null);
  const [form, setForm] = useState({ clientId: '', clientSecret: '', domain: '' });
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; user?: string; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const loadStatus = async () => {
    try { const r = await api.get(`/admin/integrations/bitrix/status?_t=${Date.now()}`); setStatus(r.data); } catch { /* ignore */ }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleConfigure = async () => {
    if (!form.clientId || !form.clientSecret || !form.domain) return;
    setSaving(true);
    try {
      await api.post('/admin/integrations/bitrix/configure', form);
      setForm({ clientId: '', clientSecret: '', domain: '' });
      await loadStatus();
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try { const r = await api.post('/admin/integrations/bitrix/test'); setTestResult(r.data); }
    catch (e: any) { setTestResult({ ok: false, error: e.message }); }
    finally { setTesting(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Desconectar Bitrix24? Los plugins que lo requieran dejarán de funcionar.')) return;
    await api.delete('/admin/integrations/bitrix/disconnect');
    setStatus(null);
    setTestResult(null);
  };

  const handleAuthorize = () => {
    window.location.href = '/api/v1/admin/integrations/bitrix/authorize';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Bitrix24 OAuth2</h3>
            <p className="text-xs text-gray-400">Integración centralizada para todos los plugins</p>
          </div>
          {status?.configured && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Conectado
            </span>
          )}
        </div>

        {status?.configured ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Dominio</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{status.domain}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Token</p>
                <p className={`text-sm font-medium ${status.tokenValid ? 'text-green-600' : 'text-red-500'}`}>
                  {status.tokenValid ? 'Válido' : 'Expirado'}
                </p>
                {status.expiresAt && (
                  <p className="text-[10px] text-gray-400">Expira: {new Date(status.expiresAt).toLocaleString()}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleTest} disabled={testing}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 disabled:opacity-50 transition-colors">
                {testing ? 'Probando...' : 'Probar conexión'}
              </button>
              <button onClick={handleAuthorize}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition-colors">
                Re-autorizar
              </button>
              <button onClick={handleDisconnect}
                className="py-2 px-4 rounded-xl text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors">
                Desconectar
              </button>
            </div>

            {testResult && (
              <div className={`rounded-xl p-3 text-xs ${testResult.ok ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400'}`}>
                {testResult.ok ? `Conectado como: ${testResult.user}` : `Error: ${testResult.error}`}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Configura una aplicación de servidor Bitrix24 con permisos de <code className="font-mono text-[11px] bg-gray-100 dark:bg-gray-800 px-1 rounded">timeman</code>, <code className="font-mono text-[11px] bg-gray-100 dark:bg-gray-800 px-1 rounded">crm</code>, <code className="font-mono text-[11px] bg-gray-100 dark:bg-gray-800 px-1 rounded">user</code>.
            </p>
            <div className="space-y-2">
              <input type="text" placeholder="Client ID" value={form.clientId}
                onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="password" placeholder="Client Secret" value={form.clientSecret}
                onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" placeholder="Dominio (ej: empresa.bitrix24.com)" value={form.domain}
                onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleConfigure} disabled={saving || !form.clientId || !form.clientSecret || !form.domain}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Guardando...' : 'Guardar credenciales'}
              </button>
            </div>
            {status !== null && !status.configured && (
              <button onClick={handleAuthorize}
                className="w-full py-2 rounded-xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors">
                Autorizar en Bitrix24
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Crear una aplicación de servidor en Bitrix24</p>
        <ol className="text-xs text-amber-600 dark:text-amber-500 space-y-1 list-decimal list-inside">
          <li>Ir a Bitrix24 &rarr; Aplicaciones &rarr; Developer resources &rarr; Otra &rarr; Aplicación de servidor</li>
          <li>Conceder permisos: <strong>timeman</strong>, <strong>crm</strong>, <strong>user</strong>, <strong>user_brief</strong></li>
          <li>URL de redirect: <code className="font-mono text-[11px]">{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/admin/integrations/bitrix/callback</code></li>
          <li>Copiar <strong>client_id</strong> y <strong>client_secret</strong> aquí</li>
          <li>Presionar &quot;Guardar credenciales&quot; y luego &quot;Autorizar en Bitrix24&quot;</li>
        </ol>
      </div>
    </div>
  );
}

// ── Log Viewer ────────────────────────────────────────────────────────────────

function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogLevel>('all');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ entries: LogEntry[] }>('/system/logs?limit=300');
      setEntries(res.data.entries);
    } catch {
      // silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
    const id = setInterval(() => { void fetchLogs(); }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const visible = filter === 'all'
    ? entries
    : entries.filter((e) => e.level === filter);

  const FILTER_BTNS: { label: string; value: LogLevel }[] = [
    { label: 'All', value: 'all' },
    { label: 'Error', value: 'error' },
    { label: 'Warn', value: 'warn' },
    { label: 'Info', value: 'info' },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Logs del servidor {loading && <span className="ml-1 text-gray-500">(actualizando…)</span>}
        </p>
        <div className="flex gap-1">
          {FILTER_BTNS.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setFilter(btn.value)}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                filter === btn.value
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-950 text-gray-100 rounded-2xl font-mono text-[11px] overflow-y-auto max-h-[400px] p-3 space-y-0.5">
        {visible.length === 0 ? (
          <span className="text-gray-600">No hay entradas.</span>
        ) : (
          [...visible].reverse().map((entry) => (
            <div key={entry.id} className={cn('leading-relaxed', LEVEL_COLORS[entry.level] ?? 'text-gray-300')}>
              <span className="text-gray-500">[{formatTime(entry.ts)}]</span>
              {' '}
              <span className="uppercase font-semibold">[{entry.level}]</span>
              {entry.context && <span className="text-gray-400"> [{entry.context}]</span>}
              {' '}{entry.msg}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Small reusable components ─────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ActionMenu({ user: u, currentUserId, onEdit, onEditUser, onResetPassword, onImpersonate, onAssignRole, onToggleActive, onDelete }:
  {
    user: User;
    currentUserId: string;
    onEdit: () => void;
    onEditUser: () => void;
    onResetPassword: () => void;
    onImpersonate: () => void;
    onAssignRole: () => void;
    onToggleActive: () => void;
    onDelete: () => void;
  }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isSelf = u.id === currentUserId;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 py-1 z-20 text-xs">
          <button
            onClick={() => { onEditUser(); setOpen(false); }}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Editar datos
          </button>
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Cambiar rol
          </button>

          <button
            onClick={() => { onResetPassword(); setOpen(false); }}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Restablecer contraseña
          </button>

          <button
            onClick={() => { onAssignRole(); setOpen(false); }}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Asignar rol personalizado
          </button>

          {!isSelf && u.role !== 'ADMIN' && (
            <button
              onClick={() => { onImpersonate(); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Impersonar
            </button>
          )}

          <div className="border-t border-gray-100 dark:border-gray-800 my-1" />

          <button
            onClick={() => { onToggleActive(); setOpen(false); }}
            disabled={isSelf}
            className={cn(
              'w-full text-left px-3 py-2 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed',
              u.isActive
                ? 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500'
                : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600',
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={u.isActive
                ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
            </svg>
            {u.isActive ? 'Desactivar' : 'Activar'}
          </button>

          <button
            onClick={() => { onDelete(); setOpen(false); }}
            disabled={isSelf}
            className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, setUser, stopImpersonation } = useAuthStore();
  const plugins = usePlugins();
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab');
      if (t && ['users', 'roles', 'plugins', 'hooks', 'integrations', 'system'].includes(t)) return t as Tab;
    }
    return 'users';
  });
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Modals
  const [userModal, setUserModal] = useState<{ mode: 'create' | 'edit'; user?: User } | null>(null);
  const [userForm, setUserForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'STAFF' as string });
  const [userSaving, setUserSaving] = useState(false);
  const [pwdModal, setPwdModal] = useState<User | null>(null);
  const [pwdValue, setPwdValue] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  const [deleteModal, setDeleteModal] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Roles tab state
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [roleModal, setRoleModal] = useState<{ mode: 'create' | 'edit'; role?: CustomRole } | null>(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', color: '#6B7280', permissions: [] as string[] });
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);
  const [assignModal, setAssignModal] = useState<User | null>(null);

  // Dynamic permissions registry (core + plugin-registered)
  const [permissionsMap, setPermissionsMap] = useState<Record<string, PermissionEntry>>({});
  const [presetRoles, setPresetRoles] = useState<PresetRole[]>([]);

  const permissionGroups = useMemo(() =>
    Object.entries(permissionsMap).reduce<Record<string, { key: string; label: string; plugin?: string }[]>>(
      (acc, [key, meta]) => {
        if (!acc[meta.group]) acc[meta.group] = [];
        acc[meta.group].push({ key, label: meta.label, plugin: meta.plugin });
        return acc;
      }, {}
    ), [permissionsMap]);

  // Plugins tab state
  const [allPlugins, setAllPlugins] = useState<FullPlugin[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [togglingPlugin, setTogglingPlugin] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [configPlugin, setConfigPlugin] = useState<FullPlugin | null>(null);
  const [restarting, setRestarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guard: admin only
  useEffect(() => {
    if (user && user.role !== UserRole.ADMIN) router.replace('/dashboard/welcome');
  }, [user, router]);

  useEffect(() => {
    if (tab === 'users') { loadUsers(); loadRoles(); }
    if (tab === 'roles') loadRoles();
    if (tab === 'plugins') loadAllPlugins();
  }, [tab]);

  async function loadRoles() {
    setLoadingRoles(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get('/roles'),
        api.get('/permissions'),
      ]);
      setCustomRoles(rolesRes.data);
      setPermissionsMap(permsRes.data.permissions ?? {});
      setPresetRoles(permsRes.data.presetRoles ?? []);
    } finally {
      setLoadingRoles(false);
    }
  }

  function openCreateRole() {
    setRoleForm({ name: '', description: '', color: '#6B7280', permissions: [] });
    setRoleMsg(null);
    setRoleModal({ mode: 'create' });
  }

  function openEditRole(role: CustomRole) {
    setRoleForm({ name: role.name, description: role.description, color: role.color, permissions: role.permissions });
    setRoleMsg(null);
    setRoleModal({ mode: 'edit', role });
  }

  function togglePermission(perm: string) {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  }

  async function saveRole() {
    if (!roleForm.name.trim()) { setRoleMsg('El nombre es requerido'); return; }
    setRoleSaving(true);
    setRoleMsg(null);
    try {
      if (roleModal?.mode === 'create') {
        const res = await api.post('/roles', roleForm);
        setCustomRoles((prev) => [...prev, res.data]);
        flash(true, `Rol "${res.data.name}" creado`);
      } else if (roleModal?.role) {
        const res = await api.patch(`/roles/${roleModal.role.id}`, roleForm);
        setCustomRoles((prev) => prev.map((r) => r.id === res.data.id ? { ...r, ...res.data } : r));
        flash(true, `Rol "${res.data.name}" actualizado`);
      }
      setRoleModal(null);
    } catch (err: any) {
      setRoleMsg(err?.response?.data?.message ?? 'Error al guardar');
    } finally {
      setRoleSaving(false);
    }
  }

  async function deleteRole(role: CustomRole) {
    if (!confirm(`¿Eliminar el rol "${role.name}"? Los usuarios asignados volverán a su rol base.`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      setCustomRoles((prev) => prev.filter((r) => r.id !== role.id));
      flash(true, `Rol "${role.name}" eliminado`);
    } catch (err: any) {
      flash(false, err?.response?.data?.message ?? 'No se pudo eliminar');
    }
  }

  async function assignRole(userId: string, roleId: string | null) {
    try {
      if (roleId) {
        await api.patch(`/roles/${roleId}/assign/${userId}`);
      } else {
        // find current role to call the remove endpoint
        const u = users.find((u) => u.id === userId);
        if (u?.customRoleId) await api.delete(`/roles/${u.customRoleId}/assign/${userId}`);
      }
      setUsers((prev) => prev.map((u) => {
        if (u.id !== userId) return u;
        const role = customRoles.find((r) => r.id === roleId) ?? null;
        return { ...u, customRoleId: roleId, customRole: role ? { id: role.id, name: role.name, color: role.color } : null };
      }));
      setAssignModal(null);
      flash(true, roleId ? 'Rol personalizado asignado' : 'Rol personalizado eliminado');
    } catch (err: any) {
      flash(false, err?.response?.data?.message ?? 'Error al asignar rol');
    }
  }

  function flash(ok: boolean, text: string) {
    setActionMsg({ ok, text });
    setTimeout(() => setActionMsg(null), 3500);
  }

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

      const isRestarting = res.data.message?.toLowerCase().includes('restart');
      if (isRestarting) {
        setUploading(false);
        setRestarting(true);
        setUploadMsg({ ok: true, text: 'Reiniciando servidor...' });

        // Poll until the API is back up
        let attempts = 0;
        const maxAttempts = 30; // 30s max
        await new Promise<void>((resolve) => {
          const interval = setInterval(async () => {
            attempts++;
            try {
              await api.get('/auth/me');
              clearInterval(interval);
              resolve();
            } catch {
              if (attempts >= maxAttempts) { clearInterval(interval); resolve(); }
            }
          }, 1000);
        });

        setRestarting(false);
        setUploadMsg({ ok: true, text: '✓ Plugin instalado correctamente' });
        await loadAllPlugins();
      } else {
        setUploadMsg({ ok: true, text: res.data.message });
      }
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
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
      flash(true, `${u.firstName} ${u.isActive ? 'desactivado' : 'activado'}`);
    } catch {
      flash(false, 'No se pudo cambiar el estado');
    }
  }

  async function saveUser() {
    setUserSaving(true);
    try {
      if (userModal?.mode === 'create') {
        await api.post('/users', userForm);
        flash(true, 'Usuario creado');
      } else if (userModal?.mode === 'edit' && userModal.user) {
        await api.patch(`/users/${userModal.user.id}`, {
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          email: userForm.email,
          role: userForm.role,
        });
        flash(true, 'Usuario actualizado');
      }
      setUserModal(null);
      loadUsers();
    } catch (e: any) {
      flash(false, e.response?.data?.message ?? 'Error al guardar');
    } finally {
      setUserSaving(false);
    }
  }

  async function saveUserRole(id: string) {
    setSaving(true);
    try {
      await api.patch(`/users/${id}`, { role: editRole });
      setUsers((prev) => prev.map((x) => x.id === id ? { ...x, role: editRole } : x));
      setEditingId(null);
      flash(true, 'Rol actualizado');
    } catch {
      flash(false, 'No se pudo cambiar el rol');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!pwdModal || pwdValue.length < 6) return;
    setPwdSaving(true);
    setPwdMsg(null);
    try {
      await api.patch(`/users/${pwdModal.id}/password`, { password: pwdValue });
      setPwdModal(null);
      setPwdValue('');
      flash(true, 'Contraseña actualizada');
    } catch (err: any) {
      setPwdMsg(err?.response?.data?.message ?? 'Error al cambiar contraseña');
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleImpersonate(u: User) {
    try {
      const res = await api.post(`/auth/impersonate/${u.id}`);
      setUser({ ...res.data.user, isImpersonated: true, impersonatedBy: res.data.impersonatedBy });
      router.push(u.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/welcome');
    } catch (err: any) {
      flash(false, err?.response?.data?.message ?? 'No se pudo impersonar');
    }
  }

  async function handleStopImpersonation() {
    try {
      await stopImpersonation();
      router.push('/dashboard/admin');
    } catch {
      flash(false, 'No se pudo terminar la impersonación');
    }
  }

  async function handleDelete() {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteModal.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== deleteModal.id));
      setDeleteModal(null);
      flash(true, `${deleteModal.firstName} eliminado`);
    } catch (err: any) {
      flash(false, err?.response?.data?.message ?? 'No se pudo eliminar');
      setDeleteModal(null);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = users.filter((u) =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Usuarios' },
    { key: 'roles', label: 'Roles' },
    { key: 'plugins', label: 'Módulos' },
    { key: 'hooks', label: 'Hooks' },
    { key: 'integrations', label: 'Integraciones' },
    { key: 'system', label: 'Sistema' },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* Plugin config slide-over */}
      {configPlugin && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setConfigPlugin(null)}
          />
          {/* Panel */}
          <div className="relative ml-auto w-full max-w-xl h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-800 dark:text-white capitalize">{configPlugin.name}</p>
                <p className="text-[10px] text-gray-400">Configuración del plugin</p>
              </div>
              <button
                onClick={() => setConfigPlugin(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Plugin config: auto-generated form or iframe fallback */}
            <PluginSettingsPanel pluginName={configPlugin.name} />
          </div>
        </div>
      )}

      {/* Toast */}
      {actionMsg && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-all',
          actionMsg.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white',
        )}>
          {actionMsg.text}
        </div>
      )}

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
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{filtered.length} usuarios</span>
                <button onClick={() => { setUserModal({ mode: 'create' }); setUserForm({ firstName: '', lastName: '', email: '', password: '', role: 'STAFF' }); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors">
                  + Nuevo usuario
                </button>
              </div>
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
                            <div className="flex items-center gap-1.5">
                              <select
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value)}
                                className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              >
                                {Object.values(UserRole).map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => saveUserRole(u.id)}
                                disabled={saving}
                                className="px-2 py-1 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs disabled:opacity-60"
                              >
                                {saving ? '...' : '✓'}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600')}>
                                {u.role}
                              </span>
                              {u.customRole && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                  style={{ backgroundColor: u.customRole.color }}
                                >
                                  {u.customRole.name}
                                </span>
                              )}
                            </div>
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
                          {editingId !== u.id && (
                            <ActionMenu
                              user={u}
                              currentUserId={user?.id ?? ''}
                              onEdit={() => { setEditingId(u.id); setEditRole(u.role); }}
                              onEditUser={() => { setUserModal({ mode: 'edit', user: u }); setUserForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, password: '', role: u.role }); }}
                              onResetPassword={() => { setPwdModal(u); setPwdValue(''); setPwdMsg(null); }}
                              onImpersonate={() => handleImpersonate(u)}
                              onAssignRole={() => setAssignModal(u)}
                              onToggleActive={() => toggleActive(u)}
                              onDelete={() => setDeleteModal(u)}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── ROLES TAB ── */}
        {tab === 'roles' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Roles personalizados</h2>
                <p className="text-xs text-gray-400 mt-0.5">Define conjuntos de permisos granulares y asígnalos a usuarios.</p>
              </div>
              <button
                onClick={openCreateRole}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo rol
              </button>
            </div>

            {loadingRoles ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : customRoles.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
                <p className="text-sm text-gray-400">No hay roles personalizados. Crea el primero.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {customRoles.map((role) => (
                  <div key={role.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-white text-sm">{role.name}</span>
                            {role.isSystem && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">Sistema</span>
                            )}
                            <span className="text-xs text-gray-400">{role._count?.users ?? 0} usuario{role._count?.users !== 1 ? 's' : ''}</span>
                          </div>
                          {role.description && <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => openEditRole(role)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          Editar
                        </button>
                        {!role.isSystem && (
                          <button
                            onClick={() => deleteRole(role)}
                            className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(role.permissions as string[]).map((p) => {
                        const meta = permissionsMap[p];
                        return (
                          <span key={p} className={cn(
                            'px-2 py-0.5 rounded-md text-[11px] font-medium',
                            meta?.plugin
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
                          )}>
                            {meta?.label ?? p}
                          </span>
                        );
                      })}
                      {role.permissions.length === 0 && (
                        <span className="text-xs text-gray-300 dark:text-gray-600 italic">Sin permisos</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Plugin preset roles ── */}
            {presetRoles.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Roles sugeridos por plugins</h3>
                  <span className="text-xs text-gray-400">Creados automáticamente por plugins activos. Puedes modificarlos después.</span>
                </div>
                <div className="grid gap-2">
                  {presetRoles.map((preset) => {
                    const alreadyExists = customRoles.some(
                      (r) => r.name.toLowerCase() === preset.name.toLowerCase(),
                    );
                    return (
                      <div
                        key={`${preset.plugin}-${preset.name}`}
                        className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-xl p-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900 dark:text-white">{preset.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                              {preset.plugin}
                            </span>
                            {alreadyExists && (
                              <span className="text-[10px] text-gray-400 italic">ya existe</span>
                            )}
                          </div>
                          {preset.description && (
                            <p className="text-xs text-gray-400 mt-0.5">{preset.description}</p>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {preset.permissions.slice(0, 5).map((p) => (
                              <span key={p} className="text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 px-1.5 py-0.5 rounded">
                                {permissionsMap[p]?.label ?? p}
                              </span>
                            ))}
                            {preset.permissions.length > 5 && (
                              <span className="text-[10px] text-gray-400">+{preset.permissions.length - 5} más</span>
                            )}
                          </div>
                        </div>
                        {!alreadyExists && (
                          <button
                            onClick={() => {
                              setRoleForm({
                                name: preset.name,
                                description: preset.description ?? '',
                                color: preset.color ?? '#3B82F6',
                                permissions: preset.permissions,
                              });
                              setRoleModal({ mode: 'create' });
                              setRoleMsg(null);
                            }}
                            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium"
                          >
                            Crear
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PLUGINS TAB ── */}
        {tab === 'plugins' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Instalar plugin externo</p>
              <p className="text-xs text-gray-400 mb-3">Sube un archivo <code className="font-mono">.vla.zip</code> que contenga <code className="font-mono">plugin.json</code> y <code className="font-mono">dist/index.js</code>. El servidor reiniciará automáticamente.</p>
              <div className="flex items-center gap-3">
                <label className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors',
                  uploading || restarting
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white',
                )}>
                  {uploading ? (
                    <><span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />Subiendo...</>
                  ) : restarting ? (
                    <><span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />Reiniciando...</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Seleccionar .vla.zip</>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    disabled={uploading || restarting}
                    onChange={handleUpload}
                  />
                </label>
                {uploadMsg && (
                  <span className={cn('text-xs px-3 py-1.5 rounded-lg', uploadMsg.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400')}>
                    {restarting && <span className="inline-block w-2.5 h-2.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin mr-1.5 align-middle" />}
                    {uploadMsg.text}
                  </span>
                )}
              </div>
            </div>

            {/* Install from URL */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Instalar desde URL</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/my-plugin.vla.zip"
                  id="install-url-input"
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={async () => {
                    const input = document.getElementById('install-url-input') as HTMLInputElement;
                    if (!input.value) return;
                    try {
                      await api.post('/plugins/install-url', { url: input.value });
                      setUploadMsg({ ok: true, text: 'Instalando... el servidor reiniciará.' });
                      setRestarting(true);
                    } catch (e: any) {
                      setUploadMsg({ ok: false, text: e.response?.data?.message ?? 'Error' });
                    }
                  }}
                  disabled={uploading || restarting}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors"
                >
                  Instalar
                </button>
              </div>
            </div>

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
                    {p.isActive && (p.hasFrontend || p.hasSettings) && (
                      <button
                        onClick={() => setConfigPlugin(p)}
                        title="Configurar plugin"
                        className="p-1.5 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm(`Rollback "${p.name}" a la versión anterior?`)) return;
                        try {
                          const r = await api.post(`/plugins/${p.name}/rollback`);
                          if ((r.data as any).ok) {
                            setUploadMsg({ ok: true, text: `Rollback a v${(r.data as any).restoredVersion}. Reiniciando...` });
                            setRestarting(true);
                          } else {
                            setUploadMsg({ ok: false, text: (r.data as any).error ?? 'No hay versión anterior' });
                          }
                        } catch (e: any) { setUploadMsg({ ok: false, text: e.response?.data?.message ?? 'Error' }); }
                      }}
                      title="Rollback a versión anterior"
                      className="p-1.5 rounded-xl text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
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

        {/* ── HOOKS TAB ── */}
        {tab === 'hooks' && <HooksCatalogPanel />}

        {/* ── INTEGRATIONS TAB ── */}
        {tab === 'integrations' && <BitrixIntegrationPanel />}

        {/* ── SYSTEM TAB ── */}
        {tab === 'system' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Plataforma', value: 'VLA System' },
                { label: 'Módulos activos', value: String(plugins.length) },
                { label: 'Total usuarios', value: String(users.length || '—') },
                { label: 'Usuarios activos', value: String(users.filter((u) => u.isActive).length || '—') },
                { label: 'Integración Bitrix24', value: 'Ver pestaña Integraciones' },
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

            <LogViewer />
          </div>
        )}

      </div>

      {/* ── Create / Edit role modal ── */}
      {roleModal && (
        <Modal
          title={roleModal.mode === 'create' ? 'Nuevo rol' : `Editar rol — ${roleModal.role?.name}`}
          onClose={() => setRoleModal(null)}
        >
          <div className="space-y-3 mb-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Nombre</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="ej. Editor de contenido"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Color</label>
                <input
                  type="color"
                  value={roleForm.color}
                  onChange={(e) => setRoleForm((p) => ({ ...p, color: e.target.value }))}
                  className="h-9 w-14 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Descripción (opcional)</label>
              <input
                type="text"
                value={roleForm.description}
                onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Describe para qué sirve este rol"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Permisos</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setRoleForm((p) => ({ ...p, permissions: Object.keys(permissionsMap) }))}
                  className="text-[11px] text-green-600 hover:underline"
                >Todos</button>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <button
                  onClick={() => setRoleForm((p) => ({ ...p, permissions: [] }))}
                  className="text-[11px] text-gray-400 hover:underline"
                >Ninguno</button>
              </div>
            </div>
            <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {Object.entries(permissionGroups).map(([group, perms]) => (
                <div key={group}>
                  <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    {group}
                    {perms[0]?.plugin && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-medium normal-case">
                        plugin: {perms[0].plugin}
                      </span>
                    )}
                  </div>
                  {perms.map(({ key, label, plugin }) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={roleForm.permissions.includes(key)}
                        onChange={() => togglePermission(key)}
                        className="w-3.5 h-3.5 rounded accent-green-500"
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
                      {plugin && (
                        <span className="ml-auto text-[9px] text-blue-400 font-mono">{plugin}</span>
                      )}
                    </label>
                  ))}
                </div>
              ))}
              {Object.keys(permissionGroups).length === 0 && (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">Cargando permisos...</div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{roleForm.permissions.length} de {Object.keys(permissionsMap).length} permisos seleccionados</p>
          </div>

          {roleMsg && <p className="text-xs text-red-500 mb-3">{roleMsg}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setRoleModal(null)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
              Cancelar
            </button>
            <button
              onClick={saveRole}
              disabled={roleSaving}
              className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {roleSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Assign role modal ── */}
      {assignModal && (
        <Modal title={`Asignar rol — ${assignModal.firstName} ${assignModal.lastName}`} onClose={() => setAssignModal(null)}>
          <p className="text-xs text-gray-400 mb-4">
            El rol personalizado añade permisos extra sobre el rol base (<strong>{assignModal.role}</strong>).
          </p>
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            <button
              onClick={() => assignRole(assignModal.id, null)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors',
                !assignModal.customRoleId
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
              )}
            >
              <span className="font-medium">Sin rol personalizado</span>
              <span className="text-xs text-gray-400 ml-2">Usa los permisos del rol base</span>
            </button>
            {customRoles.map((role) => (
              <button
                key={role.id}
                onClick={() => assignRole(assignModal.id, role.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors',
                  assignModal.customRoleId === role.id
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                  <span className="font-medium text-gray-900 dark:text-white">{role.name}</span>
                  {role.description && <span className="text-xs text-gray-400">{role.description}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(role.permissions as string[]).slice(0, 4).map((p) => (
                    <span key={p} className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
                      {permissionsMap[p]?.label ?? p}
                    </span>
                  ))}
                  {role.permissions.length > 4 && (
                    <span className="text-[10px] text-gray-400">+{role.permissions.length - 4} más</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={() => setAssignModal(null)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
              Cerrar
            </button>
          </div>
        </Modal>
      )}

      {/* ── Create/Edit User modal ── */}
      {userModal && (
        <Modal title={userModal.mode === 'create' ? 'Nuevo usuario' : `Editar — ${userModal.user?.firstName} ${userModal.user?.lastName}`} onClose={() => setUserModal(null)}>
          <div className="space-y-3 mb-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Nombre</label>
                <input type="text" value={userForm.firstName} onChange={e => setUserForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Nombre"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Apellido</label>
                <input type="text" value={userForm.lastName} onChange={e => setUserForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Apellido"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Email</label>
              <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            {userModal.mode === 'create' && (
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Contraseña</label>
                <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimo 6 caracteres"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Rol</label>
              <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="STAFF">STAFF</option>
                <option value="ADMIN">ADMIN</option>
                <option value="PROFESSOR">PROFESSOR</option>
                <option value="STUDENT">STUDENT</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setUserModal(null)} className="px-4 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Cancelar</button>
            <button onClick={saveUser} disabled={userSaving || !userForm.firstName || !userForm.email || (userModal.mode === 'create' && userForm.password.length < 6)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-500 text-white hover:bg-green-600 disabled:opacity-50">
              {userSaving ? 'Guardando...' : userModal.mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Reset password modal ── */}
      {pwdModal && (
        <Modal title={`Restablecer contraseña — ${pwdModal.firstName}`} onClose={() => setPwdModal(null)}>
          <p className="text-xs text-gray-400 mb-4">La nueva contraseña debe tener al menos 6 caracteres.</p>
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={pwdValue}
            onChange={(e) => setPwdValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
          />
          {pwdMsg && <p className="text-xs text-red-500 mb-3">{pwdMsg}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPwdModal(null)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleResetPassword}
              disabled={pwdSaving || pwdValue.length < 6}
              className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {pwdSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete confirm modal ── */}
      {deleteModal && (
        <Modal title="Eliminar usuario" onClose={() => setDeleteModal(null)}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
            ¿Estás seguro de que quieres eliminar a <strong>{deleteModal.firstName} {deleteModal.lastName}</strong>?
          </p>
          <p className="text-xs text-red-500 mb-6">Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteModal(null)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}
