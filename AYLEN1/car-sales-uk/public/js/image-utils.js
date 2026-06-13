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

  function isMobileStorefront() {
    try {
      return global.matchMedia && global.matchMedia('(max-width: 768px)').matches;
    } catch (e) {
      return false;
    }
  }

  var MOBILE_CARD = 176;
  var MOBILE_CARD_2X = 352;

  function thumbQuality(width) {
    if (width <= MOBILE_CARD) return 52;
    if (width <= MOBILE_CARD_2X) return 48;
    if (width <= 360) return 68;
    return 74;
  }

  function thumbServiceUrl(url, w, h, fmt) {
    if (!url || isDataUrl(url) || !isFirebaseStorageUrl(url)) return url || '';
    if (isLocalPreviewHost()) return firebaseMediaUrl(url);
    var width = Math.max(32, Math.min(1200, Number(w) || 320));
    var height = Math.max(32, Math.min(1200, Number(h) || width));
    var q = thumbQuality(width);
    var base =
      '/api/image-thumb?w=' + width +
      '&h=' + height +
      '&q=' + q +
      '&url=' + encodeURIComponent(firebaseMediaUrl(url));
    if (fmt) base += '&fmt=' + encodeURIComponent(fmt);
    return base;
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
    if (isMobileStorefront()) {
      if (url.indexOf('res.cloudinary.com') !== -1) return cloudinaryThumb(url, MOBILE_CARD, MOBILE_CARD);
      if (isFirebaseStorageUrl(url)) return thumbServiceUrl(url, MOBILE_CARD, MOBILE_CARD);
      return productThumbUrl(url, MOBILE_CARD);
    }
    if (url.indexOf('res.cloudinary.com') !== -1) return cloudinaryThumb(url, 320, 220);
    if (isFirebaseStorageUrl(url)) return thumbServiceUrl(url, 320, 220);
    return productThumbUrl(url, 320);
  }

  function responsiveWidths() {
    if (isMobileStorefront()) return [176, 352, 400];
    return [320, 400, 600, 800, 1200];
  }

  function productCardImageSrcset(url) {
    if (!url || isDataUrl(url) || isLocalPreviewHost()) return '';
    if (url.indexOf('res.cloudinary.com') !== -1) {
      var widths = responsiveWidths();
      return widths.map(function(w) {
        var h = isMobileStorefront() ? w : Math.round(w * 0.69);
        return cloudinaryThumb(url, w, h) + ' ' + w + 'w';
      }).join(', ');
    }
    if (!isFirebaseStorageUrl(url)) return '';
    var parts = responsiveWidths().map(function(w) {
      var h = isMobileStorefront() ? w : Math.round(w * 0.69);
      return thumbServiceUrl(url, w, h, 'webp') + ' ' + w + 'w';
    });
    return parts.join(', ');
  }

  function productCardPictureFallbackUrl(url) {
    if (!url || isDataUrl(url)) return url || '';
    if (url.indexOf('res.cloudinary.com') !== -1) {
      return isMobileStorefront()
        ? cloudinaryThumb(url, MOBILE_CARD, MOBILE_CARD)
        : cloudinaryThumb(url, 400, 276);
    }
    if (isFirebaseStorageUrl(url)) {
      return isMobileStorefront()
        ? thumbServiceUrl(url, MOBILE_CARD, MOBILE_CARD, 'jpeg')
        : thumbServiceUrl(url, 400, 276, 'jpeg');
    }
    return productCardImageUrl(url);
  }

  function buildProductCardPictureHtml(url, attrs) {
    attrs = attrs || {};
    if (!url || isDataUrl(url)) {
      return '<img src="' + (url || '') + '"' + (attrs.imgAttrs || '') + '>';
    }
    var srcset = productCardImageSrcset(url);
    if (!srcset) {
      var single = productCardImageUrl(url);
      var d = productCardDisplaySize();
      return '<img src="' + single + '" width="' + d.w + '" height="' + d.h + '"' + (attrs.imgAttrs || '') + '>';
    }
    var sizes = productCardImageSizes();
    var fallback = productCardPictureFallbackUrl(url);
    var webpSrcset = srcset;
    var imgAttrs = attrs.imgAttrs || '';
    var w = attrs.width ? ' width="' + attrs.width + '"' : '';
    var h = attrs.height ? ' height="' + attrs.height + '"' : '';
    return '<picture class="product-card-picture">' +
      '<source type="image/webp" srcset="' + webpSrcset + '" sizes="' + sizes + '">' +
      '<img src="' + fallback + '" srcset="' + webpSrcset + '" sizes="' + sizes + '"' +
      w + h + imgAttrs + '>' +
      '</picture>';
  }

  function productCardDisplaySize() {
    if (isMobileStorefront()) return { w: MOBILE_CARD, h: MOBILE_CARD };
    return { w: 320, h: 220 };
  }

  function productCardImageSizes() {
    return '(max-width: 768px) calc(50vw - 14px), (max-width: 1024px) 33vw, 300px';
  }

  function pickupCardImageUrl(url) {
    if (!url || isDataUrl(url)) return url || '';
    if (isLocalPreviewHost()) return firebaseMediaUrl(url);
    var pw = isMobileStorefront() ? 360 : 460;
    var ph = isMobileStorefront() ? 180 : 220;
    if (url.indexOf('res.cloudinary.com') !== -1) {
      return cloudinaryThumb(url, pw, ph);
    }
    if (isFirebaseStorageUrl(url)) {
      return thumbServiceUrl(url, pw, ph);
    }
    return productThumbUrl(url, pw);
  }

  function auctionCardImageUrl(url) {
    if (!url || isDataUrl(url)) return url || '';
    if (isLocalPreviewHost()) return firebaseMediaUrl(url);
    var aw = isMobileStorefront() ? 200 : 480;
    var ah = isMobileStorefront() ? 112 : 270;
    if (url.indexOf('res.cloudinary.com') !== -1) {
      return cloudinaryThumb(url, aw, ah);
    }
    if (isFirebaseStorageUrl(url)) {
      return thumbServiceUrl(url, aw, ah);
    }
    return productThumbUrl(url, aw);
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

  function preloadProductCardImage(url, rawUrl) {
    if (!url || isDataUrl(url)) return;
    if (document.querySelector('link[data-aylen-lcp-preload="1"]')) return;
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    link.setAttribute('data-aylen-lcp-preload', '1');
    link.setAttribute('fetchpriority', 'high');
    if (rawUrl) {
      var srcset = productCardImageSrcset(rawUrl);
      if (srcset) {
        link.setAttribute('imagesrcset', srcset);
        link.setAttribute('imagesizes', productCardImageSizes());
      }
    }
    document.head.appendChild(link);
    var img = new Image();
    img.decoding = 'async';
    if (link.getAttribute('imagesrcset')) {
      img.sizes = productCardImageSizes();
      img.srcset = link.getAttribute('imagesrcset');
    }
    img.src = url;
  }

  function preloadFirstCatalogImage(products) {
    if (!Array.isArray(products) || !products.length) return;
    var first = products[0];
    var raw = first && first.images && first.images[0];
    if (!raw) return;
    preloadProductCardImage(productCardImageUrl(raw), raw);
  }

  global.aylenImageLoadFallback = imageLoadFallback;

  global.AYLEN_IMAGES = {
    productThumbUrl: productThumbUrl,
    productCardImageUrl: productCardImageUrl,
    productCardImageSrcset: productCardImageSrcset,
    productCardImageSizes: productCardImageSizes,
    productCardDisplaySize: productCardDisplaySize,
    productCardImageDirectUrl: firebaseMediaUrl,
    firebaseMediaUrl: firebaseMediaUrl,
    isLocalPreviewHost: isLocalPreviewHost,
    imageLoadFallback: imageLoadFallback,
    pickupCardImageUrl: pickupCardImageUrl,
    auctionCardImageUrl: auctionCardImageUrl,
    productDetailMainUrl: productDetailMainUrl,
    lazyImgAttrs: lazyImgAttrs,
    eagerMainAttrs: eagerMainAttrs,
    thumbServiceUrl: thumbServiceUrl,
    preloadProductCardImage: preloadProductCardImage,
    preloadFirstCatalogImage: preloadFirstCatalogImage,
    buildProductCardPictureHtml: buildProductCardPictureHtml,
    productCardPictureFallbackUrl: productCardPictureFallbackUrl,
    responsiveWidths: responsiveWidths
  };
})(window);
