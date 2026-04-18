import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath  = join(__dirname, '../public/logovla.svg');
const outDir   = join(__dirname, '../public/icons');

mkdirSync(outDir, { recursive: true });

// Crop to VLA letters only — remove the ACADEMY text row below y=310
const svg = readFileSync(svgPath, 'utf-8')
  .replace(/viewBox="0 0 785\.6 451\.7"/, 'viewBox="0 0 785.6 310"')
  .replace(/style="enable-background:new 0 0 785\.6 451\.7;"/, 'style="enable-background:new 0 0 785.6 310;"');

const buf = Buffer.from(svg);

// 192×192 standard icon
await sharp(buf)
  .resize(192, 192, { fit: 'contain', background: '#ffffff' })
  .png()
  .toFile(join(outDir, 'icon-192.png'));
console.log('✓ icon-192.png');

// 512×512 standard icon
await sharp(buf)
  .resize(512, 512, { fit: 'contain', background: '#ffffff' })
  .png()
  .toFile(join(outDir, 'icon-512.png'));
console.log('✓ icon-512.png');

// 512×512 maskable — logo fills 60% (leaves 20% safe-zone on each side)
await sharp(buf)
  .resize(307, 307, { fit: 'contain', background: '#ffffff' })
  .extend({ top: 102, bottom: 103, left: 102, right: 103, background: '#ffffff' })
  .png()
  .toFile(join(outDir, 'icon-maskable-512.png'));
console.log('✓ icon-maskable-512.png');

console.log('\nAll icons generated in apps/web/public/icons/');
