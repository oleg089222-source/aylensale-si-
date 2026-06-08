/**
 * Admin — VIP Members, stock previews, settings.
 */
(function(global) {
  var vipStockPhotoState = { existing: [], pendingFiles: [], pendingThumbs: [], viewCount: 0 };

  function vipPhotoHelpers() {
    return global.AYLEN_ADMIN_PHOTOS || {};
  }

  function resetVipPhotoState(item) {
    item = item || {};
    vipStockPhotoState.existing = (item.images && item.images.length)
      ? item.images.slice()
      : (item.imageUrl ? [item.imageUrl] : []);
    vipStockPhotoState.pendingFiles = [];
    vipStockPhotoState.pendingThumbs = [];
    vipStockPhotoState.viewCount = Number(item.viewCount || 0);
    renderVipPhotoPreview(true);
  }

  function renderVipPhotoPreview(fullReset) {
    var wrap = stockField('vipStockPhotoPreview');
    if (!wrap) return;
    var H = vipPhotoHelpers();
    if (fullReset) {
      wrap.innerHTML = '';
      if (H.setStatus) H.setStatus(wrap, { hidden: true });
    }
    if (!vipStockPhotoState.existing.length && !vipStockPhotoState.pendingThumbs.length) {
      if (!wrap.querySelector('.aylen-photo-empty')) {
        wrap.innerHTML = '<span class="aylen-photo-empty aylen-hint">No photos yet — upload up to 20</span>';
      }
      return;
    }
    var empty = wrap.querySelector('.aylen-photo-empty');
    if (empty) empty.remove();

    if (fullReset) {
      vipStockPhotoState.existing.forEach(function(url, idx) {
        (function(photoIdx) {
          var thumb;
          if (H.previewThumb) {
            thumb = H.previewThumb(url, function() {
              AyelenAdminVip.removeVipPhoto(photoIdx);
            });
          } else {
            thumb = document.createElement('div');
            thumb.className = 'aylen-photo-thumb';
            thumb.innerHTML = '<img src="' + esc(url) + '" alt="">';
          }
          thumb.setAttribute('data-vip-existing', '1');
          wrap.appendChild(thumb);
        })(idx);
      });
      vipStockPhotoState.pendingThumbs.forEach(function(el) {
        if (el && el.parentNode === wrap) return;
        if (el) wrap.appendChild(el);
      });
    }
  }

  function onVipPhotoFilesSelected(ev) {
    var files = ev.target && ev.target.files ? Array.from(ev.target.files) : [];
    if (!files.length) return;
    var total = vipStockPhotoState.existing.length + vipStockPhotoState.pendingFiles.length + files.length;
    if (total > 20) {
      notifyMsg('Maximum 20 photos per VIP item', 'error');
      ev.target.value = '';
      return;
    }

    var preview = stockField('vipStockPhotoPreview');
    if (!preview) return;
    var H = vipPhotoHelpers();
    var empty = preview.querySelector('.aylen-photo-empty');
    if (empty) empty.remove();

    if (H.setStatus) {
      H.setStatus(preview, {
        current: 0,
        total: files.length,
        message: 'Preparing ' + files.length + ' photo(s)…'
      });
    }

    var loadedCount = 0;
    for (var i = 0; i < files.length; i++) {
      (function(file) {
        var loadingEl = H.loadingThumb ? H.loadingThumb('Loading…') : null;
        if (!loadingEl) {
          loadingEl = document.createElement('div');
          loadingEl.className = 'aylen-photo-thumb aylen-photo-thumb--loading';
          loadingEl.textContent = 'Loading…';
        }
        loadingEl.setAttribute('data-vip-pending', '1');
        preview.appendChild(loadingEl);
        vipStockPhotoState.pendingThumbs.push(loadingEl);
        vipStockPhotoState.pendingFiles.push(file);

        var reader = new FileReader();
        reader.onload = function(event) {
          var previewThumb = H.previewThumb ? H.previewThumb(event.target.result, function() {
            removeVipPendingThumb(previewThumb);
          }) : null;
          if (!previewThumb) {
            previewThumb = document.createElement('div');
            previewThumb.className = 'aylen-photo-thumb';
            previewThumb.innerHTML = '<img src="' + esc(event.target.result) + '" alt="">';
          }
          previewThumb.setAttribute('data-vip-pending', '1');
          var thumbIdx = vipStockPhotoState.pendingThumbs.indexOf(loadingEl);
          loadingEl.replaceWith(previewThumb);
          if (thumbIdx >= 0) vipStockPhotoState.pendingThumbs[thumbIdx] = previewThumb;

          loadedCount++;
          if (H.setStatus) {
            H.setStatus(preview, {
              current: loadedCount,
              total: files.length,
              message: loadedCount === files.length
                ? loadedCount + ' photo(s) ready — click Save to upload'
                : 'Loading preview ' + loadedCount + ' of ' + files.length + '…'
            });
          }
          if (loadedCount === files.length && H.setStatus) {
            setTimeout(function() { H.setStatus(preview, { hidden: true }); }, 1500);
          }
        };
        reader.onerror = function() {
          var errIdx = vipStockPhotoState.pendingThumbs.indexOf(loadingEl);
          if (errIdx >= 0) {
            vipStockPhotoState.pendingThumbs.splice(errIdx, 1);
            vipStockPhotoState.pendingFiles.splice(errIdx, 1);
          }
          loadingEl.remove();
          notifyMsg('Could not read selected photo', 'error');
        };
        reader.readAsDataURL(file);
      })(files[i]);
    }
    ev.target.value = '';
  }

  function removeVipPendingThumb(thumbEl) {
    var idx = vipStockPhotoState.pendingThumbs.indexOf(thumbEl);
    if (idx >= 0) {
      vipStockPhotoState.pendingThumbs.splice(idx, 1);
      vipStockPhotoState.pendingFiles.splice(idx, 1);
    }
    if (thumbEl && thumbEl.remove) thumbEl.remove();
    var preview = stockField('vipStockPhotoPreview');
    if (preview && !preview.querySelector('.aylen-photo-thumb') && !vipStockPhotoState.existing.length) {
      preview.innerHTML = '<span class="aylen-photo-empty aylen-hint">No photos yet — upload up to 20</span>';
      var H = vipPhotoHelpers();
      if (H.setStatus) H.setStatus(preview, { hidden: true });
    }
  }

  async function uploadVipPendingPhotos(itemId) {
    var urls = vipStockPhotoState.existing.slice();
    var files = vipStockPhotoState.pendingFiles.slice();
    if (!files.length) return urls;

    if (global.FBDB && global.FBDB.ensureAdminSession) {
      await global.FBDB.ensureAdminSession();
    }

    var preview = stockField('vipStockPhotoPreview');
    var H = vipPhotoHelpers();
    var total = files.length;

    if (H.setStatus && preview) {
      H.setStatus(preview, {
        current: 0,
        total: total,
        message: 'Uploading photo 1 of ' + total + '…'
      });
    }

    for (var i = 0; i < files.length; i++) {
      var thumbEl = vipStockPhotoState.pendingThumbs[i];
      if (H.markUploading) H.markUploading(thumbEl, true);

      if (!global.FBDB) throw new Error('Upload module not loaded');
      var res;
      if (global.FBDB.uploadImageWithProgress) {
        res = await global.FBDB.uploadImageWithProgress(files[i], itemId, function(pct) {
          if (H.setStatus && preview) {
            H.setStatus(preview, {
              current: i + pct / 100,
              total: total,
              message: 'Uploading photo ' + (i + 1) + ' of ' + total + '… ' + pct + '%'
            });
          }
        }, 'vipStock');
      } else if (global.FBDB.uploadImage) {
        res = await global.FBDB.uploadImage(files[i], itemId, 'vipStock');
      } else {
        throw new Error('Upload module not loaded');
      }

      if (H.markUploading) H.markUploading(thumbEl, false);
      if (!res || !res.success || !res.url) throw new Error((res && res.error) || 'Upload failed');
      urls.push(res.url);

      if (H.setStatus && preview) {
        H.setStatus(preview, {
          current: i + 1,
          total: total,
          message: 'Uploaded ' + (i + 1) + ' of ' + total
        });
      }
    }

    vipStockPhotoState.pendingFiles = [];
    vipStockPhotoState.pendingThumbs = [];
    vipStockPhotoState.existing = urls;
    if (H.setStatus && preview) {
      setTimeout(function() { H.setStatus(preview, { hidden: true }); }, 1200);
    }
    renderVipPhotoPreview(true);
    return urls;
  }

  function esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s || '');
  }

  function notifyMsg(msg, type) {
    setVipSaveStatus(msg, type);
    if (typeof adminMsg === 'function') {
      adminMsg(msg, type);
    } else if (typeof notify === 'function') {
      notify(msg, type);
    }
    if (type === 'error') {
      console.error('[VIP admin]', msg);
    }
  }

  function mapVipSaveError(msg) {
    msg = String(msg || 'Save failed');
    if (/storage|storage\/rules|does not have permission to access|unauthorized/i.test(msg) &&
        !/firestore/i.test(msg)) {
      return 'Нет прав Firebase Storage для загрузки фото. Опубликуйте storage.rules в Firebase Console → Storage → Rules, затем hard refresh. Или вставьте Fallback image URL без загрузки.';
    }
    if (/Admin Firebase login|INVALID_ADMIN/i.test(msg)) {
      return 'Нужен вход admin (oleg.yuryevich@gmail.com). Закройте CMS → Admin panel внизу сайта → войдите снова.';
    }
    if (/permission|insufficient|Missing or insufficient/i.test(msg)) {
      return 'Нет доступа Firebase. Войдите как admin и опубликуйте firestore.rules + storage.rules в Firebase Console.';
    }
    return msg;
  }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function(_, reject) {
        setTimeout(function() {
          reject(new Error(label || 'Request timed out'));
        }, ms);
      })
    ]);
  }

  function setupVipStockModalDelegation() {
    if (global._vipStockSaveDelegated) return;
    global._vipStockSaveDelegated = true;
    document.addEventListener('click', function(e) {
      var target = e.target;
      if (!target || !target.closest) return;
      var btn = target.closest('#vipStockSaveBtn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      runSaveStockModal();
    }, true);
  }
  setupVipStockModalDelegation();

  function statusBadge(status) {
    var s = String(status || '').toLowerCase();
    var color = '#94a3b8';
    if (s === 'active') color = '#00ff88';
    if (s === 'cancelled') color = '#fbbf24';
    if (s === 'past_due') color = '#f87171';
    if (s === 'unpaid') color = '#64748b';
    return '<span style="color:' + color + ';font-weight:800">' + esc(status || '—') + '</span>';
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-GB');
    } catch (e) {
      return iso;
    }
  }

  function calcMrr(rows) {
    var mrr = 0;
    (rows || []).forEach(function(r) {
      if (String(r.status).toLowerCase() === 'active') {
        mrr += Number(r.amountGbp || 9.99);
      }
    });
    return mrr.toFixed(2);
  }

  function carouselToText(urls) {
    return (urls || []).join('\n');
  }

  var vipAdminTab = 'overview';
  var vipStockModalId = null;
  var vipStockCacheList = [];
  var vipStockSaveInFlight = false;

  function thumb(url) {
    return global.AYLEN_IMAGES ? global.AYLEN_IMAGES.productThumbUrl(url || '', 56) : (url || '');
  }

  function stockField(id) {
    var sel = '#' + String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (typeof queryInAdminModal === 'function') {
      var inModal = queryInAdminModal(sel);
      if (inModal) return inModal;
    }
    var root = document.getElementById('aylen-modal-root');
    if (root) {
      var panel = root.querySelector('[data-aylen-panel]');
      if (panel) {
        var inPanel = panel.querySelector(sel);
        if (inPanel) return inPanel;
      }
    }
    if (vipStockModalId) {
      var legacy = document.getElementById(vipStockModalId);
      if (legacy) {
        var nested = legacy.querySelector(sel);
        if (nested) return nested;
      }
    }
    return document.getElementById(String(id || '').replace(/^#/, ''));
  }

  function fieldVal(id) {
    var el = stockField(id);
    return el && 'value' in el ? String(el.value || '') : '';
  }

  function fieldChecked(id, defaultOn) {
    var el = stockField(id);
    if (!el || el.type !== 'checkbox') return defaultOn !== false;
    return !!el.checked;
  }

  function setVipSaveStatus(msg, type) {
    var status = stockField('vipStockSaveStatus');
    if (!status) return;
    status.textContent = msg || '';
    status.className = 'aylen-hint aylen-vip-save-status' + (type ? (' aylen-vip-save-status--' + type) : '');
  }

  function setVipSaveBusy(busy) {
    var btn = stockField('vipStockSaveBtn');
    if (btn) {
      btn.disabled = !!busy;
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
  }

  function activateVipTab(tab) {
    vipAdminTab = tab || 'overview';
    document.querySelectorAll('[data-vip-admin-tab]').forEach(function(btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-vip-admin-tab') === vipAdminTab);
    });
    document.querySelectorAll('[data-vip-admin-panel]').forEach(function(panel) {
      var on = panel.getAttribute('data-vip-admin-panel') === vipAdminTab;
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
    });
  }

  function bindStockModalActions(panel) {
    panel = panel || (typeof getAdminModalPanel === 'function' ? getAdminModalPanel() : null);
    if (!panel) {
      var root = document.getElementById('aylen-modal-root');
      panel = root ? root.querySelector('[data-aylen-panel]') : null;
    }
    if (!panel) return;

    var saveBtn = panel.querySelector('#vipStockSaveBtn');
    if (saveBtn) {
      saveBtn.onclick = function(e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        runSaveStockModal();
      };
    }

    var photoInput = panel.querySelector('#vipStockFPhotos');
    if (photoInput) {
      photoInput.onchange = onVipPhotoFilesSelected;
    }

    var titleInput = panel.querySelector('#vipStockFTitle');
    if (titleInput && !titleInput._vipEnterBound) {
      titleInput._vipEnterBound = true;
      titleInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          runSaveStockModal();
        }
      });
    }
  }

  function runSaveStockModal() {
    saveStockModal().catch(function(err) {
      var msg = (err && err.message) || 'Save failed';
      notifyMsg(msg, 'error');
      console.error('[VIP stock save]', err);
      vipStockSaveInFlight = false;
      setVipSaveBusy(false);
    });
  }

  function bindVipAdminNav() {
    document.querySelectorAll('[data-vip-admin-tab]').forEach(function(btn) {
      if (btn._vipTabBound) return;
      btn._vipTabBound = true;
      btn.addEventListener('click', function() {
        activateVipTab(btn.getAttribute('data-vip-admin-tab'));
      });
    });
    var search = document.getElementById('vipStockSearch');
    if (search && !search._vipBound) {
      search._vipBound = true;
      search.addEventListener('input', function() {
        filterVipStockTable(search.value);
      });
    }
    activateVipTab(vipAdminTab);
  }

  function filterVipStockTable(q) {
    q = String(q || '').trim().toLowerCase();
    document.querySelectorAll('#vipStockTableBody tr[data-vip-stock-row]').forEach(function(row) {
      var text = row.getAttribute('data-vip-search') || '';
      row.hidden = !!(q && text.indexOf(q) === -1);
    });
  }

  function vipSubnavBtn(tab, label, icon, count) {
    var cnt = count != null ? '<span>' + esc(count) + '</span>' : '';
    return '<button type="button" class="aylen-vip-subnav__btn' + (vipAdminTab === tab ? ' is-active' : '') + '" data-vip-admin-tab="' + tab + '">' +
      '<i class="fas fa-' + icon + '"></i> ' + esc(label) + cnt + '</button>';
  }

  function buildStockEditorHtml(modalId, item) {
    item = item || {};
    return (
      '<div id="' + modalId + '" class="modal">' +
        '<div class="modal-content">' +
          '<span class="close" data-aylen-close>&times;</span>' +
          '<h2 class="aylen-modal-title"><i class="fas fa-crown"></i> ' + (item.id ? 'Edit VIP item' : 'Add VIP item') + '</h2>' +
          '<input type="hidden" id="vipStockFId" value="' + esc(item.id || '') + '">' +
          '<div class="aylen-form-section">' +
            '<h3>Basic information</h3>' +
            '<div class="aylen-form-row">' +
              '<label class="aylen-label">Title<input id="vipStockFTitle" class="aylen-input" value="' + esc(item.title || '') + '"></label>' +
              '<label class="aylen-label">VIP price (£)<input id="vipStockFPrice" class="aylen-input" type="number" min="0" step="0.01" value="' + esc(item.vipPrice != null ? item.vipPrice : 0) + '"></label>' +
            '</div>' +
            '<div class="aylen-form-row">' +
              '<label class="aylen-label">Category<select id="vipStockFCat" class="aylen-input">' +
                ['electronics', 'homeware', 'clothing', 'accessories', 'job-lots', 'cables', 'general'].map(function(c) {
                  return '<option value="' + c + '"' + (String(item.category || 'general') === c ? ' selected' : '') + '>' + c + '</option>';
                }).join('') +
              '</select></label>' +
              '<label class="aylen-label">Badge<input id="vipStockFBadge" class="aylen-input" value="' + esc(item.badge || 'VIP') + '"></label>' +
            '</div>' +
            '<label class="aylen-label">Description<textarea id="vipStockFDesc" class="aylen-input" rows="3">' + esc(item.desc || '') + '</textarea></label>' +
          '</div>' +
          '<div class="aylen-form-section">' +
            '<h3>Inventory</h3>' +
            '<div class="aylen-form-row">' +
              '<label class="aylen-label">Stock qty<input id="vipStockFQty" class="aylen-input" type="number" min="0" step="1" value="' + esc(item.stock != null ? item.stock : '') + '"></label>' +
              '<label class="aylen-label">Status<select id="vipStockFStatus" class="aylen-input">' +
                ['available', 'reserved', 'sold'].map(function(s) {
                  return '<option value="' + s + '"' + (String(item.stockStatus || 'available') === s ? ' selected' : '') + '>' + s + '</option>';
                }).join('') +
              '</select></label>' +
              '<label class="aylen-label">Sort order<input id="vipStockFSort" class="aylen-input" type="number" value="' + esc(item.sortOrder != null ? item.sortOrder : Date.now()) + '"></label>' +
            '</div>' +
            '<label><input type="checkbox" id="vipStockFVisible"' + (item.visible !== false ? ' checked' : '') + '> Visible on VIP hub</label>' +
            '<p id="vipStockViewCount" class="aylen-hint">' + (item.id ? ('Listing views: ' + Number(item.viewCount || 0)) : '') + '</p>' +
          '</div>' +
          '<div class="aylen-form-section">' +
            '<h3><i class="fas fa-images"></i> Photos (max 20)</h3>' +
            '<div id="vipStockPhotoPreview" class="aylen-photo-preview"></div>' +
            '<input type="file" id="vipStockFPhotos" class="aylen-input" accept="image/*" multiple>' +
            '<label class="aylen-label">Fallback image URL<input id="vipStockFImg" class="aylen-input" value="' + esc(item.imageUrl || '') + '" placeholder="https://..."></label>' +
            '<label class="aylen-label">Video URL (MP4)<input id="vipStockFVideo" class="aylen-input" value="' + esc(item.videoUrl || '') + '" placeholder="https://.../video.mp4"></label>' +
          '</div>' +
          '<div class="aylen-form-section">' +
            '<h3>Card + Royal Mail</h3>' +
            '<label><input type="checkbox" id="vipStockFRoyalMail"' + (item.royalMailPayEnabled ? ' checked' : '') + '> Enable card payment + Royal Mail for this item</label>' +
            '<label class="aylen-label">Delivery fee (£)<input id="vipStockFRoyalFee" class="aylen-input" type="number" min="0" step="0.01" value="' + esc(item.royalMailFeeGbp != null ? item.royalMailFeeGbp : 0) + '"></label>' +
          '</div>' +
          '<div class="aylen-form-actions">' +
            '<p id="vipStockSaveStatus" class="aylen-hint aylen-vip-save-status" role="status" style="flex:1 1 100%;margin:0"></p>' +
            '<button type="button" id="vipStockSaveBtn" class="aylen-btn aylen-btn-primary" data-vip-save="1"><i class="fas fa-save"></i> Save item</button>' +
            '<button type="button" class="aylen-btn aylen-btn-secondary" data-aylen-close>Cancel</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function orderStatusOptions(current) {
    var opts = ['requested', 'confirmed', 'paid', 'ready', 'delivered', 'cancelled'];
    return opts.map(function(s) {
      return '<option value="' + s + '"' + (String(current).toLowerCase() === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
  }

  async function loadPanelData() {
    var defaults = {
      discountCode: 'VIPSTOCK',
      discountPercent: 10,
      telegramUrl: '',
      whatsappUrl: '',
      monthlyPriceGbp: 9.99,
      displayMemberCount: 24,
      foundingMemberLimit: 50,
      carouselImages: []
    };
    var subscribers = [];
    var stock = [];
    var settings = defaults;
    var liveStats = null;
    var orders = [];
    var loadError = '';

    if (global.FBDB.isAdmin && global.FBDB.isAdmin() && global.FBDB.loadVipAdminPanelData) {
      try {
        var pack = await global.FBDB.loadVipAdminPanelData();
        return {
          subscribers: pack.subscribers || [],
          stock: pack.stock || [],
          settings: Object.assign({}, defaults, pack.settings || {}),
          liveStats: pack.liveStats || null,
          orders: pack.orders || [],
          loadError: ''
        };
      } catch (apiErr) {
        loadError = String(apiErr && apiErr.message || apiErr || '');
        console.warn('[VIP admin] API load:', loadError);
      }
    }

    try {
      subscribers = await global.FBDB.loadVipSubscribers();
    } catch (err) {
      if (!loadError) loadError = String(err && err.message || err);
    }
    try {
      stock = await global.FBDB.loadVipStockItems();
    } catch (err) {
      if (!loadError) loadError = String(err && err.message || err);
    }
    try {
      settings = await global.FBDB.loadVipSettings();
    } catch (err) {
      var authOnly = /Admin Firebase login required/i.test(String(err && err.message || ''));
      if (!authOnly && !loadError) loadError = String(err && err.message || err);
    }
    if (!orders.length && global.FBDB.loadVipOrdersAdmin) {
      try {
        orders = await global.FBDB.loadVipOrdersAdmin(200);
      } catch (err) {
        if (!loadError) loadError = String(err && err.message || err);
      }
    }

    return { subscribers: subscribers, stock: stock, settings: settings, liveStats: liveStats, orders: orders, loadError: loadError };
  }

  async function renderPanel(mount) {
    if (!mount) return;
    mount.innerHTML = '<p class="aylen-hint">Loading VIP data…</p>';
    if (!global.FBDB || !global.FBDB.loadVipSubscribers) {
      mount.innerHTML = '<p class="aylen-hint">VIP module not ready. Refresh and log in again.</p>';
      return;
    }

    var panelData;
    try {
      panelData = await loadPanelData();
    } catch (err) {
      mount.innerHTML = '<p class="aylen-hint">Could not load VIP data: ' + esc(err.message) + '</p>';
      return;
    }

    var subscribers = panelData.subscribers || [];
    var stock = panelData.stock || [];
    var settings = panelData.settings || {};
    var liveStats = panelData.liveStats || {};
    var orders = panelData.orders || [];
    var loadError = panelData.loadError || '';

    var active = subscribers.filter(function(r) { return String(r.status).toLowerCase() === 'active'; }).length;
    var cancelled = subscribers.filter(function(r) { return String(r.status).toLowerCase() === 'cancelled'; }).length;
    var pastDue = subscribers.filter(function(r) { return String(r.status).toLowerCase() === 'past_due'; }).length;
    var displayCount = settings.displayMemberCount != null ? settings.displayMemberCount : 24;
    var publicCount = active > 0 ? active : displayCount;
    var onlineNow = liveStats.onlineVisitors != null ? liveStats.onlineVisitors : '—';
    var activeCarts = liveStats.activeCarts != null ? liveStats.activeCarts : '—';
    var vipLive = liveStats.vipActive != null ? liveStats.vipActive : active;
    var hubCarouselText = carouselToText(settings.hubCarouselImages && settings.hubCarouselImages.length
      ? settings.hubCarouselImages
      : ((global.AYLEN_VIP_CAROUSEL_DEFAULTS && global.AYLEN_VIP_CAROUSEL_DEFAULTS.DEFAULT_VIP_HUB_CAROUSEL) || []));
    var menuTg = settings.menuTelegramUrl || 'https://t.me/aylensale';
    var menuWa = settings.menuWhatsappUrl || '';
    var tg = settings.telegramOverride || '';
    var wa = settings.whatsappOverride || '';

    var subRows = subscribers.map(function(r) {
      var paid = r.lastPaymentAt || r.createdAt || '';
      return '<tr>' +
        '<td>' + esc(r.email) + '</td>' +
        '<td>' + statusBadge(r.status) + (r.cancelAtPeriodEnd ? ' <small>(ends)</small>' : '') + '</td>' +
        '<td>' + formatDate(paid) + '</td>' +
        '<td>' + formatDate(r.currentPeriodEnd) + '</td>' +
        '<td>' + esc(r.phone || '—') + '</td>' +
        '<td><small>' + esc(r.stripeSubscriptionId || '—') + '</small></td>' +
        '</tr>';
    }).join('');

    vipStockCacheList = stock;

    var stockRows = stock.map(function(item) {
      var rm = item.royalMailPayEnabled ? 'RM' : '';
      var qty = item.stock != null ? Number(item.stock) : '—';
      var views = Number(item.viewCount || 0);
      var img = thumb((item.images && item.images[0]) || item.imageUrl || '');
      var searchKey = [item.title, item.category, item.id].join(' ').toLowerCase();
      return '<tr class="aylen-row-clickable" data-vip-stock-row="1" data-vip-search="' + esc(searchKey) + '" onclick="if(!event.target.closest(\'button,input\'))AyelenAdminVip.editStock(' + JSON.stringify(String(item.id)) + ')">' +
        '<td><img src="' + esc(img) + '" width="40" height="40" alt="" loading="lazy"></td>' +
        '<td><b>' + esc(item.title) + '</b><br><small class="aylen-hint">' + esc(item.categoryLabel || item.category || 'General') + ' · ' + views + ' views</small></td>' +
        '<td>£' + esc(Number(item.vipPrice || 0).toFixed(2)) + '</td>' +
        '<td>' + esc(qty) + '</td>' +
        '<td>' + esc(item.stockStatus || 'available') + (rm ? ' · ' + rm : '') + '</td>' +
        '<td class="aylen-row-actions" onclick="event.stopPropagation()">' +
          '<button type="button" class="aylen-btn aylen-btn-quiet aylen-btn-sm" onclick="AyelenAdminVip.editStock(' + JSON.stringify(String(item.id)) + ')">Edit</button> ' +
          '<button type="button" class="aylen-btn aylen-btn-danger aylen-btn-sm" onclick="AyelenAdminVip.deleteStock(' + JSON.stringify(String(item.id)) + ')">Delete</button>' +
        '</td></tr>';
    }).join('');

    var orderRows = orders.map(function(o) {
      var noteVal = esc(o.adminNote || '');
      var trackVal = esc(o.royalMailTracking || '');
      var payLine = o.paymentStatus ? esc(o.paymentStatus) : '—';
      var delLine = o.deliveryMethod === 'royal_mail' ? 'Royal Mail' : esc(o.deliveryMethod || 'pickup');
      var shipLine = '—';
      if (o.shipping && o.shipping.name) {
        shipLine = esc(o.shipping.name) + ', ' + esc(o.shipping.city || '') + ' ' + esc(o.shipping.postcode || '');
        if (o.shipping.line1) shipLine = esc(o.shipping.name) + '<br><small>' + esc(o.shipping.line1) + ', ' + esc(o.shipping.city || '') + ' ' + esc(o.shipping.postcode || '') + '</small>';
      }
      var total = o.totalGbp != null ? o.totalGbp : o.vipPrice;
      return '<tr>' +
        '<td><b>' + esc(o.orderNumber || o.id) + '</b><br><small>' + formatDate(o.createdAt) + '</small></td>' +
        '<td>' + esc(o.email || '—') + '</td>' +
        '<td>' + esc(o.itemTitle || '—') + '<br><small>£' + esc(Number(total || 0).toFixed(2)) + ' · ' + esc(o.channel || '') + ' · ' + payLine + '</small></td>' +
        '<td>' + delLine + '<br><small>' + shipLine + '</small></td>' +
        '<td><select class="aylen-input aylen-input-sm" id="vipOrdSt_' + esc(o.id) + '">' + orderStatusOptions(o.status) + '</select></td>' +
        '<td><input class="aylen-input aylen-input-sm" id="vipOrdTrack_' + esc(o.id) + '" value="' + trackVal + '" placeholder="Royal Mail tracking"></td>' +
        '<td><input class="aylen-input aylen-input-sm" id="vipOrdNote_' + esc(o.id) + '" value="' + noteVal + '" placeholder="Note for client…"></td>' +
        '<td><button type="button" class="aylen-btn aylen-btn-sm" onclick="AyelenAdminVip.saveOrder(' + JSON.stringify(String(o.id)) + ')">Save</button></td>' +
        '</tr>';
    }).join('');

    mount.innerHTML =
      (loadError && /permission|storage|unauthorized/i.test(loadError)
        ? '<div class="aylen-alert aylen-alert--error"><span class="aylen-label">Firebase permissions</span>' +
            '<p class="aylen-hint" style="margin:8px 0 0">Опубликуйте <b>firestore.rules</b> и <b>storage.rules</b> в Firebase Console, затем hard refresh.</p></div>'
        : '') +
      (global.FBDB && global.FBDB.isAdmin && !global.FBDB.isAdmin()
        ? '<div class="aylen-alert aylen-alert--warn"><span class="aylen-label">Admin login</span>' +
            '<p class="aylen-hint" style="margin:8px 0 0">Войдите через Firebase (Admin panel внизу сайта).</p></div>'
        : '') +
      '<h2 class="aylen-page-title">VIP Members</h2>' +
      '<p class="aylen-hint">Подписка £9.99/мес, VIP stock, заказы и настройки — в том же стиле, что и основной CMS.</p>' +
      '<nav class="aylen-vip-subnav" aria-label="VIP sections">' +
        vipSubnavBtn('overview', 'Overview', 'gauge-high', null) +
        vipSubnavBtn('stock', 'VIP Stock', 'boxes-stacked', stock.length) +
        vipSubnavBtn('orders', 'VIP Orders', 'receipt', orders.length) +
        vipSubnavBtn('members', 'Subscribers', 'users', active) +
        vipSubnavBtn('settings', 'Settings', 'gear', null) +
      '</nav>' +

      '<section class="aylen-vip-panel' + (vipAdminTab === 'overview' ? ' is-active' : '') + '" data-vip-admin-panel="overview"' + (vipAdminTab === 'overview' ? '' : ' hidden') + '>' +
        '<div class="aylen-dash-grid">' +
          '<div class="aylen-panel-card aylen-vip-stat"><span class="aylen-label">Active subscribers</span><strong style="color:#00ff88">' + active + '</strong></div>' +
          '<div class="aylen-panel-card aylen-vip-stat"><span class="aylen-label">Est. MRR</span><strong style="color:#fcd34d">£' + calcMrr(subscribers) + '</strong></div>' +
          '<div class="aylen-panel-card aylen-vip-stat"><span class="aylen-label">VIP stock items</span><strong style="color:#38bdf8">' + stock.length + '</strong></div>' +
          '<div class="aylen-panel-card aylen-vip-stat"><span class="aylen-label">Open orders</span><strong style="color:#a78bfa">' + orders.length + '</strong></div>' +
          '<div class="aylen-panel-card aylen-vip-stat"><span class="aylen-label">Online now</span><strong>' + esc(onlineNow) + '</strong></div>' +
          '<div class="aylen-panel-card aylen-vip-stat"><span class="aylen-label">Past due</span><strong style="color:#f87171">' + pastDue + '</strong></div>' +
        '</div>' +
        '<div class="aylen-vip-quick">' +
          '<button type="button" class="aylen-btn" onclick="AyelenAdminVip.goTab(\'stock\');AyelenAdminVip.addStock()"><i class="fas fa-plus"></i> Add VIP item</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminVip.goTab(\'orders\')"><i class="fas fa-receipt"></i> VIP orders</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminVip.openMemberPreview(\'/vip-member-preview.html\')"><i class="fas fa-eye"></i> UI demo</button>' +
          '<button type="button" class="aylen-btn aylen-btn-outline" onclick="AyelenAdminVip.openMemberPreview(\'/vip-live-preview.html\')"><i class="fas fa-box-open"></i> Посмотреть VIP stock</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminVip.openMemberPreview(\'/vip-stock.html\')"><i class="fas fa-lock-open"></i> Paywall</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.go(\'products\')"><i class="fas fa-box"></i> Shop products</button>' +
        '</div>' +
        '<details class="aylen-panel-card aylen-vip-help">' +
          '<summary>Краткая инструкция</summary>' +
          '<ol>' +
            '<li><b>VIP Stock</b> — товары для подписчиков (фото, qty, Royal Mail toggle).</li>' +
            '<li><b>VIP Orders</b> — Buy / Pay &amp; Royal Mail → статус + tracking.</li>' +
            '<li><b>Settings</b> — скидка VIPSTOCK, carousel, ссылки Telegram/WhatsApp.</li>' +
          '</ol></details>' +
      '</section>' +

      '<section class="aylen-vip-panel' + (vipAdminTab === 'stock' ? ' is-active' : '') + '" data-vip-admin-panel="stock"' + (vipAdminTab === 'stock' ? '' : ' hidden') + '>' +
        '<div class="aylen-toolbar aylen-toolbar-sticky">' +
          '<button type="button" class="aylen-btn" onclick="AyelenAdminVip.addStock()"><i class="fas fa-plus"></i> VIP item</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminVip.seedStarterStock()">Seed 25</button>' +
          '<input type="search" id="vipStockSearch" class="aylen-input" placeholder="Search stock…">' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminVip.refreshVipPanel()">Reload</button>' +
        '</div>' +
        '<div class="aylen-table-wrap"><table class="aylen-table aylen-table-compact-vip"><thead><tr>' +
          '<th></th><th>Title</th><th>VIP £</th><th>Qty</th><th>Status</th><th></th>' +
        '</tr></thead><tbody id="vipStockTableBody">' +
          (stockRows || '<tr><td colspan="6">No VIP stock — click <b>+ VIP item</b> or Seed 25.</td></tr>') +
        '</tbody></table></div>' +
      '</section>' +

      '<section class="aylen-vip-panel' + (vipAdminTab === 'orders' ? ' is-active' : '') + '" data-vip-admin-panel="orders"' + (vipAdminTab === 'orders' ? '' : ' hidden') + '>' +
        '<p class="aylen-hint" style="margin-bottom:12px">requested → confirmed → paid → ready → delivered. Tracking — Royal Mail номер.</p>' +
        '<div class="aylen-table-wrap"><table class="aylen-table aylen-table-compact-vip"><thead><tr>' +
          '<th>Order</th><th>Member</th><th>Item</th><th>Delivery</th><th>Status</th><th>Tracking</th><th>Note</th><th></th>' +
        '</tr></thead><tbody>' +
          (orderRows || '<tr><td colspan="8">No VIP orders yet.</td></tr>') +
        '</tbody></table></div>' +
      '</section>' +

      '<section class="aylen-vip-panel' + (vipAdminTab === 'members' ? ' is-active' : '') + '" data-vip-admin-panel="members"' + (vipAdminTab === 'members' ? '' : ' hidden') + '>' +
        '<div class="aylen-table-wrap"><table class="aylen-table"><thead><tr>' +
          '<th>Email</th><th>Status</th><th>Last payment</th><th>Next billing</th><th>Phone</th><th>Stripe sub</th>' +
        '</tr></thead><tbody>' +
          (subRows || '<tr><td colspan="6">No subscribers — share /vip-stock.html</td></tr>') +
        '</tbody></table></div>' +
      '</section>' +

      '<section class="aylen-vip-panel' + (vipAdminTab === 'settings' ? ' is-active' : '') + '" data-vip-admin-panel="settings"' + (vipAdminTab === 'settings' ? '' : ' hidden') + '>' +
        '<div class="aylen-panel-card">' +
          '<span class="aylen-label">VIP settings</span>' +
          '<div class="aylen-form-row" style="margin-top:10px">' +
            '<label class="aylen-label">Discount code<input id="vipSetCode" class="aylen-input" value="' + esc(settings.discountCode) + '"></label>' +
            '<label class="aylen-label">Discount %<input id="vipSetPct" class="aylen-input" type="number" min="0" max="50" value="' + esc(settings.discountPercent) + '"></label>' +
            '<label class="aylen-label">Member counter<input id="vipSetCount" class="aylen-input" type="number" min="0" max="9999" value="' + esc(displayCount) + '"></label>' +
            '<label class="aylen-label">Founding limit<input id="vipSetLimit" class="aylen-input" type="number" min="1" max="9999" value="' + esc(settings.foundingMemberLimit || 50) + '"></label>' +
          '</div>' +
          '<div class="aylen-form-row">' +
            '<label class="aylen-label">Telegram <small class="aylen-hint">(empty = menu)</small><input id="vipSetTg" class="aylen-input" value="' + esc(tg) + '"></label>' +
            '<label class="aylen-label">WhatsApp<input id="vipSetWa" class="aylen-input" value="' + esc(wa) + '"></label>' +
          '</div>' +
          '<label class="aylen-label">Hub carousel (Amazon warehouse)<textarea id="vipSetHubCarousel" class="aylen-input" rows="3" placeholder="Member hub hero — warehouse, pallets, returns">' + esc(hubCarouselText) + '</textarea></label>' +
          '<div class="aylen-toolbar" style="margin:-4px 0 12px">' +
            '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminVip.applyWarehouseHubCarousel()"><i class="fas fa-warehouse"></i> Warehouse hub defaults</button>' +
            '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminVip.applyWarehousePaywallCarousel()"><i class="fas fa-images"></i> Paywall defaults</button>' +
            '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminVip.applyAllWarehouseCarousels()"><i class="fas fa-boxes-stacked"></i> Both carousels</button>' +
          '</div>' +
          '<label class="aylen-label">Hub video URL<input id="vipSetHubVideo" class="aylen-input" value="' + esc(settings.hubVideoUrl || '') + '"></label>' +
          '<label class="aylen-label">Paywall carousel (warehouse)<textarea id="vipSetCarousel" class="aylen-input" rows="3">' + esc(carouselToText(settings.carouselImages)) + '</textarea></label>' +
          '<input type="hidden" id="vipSetMenuTg" value="' + esc(menuTg) + '">' +
          '<input type="hidden" id="vipSetMenuWa" value="' + esc(menuWa) + '">' +
          '<button type="button" class="aylen-btn" style="margin-top:10px" onclick="AyelenAdminVip.saveSettings()"><i class="fas fa-save"></i> Save settings</button>' +
        '</div>' +
      '</section>';

    bindVipAdminNav();
  }

  async function saveSettings() {
    var code = (document.getElementById('vipSetCode') || {}).value;
    var pct = (document.getElementById('vipSetPct') || {}).value;
    var count = (document.getElementById('vipSetCount') || {}).value;
    var limit = (document.getElementById('vipSetLimit') || {}).value;
    var tg = (document.getElementById('vipSetTg') || {}).value;
    var wa = (document.getElementById('vipSetWa') || {}).value;
    var menuTg = (document.getElementById('vipSetMenuTg') || {}).value;
    var menuWa = (document.getElementById('vipSetMenuWa') || {}).value;
    var carousel = (document.getElementById('vipSetCarousel') || {}).value || '';
    var hubCarousel = (document.getElementById('vipSetHubCarousel') || {}).value || '';
    var hubVideo = (document.getElementById('vipSetHubVideo') || {}).value || '';
    try {
      await global.FBDB.saveVipSettings({
        discountCode: code,
        discountPercent: pct,
        displayMemberCount: count,
        foundingMemberLimit: limit,
        telegramUrl: tg,
        whatsappUrl: wa,
        menuTelegramUrl: menuTg,
        menuWhatsappUrl: menuWa,
        carouselImages: carousel.split(/[\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean),
        hubCarouselImages: hubCarousel.split(/[\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean),
        hubVideoUrl: hubVideo
      });
      var cleanCode = String(code || 'VIPSTOCK').trim().toUpperCase();
      if (global.FBDB.saveCard && cleanCode) {
        await global.FBDB.saveCard(cleanCode, {
          discount: Number(pct || 10),
          status: 'active',
          active: true
        });
      }
      notifyMsg('VIP settings saved (discount synced to shop)', 'success');
      vipAdminTab = 'settings';
    } catch (err) {
      notifyMsg(mapVipSaveError(err && err.message), 'error');
    }
  }

  async function saveOrder(orderId) {
    var statusEl = document.getElementById('vipOrdSt_' + orderId);
    var noteEl = document.getElementById('vipOrdNote_' + orderId);
    var trackEl = document.getElementById('vipOrdTrack_' + orderId);
    if (!global.FBDB || !global.FBDB.updateVipOrderAdmin) {
      notifyMsg('Order API not loaded — refresh admin', 'error');
      return;
    }
    try {
      await global.FBDB.updateVipOrderAdmin(orderId, {
        status: statusEl ? statusEl.value : '',
        adminNote: noteEl ? noteEl.value : '',
        royalMailTracking: trackEl ? trackEl.value : ''
      });
      notifyMsg('Order updated — client sees new status in My Orders', 'success');
    } catch (err) {
      notifyMsg(err.message || 'Could not update order', 'error');
    }
  }

  function goTab(tab) {
    vipAdminTab = tab || 'overview';
    var mount = document.getElementById('aylenVipMount');
    if (mount && mount.querySelector('[data-vip-admin-panel]')) {
      activateVipTab(vipAdminTab);
      return;
    }
    refreshVipPanel();
  }

  function openMemberPreview(url) {
    global.open(url, '_blank', 'noopener,noreferrer');
  }

  function applyWarehouseHubCarousel() {
    var urls = (global.AYLEN_VIP_CAROUSEL_DEFAULTS && global.AYLEN_VIP_CAROUSEL_DEFAULTS.DEFAULT_VIP_HUB_CAROUSEL) || [];
    var field = document.getElementById('vipSetHubCarousel');
    if (!field) return;
    field.value = urls.join('\n');
    notifyMsg('Amazon warehouse hub carousel loaded — click Save settings', 'info');
  }

  function applyWarehousePaywallCarousel() {
    var urls = (global.AYLEN_VIP_CAROUSEL_DEFAULTS && global.AYLEN_VIP_CAROUSEL_DEFAULTS.DEFAULT_VIP_PAYWALL_CAROUSEL) || [];
    var field = document.getElementById('vipSetCarousel');
    if (!field) return;
    field.value = urls.join('\n');
    notifyMsg('Warehouse paywall carousel loaded — click Save settings', 'info');
  }

  function applyAllWarehouseCarousels() {
    applyWarehouseHubCarousel();
    applyWarehousePaywallCarousel();
    notifyMsg('Hub + paywall warehouse slides loaded — click Save settings', 'info');
  }

  function applyMarioHubCarousel() {
    applyWarehouseHubCarousel();
  }

  async function refreshVipPanel() {
    var mount = document.getElementById('aylenVipMount');
    if (mount && global.AyelenAdminVip && global.AyelenAdminVip.renderPanel) {
      await renderPanel(mount);
    } else if (global.AyelenAdminDashboard && global.AyelenAdminDashboard.go) {
      global.AyelenAdminDashboard.go('vipmembers');
    }
  }

  function openStockModal(item) {
    item = item || {};
    vipStockSaveInFlight = false;
    vipStockModalId = 'vipStockModal_' + (item.id || 'new');
    var html = buildStockEditorHtml(vipStockModalId, item);
    if (typeof openAdminModal !== 'function') {
      notifyMsg('Admin modal not loaded — refresh page', 'error');
      return;
    }
    var afterOpen = function(panel) {
      bindStockModalActions(panel);
      try {
        resetVipPhotoState(item);
      } catch (photoErr) {
        console.warn('[VIP stock] photo preview init:', photoErr);
      }
      setVipSaveStatus('', '');
    };
    var opened = openAdminModal(html, vipStockModalId, afterOpen);
    if (opened && typeof opened.then === 'function') {
      opened.then(function() {
        bindStockModalActions();
      });
    }
  }

  function closeStockModal() {
    if (vipStockModalId && typeof closeAdminModal === 'function') {
      closeAdminModal(vipStockModalId);
    }
    vipStockModalId = null;
  }

  async function saveStockModal() {
    if (vipStockSaveInFlight) {
      notifyMsg('Save already in progress…', 'info');
      return;
    }
    if (!global.FBDB || !global.FBDB.saveVipStockItem) {
      notifyMsg('Save module not loaded — refresh admin (hard refresh)', 'error');
      return;
    }

    var titleEl = stockField('vipStockFTitle');
    var title = titleEl && 'value' in titleEl ? String(titleEl.value || '').trim() : fieldVal('vipStockFTitle').trim();
    if (!title) {
      notifyMsg('Title required — enter a product name', 'error');
      if (titleEl && titleEl.focus) titleEl.focus();
      return;
    }

    vipStockSaveInFlight = true;
    setVipSaveBusy(true);
    setVipSaveStatus('Saving VIP item…', 'info');
    notifyMsg('Saving VIP item…', 'info');

    var id = fieldVal('vipStockFId');
    var cat = fieldVal('vipStockFCat') || 'general';
    var itemId = id || ('vip_' + Date.now());

    try {
      if (global.FBDB.ensureAdminSession) {
        await withTimeout(global.FBDB.ensureAdminSession(), 20000, 'Admin login timed out — open Admin panel and sign in again');
      }
      if (global.FBDB.isAdmin && !global.FBDB.isAdmin()) {
        throw new Error('Admin Firebase login required. Log in via Admin panel and try again.');
      }

      var images = await withTimeout(uploadVipPendingPhotos(itemId), 120000, 'Photo upload timed out');
      var fallbackImg = fieldVal('vipStockFImg').trim();
      if (!images.length && fallbackImg) images = [fallbackImg];

      await withTimeout(global.FBDB.saveVipStockItem({
        id: itemId,
        title: title,
        desc: fieldVal('vipStockFDesc'),
        vipPrice: Number(fieldVal('vipStockFPrice') || 0),
        category: cat,
        categoryLabel: cat.charAt(0).toUpperCase() + cat.slice(1),
        stock: Number(fieldVal('vipStockFQty') || 0),
        stockStatus: fieldVal('vipStockFStatus') || 'available',
        badge: fieldVal('vipStockFBadge') || 'VIP',
        sortOrder: Number(fieldVal('vipStockFSort') || 0),
        images: images,
        imageUrl: images[0] || fallbackImg || '',
        videoUrl: fieldVal('vipStockFVideo'),
        visible: fieldChecked('vipStockFVisible', true),
        royalMailPayEnabled: fieldChecked('vipStockFRoyalMail', false),
        royalMailFeeGbp: Number(fieldVal('vipStockFRoyalFee') || 0),
        viewCount: vipStockPhotoState.viewCount
      }), 30000, 'Save timed out — check connection and try again');

      notifyMsg('VIP item saved', 'success');
      closeStockModal();
      vipAdminTab = 'stock';
      await refreshVipPanel();
    } catch (err) {
      var msg = mapVipSaveError(err && err.message);
      if (/timed out/i.test(String(err && err.message || ''))) {
        msg = msg + ' (проверьте интернет и вход admin)';
      }
      notifyMsg(msg, 'error');
      console.error('[VIP stock save]', err);
    } finally {
      vipStockSaveInFlight = false;
      setVipSaveBusy(false);
    }
  }

  async function addStock() {
    openStockModal({});
  }

  async function editStock(id) {
    var item = vipStockCacheList.find(function(x) { return String(x.id) === String(id); });
    if (!item && global.FBDB && global.FBDB.loadVipStockItems) {
      var items = await global.FBDB.loadVipStockItems();
      item = items.find(function(x) { return String(x.id) === String(id); });
    }
    if (!item) {
      notifyMsg('VIP item not found', 'error');
      return;
    }
    openStockModal(item);
  }

  async function deleteStock(id) {
    if (!confirm('Delete this VIP stock item?')) return;
    try {
      await global.FBDB.deleteVipStockItem(id);
      notifyMsg('Deleted', 'success');
      vipAdminTab = 'stock';
      await refreshVipPanel();
    } catch (err) {
      notifyMsg(err.message || 'Delete failed', 'error');
    }
  }

  async function seedStarterStock() {
    if (!global.FBDB || !global.FBDB.seedVipStarterStock) {
      notifyMsg('Seed module not loaded. Refresh admin.', 'error');
      return;
    }
    var force = false;
    try {
      var existing = vipStockCacheList.length
        ? vipStockCacheList
        : await global.FBDB.loadVipStockItems();
      if (existing.length) {
        if (!confirm('Already ' + existing.length + ' VIP items. Add 25 starter items anyway?')) return;
        force = true;
      }
      var n = await global.FBDB.seedVipStarterStock(force);
      notifyMsg('Added ' + n + ' VIP starter items', 'success');
      vipAdminTab = 'stock';
      await refreshVipPanel();
    } catch (err) {
      notifyMsg(mapVipSaveError(err.message), 'error');
    }
  }

  global.AyelenAdminVip = {
    renderPanel: renderPanel,
    goTab: goTab,
    refreshVipPanel: refreshVipPanel,
    saveSettings: saveSettings,
    saveOrder: saveOrder,
    openStockModal: openStockModal,
    closeStockModal: closeStockModal,
    saveStockModal: runSaveStockModal,
    saveStockItem: runSaveStockModal,
    addStock: addStock,
    editStock: editStock,
    deleteStock: deleteStock,
    seedStarterStock: seedStarterStock,
    openMemberPreview: openMemberPreview,
    applyWarehouseHubCarousel: applyWarehouseHubCarousel,
    applyWarehousePaywallCarousel: applyWarehousePaywallCarousel,
    applyAllWarehouseCarousels: applyAllWarehouseCarousels,
    applyMarioHubCarousel: applyMarioHubCarousel,
    removeVipPhoto: function(idx) {
      vipStockPhotoState.existing.splice(idx, 1);
      renderVipPhotoPreview(true);
    },
    removeVipPendingPhoto: removeVipPendingThumb
  };
})(window);
