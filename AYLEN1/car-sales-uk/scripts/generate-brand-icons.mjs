#!/usr/bin/env node
/**
 * Generate favicon PNG/ICO and PWA icons from brand SVGs.
 * Run: node scripts/generate-brand-icons.mjs
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconSvg = join(root, 'brand-a-icon.svg');
const logoAppSvg = join(root, 'brand-logo-app.svg');
const maskableSvg = join(root, 'brand-a-maskable.svg');
const faviconSvg = join(root, 'favicon.svg');
const ogSvg = join(root, 'og-brand.svg');

function resvg(input, output, width, height) {
  const fit = width ? `--fit-width ${width}` : '';
  const h = height ? `--fit-height ${height}` : '';
  execSync(`npx --yes @resvg/resvg-js-cli "${input}" "${output}" ${fit} ${h}`.trim(), {
    cwd: root,
    stdio: 'inherit'
  });
}

function writeIcoFromPngs(entries, outPath) {
  const count = entries.length;
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + count * entrySize;
  let offset = dirSize;
  const chunks = [];

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  chunks.push(header);

  for (const { size, path } of entries) {
    const png = readFileSync(path);
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    chunks.push(entry);
    chunks.push(png);
    offset += png.length;
  }

  writeFileSync(outPath, Buffer.concat(chunks));
}

if (!existsSync(iconSvg)) {
  console.error('Missing brand-a-icon.svg');
  process.exit(1);
}

const appSizes = [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['favicon-48x48.png', 48],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512]
];

for (const [name, w] of appSizes) {
  resvg(iconSvg, join(root, name), w);
}

const logoSvg = existsSync(logoAppSvg) ? logoAppSvg : iconSvg;
resvg(logoSvg, join(root, 'logo.png'), 512);
resvg(logoSvg, join(root, 'app-icon-192.png'), 192);

if (existsSync(faviconSvg)) {
  resvg(faviconSvg, join(root, 'favicon-32x32.png'), 32);
}

if (existsSync(maskableSvg)) {
  resvg(maskableSvg, join(root, 'maskable-192.png'), 192);
  resvg(maskableSvg, join(root, 'maskable-512.png'), 512);
  resvg(maskableSvg, join(root, 'pwa-icon-maskable-512.png'), 512);
}

if (existsSync(ogSvg)) {
  resvg(ogSvg, join(root, 'og-image.png'), 1200);
}

writeIcoFromPngs(
  [
    { size: 16, path: join(root, 'favicon-16x16.png') },
    { size: 32, path: join(root, 'favicon-32x32.png') },
    { size: 48, path: join(root, 'favicon-48x48.png') }
  ],
  join(root, 'favicon.ico')
);

console.log('Brand icons generated:', [
  'favicon.ico',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'maskable-192.png',
  'maskable-512.png'
].join(', '));
