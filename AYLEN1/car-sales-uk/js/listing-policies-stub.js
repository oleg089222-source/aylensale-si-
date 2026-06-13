/**
 * Minimal listing policy helpers for catalog bootstrap (full module loads with interaction bundle).
 */
(function(global) {
  if (global.AYLEN_LISTING_POLICIES && global.AYLEN_LISTING_POLICIES.renderSummary) return;

  function normalizeListingPolicy(docId, raw) {
    var item = raw || {};
    return {
      id: String(docId || item.id || ''),
      title: String(item.title || 'Listing policy').trim(),
      body: String(item.body || item.text || '').trim(),
      ukDisclaimer: String(item.ukDisclaimer || '').trim()
    };
  }

  global.AYLEN_LISTING_POLICIES = {
    defaults: [],
    normalize: normalizeListingPolicy,
    getById: function() { return null; },
    optionsHtml: function() { return '<option value="">— Select listing policy —</option>'; },
    renderSummary: function() { return ''; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
