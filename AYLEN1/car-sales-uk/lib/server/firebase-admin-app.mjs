/**
 * Shared Firebase Admin app (Firestore + Storage).
 */
import admin from 'firebase-admin';

let initialized = false;

export function ensureFirebaseAdmin() {
  if (initialized && admin.apps.length) {
    return admin;
  }
  var raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured');
  }
  var cred = JSON.parse(raw);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(cred),
      storageBucket: cred.storageBucket || process.env.FIREBASE_STORAGE_BUCKET || 'aylensale.firebasestorage.app'
    });
  }
  initialized = true;
  return admin;
}

export function getFirestoreAdmin() {
  ensureFirebaseAdmin();
  return admin.firestore();
}

export function getAuthAdmin() {
  ensureFirebaseAdmin();
  return admin.auth();
}

const ADMIN_EMAILS = ['oleg.yuryevich@gmail.com', 'admin@aylensale.com'];

export async function verifyFirebaseAdminToken(idToken) {
  if (!idToken) return null;
  try {
    const decoded = await getAuthAdmin().verifyIdToken(String(idToken));
    const email = String(decoded.email || '').toLowerCase();
    if (ADMIN_EMAILS.indexOf(email) === -1) return null;
    return decoded;
  } catch (e) {
    return null;
  }
}

export function getStorageBucket() {
  ensureFirebaseAdmin();
  return admin.storage().bucket();
}
