/**
 * Warehouse Scan — one-tap photo → AI identify → upload → publish.
 * Mobile-first full-screen mode for warehouse staff.
 */
(function(global) {
  var state = {
    open: false,
    photos: [],
    processing: false,
    lastResult: null,
    autoPublish: true
  };

  function getAdminKey() {
    try {
      if (global.AYLEN_ADMIN_SESSION && global.AYLEN_ADMIN_SESSION.getSessionPassword) {
        return global.AYLEN_ADMIN_SESSION.getSessionPassword() || '';
      }
      return sessionStorage.getItem('aylen_admin_key') || '';
    } catch (e) {
      return '';
    }
  }

  function isReady() {
    return global.isAdminMode && global.FBDB && global.FBDB.isAdmin && global.FBDB.isAdmin() && getAdminKey();
  }

  function notify(msg, type) {
    if (typeof global.notify === 'function') global.notify(msg, type);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function setStep(text, kind) {
    var el = document.getElementById('whScanStatus');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'wh-scan-status' + (kind ? ' wh-scan-status--' + kind : '');
  }

  function renderPhotos() {
    var grid = document.getElementById('whScanPhotos');
    if (!grid) return;
    if (!state.photos.length) {
      grid.innerHTML = '<p class="wh-scan-empty">Сфотографируйте коробку или палету</p>';
      return;
    }
    grid.innerHTML = state.photos.map(function(p, i) {
      return '<div class="wh-scan-thumb">' +
        '<img src="data:' + escapeHtml(p.mimeType) + ';base64,' + p.preview + '" alt="Photo ' + (i + 1) + '">' +
        (i === 0 ? '<span class="wh-scan-hero">Main</span>' : '') +
        '<button type="button" class="wh-scan-remove" data-idx="' + i + '" aria-label="Remove">&times;</button>' +
        '</div>';
    }).join('');
    grid.querySelectorAll('.wh-scan-remove').forEach(function(btn) {
      btn.onclick = function() {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        state.photos.splice(idx, 1);
        renderPhotos();
        syncButtons();
      };
    });
  }

  function syncButtons() {
    var runBtn = document.getElementById('whScanRun');
    var addBtn = document.getElementById('whScanAddPhoto');
    if (runBtn) {
      runBtn.disabled = state.processing || !state.photos.length;
      runBtn.textContent = state.processing ? 'Обработка…' : (state.autoPublish ? 'Сканировать и опубликовать' : 'Сканировать (черновик)');
    }
    if (addBtn) addBtn.disabled = state.processing || state.photos.length >= 10;
  }

  function renderResult() {
    var box = document.getElementById('whScanResult');
    if (!box) return;
    var r = state.lastResult;
    if (!r || (!r.product && !r.auction)) {
      box.innerHTML = '';
      box.style.display = 'none';
      return;
    }
    var isAuction = r.listingType === 'auction' && r.auction;
    var p = isAuction ? r.auction : r.product;
    var priceNote = (!isAuction && p.priceEstimated) ? ' <span class="wh-scan-est">(оценка AI)</span>' : '';
    var gradeHtml = r.grade ? '<span class="wh-scan-grade">Grade ' + escapeHtml(String(r.grade).toUpperCase()) + '</span> · ' : '';
    var manifestHtml = r.manifest && r.manifest.lines && r.manifest.lines.length
      ? '<p class="wh-scan-manifest"><i class="fas fa-list"></i> Manifest: ' + r.manifest.totalUnits + ' units · £' + Number(r.manifest.totalRrp).toFixed(2) + ' RRP · ' + r.manifest.lines.length + ' lines</p>' +
        '<div class="wh-scan-manifest-actions">' +
        (r.auction && r.auction.manifestCsvUrl
          ? '<a href="' + escapeHtml(r.auction.manifestCsvUrl) + '" class="wh-scan-link wh-scan-link--sm" download><i class="fas fa-file-csv"></i> CSV</a>'
          : (r.product && r.product.manifestCsvUrl
            ? '<a href="' + escapeHtml(r.product.manifestCsvUrl) + '" class="wh-scan-link wh-scan-link--sm" download><i class="fas fa-file-csv"></i> CSV</a>'
            : '')) +
        '<button type="button" id="whScanManifestDl" class="wh-scan-link wh-scan-link--sm"><i class="fas fa-download"></i> Save CSV</button>' +
        '</div>'
      : '';
    var priceLine = isAuction
      ? 'Start £' + Number(p.startingPrice).toFixed(2) + ' · ends ' + new Date(p.endTime).toLocaleDateString('en-GB')
      : escapeHtml(p.category) + ' · £' + Number(p.price).toFixed(2) + priceNote + ' · SKU ' + escapeHtml(p.sku || '');
    var linkHref = isAuction
      ? '/#auctions'
      : 'product.html?id=' + encodeURIComponent(p.id);
    var linkLabel = isAuction ? 'Открыть аукционы' : 'Открыть товар';
    box.style.display = 'block';
    box.innerHTML =
      '<div class="wh-scan-result-card">' +
      '<div class="wh-scan-result-icon"><i class="fas fa-' + (isAuction ? 'gavel' : 'check-circle') + '"></i></div>' +
      '<h3>' + escapeHtml(p.name) + '</h3>' +
      '<p class="wh-scan-meta">' + gradeHtml + priceLine + '</p>' +
      manifestHtml +
      (isAuction ? '<p class="wh-scan-live"><i class="fas fa-gavel"></i> Аукцион · VIP early ' + (p.vipEarlyAccessHours || 24) + 'h</p>' : '') +
      (r.published
        ? '<p class="wh-scan-live"><i class="fas fa-globe"></i> Опубликовано на сайте</p>'
        : '<p class="wh-scan-live wh-scan-live--draft"><i class="fas fa-file"></i> Сохранено как черновик</p>') +
      '<div class="wh-scan-result-actions">' +
      '<a href="' + linkHref + '" target="_blank" class="wh-scan-link">' + linkLabel + '</a>' +
      '<button type="button" id="whScanNext" class="wh-scan-next">Следующий →</button>' +
      '</div></div>';
    var nextBtn = document.getElementById('whScanNext');
    if (nextBtn) nextBtn.onclick = resetForNext;
    var manifestDl = document.getElementById('whScanManifestDl');
    if (manifestDl && r.manifest && global.downloadManifestCsv) {
      manifestDl.onclick = function() {
        global.downloadManifestCsv(r.manifest, {
          name: p.name,
          sku: p.sku,
          grade: r.grade,
          productId: isAuction ? null : p.id,
          auctionId: isAuction ? p.id : null
        });
      };
    }
  }

  function resetForNext() {
    state.photos = [];
    state.lastResult = null;
    state.processing = false;
    renderPhotos();
    renderResult();
    syncButtons();
    setStep('Готово к следующему скану', 'ok');
    var hint = document.getElementById('whScanHint');
    if (hint) hint.value = '';
  }

  function addPhoto(base64, mimeType, previewB64) {
    if (state.photos.length >= 10) {
      notify('Максимум 10 фото', 'info');
      return;
    }
    state.photos.push({
      base64: base64,
      mimeType: mimeType || 'image/jpeg',
      preview: previewB64 || base64
    });
    renderPhotos();
    syncButtons();
    setStep('Фото ' + state.photos.length + ' — нажмите «Сканировать» или добавьте ещё', 'info');
  }

  async function captureCamera() {
    if (!global.AYLEN_AI_MEDIA || !global.AYLEN_AI_MEDIA.openCameraPreview) {
      document.getElementById('whScanFile').click();
      return;
    }
    try {
      var frame = await global.AYLEN_AI_MEDIA.openCameraPreview();
      addPhoto(frame.base64, frame.mimeType, frame.base64);
    } catch (e) {
      if (e.message !== 'cancelled') {
        document.getElementById('whScanFile').click();
      }
    }
  }

  async function handleFileInput(file) {
    if (!file || !global.AYLEN_AI_MEDIA) return;
    var frame = await global.AYLEN_AI_MEDIA.captureFromFileInput(file);
    addPhoto(frame.base64, frame.mimeType, frame.base64);
  }

  async function runPipeline() {
    if (state.processing || !state.photos.length) return;
    state.processing = true;
    syncButtons();
    setStep('1/5 — AI определяет товар и Grade…', 'busy');

    var hintEl = document.getElementById('whScanHint');
    var hint = hintEl ? hintEl.value.trim() : '';

    try {
      var key = getAdminKey();
      setStep('2/5 — Manifest + описание…', 'busy');
      var res = await fetch('/api/ai-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': key
        },
        body: JSON.stringify({
          action: 'scan_and_publish',
          images: state.photos.map(function(p) {
            return { base64: p.base64, mimeType: p.mimeType };
          }),
          hint: hint,
          publish: state.autoPublish
        })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');

      setStep('3/5 — Фото загружены', 'busy');
      var doneMsg = data.listingType === 'auction'
        ? 'Аукцион создан!'
        : (data.published ? 'Опубликовано!' : 'Черновик сохранён');
      setStep('4/5 — ' + doneMsg, 'ok');
      if (data.grade) setStep('5/5 — Grade ' + String(data.grade).toUpperCase() + (data.manifest ? ' · manifest ' + data.manifest.lines.length + ' lines' : ''), 'ok');

      state.lastResult = data;
      renderResult();

      if (global.AYLEN_AI_MEDIA && global.AYLEN_AI_MEDIA.playTts && data.draft && data.draft.assistantReply) {
        global.AYLEN_AI_MEDIA.playTts(function(action, payload) {
          return fetch('/api/ai-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
            body: JSON.stringify(Object.assign({ action: action }, payload || {}))
          }).then(function(r) { return r.json(); });
        }, data.draft.assistantReply);
      }

      if (typeof global.refreshCatalogAfterAutoScan === 'function') {
        global.refreshCatalogAfterAutoScan(data);
      } else {
        if (typeof global.renderProducts === 'function') global.renderProducts();
        if (typeof global.renderAuctions === 'function') global.renderAuctions();
        if (global.AyelenAdminDashboard && global.AyelenAdminDashboard.reloadProducts) {
          global.AyelenAdminDashboard.reloadProducts(false);
        }
      }
      notify(
        data.listingType === 'auction'
          ? 'Аукцион: ' + (data.auction && data.auction.name)
          : (data.published ? 'Товар опубликован: ' + data.product.name : 'Черновик: ' + data.product.name),
        'success'
      );
    } catch (e) {
      setStep(e.message || 'Ошибка сканирования', 'error');
      notify(e.message || 'Scan failed', 'error');
    } finally {
      state.processing = false;
      syncButtons();
    }
  }

  function ensurePanel() {
    if (document.getElementById('whScanOverlay')) return;

    var html =
      '<div id="whScanOverlay" class="wh-scan-overlay" aria-hidden="true">' +
      '<header class="wh-scan-header">' +
      '<div><h2><i class="fas fa-box-open"></i> Склад — автоскан</h2>' +
      '<p>Фото → AI → публикация без ручного ввода</p></div>' +
      '<button type="button" id="whScanClose" class="wh-scan-close" aria-label="Close">&times;</button>' +
      '</header>' +
      '<main class="wh-scan-main">' +
      '<div id="whScanPhotos" class="wh-scan-photos"></div>' +
      '<p id="whScanStatus" class="wh-scan-status"></p>' +
      '<div id="whScanResult" class="wh-scan-result" style="display:none"></div>' +
      '<label class="wh-scan-hint-label">Подсказка (цена, кол-во) — необязательно</label>' +
      '<input type="text" id="whScanHint" class="wh-scan-hint" placeholder="например: 39.99, 5 штук, Amazon returns">' +
      '<label class="wh-scan-toggle"><input type="checkbox" id="whScanAutoPub" checked> Автопубликация на сайт</label>' +
      '</main>' +
      '<footer class="wh-scan-footer">' +
      '<button type="button" id="whScanCamera" class="wh-scan-btn wh-scan-btn--cam"><i class="fas fa-camera"></i> Камера</button>' +
      '<button type="button" id="whScanAddPhoto" class="wh-scan-btn wh-scan-btn--add"><i class="fas fa-images"></i> Галерея</button>' +
      '<button type="button" id="whScanRun" class="wh-scan-btn wh-scan-btn--run" disabled><i class="fas fa-bolt"></i> Сканировать и опубликовать</button>' +
      '<input type="file" id="whScanFile" accept="image/*" capture="environment" multiple style="display:none">' +
      '</footer></div>';

    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('whScanClose').onclick = closeWarehouseScan;
    document.getElementById('whScanCamera').onclick = captureCamera;
    document.getElementById('whScanAddPhoto').onclick = function() {
      document.getElementById('whScanFile').click();
    };
    document.getElementById('whScanRun').onclick = runPipeline;
    document.getElementById('whScanAutoPub').onchange = function(e) {
      state.autoPublish = !!e.target.checked;
      syncButtons();
    };
    document.getElementById('whScanFile').onchange = async function(ev) {
      var files = ev.target.files;
      if (!files) return;
      for (var i = 0; i < files.length; i++) {
        try {
          await handleFileInput(files[i]);
        } catch (e) {
          notify(e.message, 'error');
        }
      }
      ev.target.value = '';
    };
  }

  function openWarehouseScan() {
    if (!isReady()) {
      notify('Сначала войдите в админку', 'error');
      if (typeof global.showAdminLoginModal === 'function') global.showAdminLoginModal();
      return;
    }
    ensurePanel();
    var overlay = document.getElementById('whScanOverlay');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    state.open = true;
    renderPhotos();
    renderResult();
    syncButtons();
    setStep('Сфотографируйте коробку или палету', 'info');

    if (typeof global.AYLEN_ADMIN_LOADER !== 'undefined' && global.AYLEN_ADMIN_LOADER.loadExtras) {
      global.AYLEN_ADMIN_LOADER.loadExtras().catch(function() {});
    }
  }

  function closeWarehouseScan() {
    var overlay = document.getElementById('whScanOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    state.open = false;
    if (global.AYLEN_AI_MEDIA && global.AYLEN_AI_MEDIA.closeCameraPreview) {
      try { global.AYLEN_AI_MEDIA.closeCameraPreview(); } catch (e) { /* ignore */ }
    }
  }

  global.openWarehouseScan = openWarehouseScan;
  global.closeWarehouseScan = closeWarehouseScan;
  global.AYLEN_WAREHOUSE_SCAN = {
    open: openWarehouseScan,
    close: closeWarehouseScan
  };
})(typeof window !== 'undefined' ? window : this);
