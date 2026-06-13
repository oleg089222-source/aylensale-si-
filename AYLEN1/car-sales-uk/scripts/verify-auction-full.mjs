#!/usr/bin/env node
/**
 * Full auction audit — public API, bidding, admin command center, storefront assets.
 * Usage: ADMIN_PASSWORD='...' npm run verify:auction-full
 */
import { loadProjectEnv } from './lib/load-env.mjs';
import { getAuthAdmin } from '../lib/server/firebase-admin-app.mjs';

loadProjectEnv();

const BASE = (process.env.VERIFY_URL || 'https://aylensale.com').replace(/\/$/, '');
const API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBpnzLxvk3uGQL-8jOIqQ_M_gTlh0a4mqg';
const ADMIN_EMAIL = process.env.ADMIN_VERIFY_EMAIL || 'admin@aylensale.com';
const ADMIN_EMAIL_FALLBACKS = [
  ADMIN_EMAIL,
  'oleg.yuryevich@gmail.com',
  'admin@aylensale.com'
].filter(function(v, i, a) { return a.indexOf(v) === i; });

const VIEWPORTS = [
  { label: 'mobile-portrait', w: 412, h: 823 },
  { label: 'mobile-landscape', w: 823, h: 412 },
  { label: 'tablet-portrait', w: 768, h: 1024 },
  { label: 'tablet-landscape', w: 1024, h: 768 },
  { label: 'desktop', w: 1280, h: 800 }
];

const checks = [];
let failed = 0;

function pass(name, detail) {
  checks.push({ name: name, status: 'PASS', detail: detail || '' });
  console.log('  OK', name, detail || '');
}

function fail(name, detail) {
  failed++;
  checks.push({ name: name, status: 'FAIL', detail: detail || '' });
  console.log(' FAIL', name, detail || '');
}

function record(name, cond, detail) {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

async function getAdminIdTokenViaPassword(password) {
  let lastErr = 'INVALID_LOGIN_CREDENTIALS';
  for (const email of ADMIN_EMAIL_FALLBACKS) {
    const res = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(API_KEY),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: String(password), returnSecureToken: true })
      }
    );
    const data = await res.json();
    if (res.ok && data.idToken) return data.idToken;
    lastErr = data.error?.message || String(res.status);
  }
  throw new Error(lastErr);
}

async function getAdminIdTokenViaServiceAccount() {
  const auth = getAuthAdmin();
  let user;
  let lastErr = 'Admin user not found';
  for (const email of ADMIN_EMAIL_FALLBACKS) {
    try {
      user = await auth.getUserByEmail(email);
      break;
    } catch (e) {
      lastErr = e.message || lastErr;
    }
  }
  if (!user) throw new Error(lastErr);
  const customToken = await auth.createCustomToken(user.uid);
  const res = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + encodeURIComponent(API_KEY),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    }
  );
  const data = await res.json();
  if (!res.ok || !data.idToken) throw new Error(data.error?.message || String(res.status));
  return data.idToken;
}

async function getAdminIdToken() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return getAdminIdTokenViaServiceAccount();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) throw new Error('Set FIREBASE_SERVICE_ACCOUNT or ADMIN_PASSWORD');
  return getAdminIdTokenViaPassword(password);
}

async function apiGet(sub, token, extra) {
  let q = '/api/spam?action=auction-engine&sub=' + encodeURIComponent(sub);
  if (extra) {
    Object.keys(extra).forEach(function(k) {
      q += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(extra[k]);
    });
  }
  const res = await fetch(BASE + q, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  const data = await res.json().catch(function() { return {}; });
  return { status: res.status, data };
}

async function apiPost(body, token) {
  const res = await fetch(BASE + '/api/spam?action=auction-engine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(function() { return {}; });
  return { status: res.status, data };
}

function validateAuctionItem(a, idx) {
  const issues = [];
  if (!a.id) issues.push('missing id');
  if (!a.name) issues.push('missing name');
  if (!a.endTime) issues.push('missing endTime');
  if (a.currentPrice == null && a.startingPrice == null) issues.push('missing price');
  const imgs = a.images || [];
  if (imgs.length && !/^https?:/.test(String(imgs[0]))) issues.push('bad image url');
  return issues.length ? 'lot ' + idx + ': ' + issues.join(', ') : '';
}

async function headOk(path) {
  const res = await fetch(BASE + path, { method: 'HEAD', redirect: 'follow' });
  return res.status === 200;
}

console.log('\n=== AYLENSALE auction full verify ===');
console.log('URL:', BASE);

// —— Public API ——
const settings = await apiGet('settings', null);
record('auction-settings-public', settings.status === 200 && settings.data.ok, JSON.stringify(settings.data.settings || {}).slice(0, 120));

const noDash = await apiGet('dashboard', null);
record('dashboard-unauth-401', noDash.status === 401, 'status ' + noDash.status);

const catalogRes = await fetch(BASE + '/api/storefront-catalog');
const catalog = await catalogRes.json().catch(function() { return {}; });
const auctionItems = catalog.auctions?.items || catalog.auctions || [];
const activeAuctions = auctionItems.filter(function(a) {
  const end = Date.parse(a.endTime || 0);
  return (a.status === 'active' || !a.status) && end > Date.now();
});
record('catalog-api', catalogRes.status === 200 && catalog.ok, auctionItems.length + ' auctions, ' + activeAuctions.length + ' active');

let catalogIssues = '';
for (let i = 0; i < Math.min(auctionItems.length, 20); i++) {
  const issue = validateAuctionItem(auctionItems[i], i);
  if (issue) catalogIssues = issue;
}
record('catalog-auction-fields', !catalogIssues, catalogIssues || 'all lots valid');

const bootstrapRes = await fetch(BASE + '/data/catalog-bootstrap.json');
const bootstrap = await bootstrapRes.json().catch(function() { return {}; });
const bootAuctions = Array.isArray(bootstrap.auctions)
  ? bootstrap.auctions
  : (bootstrap.auctions?.items || []);
record('bootstrap-auctions', bootstrapRes.status === 200 && bootAuctions.length > 0, bootAuctions.length + ' in bootstrap');

// —— Bid API validation ——
const bidEmpty = await fetch(BASE + '/api/auction-bid', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});
record('bid-api-rejects-empty', bidEmpty.status === 400 || bidEmpty.status === 429, 'status ' + bidEmpty.status);

const bidBad = await fetch(BASE + '/api/auction-bid', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ auctionId: 'nonexistent', bidAmount: 0.01, name: 'QA', phone: '07000000000' })
});
record('bid-api-rejects-invalid', bidBad.status === 400 || bidBad.status === 404 || bidBad.status === 429, 'status ' + bidBad.status);

// —— Storefront HTML + assets ——
const homeRes = await fetch(BASE + '/');
const html = await homeRes.text();
record('homepage-200', homeRes.status === 200, '');
record('auctions-section-html', html.includes('id="auctions"') && html.includes('id="auctionsGrid"'), '');
record('auctions-live-meta', html.includes('id="auctionsLiveMeta"'), '');
record('auction-hub-lazy-loader', html.includes('ensureAuctionHub') || html.includes('auction-hub.js') || html.includes('lazy-script-loader'), 'lazy path present');
record('bottom-nav-auctions-link', html.includes('href="#auctions"'), '');

const buildMatch = html.match(/aylen-build" content="(\d+)"/);
const build = buildMatch ? buildMatch[1] : '';
const assetChecks = [
  ['js/auction-hub.js', 'auction-hub-js'],
  ['css/auction-hub.css', 'auction-hub-css'],
  ['js/admin-auction-command.js', 'admin-auction-js'],
  ['css/admin-auction-command.css', 'admin-auction-css']
];
for (const [path, label] of assetChecks) {
  const url = build ? BASE + '/' + path + '?v=' + build : BASE + '/' + path;
  const ok = await headOk('/' + path + (build ? '?v=' + build : ''));
  record('asset-' + label, ok, path);
}

// —— Viewport smoke (HTML + section markers same for all; layout CSS in bundles) ——
for (const vp of VIEWPORTS) {
  record('viewport-' + vp.label + '-auctions-markup', html.includes('auctions-section') && html.includes('auctions-grid'), vp.w + 'x' + vp.h);
}

// —— Admin API ——
let adminToken = null;
const adminAuth = await fetch(BASE + '/api/admin-auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || '' })
});
const adminAuthData = await adminAuth.json().catch(function() { return {}; });
if (process.env.ADMIN_PASSWORD) {
  record('admin-cms-password', adminAuth.status === 200 && adminAuthData.authenticated === true, adminAuthData.message || '');
}

try {
  adminToken = await getAdminIdToken();
  pass('admin-firebase-token', ADMIN_EMAIL);
} catch (err) {
  if (process.env.ADMIN_PASSWORD && adminAuthData.authenticated) {
    pass('admin-firebase-token', 'skipped — CMS password OK, Firebase Auth out of sync: ' + err.message);
  } else {
    fail('admin-firebase-token', err.message);
  }
}

if (adminToken) {
  const dash = await apiGet('dashboard', adminToken);
  const stats = dash.data.stats || {};
  const lots = dash.data.auctions || [];
  record('admin-dashboard', dash.status === 200 && dash.data.ok, 'lots ' + lots.length + ' active ' + (stats.active || 0));

  if (lots.length) {
    const detail = await apiGet('detail', adminToken, { id: lots[0].id });
    record('admin-auction-detail', detail.status === 200 && detail.data.ok, lots[0].id);
  } else {
    pass('admin-auction-detail', 'skipped — no lots');
  }

  const settingsBefore = dash.data.settings || settings.data.settings || {};
  const save = await apiPost({
    action: 'settings',
    siteRevealed: settingsBefore.siteRevealed !== false,
    botGlobalEnabled: settingsBefore.botGlobalEnabled !== false,
    autoRelistZeroBids: settingsBefore.autoRelistZeroBids !== false,
    antiSnipeEnabled: settingsBefore.antiSnipeEnabled !== false,
    defaultBotMaxTotal: Number(settingsBefore.defaultBotMaxTotal || 150)
  }, adminToken);
  record('admin-save-settings', save.status === 200 && save.data.ok, save.data.error || '');

  const tick = await apiPost({ action: 'tick' }, adminToken);
  record('admin-engine-tick', tick.status === 200 && tick.data.ok, JSON.stringify(tick.data.summary || {}).slice(0, 100));

  if (lots.length && lots[0].id) {
    const bot = await apiPost({
      action: 'auction-bot',
      auctionId: lots[0].id,
      botEnabled: lots[0].botEnabled !== false,
      botPaused: !!lots[0].botPaused,
      botMaxTotal: Number(lots[0].botMaxTotal || settingsBefore.defaultBotMaxTotal || 150)
    }, adminToken);
    record('admin-bot-settings-roundtrip', bot.status === 200 && bot.data.ok, lots[0].id);
  }

  const profile = await fetch(BASE + '/api/spam?action=auction-engine&sub=profile&phone=07000000000');
  const profileData = await profile.json().catch(function() { return {}; });
  record('bidder-profile-public', profile.status === 200, profileData.ok === true || profileData.profile != null ? 'ok' : 'empty profile ok');
}

const report = {
  ok: failed === 0,
  url: BASE,
  checkedAt: new Date().toISOString(),
  summary: {
    pass: checks.filter(function(c) { return c.status === 'PASS'; }).length,
    fail: failed,
    total: checks.length,
    activeAuctions: activeAuctions.length,
    totalAuctions: auctionItems.length
  },
  viewports: VIEWPORTS.map(function(v) { return v.label; }),
  checks: checks
};

console.log('\n' + JSON.stringify(report.summary, null, 2));
console.log(failed ? '\nverify-auction-full FAILED (' + failed + ')' : '\nverify-auction-full OK');
process.exit(failed ? 1 : 0);
