#!/usr/bin/env node
/**
 * Production smoke — Stage 4 flags + bidding unchanged for UK users.
 */
import { loadProjectEnv } from './lib/load-env.mjs';

loadProjectEnv();

const BASE = (process.env.VERIFY_URL || 'https://aylensale.com').replace(/\/$/, '');
let failed = 0;

function record(name, cond, detail) {
  const line = (cond ? '  OK ' : ' FAIL ') + name + (detail ? ' — ' + detail : '');
  console.log(line);
  if (!cond) failed++;
}

async function getJson(path, opts) {
  const res = await fetch(BASE + path, opts);
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}

console.log('\n=== Stage 4 production smoke ===');
console.log('URL:', BASE);

const depositCfg = await getJson('/api/auction-deposit-config');
record('deposit-config-200', depositCfg.status === 200, 'status ' + depositCfg.status);
record('deposit-enforcement-off', depositCfg.data.depositEnforcement === false,
  'value=' + depositCfg.data.depositEnforcement + ' source=' + depositCfg.data.depositEnforcementSource);
record('production-locked', depositCfg.data.productionLocked === true, '');

const settings = await getJson('/api/spam?action=auction-engine&sub=settings');
const s = settings.data.settings || {};
record('settings-public', settings.status === 200 && settings.data.ok, '');
record('fraud-mode-log', String(s.fraudEnforceMode || 'log') === 'log', 'fraudEnforceMode=' + (s.fraudEnforceMode || 'log'));
record('turnstile-off', s.turnstileOnBid !== true, 'turnstileOnBid=' + String(s.turnstileOnBid));
record('deposit-settings-off', s.depositEnforcement !== true && s.depositEnforcementEnabled !== true, '');

const home = await fetch(BASE + '/');
const html = await home.text();
record('homepage-200', home.status === 200, '');
record('auctions-section', html.includes('id="auctions"'), '');

const bidLow = await fetch(BASE + '/api/auction-bid', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    auctionId: 'smoke_nonexistent_lot',
    bidAmount: 5,
    name: 'Smoke Test',
    phone: '07123456789',
    security: { formStartedAt: Date.now() - 5000, submittedAt: Date.now(), website: '' }
  })
});
const bidLowData = await bidLow.json().catch(() => ({}));
record('bid-uk-phone-not-fraud-block',
  bidLow.status !== 403 || bidLowData.code !== 'BLACKLISTED',
  'status=' + bidLow.status + ' code=' + (bidLowData.code || 'none'));
record('bid-no-deposit-required',
  bidLowData.code !== 'DEPOSIT_REQUIRED',
  'code=' + (bidLowData.code || 'none'));

const bidBadPhone = await fetch(BASE + '/api/auction-bid', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    auctionId: 'smoke_nonexistent_lot',
    bidAmount: 50,
    name: 'Smoke Test',
    phone: '+12025550123',
    security: { formStartedAt: Date.now() - 5000, submittedAt: Date.now(), website: '' }
  })
});
const badPhoneData = await bidBadPhone.json().catch(() => ({}));
record('bid-rejects-non-uk', bidBadPhone.status === 400 && badPhoneData.code === 'INVALID_UK_PHONE',
  'status=' + bidBadPhone.status);

console.log(failed ? '\nstage4-prod-smoke FAILED (' + failed + ')' : '\nstage4-prod-smoke OK');
process.exit(failed ? 1 : 0);
