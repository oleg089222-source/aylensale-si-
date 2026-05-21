/**
 * Small thumbnails + lazy image attributes (fewer bytes, faster paint).
 */
(function(global) {
  function isDataUrl(url) {
    return !url || String(url).indexOf('data:') === 0;
  }

  function firebaseThumb(url, w, h) {
    if (!url || isDataUrl(url)) return url;
    if (url.indexOf('firebasestorage.googleapis.com') === -1) return url;
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 'alt=media';
  }

  function cloudinaryThumb(url, w, h) {
    if (!url || isDataUrl(url)) return url;
    if (url.indexOf('res.cloudinary.com') === -1) return url;
    var parts = url.split('/upload/');
    if (parts.length !== 2) return url;
    var transform = 'c_fill,w_' + (w || 80) + ',h_' + (h || 80) + ',q_auto:low,f_auto';
    return parts[0] + '/upload/' + transform + '/' + parts[1];
  }

  function productThumbUrl(url, size) {
    size = size || 80;
    if (!url || isDataUrl(url)) return url || '';
    if (url.indexOf('res.cloudinary.com') !== -1) return cloudinaryThumb(url, size, size);
    if (url.indexOf('firebasestorage.googleapis.com') !== -1) return firebaseThumb(url, size, size);
    return url;
  }

  function productCardImageUrl(url) {
    return productThumbUrl(url, 320);
  }

  function lazyImgAttrs() {
    return ' loading="lazy" decoding="async" fetchpriority="low"';
  }

  global.AYLEN_IMAGES = {
    productThumbUrl: productThumbUrl,
    productCardImageUrl: productCardImageUrl,
    lazyImgAttrs: lazyImgAttrs
  };
})(window);
