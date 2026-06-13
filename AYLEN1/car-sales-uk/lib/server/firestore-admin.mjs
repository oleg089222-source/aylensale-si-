/**
 * Server-side admin capability checks (Firestore / Storage via service account).
 */
export function isAdminConfigured() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  return !!String(raw).trim();
}
