import { verifyFirebaseAdminToken } from '../lib/server/firebase-admin-app.mjs';
import { verifyAdminPassword } from '../lib/server/admin-password.mjs';

const notifyLimits = new Map();

function cleanString(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function escapeTelegram(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-client-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body || {};
}

function checkRateLimit(map, ip, maxAttempts, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const attempts = (map.get(ip) || []).filter((time) => time > cutoff);
  if (attempts.length >= maxAttempts) {
    map.set(ip, attempts);
    return false;
  }
  attempts.push(now);
  map.set(ip, attempts);
  return true;
}

async function authorizeAdmin(req, body) {
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    const decoded = await verifyFirebaseAdminToken(authHeader.slice(7).trim());
    if (decoded) return true;
  }
  return verifyAdminPassword(String(body.adminPassword || body.password || ''));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = parseBody(req);
    const clientIP = getClientIP(req);
    if (!checkRateLimit(notifyLimits, clientIP, 10, 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please wait and try again.' });
    }

    if (!(await authorizeAdmin(req, body))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { method, contact, productName } = body;
    const safeMethod = cleanString(method, 30).toLowerCase();
    const safeContact = cleanString(contact, 200);
    const safeProductName = cleanString(productName || 'Product', 140);

    if (safeMethod !== 'telegram') {
      return res.status(400).json({ error: 'Only Telegram auto-send is configured on this endpoint.' });
    }

    if (!safeContact) {
      return res.status(400).json({ error: 'Missing Telegram contact.' });
    }

    if (safeContact.charAt(0) === '@') {
      return res.status(400).json({
        error: 'Telegram Bot API cannot reliably send a private DM to @username. Ask the user to message the bot first and provide chat_id, or use the manual t.me link in admin panel.'
      });
    }

    const chatId = safeContact.replace(/\s/g, '');
    if (!/^-?\d{6,}$/.test(chatId)) {
      return res.status(400).json({ error: 'Telegram contact must be a numeric chat_id for automatic sending.' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN is not configured.' });
    }

    const text = '✅ <b>Back in stock - AYLENSALE</b>\n\n' +
      `<b>${escapeTelegram(safeProductName)}</b> is available again.\n` +
      'Open https://aylensale.com/ to order.';

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();
    if (!data.ok) {
      return res.status(500).json({ error: data.description || 'Telegram send failed' });
    }

    return res.status(200).json({ success: true, messageId: data.result.message_id });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
