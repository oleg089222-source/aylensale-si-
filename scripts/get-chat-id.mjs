#!/usr/bin/env node
/**
 * Получить TELEGRAM_CHAT_ID после /start в @aylensale_bot
 * Usage: node scripts/get-chat-id.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
let token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  try {
    const raw = readFileSync(envPath, "utf8");
    const m = raw.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
    if (m) token = m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* ignore */
  }
}

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN не найден в .env.local");
  process.exit(1);
}

const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json());
console.log("Bot:", me.result?.username ?? me);

const updates = await fetch(`https://api.telegram.org/bot${token}/getUpdates`).then((r) => r.json());
if (!updates.result?.length) {
  console.log("\nНет сообщений. Откройте @aylensale_bot и нажмите /start, затем снова запустите скрипт.");
  process.exit(0);
}

const seen = new Set();
for (const u of updates.result) {
  const m = u.message || u.channel_post;
  const c = m?.chat;
  if (!c?.id || seen.has(c.id)) continue;
  seen.add(c.id);
  const label = c.username || c.first_name || c.title || c.type;
  console.log(`\nTELEGRAM_CHAT_ID=${c.id}  # ${label}`);
}
console.log("\nСкопируйте TELEGRAM_CHAT_ID в .env.local и выполните: npm run vercel:env");
