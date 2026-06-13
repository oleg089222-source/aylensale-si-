/**
 * GET /api/manifest-csv — public manifest CSV download (routed via admin-branding on Hobby plan).
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import { manifestToCsv } from './manifest-export.mjs';

function cleanId(value) {
  return String(value || '').trim().slice(0, 120);
}

export async function serveManifestCsv(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = cleanId(req.query.id || req.query.productId || req.query.auctionId);
  const type = cleanId(req.query.type || (id.indexOf('auction_') === 0 ? 'auction' : 'product'));

  if (!id) {
    return res.status(400).json({ error: 'id query param is required' });
  }

  try {
    const db = getFirestoreAdmin();
    const collection = type === 'auction' ? 'auctions' : 'products';
    const snap = await db.collection(collection).doc(id).get();

    if (!snap.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const data = snap.data() || {};
    const status = String(data.status || 'active');
    const isActive = data.active !== false && status !== 'hidden' && status !== 'draft';

    if (!isActive) {
      return res.status(404).json({ error: 'Manifest not available for this listing' });
    }

    const manifest = data.manifest;
    if (!manifest || !Array.isArray(manifest.lines) || !manifest.lines.length) {
      return res.status(404).json({ error: 'No manifest on this listing' });
    }

    const csv = manifestToCsv(manifest, {
      name: data.name || data.title,
      sku: data.sku,
      grade: data.grade,
      productId: type === 'product' ? id : '',
      auctionId: type === 'auction' ? id : ''
    });

    const slug = String(data.sku || id).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="aylensale-manifest-' + slug + '.csv"');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send('\ufeff' + csv);
  } catch (error) {
    const msg = String(error?.message || error);
    if (msg.indexOf('FIREBASE_SERVICE_ACCOUNT') !== -1) {
      return res.status(503).json({ error: 'Service unavailable' });
    }
    console.error('manifest-csv failed:', msg);
    return res.status(500).json({ error: 'Failed to generate manifest CSV' });
  }
}
