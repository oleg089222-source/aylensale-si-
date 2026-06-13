/**
 * Auction deposit refund requests — losing bidder flow.
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import { cleanString } from './spam-guard.mjs';
import { canonicalUkPhoneDigits } from './uk-phone.mjs';

export const REFUND_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REFUNDED: 'refunded'
});

export function isValidRefundRequestBody(body) {
  const name = cleanString(body?.name, 100);
  const phone = cleanString(body?.phone, 30);
  const email = cleanString(body?.email, 120);
  const auctionName = cleanString(body?.auctionName, 140);
  const auctionId = cleanString(body?.auctionId, 80);
  const paymentRef = cleanString(body?.paymentReference, 120);
  const reason = cleanString(body?.reason, 800);
  const signature = cleanString(body?.signature, 120);

  if (!name || name.length < 2) return { ok: false, error: 'Full name is required' };
  if (!phone || canonicalUkPhoneDigits(phone).length < 10) return { ok: false, error: 'Valid UK phone required' };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Valid email required' };
  if (!auctionName) return { ok: false, error: 'Auction lot name is required' };
  if (!auctionId) return { ok: false, error: 'Auction lot ID is required' };
  if (!paymentRef) return { ok: false, error: 'Deposit payment reference is required' };
  if (!reason || reason.length < 10) return { ok: false, error: 'Reason for refund is required' };
  if (!signature || signature.length < 2) return { ok: false, error: 'Typed signature is required' };
  if (!body?.confirmNotWinner || !body?.confirmRefundDays || !body?.confirmCorrect) {
    return { ok: false, error: 'All confirmations must be checked' };
  }

  return {
    ok: true,
    data: {
      name,
      phone,
      email,
      auctionName,
      auctionId,
      paymentReference: paymentRef,
      reason,
      signature,
      confirmNotWinner: true,
      confirmRefundDays: true,
      confirmCorrect: true,
      signedDate: cleanString(body?.signedDate, 20) || new Date().toISOString().slice(0, 10)
    }
  };
}

export async function saveRefundRequest(record) {
  const db = getFirestoreAdmin();
  const now = new Date().toISOString();
  const doc = Object.assign({}, record, {
    status: REFUND_STATUSES.PENDING,
    createdAt: now,
    updatedAt: now
  });
  const ref = await db.collection('depositRefundRequests').add(doc);
  return { id: ref.id, record: doc };
}

export function formatRefundTelegramMessage(data) {
  const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let text = '💸 <b>DEPOSIT REFUND REQUEST - AYLENSALE</b>\n\n';
  text += `<b>Name:</b> ${esc(data.name)}\n`;
  text += `<b>Phone:</b> ${esc(data.phone)}\n`;
  text += `<b>Email:</b> ${esc(data.email)}\n`;
  text += `<b>Auction:</b> ${esc(data.auctionName)}\n`;
  text += `<b>Auction ID:</b> ${esc(data.auctionId)}\n`;
  text += `<b>Payment Ref:</b> ${esc(data.paymentReference)}\n`;
  text += `<b>Reason:</b> ${esc(data.reason)}\n`;
  text += `<b>Signature:</b> ${esc(data.signature)}\n`;
  text += `<b>Date:</b> ${esc(data.signedDate)}\n`;
  text += `\n<b>Status:</b> pending`;
  return text;
}
