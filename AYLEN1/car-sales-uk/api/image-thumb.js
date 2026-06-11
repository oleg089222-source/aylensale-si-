/**
 * GET /api/image-thumb?url=...&w=320&h=220
 * Resize remote product/auction photos (Firebase Storage originals) for mobile grid.
 */
import sharp from 'sharp';

const ALLOWED_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com'
]);

const MAX_INPUT_BYTES = 14 * 1024 * 1024;
const MAX_DIM = 1200;
const MIN_DIM = 32;

function clampDim(value, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < MIN_DIM) return fallback;
  return Math.min(MAX_DIM, n);
}

function normalizeSourceUrl(raw) {
  const parsed = new URL(String(raw || ''));
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error('Host not allowed');
  }
  if (!/[?&]alt=media(?:&|$)/.test(parsed.href)) {
    parsed.search += (parsed.search ? '&' : '?') + 'alt=media';
  }
  return parsed.href;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const source = String(req.query.url || '');
  if (!source || source.length > 4096) {
    return res.status(400).json({ error: 'Invalid url' });
  }

  const width = clampDim(req.query.w, 320);
  const height = clampDim(req.query.h, 320);
  const quality = clampDim(req.query.q, 78);
  const fmtParam = String(req.query.fmt || '').toLowerCase();

  let fetchUrl;
  try {
    fetchUrl = normalizeSourceUrl(source);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid image url' });
  }

  try {
    const upstream = await fetch(fetchUrl, { redirect: 'follow' });
    if (!upstream.ok) {
      return res.status(upstream.status === 404 ? 404 : 502).json({ error: 'Upstream fetch failed' });
    }

    const contentType = String(upstream.headers.get('content-type') || '');
    if (contentType && !/^image\//i.test(contentType)) {
      return res.status(415).json({ error: 'Not an image' });
    }

    const raw = Buffer.from(await upstream.arrayBuffer());
    if (!raw.length || raw.length > MAX_INPUT_BYTES) {
      return res.status(413).json({ error: 'Image too large' });
    }

    const accept = String(req.headers.accept || '').toLowerCase();
    const smallThumb = width <= 220 && height <= 220;
    let preferAvif = false;
    let preferWebp = false;
    if (fmtParam === 'avif') {
      preferAvif = true;
    } else if (fmtParam === 'webp') {
      preferWebp = true;
    } else if (fmtParam !== 'jpeg' && fmtParam !== 'jpg') {
      preferAvif = !smallThumb && accept.indexOf('image/avif') !== -1;
      preferWebp = preferAvif || accept.indexOf('image/webp') !== -1 || accept.indexOf('image/*') !== -1;
    }
    const pipeline = sharp(raw).rotate().resize(width, height, { fit: 'cover', withoutEnlargement: true });
    let out;
    let mime = 'image/jpeg';
    if (preferAvif) {
      out = await pipeline.avif({ quality: Math.min(quality, 52), effort: 2 }).toBuffer();
      mime = 'image/avif';
    } else if (preferWebp) {
      out = await pipeline.webp({ quality: Math.min(quality, 82), effort: 2 }).toBuffer();
      mime = 'image/webp';
    } else {
      out = await pipeline.jpeg({ quality: Math.min(quality, 85), mozjpeg: true }).toBuffer();
      mime = 'image/jpeg';
    }

    res.setHeader('Content-Type', mime);
    res.setHeader('Vary', 'Accept');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', String(out.length));
    return res.status(200).send(out);
  } catch (error) {
    console.error('image-thumb failed:', error && error.message ? error.message : error);
    return res.status(500).json({ error: 'Resize failed' });
  }
}
