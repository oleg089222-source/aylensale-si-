/**
 * Find and delete Firebase Storage files not referenced in Firestore listings.
 */
import { getFirestoreAdmin, getStorageBucket } from './firebase-admin-app.mjs';
import { fmtBytes } from './storage-bulk-resize.mjs';

export const ORPHAN_PREFIXES = ['products/', 'auctions/', 'vip/', 'vipStock/'];
const MEDIA_RE = /\.(jpe?g|png|webp|gif|mp4|webm|mov|ico)$/i;

export function storagePathFromUrl(url) {
  const u = String(url || '').trim();
  if (!u || u.indexOf('data:') === 0) return null;
  if (u.includes('firebasestorage.googleapis.com')) {
    const parts = u.split('/o/');
    if (parts[1]) return decodeURIComponent(parts[1].split('?')[0]);
  }
  const gs = u.match(/storage\.googleapis\.com\/[^/]+\/(.+?)(?:\?|$)/);
  if (gs && gs[1]) return decodeURIComponent(gs[1]);
  return null;
}

function addReferenced(refs, url) {
  const path = storagePathFromUrl(url);
  if (path) refs.add(path);
}

function addReferencedList(refs, list) {
  if (!Array.isArray(list)) return;
  list.forEach(function(item) {
    addReferenced(refs, item);
  });
}

export async function collectReferencedStoragePaths() {
  const db = getFirestoreAdmin();
  const refs = new Set();

  const [productsSnap, auctionsSnap, vipSnap, brandingSnap] = await Promise.all([
    db.collection('products').get(),
    db.collection('auctions').get(),
    db.collection('vipStockItems').get(),
    db.collection('siteSettings').doc('branding').get()
  ]);

  productsSnap.forEach(function(doc) {
    const d = doc.data() || {};
    addReferencedList(refs, d.images);
    addReferencedList(refs, d.photos);
    addReferenced(refs, d.videoUrl);
    addReferenced(refs, d.imageUrl);
  });

  auctionsSnap.forEach(function(doc) {
    const d = doc.data() || {};
    addReferencedList(refs, d.images);
    addReferencedList(refs, d.photos);
  });

  vipSnap.forEach(function(doc) {
    const d = doc.data() || {};
    addReferencedList(refs, d.images);
    addReferenced(refs, d.imageUrl);
    addReferenced(refs, d.photoUrl);
    addReferenced(refs, d.videoUrl);
  });

  if (brandingSnap.exists) {
    const b = brandingSnap.data() || {};
    addReferenced(refs, b.sourceUrl);
    if (b.sourcePath) refs.add(String(b.sourcePath));
    if (b.icons && typeof b.icons === 'object') {
      Object.keys(b.icons).forEach(function(key) {
        addReferenced(refs, b.icons[key]);
      });
    }
  }

  return refs;
}

async function listMediaFiles(bucket, prefixes) {
  const files = [];
  for (const prefix of prefixes) {
    let pageToken;
    do {
      const [batch, , resp] = await bucket.getFiles({
        prefix,
        maxResults: 500,
        pageToken
      });
      for (const file of batch) {
        if (MEDIA_RE.test(file.name)) files.push(file);
      }
      pageToken = resp && resp.nextPageToken;
    } while (pageToken);
  }
  return files;
}

/**
 * @param {{ apply?: boolean, limit?: number, prefixes?: string[] }} opts
 */
export async function runStorageOrphanCleanup(opts) {
  const apply = !!opts.apply;
  const limit = Math.max(0, Math.min(100, Number(opts.limit) || 0));
  const prefixes = Array.isArray(opts.prefixes) && opts.prefixes.length
    ? opts.prefixes
    : ORPHAN_PREFIXES;

  const bucket = getStorageBucket();
  const referenced = await collectReferencedStoragePaths();
  const allFiles = await listMediaFiles(bucket, prefixes);
  const orphans = allFiles.filter(function(file) {
    return !referenced.has(file.name);
  });

  orphans.sort(function(a, b) {
    return Number(b.metadata && b.metadata.size || 0) - Number(a.metadata && a.metadata.size || 0);
  });

  let actionable = 0;
  let deleted = 0;
  let savedBytes = 0;
  let totalOrphanBytes = 0;
  const rows = [];

  if (!apply && orphans.length) {
    for (const file of orphans) {
      let est = Number(file.metadata && file.metadata.size || 0);
      if (!est) {
        try {
          const [meta] = await file.getMetadata();
          est = Number(meta.size || 0);
        } catch (e) { /* ignore */ }
      }
      totalOrphanBytes += est;
    }
  }

  for (const file of orphans) {
    if (limit && actionable >= limit) break;
    actionable++;
    let size = Number(file.metadata && file.metadata.size || 0);
    if (!size) {
      try {
        const [meta] = await file.getMetadata();
        size = Number(meta.size || 0);
      } catch (e) { /* ignore */ }
    }
    if (!apply) {
      savedBytes += size;
      rows.push({ name: file.name, size, planned: true });
      continue;
    }
    try {
      await file.delete();
      deleted++;
      savedBytes += size;
      rows.push({ name: file.name, size, deleted: true });
    } catch (err) {
      rows.push({ name: file.name, error: err.message || String(err) });
    }
  }

  return {
    ok: true,
    mode: apply ? 'apply' : 'dry-run',
    bucket: bucket.name,
    referencedCount: referenced.size,
    scanned: allFiles.length,
    orphanTotal: orphans.length,
    processed: actionable,
    plannedOrDeleted: apply ? deleted : actionable,
    savedBytes: apply ? savedBytes : totalOrphanBytes,
    saved: fmtBytes(apply ? savedBytes : totalOrphanBytes),
    rows
  };
}
