/**
 * Customer loyalty API handlers (merged into /api/spam for Hobby plan limit).
 */
import { cleanString, guardPublicForm } from './spam-guard.mjs';
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import { isAdminConfigured } from './firestore-admin.mjs';
import { tierByIndex } from './loyalty-tiers.mjs';

function escapeTelegram(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cleanCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
}

export async function handleLoyaltyGet(req, res) {
  if (!isAdminConfigured()) {
    return res.status(503).json({ ok: false, error: 'Loyalty service unavailable' });
  }
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const mod = await import('./card-loyalty.mjs');
    const payload = await mod.getCardLoyaltySnapshot(req.query.code);
    if (!payload.ok) {
      return res.status(payload.error === 'Unknown discount code' ? 404 : 400).json(payload);
    }
    return res.status(200).json(payload);
  } catch (error) {
    console.error('loyalty GET failed:', error.message || error);
    return res.status(500).json({ ok: false, error: 'Failed to load loyalty data' });
  }
}

export async function handleLoyaltyPost(req, res) {
  if (!isAdminConfigured()) {
    return res.status(503).json({ ok: false, error: 'Service unavailable' });
  }

  const guard = await guardPublicForm(req, {
    scope: 'loyalty-upgrade',
    maxAttempts: 3,
    windowMs: 3600000,
    minimumMs: 800,
    rateMessage: 'Too many upgrade requests. Please wait and try again later.'
  });
  if (!guard.ok) {
    return res.status(guard.status).json({ error: guard.error });
  }

  try {
    const { code, note } = req.body || {};
    const safeCode = cleanCode(code);
    const safeNote = cleanString(note, 300);

    if (!safeCode) {
      return res.status(400).json({ error: 'Missing card code' });
    }

    const mod = await import('./card-loyalty.mjs');
    const snapshot = await mod.getCardLoyaltySnapshot(safeCode);
    if (!snapshot.ok) {
      return res.status(400).json({ error: snapshot.error || 'Invalid card' });
    }

    if (!snapshot.upgradeReady && !snapshot.pendingUpgrade) {
      return res.status(400).json({
        error: 'Your loyalty jar is not full yet. Keep shopping — we will notify you when you can upgrade.'
      });
    }

    const db = getFirestoreAdmin();
    const existing = await db.collection('loyaltyUpgradeRequests')
      .where('code', '==', safeCode)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(200).json({
        ok: true,
        alreadyPending: true,
        message: 'We already received your upgrade request. We will contact you soon.'
      });
    }

    const suggested = tierByIndex(snapshot.suggestedTier);
    const current = tierByIndex(snapshot.loyaltyTier);
    const ref = await db.collection('loyaltyUpgradeRequests').add({
      code: safeCode,
      name: snapshot.name,
      currentTier: snapshot.loyaltyTier,
      currentPercent: current.percent,
      suggestedTier: snapshot.suggestedTier,
      suggestedPercent: suggested.percent,
      orders: snapshot.orders,
      spend: snapshot.spend,
      note: safeNote,
      status: 'pending',
      source: 'loyalty_portal',
      createdAt: new Date().toISOString()
    });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (botToken && chatId) {
      let text = '🏅 <b>LOYALTY UPGRADE REQUEST</b>\n\n';
      text += `<b>Card:</b> ${escapeTelegram(safeCode)}\n`;
      text += `<b>Customer:</b> ${escapeTelegram(snapshot.name)}\n`;
      text += `<b>Current:</b> ${current.percent}% (${escapeTelegram(current.label)})\n`;
      text += `<b>Eligible for:</b> ${suggested.percent}% (${escapeTelegram(suggested.label)})\n`;
      text += `<b>Orders:</b> ${snapshot.orders} · <b>Spend:</b> £${Number(snapshot.spend).toFixed(2)}\n`;
      if (safeNote) text += `<b>Note:</b> ${escapeTelegram(safeNote)}\n`;
      text += '\nConfirm in Admin → Discount Codes and print a new visit card.';

      await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
      }).catch(function(err) {
        console.warn('loyalty upgrade telegram skipped:', err.message);
      });
    }

    return res.status(200).json({
      ok: true,
      requestId: ref.id,
      message: 'Request sent! We will confirm your new discount and visit card soon.'
    });
  } catch (error) {
    console.error('loyalty POST failed:', error.message || error);
    return res.status(500).json({ error: 'Could not send request. Try again or message us on WhatsApp.' });
  }
}

export async function handleLoyalty(req, res) {
  if (req.method === 'GET') return handleLoyaltyGet(req, res);
  if (req.method === 'POST') return handleLoyaltyPost(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}
