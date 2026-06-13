/**
 * Legacy upload wrapper.
 * Production uploads must go only to Firebase Storage.
 */

async function uploadImageToCloudinary(file, onProgress) {
  var entityId = window.currentEditingProductId || window.pendingProductCreateId || Date.now();
  if (window.FBDB && window.FBDB.uploadImageWithProgress) {
    var result = await window.FBDB.uploadImageWithProgress(file, entityId, onProgress);
    var isFirebaseUrl = result.url &&
      result.url.indexOf('data:') !== 0 &&
      (
        result.url.indexOf('firebasestorage.googleapis.com') !== -1 ||
        result.url.indexOf('storage.googleapis.com') !== -1
      );
    if (result.success && isFirebaseUrl) {
      return result;
    }
    return { success: false, error: result.error || 'Firebase Storage upload failed', method: 'firebase-storage' };
  }
  if (window.FBDB && window.FBDB.uploadImage) {
    var fallback = await window.FBDB.uploadImage(file, entityId);
    if (typeof onProgress === 'function') onProgress(100);
    return fallback;
  }

  return { success: false, error: 'Firebase Storage is not ready. Refresh page and try again.', method: 'firebase-storage' };
}

/**
 * Upload multiple images
 */
async function uploadMultipleImages(files) {
  var urls = [];
  for (var i = 0; i < files.length; i++) {
    var result = await uploadImageToCloudinary(files[i]);
    if (result.success) {
      urls.push(result.url);
    }
  }
  return urls;
}
