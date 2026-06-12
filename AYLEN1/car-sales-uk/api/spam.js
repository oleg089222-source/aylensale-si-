/**
 * Single spam / captcha serverless function (Hobby plan: max 12 functions).
 * Routes via ?action= or vercel.json rewrites.
 */
import {
  handleSpamConfig,
  handleNotifyRequest,
  handleAuctionBid,
  handleAuctionDeposit,
  handleAuctionDepositConfig,
  handleAuctionDepositVerify,
  handleAuctionBuyNow,
  handleAuctionPaymentConfig,
  handleAuctionWinnerPayment,
  handleAuctionPaymentVerify
} from '../lib/server/spam-handlers.mjs';
import { handleLoyalty } from '../lib/server/loyalty-handlers.mjs';
import {
  handleAuctionEngineGet,
  handleAuctionEnginePost
} from '../lib/server/auction-handlers.mjs';

function resolveAction(req) {
  const q = req.query || {};
  if (q.action) return String(q.action).toLowerCase();

  const url = String(req.url || '');
  if (url.indexOf('spam-config') !== -1) return 'config';
  if (url.indexOf('notify-request') !== -1) return 'notify-request';
  if (url.indexOf('auction-bid') !== -1) return 'auction-bid';
  if (url.indexOf('auction-deposit-verify') !== -1) return 'auction-deposit-verify';
  if (url.indexOf('auction-deposit-config') !== -1) return 'auction-deposit-config';
  if (url.indexOf('auction-deposit') !== -1) return 'auction-deposit';
  if (url.indexOf('auction-buy-now') !== -1) return 'auction-buy-now';
  if (url.indexOf('auction-payment-verify') !== -1) return 'auction-payment-verify';
  if (url.indexOf('auction-payment-config') !== -1) return 'auction-payment-config';
  if (url.indexOf('auction-winner-payment') !== -1) return 'auction-winner-payment';
  if (url.indexOf('loyalty') !== -1) return 'loyalty';
  if (url.indexOf('auction-engine') !== -1 || url.indexOf('auction-tick') !== -1) return 'auction-engine';
  if (url.indexOf('storage-resize') !== -1) return 'storage-resize';
  if (url.indexOf('storage-orphans') !== -1) return 'storage-orphans';
  if (url.indexOf('process-restock-notify') !== -1) return 'process-restock-notify';

  return 'config';
}

export default async function handler(req, res) {
  const action = resolveAction(req);

  switch (action) {
    case 'config':
    case 'spam-config':
      return handleSpamConfig(req, res);
    case 'notify':
    case 'notify-request':
      return handleNotifyRequest(req, res);
    case 'auction-bid':
    case 'auctionbid':
      return handleAuctionBid(req, res);
    case 'auction-deposit':
      return handleAuctionDeposit(req, res);
    case 'auction-deposit-verify':
    case 'auctiondepositverify':
      return handleAuctionDepositVerify(req, res);
    case 'auction-deposit-config':
    case 'auctiondepositconfig':
      return handleAuctionDepositConfig(req, res);
    case 'auction-buy-now':
    case 'auction-buynow':
      return handleAuctionBuyNow(req, res);
    case 'auction-payment-config':
    case 'auctionpaymentconfig':
      return handleAuctionPaymentConfig(req, res);
    case 'auction-winner-payment':
    case 'auctionwinnerpayment':
      return handleAuctionWinnerPayment(req, res);
    case 'auction-payment-verify':
    case 'auctionpaymentverify':
      return handleAuctionPaymentVerify(req, res);
    case 'loyalty':
      return handleLoyalty(req, res);
    case 'auction-engine':
    case 'auction-tick':
      if (req.method === 'GET') return handleAuctionEngineGet(req, res);
      if (req.method === 'POST') return handleAuctionEnginePost(req, res);
      return res.status(405).json({ error: 'Method not allowed' });
    case 'storage-resize': {
      const { handleStorageResize } = await import('../lib/server/storage-resize-handlers.mjs');
      return handleStorageResize(req, res);
    }
    case 'storage-orphans': {
      const { handleStorageOrphanCleanup } = await import('../lib/server/storage-orphan-handlers.mjs');
      return handleStorageOrphanCleanup(req, res);
    }
    case 'process-restock-notify': {
      const { handleProcessRestockNotify } = await import('../lib/server/admin-audit-handlers.mjs');
      return handleProcessRestockNotify(req, res);
    }
    default:
      return res.status(404).json({ error: 'Unknown spam action: ' + action });
  }
}
