#!/usr/bin/env node
/**
 * Local handler smoke tests (no deploy required).
 */
import { loadProjectEnv } from './lib/load-env.mjs';
import {
  handleAuctionDepositConfig,
  handleAuctionDepositVerify
} from '../lib/server/spam-handlers.mjs';

loadProjectEnv();

function mockRes() {
  const state = { statusCode: 200, body: null, headers: {} };
  return {
    state: state,
    setHeader(k, v) { state.headers[k] = v; },
    status(code) { state.statusCode = code; return this; },
    json(data) { state.body = data; return this; },
    end() { return this; }
  };
}

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  OK', name, detail || '');
  else { failed++; console.log(' FAIL', name, detail || ''); }
}

console.log('\n=== Local auction deposit handler tests ===\n');

const configRes = mockRes();
await handleAuctionDepositConfig({ method: 'GET' }, configRes);
assert('config-handler-200', configRes.state.statusCode === 200, String(configRes.state.statusCode));
assert('config-ok-flag', configRes.state.body && configRes.state.body.ok === true, '');
assert('config-enforcement-off', configRes.state.body && configRes.state.body.depositEnforcement === false, '');
assert('config-amount-50', configRes.state.body && configRes.state.body.depositAmountGbp === 50, '');

const verifyEmptyRes = mockRes();
await handleAuctionDepositVerify({ method: 'POST', body: {} }, verifyEmptyRes);
assert('verify-empty-400', verifyEmptyRes.state.statusCode === 400, String(verifyEmptyRes.state.statusCode));

const verifyBadRes = mockRes();
await handleAuctionDepositVerify({
  method: 'POST',
  body: { sessionId: 'cs_test_invalid_000' }
}, verifyBadRes);
assert(
  'verify-invalid-not-200',
  verifyBadRes.state.statusCode !== 200,
  'status ' + verifyBadRes.state.statusCode
);

console.log('\nFailed:', failed);
process.exit(failed > 0 ? 1 : 0);
