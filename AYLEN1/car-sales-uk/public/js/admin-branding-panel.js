/**
 * Admin — Branding / App Icon (upload → preview → save → live PWA icons).
 */
(function(global) {
  var state = {
    file: null,
    localUrl: null,
    preview: null,
    saving: false
  };

  function esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s || '');
  }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type || 'info');
  }

  function getAdminPassword() {
    try {
      if (global.AYLEN_ADMIN_SESSION && global.AYLEN_ADMIN_SESSION.getSessionPassword) {
        return global.AYLEN_ADMIN_SESSION.getSessionPassword() || '';
      }
      try { return sessionStorage.getItem('aylen_admin_key') || ''; } catch (e) { return ''; }
    } catch (e) {
      return '';
    }
  }

  async function ensureBrandingAuth() {
    if (getAdminPassword()) return true;
    if (global.FBDB && global.FBDB.ensureAdminSession) {
      try {
        await global.FBDB.ensureAdminSession();
      } catch (e) {
        notifyMsg('Admin login required — open admin (Cmd+Shift+A) and enter your password, then try again.', 'error');
        return false;
      }
    }
    if (!getAdminPassword()) {
      notifyMsg('Session expired — log in to admin again with your password (needed for branding upload).', 'error');
      if (typeof showAdminLoginModal === 'function') showAdminLoginModal();
      return false;
    }
    return true;
  }

  function revokeLocalUrl() {
    if (state.localUrl) {
      try { URL.revokeObjectURL(state.localUrl); } catch (e) { /* ignore */ }
      state.localUrl = null;
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function apiBranding(action, payload) {
    payload = payload || {};
    payload.action = action;
    payload.adminPassword = getAdminPassword();
    return fetch('/api/admin-branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(r) {
      return r.json().then(function(data) {
        if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
        return data;
      });
    });
  }

  function pickIcon(preview, keys, fallback) {
    if (!preview) return fallback || '';
    for (var i = 0; i < keys.length; i++) {
      if (preview[keys[i]]) return preview[keys[i]];
    }
    return fallback || '';
  }

  function applyLiveBranding(branding) {
    if (!branding) return;
    if (global.AYLEN_BRANDING && global.AYLEN_BRANDING.apply) {
      global.AYLEN_BRANDING.apply(branding);
      return;
    }
    if (!branding.icons) return;
    var v = Number(branding.cacheVersion) || Date.now();
    var icons = branding.icons;
    function setLink(rel, href, sizes, type) {
      if (!href) return;
      var sel = 'link[rel="' + rel + '"]';
      if (sizes) sel += '[sizes="' + sizes + '"]';
      var el = document.querySelector(sel);
      if (!el) {
        el = document.createElement('link');
        el.rel = rel;
        if (sizes) el.setAttribute('sizes', sizes);
        document.head.appendChild(el);
      }
      var url = href.indexOf('?') >= 0 ? href + '&v=' + v : href + '?v=' + v;
      el.href = url;
      if (type) el.type = type;
    }
    setLink('manifest', '/api/manifest?v=' + v);
    setLink('apple-touch-icon', icons['apple-touch-icon'], '180x180');
    if (icons['favicon.ico']) setLink('icon', icons['favicon.ico'], null, 'image/x-icon');
    if (icons['icon-32']) setLink('icon', icons['icon-32'], '32x32', 'image/png');
    if (icons['icon-192']) setLink('icon', icons['icon-192'], '192x192', 'image/png');
  }

  function renderHeroPreviews(preview, localSrc) {
    var iconSrc = pickIcon(preview, ['icon-192', 'icon-512', 'apple-touch-icon'], localSrc);
    var iphoneSrc = pickIcon(preview, ['apple-touch-icon', 'icon-192'], iconSrc);
    var desktopSrc = pickIcon(preview, ['icon-512', 'maskable-512', 'icon-192'], iconSrc);
    var empty = !iconSrc && !localSrc;

    return '<div class="aylen-branding-preview-row" id="aylenBrandingHeroPreviews">' +
      '<div class="aylen-branding-preview-box">' +
        '<span>Preview icon</span>' +
        (empty ? '<p class="aylen-hint">Upload a logo to preview</p>' :
          '<img id="aylenPreviewIcon" src="' + esc(iconSrc || localSrc) + '" alt="App icon preview">') +
      '</div>' +
      '<div class="aylen-branding-preview-box aylen-branding-preview-box--iphone">' +
        '<span>Preview iPhone Home Screen</span>' +
        '<div class="aylen-branding-iphone-mock">' +
          '<div class="aylen-branding-iphone-screen">' +
            (empty ? '' : '<img src="' + esc(iphoneSrc || localSrc) + '" alt="iPhone home screen icon">') +
            '<em>AYLENSALE</em>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="aylen-branding-preview-box aylen-branding-preview-box--desktop">' +
        '<span>Preview desktop PWA icon</span>' +
        '<div class="aylen-branding-desktop-mock">' +
          (empty ? '<p class="aylen-hint">—</p>' :
            '<img src="' + esc(desktopSrc || localSrc) + '" alt="Desktop PWA icon">') +
          '<em>AYLENSALE</em>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderAllSizesGrid(preview, title) {
    if (!preview) return '';
    var keys = [
      ['icon-192', '192 Android'],
      ['icon-512', '512 Android'],
      ['apple-touch-icon', 'Apple 180'],
      ['maskable-192', 'Mask 192'],
      ['maskable-512', 'Mask 512'],
      ['icon-32', 'Favicon 32'],
      ['icon-16', 'Favicon 16']
    ];
    var html = title ? '<h3 class="aylen-branding-subtitle">' + esc(title) + '</h3>' : '';
    html += '<div class="aylen-branding-grid">';
    keys.forEach(function(pair) {
      var url = preview[pair[0]];
      if (!url) return;
      html += '<div class="aylen-branding-tile"><span>' + esc(pair[1]) + '</span>' +
        '<img src="' + esc(url) + '" alt="' + esc(pair[1]) + '" loading="lazy"></div>';
    });
    html += '</div>';
    return html;
  }

  function updatePreviewArea(preview, title, localSrc) {
    var hero = document.getElementById('aylenBrandingHeroPreviews');
    if (hero) {
      hero.outerHTML = renderHeroPreviews(preview, localSrc);
    }
    var area = document.getElementById('aylenBrandingPreviewArea');
    if (area) {
      area.innerHTML = renderAllSizesGrid(preview, title || '');
    }
  }

  function renderCurrentBranding() {
    var b = (global.siteSettings && global.siteSettings.branding) || null;
    if (!b || !b.icons) {
      return '<div class="aylen-panel-card">' +
        '<p class="aylen-hint"><b>Live now:</b> default AYLENSALE icons from deploy. Save branding below to replace apple-touch-icon, manifest icons, and favicon.</p>' +
      '</div>';
    }
    var v = b.cacheVersion || '—';
    var updated = b.updatedAt ? new Date(b.updatedAt).toLocaleString('en-GB') : '—';
    return '<div class="aylen-panel-card">' +
      '<p><b>Published on site</b> · v' + esc(String(v)) + ' · ' + esc(updated) + '</p>' +
      renderAllSizesGrid(b.icons, 'Current live sizes') +
    '</div>';
  }

  function bindUploadZone(fileInput) {
    var zone = document.getElementById('aylenBrandingDropZone');
    if (!zone || !fileInput) return;

    zone.addEventListener('click', function(e) {
      if (e.target.tagName === 'INPUT') return;
      fileInput.click();
    });

    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      zone.classList.add('is-dragover');
    });
    zone.addEventListener('dragleave', function() {
      zone.classList.remove('is-dragover');
    });
    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      zone.classList.remove('is-dragover');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f || !/^image\/(png|jpeg|jpg|webp)/i.test(f.type)) {
        notifyMsg('Use PNG, JPG or WEBP', 'error');
        return;
      }
      try {
        var dt = new DataTransfer();
        dt.items.add(f);
        fileInput.files = dt.files;
      } catch (err) {
        state.file = f;
      }
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    fileInput.addEventListener('change', function() {
      state.file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      state.preview = null;
      revokeLocalUrl();
      var meta = document.getElementById('aylenBrandingFileMeta');
      var nameEl = document.getElementById('aylenBrandingFileName');
      if (!state.file) {
        if (meta) meta.textContent = '';
        if (nameEl) nameEl.textContent = 'No file selected';
        zone.classList.remove('has-file');
        updatePreviewArea(null, '', null);
        return;
      }
      zone.classList.add('has-file');
      if (nameEl) nameEl.textContent = state.file.name;
      state.localUrl = URL.createObjectURL(state.file);
      if (meta) {
        meta.textContent = Math.round(state.file.size / 1024) + ' KB · ' + (state.file.type || 'image') +
          ' — recommended 1024×1024 square. Preview locally, then “Preview icons” for server sizes.';
      }
      updatePreviewArea(null, '', state.localUrl);
      notifyMsg('Logo selected — local preview only. Click Save branding to update Install button on the site.', 'success');
    });
  }

  function renderPanel(body) {
    body.innerHTML =
      '<div class="aylen-branding-panel">' +
        '<p class="aylen-hint">Upload one square logo (PNG/JPG/WEBP, <b>1024×1024</b> recommended). Preview locally, then <b>Save branding</b> — the icon appears on the live site on the <b>Install</b> button and home-screen shortcuts (manifest, apple-touch-icon, favicon).</p>' +
        renderCurrentBranding() +
        '<label class="aylen-label">Upload logo image</label>' +
        '<div id="aylenBrandingDropZone" class="aylen-branding-upload" role="button" tabindex="0">' +
          '<input type="file" id="aylenBrandingFile" accept="image/png,image/jpeg,image/webp" hidden>' +
          '<i class="fas fa-cloud-arrow-up" aria-hidden="true"></i>' +
          '<strong>Choose or drag logo</strong>' +
          '<span>PNG · JPG · WEBP — max 4 MB</span>' +
          '<em id="aylenBrandingFileName">No file selected</em>' +
        '</div>' +
        '<p id="aylenBrandingFileMeta" class="aylen-hint"></p>' +
        renderHeroPreviews(null, null) +
        '<div class="aylen-toolbar">' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" id="aylenBrandingPreviewBtn"><i class="fas fa-eye"></i> Preview icons</button>' +
          '<button type="button" class="aylen-btn" id="aylenBrandingSaveBtn"><i class="fas fa-floppy-disk"></i> Save branding</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" id="aylenBrandingRegenBtn"><i class="fas fa-arrows-rotate"></i> Regenerate icons</button>' +
        '</div>' +
        '<div id="aylenBrandingPreviewArea" class="aylen-branding-preview-area"></div>' +
      '</div>';

    bindUploadZone(document.getElementById('aylenBrandingFile'));
    var previewBtn = document.getElementById('aylenBrandingPreviewBtn');
    var saveBtn = document.getElementById('aylenBrandingSaveBtn');
    var regenBtn = document.getElementById('aylenBrandingRegenBtn');
    if (previewBtn) previewBtn.addEventListener('click', runPreview);
    if (saveBtn) saveBtn.addEventListener('click', runSave);
    if (regenBtn) regenBtn.addEventListener('click', runRegenerate);
  }

  async function runPreview() {
    if (!(await ensureBrandingAuth())) return;
    if (!state.file) {
      notifyMsg('Upload a logo image first', 'error');
      return;
    }
    try {
      notifyMsg('Generating icon sizes…', 'info');
      var dataUrl = await readFileAsDataUrl(state.file);
      var result = await apiBranding('preview', { imageBase64: dataUrl, mimeType: state.file.type });
      state.preview = result.preview;
      updatePreviewArea(state.preview, 'All generated sizes (not live until Save)', state.localUrl);
      notifyMsg('Server preview ready — review icons above', 'success');
    } catch (e) {
      notifyMsg(e.message || 'Preview failed', 'error');
    }
  }

  async function runSave() {
    if (!(await ensureBrandingAuth())) return;
    if (!state.file) {
      notifyMsg('Upload a logo image first', 'error');
      return;
    }
    if (state.saving) return;
    state.saving = true;
    try {
      notifyMsg('Saving branding to site…', 'info');
      var dataUrl = await readFileAsDataUrl(state.file);
      var result = await apiBranding('save', { imageBase64: dataUrl, mimeType: state.file.type });
      if (result.branding) {
        global.siteSettings = global.siteSettings || {};
        global.siteSettings.branding = result.branding;
        applyLiveBranding(result.branding);
      }
      state.preview = result.preview;
      updatePreviewArea(state.preview, 'Saved — live on site', state.localUrl);
      notifyMsg('Branding saved. Icons updated (v' + (result.branding && result.branding.cacheVersion) + ').', 'success');
      var mount = document.getElementById('aylenBrandingMount');
      if (mount) renderPanel(mount);
    } catch (e) {
      notifyMsg(e.message || 'Save failed', 'error');
    } finally {
      state.saving = false;
    }
  }

  async function runRegenerate() {
    if (!(await ensureBrandingAuth())) return;
    if (!confirm('Regenerate all icon sizes from the last saved logo?')) return;
    try {
      notifyMsg('Regenerating…', 'info');
      var result = await apiBranding('regenerate', {});
      if (result.branding) {
        global.siteSettings = global.siteSettings || {};
        global.siteSettings.branding = result.branding;
        applyLiveBranding(result.branding);
      }
      state.preview = result.preview;
      updatePreviewArea(state.preview, 'Regenerated sizes', null);
      notifyMsg('Icons regenerated (v' + (result.branding && result.branding.cacheVersion) + ')', 'success');
    } catch (e) {
      notifyMsg(e.message || 'Regenerate failed', 'error');
    }
  }

  global.AyelenAdminBranding = {
    renderPanel: renderPanel,
    applyLive: applyLiveBranding
  };
})(window);
