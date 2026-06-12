#!/usr/bin/env node
/**
 * Stage 4 — server-side validation + anti-fraud unit tests.
 * Usage: npm run verify:auction-validation
 */
import {
  minBidIncrement,
  isUkPhone,
  validateBidFields,
  validateBidAgainstAuction,
  getLeadingRealBid,
  AUCTION_MAX_BID_GBP
} from '../lib/server/auction-validation.mjs';
import {
  detectShillNameMismatch,
  FRAUD_CODES
} from '../lib/server/auction-fraud.mjs';
import { isBotBid } from '../lib/server/auction-engine.mjs';

let failed = 0;

function record(name, cond, detail) {
  if (cond) console.log('  OK', name, detail || '');
  else {
    failed++;
    console.log(' FAIL', name, detail || '');
  }
}

console.log('\n=== AYLENSALE auction validation verify (Stage 4) ===');

record('increment-floor', minBidIncrement(0) === 1, '£' + minBidIncrement(0));
record('increment-1pct', minBidIncrement(150) === 2, '£150 → +' + minBidIncrement(150));
record('increment-large', minBidIncrement(5000) === 50, '£5000 → +' + minBidIncrement(5000));

record('uk-phone-mobile', isUkPhone('07123456789') === true, '');
record('uk-phone-intl', isUkPhone('+447123456789') === true, '');
record('uk-phone-short', isUkPhone('12345') === false, '');
record('uk-phone-us', isUkPhone('+12025550123') === false, '');

try {
  validateBidFields({ name: 'James W.', phone: '07123456789', bidAmount: 50 });
  record('fields-valid', true, '');
} catch (e) {
  record('fields-valid', false, e.message);
}

try {
  validateBidFields({ name: 'James W.', phone: '07123456789', bidAmount: AUCTION_MAX_BID_GBP + 1 });
  record('fields-max-bid', false, 'should throw');
} catch (e) {
  record('fields-max-bid', e.code === 'BID_TOO_HIGH', e.message);
}

try {
  validateBidAgainstAuction({
    name: 'James W.',
    phone: '07123456789',
    bidAmount: 5,
    currentPrice: 10,
    bids: [],
    bidderKey: 'abc'
  });
  record('against-auction-low', false, 'should throw');
} catch (e) {
  record('against-auction-low', e.code === 'BID_TOO_LOW', e.message);
}

const bids = [
  { amount: 20, bidderKey: 'k1', bidderName: 'Alice', isBot: false },
  { amount: 15, bidderKey: 'k2', bidderName: 'Bob', isBot: false },
  { amount: 50, bidderKey: 'bot1', isBot: true, source: 'bot' }
];
const leader = getLeadingRealBid(bids);
record('leader-excludes-bot', leader && leader.bidderName === 'Alice', 'amount=' + (leader && leader.amount));

record('shill-name-mismatch', detectShillNameMismatch(
  [{ bidderKey: 'k1', bidderName: 'Alice' }, { bidderKey: 'k1', bidderName: 'Alicia' }],
  'k1',
  'Alicia'
) === true, FRAUD_CODES.SHILL_NAME_MISMATCH);

record('shill-same-name', detectShillNameMismatch(
  [{ bidderKey: 'k1', bidderName: 'Alice' }],
  'k1',
  'Alice'
) === false, '');

record('is-bot-bid', isBotBid({ isBot: true }) && isBotBid({ source: 'bot' }), '');

console.log(failed ? '\nverify-auction-validation FAILED (' + failed + ')' : '\nverify-auction-validation OK');
process.exit(failed ? 1 : 0);
