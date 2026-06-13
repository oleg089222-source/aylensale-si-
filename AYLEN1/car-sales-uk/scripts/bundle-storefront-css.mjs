/**
 * Concatenate storefront CSS bundles for homepage shell + lazy pages.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Above-the-fold: blocking sheet (cards, header). Hero reset lives in inline critical CSS. */
const SHELL_CRITICAL_SOURCES = [
  'css/ds-v2-tokens.css',
  'css/storefront-cls-guard.css',
  'css/storefront-inline-reset.css',
  'css/header-card-bar.css',
  'css/storefront-header-brand.css',
  'css/ds-v2-header.css',
  'css/products-section.css',
  'css/tablet-storefront-layout.css',
  'css/ebay-promo.css',
  'css/price-list-cta.css',
  'css/product-card-compact-guard.css',
  'css/mobile-perf.css',
  'css/storefront-icons.css',
  'css/phase6-perf-images.css',
  'css/ds-v2-base.css',
  'css/ds-v2-buttons.css',
  'css/ds-v2-forms.css',
  'css/product-card-v2.css'
];

/** Icons, legacy layout, modals: non-blocking async load. */
const SHELL_DEFERRED_SOURCES = [
  'css/hero-actions-hub.css',
  'css/contact-float.css',
  'css/mobile-marketplace.css',
  'css/storefront-inline-legacy.css',
  'css/phase-2-marketplace.css',
  'css/mobile-app-shell.css',
  'css/mobile-pwa-ui.css',
  'css/storefront-polish.css',
  'css/storefront-layout-fix.css',
  'css/storefront-modals.css',
  'css/pwa-install.css',
  'css/pickup-section.css',
  'css/discount-highlight.css',
  'css/storefront-collapsible.css',
  'css/storefront-layout-restore.css',
  'css/ds-v2-modals.css',
  'css/ds-v2-nav.css',
  'css/ds-v2-shell.css',
  'css/auction-card-v2.css',
  'css/pickup-card-v2.css',
  'css/vip-card-v2.css'
];

const LAZY_PAGE_SOURCES = [
  'css/pdp-modal.css',
  'css/loyalty-portal.css',
  'css/auction-hub.css'
];

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/\s*([{}:;,>~])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

function writeBundle(name, sources) {
  const parts = ['/* AYLENSALE ' + name + ' — generated, do not edit */'];
  for (const rel of sources) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
      console.error('bundle-storefront-css: missing', rel);
      process.exit(1);
    }
    parts.push('/* --- ' + rel + ' --- */');
    parts.push(fs.readFileSync(full, 'utf8'));
  }
  const outPath = path.join(root, 'css', name + '.bundle.css');
  const raw = parts.join('\n') + '\n';
  fs.writeFileSync(outPath, minifyCss(raw) + '\n');
  const size = Math.round(fs.statSync(outPath).size / 1024);
  console.log('bundle-storefront-css OK → css/' + name + '.bundle.css (' + sources.length + ' files, ' + size + ' KB)');
}

writeBundle('storefront-shell-critical', SHELL_CRITICAL_SOURCES);
writeBundle('storefront-shell-deferred', SHELL_DEFERRED_SOURCES);
writeBundle('storefront-shell', SHELL_CRITICAL_SOURCES.concat(SHELL_DEFERRED_SOURCES));
writeBundle('storefront-deferred', LAZY_PAGE_SOURCES);
