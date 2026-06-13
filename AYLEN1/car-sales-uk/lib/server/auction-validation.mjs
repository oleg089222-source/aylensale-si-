/**
 * Server-side auction bid validation — increments, UK phone, amount bounds.
 */
import { detectBot, cleanString } from './spam-guard.mjs';
import { canonicalUkPhoneDigits } from './uk-phone.mjs';

export const AUCTION_MAX_BID_GBP = 50000;
export const MIN_BID_INCREMENT_FLOOR_GBP = 1;

export function minBidIncrement(currentPrice) {
  const cp = Math.max(0, Number(currentPrice || 0));
  return Math.max(MIN_BID_INCREMENT_FLOOR_GBP, Math.ceil(cp * 0.01));
}

export function normalizeUkPhoneDigits(phone) {
  return canonicalUkPhoneDigits(phone);
}

/** UK mobile/landline: +44… or 07… / 01… / 02… (10–11 national digits). */
export function isUkPhone(phone) {
  const digits = canonicalUkPhoneDigits(phone);
  if (!digits || !digits.startsWith('44')) return false;
  const national = digits.slice(2);
  return national.length >= 10 && national.length <= 11;
}

export function isBotBid(bid) {
  return !!(bid && (bid.isBot || bid.source === 'bot'));
}

export function getRealBids(bids) {
  return (bids || []).filter(function(b) { return !isBotBid(b); });
}

export function getLeadingRealBid(bids) {
  const real = getRealBids(bids);
  if (!real.length) return null;
  return real.reduce(function(best, b) {
    return Number(b.amount || 0) > Number(best.amount || 0) ? b : best;
  }, real[0]);
}

function validationError(message, code) {
  const err = new Error(message);
  err.code = code || 'VALIDATION_FAILED';
  return err;
}

/**
 * Field-level validation (no auction state required).
 */
export function validateBidFields(input) {
  const safeName = cleanString(input?.name, 100);
  const safePhone = cleanString(input?.phone, 30);
  const safeContact = cleanString(input?.contact, 200);
  const amount = Number(input?.bidAmount ?? input?.amount);

  if (!safeName || safeName.length < 2) {
    throw validationError('Name is required', 'NAME_REQUIRED');
  }
  if (!isUkPhone(safePhone)) {
    throw validationError('Enter a valid UK phone number (+44 or 07…)', 'INVALID_UK_PHONE');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw validationError('Invalid bid amount', 'INVALID_AMOUNT');
  }
  if (amount > AUCTION_MAX_BID_GBP) {
    throw validationError('Bid exceeds maximum (£' + AUCTION_MAX_BID_GBP.toLocaleString('en-GB') + ')', 'BID_TOO_HIGH');
  }
  if (detectBot(safeName, safePhone, '', safeContact)) {
    throw validationError('Submission blocked.', 'BOT_DETECTED');
  }

  return { safeName, safePhone, safeContact, amount };
}

/**
 * Auction-state validation — call inside transaction after reading auction doc.
 */
export function validateBidAgainstAuction(input) {
  const fields = validateBidFields(input);
  const currentPrice = Number(input?.currentPrice || 0);
  const bids = Array.isArray(input?.bids) ? input.bids : [];
  const bidderKey = String(input?.bidderKey || '').trim();
  const increment = minBidIncrement(currentPrice);
  const minimumBid = currentPrice + increment;

  if (fields.amount < minimumBid) {
    throw validationError(
      'Minimum bid is £' + minimumBid.toFixed(2) + ' (current £' + currentPrice.toFixed(2) + ' + £' + increment + ' increment)',
      'BID_TOO_LOW'
    );
  }

  const leader = getLeadingRealBid(bids);
  if (leader && bidderKey) {
    const leaderKey = leader.bidderKey || '';
    if (leaderKey && leaderKey === bidderKey && Number(fields.amount) <= Number(leader.amount || 0)) {
      throw validationError('You are already the highest bidder', 'SELF_OUTBID');
    }
  }

  return fields;
}
