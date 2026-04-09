import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

interface Options {
  name: string;
  description: string;
  author: string;
  icon: string;
  needsBitrix: boolean;
  needsFrontend: boolean;
  targetDir: string;
}

function log(msg: string) { console.log(chalk.gray(`  ${msg}`)); }

export async function generatePlugin(opts: Options) {
  const { name, description, author, icon, needsBitrix, needsFrontend, targetDir } = opts;
  const pluginClass = name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  const permPrefix = name.replace(/-/g, '_');

  fs.mkdirSync(targetDir, { recursive: true });
  log('Creando estructura...');

  // ── plugin.json ─────────────────────────────────────────────────────────
  fs.writeJsonSync(path.join(targetDir, 'plugin.json'), {
    name,
    version: '1.0.0',
    description,
    author,
    vlaMinVersion: '1.0.0',
    route: needsFrontend ? `/dashboard/${name}` : undefined,
    icon,
    adminOnly: false,
    accessPermissions: [`${name}.read`],
    ...(needsBitrix ? { requires: ['bitrix'] } : {}),
    permissions: ['read:users'],
    settings: {
      fields: [
        { key: 'exampleSetting', type: 'string', label: 'Configuración de ejemplo', description: 'Edita esto desde Admin → Módulos → Configurar', required: false, placeholder: 'valor...' },
      ],
    },
    hooks: {
      listens: ['core.user.created'],
      emits: [`${name}.item.created`],
    },
  }, { spaces: 2 });
  log('plugin.json');

  // ── package.json ────────────────────────────────────────────────────────
  fs.writeJsonSync(path.join(targetDir, 'package.json'), {
    name: `vla-plugin-${name}`,
    version: '1.0.0',
    private: true,
    scripts: {
      build: 'tsc',
      'build:frontend': needsFrontend ? 'cd frontend && npm run build && cd .. && rm -rf ui && cp -r frontend/dist ui' : undefined,
      pack: 'node scripts/pack.js',
      release: needsFrontend ? 'npm run build && npm run build:frontend && npm run pack' : 'npm run build && npm run pack',
    },
    devDependencies: {
      typescript: '^5.4.0',
    },
  }, { spaces: 2 });
  log('package.json');

  // ── tsconfig.json ───────────────────────────────────────────────────────
  fs.writeJsonSync(path.join(targetDir, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['ES2020'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      paths: { '@vla/plugin-sdk': ['./vendor/plugin-sdk/dist'] },
    },
    include: ['src'],
  }, { spaces: 2 });
  log('tsconfig.json');

  // ── .gitignore ──────────────────────────────────────────────────────────
  fs.writeFileSync(path.join(targetDir, '.gitignore'), [
    'node_modules/', 'dist/', 'ui/', '*.vla.zip',
    needsFrontend ? 'frontend/node_modules/' : '',
  ].filter(Boolean).join('\n') + '\n');
  log('.gitignore');

  // ── src/index.ts ────────────────────────────────────────────────────────
  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });

  const bitrixSection = needsBitrix ? `
    // ── Bitrix24 ───────────────────────────────────────────────────────────
    // ctx.bitrix está disponible porque plugin.json declara "requires": ["bitrix"]
    // Ejemplo:
    //   const users = await ctx.bitrix!.callAll('user.get', { FILTER: { ACTIVE: true } });
    //   const lead = await ctx.bitrix!.call('crm.lead.get', { id: 123 });
` : '';

  fs.writeFileSync(path.join(targetDir, 'src/index.ts'), `import type { PluginDefinition } from '@vla/plugin-sdk';

const PERMS = {
  READ:  '${name}.read',
  WRITE: '${name}.write',
} as const;

const plugin: PluginDefinition = {
  async register(ctx) {
    ctx.logger.log('${pluginClass} plugin iniciado');

    // ── Capabilities ───────────────────────────────────────────────────────
    ctx.hooks.registerFilter('core.permissions.register', (map: any) => ({
      ...map,
      [PERMS.READ]:  { label: 'Ver ${pluginClass}',    group: '${pluginClass}', plugin: ctx.plugin.name },
      [PERMS.WRITE]: { label: 'Editar ${pluginClass}', group: '${pluginClass}', plugin: ctx.plugin.name },
    }));

    ctx.hooks.registerFilter('core.roles.preset', (roles: any[]) => [
      ...roles,
      {
        name: 'Usuario ${pluginClass}',
        description: 'Acceso básico a ${pluginClass}',
        permissions: [PERMS.READ],
        color: '#6B7280',
        plugin: ctx.plugin.name,
      },
    ]);

    // ── Rutas ──────────────────────────────────────────────────────────────
    ctx.router.get('/hello', ctx.requireAuth(), ctx.requirePermission(PERMS.READ), (_req: any, res: any) => {
      res.json({ ok: true, message: 'Hola desde ${name}', config: ctx.plugin.config });
    });

    ctx.router.post('/items', ctx.requireAuth(), ctx.requirePermission(PERMS.WRITE), async (req: any, res: any) => {
      const { name } = req.body as { name: string };
      if (!name) return res.status(400).json({ message: 'name es requerido' });
      await ctx.redis.setJson('lastItem', { name, at: new Date() }, 300);
      await ctx.hooks.doAction('${name}.item.created', { name, userId: req.user?.sub });
      res.status(201).json({ ok: true, name });
    });
${bitrixSection}
    // ── Hooks ──────────────────────────────────────────────────────────────
    ctx.hooks.declareHook('${name}.item.created', {
      description: 'Se creó un item en ${pluginClass}',
      payload: { name: 'string', userId: 'string' },
    });

    ctx.hooks.registerAction('core.user.created', async (payload: { user: { id: string } }) => {
      ctx.logger.log(\`Nuevo usuario: \${payload.user.id}\`);
    });

    // ── Cron ───────────────────────────────────────────────────────────────
    // ctx.cron('0 9 * * 1-5', async () => { ctx.logger.log('Tarea programada'); });
  },

  async onActivate() {},
  async onDeactivate() {},
  async onInstall() {},
};

export default plugin;
`);
  log('src/index.ts');

  // ── Vendor SDK ──────────────────────────────────────────────────────────
  const sdkSrc = path.resolve(__dirname, '../../plugin-sdk/dist');
  const sdkDst = path.join(targetDir, 'vendor/plugin-sdk');
  if (fs.existsSync(sdkSrc)) {
    fs.mkdirSync(path.join(sdkDst, 'dist'), { recursive: true });
    fs.copySync(sdkSrc, path.join(sdkDst, 'dist'));
    fs.writeJsonSync(path.join(sdkDst, 'package.json'), {
      name: '@vla/plugin-sdk',
      version: '1.0.0',
      main: 'dist/index.js',
      types: 'dist/types.d.ts',
    }, { spaces: 2 });
    log('vendor/plugin-sdk/');
  } else {
    log('⚠ vendor/plugin-sdk no encontrado — copia manualmente');
  }

  // ── scripts/pack.js ─────────────────────────────────────────────────────
  fs.mkdirSync(path.join(targetDir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'scripts/pack.js'), `#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manifest = require(path.join(root, 'plugin.json'));
const out = \`\${manifest.name}-\${manifest.version}.vla.zip\`;
const includes = ['plugin.json', 'dist/', 'vendor/', 'migrations/'];
${needsFrontend ? "if (require('fs').existsSync(path.join(root, 'ui'))) includes.push('ui/');" : ''}
execSync(\`cd \${root} && zip -r \${out} \${includes.join(' ')}\`, { stdio: 'inherit' });
console.log(\`\\n  ✓ Empaquetado: \${out}\\n\`);
`);
  log('scripts/pack.js');

  // ── Migrations example ───────────────────────────────────────────────────
  const migDir = path.join(targetDir, 'migrations');
  fs.mkdirSync(migDir, { recursive: true });
  fs.writeFileSync(path.join(migDir, '001_create_items.up.sql'), `-- Plugin: ${name} | Migration 001
-- This runs inside schema "plugin_${permPrefix}" automatically.
-- Use ctx.query() in your plugin code to query these tables.

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
`);
  fs.writeFileSync(path.join(migDir, '001_create_items.down.sql'), `DROP TABLE IF EXISTS items;\n`);
  log('migrations/ (ejemplo)');

  // ── Frontend (optional) ─────────────────────────────────────────────────
  if (needsFrontend) {
    const feDir = path.join(targetDir, 'frontend');
    fs.mkdirSync(path.join(feDir, 'src/vla'), { recursive: true });

    // package.json
    fs.writeJsonSync(path.join(feDir, 'package.json'), {
      name: `vla-plugin-${name}-ui`,
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: { dev: 'vite', build: 'tsc && vite build' },
      dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
      devDependencies: {
        '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0',
        '@vitejs/plugin-react': '^4.3.0', autoprefixer: '^10.4.0',
        postcss: '^8.4.0', tailwindcss: '^3.4.0', typescript: '^5.4.0', vite: '^5.4.0',
      },
    }, { spaces: 2 });

    // vite.config.ts
    fs.writeFileSync(path.join(feDir, 'vite.config.ts'), `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
`);

    // tailwind + postcss
    fs.writeFileSync(path.join(feDir, 'tailwind.config.js'), `export default { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] };\n`);
    fs.writeFileSync(path.join(feDir, 'postcss.config.js'), `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`);

    // tsconfig
    fs.writeJsonSync(path.join(feDir, 'tsconfig.json'), {
      compilerOptions: {
        target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler',
        jsx: 'react-jsx', strict: true, esModuleInterop: true, skipLibCheck: true,
        paths: { '@/*': ['./src/*'] },
      },
      include: ['src'],
    }, { spaces: 2 });

    // index.html
    fs.writeFileSync(path.join(feDir, 'index.html'), `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${pluginClass}</title></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
`);

    // src/main.tsx
    fs.writeFileSync(path.join(feDir, 'src/main.tsx'), `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
`);

    // src/index.css
    fs.writeFileSync(path.join(feDir, 'src/index.css'), `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n*, *::before, *::after { box-sizing: border-box; }\nhtml, body, #root { height: 100%; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }\n`);

    // VLA UI Kit (shared)
    const vlaKit = path.resolve(__dirname, '../../../vla-plugin-template/frontend/src/vla');
    if (fs.existsSync(vlaKit)) {
      fs.copySync(vlaKit, path.join(feDir, 'src/vla'));
      log('frontend/src/vla/ (UI Kit copiado)');
    } else {
      // Create minimal versions inline
      fs.writeFileSync(path.join(feDir, 'src/vla/api.ts'), `const BASE = '/api/v1';\nasync function request<T>(method: string, path: string, body?: unknown): Promise<T> {\n  const res = await fetch(\`\${BASE}\${path}\`, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });\n  if (res.status === 401) { window.location.href = '/login'; throw new Error('Unauthorized'); }\n  if (!res.ok) throw new Error(\`\${method} \${path} → \${res.status}\`);\n  return res.json() as Promise<T>;\n}\nexport const api = { get: <T>(p: string) => request<T>('GET', p), post: <T>(p: string, b?: unknown) => request<T>('POST', p, b), patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b), put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b), delete: <T>(p: string) => request<T>('DELETE', p) };\n`);
      fs.writeFileSync(path.join(feDir, 'src/vla/usePluginAuth.ts'), `import { useEffect, useState } from 'react';\nimport { api } from './api';\nexport interface PluginUser { id: string; firstName: string; lastName: string; role: string; email: string; permissions: string[]; }\nexport function usePluginAuth() { const [user, setUser] = useState<PluginUser | null>(null); const [loading, setLoading] = useState(true); useEffect(() => { api.get<PluginUser>('/auth/me').then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false)); }, []); return { user, loading, isAdmin: user?.role === 'ADMIN' }; }\n`);
      fs.writeFileSync(path.join(feDir, 'src/vla/PluginShell.tsx'), `import type { ReactNode } from 'react';\nimport type { PluginUser } from './usePluginAuth';\ninterface Props { title: string; subtitle?: string; headerCenter?: ReactNode; headerActions?: ReactNode; user: PluginUser; children: ReactNode; }\nexport function PluginShell({ title, subtitle, headerCenter, headerActions, user, children }: Props) { return (<div className="h-full flex flex-col bg-gray-50 overflow-hidden"><div className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 bg-white border-b border-gray-100"><div className="min-w-0"><h1 className="text-sm font-bold text-gray-800 leading-tight truncate">{title}</h1>{subtitle && <p className="text-[10px] text-gray-400 leading-tight truncate">{subtitle}</p>}</div>{headerCenter && <div className="ml-2">{headerCenter}</div>}<div className="ml-auto flex items-center gap-2">{headerActions}<div className="flex items-center gap-1.5 pl-2 border-l border-gray-100"><div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">{user.firstName[0]}{user.lastName[0]}</div><span className="text-[11px] text-gray-400 hidden sm:inline">{user.firstName} {user.lastName}</span></div></div></div><div className="flex-1 overflow-hidden">{children}</div></div>); }\nexport function PluginLoading() { return (<div className="h-full flex items-center justify-center bg-gray-50"><div className="w-7 h-7 rounded-full border-[3px] border-green-500 border-t-transparent animate-spin" /></div>); }\n`);
      fs.writeFileSync(path.join(feDir, 'src/vla/index.ts'), `export { api } from './api';\nexport { usePluginAuth } from './usePluginAuth';\nexport type { PluginUser } from './usePluginAuth';\nexport { PluginShell, PluginLoading } from './PluginShell';\n`);
      log('frontend/src/vla/ (UI Kit generado)');
    }

    // App.tsx
    fs.writeFileSync(path.join(feDir, 'src/App.tsx'), `import { usePluginAuth, PluginShell, PluginLoading } from './vla';

export default function App() {
  const { user, loading } = usePluginAuth();

  if (loading || !user) return <PluginLoading />;

  return (
    <PluginShell title="${pluginClass}" subtitle="${description}" user={user}>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">Plugin listo!</p>
          <p className="text-sm text-gray-400 mt-1">
            Edita <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">frontend/src/App.tsx</code> para empezar.
          </p>
        </div>
      </div>
    </PluginShell>
  );
}
`);
    log('frontend/src/App.tsx');
  }

  // ── README.md ───────────────────────────────────────────────────────────
  fs.writeFileSync(path.join(targetDir, 'README.md'), `# ${pluginClass}

${description}

## Desarrollo

\`\`\`bash
npm install
${needsFrontend ? 'cd frontend && npm install && cd ..' : ''}
npm run build
${needsFrontend ? 'npm run build:frontend' : ''}
npm run pack
\`\`\`

## Instalar

Sube el archivo \`.vla.zip\` en **Admin → Módulos → Seleccionar .vla.zip**

## Estructura

\`\`\`
${name}/
  plugin.json          ← Manifiesto (nombre, permisos, settings, requires)
  src/index.ts         ← Backend: rutas, hooks, crons
  ${needsFrontend ? 'frontend/src/App.tsx  ← Frontend: React + Tailwind + PluginShell' : ''}
  vendor/plugin-sdk/   ← Tipos del SDK (no editar)
  scripts/pack.js      ← Empaquetador .vla.zip
\`\`\`

## API del Plugin

| Propiedad | Descripción |
|-----------|-------------|
| \`ctx.router\` | Express router montado en \`/api/v1/p/${name}/\` |
| \`ctx.prisma\` | Cliente Prisma (acceso a BD) |
| \`ctx.redis\` | Redis namespaced (\`plugin:${name}:*\`) |
| \`ctx.hooks\` | Sistema de hooks (actions + filters) |
| \`ctx.cron(expr, fn)\` | Tareas programadas |
| \`ctx.logger\` | Logger con prefijo del plugin |
| \`ctx.requireAuth()\` | Middleware JWT |
| \`ctx.requirePermission(perm)\` | Middleware de permisos |
| \`ctx.plugin.config\` | Configuración guardada (editable desde Admin) |
${needsBitrix ? '| `ctx.bitrix` | Cliente Bitrix24 OAuth2 (call, callAll, callRaw) |' : ''}
`);
  log('README.md');
}
