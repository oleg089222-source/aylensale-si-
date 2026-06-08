/**
 * Static smoke check — no production deploy.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'index.html',
  'js/app.js',
  'js/firebase-db.js',
  'api/send-order.js',
  'css/contact-float.css',
  'css/mobile-marketplace.css'
];

const syntaxCheckFiles = [
  'js/app.js',
  'js/firebase-db.js',
  'js/data.js',
  'js/scroll-guard.js',
  'js/pwa-install.js',
  'js/modal-manager.js',
  'js/pickup-locations.js',
  'public/js/app.js',
  'public/js/firebase-db.js',
  'public/js/scroll-guard.js',
  'public/js/lazy-script-loader.js',
  'public/js/admin-bootstrap.js',
  'public/js/storefront-core.bundle.js'
];

let ok = true;

function checkJsSyntax(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return;
  try {
    execSync(`node --check "${full}"`, { stdio: 'pipe' });
  } catch (err) {
    console.error('JS syntax error:', rel);
    const detail = err.stderr?.toString().trim() || err.stdout?.toString().trim() || err.message;
    if (detail) console.error(detail);
    ok = false;
  }
}

for (const rel of required) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error('Missing:', rel);
    ok = false;
  }
}

const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
if (app.indexOf('reserveOrderStock') === -1 && app.indexOf('stock_unavailable') === -1) {
  console.warn('Note: stock_unavailable handling should exist in app.js');
}
if (app.indexOf('updateCartFloatBar') === -1) {
  console.warn('Note: updateCartFloatBar not in app.js (baseline storefront)');
}

const publicIndex = path.join(root, 'public', 'index.html');
if (!fs.existsSync(publicIndex)) {
  console.error('Missing: public/index.html — run vercel-build first');
  ok = false;
} else {
  const pubHtml = fs.readFileSync(publicIndex, 'utf8');
  if (!pubHtml.includes('admin-bootstrap.js') && !pubHtml.includes('admin-loader.js')) {
    console.error('public/index.html is stale (no admin bootstrap) — run: npm run build');
    ok = false;
  }
  if (!pubHtml.includes('storefront-core.bundle.js')) {
    console.error('public/index.html is stale (no storefront-core.bundle.js) — run: npm run build');
    ok = false;
  }
  for (const rel of [
    'public/js/admin-gate.js',
    'public/js/admin-session.js',
    'public/js/discount-engine.js',
    'public/js/admin-price-list-panel.js',
    'public/js/admin-discount-cards-panel.js'
  ]) {
    if (!fs.existsSync(path.join(root, rel))) {
      console.error('Missing after build:', rel);
      ok = false;
    }
  }
  const dash = path.join(root, 'public/js/admin-dashboard.js');
  if (fs.existsSync(dash)) {
    const dashSrc = fs.readFileSync(dash, 'utf8');
    if (!dashSrc.includes('aylen-quick-bar')) {
      console.error('public/js/admin-dashboard.js is stale — run: npm run build');
      ok = false;
    }
  }
  const adminSession = path.join(root, 'public/js/admin-session.js');
  if (fs.existsSync(adminSession)) {
    const src = fs.readFileSync(adminSession, 'utf8');
    if (src.includes('setRememberEnabled: setRememberEnabled')) {
      console.error('public/js/admin-session.js exports missing setRememberEnabled — run: npm run build');
      ok = false;
    }
  }
}

for (const rel of syntaxCheckFiles) {
  checkJsSyntax(rel);
}

if (!ok) process.exit(1);
console.log('smoke-check OK —', required.length, 'source files, public/index.html ready, JS syntax clean');
