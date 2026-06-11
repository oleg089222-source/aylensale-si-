/**
 * Single VIP / Stripe serverless function (Hobby plan: max 12 functions).
 * Routes via ?action= or legacy URL rewrites in vercel.json.
 */
import {
  handleConfig,
  handleAdminPanel,
  handleAdminMemberPreview,
  handleCheckout,
  handleVerify,
  handleStatus,
  handlePortal,
  handleWebhook,
  handleCreateOrder,
  handleMemberOrders,
  handleAdminOrderUpdate,
  handleAdminStock,
  handleAdminMediaUpload,
  handleMagicLinkRequest,
  handleMagicLinkRedeem,
  handleVipItemCheckout,
  handleVipItemVerify,
  handleVipItemView,
  handleVipAuctionBid
} from '../lib/server/vip-handlers.mjs';

export const config = {
  api: {
    bodyParser: false
  }
};

function resolveAction(req) {
  const q = req.query || {};
  if (q.action) return String(q.action).toLowerCase();

  const url = String(req.url || '');
  if (url.indexOf('stripe-webhook') !== -1) return 'webhook';
  if (url.indexOf('stripe-create-checkout') !== -1) return 'checkout';
  if (url.indexOf('vip-verify-checkout') !== -1) return 'verify';
  if (url.indexOf('vip-config') !== -1) return 'config';
  if (url.indexOf('vip-admin-panel') !== -1) return 'admin-panel';
  if (url.indexOf('vip-admin-member-preview') !== -1) return 'admin-member-preview';
  if (url.indexOf('vip-status') !== -1) return 'status';
  if (url.indexOf('vip-portal') !== -1) return 'portal';
  if (url.indexOf('vip-order') !== -1 && url.indexOf('vip-orders') === -1) return 'create-order';
  if (url.indexOf('vip-orders') !== -1) return 'member-orders';
  if (url.indexOf('vip-admin-order') !== -1) return 'admin-order-update';
  if (url.indexOf('vip-admin-stock') !== -1) return 'admin-stock';
  if (url.indexOf('admin-media-upload') !== -1) return 'admin-media-upload';
  if (url.indexOf('vip-magic-link') !== -1) return 'magic-link-request';
  if (url.indexOf('vip-magic-redeem') !== -1) return 'magic-link-redeem';
  if (url.indexOf('vip-item-checkout') !== -1) return 'vip-item-checkout';
  if (url.indexOf('vip-item-verify') !== -1) return 'vip-item-verify';
  if (url.indexOf('vip-item-view') !== -1) return 'vip-item-view';
  if (url.indexOf('vip-auction-bid') !== -1) return 'vip-auction-bid';

  return 'config';
}

export default async function handler(req, res) {
  const action = resolveAction(req);

  switch (action) {
    case 'config':
      return handleConfig(req, res);
    case 'admin-panel':
    case 'adminpanel':
      return handleAdminPanel(req, res);
    case 'admin-member-preview':
    case 'adminmemberpreview':
      return handleAdminMemberPreview(req, res);
    case 'checkout':
    case 'create-checkout':
      return handleCheckout(req, res);
    case 'verify':
    case 'verify-checkout':
      return handleVerify(req, res);
    case 'status':
      return handleStatus(req, res);
    case 'portal':
      return handlePortal(req, res);
    case 'webhook':
      return handleWebhook(req, res);
    case 'create-order':
      return handleCreateOrder(req, res);
    case 'member-orders':
      return handleMemberOrders(req, res);
    case 'admin-order-update':
      return handleAdminOrderUpdate(req, res);
    case 'admin-stock':
    case 'adminstock':
      return handleAdminStock(req, res);
    case 'admin-media-upload':
    case 'adminmediaupload':
      return handleAdminMediaUpload(req, res);
    case 'magic-link-request':
      return handleMagicLinkRequest(req, res);
    case 'magic-link-redeem':
      return handleMagicLinkRedeem(req, res);
    case 'vip-item-checkout':
      return handleVipItemCheckout(req, res);
    case 'vip-item-verify':
      return handleVipItemVerify(req, res);
    case 'vip-item-view':
      return handleVipItemView(req, res);
    case 'vip-auction-bid':
    case 'vipauctionbid':
      return handleVipAuctionBid(req, res);
    default:
      return res.status(404).json({ error: 'Unknown VIP action: ' + action });
  }
}
