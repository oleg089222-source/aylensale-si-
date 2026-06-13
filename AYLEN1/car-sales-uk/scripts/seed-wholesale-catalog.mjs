#!/usr/bin/env node
/**
 * Seed wholesale car-boot catalog from data/wholesale-products.csv
 * and price list from data/wholesale-price-list.csv into Firestore.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/seed-wholesale-catalog.mjs
 *   FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/seed-wholesale-catalog.mjs --force
 *   FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/seed-wholesale-catalog.mjs --dry-run
 *   FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/seed-wholesale-catalog.mjs --products-only
 *   FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/seed-wholesale-catalog.mjs --pricelist-only
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');
const productsOnly = process.argv.includes('--products-only');
const pricelistOnly = process.argv.includes('--pricelist-only');

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Set FIREBASE_SERVICE_ACCOUNT env var (JSON service account).');
  const cred = JSON.parse(raw);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  return admin.firestore();
}

/** Parse a single CSV line respecting quoted fields. */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function loadCsv(relPath) {
  const text = readFileSync(join(root, relPath), 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map(function(h) { return h.trim(); });
  return lines.slice(1).map(function(line) {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach(function(key, idx) {
      row[key] = (cells[idx] || '').trim();
    });
    return row;
  });
}

function productDocId(sku) {
  return 'wholesale_' + String(sku || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function priceListDocId(sku) {
  return 'pli_' + String(sku || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function tagsArray(raw) {
  return String(raw || '')
    .split(',')
    .map(function(t) { return t.trim(); })
    .filter(Boolean);
}

function boolish(val) {
  const s = String(val || '').trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === '1';
}

function num(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function rowToProduct(row, now) {
  const sku = row.sku || '';
  const price = num(row.price, 0);
  const wholesale = num(row.wholesalePrice, Math.round(price * 0.7 * 100) / 100);
  const stock = Math.max(0, Math.floor(num(row.stock, 10)));
  const active = stock > 0 && row.stockStatus !== 'sold_out';
  const desc = row.desc || '';
  const policyId = row.listingPolicyId || 'policy_amazon_returns';

  return {
    id: productDocId(sku),
    sku,
    name: row.name || sku,
    title: row.name || sku,
    shortTitle: row.shortTitle || (row.name || '').slice(0, 60),
    desc,
    description: desc,
    category: row.category || 'general',
    categoryLabel: (row.category || 'general').replace(/-/g, ' '),
    price,
    retail: price,
    retailPrice: price,
    wholesale,
    wholesalePrice: wholesale,
    minQty: Math.max(1, Math.floor(num(row.minQty, 1))),
    unitCount: Math.max(0, Math.floor(num(row.unitCount, 0))),
    grade: row.grade || 'B',
    stock,
    stockStatus: row.stockStatus || 'available',
    badge: row.badge || 'Car Boot Ready',
    policyId,
    listingPolicyId: policyId,
    conditionDesc: row.conditionDesc || '',
    wholesaleNote: row.wholesaleNote || '',
    pickupNote: row.pickupNote || '',
    tags: tagsArray(row.tags),
    vipEarly: boolish(row.vipEarly),
    active,
    status: active ? 'active' : 'hidden',
    discount: 0,
    salePrice: price,
    images: [],
    photos: [],
    isDemo: false,
    demo: false,
    test: false,
    wholesaleCatalog: true,
    createdAt: now,
    updatedAt: now
  };
}

function rowToPriceListItem(row, productId, sortOrder, now) {
  const sku = row.sku || '';
  return {
    id: priceListDocId(sku),
    sourceProductId: productId || '',
    name: row.name || sku,
    desc: row.description || row.desc || '',
    category: row.category || '',
    retailPrice: num(row['retail price'] || row.retailPrice, 0),
    wholesalePrice: num(row['wholesale price'] || row.wholesalePrice, 0),
    bulkPrice: num(row['bulk price'] || row.bulkPrice, 0),
    minQty: Math.max(1, Math.floor(num(row['minimum quantity'] || row.minQty, 1))),
    stockStatus: row['stock/status'] || row.stockStatus || 'available',
    note: row.note || '',
    visible: true,
    sortOrder: Math.floor(num(row['sort order'] || row.sortOrder, sortOrder)),
    images: [],
    photoUrl: row.photo || '',
    updatedAt: now
  };
}

async function seedProducts(db, rows, now) {
  const col = db.collection('products');
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const doc = rowToProduct(row, now);
    const ref = col.doc(doc.id);
    const existing = await ref.get();
    if (existing.exists && !force) {
      skipped++;
      console.log('  skip product (exists):', doc.sku);
      continue;
    }
    const payload = Object.assign({}, doc);
    delete payload.id;
    if (dryRun) {
      console.log('  [dry-run] product:', doc.sku, '→', doc.id);
      created++;
      continue;
    }
    await ref.set(payload, { merge: true });
    console.log('  ✓ product:', doc.sku);
    created++;
  }
  return { created, skipped };
}

async function seedPriceList(db, rows, now) {
  const col = db.collection('priceListItems');
  let created = 0;
  let skipped = 0;
  let order = 10;

  for (const row of rows) {
    const sku = row.sku || '';
    const productId = sku ? productDocId(sku) : '';
    const item = rowToPriceListItem(row, productId, order, now);
    order += 10;
    const ref = col.doc(item.id);
    const existing = await ref.get();
    if (existing.exists && !force) {
      skipped++;
      console.log('  skip price list (exists):', item.name);
      continue;
    }
    const payload = Object.assign({}, item);
    delete payload.id;
    if (dryRun) {
      console.log('  [dry-run] price list:', item.name);
      created++;
      continue;
    }
    await ref.set(payload, { merge: true });
    console.log('  ✓ price list:', item.name);
    created++;
  }
  return { created, skipped };
}

async function main() {
  const productRows = loadCsv('data/wholesale-products.csv');
  const priceRows = loadCsv('data/wholesale-price-list.csv');

  console.log('AYLENSALE wholesale catalog seed');
  if (dryRun) console.log('(dry-run — no writes)');
  if (force) console.log('(--force — overwrite existing docs)');

  if (dryRun) {
    console.log('\nProducts:', productRows.length, 'rows');
    productRows.forEach(function(row) {
      const doc = rowToProduct(row, new Date().toISOString());
      console.log('  [dry-run] product:', doc.sku, '→', doc.id, '£' + doc.wholesalePrice);
    });
    console.log('\nPrice list:', priceRows.length, 'rows');
    priceRows.forEach(function(row, idx) {
      const item = rowToPriceListItem(row, productDocId(row.sku), (idx + 1) * 10, new Date().toISOString());
      console.log('  [dry-run] price list:', item.name, '£' + item.wholesalePrice);
    });
    console.log('\nDry-run OK. Set FIREBASE_SERVICE_ACCOUNT and run without --dry-run to publish.');
    return;
  }

  const db = initAdmin();
  const now = new Date().toISOString();

  let productStats = { created: 0, skipped: 0 };
  let priceStats = { created: 0, skipped: 0 };

  if (!pricelistOnly) {
    console.log('\nProducts:', productRows.length, 'rows');
    productStats = await seedProducts(db, productRows, now);
  }

  if (!productsOnly) {
    console.log('\nPrice list:', priceRows.length, 'rows');
    priceStats = await seedPriceList(db, priceRows, now);
  }

  console.log('\nDone.');
  console.log('Products — created:', productStats.created, 'skipped:', productStats.skipped);
  console.log('Price list — created:', priceStats.created, 'skipped:', priceStats.skipped);
  console.log('\nNext: add photos in Admin → Products, then publish.');
}

main().catch(function(e) {
  console.error(e.message || e);
  process.exit(1);
});
