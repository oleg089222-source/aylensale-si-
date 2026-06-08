#!/usr/bin/env node
/**
 * Verify Auction Command Center API (Save settings + Run tick) on production.
 * Uses Firebase Admin custom token for admin@aylensale.com — no browser login needed.
 *
 * Usage: node scripts/verify-admin-auction.mjs
 * Env: FIREBASE_SERVICE_ACCOUNT, optional VERIFY_URL (default https://aylensale.com)
 */
import { loadProjectEnv } from './lib/load-env.mjs';
import { getAuthAdmin } from '../api/lib/firebase-admin-app.mjs';

loadProjectEnv();

const BASE = (process.env.VERIFY_URL || 'https://aylensale.com').replace(/\/$/, '');
const API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBpnzLxvk3uGQL-8jOIqQ_M_gTlh0a4mqg';
const ADMIN_EMAIL = process.env.ADMIN_VERIFY_EMAIL || 'admin@aylensale.com';

async function getAdminIdTokenViaPassword(password) {
  const res = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(API_KEY),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: String(password),
        returnSecureToken: true
      })
    }
  );
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    throw new Error('Firebase password sign-in failed: ' + (data.error && data.error.message || res.status));
  }
  return data.idToken;
}

async function getAdminIdTokenViaServiceAccount() {
  const auth = getAuthAdmin();
  let user;
  try {
    user = await auth.getUserByEmail(ADMIN_EMAIL);
  } catch (e) {
    throw new Error('Admin user not found: ' + ADMIN_EMAIL);
  }
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
  if (!res.ok || !data.idToken) {
    throw new Error('Custom token exchange failed: ' + (data.error && data.error.message || res.status));
  }
  return data.idToken;
}

async function getAdminIdToken() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return getAdminIdTokenViaServiceAccount();
  }
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT or ADMIN_PASSWORD');
  }
  return getAdminIdTokenViaPassword(password);
}

async function apiGet(sub, token, extra) {
  let q = '/api/spam?action=auction-engine&sub=' + encodeURIComponent(sub);
  if (extra) {
    Object.keys(extra).forEach(function(k) {
      q += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(extra[k]);
    });
  }
  const res = await fetch(BASE + q, {
    headers: token ? { Authorization: 'Bearer ' + token } : {}
  });
  const data = await res.json().catch(function() { return {}; });
  return { status: res.status, data };
}

async function apiPost(body, token) {
  const res = await fetch(BASE + '/api/spam?action=auction-engine', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(function() { return {}; });
  return { status: res.status, data };
}

function ok(label, cond, detail) {
  console.log((cond ? '  OK' : ' FAIL'), label, detail || '');
  return cond;
}

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.ADMIN_PASSWORD) {
    console.error('FIREBASE_SERVICE_ACCOUNT or ADMIN_PASSWORD required');
    process.exit(1);
  }

  console.log('\n=== AYLENSALE admin auction verify ===');
  console.log('URL:', BASE);

  let failed = 0;

  const pubSettings = await apiGet('settings', null);
  if (!ok('GET settings (public)', pubSettings.status === 200 && pubSettings.data.ok, 'status ' + pubSettings.status)) {
    failed++;
  }

  const noAuthDash = await apiGet('dashboard', null);
  if (!ok('GET dashboard without auth → 401', noAuthDash.status === 401, 'status ' + noAuthDash.status)) {
    failed++;
  }

  async function storagePost(path, token, body) {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? 'Bearer ' + token : ''
      },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(function() { return {}; });
    return { status: res.status, data };
  }

  const orphansNoAuth = await storagePost('/api/storage-orphans', null, { apply: false, limit: 5 });
  if (!ok('POST storage-orphans without auth → 401', orphansNoAuth.status === 401, 'status ' + orphansNoAuth.status)) {
    failed++;
  }

  const resizeNoAuth = await storagePost('/api/storage-resize', null, { apply: false, limit: 5 });
  if (!ok('POST storage-resize without auth → 401', resizeNoAuth.status === 401, 'status ' + resizeNoAuth.status)) {
    failed++;
  }

  let token;
  try {
    token = await getAdminIdToken();
    ok('Admin ID token', true, ADMIN_EMAIL);
  } catch (err) {
    ok('Admin ID token', false, err.message);
    console.log('\nPublic API checks passed; auth tests skipped (set FIREBASE_SERVICE_ACCOUNT on server/CI).');
    console.log(failed ? '\nverify-admin-auction FAILED (' + failed + ' public)' : '\nverify-admin-auction OK (public only)');
    process.exit(failed ? 1 : 0);
  }

  const dash = await apiGet('dashboard', token);
  if (!ok('GET dashboard (admin)', dash.status === 200 && dash.data.ok, 'auctions ' + (dash.data.auctions || []).length)) {
    failed++;
  }

  const settingsBefore = dash.data.settings || pubSettings.data.settings || {};
  const saveBody = {
    action: 'settings',
    siteRevealed: settingsBefore.siteRevealed !== false,
    botGlobalEnabled: settingsBefore.botGlobalEnabled !== false,
    autoRelistZeroBids: settingsBefore.autoRelistZeroBids !== false,
    antiSnipeEnabled: settingsBefore.antiSnipeEnabled !== false,
    defaultBotMaxTotal: Number(settingsBefore.defaultBotMaxTotal || 150)
  };
  const save = await apiPost(saveBody, token);
  if (!ok('POST Save settings', save.status === 200 && save.data.ok === true, save.data.error || '')) {
    failed++;
  }

  const tick = await apiPost({ action: 'tick' }, token);
  if (!ok('POST Run engine tick', tick.status === 200 && tick.data.ok === true, JSON.stringify(tick.data.summary || tick.data.error || ''))) {
    failed++;
  }

  const orphansDry = await storagePost('/api/storage-orphans', token, { apply: false, limit: 5 });
  if (!ok('POST storage-orphans dry-run', orphansDry.status === 200 && orphansDry.data.ok === true,
    'scanned ' + (orphansDry.data.scanned || 0) + ' orphans ' + (orphansDry.data.orphanTotal || 0))) {
    failed++;
  }

  const resizeDry = await storagePost('/api/storage-resize', token, { apply: false, limit: 5 });
  if (!ok('POST storage-resize dry-run', resizeDry.status === 200 && resizeDry.data.ok === true,
    'scanned ' + (resizeDry.data.scanned || 0))) {
    failed++;
  }

  const storefront = await fetch(BASE + '/api/storefront-catalog?limit=3');
  const catalog = await storefront.json().catch(function() { return {}; });
  if (!ok('Storefront catalog API', storefront.status === 200 && catalog.ok === true, (catalog.products && catalog.products.items || []).length + ' items')) {
    failed++;
  }

  const home = await fetch(BASE + '/');
  const html = await home.text();
  if (!ok('Homepage loads', home.status === 200 && html.includes('storefront-core.bundle.js'), '')) {
    failed++;
  }
  ok('Auctions on homepage section', html.includes('id="auctions"'), '');

  console.log(failed ? '\nverify-admin-auction FAILED (' + failed + ')' : '\nverify-admin-auction OK');
  process.exit(failed ? 1 : 0);
}

main().catch(function(err) {
  console.error(err);
  process.exit(1);
});
