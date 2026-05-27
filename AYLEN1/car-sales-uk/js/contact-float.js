/**
 * Message button — open Telegram / WhatsApp menu (baseline navw7lu9k UI).
 */
(function() {
  function qs(sel) { return document.querySelector(sel); }

  function setOpen(root, fab, open) {
    if (!root || !fab) return;
    root.classList.toggle('contact-float--open', !!open);
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    var backdrop = qs('#contactFloatBackdrop');
    if (backdrop) {
      backdrop.classList.toggle('contact-float-backdrop--visible', !!open);
      backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
  }

  function init() {
    var root = qs('#contactFloat');
    var fab = qs('#contactFloatFab');
    var backdrop = qs('#contactFloatBackdrop');
    if (!root || !fab) return;

    fab.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(root, fab, !root.classList.contains('contact-float--open'));
    });

    if (backdrop) {
      backdrop.addEventListener('click', function() {
        setOpen(root, fab, false);
      });
    }

    document.addEventListener('click', function(e) {
      if (!root.contains(e.target) && e.target !== backdrop) {
        setOpen(root, fab, false);
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') setOpen(root, fab, false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
