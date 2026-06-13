/**
 * Low-level Telegram Bot API helpers (send + download files).
 */

function botToken() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  return token;
}

function apiUrl(method) {
  return 'https://api.telegram.org/bot' + botToken() + '/' + method;
}

export async function sendTelegramChatMessage(chatId, text, options) {
  const opts = options || {};
  const body = {
    chat_id: chatId,
    text: String(text || '').slice(0, 4000),
    disable_web_page_preview: opts.disablePreview !== false
  };
  if (opts.parseMode) body.parse_mode = opts.parseMode;

  const res = await fetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(function() { return {}; });
  if (!res.ok || !data.ok) {
    throw new Error(data.description || ('Telegram sendMessage failed (' + res.status + ')'));
  }
  return data.result;
}

export async function getTelegramFile(fileId) {
  const res = await fetch(apiUrl('getFile'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId })
  });
  const data = await res.json().catch(function() { return {}; });
  if (!res.ok || !data.ok || !data.result?.file_path) {
    throw new Error(data.description || 'Telegram getFile failed');
  }
  return data.result;
}

export async function downloadTelegramFile(fileId) {
  const meta = await getTelegramFile(fileId);
  const url = 'https://api.telegram.org/file/bot' + botToken() + '/' + meta.file_path;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Telegram file download failed (' + res.status + ')');
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = guessMimeFromPath(meta.file_path);
  return { buffer, mimeType, filePath: meta.file_path };
}

function guessMimeFromPath(filePath) {
  const p = String(filePath || '').toLowerCase();
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.webp')) return 'image/webp';
  if (p.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

export async function setTelegramWebhook(webhookUrl, secretToken) {
  const body = {
    url: webhookUrl,
    allowed_updates: ['message'],
    drop_pending_updates: false
  };
  if (secretToken) body.secret_token = secretToken;

  const res = await fetch(apiUrl('setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(function() { return {}; });
  if (!res.ok || !data.ok) {
    throw new Error(data.description || 'setWebhook failed');
  }
  return data;
}

export async function getTelegramWebhookInfo() {
  const res = await fetch(apiUrl('getWebhookInfo'));
  const data = await res.json().catch(function() { return {}; });
  if (!res.ok || !data.ok) throw new Error(data.description || 'getWebhookInfo failed');
  return data.result;
}
