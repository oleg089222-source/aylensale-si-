/**
 * Telegram → warehouse photo ingest → runScanAndPublish → reply in chat.
 * Admin sends photo(s) + short RU/EN caption; bot publishes to aylensale.com.
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import { runScanAndPublish } from './auto-listing-pipeline.mjs';
import { downloadTelegramFile, sendTelegramChatMessage } from './telegram-bot-api.mjs';

const BATCH_COLLECTION = 'telegramListingBatches';
const DEBOUNCE_MS = 2800;
const MAX_PHOTOS = 10;

function siteUrl() {
  return String(process.env.SITE_URL || 'https://aylensale.com').replace(/\/$/, '');
}

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function cleanString(value, max) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

export function listingAdminUserIds() {
  const raw = String(
    process.env.TELEGRAM_LISTING_ADMIN_IDS ||
    process.env.TELEGRAM_ADMIN_USER_IDS ||
    ''
  ).trim();
  const ids = raw.split(/[,\s;]+/).map(function(s) { return s.trim(); }).filter(Boolean);
  const fallbackChat = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  if (fallbackChat && ids.indexOf(fallbackChat) === -1) ids.push(fallbackChat);
  return ids;
}

export function isListingAdmin(userId, chatId) {
  const allowed = listingAdminUserIds();
  if (!allowed.length) return false;
  const uid = String(userId || '');
  const cid = String(chatId || '');
  return allowed.indexOf(uid) !== -1 || allowed.indexOf(cid) !== -1;
}

function batchDocId(message) {
  if (message.media_group_id) {
    return 'mg_' + String(message.media_group_id);
  }
  return 'msg_' + String(message.chat?.id || '0') + '_' + String(message.message_id || Date.now());
}

function largestPhoto(message) {
  const photos = Array.isArray(message.photo) ? message.photo : [];
  if (!photos.length) return null;
  return photos[photos.length - 1];
}

function parsePublishOptions(hint) {
  const text = cleanString(hint, 2000).toLowerCase();
  const draft = /черновик|draft|не публик|не публику/i.test(text);
  const forceAuction = /аукцион|auction|ставк|bid/i.test(text);
  const forceProduct = !forceAuction && (
    /фикс|fixed|car boot|carboot|опт|wholesale|коробк|box|100\s*шт|50\s*шт/i.test(text) ||
    !/палет|pallet|manifest/i.test(text)
  );
  return {
    publish: !draft,
    forceAuction,
    forceProduct: forceProduct || (!forceAuction && !/палет|pallet/i.test(text)),
    skipManifest: !/палет|pallet|manifest|манифест/i.test(text)
  };
}

function priceOverrideFromHint(hint) {
  const text = cleanString(hint, 2000);
  const patterns = [
    /(?:опт|wholesale|цена|price|£)\s*(\d+(?:[.,]\d{1,2})?)/i,
    /(\d+(?:[.,]\d{1,2})?)\s*(?:фунт|pounds?|gbp|£)/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = text.match(patterns[i]);
    if (m) {
      const n = Number(String(m[1]).replace(',', '.'));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

async function getBatchRef(batchId) {
  const db = getFirestoreAdmin();
  return db.collection(BATCH_COLLECTION).doc(batchId);
}

async function appendPhotoToBatch(batchId, payload) {
  const ref = await getBatchRef(batchId);
  const now = Date.now();

  await getFirestoreAdmin().runTransaction(async function(tx) {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() : {};
    const photos = Array.isArray(prev.photos) ? prev.photos.slice() : [];
    if (photos.length >= MAX_PHOTOS) return;
    photos.push({
      fileId: payload.fileId,
      messageId: payload.messageId,
      addedAt: now
    });
    const caption = payload.caption || prev.caption || '';
    tx.set(ref, {
      batchId,
      chatId: String(payload.chatId),
      userId: String(payload.userId),
      caption: cleanString(caption, 2000),
      photos,
      version: Number(prev.version || 0) + 1,
      lastAt: now,
      processing: false,
      createdAt: prev.createdAt || now
    }, { merge: true });
  });
}

async function readBatch(batchId) {
  const ref = await getBatchRef(batchId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function markBatchProcessing(batchId) {
  const ref = await getBatchRef(batchId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const data = snap.data();
  if (data.processing) return false;
  await ref.set({ processing: true, processingAt: Date.now() }, { merge: true });
  return true;
}

async function deleteBatch(batchId) {
  const ref = await getBatchRef(batchId);
  await ref.delete().catch(function() {});
}

async function downloadBatchImages(photos) {
  const images = [];
  for (let i = 0; i < photos.length && images.length < MAX_PHOTOS; i++) {
    const fileId = photos[i].fileId;
    if (!fileId) continue;
    const file = await downloadTelegramFile(fileId);
    images.push({
      base64: file.buffer.toString('base64'),
      mimeType: file.mimeType
    });
  }
  return images;
}

function formatSuccessReply(result) {
  const base = siteUrl();
  if (result.listingType === 'auction' && result.auction) {
    return '✅ Аукцион создан\n' +
      result.auction.name + '\n' +
      'Старт: £' + Number(result.auction.startingPrice || 0).toFixed(2) + '\n' +
      'Grade: ' + (result.grade || '—') + '\n' +
      base + '/#auctions';
  }
  if (result.product) {
    const lines = [
      '✅ Листинг опубликован на aylensale.com',
      result.product.name,
      'Цена: £' + Number(result.product.price || 0).toFixed(2),
      'Опт: £' + Number(result.draft?.wholesalePrice || result.product.price * 0.7 || 0).toFixed(2),
      'Grade: ' + (result.grade || '—'),
      'SKU: ' + (result.product.sku || '—'),
      base + '/product.html?id=' + encodeURIComponent(result.productId)
    ];
    if (result.product.manifestLines) {
      lines.push('Manifest: ' + result.product.manifestLines + ' lines');
    }
    return lines.join('\n');
  }
  return '✅ Готово';
}

export async function processListingBatch(batchId) {
  const batch = await readBatch(batchId);
  if (!batch || !batch.photos?.length) return { skipped: true, reason: 'empty_batch' };

  const quietFor = Date.now() - Number(batch.lastAt || 0);
  if (quietFor < 2500) {
    return { skipped: true, reason: 'still_receiving' };
  }

  const locked = await markBatchProcessing(batchId);
  if (!locked) return { skipped: true, reason: 'already_processing' };

  const chatId = batch.chatId;
  try {
    await sendTelegramChatMessage(chatId, '⏳ Обрабатываю фото… AI создаёт листинг для aylensale.com');

    const images = await downloadBatchImages(batch.photos);
    if (!images.length) throw new Error('Could not download photos from Telegram');

    const hint = batch.caption || '';
    const opts = parsePublishOptions(hint);
    const priceOverride = priceOverrideFromHint(hint);

    const result = await runScanAndPublish({
      images,
      hint,
      publish: opts.publish,
      forceAuction: opts.forceAuction,
      forceProduct: opts.forceProduct,
      skipManifest: opts.skipManifest,
      priceOverride,
      mirrorVip: true
    });

    const reply = opts.publish
      ? formatSuccessReply(result)
      : ('📝 Черновик готов (не опубликован)\n' + (result.draft?.name || result.product?.name || ''));

    await sendTelegramChatMessage(chatId, reply);
    await deleteBatch(batchId);
    return { ok: true, result };
  } catch (err) {
    console.error('[telegram-listing]', err.message || err);
    await sendTelegramChatMessage(
      chatId,
      '❌ Ошибка: ' + cleanString(err.message || 'publish failed', 500) +
      '\n\nПопробуй: фото + подпись «кабели 100 шт grade A опт 35»'
    ).catch(function() {});
    await deleteBatch(batchId);
    return { ok: false, error: err.message || 'failed' };
  }
}

export async function waitAndProcessBatch(batchId) {
  await sleep(DEBOUNCE_MS);
  return processListingBatch(batchId);
}

export async function scheduleBatchProcessing(batchId) {
  return waitAndProcessBatch(batchId);
}

export async function handleTelegramListingMessage(message) {
  if (!message || !message.chat) return { handled: false };

  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = cleanString(message.text || message.caption || '', 2000);

  if (!isListingAdmin(userId, chatId)) {
    if (text && /^\/(start|help)/i.test(text)) {
      await sendTelegramChatMessage(chatId,
        'AYLENSALE listing bot\n\nЭтот бот только для админов склада.\n' +
        'Добавь свой Telegram user ID в TELEGRAM_LISTING_ADMIN_IDS на Vercel.'
      );
    }
    return { handled: false, reason: 'not_admin' };
  }

  if (text && /^\/help/i.test(text)) {
    await sendTelegramChatMessage(chatId,
      '📦 AYLENSALE — листинг из Telegram\n\n' +
      '1. Отправь фото коробки (можно альбом до 10 фото)\n' +
      '2. В подписи к первому фото — коротко по-русски:\n' +
      '   кабели 100 шт grade A опт 35\n' +
      '   зарядки 50 шт grade B untested опт 55\n' +
      '   Amazon returns electronics 30 шт опт 55\n\n' +
      'Бот сам: скачает фото → AI → загрузит на сайт → ответит ссылкой.\n\n' +
      'Команды в подписи:\n' +
      '• черновик — не публиковать\n' +
      '• аукцион — создать аукцион (палета)\n' +
      '• палета / manifest — полный manifest\n\n' +
      'Примеры: data/ai-assistant-prompts-ru.txt'
    );
    return { handled: true, type: 'help' };
  }

  const photo = largestPhoto(message);
  if (!photo?.file_id) {
    if (text && text.length >= 3) {
      await sendTelegramChatMessage(chatId,
        'Отправь фото с подписью в одном сообщении.\nПример: «кабели 100 шт grade A опт 35»'
      );
      return { handled: true, type: 'text_only' };
    }
    return { handled: false };
  }

  const batchId = batchDocId(message);
  await appendPhotoToBatch(batchId, {
    fileId: photo.file_id,
    messageId: message.message_id,
    chatId,
    userId,
    caption: text
  });

  const processResult = await waitAndProcessBatch(batchId);

  return { handled: true, type: 'photo', batchId, processResult };
}
