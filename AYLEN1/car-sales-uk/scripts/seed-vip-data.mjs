#!/usr/bin/env node
/**
 * Seed VIP stock items to Firestore (requires FIREBASE_SERVICE_ACCOUNT in env).
 * Usage: node scripts/seed-vip-data.mjs [--force]
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const force = process.argv.includes('--force');

const CATEGORIES = ['electronics', 'homeware', 'clothing', 'accessories', 'general'];
const TEMPLATES = {
  electronics: ['Amazon returns electronics mix', 'Refurb-ready tech pallet', 'Phone accessories box', 'Smart home returns', 'Electronics weekend special'],
  homeware: ['Homeware returns pallet', 'Kitchen essentials mix', 'Home décor job lot', 'Storage organisation box', 'Homeware mystery pallet'],
  clothing: ['Clothing returns mix', 'Kids clothing job lot', 'Menswear returns box', 'Womenswear pallet preview', 'Footwear & accessories mix'],
  accessories: ['Accessories returns bundle', 'Sunglasses & fashion', 'Beauty accessories lot', 'Travel accessories mix', 'Accessories mystery box'],
  general: ['Amazon general returns pallet', 'Car boot starter pallet', 'Wholesale mixed box', 'Liquidation mystery pallet', 'General merchandise lot']
};

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Set FIREBASE_SERVICE_ACCOUNT');
  const cred = JSON.parse(raw);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  return admin.firestore();
}

async function main() {
  const db = initAdmin();
  const col = db.collection('vipStockItems');
  const existing = await col.limit(1).get();
  if (!existing.empty && !force) {
    console.log('VIP stock already exists. Use --force to add starter items anyway.');
    process.exit(0);
  }
  let order = 10;
  let count = 0;
  for (const cat of CATEGORIES) {
    const titles = TEMPLATES[cat] || [];
    for (let i = 0; i < 5; i++) {
      const id = 'vip_seed_' + cat + '_' + (i + 1);
      await col.doc(id).set({
        title: titles[i] || ('VIP ' + cat + ' item ' + (i + 1)),
        name: titles[i] || ('VIP ' + cat + ' item ' + (i + 1)),
        desc: 'Starter VIP preview — edit in Admin → VIP Members.',
        category: cat,
        categoryLabel: cat.charAt(0).toUpperCase() + cat.slice(1),
        vipPrice: 40 + i * 10,
        badge: 'VIP',
        visible: true,
        sortOrder: order,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      order += 10;
      count++;
    }
  }
  console.log('Seeded', count, 'VIP stock items.');
}

main().catch(function(e) {
  console.error(e.message || e);
  process.exit(1);
});
