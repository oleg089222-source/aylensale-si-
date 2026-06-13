/**
 * Shared spam protection: rate limits, honeypot, timing, bot heuristics, Turnstile.
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import { createHash } from 'node:crypto';

/** Cloudflare dummy keys — work on any hostname (Vercel preview URLs change per deploy). */
const PREVIEW_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
const PREVIEW_TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';

function isVercelPreview() {
  return String(process.env.VERCEL_ENV || '').trim() === 'preview';
}

function resolveTurnstileSecret() {
  if (isVercelPreview()) {
    return String(process.env.TURNSTILE_PREVIEW_SECRET_KEY || PREVIEW_TURNSTILE_SECRET_KEY).trim();
  }
  return String(process.env.TURNSTILE_SECRET_KEY || '').trim();
}

const memoryBuckets = new Map();

export function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

export function cleanString(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

export function countUrls(value) {
  return (String(value || '').match(/https?:\/\//gi) || []).length;
}

export function detectBot(name, phone, email, comment) {
  let suspicion = 0;
  const safeName = String(name || '').trim();
  const digitsOnly = String(phone || '').replace(/\D/g, '');

  if (!safeName || safeName.length < 2) suspicion += 2;
  if (safeName && /^\d+$/.test(safeName.replace(/\s/g, ''))) suspicion += 3;
  if (digitsOnly.length < 8) suspicion += 1;
  if (digitsOnly.length > 15) suspicion += 1;
  if (safeName && /(.)\1{5,}/.test(safeName)) suspicion += 2;

  const spamKeywords = [
    'viagra', 'casino', 'lottery', 'bitcoin', 'forex', 'crypto', 'loan', 'porn',
    'hack', 'click here', 'free money', 'seo service', 'backlink', 'telegram bot'
  ];
  const contentLower = (safeName + ' ' + (email || '') + ' ' + (comment || '')).toLowerCase();
  for (const keyword of spamKeywords) {
    if (contentLower.includes(keyword)) suspicion += 3;
  }

  if (countUrls(comment) > 1) suspicion += 5;

  return suspicion >= 5;
}

export function validateSecurityMeta(security, minimumMs) {
  if (!security || typeof security !== 'object') return true;
  if (security.website) return false;

  const startedAt = Number(security.formStartedAt || 0);
  const submittedAt = Number(security.submittedAt || 0);
  const min = Number(minimumMs || 1000);
  if (startedAt && submittedAt && submittedAt - startedAt < min) return false;

  return true;
}

function hashRateKey(key) {
  return createHash('sha256').update(String(key)).digest('hex').slice(0, 40);
}

function memoryRateOk(key, maxAttempts, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const prev = (memoryBuckets.get(key) || []).filter((t) => t > cutoff);
  if (prev.length >= maxAttempts) {
    memoryBuckets.set(key, prev);
    return false;
  }
  prev.push(now);
  memoryBuckets.set(key, prev);
  return true;
}

async function firestoreRateOk(key, maxAttempts, windowMs) {
  const db = getFirestoreAdmin();
  const docId = hashRateKey(key);
  const ref = db.collection('spamGuard').doc(docId);
  const now = Date.now();
  const cutoff = now - windowMs;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const attempts = Array.isArray(data.attempts)
      ? data.attempts.filter((t) => Number(t) > cutoff)
      : [];
    if (attempts.length >= maxAttempts) {
      tx.set(ref, { attempts, updatedAt: now }, { merge: true });
      return false;
    }
    attempts.push(now);
    tx.set(ref, { attempts, updatedAt: now, scope: String(key).split(':')[0] || 'generic' }, { merge: true });
    return true;
  });
}

async function rateOk(key, maxAttempts, windowMs) {
  try {
    return await firestoreRateOk(key, maxAttempts, windowMs);
  } catch (err) {
    console.warn('[spam-guard] Firestore rate limit fallback:', err.message);
    return memoryRateOk(key, maxAttempts, windowMs);
  }
}

/**
 * Check IP + optional session rate limits. Throws nothing — returns { ok, status, error }.
 */
export async function assertRateLimit(req, scope, options) {
  const opts = options || {};
  const maxAttempts = Number(opts.maxAttempts || 5);
  const windowMs = Number(opts.windowMs || 3600000);
  const sessionId = cleanString(opts.sessionId, 80);
  const ip = getClientIP(req);

  const keys = [`${scope}:ip:${ip}`];
  if (sessionId && sessionId !== 'no-session') {
    keys.push(`${scope}:sess:${sessionId}`);
  }

  for (const key of keys) {
    const allowed = await rateOk(key, maxAttempts, windowMs);
    if (!allowed) {
      return {
        ok: false,
        status: 429,
        error: opts.message || 'Too many requests. Please wait and try again.'
      };
    }
  }

  return { ok: true };
}

export async function verifyTurnstile(token, remoteip) {
  const secret = resolveTurnstileSecret();
  if (!secret) return { ok: true, skipped: true };

  const response = cleanString(token, 4096);
  if (!response) {
    return { ok: false, error: 'Captcha verification required.' };
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', response);
  if (remoteip) body.set('remoteip', remoteip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) {
    return { ok: false, error: 'Captcha failed — please try again.' };
  }
  return { ok: true };
}

export function turnstileSiteKey() {
  if (isVercelPreview()) {
    return String(process.env.TURNSTILE_PREVIEW_SITE_KEY || PREVIEW_TURNSTILE_SITE_KEY).trim();
  }
  return String(process.env.TURNSTILE_SITE_KEY || '').trim();
}

export async function guardPublicForm(req, options) {
  const opts = options || {};
  const security = req.body?.security;
  const sessionId = cleanString(security?.sessionId, 80) || 'no-session';

  if (!validateSecurityMeta(security, opts.minimumMs || 1000)) {
    return { ok: false, status: 400, error: 'Submission blocked.' };
  }

  const rate = await assertRateLimit(req, opts.scope || 'form', {
    maxAttempts: opts.maxAttempts || 5,
    windowMs: opts.windowMs || 3600000,
    sessionId,
    message: opts.rateMessage
  });
  if (!rate.ok) return rate;

  if (opts.requireTurnstile !== false) {
    const captcha = await verifyTurnstile(req.body?.turnstileToken, getClientIP(req));
    if (!captcha.ok) {
      return { ok: false, status: 400, error: captcha.error || 'Captcha failed.' };
    }
  }

  return { ok: true, sessionId };
}
