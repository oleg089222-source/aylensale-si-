/**
 * GET /api/storefront-catalog — homepage catalog without client Firestore SDK.
 * Query: limit (1–48), after (product doc id for pagination)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  try {
    var mod = await import('./lib/storefront-catalog.mjs');
    var payload = await mod.getStorefrontCatalog({
      productsLimit: req.query.limit,
      productsAfter: req.query.after
    });
    return res.status(200).json(payload);
  } catch (error) {
    var msg = String(error && error.message || error);
    if (msg.indexOf('FIREBASE_SERVICE_ACCOUNT') !== -1) {
      return res.status(503).json({ ok: false, error: 'Catalog unavailable' });
    }
    console.error('storefront-catalog failed:', msg);
    return res.status(500).json({ ok: false, error: 'Failed to load catalog' });
  }
}
