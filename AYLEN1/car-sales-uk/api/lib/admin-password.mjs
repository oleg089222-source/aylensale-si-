/**
 * Admin password — env fallback + Firestore hash (privateAdmin/auth, server-only).
 */
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getAuthAdmin, getFirestoreAdmin } from './firebase-admin-app.mjs';
import { isAdminConfigured } from './firestore-admin.mjs';

const scryptAsync = promisify(scrypt);
const AUTH_COLLECTION = 'privateAdmin';
const AUTH_DOC = 'auth';
const ADMIN_FIREBASE_EMAIL = 'admin@aylensale.com';
const SCRYPT_KEYLEN = 64;

let cachedAuth = null;
let cacheAt = 0;
const CACHE_MS = 45 * 1000;

function trimPass(value) {
  return String(value || '').trim();
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(trimPass(password), salt, SCRYPT_KEYLEN);
  return {
    salt,
    hash: Buffer.from(derived).toString('hex'),
    version: 1
  };
}

async function verifyScrypt(password, salt, hashHex) {
  if (!salt || !hashHex) return false;
  try {
    const derived = await scryptAsync(trimPass(password), salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hashHex, 'hex');
    if (expected.length !== derived.length) return false;
    return timingSafeEqual(expected, Buffer.from(derived));
  } catch (e) {
    return false;
  }
}

async function loadStoredAuth(force) {
  if (!force && cachedAuth && Date.now() - cacheAt < CACHE_MS) {
    return cachedAuth;
  }
  if (!isAdminConfigured()) {
    cachedAuth = null;
    cacheAt = Date.now();
    return null;
  }
  try {
    const snap = await getFirestoreAdmin().collection(AUTH_COLLECTION).doc(AUTH_DOC).get();
    cachedAuth = snap.exists ? (snap.data() || null) : null;
  } catch (e) {
    console.warn('[admin-password] loadStoredAuth failed:', e.message);
    cachedAuth = null;
  }
  cacheAt = Date.now();
  return cachedAuth;
}

function invalidateAuthCache() {
  cachedAuth = null;
  cacheAt = 0;
}

export async function verifyAdminPassword(password) {
  const provided = trimPass(password);
  if (!provided || provided.length > 200) return false;

  const stored = await loadStoredAuth(false);
  if (stored && stored.hash && stored.salt) {
    return verifyScrypt(provided, stored.salt, stored.hash);
  }

  const envPass = process.env.ADMIN_PASSWORD;
  if (!envPass) return false;
  return provided === trimPass(envPass);
}

export async function isAdminPasswordConfigured() {
  const stored = await loadStoredAuth(false);
  if (stored && stored.hash) return true;
  return !!trimPass(process.env.ADMIN_PASSWORD);
}

export async function changeAdminPassword(currentPassword, newPassword) {
  const current = trimPass(currentPassword);
  const next = trimPass(newPassword);

  if (!current || !next) {
    throw new Error('Current and new password are required.');
  }
  if (next.length < 8) {
    throw new Error('New password must be at least 8 characters.');
  }
  if (next.length > 200) {
    throw new Error('New password is too long.');
  }
  if (current === next) {
    throw new Error('New password must be different from the current one.');
  }

  const ok = await verifyAdminPassword(current);
  if (!ok) {
    throw new Error('Current password is incorrect.');
  }
  if (!isAdminConfigured()) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured on server.');
  }

  const hashed = await hashPassword(next);
  const payload = {
    ...hashed,
    updatedAt: new Date().toISOString()
  };

  await getFirestoreAdmin().collection(AUTH_COLLECTION).doc(AUTH_DOC).set(payload, { merge: false });
  invalidateAuthCache();

  const auth = getAuthAdmin();
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(ADMIN_FIREBASE_EMAIL);
  } catch (e) {
    userRecord = null;
  }
  if (userRecord) {
    await auth.updateUser(userRecord.uid, { password: next });
  } else {
    console.warn('[admin-password] Firebase user not found:', ADMIN_FIREBASE_EMAIL);
  }

  return {
    firebaseUpdated: !!userRecord,
    vercelNote: 'Login works immediately. Optional: update ADMIN_PASSWORD in Vercel to match.'
  };
}
