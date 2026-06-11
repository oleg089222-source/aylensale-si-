#!/usr/bin/env node
/**
 * Auction deposit webhook + verify fallback health check.
 * Usage: npm run verify:auction-deposit
 *        VERIFY_URL=https://preview.example.com npm run verify:auction-deposit
 */
import { loadProjectEnv } from './lib/load-env.mjs';

loadProjectEnv();

const BASE = (process.env.VERIFY_URL || 'https://aylensale.com').replace(/\/$/, '');
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

async function getJson(path, opts) {
  const res = await fetch(BASE + path, opts);
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data: data, headers: res.headers };
}

console.log('\n=== AYLENSALE auction deposit verify ===');
console.log('URL:', BASE);

const config = await getJson('/api/auction-deposit-config');
record('deposit-config', config.status === 200 && config.data.ok === true,
  'enabled=' + config.data.depositsEnabled + ' enforcement=' + config.data.depositEnforcement);
record('deposit-enforcement-off', config.data.depositEnforcement === false,
  'depositEnforcement must stay false on production until sign-off');
record('production-locked', config.data.productionLocked === true,
  'source=' + (config.data.depositEnforcementSource || 'n/a') + ' env=' + (config.data.deployEnvironment || 'n/a'));
record('deposits-enabled', config.data.depositsEnabled === true, 'checkout available');
record('stripe-configured', config.data.stripeConfigured === true, 'STRIPE_SECRET_KEY');
record('webhook-configured', config.data.webhookConfigured === true, 'STRIPE_WEBHOOK_SECRET');
record('verify-fallback-enabled', config.data.depositVerifyFallbackEnabled === true, 'client fallback on');

const settings = await getJson('/api/spam?action=auction-engine&sub=settings');
record('settings-schema', settings.status === 200 && settings.data.settings,
  settings.data.settings && typeof settings.data.settings.depositEnforcement === 'boolean'
    ? 'depositEnforcement in auctionSettings/global'
    : 'missing deposit flags in settings');

const verifyEmpty = await getJson('/api/auction-deposit-verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});
record('verify-rejects-empty', verifyEmpty.status === 400, 'status ' + verifyEmpty.status);

const verifyBad = await getJson('/api/auction-deposit-verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: 'cs_test_invalid_session_000' })
});
record('verify-rejects-invalid-session',
  verifyBad.status === 400 || verifyBad.status === 402 || verifyBad.status === 500,
  'status ' + verifyBad.status + (verifyBad.data.error ? ' — ' + verifyBad.data.error : ''));

const depositEmpty = await getJson('/api/auction-deposit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});
record('deposit-rejects-empty', depositEmpty.status === 400 || depositEmpty.status === 429,
  'status ' + depositEmpty.status);

const webhookProbe = await fetch(BASE + '/api/stripe-webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'checkout.session.completed' })
});
const webhookText = await webhookProbe.text();
record('webhook-route-live', webhookProbe.status === 400 && webhookText.indexOf('Webhook Error') !== -1,
  'status ' + webhookProbe.status + ' (signature required — route reachable)');

console.log('\nStripe staging checklist:');
console.log('  • Dashboard → Webhooks → endpoint:', BASE + '/api/stripe-webhook');
console.log('  • Events: checkout.session.completed');
console.log('  • Metadata product=auction_deposit on deposit Checkout sessions');
console.log('  • Test card 4242… → return URL calls /api/auction-deposit-verify fallback');

console.log('\n' + JSON.stringify({ pass: checks.length - failed, fail: failed, total: checks.length }, null, 2));

if (failed > 0) {
  console.log('\nverify:auction-deposit FAILED (' + failed + ')');
  process.exit(1);
}
console.log('\nverify:auction-deposit OK');
