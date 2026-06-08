/**
 * Mobile storefront UX — compact header, contact collapse, section nav, hash scroll.
 */
(function(global) {
  var SCROLL_COMPACT = 56;
  var SCROLL_CONTACT_COLLAPSE = 72;
  var scrollScheduled = false;
  var navLockUntil = 0;
  var navPendingHash = null;

  function qs(sel) { return document.querySelector(sel); }

  function lockSectionNav(ms) {
    navLockUntil = Date.now() + (ms || 800);
  }

  function scrollToStoreSection(hash, opts) {
    opts = opts || {};
    var id = String(hash || '').replace(/^#/, '').trim();
    if (!id) return false;
    var el = document.getElementById(id);
    if (!el) return false;
    var header = qs('.site-header');
    var offset = (header ? header.offsetHeight : 64) + 8;
    var top = el.getBoundingClientRect().top + (window.scrollY || 0) - offset;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: opts.instant ? 'auto' : 'smooth'
    });
    return true;
  }

  global.scrollToStoreSection = scrollToStoreSection;

  function navigationEntryType() {
    try {
      var nav = performance.getEntriesByType('navigation')[0];
      return nav && nav.type ? nav.type : 'navigate';
    } catch (e) {
      return 'navigate';
    }
  }

  function isFreshPageLoad() {
    var type = navigationEntryType();
    return type === 'reload' || type === 'navigate';
  }

  function normalizeHash(hash) {
    var h = String(hash || '').trim();
    if (!h || h === '#') return '#products';
    if (h.charAt(0) !== '#') h = '#' + h;
    return h;
  }

  function replaceSectionHash(hash) {
    hash = normalizeHash(hash);
    var path = global.location.pathname + global.location.search + hash;
    if (global.history && global.history.replaceState) {
      global.history.replaceState(null, '', path);
    } else {
      global.location.hash = hash.replace('#', '');
    }
  }

  function initCompactHeader() {
    var header = qs('.site-header');
    if (!header) return;
    function apply() {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      header.classList.toggle('site-header--compact', y > SCROLL_COMPACT);
    }
    window.addEventListener('scroll', scheduleScroll, { passive: true });
    apply();
  }

  function setContactOpen(root, fab, open) {
    if (!root || !fab) return;
    if (document.body.classList.contains('hero-contact-via-hub')) {
      if (global.__aylenMessageFold && global.__aylenMessageFold.setExpanded) {
        global.__aylenMessageFold.setExpanded(!!open, true);
      }
      return;
    }
    root.classList.toggle('contact-float--open', !!open);
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    var backdrop = qs('#contactFloatBackdrop');
    if (backdrop) {
      backdrop.classList.toggle('contact-float-backdrop--visible', !!open);
      backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
  }

  function initContactFloat() {
    var root = qs('#contactFloat');
    var fab = qs('#contactFloatFab');
    var backdrop = qs('#contactFloatBackdrop');
    if (!root || !fab) return;

    function applyScroll() {
      var y = window.scrollY || 0;
      root.classList.toggle('contact-float--scrolled', y > SCROLL_CONTACT_COLLAPSE);
    }

    fab.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      setContactOpen(root, fab, !root.classList.contains('contact-float--open'));
    });

    if (backdrop) {
      backdrop.addEventListener('click', function() {
        if (document.body.classList.contains('hero-contact-via-hub')) {
          if (global.__aylenMessageFold && global.__aylenMessageFold.setExpanded) {
            global.__aylenMessageFold.setExpanded(false, true);
          }
          return;
        }
        setContactOpen(root, fab, false);
      });
    }

    document.addEventListener('click', function(e) {
      if (document.body.classList.contains('hero-contact-via-hub')) return;
      if (!root.contains(e.target) && e.target !== backdrop) {
        setContactOpen(root, fab, false);
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;
      if (document.body.classList.contains('hero-contact-via-hub')) {
        if (global.__aylenMessageFold && global.__aylenMessageFold.setExpanded) {
          global.__aylenMessageFold.setExpanded(false, true);
        }
        return;
      }
      setContactOpen(root, fab, false);
    });

    window.addEventListener('scroll', function() {
      scheduleScroll();
      applyScroll();
    }, { passive: true });
    applyScroll();
  }

  function initCustomerLogin() {
    var box = qs('#customerLoginBox');
    if (!box) return;
    box.classList.remove('is-open');
  }

  function initSectionNav() {
    var headerLinks = document.querySelectorAll('.site-header .nav-link[href^="#"]');
    var bottomLinks = document.querySelectorAll('.bottom-nav a[href^="#"]');
    var heroLinks = document.querySelectorAll('.hero-actions a[href^="#"]');
    var footerLinks = document.querySelectorAll('.site-footer a[href^="#"], footer a[href^="#"]');
    var sections = [
      { id: 'products', el: qs('#products') },
      { id: 'auctions', el: qs('#auctions') },
      { id: 'pickup', el: qs('#pickup') }
    ].filter(function(s) { return s.el; });

    function setActive(hash) {
      hash = normalizeHash(hash);
      headerLinks.forEach(function(item) {
        item.classList.toggle('active', item.getAttribute('href') === hash);
      });
      bottomLinks.forEach(function(item) {
        item.classList.toggle('is-active', item.getAttribute('href') === hash);
      });
      document.body.setAttribute('data-active-section', hash.replace('#', ''));
    }

    function navigateToHash(hash, opts) {
      hash = normalizeHash(hash);
      lockSectionNav((opts && opts.lockMs) || 1000);
      setActive(hash);
      replaceSectionHash(hash);
      if (!scrollToStoreSection(hash, { instant: !!(opts && opts.instant) })) {
        navPendingHash = hash;
      } else {
        navPendingHash = null;
      }
    }

    function bindNavClick(item) {
      item.addEventListener('click', function(e) {
        var href = item.getAttribute('href');
        if (!href || href.indexOf('#') !== 0) return;
        e.preventDefault();
        navigateToHash(href);
      });
    }

    headerLinks.forEach(bindNavClick);
    bottomLinks.forEach(bindNavClick);
    heroLinks.forEach(bindNavClick);
    footerLinks.forEach(bindNavClick);

    function updateActiveFromScroll() {
      if (Date.now() < navLockUntil) return;
      var probe = (window.scrollY || 0) + (window.innerHeight * 0.32);
      var current = '#products';
      sections.forEach(function(s) {
        if (s.el.offsetTop <= probe) current = '#' + s.id;
      });
      setActive(current);
    }

    if ('IntersectionObserver' in global) {
      var observer = new IntersectionObserver(function(entries) {
        if (Date.now() < navLockUntil) return;
        var best = null;
        entries.forEach(function(entry) {
          if (!entry.isIntersecting) return;
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        });
        if (best && best.target && best.target.id) {
          setActive('#' + best.target.id);
        }
      }, {
        root: null,
        threshold: [0.15, 0.35, 0.55],
        rootMargin: '-20% 0px -55% 0px'
      });
      sections.forEach(function(s) { observer.observe(s.el); });
    }

    window.addEventListener('scroll', function() {
      scheduleScroll();
      updateActiveFromScroll();
    }, { passive: true });

    window.addEventListener('hashchange', function() {
      var hash = normalizeHash(global.location.hash);
      lockSectionNav(900);
      setActive(hash);
      scrollToStoreSection(hash);
    });

    function applyInitialHash() {
      if ('scrollRestoration' in global.history) {
        global.history.scrollRestoration = 'manual';
      }

      if (isFreshPageLoad()) {
        lockSectionNav(500);
        setActive('#products');
        replaceSectionHash('#products');
        navPendingHash = null;
        requestAnimationFrame(function() {
          global.scrollTo(0, 0);
        });
        return;
      }

      var hash = normalizeHash(global.location.hash);
      if (hash === '#products') {
        setActive(hash);
        return;
      }

      lockSectionNav(900);
      setActive(hash);
      requestAnimationFrame(function() {
        scrollToStoreSection(hash, { instant: true });
      });
    }

    applyInitialHash();
    document.addEventListener('aylen-catalog-ready', function() {
      if (navPendingHash) {
        lockSectionNav(800);
        scrollToStoreSection(navPendingHash, { instant: true });
        navPendingHash = null;
        return;
      }
      if (Date.now() < navLockUntil) {
        var hash = normalizeHash(global.location.hash);
        if (hash !== '#products') scrollToStoreSection(hash, { instant: true });
      }
    });
  }

  function scheduleScroll() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(function() {
      scrollScheduled = false;
    });
  }

  function markAdminBodyClass() {
    function sync() {
      var firebaseAdmin = !!(global.FBDB && global.FBDB.isAdmin && global.FBDB.isAdmin());
      document.body.classList.toggle('admin-mode-active', !!(global.isAdminMode));
      document.body.classList.toggle('firebase-admin-authed', firebaseAdmin);
      if (typeof renderLocations === 'function') renderLocations();
    }
    sync();
    window.addEventListener('aylen-admin-mode', sync);
    window.addEventListener('aylen-firebase-admin', sync);
  }

  document.addEventListener('DOMContentLoaded', function() {
    initCompactHeader();
    initContactFloat();
    initCustomerLogin();
    initSectionNav();
    markAdminBodyClass();
  });
})(window);
