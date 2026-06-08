/**
 * Concatenate non-critical storefront CSS into one deferred bundle.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFERRED_SOURCES = [
  'css/pwa-install.css',
  'css/phase-2-marketplace.css',
  'css/storefront-modals.css',
  'css/pdp-modal.css',
  'css/mobile-marketplace.css',
  'css/mobile-pwa-ui.css',
  'css/storefront-polish.css',
  'css/pickup-section.css',
  'css/discount-highlight.css',
  'css/price-list-cta.css',
  'css/storefront-collapsible.css',
  'css/loyalty-portal.css',
  'css/auction-hub.css',
  'css/storefront-layout-fix.css'
];

const outPath = path.join(root, 'css', 'storefront-deferred.bundle.css');
const parts = [
  '/* AYLENSALE deferred storefront CSS — generated, do not edit */'
];

for (const rel of DEFERRED_SOURCES) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error('bundle-storefront-css: missing', rel);
    process.exit(1);
  }
  parts.push('/* --- ' + rel + ' --- */');
  parts.push(fs.readFileSync(full, 'utf8'));
}

fs.writeFileSync(outPath, parts.join('\n') + '\n');
console.log('bundle-storefront-css OK → css/storefront-deferred.bundle.css (' + DEFERRED_SOURCES.length + ' files)');
