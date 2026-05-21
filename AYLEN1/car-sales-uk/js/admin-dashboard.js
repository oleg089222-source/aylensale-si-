/**
 * Lightweight admin — one panel at a time, paginated Firestore reads, no heavy UI.
 */
(function(global) {
  var currentPanel = 'dashboard';
  var shellReady = false;
  var adminPage = 1;
  var adminPageSize = 40;
  var adminRows = [];
  var adminLastDoc = null;
  var adminHasMore = false;
  var adminLoading = false;
  var adminPageCursors = [null];
  var selectedProductIds = {};
  var panelLoaded = {};

  function $(id) { return document.getElementById(id); }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
  }

  function thumb(url) {
    return global.AYLEN_IMAGES ? global.AYLEN_IMAGES.productThumbUrl(url, 56) : url;
  }

  function escape(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s || '');
  }

  function setPerfMode(on) {
    document.body.classList.toggle('admin-lite', !!on);
    document.body.classList.toggle('admin-dashboard-open', !!on);
    if (on) {
      document.documentElement.classList.remove('motion-ready');
      if (global.AYLEN_PERF && global.AYLEN_PERF.pauseEngagement) global.AYLEN_PERF.pauseEngagement();
    } else if (global.AYLEN_PERF && global.AYLEN_PERF.resumeEngagement) {
      global.AYLEN_PERF.resumeEngagement();
    }
  }

  function minimalShell() {
    return (
      '<div id="aylenAdminShell" class="aylen-shell">' +
      '<aside class="aylen-side">' +
      '<div class="aylen-side-title">AYLENSALE</div>' +
      '<nav class="aylen-side-nav" id="aylenAdminNav">' +
      sideLink('dashboard', 'Dashboard') +
      sideLink('products', 'Products') +
      sideLink('auctions', 'Auctions') +
      sideLink('orders', 'Notifications') +
      sideLink('policies', 'Policies') +
      sideLink('settings', 'Settings') +
      sideLink('backup', 'Backup') +
      '</nav>' +
      '</aside>' +
      '<div class="aylen-main">' +
      '<header class="aylen-top">' +
      '<strong id="aylenPanelTitle">Dashboard</strong>' +
      '<div class="aylen-top-actions">' +
      '<button type="button" class="aylen-btn" onclick="openAddProductModal()">+ Product</button>' +
      '<button type="button" class="aylen-btn" onclick="openNotifyRequestsModal()">Notify</button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.close()">Close</button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="toggleAdminMode()">Exit</button>' +
      '</div></header>' +
      '<div class="aylen-body" id="aylenAdminBody"></div>' +
      '</div></div>'
    );
  }

  function sideLink(id, label) {
    return '<button type="button" data-panel="' + id + '" onclick="AyelenAdminDashboard.go(\'' + id + '\')">' + label + '</button>';
  }

  function ensureShell() {
    if (shellReady) return;
    document.body.insertAdjacentHTML('beforeend', minimalShell());
    shellReady = true;
  }

  function setTitle(text) {
    var t = $('aylenPanelTitle');
    if (t) t.textContent = text;
  }

  function clearBody() {
    var body = $('aylenAdminBody');
    if (body) body.innerHTML = '';
    return body;
  }

  async function loadPanel(panel) {
    panelLoaded[panel] = true;
    var body = clearBody();
    if (!body) return;

    if (panel === 'dashboard') {
      setTitle('Dashboard');
      body.innerHTML =
        '<div class="aylen-stats" id="aylenDashStats"></div>' +
        '<p class="aylen-hint">Fast mode: products load in pages. Use Products for edits.</p>' +
        '<button type="button" class="aylen-btn" onclick="AyelenAdminDashboard.go(\'products\')">Open products</button>';
      renderDashboardStats();
      return;
    }

    if (panel === 'products') {
      setTitle('Products');
      body.innerHTML =
        '<div class="aylen-toolbar">' +
        '<input type="search" id="aylenProductsSearch" placeholder="Search loaded rows…">' +
        '<select id="aylenProductsStatus"><option value="">All</option><option value="active">Live</option><option value="hidden">Hidden</option></select>' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.reloadProducts(true)">Reload</button>' +
        '</div>' +
        '<div class="aylen-toolbar">' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.bulkHide(true)">Hide</button>' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.bulkHide(false)">Show</button>' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.bulkDuplicate()">Duplicate</button>' +
        '<button type="button" class="aylen-btn aylen-btn-danger" onclick="AyelenAdminDashboard.bulkDelete()">Delete</button>' +
        '</div>' +
        '<div class="aylen-table-wrap"><table class="aylen-table"><thead><tr>' +
        '<th><input type="checkbox" id="aylenSelectAll" onchange="AyelenAdminDashboard.toggleSelectAll(this.checked)"></th>' +
        '<th></th><th>Title</th><th>SKU</th><th>£</th><th>Stock</th><th>Status</th><th></th>' +
        '</tr></thead><tbody id="aylenProductsTableBody"></tbody></table></div>' +
        '<div class="aylen-pager">' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" id="aylenAdminPrev" onclick="AyelenAdminDashboard.adminPagePrev()">Prev</button>' +
        '<span id="aylenProductsMeta"></span>' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" id="aylenAdminNext" onclick="AyelenAdminDashboard.adminPageNext()">Next</button>' +
        '</div>';
      var search = $('aylenProductsSearch');
      var status = $('aylenProductsStatus');
      if (search) search.addEventListener('input', function() {
        clearTimeout(search._t);
        search._t = setTimeout(renderProductsTable, 200);
      });
      if (status) status.addEventListener('change', renderProductsTable);
      await reloadProducts(false);
      return;
    }

    if (panel === 'auctions') {
      setTitle('Auctions');
      body.innerHTML = '<p class="aylen-hint">Auction cards on the shop page.</p>' +
        '<button class="aylen-btn" onclick="openAddAuctionModal()">+ Auction</button>';
      return;
    }

    if (panel === 'orders') {
      setTitle('Notifications');
      body.innerHTML = '<button class="aylen-btn" onclick="openNotifyRequestsModal()">Open notify queue</button>';
      return;
    }

    if (panel === 'policies') {
      setTitle('Policies');
      body.innerHTML =
        '<p class="aylen-hint">Listing policies for product compliance.</p>' +
        '<button type="button" class="aylen-btn" onclick="openListingPoliciesModal()">Manage policies</button>';
      return;
    }

    if (panel === 'settings') {
      setTitle('Settings');
      body.innerHTML =
        '<div class="aylen-settings-grid">' +
        '<button class="aylen-btn aylen-btn-quiet" onclick="openMarketplaceSettingsModal()">Style</button>' +
        '<button class="aylen-btn aylen-btn-quiet" onclick="openLegalContactSettingsModal()">Legal</button>' +
        '<button class="aylen-btn aylen-btn-quiet" onclick="openEbaySettingsModal()">eBay</button>' +
        '<button class="aylen-btn aylen-btn-quiet" onclick="openCardsModal()">Cards</button>' +
        '</div>';
      return;
    }

    if (panel === 'backup') {
      setTitle('Backup');
      body.innerHTML = '<button class="aylen-btn" onclick="downloadProductionBackup()">Download JSON backup</button>';
    }
  }

  function renderDashboardStats() {
    var el = $('aylenDashStats');
    if (!el) return;
    el.innerHTML =
      '<div class="aylen-stat"><span>Loaded products</span><b>' + (typeof products !== 'undefined' ? products.length : 0) + '</b></div>' +
      '<div class="aylen-stat"><span>Auctions</span><b>' + (typeof auctions !== 'undefined' ? auctions.length : 0) + '</b></div>' +
      '<div class="aylen-stat"><span>Locations</span><b>' + (typeof locations !== 'undefined' ? locations.length : 0) + '</b></div>';
  }

  async function fetchAdminPage(cursor) {
    if (adminLoading) return;
    adminLoading = true;
    var body = $('aylenProductsTableBody');
    if (body) body.innerHTML = '<tr><td colspan="8">Loading…</td></tr>';
    try {
      var catalog = global.AYLEN_FIREBASE_CATALOG;
      if (!catalog || !catalog.loadAdminProductsPage) throw new Error('Paging not ready');
      var res = await catalog.loadAdminProductsPage({
        limit: adminPageSize,
        startAfterDoc: cursor || null
      });
      adminRows = res.items || [];
      adminLastDoc = res.lastDoc;
      adminHasMore = !!res.hasMore;
      renderProductsTable();
    } catch (e) {
      notifyMsg('Load failed: ' + (e.message || e), 'error');
      if (body) body.innerHTML = '<tr><td colspan="8">Error loading</td></tr>';
    } finally {
      adminLoading = false;
    }
  }

  async function reloadProducts(reset) {
    await fetchAdminPage(!!reset);
  }

  function filteredRows() {
    var q = ($('aylenProductsSearch') && $('aylenProductsSearch').value || '').trim().toLowerCase();
    var status = $('aylenProductsStatus') ? $('aylenProductsStatus').value : '';
    var list = adminRows.slice();
    if (q) {
      list = list.filter(function(p) {
        return [p.name, p.sku, p.category, p.id].join(' ').toLowerCase().indexOf(q) !== -1;
      });
    }
    if (status === 'hidden') list = list.filter(function(p) { return p.active === false; });
    if (status === 'active') list = list.filter(function(p) { return p.active !== false; });
    return list;
  }

  function renderProductsTable() {
    var body = $('aylenProductsTableBody');
    var meta = $('aylenProductsMeta');
    if (!body) return;
    var list = filteredRows();
    var lazy = global.AYLEN_IMAGES ? global.AYLEN_IMAGES.lazyImgAttrs() : ' loading="lazy"';
    var html = '';
    list.forEach(function(p) {
      var img = thumb((p.images && p.images[0]) || '');
      var hidden = p.active === false;
      var checked = selectedProductIds[p.id] ? ' checked' : '';
      html += '<tr>' +
        '<td><input type="checkbox"' + checked + ' onchange="AyelenAdminDashboard.toggleSelect(' + jsInlineArg(p.id) + ', this.checked)"></td>' +
        '<td><img src="' + escape(img) + '" width="40" height="40"' + lazy + ' alt=""></td>' +
        '<td>' + escape(p.name) + '</td>' +
        '<td>' + escape(p.sku || '—') + '</td>' +
        '<td>' + (parseFloat(p.price || 0)).toFixed(2) + '</td>' +
        '<td>' + (parseInt(p.stock, 10) || 0) + '</td>' +
        '<td>' + (hidden ? 'Hidden' : 'Live') + '</td>' +
        '<td class="aylen-row-actions">' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.edit(' + jsInlineArg(p.id) + ')">Edit</button>' +
        '</td></tr>';
    });
    body.innerHTML = html || '<tr><td colspan="8">No rows</td></tr>';
    if (meta) meta.textContent = 'Page ' + adminPage + ' · ' + list.length + ' rows' + (adminHasMore ? ' · more available' : '');
    var prev = $('aylenAdminPrev');
    var next = $('aylenAdminNext');
    if (prev) prev.disabled = adminPage <= 1;
    if (next) next.disabled = !adminHasMore;
  }

  function adminPageNext() {
    if (!adminHasMore || adminLoading) return;
    adminPageCursors[adminPage] = adminLastDoc;
    adminPage += 1;
    fetchAdminPage(adminPageCursors[adminPage - 1] || null);
  }

  function adminPagePrev() {
    if (adminPage <= 1 || adminLoading) return;
    adminPage -= 1;
    fetchAdminPage(adminPageCursors[adminPage - 1] || null);
  }

  async function edit(id) {
    if (global.FBDB && global.FBDB.loadProductById) {
      var loaded = await global.FBDB.loadProductById(id);
      if (loaded) {
        var idx = products.findIndex(function(p) { return String(p.id) === String(id); });
        if (idx === -1) products.push(loaded);
        else products[idx] = loaded;
      }
    }
    if (typeof editProduct === 'function') editProduct(id);
  }

  function open() {
    if (global.AYLEN_MODAL && global.AYLEN_MODAL.closeAll) {
      global.AYLEN_MODAL.closeAll({ immediate: true });
    }
    ensureShell();
    var shell = $('aylenAdminShell');
    if (!shell) return;
    shell.classList.add('open');
    setPerfMode(true);
    go(currentPanel || 'dashboard');
    if (typeof startNotifyRequestsWatch === 'function') startNotifyRequestsWatch();
  }

  function close() {
    var shell = $('aylenAdminShell');
    if (shell) shell.classList.remove('open');
    setPerfMode(false);
    if (typeof renderProducts === 'function') renderProducts();
  }

  function go(panel) {
    currentPanel = panel;
    ensureShell();
    document.querySelectorAll('#aylenAdminNav [data-panel]').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-panel') === panel);
    });
    loadPanel(panel);
  }

  function toggleSelect(id, on) {
    if (on) selectedProductIds[id] = true;
    else delete selectedProductIds[id];
  }

  function toggleSelectAll(on) {
    filteredRows().forEach(function(p) {
      if (on) selectedProductIds[p.id] = true;
      else delete selectedProductIds[p.id];
    });
    renderProductsTable();
  }

  function selectedIds() {
    return Object.keys(selectedProductIds).filter(function(k) { return selectedProductIds[k]; });
  }

  function findInRows(id) {
    return adminRows.find(function(p) { return String(p.id) === String(id); }) ||
      products.find(function(p) { return String(p.id) === String(id); });
  }

  function bulkHide(hide) {
    var ids = selectedIds();
    if (!ids.length) return notifyMsg('Select rows first', 'error');
    if (typeof confirmAylenProductionWrite === 'function' && !confirmAylenProductionWrite('bulk update')) return;
    ids.forEach(function(id) {
      var p = findInRows(id);
      if (!p || !global.FBDB || !global.FBDB.updateProduct) return;
      p.active = !hide;
      global.FBDB.updateProduct(p.id, Object.assign({}, p, { active: p.active }));
    });
    notifyMsg('Updated', 'success');
    reloadProducts(true);
  }

  async function bulkDelete() {
    var ids = selectedIds();
    if (!ids.length) return notifyMsg('Select rows first', 'error');
    if (!confirm('Delete ' + ids.length + '?')) return;
    ids.forEach(function(id) {
      if (typeof deleteProductById === 'function') deleteProductById(id);
    });
    selectedProductIds = {};
    reloadProducts(true);
    if (global.FBDB && global.FBDB.refreshCatalogFirstPage) await global.FBDB.refreshCatalogFirstPage();
    if (typeof renderProducts === 'function') renderProducts();
  }

  async function duplicateOne(id) {
    var p = findInRows(id);
    if (!p) return;
    if (typeof addProductWithPhotos !== 'function') return;
    await addProductWithPhotos(
      (p.name || '') + ' (copy)',
      p.desc || '',
      parseFloat(p.price || 0),
      p.category || 'General',
      (p.images || []).slice(),
      parseInt(p.stock, 10) || 0,
      parseFloat(p.wholesale || 0),
      p.policyId || ''
    );
    reloadProducts(true);
  }

  function bulkDuplicate() {
    var ids = selectedIds();
    if (!ids.length) return notifyMsg('Select rows', 'error');
    ids.forEach(function(id) { duplicateOne(id); });
  }

  global.AyelenAdminDashboard = {
    open: open,
    close: close,
    go: go,
    mount: ensureShell,
    isOpen: function() {
      var shell = $('aylenAdminShell');
      return !!(shell && shell.classList.contains('open'));
    },
    currentPanel: function() { return currentPanel; },
    reloadProducts: reloadProducts,
    renderProductsTable: renderProductsTable,
    adminPageNext: adminPageNext,
    adminPagePrev: adminPagePrev,
    toggleSelect: toggleSelect,
    toggleSelectAll: toggleSelectAll,
    bulkHide: bulkHide,
    bulkDelete: bulkDelete,
    bulkDuplicate: bulkDuplicate,
    duplicateOne: duplicateOne,
    edit: edit
  };
})(window);
