/**
 * POST /api/record-view — canonical path for product/auction view counts.
 * Client Firestore rules deny writes; this handler uses Admin SDK + rate limits.
 * Body: { type: "product"|"auction", id: "..." }
 */
const ipBuckets = new Map();

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';
}

function rateOk(key, max, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const prev = (ipBuckets.get(key) || []).filter(function(t) { return t > cutoff; });
  if (prev.length >= max) {
    ipBuckets.set(key, prev);
    return false;
  }
  prev.push(now);
  ipBuckets.set(key, prev);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  if (!rateOk('view:' + ip, 120, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const body = req.body || {};
  const type = String(body.type || '').toLowerCase();
  const id = String(body.id || '').slice(0, 120);
  if (!id || (type !== 'product' && type !== 'auction')) {
    return res.status(400).json({ error: 'Invalid type or id' });
  }

  if (!rateOk('view:' + type + ':' + id + ':' + ip, 8, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many views for this item' });
  }

  try {
    const mod = await import('./lib/record-view-stats.mjs');
    if (type === 'product') {
      await mod.recordProductViewStat(id);
    } else {
      await mod.recordAuctionViewStat(id);
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    const msg = String(error && error.message || error);
    if (msg.indexOf('FIREBASE_SERVICE_ACCOUNT') !== -1) {
      return res.status(503).json({ error: 'View stats unavailable' });
    }
    console.error('record-view failed:', msg);
    return res.status(500).json({ error: 'Failed to record view' });
  }
}
