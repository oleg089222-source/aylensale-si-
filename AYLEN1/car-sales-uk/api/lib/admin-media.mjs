/**
 * Admin media upload to Firebase Storage (server-side — bypasses client Storage rules).
 */
import crypto from 'crypto';
import sharp from 'sharp';
import { getStorageBucket } from './firebase-admin-app.mjs';

const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 85;

function publicDownloadUrl(bucketName, filePath, token) {
  const encoded = filePath.split('/').map(encodeURIComponent).join('%2F');
  let url = 'https://firebasestorage.googleapis.com/v0/b/' + bucketName + '/o/' + encoded + '?alt=media';
  if (token) url += '&token=' + token;
  return url;
}

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || '').trim();
  const m = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (m) {
    return {
      contentType: m[1] || 'image/jpeg',
      buffer: Buffer.from(m[2], 'base64')
    };
  }
  return {
    contentType: 'image/jpeg',
    buffer: Buffer.from(raw, 'base64')
  };
}

function safeExt(contentType, fileName) {
  const fromName = fileName && fileName.indexOf('.') !== -1
    ? String(fileName.split('.').pop() || '').toLowerCase().slice(0, 8)
    : '';
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (String(contentType || '').indexOf('video/') === 0) return 'mp4';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'jpg';
}

async function optimizeImageBuffer(buffer, contentType) {
  if (!buffer || !buffer.length) return { buffer, contentType };
  if (String(contentType || '').indexOf('video/') === 0) {
    return { buffer, contentType };
  }
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) return { buffer, contentType };
    const pipeline = sharp(buffer).rotate();
    if (meta.width > MAX_IMAGE_EDGE || meta.height > MAX_IMAGE_EDGE) {
      pipeline.resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: 'inside', withoutEnlargement: true });
    }
    const out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    return { buffer: out, contentType: 'image/jpeg' };
  } catch (err) {
    console.warn('admin-media optimize skipped:', err.message || err);
    return { buffer, contentType };
  }
}

export async function uploadAdminMediaBuffer(options) {
  const entityId = String(options.entityId || 'media').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'media';
  const folder = String(options.storageFolder || 'products').replace(/[^a-zA-Z0-9/_-]/g, '') || 'products';
  let contentType = String(options.contentType || 'image/jpeg');
  let buffer = options.buffer;
  if (!buffer || !buffer.length) {
    throw new Error('Empty upload payload');
  }
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('File too large (max 8MB for admin upload)');
  }

  const optimized = await optimizeImageBuffer(buffer, contentType);
  buffer = optimized.buffer;
  contentType = optimized.contentType;

  const bucket = getStorageBucket();
  const bucketName = bucket.name;
  const ext = safeExt(contentType, options.fileName);
  const token = crypto.randomUUID();
  const path = folder + '/' + entityId + '/media_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex') + '.' + ext;
  const file = bucket.file(path);

  await file.save(buffer, {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
      metadata: {
        firebaseStorageDownloadTokens: token
      }
    },
    resumable: false
  });

  return {
    success: true,
    url: publicDownloadUrl(bucketName, path, token),
    path
  };
}

export async function uploadAdminMediaFromDataUrl(body) {
  const parsed = parseDataUrl(body.dataUrl || body.base64 || '');
  if (!parsed.buffer.length) throw new Error('Invalid image data');
  const contentType = body.contentType || parsed.contentType;
  return uploadAdminMediaBuffer({
    buffer: parsed.buffer,
    contentType,
    entityId: body.entityId,
    storageFolder: body.storageFolder,
    fileName: body.fileName
  });
}
