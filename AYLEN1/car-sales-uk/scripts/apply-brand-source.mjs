#!/usr/bin/env node
/**
 * Build PWA / favicon PNGs from assets/brand-source.jpeg (your logo file).
 * Default source: assets/brand-source.jpeg
 * Override: BRAND_SOURCE=/path/to/photo.jpeg node scripts/apply-brand-source.mjs
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { generateIconSet } from '../api/lib/branding-icons.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'assets');
const defaultSource = join(assetsDir, 'brand-source.jpeg');

const sourcePath = process.env.BRAND_SOURCE || defaultSource;

if (!existsSync(sourcePath)) {
  console.error('Brand source not found:', sourcePath);
  console.error('Copy your logo JPEG to assets/brand-source.jpeg or set BRAND_SOURCE.');
  process.exit(1);
}

if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });

if (sourcePath !== defaultSource && !existsSync(defaultSource)) {
  copyFileSync(sourcePath, defaultSource);
  console.log('Saved copy → assets/brand-source.jpeg');
}

copyFileSync(defaultSource, join(root, 'brand-logo.jpeg'));

const input = await import('fs').then((fs) => fs.readFileSync(sourcePath));
const icons = await generateIconSet(input);

const writes = [
  ['favicon-16x16.png', icons['icon-16']],
  ['favicon-32x32.png', icons['icon-32']],
  ['favicon-48x48.png', icons['icon-48']],
  ['apple-touch-icon.png', icons['apple-touch-icon']],
  ['icon-192.png', icons['icon-192']],
  ['app-icon-192.png', icons['icon-192']],
  ['icon-512.png', icons['icon-512']],
  ['logo.png', icons['icon-512']],
  ['maskable-192.png', icons['maskable-192']],
  ['maskable-512.png', icons['maskable-512']],
  ['pwa-icon-maskable-512.png', icons['maskable-512']],
  ['favicon.ico', icons['favicon.ico']]
];

for (const [name, buf] of writes) {
  writeFileSync(join(root, name), buf);
}

console.log('Brand icons applied from:', sourcePath);
console.log('Updated:', writes.map(([n]) => n).join(', '));
