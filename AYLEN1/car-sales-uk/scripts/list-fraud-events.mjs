#!/usr/bin/env node
/**
 * List recent fraudLog entries from active auctions (admin read via Firestore).
 */
import { loadProjectEnv } from './lib/load-env.mjs';
import { getFirestoreAdmin } from '../lib/server/firebase-admin-app.mjs';

loadProjectEnv();

const db = getFirestoreAdmin();
const snap = await db.collection('auctions').get();
const events = [];

snap.docs.forEach(function(doc) {
  const data = doc.data() || {};
  const log = Array.isArray(data.fraudLog) ? data.fraudLog : [];
  log.forEach(function(entry) {
    events.push({
      auctionId: doc.id,
      auctionName: data.name || data.title || doc.id,
      at: entry.at || '',
      flags: entry.flags || (entry.code ? [entry.code] : []),
      name: entry.name || '',
      phoneKey: entry.phoneKey || '',
      blocked: entry.blocked === true,
      enforce: entry.enforce === true
    });
  });
});

events.sort(function(a, b) {
  return (Date.parse(b.at || 0) || 0) - (Date.parse(a.at || 0) || 0);
});

console.log(JSON.stringify({
  totalEvents: events.length,
  recent: events.slice(0, 20)
}, null, 2));
