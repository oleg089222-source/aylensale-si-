/**
 * Admin — deposit refund request management.
 */
import { cleanString } from './spam-guard.mjs';
import { REFUND_STATUSES } from './auction-refund.mjs';
import { sendTelegramHtml } from './vip-notify.mjs';

const VALID_TRANSITIONS = Object.freeze({
  [REFUND_STATUSES.PENDING]: [REFUND_STATUSES.APPROVED, REFUND_STATUSES.REJECTED],
  [REFUND_STATUSES.APPROVED]: [REFUND_STATUSES.REFUNDED],
  [REFUND_STATUSES.REJECTED]: [],
  [REFUND_STATUSES.REFUNDED]: []
});

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function listRefundRequests(db, opts) {
  const limit = Math.min(100, Math.max(1, Number(opts?.limit) || 50));
  const status = cleanString(opts?.status, 20);

  let query = db.collection('depositRefundRequests').orderBy('createdAt', 'desc').limit(limit);
  if (status) query = query.where('status', '==', status);

  const snap = await query.get();
  const rows = snap.docs.map(function(doc) {
    return Object.assign({ id: doc.id }, doc.data() || {});
  });

  const counts = { pending: 0, approved: 0, rejected: 0, refunded: 0 };
  rows.forEach(function(row) {
    const s = String(row.status || 'pending');
    if (counts[s] != null) counts[s] += 1;
  });

  return { ok: true, requests: rows, counts: counts };
}

export async function updateRefundRequest(db, id, patch, adminMeta) {
  const docId = cleanString(id, 80);
  if (!docId) return { ok: false, error: 'Missing request id' };

  const ref = db.collection('depositRefundRequests').doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: 'Refund request not found' };

  const data = snap.data() || {};
  const from = String(data.status || REFUND_STATUSES.PENDING);
  const to = cleanString(patch?.status, 20) || from;
  const adminNote = cleanString(patch?.adminNote, 500);
  const now = new Date().toISOString();

  if (to !== from) {
    const allowed = VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      return { ok: false, error: 'Cannot change refund status from ' + from + ' to ' + to };
    }
  }

  const update = {
    updatedAt: now,
    status: to
  };
  if (adminNote) update.adminNote = adminNote;
  if (to === REFUND_STATUSES.APPROVED) update.approvedAt = now;
  if (to === REFUND_STATUSES.REJECTED) update.rejectedAt = now;
  if (to === REFUND_STATUSES.REFUNDED) update.refundedAt = now;
  if (adminMeta?.adminEmail) update.lastAdminEmail = String(adminMeta.adminEmail);

  await ref.set(update, { merge: true });

  if (to !== from) {
    const lines = [
      '💸 <b>DEPOSIT REFUND UPDATE</b>',
      '',
      '<b>Name:</b> ' + esc(data.name),
      '<b>Auction:</b> ' + esc(data.auctionName),
      '<b>Status:</b> ' + esc(from) + ' → <b>' + esc(to) + '</b>'
    ];
    if (adminNote) lines.push('<b>Note:</b> ' + esc(adminNote));
    await sendTelegramHtml(lines.join('\n')).catch(function() {});
  }

  return { ok: true, id: docId, from: from, to: to };
}
