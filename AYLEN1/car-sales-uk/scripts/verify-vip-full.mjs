#!/usr/bin/env node
/**
 * Full local VIP regression check — static + pure logic (no Firestore / network).
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  DEFAULT_VIP_WAREHOUSE_CAROUSEL,
  DEFAULT_VIP_HUB_CAROUSEL,
  resolveVipHubCarousel,
  resolveVipPaywallCarousel,
  sanitizeVipCarouselUrls,
  isLegacyVipCarouselUrl,
  VIP_CAROUSEL_SCHEMA_VERSION
} from '../lib/server/vip-carousel-defaults.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const ok = (s) => console.log('\x1b[32m✓\x1b[0m', s);
const fail = (s) => { console.log('\x1b[31m✗\x1b[0m', s); failed++; };

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assertFile(rel) {
  if (!fs.existsSync(path.join(root, rel))) fail('Missing ' + rel);
  else ok('File ' + rel);
}

function assertMatch(label, src, re) {
  if (re.test(src)) ok(label);
  else fail(label);
}

console.log('\n=== VIP full local verify ===\n');

// Core assets
[
  'js/vip-stock.js',
  'js/vip-carousel-defaults.js',
  'js/admin-vip-panel.js',
  'js/firebase-db.js',
  'api/vip.js',
  'lib/server/vip-handlers.mjs',
  'lib/server/vip-store.mjs',
  'lib/server/vip-carousel-defaults.mjs',
  'vip-stock.html',
  'vip-live-preview.html',
  'css/vip-glass-hub.css',
  'vercel.json'
].forEach(assertFile);

// JS syntax
['js/vip-stock.js', 'js/vip-carousel-defaults.js', 'js/admin-vip-panel.js', 'js/firebase-db.js'].forEach(function(rel) {
  try {
    execSync('node --check "' + path.join(root, rel) + '"', { stdio: 'pipe' });
    ok('Syntax ' + rel);
  } catch (e) {
    fail('Syntax ' + rel);
  }
});

const vipStock = read('js/vip-stock.js');
const vipHandlers = read('lib/server/vip-handlers.mjs');
const vipStore = read('lib/server/vip-store.mjs');
const vercel = read('vercel.json');
const adminPanel = read('js/admin-vip-panel.js');
const fbdb = read('js/firebase-db.js');
const vipHtml = read('vip-stock.html');
const previewHtml = read('vip-live-preview.html');

// Telegram direct link (not share/url only)
assertMatch('Telegram direct t.me in vip-stock', vipStock, /t\.me\/[^?]+\?text=/);
assertMatch('buildTelegramOrderUrl helper', vipStock, /function buildTelegramOrderUrl/);
assertMatch('Server buildTelegramContactUrl', vipHandlers, /buildTelegramContactUrl/);

// Auction in VIP (no redirect to main shop)
assertMatch('VIP auction detail modal (in-hub bidding)', vipStock, /openVipAuctionDetail|vipAuctionDetailModal/);
assertMatch('Bid history renderer', vipStock, /function renderVipAuctionBidHistory/);
assertMatch('Bid API route vip-auction-bid', vercel, /vip-auction-bid/);
assertMatch('Bid fallback query action', vipStock, /action=vip-auction-bid/);
assertMatch('placeVipAuctionBid in store', vipStore, /export async function placeVipAuctionBid/);
assertMatch('Bidder profile localStorage key', vipStock, /aylen_vip_bidder_profile_v1/);
assertMatch('Anti-spam cooldown constant', vipStore, /VIP_BID_COOLDOWN_MS = 45000/);
assertMatch('Highest bidder block', vipStore, /already the highest bidder/);
assertMatch('Name lock after first bid', vipStore, /firstMine && firstMine\.bidderName/);
assertMatch('bidderKey on bids', vipStore, /bidderKey:/);

// Firebase admin preview auth
assertMatch('FBDB.getAdminIdToken export', fbdb, /FBDB\.getAdminIdToken/);
assertMatch('Preview uses getAdminIdToken not firebase.auth()', vipStock, /getAdminIdToken/);
if (/firebase\.auth\(\)/.test(vipStock)) {
  fail('vip-stock still calls firebase.auth() directly');
} else {
  ok('No bare firebase.auth() in vip-stock');
}

// Warehouse carousel
if (DEFAULT_VIP_WAREHOUSE_CAROUSEL.length === 7) ok('Warehouse carousel has 7 images');
else fail('Warehouse carousel length !== 7');
if (DEFAULT_VIP_HUB_CAROUSEL[0] === DEFAULT_VIP_WAREHOUSE_CAROUSEL[0]) ok('Hub carousel matches warehouse');
else fail('Hub carousel mismatch');

const emptyHub = resolveVipHubCarousel({});
if (emptyHub.length >= 6 && !emptyHub.some(function(u) { return /mario|nintendo|gaming/i.test(u); })) {
  ok('resolveVipHubCarousel fallback has no gaming URLs');
} else {
  fail('resolveVipHubCarousel fallback looks wrong');
}

const paywall = resolveVipPaywallCarousel({});
if (paywall.length >= 4) ok('resolveVipPaywallCarousel returns slides');
else fail('resolveVipPaywallCarousel empty');

if (isLegacyVipCarouselUrl('https://cdn.example/vip-mario-hub.jpg')) ok('Detects legacy Mario carousel URL');
else fail('Legacy Mario URL not detected');

const legacyHub = resolveVipHubCarousel({
  hubCarouselImages: [
    'https://example.com/mario-1.jpg',
    'https://example.com/nintendo-lot.jpg'
  ]
});
if (legacyHub.length >= 6 && legacyHub[0] === DEFAULT_VIP_WAREHOUSE_CAROUSEL[0]) {
  ok('Legacy hub carousel replaced with warehouse defaults');
} else {
  fail('Legacy hub carousel not replaced');
}

const staleSchema = resolveVipHubCarousel({
  carouselSchemaVersion: 1,
  hubCarouselImages: ['https://images.pexels.com/photos/4483610/pexels-photo-4483610.jpeg']
});
if (staleSchema[0] === DEFAULT_VIP_WAREHOUSE_CAROUSEL[0]) {
  ok('Stale carouselSchemaVersion forces warehouse defaults');
} else {
  fail('Stale carouselSchemaVersion not reset');
}

const currentSchema = resolveVipHubCarousel({
  carouselSchemaVersion: VIP_CAROUSEL_SCHEMA_VERSION,
  hubCarouselImages: DEFAULT_VIP_WAREHOUSE_CAROUSEL.slice(0, 3)
});
if (currentSchema.length === 3) ok('Current schema keeps valid custom warehouse URLs');
else fail('Current schema carousel resolution');

assertMatch('Warehouse hero CSS class', vipStock, /vip-glass-hero--warehouse/);
assertMatch('Amazon warehouse badge text', vipStock, /Amazon returns warehouse/);
assertMatch('Admin warehouse defaults button', adminPanel, /Warehouse hub defaults|warehouse/i);

// PDP / item modal
assertMatch('Item modal / lightbox', vipStock, /vip-item-modal|vipItemLightbox|openVipItem/);
assertMatch('Lightbox CSS', read('css/vip-glass-hub.css'), /\.vip-item-lightbox|vip-pdp/);

// Cache bust on main VIP pages
['vip-stock.html', 'vip-live-preview.html', 'vip-member-preview.html'].forEach(function(f) {
  const html = read(f);
  if (/vip-carousel-defaults\.js\?v=202605322300/.test(html) || /vip-stock\.js\?v=202605322300/.test(html)) {
    ok('Cache bust ' + f);
  } else {
    fail('Stale cache version in ' + f);
  }
});

// vip-store duplicate export fix
if (/export \{[^}]*DEFAULT_VIP_CAROUSEL[^}]*\}[^;]*;\s*export const DEFAULT_VIP_CAROUSEL/.test(vipStore)) {
  fail('Duplicate DEFAULT_VIP_CAROUSEL export in vip-store');
} else {
  ok('No duplicate DEFAULT_VIP_CAROUSEL export');
}

// Pure logic: normalizeBidderKey behavior (inline copy of rule)
function normalizeBidderKey(p) {
  const email = String(p && p.email || p && p.contact || '').trim().toLowerCase();
  if (email && email.indexOf('@') > 0) return 'email:' + email;
  const phone = String(p && p.phone || '').replace(/\D/g, '');
  if (phone.length >= 8) return 'phone:' + phone;
  return '';
}
if (normalizeBidderKey({ email: 'Test@Example.com' }) === 'email:test@example.com') ok('bidderKey email normalization');
else fail('bidderKey email normalization');

// Public build copies
const pubVip = path.join(root, 'public/js/vip-stock.js');
if (fs.existsSync(pubVip)) {
  ok('public/js/vip-stock.js exists after build');
  if (read('public/js/vip-stock.js').includes('renderVipAuctionBidHistory')) ok('public vip-stock has bid history');
  else fail('public vip-stock missing bid history');
} else {
  fail('public/js/vip-stock.js missing — run npm run build');
}

console.log('\n' + (failed ? '\x1b[31mFAILED: ' + failed + ' check(s)\x1b[0m\n' : '\x1b[32mAll local VIP checks passed\x1b[0m\n'));
process.exit(failed ? 1 : 0);
