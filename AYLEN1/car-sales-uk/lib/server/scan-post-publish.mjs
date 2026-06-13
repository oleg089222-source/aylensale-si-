/**
 * Post-publish hooks for warehouse auto-scan: Telegram alerts + VIP mirror.
 */
import { sendTelegramHtml } from './vip-notify.mjs';
import { saveVipStockItemAdmin } from './vip-store.mjs';

function escapeTelegram(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function siteUrl() {
  return String(process.env.SITE_URL || 'https://aylensale.com').replace(/\/$/, '');
}

export async function notifyAutoScanPublished(ctx) {
  const { listingType, saved, draft, manifest, grade, published } = ctx || {};
  if (!published || !saved) return false;

  const isAuction = listingType === 'auction';
  const lines = [
    isAuction ? '🔨 <b>AUTO AUCTION — Warehouse Scan</b>' : '📦 <b>AUTO LISTING — Warehouse Scan</b>',
    '',
    '<b>Name:</b> ' + escapeTelegram(saved.name || draft?.name),
    '<b>Grade:</b> ' + escapeTelegram(grade || saved.grade || '—'),
    '<b>Category:</b> ' + escapeTelegram(saved.category || draft?.category)
  ];

  if (isAuction) {
    lines.push('<b>Start bid:</b> £' + Number(saved.startingPrice || 0).toFixed(2));
    lines.push('<b>VIP early:</b> ' + Number(saved.vipEarlyAccessHours || 0) + 'h');
    if (saved.publicStartAt) {
      lines.push('<b>Public from:</b> ' + escapeTelegram(saved.publicStartAt.slice(0, 16).replace('T', ' ')));
    }
    lines.push('<b>Ends:</b> ' + escapeTelegram(String(saved.endTime || '').slice(0, 16).replace('T', ' ')));
  } else {
    lines.push('<b>Price:</b> £' + Number(saved.price || 0).toFixed(2));
    lines.push('<b>SKU:</b> ' + escapeTelegram(saved.sku || '—'));
    lines.push('<b>Stock:</b> ' + Number(saved.stock || 0));
  }

  if (manifest?.lines?.length) {
    lines.push('<b>Manifest:</b> ' + manifest.totalUnits + ' units · £' + Number(manifest.totalRrp || 0).toFixed(2) + ' RRP');
    const csvType = isAuction ? 'auction' : 'product';
    lines.push('<b>CSV:</b> ' + siteUrl() + '/api/manifest-csv?id=' + encodeURIComponent(saved.id) + '&type=' + csvType);
  }

  lines.push('');
  lines.push(isAuction
    ? 'VIP members can bid now — public in ' + Number(saved.vipEarlyAccessHours || 24) + 'h'
    : 'Live on storefront');
  lines.push(siteUrl() + (isAuction ? '/#auctions' : '/product.html?id=' + encodeURIComponent(saved.id)));

  return sendTelegramHtml(lines.join('\n'));
}

/** VIP hub teaser card linking to early auction (optional mirror). */
export async function mirrorAutoAuctionToVip(saved) {
  if (!saved?.id) return null;
  const stamp = String(saved.id).replace(/[^a-zA-Z0-9]/g, '').slice(-12);
  const itemId = 'vip_auc_' + stamp;
  const hours = Number(saved.vipEarlyAccessHours || 24);
  const manifestNote = saved.manifest?.totalUnits
    ? ' Manifest: ' + saved.manifest.totalUnits + ' units.'
    : '';

  await saveVipStockItemAdmin({
    id: itemId,
    title: saved.name || 'VIP early auction',
    desc: 'VIP early access — bid ' + hours + 'h before public launch. Starting £' +
      Number(saved.startingPrice || 0).toFixed(2) + '.' + manifestNote,
    images: saved.images || saved.photos || [],
    price: Number(saved.startingPrice || 0),
    vipPrice: Number(saved.startingPrice || 0),
    badge: 'VIP Early',
    category: saved.category || 'job-lots',
    categoryLabel: 'Auction early',
    visible: true,
    stock: 0,
    stockStatus: 'available',
    linkedAuctionId: saved.id,
    itemType: 'auction_early',
    sortOrder: -Date.now()
  });

  return itemId;
}

export function catalogListingSnapshot(saved, listingType) {
  if (!saved) return null;
  const snap = Object.assign({}, saved);
  snap.id = saved.id;
  if (listingType === 'auction') {
    snap.images = saved.images || saved.photos || [];
    snap.createdAt = saved.createdAt || new Date().toISOString();
  } else {
    snap.active = saved.active !== false && saved.status !== 'hidden';
  }
  return snap;
}

export async function runScanPostPublish(ctx) {
  const out = { telegramNotified: false, vipMirrorId: null };
  if (!ctx?.published) return out;

  try {
    out.telegramNotified = await notifyAutoScanPublished(ctx);
  } catch (e) {
    console.warn('scan-post-publish notify failed:', e.message);
  }

  if (ctx.listingType === 'auction' && ctx.saved && ctx.options?.mirrorVip !== false) {
    try {
      out.vipMirrorId = await mirrorAutoAuctionToVip(ctx.saved);
    } catch (e) {
      console.warn('scan-post-publish vip mirror failed:', e.message);
    }
  }

  return out;
}
