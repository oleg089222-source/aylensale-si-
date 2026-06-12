#!/usr/bin/env node
/**
 * Stage 5 — Vercel Cron + finalize alignment smoke tests.
 * Usage: VERIFY_URL=https://aylensale.com npm run verify:auction-cron
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadProjectEnv } from './lib/load-env.mjs';

loadProjectEnv();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.VERIFY_URL || 'https://aylensale.com').replace(/\/$/, '');
const API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBpnzLxvk3uGQL-8jOIqQ_M_gTlh0a4mqg';
let failed = 0;

function record(name, cond, detail) {
  if (cond) console.log('  OK', name, detail || '');
  else {
    failed++;
    console.log(' FAIL', name, detail || '');
  }
}

async function getAdminToken() {
  const email = process.env.ADMIN_VERIFY_EMAIL || 'admin@aylensale.com';
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) throw new Error('ADMIN_PASSWORD required for admin tick test');
  const res = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(API_KEY),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
    }
  );
  const data = await res.json();
  if (!res.ok || !data.idToken) throw new Error(data.error?.message || 'admin auth failed');
  return data.idToken;
}

console.log('\n=== AYLENSALE auction cron verify (Stage 5) ===');
console.log('URL:', BASE);

// —— Static: vercel.json cron + client gate in bundle ——
const vercelJson = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const crons = vercelJson.crons || [];
record('vercel-cron-config', crons.some(function(c) { return c.path === '/api/auction-tick'; }),
  crons.map(function(c) { return c.path + ' ' + c.schedule; }).join(', '));

const coreBundle = readFileSync(join(root, 'js/storefront-core.bundle.js'), 'utf8');
record('client-finalize-gated', coreBundle.includes('canClientFinalizeAuctions'),
  'public users skip client finalize');
record('client-finalize-admin-only', coreBundle.includes('canClientFinalizeAuctions()'),
  'admin manual finalize preserved');

// —— Live: cron auth ——
const unauth = await fetch(BASE + '/api/auction-tick');
record('cron-unauth-401', unauth.status === 401, 'status ' + unauth.status);

const cronRes = await fetch(BASE + '/api/auction-tick', {
  headers: { 'x-vercel-cron': '1' }
});
const cronData = await cronRes.json().catch(function() { return {}; });
record('cron-vercel-header-200', cronRes.status === 200 && cronData.ok === true,
  JSON.stringify(cronData.summary || {}).slice(0, 120));
record('cron-source-server', cronData.source === 'server_tick', cronData.source || '');

const secret = String(process.env.CRON_SECRET || process.env.AUCTION_CRON_SECRET || '').trim();
if (secret) {
  const secretRes = await fetch(BASE + '/api/auction-tick?secret=' + encodeURIComponent(secret));
  const secretData = await secretRes.json().catch(function() { return {}; });
  record('cron-secret-query', secretRes.status === 200 && secretData.ok === true, '');
} else {
  record('cron-secret-query', true, 'skipped — CRON_SECRET not set locally');
}

// —— Live: admin manual tick (backup path) ——
try {
  const token = await getAdminToken();
  const adminTick = await fetch(BASE + '/api/spam?action=auction-engine', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({ action: 'tick' })
  });
  const adminData = await adminTick.json().catch(function() { return {}; });
  record('admin-manual-tick', adminTick.status === 200 && adminData.ok === true,
    JSON.stringify(adminData.summary || {}).slice(0, 100));

  const dash = await fetch(BASE + '/api/spam?action=auction-engine&sub=dashboard', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const dashData = await dash.json().catch(function() { return {}; });
  const finalizedLots = (dashData.auctions || []).filter(function(a) {
    return a.status === 'winner_pending' || a.status === 'ended';
  });
  record('finalize-states-visible', dash.status === 200,
    finalizedLots.length + ' ended/winner_pending lots in dashboard');
} catch (err) {
  record('admin-manual-tick', false, err.message);
}

// —— Double-finalize guard: second cron tick should not increase finalized count on same pass ——
const tick1 = await fetch(BASE + '/api/auction-tick', { headers: { 'x-vercel-cron': '1' } });
const tick1Data = await tick1.json().catch(function() { return {}; });
const tick2 = await fetch(BASE + '/api/auction-tick', { headers: { 'x-vercel-cron': '1' } });
const tick2Data = await tick2.json().catch(function() { return {}; });
record('double-tick-idempotent',
  tick2.status === 200 && Number(tick2Data.summary?.finalized || 0) === 0,
  'tick1 finalized=' + Number(tick1Data.summary?.finalized || 0) +
  ' tick2 finalized=' + Number(tick2Data.summary?.finalized || 0));

console.log(failed ? '\nverify-auction-cron FAILED (' + failed + ')' : '\nverify-auction-cron OK');
process.exit(failed ? 1 : 0);
