/**
 * Small thumbnails + lazy image attributes (fewer bytes, faster paint).
 */
(function(global) {
  function isDataUrl(url) {
    return !url || String(url).indexOf('data:') === 0;
  }

  function isFirebaseStorageUrl(url) {
    return !!url && (
      url.indexOf('firebasestorage.googleapis.com') !== -1 ||
      url.indexOf('storage.googleapis.com') !== -1
    );
  }

  function isLocalPreviewHost() {
    try {
      var host = global.location && global.location.hostname ? global.location.hostname : '';
      return host === 'localhost' || host === '127.0.0.1';
    } catch (e) {
      return false;
    }
  }

  function imageLoadFallback(img) {
    if (!img) return;
    var before = img.src;
    var full = img.getAttribute('data-full');
    if (full && img.src !== full) {
      img.src = full;
      return;
    }
    var fb = img.getAttribute('data-fallback');
    if (fb && img.src !== fb) {
      img.src = fb;
      img.onerror = null;
      return;
    }
    if (typeof global.PRODUCT_FALLBACK_IMAGE !== 'undefined' && img.src !== global.PRODUCT_FALLBACK_IMAGE) {
      img.src = global.PRODUCT_FALLBACK_IMAGE;
      img.onerror = null;
    }
  }

  function firebaseMediaUrl(url) {
    if (!url || isDataUrl(url)) return url;
    if (!isFirebaseStorageUrl(url)) return url;
    if (/[?&]alt=media(?:&|$)/.test(url)) return url;
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 'alt=media';
  }

  function thumbServiceUrl(url, w, h) {
    if (!url || isDataUrl(url) || !isFirebaseStorageUrl(url)) return url || '';
    if (isLocalPreviewHost()) return firebaseMediaUrl(url);
    var width = Math.max(32, Math.min(1200, Number(w) || 320));
    var height = Math.max(32, Math.min(1200, Number(h) || width));
    var q = width <= 360 ? 72 : 78;
    return (
      '/api/image-thumb?w=' + width +
      '&h=' + height +
      '&q=' + q +
      '&url=' + encodeURIComponent(firebaseMediaUrl(url))
    );
  }

  function cloudinaryAssetPath(url) {
    var parts = url.split('/upload/');
    if (parts.length !== 2) return null;
    var segments = parts[1].split('/').filter(Boolean);
    var idx = 0;
    while (idx < segments.length) {
      var seg = segments[idx];
      if (/^v\d+$/.test(seg)) {
        idx++;
        continue;
      }
      if (seg.indexOf(',') !== -1 || /^(c_|w_|h_|q_|f_|g_|dpr_|ar_|b_)/.test(seg)) {
        idx++;
        continue;
      }
      break;
    }
    if (idx >= segments.length) return null;
    return segments.slice(idx).join('/');
  }

  function cloudinaryThumb(url, w, h) {
    if (!url || isDataUrl(url)) return url;
    if (url.indexOf('res.cloudinary.com') === -1) return url;
    var parts = url.split('/upload/');
    if (parts.length !== 2) return url;
    var assetPath = cloudinaryAssetPath(url);
    if (!assetPath) return url;
    var transform = 'c_fill,w_' + (w || 80) + ',h_' + (h || 80) + ',q_auto:low,f_auto';
    return parts[0] + '/upload/' + transform + '/' + assetPath;
  }

  function productThumbUrl(url, size) {
    size = size || 80;
    if (!url || isDataUrl(url)) return url || '';
    if (url.indexOf('res.cloudinary.com') !== -1) return cloudinaryThumb(url, size, size);
    if (isFirebaseStorageUrl(url)) return thumbServiceUrl(url, size, size);
    if (url.indexOf('blob.vercel-storage.com') !== -1) return url;
    return url;
  }

  function productCardImageUrl(url) {
    if (!url || isDataUrl(url)) return url || '';
    if (isLocalPreviewHost()) return firebaseMediaUrl(url);
    if (url.indexOf('res.cloudinary.com') !== -1) return cloudinaryThumb(url, 320, 220);
    if (isFirebaseStorageUrl(url)) return thumbServiceUrl(url, 320, 220);
    return productThumbUrl(url, 320);
  }

  function productCardImageSrcset(url) {
    if (!url || isDataUrl(url) || isLocalPreviewHost()) return '';
    if (url.indexOf('res.cloudinary.com') !== -1) return '';
    if (!isFirebaseStorageUrl(url)) return '';
    var oneX = thumbServiceUrl(url, 320, 220);
    var twoX = thumbServiceUrl(url, 640, 440);
    return oneX + ' 320w, ' + twoX + ' 640w';
  }

  function productCardImageSizes() {
    return '(max-width: 480px) 50vw, (max-width: 1024px) 33vw, 320px';
  }

  function auctionCardImageUrl(url) {
    if (!url || isDataUrl(url)) return url || '';
    if (isLocalPreviewHost()) return firebaseMediaUrl(url);
    if (url.indexOf('res.cloudinary.com') !== -1) {
      return cloudinaryThumb(url, 520, 293);
    }
    if (isFirebaseStorageUrl(url)) {
      return thumbServiceUrl(url, 520, 293);
    }
    return productThumbUrl(url, 400);
  }

  function productDetailMainUrl(url) {
    if (!url || isDataUrl(url)) return url || '';
    if (url.indexOf('res.cloudinary.com') !== -1) return cloudinaryThumb(url, 900, 900);
    if (isFirebaseStorageUrl(url)) return thumbServiceUrl(url, 900, 900);
    return productCardImageUrl(url);
  }

  function lazyImgAttrs() {
    return ' loading="lazy" decoding="async" fetchpriority="low"';
  }

  function eagerMainAttrs() {
    return ' loading="eager" decoding="async" fetchpriority="high"';
  }

  function preloadProductCardImage(url) {
    if (!url || isDataUrl(url)) return;
    if (document.querySelector('link[data-aylen-lcp-preload="1"]')) return;
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    link.setAttribute('data-aylen-lcp-preload', '1');
    link.setAttribute('fetchpriority', 'high');
    document.head.appendChild(link);
    var img = new Image();
    img.decoding = 'async';
    img.src = url;
  }

  function preloadFirstCatalogImage(products) {
    if (!Array.isArray(products) || !products.length) return;
    var first = products[0];
    var raw = first && first.images && first.images[0];
    if (!raw) return;
    preloadProductCardImage(productCardImageUrl(raw));
  }

  global.aylenImageLoadFallback = imageLoadFallback;

  global.AYLEN_IMAGES = {
    productThumbUrl: productThumbUrl,
    productCardImageUrl: productCardImageUrl,
    productCardImageSrcset: productCardImageSrcset,
    productCardImageSizes: productCardImageSizes,
    productCardImageDirectUrl: firebaseMediaUrl,
    firebaseMediaUrl: firebaseMediaUrl,
    isLocalPreviewHost: isLocalPreviewHost,
    imageLoadFallback: imageLoadFallback,
    auctionCardImageUrl: auctionCardImageUrl,
    productDetailMainUrl: productDetailMainUrl,
    lazyImgAttrs: lazyImgAttrs,
    eagerMainAttrs: eagerMainAttrs,
    thumbServiceUrl: thumbServiceUrl,
    preloadProductCardImage: preloadProductCardImage,
    preloadFirstCatalogImage: preloadFirstCatalogImage
  };
})(window);
