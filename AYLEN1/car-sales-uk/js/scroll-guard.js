/**
 * Prevent stuck scroll lock after admin CMS / modals (body position:fixed or overflow:hidden left on).
 */
(function(global) {
  function isCmsOpen() {
    var shell = document.getElementById('aylenAdminShell');
    return !!(shell && shell.classList.contains('open'));
  }

  function isDynamicModalOpen() {
    var root = document.getElementById('aylen-modal-root');
    return !!(root && root.classList.contains('open'));
  }

  function isStaticModalOpen() {
    var modals = document.querySelectorAll('.modal.open, .modal[style*="display: flex"], .modal[style*="display:flex"]');
    for (var i = 0; i < modals.length; i++) {
      var id = modals[i].id;
      if (id && id !== 'aylen-modal-root') return true;
    }
    return false;
  }

  function isPwaGuideOpen() {
    var ios = document.querySelector('.pwa-ios-root.is-open');
    return !!ios;
  }

  function isAdminAuthOverlayVisible() {
    var el = document.getElementById('adminAuthOverlay');
    return !!(el && el.classList.contains('is-visible'));
  }

  function isPdpModalOpen() {
    return document.body.classList.contains('pdp-modal-open') ||
      document.body.classList.contains('pdp-lightbox-open') ||
      document.body.classList.contains('pdp-scroll-locked') ||
      !!document.querySelector('.pdp-modal');
  }

  function isAuctionHubOpen() {
    var root = document.getElementById('auctionHubRoot');
    return !!(root && !root.classList.contains('is-hidden'));
  }

  function isAnyModalOpen() {
    return isDynamicModalOpen() || isStaticModalOpen() || isPwaGuideOpen() || isPdpModalOpen() ||
      isAuctionHubOpen();
  }

  function clearInlineScrollLock() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.overflowY = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.overflowY = '';
  }

  function releaseStorefrontScroll() {
    var cmsOpen = isCmsOpen();
    var modalOpen = isAnyModalOpen();
    var authBusy = document.documentElement.classList.contains('admin-auth-busy');

    if (!cmsOpen) {
      document.documentElement.classList.remove('aylen-admin-cms-active');
      document.body.classList.remove(
        'aylen-admin-cms-active',
        'admin-dashboard-open',
        'admin-modal-open'
      );
    }

    if (!isAdminAuthOverlayVisible() && !cmsOpen) {
      document.documentElement.classList.remove('admin-auth-busy');
      authBusy = false;
    }

    if (!cmsOpen && !modalOpen && !isPdpModalOpen()) {
      document.body.classList.remove('modal-locked', 'storefront-modal-open');
      clearInlineScrollLock();
    }

    if (!cmsOpen && !modalOpen && !authBusy && !isPdpModalOpen()) {
      if (document.documentElement.style.overflowY) {
        document.documentElement.style.overflowY = '';
      }
      if (document.body.style.overflowY) {
        document.body.style.overflowY = '';
      }
    }
  }

  function boot() {
    releaseStorefrontScroll();
  }

  global.AYLEN_SCROLL = {
    release: releaseStorefrontScroll,
    isCmsOpen: isCmsOpen,
    isAnyModalOpen: isAnyModalOpen
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.addEventListener('load', boot);

  global.addEventListener('pageshow', function(ev) {
    if (ev.persisted) boot();
  });

  global.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') boot();
  });

  global.addEventListener('touchstart', function() {
    if (!isAnyModalOpen() && !isCmsOpen()) boot();
  }, { passive: true, once: false });

  var shell = document.getElementById('aylenAdminShell');
  if (shell && global.MutationObserver) {
    new global.MutationObserver(function() {
      if (!isCmsOpen()) releaseStorefrontScroll();
    }).observe(shell, { attributes: true, attributeFilter: ['class'] });
  }
})(typeof window !== 'undefined' ? window : global);
