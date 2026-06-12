/**
 * Auction admin Telegram alerts.
 */
import { sendTelegramHtml } from './vip-notify.mjs';

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function notifyAdminRealBid(auction, bid, analysis) {
  if (!bid || bid.isBot || bid.source === 'bot') return false;
  const name = auction.name || auction.title || 'Lot';
  const lines = [
    '🔨 <b>REAL BID — AYLENSALE Auction</b>',
    '',
    '<b>Lot:</b> ' + esc(name),
    '<b>Amount:</b> £' + Number(bid.amount || 0).toFixed(2),
    '<b>Bidder:</b> ' + esc(bid.bidderName || bid.bidder || '—'),
    '<b>Players:</b> ' + Number(analysis && analysis.participantCount || 0) +
      ' · <b>Real bids:</b> ' + Number(analysis && analysis.realBids || 0),
    '<b>Heat:</b> ' + esc((analysis && analysis.heat) || '—')
  ];
  if (analysis && analysis.msLeft != null && analysis.msLeft < 3600000) {
    lines.push('<b>⏳ Ending:</b> under 1 hour');
  }
  lines.push('');
  lines.push('Admin → Auctions → Command Center');
  return sendTelegramHtml(lines.join('\n'));
}

export async function notifyAdminHotLot(auction, analysis) {
  if (!analysis || (analysis.heat !== 'hot' && analysis.heat !== 'warm')) return false;
  const lines = [
    '🔥 <b>HOT AUCTION — AYLENSALE</b>',
    '',
    '<b>Lot:</b> ' + esc(auction.name || auction.title || 'Lot'),
    '<b>Price:</b> £' + Number(auction.currentPrice || 0).toFixed(2),
    '<b>Players:</b> ' + Number(analysis.participantCount || 0),
    '<b>Real bids:</b> ' + Number(analysis.realBids || 0),
    '',
    'Multiple bidders — watch in Command Center.'
  ];
  return sendTelegramHtml(lines.join('\n'));
}

export async function notifyAdminAuctionEnded(auction, result) {
  const lines = [
    '🏁 <b>AUCTION ENDED</b>',
    '',
    '<b>Lot:</b> ' + esc(auction.name || auction.title || 'Lot')
  ];
  if (result && result.relisted) {
    lines.push('<b>Action:</b> Auto-relisted (no real bids)');
  } else if (result && result.winner) {
    lines.push('<b>Winner:</b> ' + esc(result.winner.bidderName || '—'));
    lines.push('<b>Winning bid:</b> £' + Number(result.winner.amount || 0).toFixed(2));
    lines.push('<b>Status:</b> winner_pending');
  } else {
    lines.push('<b>Status:</b> ended — no winner');
  }
  return sendTelegramHtml(lines.join('\n'));
}

export async function notifyAdminWinnerPaymentPending(auction, paymentResult) {
  const winner = auction.winner || {};
  const lines = [
    '💳 <b>WINNER PAYMENT LINK — AYLENSALE</b>',
    '',
    '<b>Lot:</b> ' + esc(auction.name || auction.title || 'Lot'),
    '<b>Hammer:</b> £' + Number(paymentResult.hammerAmount || winner.hammerAmount || winner.amount || 0).toFixed(2),
    '<b>Winner:</b> ' + esc(winner.bidderName || '—'),
    '<b>Status:</b> payment pending',
    '<b>Due:</b> ' + esc(winner.paymentDueAt || '48h')
  ];
  if (paymentResult.url) {
    lines.push('');
    lines.push('<b>Checkout:</b> ' + esc(paymentResult.url));
  }
  return sendTelegramHtml(lines.join('\n'));
}

export async function notifyAdminWinnerPaymentOverdue(auction) {
  const winner = auction.winner || {};
  const lines = [
    '⚠️ <b>WINNER PAYMENT OVERDUE</b>',
    '',
    '<b>Lot:</b> ' + esc(auction.name || auction.title || 'Lot'),
    '<b>Winner:</b> ' + esc(winner.bidderName || '—'),
    '<b>Hammer:</b> £' + Number(winner.hammerAmount || winner.amount || 0).toFixed(2),
    '<b>Due was:</b> ' + esc(winner.paymentDueAt || '—')
  ];
  return sendTelegramHtml(lines.join('\n'));
}
