/**
 * Persist branding assets to Firebase Storage + Firestore.
 */
import { getFirestoreAdmin, getStorageBucket } from './firebase-admin-app.mjs';

const BRANDING_DOC = 'branding';
const COLLECTION = 'siteSettings';

function publicDownloadUrl(bucketName, filePath, token) {
  const encoded = filePath.split('/').map(encodeURIComponent).join('%2F');
  var url = 'https://firebasestorage.googleapis.com/v0/b/' + bucketName + '/o/' + encoded + '?alt=media';
  if (token) url += '&token=' + token;
  return url;
}

export async function loadBrandingDoc() {
  const db = getFirestoreAdmin();
  const snap = await db.collection(COLLECTION).doc(BRANDING_DOC).get();
  if (!snap.exists) return null;
  return snap.data() || null;
}

export async function uploadBrandingBuffers(buffers, meta) {
  const bucket = getStorageBucket();
  const version = meta.cacheVersion;
  const prefix = 'branding/v' + version;
  const icons = {};
  const bucketName = bucket.name;

  for (const [name, buf] of Object.entries(buffers)) {
    if (name === 'source-1024') continue;
    const ext = name === 'favicon.ico' ? 'ico' : 'png';
    const path = prefix + '/' + name + '.' + ext;
    const contentType = ext === 'ico' ? 'image/x-icon' : 'image/png';
    const file = bucket.file(path);
    await file.save(buf, {
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable'
      },
      resumable: false
    });
    const [metaResp] = await file.getMetadata();
    const token = metaResp.metadata && metaResp.metadata.firebaseStorageDownloadTokens;
    const tokenPart = token ? (Array.isArray(token) ? token[0] : String(token).split(',')[0]) : null;
    icons[name] = publicDownloadUrl(bucketName, path, tokenPart);
  }

  const sourcePath = prefix + '/source-1024.png';
  const sourceFile = bucket.file(sourcePath);
  await sourceFile.save(buffers['source-1024'], {
    metadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' },
    resumable: false
  });
  const [srcMeta] = await sourceFile.getMetadata();
  const srcToken = srcMeta.metadata && srcMeta.metadata.firebaseStorageDownloadTokens;
  const srcTokenPart = srcToken ? (Array.isArray(srcToken) ? srcToken[0] : String(srcToken).split(',')[0]) : null;
  const sourceUrl = publicDownloadUrl(bucketName, sourcePath, srcTokenPart);

  const payload = {
    cacheVersion: version,
    swCacheVersion: 'aylen-pwa-v' + version,
    sourceUrl,
    sourcePath,
    icons,
    themeColor: meta.themeColor || '#070a14',
    backgroundColor: meta.backgroundColor || '#070a14',
    updatedAt: new Date().toISOString(),
    updatedBy: meta.updatedBy || 'admin'
  };

  const db = getFirestoreAdmin();
  await db.collection(COLLECTION).doc(BRANDING_DOC).set(payload, { merge: true });
  return payload;
}

export async function downloadSourceBuffer(sourcePath) {
  const bucket = getStorageBucket();
  const [buf] = await bucket.file(sourcePath).download();
  return buf;
}
