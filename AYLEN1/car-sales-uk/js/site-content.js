/**
 * Applies published Legal & Contact settings to the live site.
 */
(function(global) {
  var PREVIEW_KEY = 'aylen_legal_preview';

  function defaultsApi() {
    return global.SITE_LEGAL_DEFAULTS || {};
  }

  function getDefaults() {
    return defaultsApi().getDefaultLegalContactContent
      ? defaultsApi().getDefaultLegalContactContent()
      : {};
  }

  function mergePublished(raw) {
    var base = getDefaults();
    if (defaultsApi().deepMergeLegalContact) {
      return defaultsApi().deepMergeLegalContact(base, raw || {});
    }
    return Object.assign({}, base, raw || {});
  }

  function getPublishedFromStore() {
    var doc = (typeof siteSettings !== 'undefined' && siteSettings.legalContact) || {};
    return mergePublished(doc.published || {});
  }

  function setText(id, text, asHtml) {
    var el = document.getElementById(id);
    if (!el || text === undefined || text === null) return;
    if (asHtml) el.innerHTML = String(text);
    else el.textContent = String(text);
  }

  function setLink(id, href, label) {
    var el = document.getElementById(id);
    if (!el) return;
    if (href) el.href = href;
    if (label) el.textContent = label;
  }

  function applyToSiteConfig(content) {
    var cfg = global.AYLEN_SITE;
    if (!cfg) return;
    if (content.contact) {
      if (content.contact.contactEmail) cfg.contactEmail = content.contact.contactEmail;
      if (content.contact.supportEmail) cfg.supportEmail = content.contact.supportEmail;
      if (content.contact.phone !== undefined) cfg.phone = content.contact.phone;
    }
    if (content.business) {
      if (content.business.legalName) cfg.legalName = content.business.legalName;
      if (content.business.companyNumber !== undefined) cfg.companyNumber = content.business.companyNumber;
      if (content.business.vatNumber !== undefined) cfg.vatNumber = content.business.vatNumber;
      if (content.business.businessEmail) cfg.contactEmail = content.business.businessEmail;
      if (content.business.registeredAddress) {
        cfg.address = cfg.address || {};
        cfg.address.line1 = content.business.registeredAddress;
      }
    }
  }

  function syncMarketplaceLinks(content) {
    if (!content.contact || typeof siteSettings === 'undefined') return;
    siteSettings.marketplace = siteSettings.marketplace || {};
    if (content.contact.telegramUrl) siteSettings.marketplace.telegramUrl = content.contact.telegramUrl;
    if (content.contact.whatsappUrl) siteSettings.marketplace.whatsappUrl = content.contact.whatsappUrl;
  }

  function applyFooter(content) {
    var footer = content.footer || {};
    var contact = content.contact || {};
    var business = content.business || {};

    setText('footerBrandDesc', footer.brandDescription, false);
    setText('footerConsumerRights', footer.consumerRightsHtml, true);
    if (footer.returnsText) {
      setText('footerReturnsText', footer.returnsText, false);
      var returnsEl = document.getElementById('footerReturnsText');
      if (returnsEl) returnsEl.style.display = '';
    }
    setText('footerTagline', footer.tagline, false);

    var copyrightName = footer.copyrightName || 'AYLENSALE';
    var yearEl = document.getElementById('footerYear');
    var year = yearEl ? yearEl.textContent : String(new Date().getFullYear());
    var copyrightEl = document.getElementById('footerCopyright');
    if (copyrightEl) {
      copyrightEl.innerHTML = '&copy; ' + year + ' ' + copyrightName + '. All rights reserved.';
    }

    setLink('footerContactEmail', 'mailto:' + (contact.contactEmail || 'contact@aylensale.com'), contact.contactEmail || 'contact@aylensale.com');
    setLink('footerSupportEmail', 'mailto:' + (contact.supportEmail || 'support@aylensale.com'), contact.supportEmail || 'support@aylensale.com');
    setText('footerRegionLabel', contact.regionLabel, false);
    if (contact.phone) {
      setText('footerPhone', contact.phone, false);
      var phoneEl = document.getElementById('footerPhone');
      if (phoneEl) phoneEl.style.display = '';
    }

    var businessParts = [];
    if (business.legalName) businessParts.push(business.legalName);
    if (business.companyNumber) businessParts.push('Company no. ' + business.companyNumber);
    if (business.vatNumber) businessParts.push('VAT ' + business.vatNumber);
    if (business.registeredAddress) businessParts.push(business.registeredAddress.replace(/\n/g, ', '));
    var businessLine = document.getElementById('footerBusinessLine');
    if (businessLine) {
      if (businessParts.length) {
        businessLine.textContent = businessParts.join(' · ');
        businessLine.hidden = false;
      } else {
        businessLine.hidden = true;
      }
    }

    var cookie = content.cookie || {};
    if (cookie.settingsLinkText) setText('footerCookieSettings', cookie.settingsLinkText, false);
  }

  function applyCookieBanner(content) {
    var cookie = content.cookie || {};
    setText('cookieBannerTitle', cookie.bannerTitle, false);
    setText('cookieBannerBody', cookie.bannerBodyHtml, true);
    setText('cookieAnalyticsLabel', cookie.analyticsLabel, false);
  }

  function apply(content) {
    if (!content) content = getPublishedFromStore();
    applyToSiteConfig(content);
    syncMarketplaceLinks(content);
    applyFooter(content);
    applyCookieBanner(content);
    if (typeof renderTelegramLinks === 'function') renderTelegramLinks();
    if (global.AYLEN_SEO && typeof global.AYLEN_SEO.refreshOrganization === 'function') {
      global.AYLEN_SEO.refreshOrganization();
    }
  }

  function getPreviewContent() {
    try {
      var raw = sessionStorage.getItem(PREVIEW_KEY);
      if (!raw) return null;
      return mergePublished(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function storePreviewDraft(content) {
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(content || {}));
  }

  function isPreviewMode() {
    try {
      return new URLSearchParams(global.location.search).get('preview') === '1';
    } catch (e) {
      return false;
    }
  }

  global.AYLEN_SITE_CONTENT = {
    apply: apply,
    getPublished: getPublishedFromStore,
    mergePublished: mergePublished,
    getPreviewContent: getPreviewContent,
    storePreviewDraft: storePreviewDraft,
    isPreviewMode: isPreviewMode,
    PREVIEW_KEY: PREVIEW_KEY
  };
})(typeof window !== 'undefined' ? window : this);
