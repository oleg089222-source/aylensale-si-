/**
 * Shared PDP modal + lightbox for storefront listings and VIP stock.
 */
(function(global) {
  'use strict';

  var MODAL_ID = 'aylenPdpModal';
  var LIGHTBOX_ID = 'aylenPdpLightbox';
  var lbState = { imgs: [], idx: 0 };
  var galleryStates = new WeakMap();
  var activeModalId = null;

  function esc(text) {
    if (global.escapeHtml) return global.escapeHtml(text);
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeImages(raw) {
    var list = Array.isArray(raw) ? raw.filter(function(u) { return u && String(u).trim(); }) : [];
    if (!list.length) {
      var fb = typeof global.PRODUCT_FALLBACK_IMAGE !== 'undefined' ? global.PRODUCT_FALLBACK_IMAGE : '/logo.png';
      list = [fb];
    }
    return list;
  }

  function resolveImageUrl(raw, kind) {
    if (!raw || !String(raw).trim()) {
      return typeof global.PRODUCT_FALLBACK_IMAGE !== 'undefined' ? global.PRODUCT_FALLBACK_IMAGE : '/logo.png';
    }
    var url = String(raw).trim();
    if (global.AYLEN_IMAGES && global.AYLEN_IMAGES.isLocalPreviewHost && global.AYLEN_IMAGES.isLocalPreviewHost()) {
      return global.AYLEN_IMAGES.firebaseMediaUrl(url);
    }
    if (!global.AYLEN_IMAGES) return url;
    if (kind === 'thumb' && global.AYLEN_IMAGES.productThumbUrl) {
      return global.AYLEN_IMAGES.productThumbUrl(url, 96);
    }
    if (kind === 'main' && global.AYLEN_IMAGES.productDetailMainUrl) {
      return global.AYLEN_IMAGES.productDetailMainUrl(url);
    }
    if (global.AYLEN_IMAGES.productCardImageUrl) {
      return global.AYLEN_IMAGES.productCardImageUrl(url);
    }
    return url;
  }

  function directImageUrl(raw) {
    if (!raw || !String(raw).trim()) return '';
    if (global.AYLEN_IMAGES && global.AYLEN_IMAGES.firebaseMediaUrl) {
      return global.AYLEN_IMAGES.firebaseMediaUrl(String(raw).trim());
    }
    return String(raw).trim();
  }

  function imageErrorAttr() {
    return ' onerror="if(typeof aylenImageLoadFallback===\'function\'){aylenImageLoadFallback(this)}else if(typeof aylenProductImageFallback===\'function\'){aylenProductImageFallback(this)}"';
  }

  function formatMoney(n) {
    return '£' + Number(n || 0).toFixed(2);
  }

  function closeLightbox() {
    var lb = document.getElementById(LIGHTBOX_ID);
    if (lb) lb.remove();
    document.body.classList.remove('pdp-lightbox-open');
    document.body.classList.remove('vip-lightbox-open');
    unlockBodyScroll();
  }

  function renderLightbox(imgs, idx) {
    var nav = imgs.length > 1
      ? '<button type="button" class="pdp-lightbox__nav pdp-lightbox__nav--prev" data-pdp-lb-prev aria-label="Previous"><i class="fas fa-chevron-left"></i></button>' +
        '<button type="button" class="pdp-lightbox__nav pdp-lightbox__nav--next" data-pdp-lb-next aria-label="Next"><i class="fas fa-chevron-right"></i></button>' +
        '<span class="pdp-lightbox__counter">' + (idx + 1) + ' / ' + imgs.length + '</span>'
      : '';
    var mainFb = typeof global.PRODUCT_FALLBACK_IMAGE !== 'undefined' ? global.PRODUCT_FALLBACK_IMAGE : '/logo.png';
    return (
      '<div id="' + LIGHTBOX_ID + '" class="pdp-lightbox" data-pdp-lb-idx="' + idx + '" role="dialog" aria-modal="true" aria-label="Enlarged photo">' +
        '<div class="pdp-lightbox__backdrop" data-pdp-lb-close tabindex="-1" aria-hidden="true"></div>' +
        '<button type="button" class="pdp-lightbox__close" data-pdp-lb-close aria-label="Close">&times;</button>' +
        nav +
        '<div class="pdp-lightbox__img-wrap">' +
          '<img class="pdp-lightbox__img" src="' + esc(resolveImageUrl(imgs[idx], 'main')) + '" data-full="' + esc(directImageUrl(imgs[idx])) + '" data-fallback="' + esc(mainFb) + '" alt=""' + imageErrorAttr() + '>' +
        '</div>' +
      '</div>'
    );
  }

  function syncLightboxDom() {
    var lb = document.getElementById(LIGHTBOX_ID);
    if (!lb || !lbState.imgs.length) return;
    lb.setAttribute('data-pdp-lb-idx', String(lbState.idx));
    var img = lb.querySelector('.pdp-lightbox__img');
    if (img) {
      var raw = lbState.imgs[lbState.idx];
      img.src = resolveImageUrl(raw, 'main');
      img.setAttribute('data-full', directImageUrl(raw));
      img.setAttribute('data-fallback', typeof global.PRODUCT_FALLBACK_IMAGE !== 'undefined' ? global.PRODUCT_FALLBACK_IMAGE : '/logo.png');
    }
    var counter = lb.querySelector('.pdp-lightbox__counter');
    if (counter) counter.textContent = (lbState.idx + 1) + ' / ' + lbState.imgs.length;
  }

  function lightboxStep(delta) {
    if (!lbState.imgs.length) return;
    lbState.idx = (lbState.idx + delta + lbState.imgs.length) % lbState.imgs.length;
    syncLightboxDom();
  }

  function bindLightboxEvents() {
    var lb = document.getElementById(LIGHTBOX_ID);
    if (!lb) return;

    lb.querySelectorAll('[data-pdp-lb-close]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeLightbox();
      });
    });

    var prev = lb.querySelector('[data-pdp-lb-prev]');
    var next = lb.querySelector('[data-pdp-lb-next]');
    if (prev) {
      prev.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        lightboxStep(-1);
      });
    }
    if (next) {
      next.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        lightboxStep(1);
      });
    }

    if (lb._pdpLbKeyHandler) document.removeEventListener('keydown', lb._pdpLbKeyHandler);
    lb._pdpLbKeyHandler = function(e) {
      if (!document.getElementById(LIGHTBOX_ID)) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') lightboxStep(-1);
      else if (e.key === 'ArrowRight') lightboxStep(1);
    };
    document.addEventListener('keydown', lb._pdpLbKeyHandler);

    var touchStartX = 0;
    lb.addEventListener('touchstart', function(e) {
      touchStartX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0;
    }, { passive: true });
    lb.addEventListener('touchend', function(e) {
      var endX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0;
      var dx = endX - touchStartX;
      if (Math.abs(dx) < 40) return;
      lightboxStep(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function openLightbox(imgs, startIdx) {
    var list = normalizeImages(imgs);
    lbState.imgs = list;
    lbState.idx = Math.max(0, Math.min(Number(startIdx) || 0, list.length - 1));
    closeLightbox();
    document.body.insertAdjacentHTML('beforeend', renderLightbox(list, lbState.idx));
    document.body.classList.add('pdp-lightbox-open');
    lockBodyScroll();
    bindLightboxEvents();
  }

  function getGalleryState(root) {
    return galleryStates.get(root) || { imgs: [], idx: 0 };
  }

  function setGalleryIndex(root, idx, opts) {
    opts = opts || {};
    var state = getGalleryState(root);
    if (!state.imgs.length) return state.idx;
    if (state.imgs.length > 1) {
      idx = ((idx % state.imgs.length) + state.imgs.length) % state.imgs.length;
    } else {
      idx = 0;
    }
    state.idx = idx;
    galleryStates.set(root, state);

    var scroller = root.querySelector('[data-pdp-gallery-scroll]');
    if (scroller) {
      if (!opts.fromScroll) {
        scroller._pdpProgrammaticScroll = true;
        var w = getGalleryScrollerWidth(scroller) || syncGallerySlideWidths(scroller);
        if (w) {
          scroller.scrollLeft = idx * w;
        } else {
          var slide = scroller.querySelector('.pdp-modal__slide');
          if (slide) {
            w = slide.getBoundingClientRect().width || slide.offsetWidth || 1;
            scroller.scrollLeft = idx * w;
          }
        }
        setTimeout(function() {
          scroller._pdpProgrammaticScroll = false;
        }, 80);
      }
      root.querySelectorAll('[data-slide-index]').forEach(function(img) {
        var si = Number(img.getAttribute('data-slide-index')) || 0;
        if (si === idx) img.setAttribute('data-pdp-main-img', '');
        else img.removeAttribute('data-pdp-main-img');
      });
    } else {
      var main = root.querySelector('[data-pdp-main-img]');
      if (main) {
        var raw = state.imgs[state.idx];
        main.src = resolveImageUrl(raw, 'main');
        main.setAttribute('data-full', directImageUrl(raw));
        main.setAttribute('data-fallback', typeof global.PRODUCT_FALLBACK_IMAGE !== 'undefined' ? global.PRODUCT_FALLBACK_IMAGE : '/logo.png');
      }
    }

    root.querySelectorAll('[data-pdp-thumb]').forEach(function(btn) {
      var i = Number(btn.getAttribute('data-pdp-thumb')) || 0;
      btn.classList.toggle('is-active', i === state.idx);
    });

    var prevBtn = root.querySelector('[data-pdp-gallery-prev]');
    var nextBtn = root.querySelector('[data-pdp-gallery-next]');
    var multi = state.imgs.length > 1;
    if (prevBtn) prevBtn.disabled = !multi;
    if (nextBtn) nextBtn.disabled = !multi;

    if (typeof state.onIndexChange === 'function') state.onIndexChange(state.idx);
    return state.idx;
  }

  function getGalleryScrollerWidth(scroller) {
    if (!scroller) return 0;
    return scroller.clientWidth || scroller.getBoundingClientRect().width || 0;
  }

  function syncGallerySlideWidths(scroller) {
    if (!scroller) return 0;
    var w = getGalleryScrollerWidth(scroller);
    if (!w) return 0;
    scroller.querySelectorAll('.pdp-modal__slide').forEach(function(slide) {
      slide.style.flex = '0 0 ' + w + 'px';
      slide.style.width = w + 'px';
      slide.style.maxWidth = w + 'px';
    });
    return w;
  }

  function bindGalleryPointerScroll(scroller) {
    if (!scroller || scroller._pdpPointerBound) return;
    scroller._pdpPointerBound = true;
    var drag = { active: false, x: 0, left: 0, moved: false };

    scroller.addEventListener('wheel', function(e) {
      var absX = Math.abs(e.deltaX);
      var absY = Math.abs(e.deltaY);
      if (absY >= absX && absY > 2) {
        e.preventDefault();
        scroller.scrollLeft += e.deltaY;
      } else if (absX > 2) {
        e.preventDefault();
        scroller.scrollLeft += e.deltaX;
      }
    }, { passive: false });

    scroller.addEventListener('pointerdown', function(e) {
      if (e.pointerType === 'touch') return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('.pdp-modal__nav')) return;
      drag.active = true;
      drag.moved = false;
      drag.x = e.clientX;
      drag.left = scroller.scrollLeft;
      scroller.classList.add('is-dragging');
      if (scroller.setPointerCapture) scroller.setPointerCapture(e.pointerId);
    });

    scroller.addEventListener('pointermove', function(e) {
      if (!drag.active) return;
      var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      scroller.scrollLeft = drag.left - dx;
    });

    function endPointer(e) {
      if (!drag.active) return;
      drag.active = false;
      scroller.classList.remove('is-dragging');
      if (drag.moved) scroller._pdpSuppressClickUntil = Date.now() + 280;
      if (scroller.releasePointerCapture) {
        try { scroller.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
    }

    scroller.addEventListener('pointerup', endPointer);
    scroller.addEventListener('pointercancel', endPointer);

    scroller.addEventListener('click', function(e) {
      if (scroller._pdpSuppressClickUntil && Date.now() < scroller._pdpSuppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  function bindGallery(root, imgs, opts) {
    if (!root) return;
    opts = opts || {};
    var list = normalizeImages(imgs);
    var state = {
      imgs: list,
      idx: Math.max(0, Math.min(Number(opts.startIndex) || 0, list.length - 1)),
      onIndexChange: opts.onIndexChange || null
    };
    galleryStates.set(root, state);
    setGalleryIndex(root, state.idx);

    root.querySelectorAll('[data-pdp-thumb]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setGalleryIndex(root, Number(btn.getAttribute('data-pdp-thumb')) || 0);
      });
    });

    var prevBtn = root.querySelector('[data-pdp-gallery-prev]');
    var nextBtn = root.querySelector('[data-pdp-gallery-next]');
    if (prevBtn) {
      prevBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var s = getGalleryState(root);
        setGalleryIndex(root, s.idx - 1 + s.imgs.length);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var s = getGalleryState(root);
        setGalleryIndex(root, s.idx + 1);
      });
    }

    root.querySelectorAll('[data-pdp-lightbox-open]').forEach(function(openBtn) {
      openBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var s = getGalleryState(root);
        openLightbox(s.imgs, s.idx);
      });
    });

    var scroller = root.querySelector('[data-pdp-gallery-scroll]');
    if (scroller) {
      if (!scroller._pdpProgrammaticScroll) scroller._pdpProgrammaticScroll = false;
      if (!scroller._pdpSlideResizeObs) {
        scroller._pdpSlideResizeObs = new ResizeObserver(function() {
          var w = syncGallerySlideWidths(scroller);
          if (!w) return;
          var s = getGalleryState(root);
          scroller._pdpProgrammaticScroll = true;
          scroller.scrollLeft = s.idx * w;
          setTimeout(function() {
            scroller._pdpProgrammaticScroll = false;
          }, 80);
        });
        scroller._pdpSlideResizeObs.observe(scroller);
      }
      var syncTimer;
      scroller.addEventListener('scroll', function() {
        if (scroller._pdpProgrammaticScroll) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(function() {
          var w = getGalleryScrollerWidth(scroller) || syncGallerySlideWidths(scroller);
          if (!w) return;
          var newIdx = Math.round(scroller.scrollLeft / w);
          var s = getGalleryState(root);
          newIdx = Math.max(0, Math.min(newIdx, s.imgs.length - 1));
          if (newIdx !== s.idx) setGalleryIndex(root, newIdx, { fromScroll: true });
        }, 48);
      }, { passive: true });
      bindGalleryPointerScroll(scroller);
      root.addEventListener('wheel', function(e) {
        if (scroller.contains(e.target)) return;
        var absX = Math.abs(e.deltaX);
        var absY = Math.abs(e.deltaY);
        if (absY < 2 && absX < 2) return;
        e.preventDefault();
        scroller.scrollLeft += absY >= absX ? e.deltaY : e.deltaX;
      }, { passive: false });
      var modal = root.closest('.pdp-modal');
      if (modal && !modal._pdpGalleryKeysBound) {
        modal._pdpGalleryKeysBound = true;
        modal._pdpGalleryKeyHandler = function(e) {
          if (document.getElementById(LIGHTBOX_ID)) return;
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          var s = getGalleryState(root);
          if (e.key === 'ArrowLeft') setGalleryIndex(root, s.idx - 1);
          else setGalleryIndex(root, s.idx + 1);
        };
        document.addEventListener('keydown', modal._pdpGalleryKeyHandler);
      }
      requestAnimationFrame(function() {
        syncGallerySlideWidths(scroller);
        setGalleryIndex(root, state.idx);
        scroller.focus({ preventScroll: true });
      });
      return;
    }

    var touchStartX = 0;
    root.addEventListener('touchstart', function(e) {
      if (e.target.closest('[data-pdp-thumb], [data-pdp-gallery-prev], [data-pdp-gallery-next]')) return;
      touchStartX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0;
    }, { passive: true });
    root.addEventListener('touchend', function(e) {
      if (e.target.closest('[data-pdp-thumb], [data-pdp-gallery-prev], [data-pdp-gallery-next], [data-pdp-lightbox-open]')) return;
      var endX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0;
      var dx = endX - touchStartX;
      if (Math.abs(dx) < 36) return;
      var s = getGalleryState(root);
      setGalleryIndex(root, s.idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  function thumbImgAttrs(rawUrl) {
    var thumb = resolveImageUrl(rawUrl, 'thumb');
    var full = directImageUrl(rawUrl);
    var fb = typeof global.PRODUCT_FALLBACK_IMAGE !== 'undefined' ? global.PRODUCT_FALLBACK_IMAGE : '/logo.png';
    return ' src="' + esc(thumb) + '" data-full="' + esc(full) + '" data-fallback="' + esc(fb) + '" alt="" loading="lazy" decoding="async"' + imageErrorAttr();
  }

  function renderGalleryHtml(imgs, opts) {
    opts = opts || {};
    var list = normalizeImages(imgs);
    var idx = Math.max(0, Math.min(Number(opts.startIndex) || 0, list.length - 1));
    var main = resolveImageUrl(list[idx], 'main');
    var mainDirect = directImageUrl(list[idx]);
    var mainFb = typeof global.PRODUCT_FALLBACK_IMAGE !== 'undefined' ? global.PRODUCT_FALLBACK_IMAGE : '/logo.png';
    var multi = list.length > 1;
    var nav = multi
      ? '<button type="button" class="pdp-modal__nav pdp-modal__nav--prev" data-pdp-gallery-prev aria-label="Previous photo"><i class="fas fa-chevron-left"></i></button>' +
        '<button type="button" class="pdp-modal__nav pdp-modal__nav--next" data-pdp-gallery-next aria-label="Next photo"><i class="fas fa-chevron-right"></i></button>'
      : '';
    var thumbs = multi
      ? '<div class="pdp-modal__thumbs">' + list.map(function(url, i) {
          return '<button type="button" class="pdp-modal__thumb' + (i === idx ? ' is-active' : '') + '" data-pdp-thumb="' + i + '" aria-label="Photo ' + (i + 1) + '">' +
            '<img' + thumbImgAttrs(url) + '>' +
          '</button>';
        }).join('') + '</div>'
      : '';
    if (multi) {
      var slides = list.map(function(url, i) {
        var slideMain = resolveImageUrl(url, 'main');
        var slideDirect = directImageUrl(url);
        return (
          '<div class="pdp-modal__slide">' +
            '<button type="button" class="pdp-modal__main-btn" data-pdp-lightbox-open aria-label="Enlarge photo ' + (i + 1) + '">' +
              '<img class="pdp-modal__main-img"' + (i === idx ? ' data-pdp-main-img' : '') + ' data-slide-index="' + i + '" src="' + esc(slideMain) + '" data-full="' + esc(slideDirect) + '" data-fallback="' + esc(mainFb) + '" alt=""' + imageErrorAttr() + '>' +
            '</button>' +
          '</div>'
        );
      }).join('');
      return (
        '<div class="pdp-modal__main-wrap">' +
          nav +
          '<div class="pdp-modal__scroll" data-pdp-gallery-scroll tabindex="0" aria-label="Swipe photos">' +
            '<div class="pdp-modal__scroll-track">' + slides + '</div>' +
          '</div>' +
          '<span class="pdp-modal__zoom-hint"><i class="fas fa-search-plus"></i> Tap to enlarge</span>' +
        '</div>' +
        thumbs
      );
    }
    return (
      '<div class="pdp-modal__main-wrap">' +
        nav +
        '<button type="button" class="pdp-modal__main-btn" data-pdp-lightbox-open aria-label="Enlarge photo">' +
          '<img class="pdp-modal__main-img" data-pdp-main-img src="' + esc(main) + '" data-full="' + esc(mainDirect) + '" data-fallback="' + esc(mainFb) + '" alt=""' + imageErrorAttr() + '>' +
          '<span class="pdp-modal__zoom-hint"><i class="fas fa-search-plus"></i> Tap to enlarge</span>' +
        '</button>' +
      '</div>' +
      thumbs
    );
  }

  var activeModalId = null;
  var scrollLockY = 0;

  function lockBodyScroll() {
    if (document.body.classList.contains('pdp-scroll-locked')) return;
    scrollLockY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.classList.add('pdp-scroll-locked', 'modal-locked', 'storefront-modal-open');
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollLockY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';
  }

  function unlockBodyScroll() {
    if (!document.body.classList.contains('pdp-scroll-locked')) return;
    if (document.querySelector('.pdp-modal') || document.getElementById(LIGHTBOX_ID)) return;
    document.body.classList.remove('pdp-scroll-locked', 'modal-locked', 'storefront-modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.documentElement.style.overflow = '';
    window.scrollTo(0, scrollLockY || 0);
  }

  function closeModal(modalId) {
    var modals = [];
    if (modalId) {
      var one = document.getElementById(modalId);
      if (one) modals.push(one);
    } else {
      modals = Array.prototype.slice.call(document.querySelectorAll('.pdp-modal'));
      if (!modals.length && activeModalId) {
        var active = document.getElementById(activeModalId);
        if (active) modals.push(active);
      }
      if (!modals.length) {
        var fallback = document.getElementById(MODAL_ID);
        if (fallback) modals.push(fallback);
      }
    }
    modals.forEach(function(modal) {
      if (modal._pdpEscHandler) {
        document.removeEventListener('keydown', modal._pdpEscHandler);
      }
      if (modal._pdpGalleryKeyHandler) {
        document.removeEventListener('keydown', modal._pdpGalleryKeyHandler);
      }
      modal.remove();
    });
    activeModalId = null;
    closeLightbox();
    document.body.classList.remove('pdp-modal-open');
    document.body.classList.remove('vip-rm-modal-open');
    unlockBodyScroll();
  }

  function openModal(opts) {
    closeModal();
    opts = opts || {};
    var theme = opts.theme === 'vip' ? 'vip' : 'storefront';
    var modalClass = opts.modalClass ? ' ' + esc(opts.modalClass) : '';
    var panelClass = opts.panelClass ? ' ' + esc(opts.panelClass) : '';
    var layoutClass = theme === 'vip' ? ' pdp-modal__layout vip-pdp-layout' : ' pdp-modal__layout';
    var galleryClass = theme === 'vip' ? ' pdp-modal__gallery vip-pdp-gallery' : ' pdp-modal__gallery';
    var infoClass = theme === 'vip' ? ' pdp-modal__info vip-pdp-info' : ' pdp-modal__info';
    var id = opts.id || MODAL_ID;
    var html = (
      '<div id="' + esc(id) + '" class="pdp-modal pdp-modal--' + theme + modalClass + '" aria-hidden="false">' +
        '<div class="pdp-modal__backdrop" data-pdp-modal-close tabindex="-1" aria-hidden="true"></div>' +
        '<div class="pdp-modal__panel' + panelClass + '" role="dialog" aria-labelledby="pdpModalTitle">' +
          '<button type="button" class="pdp-modal__close" data-pdp-modal-close aria-label="Close">&times;</button>' +
          '<div class="' + layoutClass.trim() + '">' +
            '<div class="' + galleryClass.trim() + '" data-pdp-gallery-root>' +
              (opts.galleryHtml || renderGalleryHtml(opts.imgs, { startIndex: opts.startIndex })) +
            '</div>' +
            '<div class="' + infoClass.trim() + '">' +
              (opts.infoHtml || '') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    document.body.insertAdjacentHTML('beforeend', html);
    document.body.classList.add('pdp-modal-open');
    if (theme === 'vip') document.body.classList.add('vip-rm-modal-open');
    lockBodyScroll();

    var modal = document.getElementById(id);
    if (!modal) return null;
    activeModalId = id;

    modal.querySelectorAll('[data-pdp-modal-close]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeModal(id);
        if (typeof opts.onClose === 'function') opts.onClose();
      });
    });

    modal._pdpEscHandler = function(e) {
      if (e.key !== 'Escape') return;
      if (document.getElementById(LIGHTBOX_ID)) {
        closeLightbox();
        return;
      }
      if (document.getElementById(id)) {
        closeModal(id);
        if (typeof opts.onClose === 'function') opts.onClose();
      }
    };
    document.addEventListener('keydown', modal._pdpEscHandler);

    var galleryRoot = modal.querySelector('[data-pdp-gallery-root]');
    if (galleryRoot && !opts.galleryHtml) {
      bindGallery(galleryRoot, opts.imgs, { startIndex: opts.startIndex, onIndexChange: opts.onIndexChange });
    }

    if (typeof opts.onOpen === 'function') opts.onOpen(modal);
    return modal;
  }

  function productViewCount(p) {
    if (typeof global.getDisplayViewCount === 'function') return global.getDisplayViewCount(p.id);
    return Number(p && p.viewCount || 0);
  }

  function productDisplayPrice(p) {
    var retail = parseFloat(p.price || p.retail || 0);
    var hasDiscount = p.discount && p.discount > 0;
    var sale = hasDiscount ? parseFloat(p.salePrice || retail) : retail;
    return { retail: retail, sale: sale, hasDiscount: hasDiscount };
  }

  function buildProductWhatsAppUrl(p, price) {
    var settings = typeof global.safeMarketplaceSettings === 'function'
      ? global.safeMarketplaceSettings()
      : { whatsappUrl: 'https://wa.me/447471647771' };
    var base = typeof global.resolveWhatsAppUrl === 'function'
      ? global.resolveWhatsAppUrl(settings.whatsappUrl)
      : String(settings.whatsappUrl || 'https://wa.me/447471647771');
    var msg = 'Hi AYLENSALE! I would like to buy: ' + String(p.name || 'product') +
      (price != null ? ' (' + formatMoney(price) + ')' : '') + '. Please confirm availability. Thank you!';
    if (base.indexOf('text=') !== -1) {
      return base.split('text=')[0] + 'text=' + encodeURIComponent(msg);
    }
    var root = base.split('?')[0];
    return root + '?text=' + encodeURIComponent(msg);
  }

  function buildProductTelegramUrl(p, price) {
    var settings = typeof global.safeMarketplaceSettings === 'function'
      ? global.safeMarketplaceSettings()
      : { telegramUrl: 'https://t.me/aylensale' };
    var tg = String(settings.telegramUrl || 'https://t.me/aylensale').trim();
    var msg = 'Hi AYLENSALE! I would like to buy: ' + String(p.name || 'product') +
      (price != null ? ' (' + formatMoney(price) + ')' : '') + '. Please confirm availability.';
    var userMatch = tg.match(/^https:\/\/t\.me\/([a-z0-9_]{3,64})\/?$/i);
    if (userMatch) {
      return 'https://t.me/' + userMatch[1] + '?text=' + encodeURIComponent(msg);
    }
    return 'https://t.me/share/url?url=' + encodeURIComponent(global.location ? global.location.origin + '/' : 'https://aylensale.com/') +
      '&text=' + encodeURIComponent(msg);
  }

  function formatViewCount(count) {
    var n = Number(count || 0);
    return n + ' ' + (n === 1 ? 'view' : 'views');
  }

  function openStorefrontProduct(product) {
    if (!product) return null;
    var imgs = product.images && product.images.length ? product.images : (product.imageUrl ? [product.imageUrl] : []);
    var pricing = productDisplayPrice(product);
    var views = formatViewCount(productViewCount(product));
    var stock = parseInt(product.stock, 10) || 0;
    var desc = String(product.description || product.desc || '').trim();
    var category = String(product.category || 'General').trim();
    var isComingSoon = product.status === 'coming_soon' || product.stockStatus === 'coming_soon';
    var canBuy = !isComingSoon && stock > 0;

    var priceHtml = pricing.hasDiscount
      ? formatMoney(pricing.sale) + '<span class="pdp-modal__price-original">' + formatMoney(pricing.retail) + '</span>'
      : formatMoney(pricing.sale);

    var actions = '';
    if (canBuy) {
      actions += '<a class="pdp-modal__btn pdp-modal__btn--wa" href="' + esc(buildProductWhatsAppUrl(product, pricing.sale)) + '" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Buy on WhatsApp</a>';
      actions += '<a class="pdp-modal__btn pdp-modal__btn--tg" href="' + esc(buildProductTelegramUrl(product, pricing.sale)) + '" target="_blank" rel="noopener noreferrer"><i class="fab fa-telegram"></i> Buy on Telegram</a>';
      actions += '<button type="button" class="pdp-modal__btn pdp-modal__btn--cart" data-pdp-add-cart="' + esc(String(product.id)) + '"><i class="fas fa-cart-plus"></i> Add to Cart</button>';
    } else if (isComingSoon) {
      actions += '<button type="button" class="pdp-modal__btn pdp-modal__btn--ghost" data-pdp-notify="' + esc(String(product.id)) + '"><i class="fas fa-bell"></i> Reserve — notify me</button>';
    } else {
      actions += '<p class="pdp-modal__meta"><i class="fas fa-box-open"></i> Out of stock — message us to check restock.</p>';
      actions += '<a class="pdp-modal__btn pdp-modal__btn--wa" href="' + esc(buildProductWhatsAppUrl(product, pricing.sale)) + '" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> WhatsApp inquiry</a>';
      actions += '<a class="pdp-modal__btn pdp-modal__btn--tg" href="' + esc(buildProductTelegramUrl(product, pricing.sale)) + '" target="_blank" rel="noopener noreferrer"><i class="fab fa-telegram"></i> Telegram inquiry</a>';
    }

    var policyId = String(product.policyId || product.listingPolicyId || '').trim();
    var policyLink = policyId
      ? '<p class="pdp-modal__policy-link"><button type="button" data-pdp-policy="' + esc(String(product.id)) + '"><i class="fas fa-file-lines"></i> Condition &amp; Policy</button></p>'
      : '';

    var infoHtml =
      '<h3 id="pdpModalTitle">' + esc(product.name || 'Product') + '</h3>' +
      '<p class="pdp-modal__meta">' + esc(category) +
        ' · Stock: <b>' + esc(stock) + '</b>' +
        ' · ' + esc(views) + '</p>' +
      '<p class="pdp-modal__price">' + priceHtml + '</p>' +
      (desc ? '<div class="pdp-modal__desc">' + esc(desc).replace(/\n/g, '<br>') + '</div>' : '') +
      '<div class="pdp-modal__actions">' + actions + '</div>' +
      policyLink;

    var modal = openModal({
      theme: 'storefront',
      imgs: imgs,
      infoHtml: infoHtml,
      onOpen: function(root) {
        if (typeof global.trackProductView === 'function') global.trackProductView(product.id);
        var cartBtn = root.querySelector('[data-pdp-add-cart]');
        if (cartBtn) {
          cartBtn.addEventListener('click', function() {
            if (typeof global.addToCart === 'function') global.addToCart(product.id);
          });
        }
        var notifyBtn = root.querySelector('[data-pdp-notify]');
        if (notifyBtn) {
          notifyBtn.addEventListener('click', function() {
            if (typeof global.requestNotify === 'function') global.requestNotify(product.id, 'email');
          });
        }
        var policyBtn = root.querySelector('[data-pdp-policy]');
        if (policyBtn) {
          policyBtn.addEventListener('click', function() {
            if (typeof global.openProductCardDetailsModal === 'function') {
              global.openProductCardDetailsModal(product.id);
            }
          });
        }
      }
    });
    return modal;
  }

  global.AYLEN_PDP = {
    openModal: openModal,
    closeModal: closeModal,
    openLightbox: openLightbox,
    closeLightbox: closeLightbox,
    bindGallery: bindGallery,
    renderGalleryHtml: renderGalleryHtml,
    openStorefrontProduct: openStorefrontProduct,
    normalizeImages: normalizeImages,
    resolveImageUrl: resolveImageUrl,
    getGalleryIndex: function(root) {
      return getGalleryState(root).idx;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
