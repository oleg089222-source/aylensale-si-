#!/usr/bin/env node
/**
 * Reset server-side spamGuard rate limits for winner claim / send-order testing.
 * Also prints client localStorage keys to clear in browser.
 *
 * Usage: node scripts/reset-winner-rate-limits.mjs
 */
import { loadProjectEnv } from './lib/load-env.mjs';
import { getFirestoreAdmin } from '../lib/server/firebase-admin-app.mjs';
import { isAdminConfigured } from '../lib/server/firestore-admin.mjs';

loadProjectEnv();

const SCOPES = ['auction-winner', 'order', 'auction-winner-payment'];

async function main() {
  console.log('\n=== Reset winner rate limits ===\n');

  if (!isAdminConfigured()) {
    console.error('FIREBASE_SERVICE_ACCOUNT not configured');
    process.exit(1);
  }

  const db = getFirestoreAdmin();
  const snap = await db.collection('spamGuard').get();
  let removed = 0;
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    const scope = String((doc.data() || {}).scope || '');
    const id = doc.id;
    const match = SCOPES.some((s) => scope === s || id.includes(s.replace(/-/g, '')));
    if (match || scope.includes('auction') || scope.includes('order')) {
      batch.delete(doc.ref);
      removed++;
    }
  });
  if (removed) await batch.commit();

  console.log('Firestore spamGuard docs removed:', removed);
  console.log('\nBrowser (DevTools console on Preview):');
  console.log("  localStorage.removeItem('aylen_winner_attempts');");
  console.log("  localStorage.removeItem('aylen_order_attempts');");
  console.log('  location.reload();');
  console.log('\nDone.');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
