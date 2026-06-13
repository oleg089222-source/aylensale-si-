/**
 * Bulk-optimize Firebase Storage images (resize + compress).
 * Shared by local CLI script and /api/storage-resize serverless handler.
 */
import sharp from 'sharp';
import { getStorageBucket } from './firebase-admin-app.mjs';

export const PREFIXES = ['products/', 'auctions/', 'vip/', 'branding/'];
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const MIN_BYTES = 300 * 1024;
const MAX_EDGE = 1600;
const JPEG_QUALITY = 85;
const MIN_SAVINGS_RATIO = 0.12;

export function fmtBytes(n) {
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
  if (n >= 1024) return Math.round(n / 1024) + ' KB';
  return n + ' B';
}

function extOf(name) {
  const m = String(name || '').match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : 'jpg';
}

export async function optimizeBuffer(buf, contentType, fileName) {
  const meta = await sharp(buf).metadata();
  const ext = extOf(fileName);
  const needsResize = (meta.width || 0) > MAX_EDGE || (meta.height || 0) > MAX_EDGE;
  let pipeline = sharp(buf).rotate();
  if (needsResize) {
    pipeline = pipeline.resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true });
  }
  let out;
  let mime = contentType || 'image/jpeg';
  if (ext === 'png' || /png/i.test(contentType || '')) {
    out = await pipeline.png({ compressionLevel: 9, quality: 85 }).toBuffer();
    mime = 'image/png';
  } else if (ext === 'webp' || /webp/i.test(contentType || '')) {
    out = await pipeline.webp({ quality: 82 }).toBuffer();
    mime = 'image/webp';
  } else {
    out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    mime = 'image/jpeg';
  }
  return {
    buffer: out,
    contentType: mime,
    before: buf.length,
    after: out.length,
    width: meta.width,
    height: meta.height,
    resized: needsResize
  };
}

export async function listImageFiles(bucket) {
  const files = [];
  for (const prefix of PREFIXES) {
    let pageToken;
    do {
      const [batch, , resp] = await bucket.getFiles({
        prefix,
        maxResults: 500,
        pageToken
      });
      for (const file of batch) {
        if (!IMAGE_RE.test(file.name)) continue;
        files.push(file);
      }
      pageToken = resp && resp.nextPageToken;
    } while (pageToken);
  }
  return files;
}

async function processFile(file, apply) {
  const [meta] = await file.getMetadata();
  const size = Number(meta.size || 0);
  if (size < MIN_BYTES) {
    return { skipped: true, reason: 'small', name: file.name, size };
  }
  const [buf] = await file.download();
  const result = await optimizeBuffer(buf, meta.contentType, file.name);
  const savings = 1 - result.after / result.before;
  if (result.after >= result.before && !result.resized) {
    return { skipped: true, reason: 'no-gain', name: file.name, size, after: result.after };
  }
  if (savings < MIN_SAVINGS_RATIO && !result.resized) {
    return { skipped: true, reason: 'low-savings', name: file.name, size, after: result.after };
  }
  if (!apply) {
    return {
      planned: true,
      name: file.name,
      before: result.before,
      after: result.after,
      width: result.width,
      height: result.height,
      resized: result.resized
    };
  }

  const token = meta.metadata && meta.metadata.firebaseStorageDownloadTokens
    ? String(meta.metadata.firebaseStorageDownloadTokens)
    : '';
  const customMeta = token ? { firebaseStorageDownloadTokens: token } : {};

  await file.save(result.buffer, {
    metadata: {
      contentType: result.contentType,
      cacheControl: meta.cacheControl || 'public, max-age=31536000',
      metadata: Object.assign({}, meta.metadata || {}, customMeta)
    },
    resumable: false
  });

  return {
    applied: true,
    name: file.name,
    before: result.before,
    after: result.after,
    width: result.width,
    height: result.height,
    resized: result.resized
  };
}

/**
 * @param {{ apply?: boolean, limit?: number, onProgress?: (row: object) => void }} opts
 */
export async function runStorageBulkResize(opts) {
  const apply = !!opts.apply;
  const limit = Math.max(0, Number(opts.limit) || 0);
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;

  const bucket = getStorageBucket();
  const files = await listImageFiles(bucket);
  files.sort((a, b) => Number(b.metadata?.size || 0) - Number(a.metadata?.size || 0));

  let processed = 0;
  let actionable = 0;
  let planned = 0;
  let applied = 0;
  let skipped = 0;
  let savedBytes = 0;
  const rows = [];

  for (const file of files) {
    if (limit && actionable >= limit) break;
    processed++;
    try {
      const row = await processFile(file, apply);
      if (row.skipped) {
        skipped++;
        if (onProgress) onProgress({ type: 'skip', row });
        continue;
      }
      actionable++;
      if (row.planned) {
        planned++;
        savedBytes += row.before - row.after;
        rows.push(row);
        if (onProgress) onProgress({ type: 'plan', row });
      }
      if (row.applied) {
        applied++;
        savedBytes += row.before - row.after;
        rows.push(row);
        if (onProgress) onProgress({ type: 'apply', row });
      }
    } catch (err) {
      const fail = { name: file.name, error: err.message || String(err) };
      rows.push(fail);
      if (onProgress) onProgress({ type: 'fail', row: fail });
    }
  }

  return {
    ok: true,
    mode: apply ? 'apply' : 'dry-run',
    bucket: bucket.name,
    scanned: files.length,
    processed,
    planned: apply ? applied : planned,
    skipped,
    savedBytes: Math.max(0, savedBytes),
    saved: fmtBytes(Math.max(0, savedBytes)),
    rows
  };
}
