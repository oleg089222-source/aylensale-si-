/**
 * Concatenate + minify storefront JS into core and features bundles.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CORE_SOURCES = [
  'js/site-config.js',
  'js/site-defaults.js',
  'js/site-content.js',
  'js/runtime-env.js',
  'js/config.js',
  'js/listing-policies-stub.js',
  'js/production-store.js',
  'js/firebase-db.js',
  'js/branding-runtime.js',
  'js/firebase-catalog.js',
  'js/image-utils.js',
  'js/data.js',
  'js/catalog-pagination.js',
  'js/perf-mode.js',
  'js/scroll-guard.js',
  'js/product-nav.js',
  'js/mobile-ui.js',
  'js/storefront-collapsible.js',
  'js/app.js'
];

const INTERACTION_SOURCES = [
  'js/modal-manager.js',
  'js/listing-policies.js',
  'js/discount-engine.js',
  'js/security.js',
  'js/spam-turnstile.js',
  'js/compliance.js',
  'js/web-vitals-rum.js',
  'js/seo.js'
];

const FEATURES_SOURCES = [
  'js/pickup-weather.js',
  'js/pickup-locations.js',
  'js/vip-shop-bridge.js',
  'js/pwa-install.js'
];

async function bundle(name, sources) {
  const parts = [
    '/* AYLENSALE ' + name + ' — generated, do not edit */'
  ];
  for (const rel of sources) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
      console.error('bundle-storefront-js: missing', rel);
      process.exit(1);
    }
    parts.push('/* --- ' + rel + ' --- */');
    parts.push(fs.readFileSync(full, 'utf8'));
  }
  const tmpPath = path.join(root, '.tmp-' + name + '.js');
  const outPath = path.join(root, 'js', name + '.bundle.js');
  fs.writeFileSync(tmpPath, parts.join('\n') + '\n');
  try {
    await esbuild.build({
      entryPoints: [tmpPath],
      outfile: outPath,
      minify: true,
      allowOverwrite: true,
      logLevel: 'silent'
    });
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
  const size = fs.statSync(outPath).size;
  console.log('bundle-storefront-js OK → js/' + name + '.bundle.js (' + sources.length + ' files, ' + Math.round(size / 1024) + ' KB)');
}

await bundle('storefront-core', CORE_SOURCES);
await bundle('storefront-interaction', INTERACTION_SOURCES);
await bundle('storefront-features', FEATURES_SOURCES);

const ADMIN_DB_SOURCES = ['js/inventory-core.js', 'js/firebase-db-admin.js'];
await bundle('firebase-db-admin', ADMIN_DB_SOURCES);
