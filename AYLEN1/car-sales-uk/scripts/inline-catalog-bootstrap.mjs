/**
 * Embed first catalog page into public/index.html for faster first paint.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'public', 'index.html');
const limit = Number(process.env.CATALOG_INLINE_LIMIT || 24) || 24;
const base = (process.env.CATALOG_URL || process.env.VERIFY_URL || 'https://aylensale.com/').replace(/\/?$/, '/');
const apiUrl = new URL('api/storefront-catalog?limit=' + limit, base).href;

if (!fs.existsSync(indexPath)) {
  console.error('inline-catalog-bootstrap: public/index.html missing');
  process.exit(1);
}

let payload;
try {
  const res = await fetch(apiUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  payload = await res.json();
  if (!payload || payload.ok !== true) throw new Error('Invalid catalog payload');
} catch (err) {
  console.warn('inline-catalog-bootstrap: skipped —', err.message || err);
  process.exit(0);
}

const json = JSON.stringify(payload).replace(/</g, '\\u003c');
const block =
  '<script id="aylen-catalog-bootstrap" type="application/json">' +
  json +
  '</script>\n';

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<script id="aylen-catalog-bootstrap"[\s\S]*?<\/script>\s*/g, '');
const marker = '<script defer src="js/lazy-script-loader.js';
if (!html.includes(marker)) {
  console.warn('inline-catalog-bootstrap: marker not found in index.html');
  process.exit(0);
}
html = html.replace(marker, block + marker);

html = html.replace(/<link[^>]+data-aylen-catalog-preload[^>]*>\s*/g, '');

fs.writeFileSync(indexPath, html);
const items = payload.products && payload.products.items ? payload.products.items : [];
console.log('inline-catalog-bootstrap OK →', items.length, 'products embedded');
