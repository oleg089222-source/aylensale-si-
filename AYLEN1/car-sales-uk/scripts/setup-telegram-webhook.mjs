#!/usr/bin/env node
/**
 * Register Telegram webhook for warehouse listing bot.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
 *   node scripts/setup-telegram-webhook.mjs
 *
 * Optional: SITE_URL=https://aylensale.com
 */
import { setTelegramWebhook, getTelegramWebhookInfo } from '../lib/server/telegram-bot-api.mjs';

const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
const site = String(process.env.SITE_URL || 'https://aylensale.com').replace(/\/$/, '');

if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN');
  process.exit(1);
}
if (!secret) {
  console.error('Set TELEGRAM_WEBHOOK_SECRET (random string, e.g. openssl rand -hex 24)');
  process.exit(1);
}

const webhookUrl = site + '/api/telegram-webhook?secret=' + encodeURIComponent(secret);

async function main() {
  console.log('Setting webhook:', webhookUrl);
  const result = await setTelegramWebhook(webhookUrl, secret);
  console.log('setWebhook:', JSON.stringify(result, null, 2));
  const info = await getTelegramWebhookInfo();
  console.log('\nWebhook info:');
  console.log('  url:', info.url);
  console.log('  pending_update_count:', info.pending_update_count);
  console.log('  last_error_message:', info.last_error_message || '—');
  console.log('\nAdd to Vercel env:');
  console.log('  TELEGRAM_LISTING_ADMIN_IDS=<your Telegram user id>');
  console.log('Get user id: message @userinfobot in Telegram');
}

main().catch(function(e) {
  console.error(e.message || e);
  process.exit(1);
});
