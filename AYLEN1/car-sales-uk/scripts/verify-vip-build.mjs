#!/usr/bin/env node
/** Static VIP UI/build checks (no network). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ok = (s) => console.log('\x1b[32m✓\x1b[0m', s);
const fail = (s) => { console.log('\x1b[31m✗\x1b[0m', s); process.exitCode = 1; };

const files = [
  'js/vip-carousel-defaults.js',
  'js/vip-stock.js',
  'api/lib/vip-carousel-defaults.mjs',
  'api/lib/vip-store.mjs',
  'vip-stock.html',
  'vip-live-preview.html',
  'css/vip-glass-hub.css'
];

files.forEach(function(f) {
  if (!fs.existsSync(path.join(root, f))) fail('Missing ' + f);
  else ok('Found ' + f);
});

const vipStock = fs.readFileSync(path.join(root, 'js/vip-stock.js'), 'utf8');
const checks = [
  ['resolveHubCarousel', /function resolveHubCarousel/],
  ['vip-glass-hero--warehouse', /vip-glass-hero--warehouse/],
  ['Amazon warehouse badge', /Amazon returns warehouse/],
  ['hubHeroTimer cleanup', /hubHeroTimer/],
  ['vip-carousel-defaults script in vip-stock.html', /vip-carousel-defaults\.js/]
];

checks.forEach(function(pair) {
  const inVip = pair[0].indexOf('vip-stock.html') >= 0
    ? fs.readFileSync(path.join(root, 'vip-stock.html'), 'utf8')
    : vipStock;
  if (pair[1].test(inVip)) ok(pair[0]);
  else fail(pair[0]);
});

const store = fs.readFileSync(path.join(root, 'api/lib/vip-store.mjs'), 'utf8');
if (/DEFAULT_VIP_HUB_CAROUSEL/.test(store) && !/hubCarouselImages: hubCarouselImages/.test(store)) {
  ok('Hub carousel no longer falls back to paywall warehouse in store');
} else if (/DEFAULT_VIP_HUB_CAROUSEL/.test(store)) {
  ok('VIP store hub carousel defaults');
} else {
  fail('VIP store hub carousel defaults');
}

if (process.exitCode) {
  console.log('\nVIP build verify FAILED');
  process.exit(1);
}
console.log('\nVIP build verify OK');
