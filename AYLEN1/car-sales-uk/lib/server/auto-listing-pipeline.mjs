/**
 * Automated listing pipeline: photo(s) → GPT vision → manifest/grade → upload → publish.
 * Supports product (fixed price) or auction routing for pallets/job lots.
 */
import { uploadAdminMediaBuffer } from './admin-media.mjs';
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import {
  buildAuctionSchedule,
  DEFAULT_VIP_EARLY_ACCESS_HOURS
} from './auction-early-access.mjs';
import { runScanPostPublish, catalogListingSnapshot } from './scan-post-publish.mjs';

const ALLOWED_CATEGORIES = ['electronics', 'homeware', 'clothing', 'accessories', 'general', 'job-lots', 'cables'];
const ALLOWED_GRADES = ['A', 'B', 'C', 'mixed'];

const CATEGORY_DEFAULT_PRICES = {
  'job-lots': 29.99,
  electronics: 24.99,
  homeware: 19.99,
  clothing: 14.99,
  accessories: 12.99,
  cables: 9.99,
  general: 14.99
};

const GRADE_PRICE_MULTIPLIER = {
  A: 0.75,
  B: 0.5,
  C: 0.25,
  mixed: 0.4
};

const AUCTION_START_RATIO = 0.3;
const AUCTION_THRESHOLD_GBP = 100;
const AUCTION_MANIFEST_RRP_GBP = 500;

const RESPONSE_SCHEMA = `{
  "name": "string",
  "shortTitle": "string",
  "category": "electronics|homeware|clothing|accessories|general|job-lots|cables",
  "categoryLabel": "string",
  "desc": "string",
  "conditionDesc": "string",
  "price": number,
  "wholesalePrice": number|null,
  "stock": number,
  "stockStatus": "available|low|sold_out|pre_order",
  "grade": "A|B|C|mixed",
  "gradeReason": "string",
  "isPallet": boolean,
  "tags": ["string"],
  "ebayKeywords": ["string"],
  "sku": "string",
  "brand": "string",
  "model": "string",
  "wholesaleNote": "string",
  "pickupNote": "string",
  "disclaimer": "string",
  "seoTitle": "string",
  "seoDescription": "string",
  "badge": "string",
  "imageAltTexts": ["string"],
  "confidence": number,
  "summary": "string",
  "assistantReply": "string"
}`;

const MANIFEST_SCHEMA = `{
  "totalUnits": number,
  "totalRrp": number,
  "lines": [{"sku":"string","title":"string","qty":number,"rrp":number,"grade":"A|B|C|mixed","condition":"string"}]
}`;

const VISION_SYSTEM = `You are AYLENSALE warehouse vision AI for UK Amazon returns / job lots.
Scan the photo(s): box labels, barcodes, brand logos, pallet stickers, item condition.
Write polished British English (en-GB) listing fields. Never use Cyrillic in customer fields.
Untested returns: say "untested", "sold as seen" where appropriate.
Read visible RRP/Amazon prices on labels — use as price if clear. Otherwise estimate fair UK resale for returns.
Job lot / mixed pallet / multiple items → category job-lots, isPallet true, stock 1.
Grade rules (Amazon liquidation standard):
- A: factory sealed, undamaged retail packaging
- B: open box, minor cosmetic damage, complete accessories likely
- C: damaged packaging, missing parts visible, heavy wear
- mixed: pallet with multiple grades visible
Set grade and gradeReason. If grade A/B/C set badge like "Grade A".
category: one of electronics, homeware, clothing, accessories, general, job-lots, cables.
Return JSON only matching schema. Do not invent brands/models not visible.`;

const MANIFEST_SYSTEM = 'You are AYLENSALE pallet manifest generator for UK B2B liquidation buyers.\n' +
  'From warehouse photos, build a manifest of visible inventory on the pallet/boxes.\n' +
  'Read labels, barcodes, box counts, brand names. Estimate qty when multiple identical boxes visible.\n' +
  'Each line: sku (or ASIN if visible, else PALLET-NNN), title, qty, rrp GBP, grade A|B|C|mixed, condition note.\n' +
  'totalUnits = sum of line qty. totalRrp = sum(qty * rrp).\n' +
  'Be conservative — only list what is reasonably visible. UK English titles.\n' +
  'Return JSON only: {"manifest": ' + MANIFEST_SCHEMA + '}';

function cleanString(value, max) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

function normalizeGrade(raw) {
  const g = cleanString(raw, 10).toUpperCase();
  if (g === 'MIXED') return 'mixed';
  if (ALLOWED_GRADES.includes(g)) return g;
  return 'B';
}

export function normalizeDraft(raw) {
  const d = raw || {};
  const price = Number(d.price);
  const wholesale = d.wholesalePrice === null || d.wholesalePrice === undefined
    ? null
    : Number(d.wholesalePrice);
  const stock = Number.isFinite(Number(d.stock)) ? Math.max(0, Math.floor(Number(d.stock))) : 1;
  let category = cleanString(d.category, 40).toLowerCase();
  if (!ALLOWED_CATEGORIES.includes(category)) category = 'general';
  const grade = normalizeGrade(d.grade);

  let stockStatus = cleanString(d.stockStatus, 20).toLowerCase();
  if (!['available', 'low', 'sold_out', 'pre_order'].includes(stockStatus)) {
    stockStatus = stock > 0 ? 'available' : 'sold_out';
  }

  let badge = cleanString(d.badge, 40);
  if (!badge && grade && grade !== 'mixed') badge = 'Grade ' + grade;
  else if (!badge && grade === 'mixed') badge = 'Mixed grades';

  return {
    name: cleanString(d.name, 140),
    shortTitle: cleanString(d.shortTitle, 80),
    category,
    categoryLabel: cleanString(d.categoryLabel, 80),
    desc: cleanString(d.desc, 2000),
    conditionDesc: cleanString(d.conditionDesc, 1000),
    price: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : 0,
    wholesalePrice: Number.isFinite(wholesale) && wholesale > 0 ? Math.round(wholesale * 100) / 100 : null,
    stock: stock || 1,
    stockStatus,
    grade,
    gradeReason: cleanString(d.gradeReason, 300),
    isPallet: d.isPallet === true || category === 'job-lots',
    tags: Array.isArray(d.tags) ? d.tags.map((t) => cleanString(t, 40)).filter(Boolean).slice(0, 20) : [],
    ebayKeywords: Array.isArray(d.ebayKeywords)
      ? d.ebayKeywords.map((t) => cleanString(t, 60)).filter(Boolean).slice(0, 20)
      : [],
    sku: cleanString(d.sku, 40),
    brand: cleanString(d.brand, 80),
    model: cleanString(d.model, 80),
    wholesaleNote: cleanString(d.wholesaleNote, 500),
    pickupNote: cleanString(d.pickupNote, 500),
    disclaimer: cleanString(d.disclaimer, 500),
    seoTitle: cleanString(d.seoTitle, 70),
    seoDescription: cleanString(d.seoDescription, 160),
    badge,
    imageAltTexts: Array.isArray(d.imageAltTexts)
      ? d.imageAltTexts.map((t) => cleanString(t, 120)).filter(Boolean).slice(0, 10)
      : [],
    confidence: Math.min(1, Math.max(0, Number(d.confidence) || 0.5)),
    summary: cleanString(d.summary, 300),
    assistantReply: cleanString(d.assistantReply, 200)
  };
}

function normalizeManifest(raw, draft) {
  const m = raw?.manifest || raw || {};
  const lines = Array.isArray(m.lines)
    ? m.lines.slice(0, 100).map((line, i) => ({
      sku: cleanString(line.sku, 40) || ('LINE-' + String(i + 1).padStart(3, '0')),
      title: cleanString(line.title, 140) || 'Untitled line item',
      qty: Math.max(1, Math.floor(Number(line.qty) || 1)),
      rrp: Math.max(0, Math.round(Number(line.rrp || 0) * 100) / 100),
      grade: normalizeGrade(line.grade || draft?.grade),
      condition: cleanString(line.condition, 200) || 'Untested — sold as seen'
    }))
    : [];

  let totalUnits = Number(m.totalUnits);
  let totalRrp = Number(m.totalRrp);
  if (!Number.isFinite(totalUnits) || totalUnits <= 0) {
    totalUnits = lines.reduce((sum, l) => sum + l.qty, 0);
  }
  if (!Number.isFinite(totalRrp) || totalRrp <= 0) {
    totalRrp = Math.round(lines.reduce((sum, l) => sum + l.qty * l.rrp, 0) * 100) / 100;
  }

  const manifestId = 'mfst_' + Date.now();
  return {
    manifestId,
    totalUnits: totalUnits || 1,
    totalRrp,
    lines,
    generatedAt: new Date().toISOString(),
    source: 'ai_vision_v2'
  };
}

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const visionModel = process.env.OPENAI_VISION_MODEL || model;
  return { apiKey, base, model, visionModel };
}

async function callOpenAI(messages, model) {
  const { apiKey, base } = getOpenAIConfig();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || getOpenAIConfig().visionModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || 'OpenAI request failed');
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty AI response');
  return JSON.parse(content);
}

function buildVisionMessages(images, hint) {
  const content = [
    {
      type: 'text',
      text: VISION_SYSTEM + '\nJSON schema:\n' + RESPONSE_SCHEMA +
        '\nAdmin hint (RU/UK/EN, may include price/qty/auction): ' + (hint || 'Warehouse box/pallet scan for live UK listing.')
    }
  ];
  const maxVision = Math.min(images.length, 4);
  for (let i = 0; i < maxVision; i++) {
    const img = images[i];
    const mime = cleanString(img.mimeType, 30) || 'image/jpeg';
    const b64 = cleanString(img.base64, 6_000_000);
    if (b64) {
      content.push({
        type: 'image_url',
        image_url: { url: 'data:' + mime + ';base64,' + b64, detail: i === 0 ? 'high' : 'low' }
      });
    }
  }
  return [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content }];
}

function buildManifestMessages(images, draft) {
  const content = [
    {
      type: 'text',
      text: MANIFEST_SYSTEM +
        '\nListing context: ' + JSON.stringify({
          name: draft.name,
          category: draft.category,
          grade: draft.grade,
          isPallet: draft.isPallet
        })
    }
  ];
  const maxVision = Math.min(images.length, 4);
  for (let i = 0; i < maxVision; i++) {
    const img = images[i];
    const mime = cleanString(img.mimeType, 30) || 'image/jpeg';
    const b64 = cleanString(img.base64, 6_000_000);
    if (b64) {
      content.push({
        type: 'image_url',
        image_url: { url: 'data:' + mime + ';base64,' + b64, detail: i === 0 ? 'high' : 'low' }
      });
    }
  }
  return [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content }];
}

function buildHintMergeMessages(draft, hint) {
  return [
    {
      role: 'system',
      content: 'Merge admin voice/text hint into existing product draft. Apply price, qty, condition, auction intent. UK English only in listing fields. Return JSON: {"draft": {...same schema with grade...}}'
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'merge_hint',
        adminHint: hint,
        existingDraft: draft
      })
    }
  ];
}

function buildFullDescription(d, manifest) {
  const parts = [d.desc];
  if (d.brand || d.model) {
    parts.push('\n\n' + [d.brand, d.model].filter(Boolean).join(' — '));
  }
  if (d.grade && d.gradeReason) {
    parts.push('\n\nGrade ' + d.grade.toUpperCase() + ': ' + d.gradeReason);
  }
  if (manifest && manifest.lines && manifest.lines.length) {
    parts.push('\n\nManifest summary: ' + manifest.totalUnits + ' units, est. RRP £' + manifest.totalRrp.toFixed(2));
    const preview = manifest.lines.slice(0, 8).map((l) =>
      '- ' + l.qty + '× ' + l.title + (l.rrp ? ' (£' + l.rrp.toFixed(2) + ' RRP each)' : '')
    );
    parts.push('\n' + preview.join('\n'));
    if (manifest.lines.length > 8) {
      parts.push('\n… and ' + (manifest.lines.length - 8) + ' more line(s) — see full manifest on listing.');
    }
  }
  if (d.conditionDesc) parts.push('\n\nCondition:\n' + d.conditionDesc);
  if (d.pickupNote) parts.push('\n\nPickup / delivery:\n' + d.pickupNote);
  if (d.wholesaleNote) parts.push('\n\nWholesale:\n' + d.wholesaleNote);
  if (d.disclaimer) parts.push('\n\n' + d.disclaimer);
  if (d.ebayKeywords && d.ebayKeywords.length) {
    parts.push('\n\neBay keywords: ' + d.ebayKeywords.join(', '));
  }
  return parts.filter(Boolean).join('');
}

function defaultChannels() {
  return {
    website: { enabled: true, stock: 0, externalId: null, lastSyncAt: null },
    ebay: { enabled: false, stock: null, externalId: null, listingId: null, lastSyncAt: null },
    vinted: { enabled: false, stock: null, externalId: null, lastSyncAt: null },
    facebook: { enabled: false, stock: null, externalId: null, lastSyncAt: null },
    tiktok: { enabled: false, stock: null, externalId: null, lastSyncAt: null }
  };
}

function normalizeInventoryFields(product) {
  const p = Object.assign({}, product);
  let stock = parseInt(p.stock, 10);
  if (isNaN(stock) || stock < 0) stock = 0;
  p.stock = stock;
  if (!p.sku || !String(p.sku).trim()) {
    const stamp = String(p.id || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(-8);
    p.sku = 'AYLE-' + stamp;
  }
  if (!p.status) p.status = p.active === false ? 'hidden' : 'active';

  const inv = p.inventory && typeof p.inventory === 'object' ? Object.assign({}, p.inventory) : {};
  if (!inv.channels || typeof inv.channels !== 'object') inv.channels = defaultChannels();
  inv.onHand = typeof inv.onHand === 'number' ? inv.onHand : stock;
  inv.reserved = typeof inv.reserved === 'number' ? inv.reserved : 0;
  if (!inv.channels.website) inv.channels.website = defaultChannels().website;
  inv.channels.website.stock = stock;
  inv.channels.website.enabled = true;
  inv.updatedAt = new Date().toISOString();
  p.inventory = inv;
  return p;
}

async function getDefaultPolicyId(requestedId) {
  if (requestedId) return String(requestedId).trim();
  try {
    const db = getFirestoreAdmin();
    const snap = await db.collection('listingPolicies').limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  } catch (e) {
    console.warn('auto-listing: policy lookup failed', e.message);
  }
  return '';
}

function applyGradePricing(draft) {
  const d = Object.assign({}, draft);
  const mult = GRADE_PRICE_MULTIPLIER[d.grade] || GRADE_PRICE_MULTIPLIER.B;
  if (d.price > 0 && d.grade && d.grade !== 'mixed') {
    d.price = Math.round(d.price * mult * 100) / 100;
    d.gradeAdjusted = true;
  } else if (d.price > 0 && d.grade === 'mixed') {
    d.price = Math.round(d.price * GRADE_PRICE_MULTIPLIER.mixed * 100) / 100;
    d.gradeAdjusted = true;
  }
  if (!d.wholesalePrice) {
    d.wholesalePrice = Math.round(d.price * 0.7 * 100) / 100;
  }
  return d;
}

function applyPriceFallback(draft, priceOverride) {
  const d = Object.assign({}, draft);
  if (priceOverride && Number(priceOverride) > 0) {
    d.price = Math.round(Number(priceOverride) * 100) / 100;
    d.priceEstimated = false;
    return d;
  }
  if (!d.price || d.price <= 0) {
    d.price = CATEGORY_DEFAULT_PRICES[d.category] || CATEGORY_DEFAULT_PRICES.general;
    d.priceEstimated = true;
  }
  if (!d.wholesalePrice) {
    d.wholesalePrice = Math.round(d.price * 0.7 * 100) / 100;
  }
  return d;
}

function isPalletListing(draft, hint) {
  if (draft.isPallet || draft.category === 'job-lots') return true;
  return /pallet|палет|manifest|job.?lot|микс|mixed.?lot/i.test(hint || '');
}

export function shouldCreateAuction(draft, hint, manifest, options) {
  if (options?.forceProduct) return false;
  if (options?.forceAuction) return true;
  const hintAuction = /auction|аукцион|bid|ставк|hammer/i.test(hint || '');
  if (hintAuction) return true;
  const price = Number(draft.price) || 0;
  const manifestRrp = Number(manifest?.totalRrp) || 0;
  if (draft.category === 'job-lots' && price >= AUCTION_THRESHOLD_GBP) return true;
  if (manifestRrp >= AUCTION_MANIFEST_RRP_GBP) return true;
  if (draft.isPallet && price >= AUCTION_THRESHOLD_GBP * 0.8) return true;
  return false;
}

async function analyzeImages(images, hint) {
  const { visionModel, model } = getOpenAIConfig();
  const parsed = await callOpenAI(buildVisionMessages(images, hint), visionModel);
  let draft = normalizeDraft(parsed.draft || parsed);

  const hintText = cleanString(hint, 2000);
  if (hintText.length >= 3) {
    try {
      const merged = await callOpenAI(buildHintMergeMessages(draft, hintText), model);
      draft = normalizeDraft(merged.draft || merged);
    } catch (e) {
      console.warn('auto-listing hint merge skipped:', e.message);
    }
  }
  return draft;
}

async function generateManifest(images, draft) {
  const { visionModel } = getOpenAIConfig();
  try {
    const parsed = await callOpenAI(buildManifestMessages(images, draft), visionModel);
    return normalizeManifest(parsed, draft);
  } catch (e) {
    console.warn('auto-listing manifest skipped:', e.message);
    return null;
  }
}

async function uploadImages(entityId, images) {
  const urls = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const mime = cleanString(img.mimeType, 30) || 'image/jpeg';
    const b64 = cleanString(img.base64, 6_000_000);
    if (!b64) continue;
    const buffer = Buffer.from(b64, 'base64');
    const result = await uploadAdminMediaBuffer({
      buffer,
      contentType: mime,
      entityId,
      storageFolder: 'products',
      fileName: 'scan_' + i + '.jpg'
    });
    if (result.url) urls.push(result.url);
  }
  return urls;
}

function generateAuctionId() {
  return 'auction_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function draftToProductDoc(draft, productId, imageUrls, policyId, publish, manifest) {
  const fullDesc = buildFullDescription(draft, manifest);
  const wholesale = draft.wholesalePrice || Math.round(draft.price * 0.7 * 100) / 100;
  const active = publish && draft.stockStatus !== 'sold_out';
  const now = new Date().toISOString();

  const doc = normalizeInventoryFields({
    id: productId,
    name: draft.name || 'Warehouse item',
    title: draft.name || 'Warehouse item',
    shortTitle: draft.shortTitle,
    desc: fullDesc,
    description: fullDesc,
    category: draft.category,
    categoryLabel: draft.categoryLabel,
    price: draft.price,
    retail: draft.price,
    retailPrice: draft.price,
    wholesale,
    wholesalePrice: wholesale,
    stock: draft.stock,
    stockStatus: draft.stockStatus,
    grade: draft.grade,
    gradeReason: draft.gradeReason,
    isPallet: draft.isPallet,
    images: imageUrls,
    photos: imageUrls,
    badge: draft.badge || '',
    active,
    status: publish ? (active ? 'active' : 'hidden') : 'draft',
    discount: 0,
    salePrice: draft.price,
    tags: draft.tags,
    conditionDesc: draft.conditionDesc,
    wholesaleNote: draft.wholesaleNote,
    pickupNote: draft.pickupNote,
    disclaimer: draft.disclaimer,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    imageAltTexts: draft.imageAltTexts,
    brand: draft.brand,
    model: draft.model,
    sku: draft.sku || ('AYLE-' + String(productId).replace(/\D/g, '').slice(-8)),
    policyId,
    listingPolicyId: policyId,
    aiDraft: true,
    aiAutoScan: true,
    priceEstimated: !!draft.priceEstimated,
    gradeAdjusted: !!draft.gradeAdjusted,
    aiUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
    isDemo: false,
    demo: false,
    test: false
  });

  if (manifest && manifest.lines && manifest.lines.length) {
    doc.manifestId = manifest.manifestId;
    doc.manifest = manifest;
  }
  return doc;
}

function draftToAuctionDoc(draft, auctionId, imageUrls, publish, manifest, options) {
  const fullDesc = buildFullDescription(draft, manifest);
  const retail = draft.price || CATEGORY_DEFAULT_PRICES[draft.category] || 14.99;
  const startingPrice = Math.max(1, Math.round(retail * AUCTION_START_RATIO * 100) / 100);
  const durationType = retail >= 200 ? 'standard' : 'quick';
  const vipHours = Math.max(0, Number(
    options?.vipEarlyAccessHours ??
    process.env.AUTO_AUCTION_VIP_HOURS ??
    DEFAULT_VIP_EARLY_ACCESS_HOURS
  ) || 0);
  const schedule = buildAuctionSchedule({
    vipEarlyAccessHours: vipHours,
    durationType: options?.durationType || durationType,
    durationHours: options?.durationHours
  });
  const now = new Date();

  const doc = {
    id: auctionId,
    name: draft.name || 'Warehouse auction lot',
    title: draft.name || 'Warehouse auction lot',
    desc: fullDesc,
    description: fullDesc,
    category: draft.category || 'job-lots',
    startingPrice,
    startPrice: startingPrice,
    currentPrice: startingPrice,
    currentBid: startingPrice,
    endTime: schedule.endTime,
    endsAt: schedule.endTime,
    publicStartAt: schedule.publicStartAt,
    vipEarlyAccessHours: schedule.vipEarlyAccessHours,
    durationHours: schedule.durationHours,
    durationType: schedule.durationType,
    images: imageUrls,
    photos: imageUrls,
    bids: [],
    bidsCount: 0,
    status: publish ? 'active' : 'draft',
    grade: draft.grade,
    gradeReason: draft.gradeReason,
    isPallet: draft.isPallet,
    badge: draft.badge || ('Grade ' + (draft.grade || 'B')),
    aiDraft: true,
    aiAutoScan: true,
    aiUpdatedAt: now.toISOString(),
    createdAt: schedule.createdAt,
    updatedAt: now.toISOString(),
    estimatedRetail: retail,
    vipEarlyAccess: schedule.vipEarlyAccessHours > 0
  };

  if (manifest && manifest.lines && manifest.lines.length) {
    doc.manifestId = manifest.manifestId;
    doc.manifest = manifest;
  }
  return doc;
}

async function saveProductToFirestore(product) {
  const db = getFirestoreAdmin();
  const productId = String(product.id || ('prod_' + Date.now()));
  const ref = db.collection('products').doc(productId);
  const data = Object.assign({}, product);
  delete data.id;
  data.lastModified = new Date();
  await ref.set(data, { merge: true });
  return Object.assign({}, product, { id: productId });
}

async function saveAuctionToFirestore(auction) {
  const db = getFirestoreAdmin();
  const auctionId = String(auction.id || generateAuctionId());
  const ref = db.collection('auctions').doc(auctionId);
  const data = Object.assign({}, auction);
  delete data.id;
  data.lastModified = new Date();
  await ref.set(data, { merge: true });
  return Object.assign({}, auction, { id: auctionId });
}

/**
 * Full pipeline: vision → grade → manifest (pallets) → upload → product or auction.
 */
export async function runScanAndPublish(options) {
  const images = Array.isArray(options.images) ? options.images.filter((i) => i && i.base64) : [];
  if (!images.length) {
    throw new Error('At least one image is required');
  }
  if (images.length > 10) {
    throw new Error('Maximum 10 images per scan');
  }

  const hint = cleanString(options.hint, 2000);
  const publish = options.publish !== false;
  const entityId = 'prod_' + Date.now();

  const draftRaw = await analyzeImages(images, hint);
  if (!draftRaw.name) {
    throw new Error('Could not identify product from photo — try a clearer shot of the label');
  }

  let draft = applyPriceFallback(draftRaw, options.priceOverride);
  draft = applyGradePricing(draft);

  let manifest = null;
  if (isPalletListing(draft, hint) && options.skipManifest !== true) {
    manifest = await generateManifest(images, draft);
    if (manifest && manifest.totalRrp > draft.price && draft.priceEstimated) {
      draft.price = Math.round(manifest.totalRrp * (GRADE_PRICE_MULTIPLIER[draft.grade] || 0.4) * 100) / 100;
      draft.priceEstimated = true;
    }
  }

  const useAuction = shouldCreateAuction(draft, hint, manifest, options);
  const policyId = useAuction ? '' : await getDefaultPolicyId(options.policyId);
  const auctionId = useAuction ? generateAuctionId() : null;
  const uploadEntityId = useAuction ? auctionId : entityId;
  const imageUrls = await uploadImages(uploadEntityId, images);

  if (useAuction) {
    const auction = draftToAuctionDoc(draft, auctionId, imageUrls, publish, manifest, options);
    const saved = await saveAuctionToFirestore(auction);
    const published = publish && saved.status === 'active';
    const post = await runScanPostPublish({
      listingType: 'auction',
      saved,
      draft,
      manifest,
      grade: draft.grade,
      published,
      options
    });
    return {
      success: true,
      listingType: 'auction',
      auctionId: saved.id,
      productId: null,
      product: null,
      savedListing: catalogListingSnapshot(saved, 'auction'),
      telegramNotified: post.telegramNotified,
      vipMirrorId: post.vipMirrorId,
      auction: {
        id: saved.id,
        name: saved.name,
        category: saved.category,
        startingPrice: saved.startingPrice,
        endTime: saved.endTime,
        publicStartAt: saved.publicStartAt,
        vipEarlyAccessHours: saved.vipEarlyAccessHours,
        status: saved.status,
        grade: saved.grade,
        images: saved.images,
        manifestCsvUrl: manifest?.lines?.length
          ? '/api/manifest-csv?id=' + encodeURIComponent(saved.id) + '&type=auction'
          : null
      },
      draft,
      manifest,
      grade: draft.grade,
      imageUrls,
      published,
      routedAsAuction: true,
      auctionReason: manifest?.totalRrp >= AUCTION_MANIFEST_RRP_GBP
        ? 'manifest_rrp_threshold'
        : (draft.category === 'job-lots' ? 'job_lot_value' : 'hint_or_pallet')
    };
  }

  const product = draftToProductDoc(draft, entityId, imageUrls, policyId, publish, manifest);
  const saved = await saveProductToFirestore(product);
  const published = publish && saved.status === 'active';
  const post = await runScanPostPublish({
    listingType: 'product',
    saved,
    draft,
    manifest,
    grade: draft.grade,
    published,
    options
  });

  return {
    success: true,
    listingType: 'product',
    productId: saved.id,
    auctionId: null,
    savedListing: catalogListingSnapshot(saved, 'product'),
    telegramNotified: post.telegramNotified,
    vipMirrorId: post.vipMirrorId,
    product: {
      id: saved.id,
      name: saved.name,
      category: saved.category,
      price: saved.price,
      stock: saved.stock,
      status: saved.status,
      grade: saved.grade,
      images: saved.images,
      sku: saved.sku,
      priceEstimated: saved.priceEstimated,
      manifestLines: manifest?.lines?.length || 0,
      manifestCsvUrl: manifest?.lines?.length
        ? '/api/manifest-csv?id=' + encodeURIComponent(saved.id) + '&type=product'
        : null
    },
    auction: null,
    draft,
    manifest,
    grade: draft.grade,
    imageUrls,
    published,
    routedAsAuction: false
  };
}
