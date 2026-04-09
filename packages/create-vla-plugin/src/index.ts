#!/usr/bin/env node

import prompts from 'prompts';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { generatePlugin } from './generator';

const ICONS = [
  'star', 'chart-bar', 'users', 'calendar', 'mail', 'shield', 'database',
  'file-text', 'settings', 'bell', 'book', 'briefcase', 'clock', 'globe',
  'heart', 'home', 'layers', 'link', 'lock', 'map', 'message-circle',
  'monitor', 'package', 'phone', 'search', 'shopping-cart', 'terminal',
  'trending-up', 'truck', 'zap',
];

async function main() {
  console.log();
  console.log(chalk.green.bold('  VLA Plugin Scaffolding Tool'));
  console.log(chalk.gray('  Crea un plugin listo para desarrollar\n'));

  const answers = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Nombre del plugin (kebab-case)',
      initial: process.argv[2] || '',
      validate: (v: string) =>
        /^[a-z][a-z0-9-]*$/.test(v) ? true : 'Solo minúsculas, números y guiones. Debe iniciar con letra.',
    },
    {
      type: 'text',
      name: 'description',
      message: 'Descripción corta',
      initial: 'Mi nuevo plugin VLA',
    },
    {
      type: 'text',
      name: 'author',
      message: 'Autor',
      initial: 'VLA Team',
    },
    {
      type: 'select',
      name: 'icon',
      message: 'Ícono (Lucide)',
      choices: ICONS.map(i => ({ title: i, value: i })),
      initial: 0,
    },
    {
      type: 'confirm',
      name: 'needsBitrix',
      message: '¿Necesita integración con Bitrix24?',
      initial: false,
    },
    {
      type: 'confirm',
      name: 'needsFrontend',
      message: '¿Incluir frontend (React + Tailwind + Vite)?',
      initial: true,
    },
  ], {
    onCancel: () => { console.log(chalk.red('\nCancelado.')); process.exit(1); },
  });

  const targetDir = path.resolve(process.cwd(), `vla-plugin-${answers.name}`);

  if (fs.existsSync(targetDir)) {
    console.log(chalk.red(`\n  El directorio ${targetDir} ya existe.\n`));
    process.exit(1);
  }

  console.log();
  await generatePlugin({
    name: answers.name,
    description: answers.description,
    author: answers.author,
    icon: answers.icon,
    needsBitrix: answers.needsBitrix,
    needsFrontend: answers.needsFrontend,
    targetDir,
  });

  console.log(chalk.green.bold('\n  ✓ Plugin creado exitosamente!\n'));
  console.log(chalk.white(`  cd vla-plugin-${answers.name}`));
  console.log(chalk.white('  npm install'));
  if (answers.needsFrontend) {
    console.log(chalk.white('  cd frontend && npm install && cd ..'));
  }
  console.log(chalk.white('  npm run build'));
  console.log(chalk.white('  npm run pack'));
  console.log();
  console.log(chalk.gray('  Sube el .vla.zip en Admin → Módulos → Seleccionar .vla.zip'));
  console.log();
}

main().catch(console.error);
