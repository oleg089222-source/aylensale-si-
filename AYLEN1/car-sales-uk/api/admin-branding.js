/**
 * GET /api/manifest (via rewrite) — dynamic PWA manifest
 * POST /api/admin-branding — preview | save | regenerate
 */
import { generateIconSet, buffersToDataUrls } from '../lib/server/branding-icons.mjs';
import { loadBrandingDoc, uploadBrandingBuffers, downloadSourceBuffer } from '../lib/server/branding-store.mjs';
import { isAdminConfigured } from '../lib/server/firestore-admin.mjs';
import { verifyAdminPassword } from '../lib/server/admin-password.mjs';
import { servePwaManifest } from '../lib/server/pwa-manifest.mjs';

const MAX_BYTES = 4 * 1024 * 1024;

async function verifyAdmin(password) {
  if (!password) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (!(await verifyAdminPassword(password))) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true };
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return req.body || {};
}

function parseImageBase64(body) {
  var raw = body.imageBase64 || body.image || '';
  if (!raw) return null;
  var str = String(raw);
  var m = str.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (m) {
    return { buffer: Buffer.from(m[2], 'base64'), mime: 'image/' + m[1].toLowerCase().replace('jpg', 'jpeg') };
  }
  return { buffer: Buffer.from(str, 'base64'), mime: body.mimeType || 'image/png' };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return servePwaManifest(req, res);
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'FIREBASE_SERVICE_ACCOUNT is not configured on server' });
    }

    const body = parseBody(req);
    const auth = await verifyAdmin(body.adminPassword);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const action = String(body.action || 'preview').toLowerCase();

    if (action === 'regenerate') {
      const existing = await loadBrandingDoc();
      if (!existing || !existing.sourcePath) {
        return res.status(400).json({
          error: 'No saved logo yet. Upload a logo and click Save branding first, then you can regenerate.'
        });
      }
      let sourceBuf;
      try {
        sourceBuf = await downloadSourceBuffer(existing.sourcePath);
      } catch (dlErr) {
        console.error('[admin-branding] download source failed', dlErr);
        return res.status(404).json({
          error: 'Saved logo file is missing in storage. Upload and save a new logo.'
        });
      }
      const buffers = await generateIconSet(sourceBuf);
      const nextVersion = Number(existing.cacheVersion || 0) + 1;
      const saved = await uploadBrandingBuffers(buffers, {
        cacheVersion: nextVersion,
        themeColor: existing.themeColor,
        backgroundColor: existing.backgroundColor,
        updatedBy: 'regenerate'
      });
      return res.status(200).json({
        success: true,
        action: 'regenerate',
        branding: saved,
        preview: buffersToDataUrls(buffers)
      });
    }

    const image = parseImageBase64(body);
    if (!image || !image.buffer || !image.buffer.length) {
      return res.status(400).json({ error: 'imageBase64 is required (PNG, JPG or WEBP, recommended 1024×1024)' });
    }
    if (image.buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: 'Image too large. Max 4MB.' });
    }

    const buffers = await generateIconSet(image.buffer);
    const preview = buffersToDataUrls(buffers);

    if (action === 'preview') {
      return res.status(200).json({
        success: true,
        action: 'preview',
        preview
      });
    }

    if (action === 'save') {
      const existing = await loadBrandingDoc();
      const nextVersion = Number(existing && existing.cacheVersion ? existing.cacheVersion : 0) + 1;
      const saved = await uploadBrandingBuffers(buffers, {
        cacheVersion: nextVersion,
        themeColor: body.themeColor || '#070a14',
        backgroundColor: body.backgroundColor || '#070a14',
        updatedBy: 'save'
      });
      return res.status(200).json({
        success: true,
        action: 'save',
        branding: saved,
        preview
      });
    }

    return res.status(400).json({ error: 'Unknown action. Use preview, save, or regenerate.' });
  } catch (err) {
    console.error('[admin-branding]', err);
    return res.status(500).json({
      error: err.message || 'Branding operation failed'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb'
    }
  }
};
