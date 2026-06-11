/**
 * AI Admin Assistant API — product listing drafts, image hints, stock commands.
 * Requires admin password via x-admin-key header (set after admin login).
 * Set OPENAI_API_KEY and optional OPENAI_MODEL on Vercel.
 */
import { verifyAdminPassword } from '../lib/server/admin-password.mjs';
import { runScanAndPublish } from '../lib/server/auto-listing-pipeline.mjs';

const rateLimits = new Map();

const ALLOWED_CATEGORIES = ['electronics', 'homeware', 'clothing', 'accessories', 'general', 'job-lots', 'cables'];

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-client-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';
}

function checkRateLimit(ip, maxPerMinute) {
  const now = Date.now();
  const cutoff = now - 60 * 1000;
  const limit = maxPerMinute || 20;
  const attempts = (rateLimits.get(ip) || []).filter((t) => t > cutoff);
  if (attempts.length >= limit) {
    rateLimits.set(ip, attempts);
    return false;
  }
  attempts.push(now);
  rateLimits.set(ip, attempts);
  return true;
}

async function isAdminRequest(req) {
  const key = req.headers['x-admin-key'] || req.body?.adminKey;
  if (!key) return false;
  return verifyAdminPassword(key);
}

function cleanString(value, max) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

const SYSTEM_PROMPT = `You are AYLENSALE's internal UK warehouse admin assistant (NOT customer-facing chat).
The admin speaks or types in Russian, Ukrainian, or English. Input is often messy voice transcription (wrong words, no punctuation).

Your job in order:
1. UNDERSTAND what the admin wants to list (product type, quantity, price, condition, job lot vs single item, pickup).
2. FIX transcription errors using context (e.g. homophones, missing words).
3. WRITE the listing in polished British English (en-GB) for a UK marketplace — never copy adminText verbatim into name, desc, or conditionDesc.
4. NEVER put Cyrillic in name, shortTitle, desc, conditionDesc, seoTitle, seoDescription, tags, or imageAltTexts.

Listing rules:
- Clear, factual UK English. No hype.
- Untested Amazon returns / job lots / mixed stock: say "untested", "sold as seen" where appropriate; never claim all items work unless admin said tested.
- Do not invent brands, models, or specs not stated or visible.
- Prices in GBP (£) only in numeric fields. Parse "39.99", "£40", "40 фунтов", "40 pounds".
- category: one of electronics, homeware, clothing, accessories, general, job-lots, cables.
- shortTitle max 60 chars; name max 140 chars (UK eBay/job-lot style).
- stockStatus: available | low | sold_out | pre_order.
- summary: one English sentence — what you understood (admin review).
- assistantReply: short English phrase to read aloud to admin (max 120 chars).
- questions: only if price, qty, or condition is unclear (max 5).
- Voice commands (Russian/English): e.g. "поставь цену 39.99", "добавь Amazon returns disclaimer", "title 80 chars" — apply to draft fields.
- ebayKeywords: 8–15 UK eBay search keywords (English, comma-separated concepts in array).
- sku: suggest AYLE-CATEGORY-XXX format if not provided.
- brand, model: only if stated or visible.

Return a single JSON object matching the schema. No markdown.`;

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
  "questions": [{"id":"string","field":"string","text":"string"}],
  "confidence": number,
  "detectedLang": "ru|uk|en|mixed",
  "summary": "string",
  "assistantReply": "string",
  "commandApplied": "string"
}`;

function normalizeDraft(raw) {
  const d = raw || {};
  const price = Number(d.price);
  const wholesale = d.wholesalePrice === null || d.wholesalePrice === undefined
    ? null
    : Number(d.wholesalePrice);
  const stock = Number.isFinite(Number(d.stock)) ? Math.max(0, Math.floor(Number(d.stock))) : 0;
  let category = cleanString(d.category, 40).toLowerCase();
  if (!ALLOWED_CATEGORIES.includes(category)) category = 'general';

  let stockStatus = cleanString(d.stockStatus, 20).toLowerCase();
  if (!['available', 'low', 'sold_out', 'pre_order'].includes(stockStatus)) {
    stockStatus = stock > 0 ? 'available' : 'sold_out';
  }

  return {
    name: cleanString(d.name, 140),
    shortTitle: cleanString(d.shortTitle, 80),
    category,
    categoryLabel: cleanString(d.categoryLabel, 80),
    desc: cleanString(d.desc, 2000),
    conditionDesc: cleanString(d.conditionDesc, 1000),
    price: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : 0,
    wholesalePrice: Number.isFinite(wholesale) && wholesale > 0 ? Math.round(wholesale * 100) / 100 : null,
    stock,
    stockStatus,
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
    badge: cleanString(d.badge, 40),
    imageAltTexts: Array.isArray(d.imageAltTexts) ? d.imageAltTexts.map((t) => cleanString(t, 120)).filter(Boolean).slice(0, 10) : [],
    questions: Array.isArray(d.questions)
      ? d.questions.slice(0, 5).map((q, i) => ({
        id: cleanString(q.id, 40) || 'q' + i,
        field: cleanString(q.field, 40),
        text: cleanString(q.text, 200)
      })).filter((q) => q.text)
      : [],
    confidence: Math.min(1, Math.max(0, Number(d.confidence) || 0.5)),
    detectedLang: cleanString(d.detectedLang, 10),
    summary: cleanString(d.summary, 300),
    assistantReply: cleanString(d.assistantReply, 200),
    commandApplied: cleanString(d.commandApplied, 200)
  };
}

function normalizeStockAction(raw) {
  const d = raw || {};
  return {
    action: cleanString(d.action, 40),
    productQuery: cleanString(d.productQuery, 140),
    productId: cleanString(d.productId, 120),
    stock: Number.isFinite(Number(d.stock)) ? Math.max(0, Math.floor(Number(d.stock))) : null,
    price: Number.isFinite(Number(d.price)) ? Math.round(Number(d.price) * 100) / 100 : null,
    stockStatus: cleanString(d.stockStatus, 20),
    note: cleanString(d.note, 300),
    questions: Array.isArray(d.questions) ? d.questions.slice(0, 3) : [],
    summary: cleanString(d.summary, 300)
  };
}

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const visionModel = process.env.OPENAI_VISION_MODEL || model;
  const whisperModel = process.env.OPENAI_WHISPER_MODEL || 'whisper-1';
  const ttsModel = process.env.OPENAI_TTS_MODEL || 'tts-1';
  const ttsVoice = process.env.OPENAI_TTS_VOICE || 'alloy';
  return { apiKey, base, model, visionModel, whisperModel, ttsModel, ttsVoice };
}

async function transcribeWhisper(body) {
  const { apiKey, base, whisperModel } = getOpenAIConfig();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const b64 = body.audioBase64;
  if (!b64) throw new Error('audioBase64 is required');
  if (b64.length > 8_000_000) throw new Error('Audio too large (max ~6MB)');

  const buffer = Buffer.from(b64, 'base64');
  const mime = cleanString(body.mimeType, 40) || 'audio/webm';
  const form = new FormData();
  const blob = new Blob([buffer], { type: mime });
  form.append('file', blob, 'recording.webm');
  form.append('model', whisperModel);
  const lang = cleanString(body.language, 5);
  if (lang) form.append('language', lang);

  const res = await fetch(base + '/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey },
    body: form
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Whisper transcription failed');
  return { text: cleanString(data.text, 4000), language: lang || 'ru' };
}

async function synthesizeSpeech(text) {
  const { apiKey, base, ttsModel, ttsVoice } = getOpenAIConfig();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const input = cleanString(text, 500);
  if (!input) throw new Error('text is required for TTS');

  const res = await fetch(base + '/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: ttsModel, voice: ttsVoice, input })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'TTS failed');
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { audioBase64: buf.toString('base64'), mimeType: 'audio/mpeg' };
}

async function callOpenAI(messages, model) {
  const { apiKey, base } = getOpenAIConfig();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Add it in Vercel → Environment Variables (see docs/CHATGPT_SETUP.md).');
  }
  const chosenModel = model || getOpenAIConfig().model;
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: chosenModel,
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

function buildListingMessages(body) {
  const text = cleanString(body.text, 4000);
  const context = body.context || {};
  const voiceLang = cleanString(body.voiceLang, 12);
  return [
    { role: 'system', content: SYSTEM_PROMPT + '\nJSON schema:\n' + RESPONSE_SCHEMA },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'parse_product_listing',
        adminText: text,
        voiceLang: voiceLang || 'unknown',
        instructions: [
          'adminText may be Russian/Ukrainian voice transcription with errors — correct it mentally first',
          'output only English in customer-facing fields',
          'extract price and quantity even if written in words (десять, ten kg, 10kg)',
          'if admin mentions wholesale price, set wholesalePrice'
        ],
        context: {
          existingProduct: context.existingProduct || null,
          imageCount: context.imageCount || 0,
          mode: context.mode || 'new'
        }
      })
    }
  ];
}

function buildImageMessages(body) {
  const hint = cleanString(body.text, 500);
  const imageUrl = cleanString(body.imageUrl, 2000);
  const imageBase64 = cleanString(body.imageBase64, 6_000_000);
  const imageMime = cleanString(body.imageMimeType, 30) || 'image/jpeg';
  const content = [
    {
      type: 'text',
      text: SYSTEM_PROMPT + '\nTask: scan product photo (Amazon label, box, item). Read visible brand/model/specs/condition. UK listing draft. Do not invent details. JSON schema:\n' + RESPONSE_SCHEMA +
        '\nAdmin hint: ' + (hint || 'Warehouse product scan for eBay UK.')
    }
  ];
  if (imageUrl && /^https:\/\//i.test(imageUrl)) {
    content.push({ type: 'image_url', image_url: { url: imageUrl, detail: 'high' } });
  } else if (imageBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: 'data:' + imageMime + ';base64,' + imageBase64, detail: 'high' }
    });
  }
  return [{ role: 'system', content: 'You return JSON only.' }, { role: 'user', content }];
}

function buildStockMessages(body) {
  const text = cleanString(body.text, 2000);
  return [
    {
      role: 'system',
      content: 'You are AYLENSALE stock admin assistant. Parse admin voice/text about inventory updates. Return JSON only: {"action":"update_stock|update_price|mark_sold_out|new_arrival|create_listing","productQuery":"string","productId":"string|null","stock":number|null,"price":number|null,"stockStatus":"available|low|sold_out","note":"string","questions":[{"id","field","text"}],"summary":"string"}'
    },
    { role: 'user', content: text }
  ];
}

function fallbackParse(text) {
  const priceMatch = text.match(/(?:£|фунт|pound|gbp|eur|€|\b)(\d+(?:[.,]\d{2})?)/i);
  const qtyMatch = text.match(/(\d+)\s*(?:шт|pcs|units|kg|кг|kilograms?|штук)/i);
  const price = priceMatch ? parseFloat(String(priceMatch[1]).replace(',', '.')) : 0;
  const isCyrillic = /[а-яіїєґ]/i.test(text);
  return normalizeDraft({
    name: isCyrillic ? 'Product listing (configure OPENAI_API_KEY)' : text.slice(0, 120),
    shortTitle: isCyrillic ? 'Listing draft' : text.slice(0, 60),
    category: /кабел|cable/i.test(text) ? 'cables' : /job|лот|микс|mix|палет/i.test(text) ? 'job-lots' : 'general',
    desc: isCyrillic
      ? 'AI translation is unavailable. Add OPENAI_API_KEY in Vercel, then try again. Your voice note was not translated to English.'
      : text.slice(0, 2000),
    conditionDesc: /не провер|untested|не тест|as is/i.test(text) ? 'Untested. Sold as seen.' : '',
    price,
    stock: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
    stockStatus: 'available',
    questions: [{ id: 'api', field: 'note', text: 'Configure OPENAI_API_KEY on Vercel for Russian→English listing drafts.' }],
    confidence: 0.15,
    detectedLang: isCyrillic ? 'ru' : 'en',
    summary: 'Fallback only — set OPENAI_API_KEY for translate + fix + English listing.'
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ error: 'Too many AI requests. Please wait a minute.' });
  }

  if (!(await isAdminRequest(req))) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  try {
    const action = cleanString(req.body?.action, 40) || 'parse_listing';
    const { model, visionModel, apiKey } = getOpenAIConfig();

    if (action === 'status') {
      const { whisperModel, ttsModel } = getOpenAIConfig();
      return res.status(200).json({
        success: true,
        configured: Boolean(apiKey),
        model,
        visionModel,
        whisperModel,
        ttsModel,
        provider: 'openai'
      });
    }

    if (action === 'transcribe') {
      if (!checkRateLimit(clientIP, 12)) {
        return res.status(429).json({ error: 'Too many voice requests. Wait a minute.' });
      }
      const result = await transcribeWhisper(req.body || {});
      return res.status(200).json({ success: true, ...result });
    }

    if (action === 'tts') {
      if (!checkRateLimit(clientIP, 15)) {
        return res.status(429).json({ error: 'Too many TTS requests.' });
      }
      const audio = await synthesizeSpeech(req.body?.text);
      return res.status(200).json({ success: true, ...audio });
    }

    if (action === 'test') {
      if (!apiKey) {
        return res.status(503).json({
          success: false,
          configured: false,
          error: 'OPENAI_API_KEY missing'
        });
      }
      const ping = await callOpenAI(
        [
          { role: 'system', content: 'Reply with JSON only.' },
          { role: 'user', content: '{"ok":true,"message":"connected"}' }
        ],
        model
      );
      return res.status(200).json({
        success: true,
        configured: true,
        model,
        ping: ping.ok === true || ping.message === 'connected'
      });
    }

    if (action === 'parse_listing') {
      const text = cleanString(req.body?.text, 4000);
      if (!text) return res.status(400).json({ error: 'text is required' });

      let draft;
      try {
        const parsed = await callOpenAI(buildListingMessages(req.body), model);
        draft = normalizeDraft(parsed.draft || parsed);
      } catch (aiError) {
        console.warn('AI parse fallback:', aiError.message);
        draft = fallbackParse(text);
        draft.aiWarning = aiError.message;
      }

      return res.status(200).json({ success: true, draft });
    }

    if (action === 'analyze_image') {
      const imageUrl = cleanString(req.body?.imageUrl, 2000);
      const imageBase64 = cleanString(req.body?.imageBase64, 6_000_000);
      if (!imageUrl && !imageBase64) {
        return res.status(400).json({ error: 'imageUrl or imageBase64 is required' });
      }
      if (!checkRateLimit(clientIP, 10)) {
        return res.status(429).json({ error: 'Too many image scans. Wait a minute.' });
      }

      let draft;
      try {
        const parsed = await callOpenAI(buildImageMessages(req.body), visionModel);
        draft = normalizeDraft(parsed.draft || parsed);
      } catch (aiError) {
        return res.status(502).json({ error: aiError.message });
      }
      return res.status(200).json({ success: true, draft });
    }

    if (action === 'stock_command') {
      const text = cleanString(req.body?.text, 2000);
      if (!text) return res.status(400).json({ error: 'text is required' });

      const parsed = await callOpenAI(buildStockMessages(req.body), model);
      const stockAction = normalizeStockAction(parsed);
      return res.status(200).json({ success: true, stockAction });
    }

    if (action === 'scan_and_publish') {
      if (!checkRateLimit(clientIP, 8)) {
        return res.status(429).json({ error: 'Too many scan requests. Wait a minute.' });
      }
      const rawImages = Array.isArray(req.body?.images) ? req.body.images : [];
      const singleB64 = cleanString(req.body?.imageBase64, 6_000_000);
      const images = rawImages.length
        ? rawImages.slice(0, 10).map((img) => ({
          base64: cleanString(img.base64, 6_000_000),
          mimeType: cleanString(img.mimeType, 30) || 'image/jpeg'
        })).filter((img) => img.base64)
        : (singleB64 ? [{ base64: singleB64, mimeType: cleanString(req.body?.imageMimeType, 30) || 'image/jpeg' }] : []);

      if (!images.length) {
        return res.status(400).json({ error: 'images[] or imageBase64 is required' });
      }

      const result = await runScanAndPublish({
        images,
        hint: cleanString(req.body?.hint || req.body?.text, 2000),
        policyId: cleanString(req.body?.policyId, 80),
        priceOverride: Number(req.body?.price) || null,
        publish: req.body?.publish !== false && req.body?.draft !== true
      });
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('ai-admin error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
