/**
 * Admin-only orphan storage cleanup API.
 */
import { verifyFirebaseAdminToken } from './firebase-admin-app.mjs';
import { verifyAdminPassword } from './admin-password.mjs';
import { isAdminConfigured } from './firestore-admin.mjs';
import { fmtBytes } from './storage-bulk-resize.mjs';
import { runStorageOrphanCleanup } from './storage-orphan-cleanup.mjs';

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body || {};
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function requireAdmin(req, body) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token) {
    const decoded = await verifyFirebaseAdminToken(token);
    if (decoded) return decoded;
  }
  const password = body && body.password;
  if (password && (await verifyAdminPassword(password))) {
    return { email: 'admin@aylensale.com', viaPassword: true };
  }
  return null;
}

export async function handleStorageOrphanCleanup(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAdminConfigured()) {
    return res.status(503).json({ error: 'Firebase admin is not configured on server' });
  }

  const body = parseBody(req);
  const admin = await requireAdmin(req, body);
  if (!admin) return res.status(401).json({ error: 'Admin auth required' });

  const apply = !!body.apply;
  const limit = Math.max(0, Math.min(100, Number(body.limit) || 0));

  try {
    const result = await runStorageOrphanCleanup({ apply, limit });
    const summaryRows = (result.rows || []).slice(0, 50).map(function(row) {
      if (row.error) return { name: row.name, error: row.error };
      return {
        name: row.name,
        size: row.size,
        saved: row.size ? fmtBytes(row.size) : undefined
      };
    });
    return res.status(200).json({
      ok: true,
      mode: result.mode,
      bucket: result.bucket,
      referencedCount: result.referencedCount,
      scanned: result.scanned,
      orphanTotal: result.orphanTotal,
      processed: result.processed,
      plannedOrDeleted: result.plannedOrDeleted,
      savedBytes: result.savedBytes,
      saved: result.saved,
      rows: summaryRows,
      truncated: (result.rows || []).length > summaryRows.length
    });
  } catch (err) {
    console.error('[storage-orphans]', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
