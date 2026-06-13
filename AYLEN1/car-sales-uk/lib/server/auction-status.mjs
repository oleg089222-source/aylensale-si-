/**
 * Auction workflow statuses — V1 winner → collection pipeline.
 */
import { auctionFirestoreDocId } from './auction-deposit.mjs';

export const AUCTION_STATUSES = Object.freeze({
  ACTIVE: 'active',
  ENDED: 'ended',
  WINNER_PENDING: 'winner_pending',
  PAID: 'paid',
  ORDER_SENT: 'order_sent',
  COLLECTION_BOOKED: 'collection_booked',
  COLLECTED: 'collected',
  COMPLETED: 'completed'
});

export const POST_WINNER_STATUSES = Object.freeze([
  AUCTION_STATUSES.WINNER_PENDING,
  AUCTION_STATUSES.PAID,
  AUCTION_STATUSES.ORDER_SENT,
  AUCTION_STATUSES.COLLECTION_BOOKED,
  AUCTION_STATUSES.COLLECTED,
  AUCTION_STATUSES.COMPLETED
]);

const ADMIN_TRANSITIONS = Object.freeze({
  winner_pending: ['paid', 'order_sent', 'collection_booked', 'collected', 'completed'],
  paid: ['order_sent', 'collection_booked', 'collected', 'completed'],
  order_sent: ['collection_booked', 'collected', 'completed'],
  collection_booked: ['collected', 'completed'],
  collected: ['completed'],
  active: ['ended', 'winner_pending', 'completed'],
  ended: ['active', 'winner_pending', 'completed']
});

export function isPostWinnerStatus(status) {
  return POST_WINNER_STATUSES.includes(String(status || ''));
}

export function isBiddableStatus(status) {
  const s = String(status || 'active');
  if (s === 'active') return true;
  if (s === 'ended') return false;
  return !isPostWinnerStatus(s) && s !== 'completed';
}

export function canAdminSetStatus(fromStatus, toStatus) {
  const from = String(fromStatus || 'active');
  const to = String(toStatus || '');
  if (!to || from === to) return true;
  if (to === AUCTION_STATUSES.COMPLETED) return isPostWinnerStatus(from) || from === 'active' || from === 'ended';
  const allowed = ADMIN_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function claimableAuctionStatus(status) {
  const s = String(status || '');
  return s === AUCTION_STATUSES.WINNER_PENDING || s === AUCTION_STATUSES.PAID;
}

export function statusLabel(status) {
  const map = {
    active: 'Active',
    ended: 'Ended',
    winner_pending: 'Winner pending',
    paid: 'Paid',
    order_sent: 'Order sent',
    collection_booked: 'Collection booked',
    collected: 'Collected',
    completed: 'Completed'
  };
  return map[String(status || '')] || String(status || '—');
}

export async function applyAuctionStatusUpdate(db, auctionId, nextStatus, meta) {
  const docId = auctionFirestoreDocId(auctionId);
  const ref = db.collection('auctions').doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: 'Auction not found' };

  const data = snap.data() || {};
  const from = String(data.status || 'active');
  const to = String(nextStatus || '').trim();
  if (!to) return { ok: false, error: 'Missing status' };
  if (!canAdminSetStatus(from, to)) {
    return { ok: false, error: 'Cannot change status from ' + from + ' to ' + to };
  }

  const now = new Date().toISOString();
  const patch = {
    status: to,
    updatedAt: now,
    statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory.slice(0, 19) : []
  };
  patch.statusHistory.unshift({
    at: now,
    from: from,
    to: to,
    by: String(meta?.adminEmail || meta?.by || 'admin'),
    note: String(meta?.note || '').trim() || null
  });

  if (to === AUCTION_STATUSES.COLLECTION_BOOKED) patch.collectionBookedAt = now;
  if (to === AUCTION_STATUSES.COLLECTED) patch.collectedAt = now;
  if (to === AUCTION_STATUSES.COMPLETED) patch.completedAt = now;

  await ref.set(patch, { merge: true });
  return { ok: true, auctionId: auctionId, docId: docId, from: from, to: to };
}
