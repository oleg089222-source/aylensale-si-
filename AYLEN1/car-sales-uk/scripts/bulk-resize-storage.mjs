#!/usr/bin/env node
/**
 * Bulk-optimize Firebase Storage product/auction images (resize + compress).
 *
 * Local (needs FIREBASE_SERVICE_ACCOUNT or service-account JSON file):
 *   node scripts/bulk-resize-storage.mjs              # dry-run
 *   node scripts/bulk-resize-storage.mjs --apply
 *   node scripts/bulk-resize-storage.mjs --limit 20 --apply
 *
 * Remote (production API — needs ADMIN_PASSWORD):
 *   node scripts/bulk-resize-storage.mjs --remote
 *   node scripts/bulk-resize-storage.mjs --remote --apply --limit 30
 */
import { loadProjectEnv } from './lib/load-env.mjs';
import { fmtBytes, runStorageBulkResize } from '../lib/server/storage-bulk-resize.mjs';
import { getStorageBucket } from '../lib/server/firebase-admin-app.mjs';

loadProjectEnv();

const REMOTE = process.argv.includes('--remote');
const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  if (i === -1 || !process.argv[i + 1]) return 0;
  return Math.max(1, parseInt(process.argv[i + 1], 10) || 0);
})();

async function runRemote() {
  const base = (process.env.VERIFY_URL || 'https://aylensale.com').replace(/\/$/, '');
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) {
    console.error('ADMIN_PASSWORD missing. Set it in env or parent .env.local');
    process.exit(1);
  }

  console.log('\n=== AYLENSALE bulk storage resize (remote) ===');
  console.log('URL:', base);
  console.log('Mode:', APPLY ? 'APPLY (writes)' : 'DRY-RUN');
  if (LIMIT) console.log('Limit:', LIMIT, 'files');

  const res = await fetch(base + '/api/storage-resize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, apply: APPLY, limit: LIMIT || 0 })
  });
  const data = await res.json().catch(function() { return {}; });
  if (!res.ok || !data.ok) {
    console.error('Remote resize failed:', data.error || res.status);
    process.exit(1);
  }

  (data.rows || []).forEach(function(row) {
    if (row.error) {
      console.error(' FAIL', row.name, row.error);
      return;
    }
    const tag = APPLY ? ' OK  ' : ' PLAN';
    console.log(
      tag,
      row.name,
      fmtBytes(row.before) + ' → ' + fmtBytes(row.after),
      row.resized ? '(resize)' : ''
    );
  });

  console.log('\nSummary:');
  console.log('  Scanned:', data.scanned, 'images');
  console.log('  Processed:', data.processed);
  console.log('  Planned/Applied:', data.plannedOrApplied);
  console.log('  Skipped:', data.skipped);
  console.log('  Saved:', data.saved || fmtBytes(data.savedBytes || 0));
  if (data.truncated) console.log('  (row list truncated in API response)');
  if (!APPLY && data.plannedOrApplied > 0) {
    console.log('\nRun with --remote --apply to optimize', data.plannedOrApplied, 'file(s).');
  }
}

async function runLocal() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error(
      'FIREBASE_SERVICE_ACCOUNT missing locally.\n' +
      'Use --remote (needs ADMIN_PASSWORD) or paste service-account JSON into .env.local\n' +
      'or set FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json'
    );
    process.exit(1);
  }

  const bucket = getStorageBucket();
  console.log('\n=== AYLENSALE bulk storage resize ===');
  console.log('Mode:', APPLY ? 'APPLY (writes)' : 'DRY-RUN');
  console.log('Bucket:', bucket.name);
  if (LIMIT) console.log('Limit:', LIMIT, 'files');

  const result = await runStorageBulkResize({
    apply: APPLY,
    limit: LIMIT,
    onProgress: function(evt) {
      const row = evt.row;
      if (evt.type === 'skip') return;
      if (evt.type === 'fail') {
        console.error(' FAIL', row.name, row.error);
        return;
      }
      const tag = evt.type === 'apply' ? ' OK  ' : ' PLAN';
      console.log(
        tag,
        row.name,
        fmtBytes(row.before) + ' → ' + fmtBytes(row.after),
        '(' + row.width + '×' + row.height + (row.resized ? ', resize' : '') + ')'
      );
    }
  });

  console.log('\nSummary:');
  console.log('  Scanned:', result.scanned, 'images');
  console.log('  Processed:', result.processed);
  console.log('  Planned/Applied:', result.planned);
  console.log('  Skipped:', result.skipped);
  console.log('  Saved:', result.saved);
  if (!APPLY && result.planned > 0) {
    console.log('\nRun with --apply to optimize', result.planned, 'file(s).');
  }
}

async function main() {
  if (REMOTE) return runRemote();
  return runLocal();
}

main().catch(function(err) {
  console.error(err);
  process.exit(1);
});
