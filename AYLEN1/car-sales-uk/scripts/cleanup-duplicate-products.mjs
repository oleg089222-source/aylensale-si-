#!/usr/bin/env node
/**
 * Remove legacy duplicate product docs (same canonical key, missing prod_ prefix).
 * Dry-run by default. Pass --apply to delete orphan docs.
 *
 *   node scripts/cleanup-duplicate-products.mjs
 *   node scripts/cleanup-duplicate-products.mjs --apply
 */
import { getFirestoreAdmin } from '../lib/server/firebase-admin-app.mjs';

const APPLY = process.argv.includes('--apply');

function canonicalProductKey(id) {
  const raw = String(id || '').trim();
  if (!raw) return '';
  return raw.indexOf('prod_') === 0 ? raw.slice(5) : raw;
}

function shouldPrefer(candidate, incumbent) {
  if (!incumbent) return true;
  if (!candidate) return false;
  const candProd = String(candidate.id || '').indexOf('prod_') === 0;
  const incProd = String(incumbent.id || '').indexOf('prod_') === 0;
  if (candProd && !incProd) return true;
  if (!candProd && incProd) return false;
  return Number(candidate.stock || 0) >= Number(incumbent.stock || 0);
}

async function main() {
  const db = getFirestoreAdmin();
  const snap = await db.collection('products').get();
  const docs = snap.docs.map(function(doc) {
    return { id: doc.id, data: doc.data() || {}, ref: doc.ref };
  });

  const groups = Object.create(null);
  docs.forEach(function(doc) {
    const key = canonicalProductKey(doc.id);
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(doc);
  });

  const toDelete = [];
  Object.keys(groups).forEach(function(key) {
    const list = groups[key];
    if (list.length < 2) return;
    let keeper = list[0];
    for (let i = 1; i < list.length; i++) {
      const candidate = list[i];
      const candView = { id: candidate.id, stock: candidate.data.stock };
      const incView = { id: keeper.id, stock: keeper.data.stock };
      if (shouldPrefer(candView, incView)) keeper = candidate;
    }
    list.forEach(function(doc) {
      if (doc.id !== keeper.id) toDelete.push(doc);
    });
  });

  console.log('Scanned', docs.length, 'product docs');
  console.log('Duplicate groups:', Object.keys(groups).filter(function(k) { return groups[k].length > 1; }).length);
  console.log('Orphan docs to remove:', toDelete.length);
  toDelete.forEach(function(doc) {
    console.log(' -', doc.id, '(keep', groups[canonicalProductKey(doc.id)].find(function(d) {
      return !toDelete.some(function(x) { return x.id === d.id; });
    })?.id + ')');
  });

  if (!toDelete.length) {
    console.log('\nNo duplicate product docs found.');
    return;
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to delete orphan docs.');
    return;
  }

  for (const doc of toDelete) {
    await doc.ref.delete();
    console.log('Deleted', doc.id);
  }
  console.log('\nCleanup complete. Run npm run build && deploy to refresh bootstrap.');
}

main().catch(function(err) {
  console.error(err.message || err);
  process.exit(1);
});
