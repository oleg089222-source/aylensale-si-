/**
 * Auction engine API — admin dashboard, bot tick, profiles (merged into /api/spam).
 */
import { cleanString } from './spam-guard.mjs';
import { getFirestoreAdmin, verifyFirebaseAdminToken } from './firebase-admin-app.mjs';
import { isAdminConfigured } from './firestore-admin.mjs';
import {
  getAdminAuctionDashboard,
  getAuctionDetail,
  getAuctionSettings,
  getBidderProfile,
  phoneKey,
  runAuctionTick,
  runAuctionFinalizeTick,
  saveAuctionSettings,
  updateAuctionBotSettings,
  upsertBidderProfile
} from './auction-engine.mjs';

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body || {};
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function requireAdmin(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return verifyFirebaseAdminToken(token);
}

function cronAuthorized(req) {
  if (String(req.headers['x-vercel-cron'] || '') === '1') return true;

  const secret = String(process.env.CRON_SECRET || process.env.AUCTION_CRON_SECRET || '').trim();
  if (!secret) return false;

  const q = req.query || {};
  const header = String(req.headers['x-cron-secret'] || req.headers['x-vercel-cron-secret'] || '');
  const auth = String(req.headers.authorization || '');
  if (q.secret === secret || header === secret) return true;
  if (auth === 'Bearer ' + secret) return true;
  return false;
}

export async function handleAuctionEngineGet(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAdminConfigured()) return res.status(503).json({ error: 'Auction engine unavailable' });

  const sub = String((req.query && req.query.sub) || 'dashboard').toLowerCase();

  try {
    const db = getFirestoreAdmin();

    if (sub === 'tick') {
      const isCron = cronAuthorized(req);
      if (!isCron) {
        const admin = await requireAdmin(req);
        if (!admin) return res.status(401).json({ error: 'Unauthorized' });
      }
      const result = isCron
        ? await runAuctionFinalizeTick(db)
        : await runAuctionTick(db);
      return res.status(200).json(result);
    }

    if (sub === 'settings') {
      const settings = await getAuctionSettings(db);
      return res.status(200).json({ ok: true, settings: settings });
    }

    if (sub === 'profile') {
      const phone = cleanString(req.query.phone, 30);
      const payload = await getBidderProfile(db, phone);
      return res.status(payload.ok ? 200 : 400).json(payload);
    }

    if (sub === 'detail') {
      const id = cleanString(req.query.id, 120);
      if (!id) return res.status(400).json({ error: 'Missing auction id' });
      const admin = await requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Admin auth required' });
      const detail = await getAuctionDetail(db, id);
      return res.status(detail.ok ? 200 : 404).json(detail);
    }

    if (sub === 'dashboard') {
      const admin = await requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Admin auth required' });
      const dash = await getAdminAuctionDashboard(db);
      return res.status(200).json(dash);
    }

    return res.status(400).json({ error: 'Unknown sub action: ' + sub });
  } catch (err) {
    console.error('[auction-engine GET]', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

export async function handleAuctionEnginePost(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAdminConfigured()) return res.status(503).json({ error: 'Auction engine unavailable' });

  const body = parseBody(req);
  const action = String(body.action || 'settings').toLowerCase();

  try {
    const db = getFirestoreAdmin();

    if (action === 'profile') {
      const phone = cleanString(body.phone, 30);
      const name = cleanString(body.name, 80);
      const event = body.event && typeof body.event === 'object' ? body.event : null;
      if (!phone || phone.replace(/\D/g, '').length < 8) {
        return res.status(400).json({ error: 'Valid phone required' });
      }
      const result = await upsertBidderProfile(db, phone, name, event);
      return res.status(200).json({ ok: true, key: result && result.key });
    }

    if (action === 'profile-prefs') {
      const phone = cleanString(body.phone, 30);
      const prefs = body.notifyPrefs || {};
      if (!phone) return res.status(400).json({ error: 'Phone required' });
      const key = phoneKey(phone);
      await db.collection('auctionProfiles').doc(key).set({
        notifyPrefs: {
          outbid: prefs.outbid !== false,
          endingSoon: prefs.endingSoon !== false,
          won: prefs.won !== false
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return res.status(200).json({ ok: true });
    }

    const admin = await requireAdmin(req);
    if (!admin) return res.status(401).json({ error: 'Admin auth required' });

    if (action === 'settings') {
      const patch = {};
      if (body.siteRevealed !== undefined) patch.siteRevealed = !!body.siteRevealed;
      if (body.botGlobalEnabled !== undefined) patch.botGlobalEnabled = !!body.botGlobalEnabled;
      if (body.defaultBotMaxTotal !== undefined) {
        patch.defaultBotMaxTotal = Math.max(0, Number(body.defaultBotMaxTotal) || 0);
      }
      if (body.autoRelistZeroBids !== undefined) patch.autoRelistZeroBids = !!body.autoRelistZeroBids;
      if (body.antiSnipeEnabled !== undefined) patch.antiSnipeEnabled = !!body.antiSnipeEnabled;
      if (body.autoRelistHours !== undefined) {
        patch.autoRelistHours = Math.max(1, Math.min(168, Number(body.autoRelistHours) || 24));
      }
      const settings = await saveAuctionSettings(db, patch);
      return res.status(200).json({ ok: true, settings: settings });
    }

    if (action === 'auction-bot') {
      const id = cleanString(body.auctionId, 120);
      if (!id) return res.status(400).json({ error: 'Missing auctionId' });
      const analysis = await updateAuctionBotSettings(db, id, {
        botEnabled: body.botEnabled,
        botPaused: body.botPaused,
        botMaxTotal: body.botMaxTotal
      });
      return res.status(200).json({ ok: true, analysis: analysis });
    }

    if (action === 'tick') {
      const result = await runAuctionTick(db);
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });
  } catch (err) {
    console.error('[auction-engine POST]', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
