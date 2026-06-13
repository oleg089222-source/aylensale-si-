/**
 * Admin: Site Settings / Legal & Contact
 */
(function() {
  var quillLoaded = false;
  var quillEditors = {};
  var legalModalState = null;
  var autosaveTimer = null;
  var AUTOSAVE_MS = 4000;

  function getDraftSettings() {
    var doc = (typeof siteSettings !== 'undefined' && siteSettings.legalContact) || {};
    if (doc.draft && Object.keys(doc.draft).length) {
      return window.SITE_LEGAL_DEFAULTS.cloneLegalContactContent(doc.draft);
    }
    if (doc.published && Object.keys(doc.published).length) {
      return window.SITE_LEGAL_DEFAULTS.cloneLegalContactContent(doc.published);
    }
    return window.SITE_LEGAL_DEFAULTS.getDefaultLegalContactContent();
  }

  function fieldStyle() {
    return 'width:100%;padding:10px;border:1px solid #333;background:#1a1f2e;color:#e8edf7;border-radius:8px;margin-bottom:10px;box-sizing:border-box';
  }

  function loadQuillAssets() {
    if (quillLoaded) return Promise.resolve();
    return new Promise(function(resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css';
      document.head.appendChild(link);
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js';
      script.onload = function() { quillLoaded = true; resolve(); };
      script.onerror = function() { reject(new Error('Could not load rich text editor.')); };
      document.head.appendChild(script);
    });
  }

  function initQuillEditors(modalId) {
    var pages = ['privacy', 'terms', 'returns', 'cookies'];
    pages.forEach(function(page) {
      var el = document.getElementById('quill_' + page + '_' + modalId);
      if (!el || typeof Quill === 'undefined') return;
      quillEditors[page] = new Quill(el, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link'],
            ['clean']
          ]
        }
      });
    });
  }

  function setQuillHtml(page, html) {
    if (quillEditors[page]) quillEditors[page].root.innerHTML = html || '';
  }

  function getQuillHtml(page) {
    return quillEditors[page] ? quillEditors[page].root.innerHTML : '';
  }

  function switchTab(modalId, tab) {
    document.querySelectorAll('[data-legal-tab-panel="' + modalId + '"]').forEach(function(panel) {
      panel.style.display = panel.getAttribute('data-tab') === tab ? 'block' : 'none';
    });
    document.querySelectorAll('[data-legal-tab-btn="' + modalId + '"]').forEach(function(btn) {
      var active = btn.getAttribute('data-tab') === tab;
      btn.style.background = active ? '#e94560' : '#1f2937';
      btn.style.color = '#fff';
    });
    legalModalState.activeTab = tab;
  }

  function collectFormData(modalId) {
    var g = function(id) {
      var el = document.getElementById(id + '_' + modalId);
      return el ? el.value.trim() : '';
    };
    return {
      contact: {
        contactEmail: g('lcContactEmail'),
        supportEmail: g('lcSupportEmail'),
        telegramUrl: g('lcTelegramUrl'),
        whatsappUrl: g('lcWhatsappUrl'),
        phone: g('lcPhone'),
        regionLabel: g('lcRegionLabel')
      },
      business: {
        legalName: g('lcLegalName'),
        companyNumber: g('lcCompanyNumber'),
        vatNumber: g('lcVatNumber'),
        registeredAddress: g('lcRegisteredAddress'),
        businessEmail: g('lcBusinessEmail')
      },
      footer: {
        brandDescription: g('lcBrandDesc'),
        consumerRightsHtml: g('lcConsumerRights'),
        returnsText: g('lcReturnsText'),
        copyrightName: g('lcCopyrightName'),
        tagline: g('lcTagline')
      },
      legal: {
        privacy: {
          title: g('lcPrivacyTitle'),
          updated: g('lcPrivacyUpdated'),
          notice: g('lcPrivacyNotice'),
          bodyHtml: getQuillHtml('privacy')
        },
        terms: {
          title: g('lcTermsTitle'),
          updated: g('lcTermsUpdated'),
          notice: g('lcTermsNotice'),
          bodyHtml: getQuillHtml('terms')
        },
        returns: {
          title: g('lcReturnsTitle'),
          updated: g('lcReturnsUpdated'),
          notice: g('lcReturnsNotice'),
          bodyHtml: getQuillHtml('returns')
        },
        cookies: {
          title: g('lcCookiesTitle'),
          updated: g('lcCookiesUpdated'),
          notice: g('lcCookiesNotice'),
          bodyHtml: getQuillHtml('cookies')
        }
      },
      cookie: {
        bannerTitle: g('lcCookieBannerTitle'),
        bannerBodyHtml: g('lcCookieBannerBody'),
        analyticsLabel: g('lcCookieAnalyticsLabel'),
        settingsLinkText: g('lcCookieSettingsText')
      }
    };
  }

  function populateForm(modalId, data) {
    var s = data || {};
    var c = s.contact || {};
    var b = s.business || {};
    var f = s.footer || {};
    var ck = s.cookie || {};
    var legal = s.legal || {};
    var set = function(id, val) {
      var el = document.getElementById(id + '_' + modalId);
      if (el) el.value = val || '';
    };
    set('lcContactEmail', c.contactEmail);
    set('lcSupportEmail', c.supportEmail);
    set('lcTelegramUrl', c.telegramUrl);
    set('lcWhatsappUrl', c.whatsappUrl);
    set('lcPhone', c.phone);
    set('lcRegionLabel', c.regionLabel);
    set('lcLegalName', b.legalName);
    set('lcCompanyNumber', b.companyNumber);
    set('lcVatNumber', b.vatNumber);
    set('lcRegisteredAddress', b.registeredAddress);
    set('lcBusinessEmail', b.businessEmail);
    set('lcBrandDesc', f.brandDescription);
    set('lcConsumerRights', f.consumerRightsHtml);
    set('lcReturnsText', f.returnsText);
    set('lcCopyrightName', f.copyrightName);
    set('lcTagline', f.tagline);
    set('lcCookieBannerTitle', ck.bannerTitle);
    set('lcCookieBannerBody', ck.bannerBodyHtml);
    set('lcCookieAnalyticsLabel', ck.analyticsLabel);
    set('lcCookieSettingsText', ck.settingsLinkText);
    ['privacy', 'terms', 'returns', 'cookies'].forEach(function(page) {
      var p = legal[page] || {};
      set('lc' + page.charAt(0).toUpperCase() + page.slice(1) + 'Title', p.title);
      set('lc' + page.charAt(0).toUpperCase() + page.slice(1) + 'Updated', p.updated);
      set('lc' + page.charAt(0).toUpperCase() + page.slice(1) + 'Notice', p.notice);
      setQuillHtml(page, p.bodyHtml);
    });
  }

  function updateDraftStatus(text) {
    var el = document.getElementById('legalDraftStatus');
    if (el) el.textContent = text || '';
  }

  function scheduleAutosave(modalId) {
    if (!legalModalState || legalModalState.modalId !== modalId) return;
    legalModalState.dirty = true;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function() {
      saveLegalContactDraftQuiet(modalId);
    }, AUTOSAVE_MS);
  }

  async function saveLegalContactDraftQuiet(modalId) {
    try {
      if (!window.FBDB || !window.FBDB.saveLegalContactDraft) return;
      var data = collectFormData(modalId);
      await window.FBDB.saveLegalContactDraft(data);
      if (typeof siteSettings !== 'undefined') {
        siteSettings.legalContact = siteSettings.legalContact || {};
        siteSettings.legalContact.draft = data;
      }
      updateDraftStatus('Draft saved ' + new Date().toLocaleTimeString());
      legalModalState.dirty = false;
    } catch (e) {
      updateDraftStatus('Draft save failed');
    }
  }

  function legalPageBlock(modalId, page, label) {
    var cap = page.charAt(0).toUpperCase() + page.slice(1);
    return '' +
      '<div style="margin-bottom:16px">' +
      '<h3 style="color:#e94560;margin:0 0 10px">' + label + '</h3>' +
      '<input id="lc' + cap + 'Title_' + modalId + '" placeholder="Page title" style="' + fieldStyle() + '">' +
      '<input id="lc' + cap + 'Updated_' + modalId + '" placeholder="Last updated line" style="' + fieldStyle() + '">' +
      '<textarea id="lc' + cap + 'Notice_' + modalId + '" placeholder="Template notice (optional)" rows="2" style="' + fieldStyle() + '"></textarea>' +
      '<label style="display:block;color:#cbd5e1;font-size:12px;margin-bottom:6px">Page body (rich text)</label>' +
      '<div id="quill_' + page + '_' + modalId + '" style="background:#fff;color:#111;border-radius:8px;min-height:220px"></div>' +
      '</div>';
  }

  window.openLegalContactSettingsModal = async function() {
    if (!window.SITE_LEGAL_DEFAULTS) {
      notify('Site defaults not loaded. Refresh the page.', 'error');
      return;
    }
    var modalId = 'legalContact_' + Date.now();
    var settings = getDraftSettings();
    quillEditors = {};
    legalModalState = { modalId: modalId, dirty: false, activeTab: 'contact' };

    var html = '' +
      '<div id="' + modalId + '" class="modal" style="display:flex;z-index:600">' +
      '<div class="modal-content" style="width:min(960px,96vw);max-height:94vh;overflow:hidden;display:flex;flex-direction:column;background:#0f172a;border:1px solid #334155">' +
      '<span class="close" onclick="closeLegalContactModal(\'' + modalId + '\')" style="position:absolute;top:12px;right:16px;font-size:26px;cursor:pointer;z-index:2">&times;</span>' +
      '<div style="padding:18px 18px 10px;border-bottom:1px solid #334155">' +
      '<h2 style="color:#e94560;margin:0 0 6px"><i class="fas fa-scale-balanced"></i> Site Settings — Legal &amp; Contact</h2>' +
      '<p style="color:#94a3b8;font-size:13px;margin:0">Draft autosaves every few seconds. Visitors only see changes after <b>Save &amp; Publish</b>.</p>' +
      '<p id="legalDraftStatus" style="color:#64748b;font-size:12px;margin:8px 0 0"></p>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid #334155">' +
      ['contact', 'business', 'footer', 'legal', 'cookie'].map(function(tab) {
        var labels = { contact: 'Contact', business: 'Business', footer: 'Footer', legal: 'Legal pages', cookie: 'Cookies' };
        return '<button type="button" data-legal-tab-btn="' + modalId + '" data-tab="' + tab + '" onclick="switchLegalContactTab(\'' + modalId + '\',\'' + tab + '\')" style="padding:8px 12px;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;background:#1f2937;color:#fff">' + labels[tab] + '</button>';
      }).join('') +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;padding:18px">';

    html += '<div data-legal-tab-panel="' + modalId + '" data-tab="contact">' +
      '<label style="color:#e2e8f0;font-weight:700">Contact email</label><input id="lcContactEmail_' + modalId + '" type="email" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">Support email</label><input id="lcSupportEmail_' + modalId + '" type="email" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">Telegram URL</label><input id="lcTelegramUrl_' + modalId + '" type="url" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">WhatsApp URL</label><input id="lcWhatsappUrl_' + modalId + '" type="url" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">Phone (optional)</label><input id="lcPhone_' + modalId + '" type="tel" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">Region / currency / language</label><input id="lcRegionLabel_' + modalId + '" style="' + fieldStyle() + '">' +
      '</div>';

    html += '<div data-legal-tab-panel="' + modalId + '" data-tab="business" style="display:none">' +
      '<label style="color:#e2e8f0;font-weight:700">Company / trading name</label><input id="lcLegalName_' + modalId + '" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">Company number</label><input id="lcCompanyNumber_' + modalId + '" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">VAT number (optional)</label><input id="lcVatNumber_' + modalId + '" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">Registered address</label><textarea id="lcRegisteredAddress_' + modalId + '" rows="3" style="' + fieldStyle() + '"></textarea>' +
      '<label style="color:#e2e8f0;font-weight:700">Business email</label><input id="lcBusinessEmail_' + modalId + '" type="email" style="' + fieldStyle() + '">' +
      '</div>';

    html += '<div data-legal-tab-panel="' + modalId + '" data-tab="footer" style="display:none">' +
      '<label style="color:#e2e8f0;font-weight:700">AYLENSALE description</label><textarea id="lcBrandDesc_' + modalId + '" rows="3" style="' + fieldStyle() + '"></textarea>' +
      '<label style="color:#e2e8f0;font-weight:700">UK Consumer Rights (HTML allowed for links)</label><textarea id="lcConsumerRights_' + modalId + '" rows="2" style="' + fieldStyle() + '"></textarea>' +
      '<label style="color:#e2e8f0;font-weight:700">Returns line (optional)</label><input id="lcReturnsText_' + modalId + '" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">Copyright name</label><input id="lcCopyrightName_' + modalId + '" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">International tagline</label><input id="lcTagline_' + modalId + '" style="' + fieldStyle() + '">' +
      '</div>';

    html += '<div data-legal-tab-panel="' + modalId + '" data-tab="legal" style="display:none">' +
      legalPageBlock(modalId, 'privacy', 'Privacy Policy') +
      legalPageBlock(modalId, 'terms', 'Terms & Conditions') +
      legalPageBlock(modalId, 'returns', 'Returns & Refunds') +
      legalPageBlock(modalId, 'cookies', 'Cookie Policy') +
      '</div>';

    html += '<div data-legal-tab-panel="' + modalId + '" data-tab="cookie" style="display:none">' +
      '<label style="color:#e2e8f0;font-weight:700">Banner title</label><input id="lcCookieBannerTitle_' + modalId + '" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">Banner body (HTML for links)</label><textarea id="lcCookieBannerBody_' + modalId + '" rows="4" style="' + fieldStyle() + '"></textarea>' +
      '<label style="color:#e2e8f0;font-weight:700">Analytics toggle label</label><input id="lcCookieAnalyticsLabel_' + modalId + '" style="' + fieldStyle() + '">' +
      '<label style="color:#e2e8f0;font-weight:700">Footer “Cookie settings” link text</label><input id="lcCookieSettingsText_' + modalId + '" style="' + fieldStyle() + '">' +
      '</div>';

    html += '</div>' +
      '<div style="padding:14px 18px;border-top:1px solid #334155;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button type="button" onclick="restoreLegalContactDefaults(\'' + modalId + '\')" style="padding:11px 14px;background:#374151;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700">Restore defaults</button>' +
      '<button type="button" onclick="previewLegalContactSettings(\'' + modalId + '\')" style="padding:11px 14px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700">Preview</button>' +
      '<button type="button" onclick="closeLegalContactModal(\'' + modalId + '\')" style="padding:11px 14px;background:#555;color:#fff;border:none;border-radius:8px;cursor:pointer">Cancel</button>' +
      '<button type="button" onclick="publishLegalContactSettings(\'' + modalId + '\')" style="margin-left:auto;padding:11px 18px;background:#e94560;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:800">Save &amp; Publish</button>' +
      '</div></div></div>';

    if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
    else document.body.insertAdjacentHTML('beforeend', html);

    try {
      await loadQuillAssets();
      initQuillEditors(modalId);
      populateForm(modalId, settings);
      switchTab(modalId, 'contact');

      var root = document.getElementById(modalId);
      root.addEventListener('input', function() { scheduleAutosave(modalId); });
      Object.keys(quillEditors).forEach(function(page) {
        quillEditors[page].on('text-change', function() { scheduleAutosave(modalId); });
      });

      var doc = (siteSettings && siteSettings.legalContact) || {};
      if (doc.draftUpdatedAt) updateDraftStatus('Last draft: ' + doc.draftUpdatedAt);
    } catch (error) {
      notify('Could not open editor: ' + (error.message || error), 'error');
      if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
      else document.getElementById(modalId).remove();
    }
  };

  window.switchLegalContactTab = function(modalId, tab) {
    switchTab(modalId, tab);
  };

  window.closeLegalContactModal = function(modalId) {
    if (legalModalState && legalModalState.dirty) {
      if (!confirm('You have unsaved edits in this session. Close anyway? (Draft may already be autosaved.)')) return;
    }
    clearTimeout(autosaveTimer);
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    else {
      var el = document.getElementById(modalId);
      if (el) el.remove();
    }
    quillEditors = {};
    legalModalState = null;
  };

  window.restoreLegalContactDefaults = function(modalId) {
    if (!confirm('Replace all fields with default template text? This updates the form only — click Save & Publish to go live.')) return;
    populateForm(modalId, window.SITE_LEGAL_DEFAULTS.getDefaultLegalContactContent());
    scheduleAutosave(modalId);
    notify('Default template loaded into editor', 'success');
  };

  window.previewLegalContactSettings = function(modalId) {
    var data = collectFormData(modalId);
    if (window.AYLEN_SITE_CONTENT && window.AYLEN_SITE_CONTENT.storePreviewDraft) {
      window.AYLEN_SITE_CONTENT.storePreviewDraft(data);
    }
    window.open('/privacy-policy.html?preview=1', '_blank');
  };

  window.publishLegalContactSettings = async function(modalId) {
    if (!confirm('Publish to the live website? All visitors will see these changes on every device.')) return;
    try {
      var data = collectFormData(modalId);
      if (!window.FBDB || !window.FBDB.publishLegalContact) {
        throw new Error('Firebase is not ready.');
      }
      var saved = await window.FBDB.publishLegalContact(data);
      if (typeof siteSettings !== 'undefined') {
        siteSettings.legalContact = saved;
      }
      if (window.AYLEN_SITE_CONTENT && window.AYLEN_SITE_CONTENT.apply) {
        window.AYLEN_SITE_CONTENT.apply(saved.published);
      }
      clearTimeout(autosaveTimer);
      legalModalState.dirty = false;
      if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
      else document.getElementById(modalId).remove();
      notify('Legal & contact settings published', 'success');
    } catch (error) {
      notify('Publish failed: ' + (error.message || error), 'error');
    }
  };
})();
