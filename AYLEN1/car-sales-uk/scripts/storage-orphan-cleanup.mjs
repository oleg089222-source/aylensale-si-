#!/usr/bin/env node
/**
 * Find/delete Firebase Storage files not referenced in Firestore.
 *
 *   node scripts/storage-orphan-cleanup.mjs --remote           # dry-run
 *   node scripts/storage-orphan-cleanup.mjs --remote --apply  # delete (50/batch)
 */
import { loadProjectEnv } from './lib/load-env.mjs';
import { fmtBytes } from '../api/lib/storage-bulk-resize.mjs';

loadProjectEnv();

const REMOTE = process.argv.includes('--remote');
const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  if (i === -1 || !process.argv[i + 1]) return 50;
  return Math.max(1, parseInt(process.argv[i + 1], 10) || 50);
})();

async function runRemote() {
  const base = (process.env.VERIFY_URL || 'https://aylensale.com').replace(/\/$/, '');
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) {
    console.error('ADMIN_PASSWORD missing for remote orphan cleanup');
    process.exit(1);
  }
  const res = await fetch(base + '/api/storage-orphans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, apply: APPLY, limit: LIMIT })
  });
  const data = await res.json().catch(function() { return {}; });
  if (!res.ok || !data.ok) {
    console.error('Failed:', data.error || res.status);
    process.exit(1);
  }
  console.log('\n=== Storage orphan cleanup (' + data.mode + ') ===');
  console.log('Scanned:', data.scanned, '| In use:', data.referencedCount, '| Orphans:', data.orphanTotal);
  console.log('This batch:', data.plannedOrDeleted, '| Freed:', data.saved || fmtBytes(data.savedBytes || 0));
  (data.rows || []).slice(0, 20).forEach(function(row) {
    console.log(' ', row.name, row.saved || '');
  });
  if (data.truncated) console.log(' (list truncated)');
  if (!APPLY && data.orphanTotal > 0) {
    console.log('\nRun with --remote --apply to delete orphans (batch size', LIMIT + ')');
  }
}

async function runLocal() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('Use --remote or set FIREBASE_SERVICE_ACCOUNT');
    process.exit(1);
  }
  const { runStorageOrphanCleanup } = await import('../api/lib/storage-orphan-cleanup.mjs');
  const result = await runStorageOrphanCleanup({ apply: APPLY, limit: LIMIT });
  console.log('\n=== Storage orphan cleanup (' + result.mode + ') ===');
  console.log('Scanned:', result.scanned, '| In use:', result.referencedCount, '| Orphans:', result.orphanTotal);
  console.log('This batch:', result.plannedOrDeleted, '| Freed:', result.saved);
  (result.rows || []).slice(0, 20).forEach(function(row) {
    console.log(' ', row.name, row.size ? fmtBytes(row.size) : '');
  });
}

if (REMOTE) runRemote().catch(function(e) { console.error(e); process.exit(1); });
else runLocal().catch(function(e) { console.error(e); process.exit(1); });
