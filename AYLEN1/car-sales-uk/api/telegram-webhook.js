/**
 * Telegram webhook — photo + caption → auto listing on aylensale.com
 *
 * POST /api/telegram-webhook?secret=YOUR_SECRET
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_LISTING_ADMIN_IDS,
 *      OPENAI_API_KEY, FIREBASE_SERVICE_ACCOUNT
 */
import { handleTelegramListingMessage } from '../lib/server/telegram-listing-ingest.mjs';

export const config = {
  maxDuration: 60
};

function cleanSecret(value) {
  return String(value || '').trim();
}

function verifyWebhookSecret(req) {
  const expected = cleanSecret(process.env.TELEGRAM_WEBHOOK_SECRET);
  if (!expected) return false;
  const header = cleanSecret(req.headers['x-telegram-bot-api-secret-token']);
  if (header && header === expected) return true;
  const query = cleanSecret(req.query?.secret);
  if (query && query === expected) return true;
  const url = String(req.url || '');
  const match = url.match(/[?&]secret=([^&]+)/);
  if (match && decodeURIComponent(match[1]) === expected) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyWebhookSecret(req)) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  try {
    const update = req.body || {};
    const message = update.message;
    if (!message) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const outcome = await handleTelegramListingMessage(message);
    return res.status(200).json({ ok: true, outcome });
  } catch (error) {
    console.error('[telegram-webhook]', error.message || error);
    return res.status(200).json({ ok: true, error: error.message || 'handler_error' });
  }
}
