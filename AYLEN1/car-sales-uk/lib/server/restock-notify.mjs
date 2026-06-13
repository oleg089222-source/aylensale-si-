/**
 * Server-side Notify Me processing when product stock returns from 0 to in-stock.
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import { sendEmailViaResend } from './vip-notify.mjs';
import { canonicalProductKey, resolveProductDocId } from './inventory-stock.mjs';

function escapeTelegram(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function restockMessage(productName) {
  return String(productName || 'Product') + ' is back in stock on AYLENSALE. Open https://aylensale.com/ to order.';
}

async function sendTelegramRestock(chatId, productName) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' };
  const id = String(chatId || '').replace(/\s/g, '');
  if (!/^-?\d{6,}$/.test(id)) {
    return { ok: false, error: 'Telegram contact must be a numeric chat_id' };
  }
  const text = '✅ <b>Back in stock - AYLENSALE</b>\n\n' +
    '<b>' + escapeTelegram(productName) + '</b> is available again.\n' +
    'Open https://aylensale.com/ to order.';
  const response = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: id, text, parse_mode: 'HTML' })
  });
  const data = await response.json();
  if (!data.ok) return { ok: false, error: data.description || 'Telegram send failed' };
  return { ok: true, messageId: data.result?.message_id || null };
}

async function sendEmailRestock(email, productName) {
  const safeName = String(productName || 'Product').replace(/</g, '&lt;');
  const html = '<p>Good news — <b>' + safeName + '</b> is back in stock on AYLENSALE.</p>' +
    '<p><a href="https://aylensale.com/">Open the shop</a> to order while stock lasts.</p>' +
    '<p>AYLENSALE</p>';
  const ok = await sendEmailViaResend(email, 'Back in stock — ' + productName, html);
  if (ok) return { ok: true };

  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && chatId) {
    const text = '📧 <b>Notify Me (email fallback)</b>\nCustomer: ' + escapeTelegram(email) +
      '\nProduct: <b>' + escapeTelegram(productName) + '</b>\n' + escapeTelegram(restockMessage(productName));
    const response = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    const data = await response.json();
    if (data.ok) {
      return { ok: true, provider: 'telegram_admin_fallback', messageId: data.result?.message_id || null };
    }
  }
  return { ok: false, error: 'RESEND_API_KEY is not configured or email send failed' };
}

function productIdVariants(productId) {
  const raw = String(productId || '').trim();
  const variants = new Set();
  if (raw) variants.add(raw);
  const resolved = resolveProductDocId(raw);
  if (resolved) variants.add(resolved);
  const key = canonicalProductKey(raw);
  if (key) variants.add(key);
  if (key) variants.add('prod_' + key);
  return [...variants];
}

async function loadPendingNotifyRequests(db, productId) {
  const variants = productIdVariants(productId);
  const seen = new Set();
  const rows = [];
  for (const pid of variants) {
    const snap = await db.collection('notifyRequests')
      .where('productId', '==', pid)
      .where('notified', '==', false)
      .limit(50)
      .get();
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      const data = doc.data() || {};
      if (String(data.status || 'waiting') !== 'waiting') continue;
      rows.push({ id: doc.id, ref: doc.ref, ...data });
    }
  }
  return rows;
}

async function processSingleRequest(db, req, productName) {
  const method = String(req.method || '').toLowerCase();
  const contact = String(req.contact || '').trim();
  const message = restockMessage(productName);
  const now = new Date().toISOString();

  if (method === 'telegram') {
    if (contact.charAt(0) === '@') {
      await req.ref.update({
        status: 'manual_telegram',
        adminActionUrl: 'https://t.me/' + contact.replace(/^@/, ''),
        adminMessage: message,
        error: 'Telegram @username requires manual DM',
        lastTriedAt: now
      });
      return 'manual';
    }
    const sent = await sendTelegramRestock(contact, productName);
    if (!sent.ok) {
      await req.ref.update({
        status: 'failed',
        error: sent.error || 'Telegram send failed',
        lastTriedAt: now
      });
      return 'failed';
    }
    await req.ref.update({
      notified: true,
      status: 'sent',
      notifiedAt: now,
      provider: 'telegram',
      providerMessageId: sent.messageId || null,
      error: ''
    });
    return 'sent';
  }

  if (method === 'email') {
    const sent = await sendEmailRestock(contact, productName);
    if (!sent.ok) {
      await req.ref.update({
        status: 'failed',
        error: sent.error || 'Email send failed',
        lastTriedAt: now
      });
      return 'failed';
    }
    await req.ref.update({
      notified: true,
      status: 'sent',
      notifiedAt: now,
      provider: sent.provider || 'resend',
      providerMessageId: sent.messageId || null,
      error: ''
    });
    return 'sent';
  }

  if (method === 'whatsapp') {
    const digits = contact.replace(/\D/g, '');
    const waUrl = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(message);
    await req.ref.update({
      notified: true,
      status: 'sent',
      notifiedAt: now,
      provider: 'whatsapp_link',
      adminActionUrl: waUrl,
      adminMessage: message,
      error: ''
    });
    return 'sent';
  }

  await req.ref.update({ status: 'failed', error: 'Unknown notify method', lastTriedAt: now });
  return 'failed';
}

export async function processRestockNotifications(opts) {
  const previousStock = Number(opts?.previousStock ?? 0);
  const newStock = Number(opts?.newStock ?? 0);
  const productId = String(opts?.productId || '').trim();
  const productName = String(opts?.productName || 'Product').trim();

  if (!productId) return { skipped: true, reason: 'missing_product_id' };
  if (previousStock > 0 || newStock <= 0) {
    return { skipped: true, reason: 'not_restock_transition', previousStock, newStock };
  }

  const db = getFirestoreAdmin();
  const pending = await loadPendingNotifyRequests(db, productId);
  if (!pending.length) {
    return { skipped: true, reason: 'no_pending_requests', previousStock, newStock };
  }

  let sent = 0;
  let manual = 0;
  let failed = 0;
  for (const req of pending) {
    try {
      const result = await processSingleRequest(db, req, productName);
      if (result === 'sent') sent++;
      else if (result === 'manual') manual++;
      else failed++;
    } catch (err) {
      failed++;
      await req.ref.update({
        status: 'failed',
        error: err.message || String(err),
        lastTriedAt: new Date().toISOString()
      });
    }
  }

  return { sent, manual, failed, total: pending.length, previousStock, newStock, productId };
}
