/**
 * Vercel build: copy static storefront into ./public (API stays at project root).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const bundleQr = spawnSync(process.execPath, ['scripts/bundle-qrcode.mjs'], {
  cwd: root,
  stdio: 'inherit'
});
if (bundleQr.status !== 0) {
  process.exit(bundleQr.status || 1);
}
const outDir = path.join(root, 'public');

const COPY_DIRS = ['css', 'js'];
const COPY_FILE_EXTS = new Set([
  '.html', '.json', '.xml', '.txt', '.js', '.svg', '.ico', '.png', '.webp', '.webmanifest', '.jpeg', '.jpg'
]);

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(name) {
  const src = path.join(root, name);
  const dest = path.join(outDir, name);
  if (!fs.existsSync(src)) {
    console.error('vercel-build: missing directory', name);
    process.exit(1);
  }
  fs.cpSync(src, dest, { recursive: true });
}

rmDir(outDir);
fs.mkdirSync(outDir, { recursive: true });

COPY_DIRS.forEach(copyDir);

for (const name of fs.readdirSync(root)) {
  const src = path.join(root, name);
  let stat;
  try {
    stat = fs.statSync(src);
  } catch (e) {
    continue;
  }
  if (!stat.isFile()) continue;
  if (name === 'package.json' || name === 'package-lock.json') continue;
  const ext = path.extname(name).toLowerCase();
  if (!COPY_FILE_EXTS.has(ext)) continue;
  fs.copyFileSync(src, path.join(outDir, name));
}

const brandSource = path.join(root, 'assets', 'brand-source.jpeg');
if (fs.existsSync(brandSource)) {
  fs.copyFileSync(brandSource, path.join(outDir, 'brand-logo.jpeg'));
}

if (!fs.existsSync(path.join(outDir, 'index.html'))) {
  console.error('vercel-build: index.html missing in public/');
  process.exit(1);
}

console.log('vercel-build OK → public/');
