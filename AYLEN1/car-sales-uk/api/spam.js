/**
 * Single spam / captcha serverless function (Hobby plan: max 12 functions).
 * Routes via ?action= or vercel.json rewrites.
 */
import {
  handleSpamConfig,
  handleNotifyRequest,
  handleAuctionBid
} from './lib/spam-handlers.mjs';
import { handleLoyalty } from './lib/loyalty-handlers.mjs';
import {
  handleAuctionEngineGet,
  handleAuctionEnginePost
} from './lib/auction-handlers.mjs';

function resolveAction(req) {
  const q = req.query || {};
  if (q.action) return String(q.action).toLowerCase();

  const url = String(req.url || '');
  if (url.indexOf('spam-config') !== -1) return 'config';
  if (url.indexOf('notify-request') !== -1) return 'notify-request';
  if (url.indexOf('auction-bid') !== -1) return 'auction-bid';
  if (url.indexOf('loyalty') !== -1) return 'loyalty';
  if (url.indexOf('auction-engine') !== -1 || url.indexOf('auction-tick') !== -1) return 'auction-engine';
  if (url.indexOf('storage-resize') !== -1) return 'storage-resize';
  if (url.indexOf('storage-orphans') !== -1) return 'storage-orphans';

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
    case 'loyalty':
      return handleLoyalty(req, res);
    case 'auction-engine':
    case 'auction-tick':
      if (req.method === 'GET') return handleAuctionEngineGet(req, res);
      if (req.method === 'POST') return handleAuctionEnginePost(req, res);
      return res.status(405).json({ error: 'Method not allowed' });
    case 'storage-resize': {
      const { handleStorageResize } = await import('./lib/storage-resize-handlers.mjs');
      return handleStorageResize(req, res);
    }
    case 'storage-orphans': {
      const { handleStorageOrphanCleanup } = await import('./lib/storage-orphan-handlers.mjs');
      return handleStorageOrphanCleanup(req, res);
    }
    default:
      return res.status(404).json({ error: 'Unknown spam action: ' + action });
  }
}
