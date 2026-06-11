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
  var panelLoading = null;
  var adminViewStats = {};
  var adminViewStatsUnsub = null;
  var adminAuctionViewStats = {};

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

  /** Safe JS string for inline handlers: onclick='fn("id")' — never use JSON inside double-quoted onclick. */
  function jsStr(val) {
    return JSON.stringify(String(val == null ? '' : val));
  }

  function onclickAttr(expr) {
    return ' onclick=\'' + String(expr).replace(/'/g, '&#39;') + '\'';
  }

  /** Safe single-quoted arg for onclick="fn('id')" */
  function jsInlineArg(val) {
    if (typeof global.jsInlineArg === 'function') return global.jsInlineArg(val);
    return "'" + String(val == null ? '' : val).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }

  var PANEL_LABELS = {
    dashboard: 'Dashboard',
    products: 'Products',
    orders: 'Shop Orders',
    auctions: 'Auction Command',
    locations: 'Pickup Locations',
    vipmembers: 'VIP Members',
    pricelist: 'Price List',
    discounts: 'Discount Codes',
    visitcards: 'Visit Cards',
    settings: 'Settings',
    backup: 'Backup'
  };

  var PANEL_SHORTCUTS = [
    'dashboard', 'products', 'orders', 'auctions', 'locations',
    'pricelist', 'discounts', 'visitcards', 'settings', 'backup'
  ];

  function setCmsActive(on) {
    document.documentElement.classList.toggle('aylen-admin-cms-active', !!on);
    document.body.classList.toggle('aylen-admin-cms-active', !!on);
    if (!on && global.AYLEN_SCROLL && global.AYLEN_SCROLL.release) {
      global.AYLEN_SCROLL.release();
    }
  }

  function setPerfMode(on) {
    document.body.classList.toggle('admin-lite', !!on);
    document.body.classList.toggle('admin-dashboard-open', !!on);
    setCmsActive(!!on);
    if (global.AYLEN_PERF) {
      global.AYLEN_PERF.shouldSkipStorefrontRender = function() {
        return !!on;
      };
    }
    if (on) {
      document.documentElement.classList.remove('motion-ready');
      if (global.AYLEN_PERF && global.AYLEN_PERF.pauseEngagement) global.AYLEN_PERF.pauseEngagement();
    } else {
      if (global.FBDB && global.FBDB.detachDiscountCardsListener) {
        global.FBDB.detachDiscountCardsListener();
      }
      if (global.AYLEN_PERF && global.AYLEN_PERF.resumeEngagement) global.AYLEN_PERF.resumeEngagement();
    }
  }

  function minimalShell() {
    return (
      '<div id="aylenAdminShell" class="aylen-shell">' +
      '<aside class="aylen-side">' +
      '<div class="aylen-side-brand"><strong>AYLENSALE</strong><span>Admin CMS</span></div>' +
      '<nav class="aylen-side-nav" id="aylenAdminNav">' +
      sideLink('dashboard', 'Dashboard', 'fa-gauge-high', '1') +
      sideLink('products', 'Products', 'fa-box', '2') +
      sideLink('orders', 'Shop Orders', 'fa-receipt', '3') +
      sideLink('auctions', 'Auction Command', 'fa-chart-line', '4') +
      sideLink('locations', 'Pickup Locations', 'fa-map-pin', '5') +
      sideLink('vipmembers', 'VIP Members', 'fa-crown', 'V') +
      sideLink('pricelist', 'Price List', 'fa-list', '6') +
      sideLink('discounts', 'Discount Codes', 'fa-ticket', '7') +
      sideLink('visitcards', 'Visit Cards', 'fa-id-card', 'C') +
      sideLink('settings', 'Settings', 'fa-gear', '8') +
      sideLink('backup', 'Backup', 'fa-database', '9') +
      '<button type="button" class="aylen-nav-exit" onclick="AyelenAdminDashboard.exitCms()"><i class="fas fa-door-open"></i> Close</button>' +
      '<button type="button" class="aylen-nav-exit aylen-nav-logout" onclick="AyelenAdminDashboard.signOutCompletely()"><i class="fas fa-right-from-bracket"></i> Log out</button>' +
      '</nav></aside>' +
      '<div class="aylen-main">' +
      '<header class="aylen-top">' +
      '<div class="aylen-top-left">' +
      '<h1>AYLENSALE Admin</h1>' +
      '<div class="aylen-top-meta">' +
      '<span class="aylen-pill aylen-pill--live" id="aylenAdminLivePill"><i class="fas fa-circle"></i> Live</span>' +
      '<span class="aylen-pill" id="aylenAdminSyncPill">Sync: checking…</span>' +
      '</div></div>' +
      '<div class="aylen-top-actions">' +
      '<div class="aylen-quick-bar" aria-label="Quick actions">' +
      '<button type="button" class="aylen-btn aylen-btn-quiet aylen-btn-sm" onclick="openAddProductModal()" title="New product (N on Products)"><i class="fas fa-plus"></i><span class="aylen-quick-label"> Product</span></button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet aylen-btn-sm aylen-btn-scan" onclick="openWarehouseScanSafe()" title="Photo box → auto publish"><i class="fas fa-box-open"></i><span class="aylen-quick-label"> Scan</span></button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet aylen-btn-sm" onclick="AyelenAdminDashboard.go(\'orders\')" title="Shop orders (O)"><i class="fas fa-receipt"></i><span class="aylen-quick-label"> Orders</span></button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet aylen-btn-sm" onclick="AyelenAdminDashboard.go(\'discounts\')" title="Discount codes (7)"><i class="fas fa-ticket"></i><span class="aylen-quick-label"> Codes</span></button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet aylen-btn-sm" onclick="AyelenAdminDashboard.go(\'pricelist\')" title="Price list (6)"><i class="fas fa-list"></i><span class="aylen-quick-label"> Price</span></button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet aylen-btn-sm" onclick="AyelenAdminDashboard.go(\'locations\')" title="Pickup (5)"><i class="fas fa-map-pin"></i><span class="aylen-quick-label"> Pickup</span></button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet aylen-btn-sm" onclick="AyelenAdminDashboard.quickVipItem()" title="New VIP item"><i class="fas fa-crown"></i><span class="aylen-quick-label"> VIP</span></button>' +
      '</div>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.showShortcuts()" title="Keyboard shortcuts (?)"><i class="fas fa-keyboard"></i></button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.close()">Close</button>' +
      '</div></header>' +
      '<div class="aylen-body" id="aylenAdminBody"></div>' +
      '</div></div>'
    );
  }

  function sideLink(id, label, icon, shortcut) {
    var ic = icon ? '<i class="fas ' + icon + '" aria-hidden="true"></i>' : '';
    var kbd = shortcut ? '<kbd class="aylen-kbd">' + shortcut + '</kbd>' : '';
    return '<button type="button" data-panel="' + id + '" onclick="AyelenAdminDashboard.go(\'' + id + '\')">' +
      ic + '<span>' + label + '</span>' + kbd + '</button>';
  }

  function isTypingInForm() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function focusPanelSearch() {
    var ids = ['aylenDiscountSearch', 'aylenProductsSearch'];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el) {
        el.focus();
        el.select();
        return true;
      }
    }
    return false;
  }

  function hideOpenEditors() {
    if (global.AyelenAdminDiscounts && global.AyelenAdminDiscounts.hideEditor) {
      var dc = document.getElementById('aylenDiscountEditor');
      if (dc && !dc.classList.contains('is-hidden')) {
        global.AyelenAdminDiscounts.hideEditor();
        return true;
      }
    }
    if (global.AyelenAdminPriceList && global.AyelenAdminPriceList.hideEditor) {
      var pl = document.getElementById('aylenPriceListEditor');
      if (pl && !pl.classList.contains('is-hidden')) {
        global.AyelenAdminPriceList.hideEditor();
        return true;
      }
    }
    return false;
  }

  function triggerPanelNew() {
    if (currentPanel === 'products' && typeof openAddProductModal === 'function') {
      openAddProductModal();
      return;
    }
    if (currentPanel === 'discounts' && global.AyelenAdminDiscounts && global.AyelenAdminDiscounts.showCreate) {
      global.AyelenAdminDiscounts.showCreate();
      return;
    }
    if (currentPanel === 'pricelist' && global.AyelenAdminPriceList && global.AyelenAdminPriceList.showAddForm) {
      global.AyelenAdminPriceList.showAddForm();
      return;
    }
    if (currentPanel === 'auctions' && typeof openAddAuctionModal === 'function') {
      openAddAuctionModal();
      return;
    }
    if (currentPanel === 'locations' && typeof openAddLocationModal === 'function') {
      openAddLocationModal();
      return;
    }
    if (currentPanel === 'vipmembers' && global.AyelenAdminVip && global.AyelenAdminVip.addStock) {
      global.AyelenAdminVip.addStock();
    }
  }

  function quickVipItem() {
    function openAdd() {
      if (global.AyelenAdminVip && global.AyelenAdminVip.goTab) global.AyelenAdminVip.goTab('stock');
      if (global.AyelenAdminVip && global.AyelenAdminVip.addStock) global.AyelenAdminVip.addStock();
    }
    if (currentPanel === 'vipmembers') {
      openAdd();
      return;
    }
    go('vipmembers');
    var n = 0;
    var iv = setInterval(function() {
      n++;
      if (global.AyelenAdminVip && global.AyelenAdminVip.addStock) {
        clearInterval(iv);
        openAdd();
      } else if (n > 80) clearInterval(iv);
    }, 50);
  }

  function setupAdminHotkeys() {
    if (global._aylenAdminHotkeysBound) return;
    global._aylenAdminHotkeysBound = true;
    document.addEventListener('keydown', function(e) {
      if (!global.AyelenAdminDashboard || !global.AyelenAdminDashboard.isOpen()) return;

      if (e.key === 'Escape') {
        if (global.AYLEN_MODAL && global.AYLEN_MODAL.getCurrentId && global.AYLEN_MODAL.getCurrentId()) {
          e.preventDefault();
          global.AYLEN_MODAL.close();
          return;
        }
        if (hideOpenEditors()) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        global.AyelenAdminDashboard.close();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        var saveBtn = document.getElementById('dcSaveBtn') || document.getElementById('aylenPriceListSaveBtn');
        if (saveBtn && !isTypingInForm()) {
          e.preventDefault();
          saveBtn.click();
          return;
        }
        if (isTypingInForm()) {
          e.preventDefault();
          if (document.getElementById('dcSaveBtn')) document.getElementById('dcSaveBtn').click();
          else if (document.getElementById('aylenPriceListSaveBtn')) document.getElementById('aylenPriceListSaveBtn').click();
          return;
        }
      }

      if (isTypingInForm()) return;

      if (e.key === '/' || (e.key === 'f' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        focusPanelSearch();
        return;
      }

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        global.AyelenAdminDashboard.showShortcuts();
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        triggerPanelNew();
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        global.AyelenAdminDashboard.go('vipmembers');
        return;
      }

      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        global.AyelenAdminDashboard.go('orders');
        return;
      }

      var digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= 9 && PANEL_SHORTCUTS[digit - 1]) {
        e.preventDefault();
        global.AyelenAdminDashboard.go(PANEL_SHORTCUTS[digit - 1]);
      }
    });
  }

  function showShortcuts() {
    notifyMsg(
      '1 Dashboard · 2 Products · 3 Orders · 4 Auctions · 5 Pickup · 6 Price list · 7 Codes · 8 Settings · 9 Backup · V VIP · O Orders · N new · / search · Esc close',
      'info'
    );
  }

  function ensureShell() {
    if (shellReady) return;
    document.body.insertAdjacentHTML('beforeend', minimalShell());
    shellReady = true;
    setupAdminHotkeys();
  }

  function setTitle(text) {
    var body = $('aylenAdminBody');
    if (!body) return;
    var existing = body.querySelector('.aylen-page-title');
    if (existing) existing.textContent = text;
  }

  function ensurePageTitle(text) {
    var body = $('aylenAdminBody');
    if (!body) return;
    if (!body.querySelector('.aylen-page-title')) {
      body.insertAdjacentHTML('afterbegin', '<h2 class="aylen-page-title"></h2>');
    }
    setTitle(text);
  }

  function updateTopBar() {
    var sync = $('aylenAdminSyncPill');
    var live = $('aylenAdminLivePill');
    var ready = !!(global.isFirebaseReady && global.FBDB);
    var adminOk = !!(global.FBDB && global.FBDB.isAdmin && global.FBDB.isAdmin());
    if (sync) {
      sync.textContent = ready && adminOk ? 'Sync: connected' : (ready ? 'Sync: Firebase ready' : 'Sync: connecting…');
    }
    if (live) {
      live.innerHTML = '<i class="fas fa-circle"></i> ' + (adminOk ? 'Live' : 'Draft');
      live.classList.toggle('aylen-pill--live', adminOk);
    }
  }

  function clearBody() {
    var body = $('aylenAdminBody');
    if (body) body.innerHTML = '';
    return body;
  }

  async function loadPanel(panel) {
    if (panelLoading === panel) return;
    panelLoading = panel;
    try {
    panelLoaded[panel] = true;
    var body = clearBody();
    if (!body) return;

    if (panel === 'dashboard') {
      body.innerHTML =
        '<h2 class="aylen-page-title">Dashboard</h2>' +
        '<p class="aylen-hint">Store overview. Changes save to Firebase automatically — no manual sync button needed.</p>' +
        '<div class="aylen-dash-grid" id="aylenDashStats"></div>';
      renderDashboardStats();
      updateTopBar();
      return;
    }

    if (panel === 'products') {
      body.innerHTML =
        '<h2 class="aylen-page-title">Products</h2>' +
        '<div class="aylen-toolbar aylen-toolbar-sticky">' +
        '<button type="button" class="aylen-btn" onclick="openAddProductModal()">+ Product</button>' +
        '<button type="button" class="aylen-btn aylen-btn-scan" onclick="openWarehouseScanSafe()" title="Фото коробки → AI → публикация"><i class="fas fa-box-open"></i> Warehouse Scan</button>' +
        '<input type="search" id="aylenProductsSearch" class="aylen-input" placeholder="Search… (press /)">' +
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
        '<th></th><th>Title</th><th>SKU</th><th>£</th><th>Stock</th><th>Views</th><th>Status</th><th></th>' +
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
      attachAdminViewStatsListener();
      if (global.FBDB && global.FBDB.loadProductViewStats) {
        global.FBDB.loadProductViewStats().then(function(map) {
          adminViewStats = map || {};
          renderProductsTable();
        });
      }
      await reloadProducts(false);
      return;
    }

    if (panel === 'auctions') {
      if (global.FBDB && global.FBDB.loadAuctions) {
        try {
          var auctionRows = await global.FBDB.loadAuctions();
          if (typeof global.applyCatalogSnapshot === 'function') {
            global.applyCatalogSnapshot('auctions', auctionRows || [], { fromServer: true });
          }
        } catch (e) {
          notifyMsg('Could not refresh auctions: ' + (e.message || e), 'error');
        }
      }
      await loadAdminAuctionViewStats();
      body.innerHTML = '<div id="aylenAuctionCmdMount"><p class="aylen-hint">Loading command center…</p></div>';
      var aucMount = $('aylenAuctionCmdMount');
      if (global.AyelenAdminAuctions && global.AyelenAdminAuctions.renderPanel && aucMount) {
        await global.AyelenAdminAuctions.renderPanel(aucMount);
      } else if (aucMount) {
        aucMount.innerHTML =
          '<p class="aylen-hint">Auction Command Center did not load. Hard refresh (Cmd+Shift+R) and open Auctions again.</p>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" style="margin-top:10px" onclick="location.reload()">Refresh page</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" style="margin-top:10px;margin-left:8px" onclick="AyelenAdminDashboard.showLegacyAuctionsTable()">Legacy table</button>';
      }
      return;
    }

    if (panel === 'locations') {
      renderLocationsPanel(body);
      return;
    }

    if (panel === 'vipmembers') {
      body.innerHTML = '<div id="aylenVipMount"><p class="aylen-hint">Loading VIP panel…</p></div>';
      var vipMount = $('aylenVipMount');
      var vipReady = await ensureVipAdminModule();
      if (vipReady && global.AyelenAdminVip && global.AyelenAdminVip.renderPanel && vipMount) {
        await global.AyelenAdminVip.renderPanel(vipMount);
      } else if (vipMount) {
        vipMount.innerHTML =
          '<p class="aylen-hint">VIP panel did not load. Refresh the page (hard refresh) and open VIP Members again.</p>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" style="margin-top:10px" onclick="location.reload()">Refresh page</button>';
      }
      return;
    }

    if (panel === 'orders') {
      body.innerHTML = '<h2 class="aylen-page-title">Shop Orders</h2><div id="aylenOrdersMount"><p class="aylen-hint">Loading…</p></div>';
      var ordMount = $('aylenOrdersMount');
      if (global.AyelenAdminOrders && global.AyelenAdminOrders.renderPanel && ordMount) {
        await global.AyelenAdminOrders.renderPanel(ordMount);
      } else if (ordMount) {
        ordMount.innerHTML = '<p class="aylen-hint">Orders module failed to load. Refresh admin.</p>';
      }
      return;
    }

    if (panel === 'pricelist') {
      body.innerHTML = '<h2 class="aylen-page-title">Price List</h2><div id="aylenPriceListMount"></div>';
      var plMount = $('aylenPriceListMount');
      if (global.AyelenAdminPriceList && global.AyelenAdminPriceList.renderPanel && plMount) {
        await global.AyelenAdminPriceList.renderPanel(plMount);
      } else if (plMount) {
        plMount.innerHTML = '<p class="aylen-hint">Price list module failed to load. Refresh and log in again.</p>';
        if (typeof openPriceListAdminModal === 'function') {
          plMount.innerHTML += '<button type="button" class="aylen-btn aylen-btn-quiet" style="margin-top:10px" onclick="openPriceListAdminModal()">Open legacy Price List</button>';
        }
      }
      return;
    }

    if (panel === 'discounts') {
      body.innerHTML = '<h2 class="aylen-page-title">Discount Codes</h2><div id="aylenDiscountsMount"></div>';
      var dcMount = $('aylenDiscountsMount');
      if (global.AyelenAdminDiscounts && global.AyelenAdminDiscounts.renderPanel && dcMount) {
        await global.AyelenAdminDiscounts.renderPanel(dcMount);
        if (global.FBDB && global.FBDB.attachDiscountCardsListener) {
          global.FBDB.attachDiscountCardsListener();
        }
      } else if (dcMount) {
        dcMount.innerHTML = '<p class="aylen-hint">Discount module failed to load. Refresh and log in again.</p>';
        if (typeof openCardsModal === 'function') {
          dcMount.innerHTML += '<button type="button" class="aylen-btn aylen-btn-quiet" style="margin-top:10px" onclick="openCardsModal()">Open legacy Discount Codes</button>';
        }
      }
      return;
    }

    if (panel === 'visitcards') {
      body.innerHTML = '<h2 class="aylen-page-title">Visit Cards</h2><div id="aylenVisitCardsMount"></div>';
      var vcMount = $('aylenVisitCardsMount');
      if (global.AyelenAdminVisitCards && global.AyelenAdminVisitCards.renderPanel && vcMount) {
        await global.AyelenAdminVisitCards.renderPanel(vcMount);
        if (global.FBDB && global.FBDB.attachDiscountCardsListener) {
          global.FBDB.attachDiscountCardsListener();
        }
      } else if (vcMount) {
        vcMount.innerHTML = '<p class="aylen-hint">Visit cards module failed to load. Refresh admin.</p>';
      }
      return;
    }

    if (panel === 'settings') {
      body.innerHTML =
        '<h2 class="aylen-page-title">Settings</h2>' +
        '<div id="aylenPasswordMount"></div>' +
        '<div id="aylenStorageMount" style="margin-top:16px"></div>' +
        '<div class="aylen-settings-grid" style="margin-top:16px">' +
        '<button class="aylen-btn aylen-btn-quiet" onclick="openMarketplaceSettingsModal()">Marketplace style</button>' +
        '<button class="aylen-btn aylen-btn-quiet" onclick="openLegalContactSettingsModal()">Legal &amp; contact</button>' +
        '<button class="aylen-btn aylen-btn-quiet" onclick="openEbaySettingsModal()">eBay store</button>' +
        '<button class="aylen-btn aylen-btn-quiet" onclick="openListingPoliciesModal()">Listing policies</button>' +
        '<button class="aylen-btn aylen-btn-quiet" onclick="openNotifyRequestsModal()">Notify requests</button>' +
        '</div>';
      var pwdMount = $('aylenPasswordMount');
      if (global.AyelenAdminPassword && global.AyelenAdminPassword.renderPanel && pwdMount) {
        global.AyelenAdminPassword.renderPanel(pwdMount);
      } else if (pwdMount) {
        pwdMount.innerHTML = '<p class="aylen-hint">Password module failed to load. Refresh and try again.</p>';
      }
      var storageMount = $('aylenStorageMount');
      if (global.AyelenAdminStorage && global.AyelenAdminStorage.renderPanel && storageMount) {
        global.AyelenAdminStorage.renderPanel(storageMount);
      } else if (storageMount) {
        storageMount.innerHTML = '<p class="aylen-hint">Photo storage tools failed to load. Refresh admin.</p>';
      }
      return;
    }

    if (panel === 'backup') {
      body.innerHTML =
        '<h2 class="aylen-page-title">Backup</h2>' +
        '<p class="aylen-hint">Download a JSON snapshot of Firestore data.</p>' +
        '<button class="aylen-btn" onclick="downloadProductionBackup()">Download JSON backup</button>';
    }
    } finally {
      panelLoading = null;
    }
  }

  function attachAdminViewStatsListener() {
    if (adminViewStatsUnsub) return;
    if (!global.FBDB || !global.FBDB.listenProductViewStats) return;
    try {
      adminViewStatsUnsub = global.FBDB.listenProductViewStats(function(map) {
        adminViewStats = map || {};
        if (currentPanel === 'products') renderProductsTable();
      });
    } catch (e) {}
  }

  async function loadAdminAuctionViewStats() {
    if (global.FBDB && global.FBDB.loadAuctionViewStats) {
      adminAuctionViewStats = await global.FBDB.loadAuctionViewStats();
    }
  }

  function auctionRowIdAttr(id) {
    return escape(String(id == null ? '' : id));
  }

  function bindAuctionsTableEvents(body) {
    if (!body || body._aylenAuctionsBound) return;
    body._aylenAuctionsBound = true;
    body.addEventListener('click', function(e) {
      var delBtn = e.target.closest('[data-auction-delete]');
      if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        var delId = delBtn.getAttribute('data-auction-delete');
        if (delId && typeof global.deleteAuctionConfirm === 'function') {
          global.deleteAuctionConfirm(delId);
        }
        return;
      }
      var editBtn = e.target.closest('[data-auction-edit]');
      var row = e.target.closest('tr[data-auction-id]');
      if (!editBtn && (!row || e.target.closest('button'))) return;
      var aid = editBtn
        ? editBtn.getAttribute('data-auction-edit')
        : row.getAttribute('data-auction-id');
      if (aid) openAuctionEditor(aid);
    });
  }

  async function openAuctionEditor(id) {
    var aid = String(id || '').trim();
    if (!aid) return;
    if (typeof auctions !== 'undefined' && Array.isArray(auctions)) {
      var found = auctions.some(function(a) { return String(a.id) === aid; });
      if (!found && global.FBDB && global.FBDB.loadAuctions) {
        try {
          var fresh = await global.FBDB.loadAuctions();
          auctions.length = 0;
          (fresh || []).forEach(function(a) { auctions.push(a); });
        } catch (e) {
          notifyMsg('Could not load auction', 'error');
          return;
        }
      }
    }
    if (typeof global.editAuction === 'function') {
      global.editAuction(aid);
      return;
    }
    notifyMsg('Auction editor not loaded — refresh admin (Cmd+Shift+R)', 'error');
  }

  function renderAuctionsPanel(body) {
    if (!body) return;
    var list = typeof auctions !== 'undefined' && Array.isArray(auctions) ? auctions.slice() : [];
    list.sort(function(a, b) {
      return (Date.parse(b.endTime || 0) || 0) - (Date.parse(a.endTime || 0) || 0);
    });
    var rows = list.map(function(a) {
      var img = thumb((a.images && a.images[0]) || '');
      var ends = a.endTime ? new Date(a.endTime).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
      var bids = Number(a.bidsCount || (a.bids && a.bids.length) || 0);
      var views = adminAuctionViewStats[a.id] != null ? adminAuctionViewStats[a.id] : Number(a.viewCount || 0);
      var price = Number(a.currentPrice || a.currentBid || a.startingPrice || a.startPrice || 0);
      var st = String(a.status || 'active');
      var aidAttr = auctionRowIdAttr(a.id);
      return '<tr class="aylen-row-clickable" data-auction-id="' + aidAttr + '">' +
        '<td><img src="' + escape(img) + '" width="40" height="40" alt=""></td>' +
        '<td><b>' + escape(a.name || a.title || 'Auction') + '</b></td>' +
        '<td>£' + price.toFixed(2) + '</td>' +
        '<td>' + bids + '</td>' +
        '<td>' + views + '</td>' +
        '<td>' + escape(ends) + '</td>' +
        '<td>' + escape(st) + '</td>' +
        '<td class="aylen-row-actions">' +
        '<button type="button" class="aylen-btn aylen-btn-quiet aylen-btn-sm" data-auction-edit="' + aidAttr + '">Edit</button> ' +
        '<button type="button" class="aylen-btn aylen-btn-danger aylen-btn-sm" data-auction-delete="' + aidAttr + '">Delete</button>' +
        '</td></tr>';
    }).join('');
    body.innerHTML =
      '<h2 class="aylen-page-title">Auctions</h2>' +
      '<p class="aylen-hint">Click a row to open full editor (photos, description, end time). Cards also appear on the public shop.</p>' +
      '<div class="aylen-toolbar" style="margin-bottom:12px">' +
      '<button type="button" class="aylen-btn" onclick="openAddAuctionModal()">+ Auction</button>' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" id="aylenAuctionsReloadBtn" onclick="AyelenAdminDashboard.refreshAuctionsPanel()">Reload</button>' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.restoreAuctionCommandCenter()">Command Center</button>' +
      '</div>' +
      '<div class="aylen-table-wrap"><table class="aylen-table"><thead><tr>' +
      '<th></th><th>Title</th><th>Current £</th><th>Bids</th><th>Views</th><th>Ends</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>' +
      (rows || '<tr><td colspan="8">No auctions yet — add one or create from the shop page.</td></tr>') +
      '</tbody></table></div>';
    bindAuctionsTableEvents(body);
  }

  async function restoreAuctionCommandCenter() {
    var body = $('aylenAdminBody');
    if (!body || currentPanel !== 'auctions') return false;
    if (global.AyelenAdminAuctions && global.AyelenAdminAuctions.stopPoll) {
      global.AyelenAdminAuctions.stopPoll();
    }
    body.innerHTML =
      '<h2 class="aylen-page-title">Auctions</h2>' +
      '<div id="aylenAuctionCmdMount"><p class="aylen-hint">Loading command center…</p></div>';
    var mount = $('aylenAuctionCmdMount');
    if (global.AyelenAdminAuctions && global.AyelenAdminAuctions.renderPanel && mount) {
      await global.AyelenAdminAuctions.renderPanel(mount);
      return true;
    }
    if (mount) {
      mount.innerHTML =
        '<p class="aylen-hint">Auction Command Center did not load. Hard refresh and open Auctions again.</p>' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" style="margin-top:10px" onclick="location.reload()">Refresh page</button>';
    }
    return false;
  }

  async function refreshAuctionsPanel() {
    var btn = $('aylenAuctionsReloadBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Loading…';
    }
    try {
      if (global.FBDB && global.FBDB.loadAuctions) {
        var fresh = await global.FBDB.loadAuctions();
        if (typeof global.applyCatalogSnapshot === 'function') {
          global.applyCatalogSnapshot('auctions', fresh || [], { fromServer: true });
        }
        if (typeof renderAuctions === 'function') renderAuctions(true);
      }
      await loadAdminAuctionViewStats();
      if (currentPanel === 'auctions') {
        var mount = $('aylenAuctionCmdMount');
        if (mount && global.AyelenAdminAuctions && global.AyelenAdminAuctions.refresh) {
          await global.AyelenAdminAuctions.refresh({ silent: true, refreshSettings: true });
        } else {
          await restoreAuctionCommandCenter();
        }
      }
      notifyMsg('Auctions reloaded', 'success');
    } catch (e) {
      notifyMsg('Reload failed: ' + (e.message || e), 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Reload';
      }
    }
  }

  function pickupStatusLabel(loc) {
    if (global.AYLEN_PICKUP && global.AYLEN_PICKUP.normalizePickupStatus) {
      var s = global.AYLEN_PICKUP.normalizePickupStatus(loc);
      var meta = global.AYLEN_PICKUP.pickupStatusMeta(s);
      return meta.shortLabel || meta.label;
    }
    return loc.active ? 'Going' : 'Not confirmed';
  }

  function renderLocationsPanel(body) {
    if (!body) return;
    var list = typeof locations !== 'undefined' && Array.isArray(locations) ? locations.slice() : [];
    if (global.AYLEN_PICKUP && global.AYLEN_PICKUP.sortPickupLocations) {
      list = global.AYLEN_PICKUP.sortPickupLocations(list);
    }
    var rows = list.map(function(loc) {
      var pc = escape(loc.weatherPostcode || loc.postcode || '—');
      var show = loc.showOnWebsite !== false ? 'Yes' : 'Hidden';
      var st = global.AYLEN_PICKUP ? global.AYLEN_PICKUP.normalizePickupStatus(loc) : (loc.active ? 'going' : 'not_confirmed');
      var lid = jsStr(loc.id);
      var goingBtn = st === 'going'
        ? '<button type="button" class="aylen-btn aylen-btn-quiet" style="border-color:rgba(0,255,136,.5);color:#00ff88" disabled>Going ON ✓</button> '
        : '<button type="button" class="aylen-btn aylen-btn-quiet" style="border-color:rgba(0,255,136,.45);color:#00ff88"' + onclickAttr('setPickupWeekendStatus(' + lid + ',\'going\')') + '>Going ON</button> ';
      var risk = '';
      if (st === 'going' && loc.weatherStatus && String(loc.weatherStatus).toUpperCase() !== 'GOOD') {
        risk = ' <span style="color:#fbbf24;font-weight:800">· WEATHER RISK</span>';
      }
      return '<tr>' +
        '<td class="aylen-loc-market"><b>' + escape(loc.name) + '</b><br><small>' + escape(loc.city || '') + '</small></td>' +
        '<td>' + pickupStatusLabel(loc) + risk + (loc.weatherStatus ? ' · <span style="opacity:.85">' + escape(String(loc.weatherStatus).toUpperCase()) + '</span>' : '') + '</td>' +
        '<td>' + pc + '</td>' +
        '<td>' + show + '</td>' +
        '<td class="aylen-loc-actions">' +
        goingBtn +
        '<button type="button" class="aylen-btn aylen-btn-quiet"' + onclickAttr('setPickupWeekendStatus(' + lid + ',\'possible\')') + '>Possible</button> ' +
        '<button type="button" class="aylen-btn aylen-btn-quiet"' + onclickAttr('setPickupWeekendStatus(' + lid + ',\'not_confirmed\')') + '>Going OFF</button> ' +
        '<button type="button" class="aylen-btn aylen-btn-quiet"' + onclickAttr('AYLEN_PICKUP_ADMIN.openQuickEdit(' + lid + ')') + '>Quick</button> ' +
        '<button type="button" class="aylen-btn aylen-btn-quiet"' + onclickAttr('editLocation(' + lid + ')') + '>Edit</button> ' +
        '<button type="button" class="aylen-btn aylen-btn-danger aylen-btn-sm"' + onclickAttr('deleteLocationConfirm(' + lid + ')') + '>Delete</button> ' +
        '</td>' +
        '</tr>';
    }).join('');
    body.innerHTML =
      '<h2 class="aylen-page-title">Weekend Car Boots</h2>' +
      '<p class="aylen-hint">Going ON = green card + WE ARE GOING on the shop. Weather risk warns visitors but never turns Going off — you decide.</p>' +
      '<button type="button" class="aylen-btn" onclick="openAddLocationModal()">+ Add location</button>' +
      '<div class="aylen-table-wrap" style="margin-top:14px">' +
      '<table class="aylen-table aylen-table-locations"><thead><tr><th>Market</th><th>Status</th><th>Weather PC</th><th>On site</th><th>Actions</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="5">No locations yet.</td></tr>') + '</tbody></table></div>';
  }

  function dashCount(list) {
    return Array.isArray(list) ? list.length : 0;
  }

  function discountCodeCount() {
    if (typeof cardHolders !== 'undefined' && cardHolders) return Object.keys(cardHolders).length;
    return 0;
  }

  function activeCartCount() {
    if (typeof activeCartsCount === 'number') return activeCartsCount;
    if (typeof cart !== 'undefined' && Array.isArray(cart)) return cart.length;
    return 0;
  }

  function dashCard(panel, label, count) {
    return '<button type="button" class="aylen-dash-card" onclick="AyelenAdminDashboard.go(\'' + panel + '\')">' +
      '<span>' + label + '</span><b>' + count + '</b></button>';
  }

  function renderDashboardStats() {
    var el = $('aylenDashStats');
    if (!el) return;
    el.innerHTML =
      dashCard('products', 'Products', dashCount(typeof products !== 'undefined' ? products : [])) +
      dashCard('orders', 'Shop Orders', 'Orders') +
      dashCard('auctions', 'Auctions', dashCount(typeof auctions !== 'undefined' ? auctions : [])) +
      dashCard('locations', 'Pickup locations', dashCount(typeof locations !== 'undefined' ? locations : [])) +
      dashCard('vipmembers', 'VIP Members', 'VIP') +
      dashCard('pricelist', 'Price list', dashCount(typeof priceListItems !== 'undefined' ? priceListItems : [])) +
      dashCard('discounts', 'Discount codes', discountCodeCount()) +
      '<button type="button" class="aylen-dash-card" onclick="notify(\'Active carts = shoppers with items in cart (live presence)\', \'info\')">' +
      '<span>Active carts</span><b>' + activeCartCount() + '</b></button>';
  }

  function waitMs(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function loadScriptFallback(src) {
    return new Promise(function(resolve, reject) {
      var key = 'data-aylen-vip-fallback';
      if (document.querySelector('script[' + key + '="' + src + '"]')) {
        resolve();
        return;
      }
      var ver = global.AYLEN_ADMIN_LOADER && global.AYLEN_ADMIN_LOADER.version
        ? global.AYLEN_ADMIN_LOADER.version
        : String(Date.now());
      var script = document.createElement('script');
      script.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + ver;
      script.async = false;
      script.setAttribute(key, src);
      script.onload = function() { resolve(); };
      script.onerror = function() { reject(new Error('Failed to load ' + src)); };
      document.body.appendChild(script);
    });
  }

  async function ensureVipAdminModule() {
    if (global.AyelenAdminVip && global.AyelenAdminVip.renderPanel) return true;
    if (global.AYLEN_ADMIN_LOADER && global.AYLEN_ADMIN_LOADER.load) {
      try {
        await global.AYLEN_ADMIN_LOADER.load();
      } catch (e) {}
    }
    var deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      if (global.AyelenAdminVip && global.AyelenAdminVip.renderPanel) return true;
      await waitMs(120);
    }
    try {
      await loadScriptFallback('js/vip-seed-data.js');
      await loadScriptFallback('js/admin-vip-panel.js');
    } catch (e) {
      console.warn('[AYLEN] VIP module fallback load failed:', e.message);
    }
    return !!(global.AyelenAdminVip && global.AyelenAdminVip.renderPanel);
  }

  async function waitForAdminCatalog(maxMs) {
    var deadline = Date.now() + (maxMs || 10000);
    while (Date.now() < deadline) {
      var catalog = global.AYLEN_FIREBASE_CATALOG;
      if (catalog && catalog.loadAdminProductsPage && global.fbDb) return catalog;
      await waitMs(120);
    }
    return global.AYLEN_FIREBASE_CATALOG;
  }

  function applyLocalProductsFallback() {
    var list = typeof products !== 'undefined' && Array.isArray(products) ? products.slice() : [];
    if (!list.length) return false;
    adminRows = list;
    adminLastDoc = null;
    adminHasMore = false;
    renderProductsTable();
    return true;
  }

  async function fetchAdminPage(cursor) {
    if (adminLoading) return;
    adminLoading = true;
    var body = $('aylenProductsTableBody');
    if (body) body.innerHTML = '<tr><td colspan="9">Loading…</td></tr>';
    try {
      var catalog = await waitForAdminCatalog(10000);
      if (!catalog || !catalog.loadAdminProductsPage) {
        if (applyLocalProductsFallback()) {
          notifyMsg('Showing in-memory catalog (Firestore paging not ready)', 'info');
          return;
        }
        throw new Error('Paging not ready');
      }
      var startAfter = cursor && typeof cursor === 'object' ? cursor : null;
      var res = await catalog.loadAdminProductsPage({
        limit: adminPageSize,
        startAfterDoc: startAfter
      });
      adminRows = res.items || [];
      adminLastDoc = res.lastDoc;
      adminHasMore = !!res.hasMore;
      renderProductsTable();
    } catch (e) {
      if (applyLocalProductsFallback()) {
        notifyMsg('Firestore paging failed — showing cached catalog', 'info');
        return;
      }
      notifyMsg('Load failed: ' + (e.message || e), 'error');
      if (body) body.innerHTML = '<tr><td colspan="9">Error loading</td></tr>';
    } finally {
      adminLoading = false;
    }
  }

  async function reloadProducts(reset) {
    if (reset) {
      adminPage = 1;
      adminPageCursors = [null];
      adminLastDoc = null;
      adminHasMore = false;
    }
    var cursor = adminPage > 1 ? (adminPageCursors[adminPage - 1] || null) : null;
    await fetchAdminPage(cursor);
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
      var views = adminViewStats[p.id] != null ? adminViewStats[p.id] : Number(p.viewCount || 0);
      html += '<tr class="aylen-row-clickable" onclick="if(!event.target.closest(\'input,button\'))AyelenAdminDashboard.edit(' + jsInlineArg(p.id) + ')">' +
        '<td onclick="event.stopPropagation()"><input type="checkbox"' + checked + ' onchange="AyelenAdminDashboard.toggleSelect(' + jsInlineArg(p.id) + ', this.checked)"></td>' +
        '<td><img src="' + escape(img) + '" width="40" height="40"' + lazy + ' alt=""></td>' +
        '<td class="aylen-cell-link">' + escape(p.name) + '</td>' +
        '<td>' + escape(p.sku || '—') + '</td>' +
        '<td>' + (parseFloat(p.price || 0)).toFixed(2) + '</td>' +
        '<td>' + (parseInt(p.stock, 10) || 0) + '</td>' +
        '<td>' + views + '</td>' +
        '<td>' + (hidden ? 'Hidden' : 'Live') + '</td>' +
        '<td class="aylen-row-actions" onclick="event.stopPropagation()">' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.edit(' + jsInlineArg(p.id) + ')">Edit</button> ' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.duplicateOne(' + jsInlineArg(p.id) + ')">Dup</button> ' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDashboard.toggleHide(' + jsInlineArg(p.id) + ',' + (hidden ? 'false' : 'true') + ')">' + (hidden ? 'Show' : 'Hide') + '</button>' +
        '</td></tr>';
    });
    body.innerHTML = html || '<tr><td colspan="9">No rows</td></tr>';
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

  function dismissAdminAuthOverlay() {
    if (global.AYLEN_ADMIN_GATE && global.AYLEN_ADMIN_GATE.hideAuthOverlay) {
      global.AYLEN_ADMIN_GATE.hideAuthOverlay();
    }
  }

  function enterCms(startPanel) {
    if (!global.FBDB || !global.FBDB.isAdmin || !global.FBDB.isAdmin()) {
      if (typeof showAdminLoginModal === 'function') showAdminLoginModal();
      return;
    }
    window.isAdminMode = true;
    document.body.classList.add('admin-mode-active');
    if (typeof removeAdminModeUI === 'function') removeAdminModeUI();
    if (typeof updateAdminAccessVisibility === 'function') updateAdminAccessVisibility();
    open(startPanel || 'dashboard');
  }

  async function enterCmsAsync(startPanel) {
    if (!global.FBDB || !global.FBDB.isAdmin || !global.FBDB.isAdmin()) {
      if (typeof showAdminLoginModal === 'function') showAdminLoginModal();
      return false;
    }
    window.isAdminMode = true;
    document.body.classList.add('admin-mode-active');
    if (typeof removeAdminModeUI === 'function') removeAdminModeUI();
    if (typeof updateAdminAccessVisibility === 'function') updateAdminAccessVisibility();
    await openAsync(startPanel || 'dashboard');
    dismissAdminAuthOverlay();
    return true;
  }

  async function exitCms() {
    window.isAdminMode = false;
    global.isAdminMode = false;
    document.body.classList.remove('admin-mode-active');
    if (typeof removeAdminModeUI === 'function') removeAdminModeUI();
    close();
    if (typeof updateAdminAccessVisibility === 'function') updateAdminAccessVisibility();
    notifyMsg('Admin closed', 'info');
  }

  async function signOutCompletely() {
    if (global.FBDB && global.FBDB.signOutAdmin) {
      await global.FBDB.signOutAdmin();
    }
    if (global.AYLEN_ADMIN_SESSION && global.AYLEN_ADMIN_SESSION.clearAll) {
      global.AYLEN_ADMIN_SESSION.clearAll();
    } else {
      try {
        sessionStorage.removeItem('aylen_admin_key');
        sessionStorage.removeItem('aylen_admin_login');
        sessionStorage.removeItem('aylen_admin_restore_ok');
      } catch (e) {}
    }
    window.isAdminMode = false;
    global.isAdminMode = false;
    document.body.classList.remove('admin-mode-active');
    if (typeof removeAdminModeUI === 'function') removeAdminModeUI();
    close();
    if (global.AYLEN_ADMIN_GATE && global.AYLEN_ADMIN_GATE.setGateLoggedIn) {
      global.AYLEN_ADMIN_GATE.setGateLoggedIn(false);
    }
    if (typeof updateAdminAccessVisibility === 'function') updateAdminAccessVisibility();
    notifyMsg('Logged out on this device', 'info');
  }

  function ensureCmsClickable() {
    if (global.AYLEN_MODAL && global.AYLEN_MODAL.syncAdminShellClasses) {
      global.AYLEN_MODAL.syncAdminShellClasses();
    }
    var modalRoot = document.getElementById('aylen-modal-root');
    if (!modalRoot || !modalRoot.classList.contains('open')) {
      document.body.classList.remove('admin-modal-open', 'modal-locked');
    }
  }

  function open(startPanel) {
    if (global.AYLEN_MODAL && global.AYLEN_MODAL.closeAll) {
      global.AYLEN_MODAL.closeAll({ immediate: true });
    }
    ensureCmsClickable();
    if (startPanel) currentPanel = startPanel;
    ensureShell();
    var shell = $('aylenAdminShell');
    if (!shell) return;
    setPerfMode(true);
    shell.classList.add('open');
    dismissAdminAuthOverlay();
    updateTopBar();
    var panel = currentPanel || 'dashboard';
    if ('requestAnimationFrame' in global) {
      global.requestAnimationFrame(function() { go(panel); });
    } else {
      setTimeout(function() { go(panel); }, 0);
    }
    var startNotify = function() {
      if (typeof startNotifyRequestsWatch === 'function') startNotifyRequestsWatch();
    };
    if ('requestIdleCallback' in global) {
      global.requestIdleCallback(startNotify, { timeout: 2500 });
    } else {
      setTimeout(startNotify, 1500);
    }
  }

  async function openAsync(startPanel) {
    if (global.AYLEN_MODAL && global.AYLEN_MODAL.closeAll) {
      global.AYLEN_MODAL.closeAll({ immediate: true });
    }
    ensureCmsClickable();
    if (startPanel) currentPanel = startPanel;
    ensureShell();
    var shell = $('aylenAdminShell');
    if (!shell) return;
    setPerfMode(true);
    shell.classList.add('open');
    dismissAdminAuthOverlay();
    updateTopBar();
    var panel = currentPanel || 'dashboard';
    currentPanel = panel;
    ensureShell();
    document.querySelectorAll('#aylenAdminNav [data-panel]').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-panel') === panel);
    });
    await loadPanel(panel);
    updateTopBar();
    dismissAdminAuthOverlay();
    var startNotify = function() {
      if (typeof startNotifyRequestsWatch === 'function') startNotifyRequestsWatch();
    };
    if ('requestIdleCallback' in global) {
      global.requestIdleCallback(startNotify, { timeout: 2500 });
    } else {
      setTimeout(startNotify, 1500);
    }
  }

  function close() {
    if (global.AyelenAdminAuctions && global.AyelenAdminAuctions.stopPoll) {
      global.AyelenAdminAuctions.stopPoll();
    }
    var shell = $('aylenAdminShell');
    if (shell) shell.classList.remove('open');
    if (global.AYLEN_MODAL && global.AYLEN_MODAL.closeAll) {
      global.AYLEN_MODAL.closeAll({ immediate: true });
    }
    setPerfMode(false);
    setCmsActive(false);
    document.body.classList.remove('admin-dashboard-open', 'admin-modal-open', 'modal-locked', 'storefront-modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    if (typeof updateAdminAccessVisibility === 'function') updateAdminAccessVisibility();
    if (global.AYLEN_PERF && global.AYLEN_PERF.scheduleStorefrontRefresh) {
      global.AYLEN_PERF.scheduleStorefrontRefresh();
    }
    if (typeof renderProducts === 'function') renderProducts(true);
    if (typeof renderAuctions === 'function') renderAuctions();
    if (typeof renderLocations === 'function') renderLocations();
    if (typeof fillPickup === 'function') fillPickup();
    if (global.AYLEN_SCROLL && global.AYLEN_SCROLL.release) {
      global.AYLEN_SCROLL.release();
    }
  }

  function go(panel) {
    ensureCmsClickable();
    var prev = currentPanel;
    if (prev === 'discounts' && panel !== 'discounts' && global.FBDB && global.FBDB.detachDiscountCardsListener) {
      global.FBDB.detachDiscountCardsListener();
    }
    currentPanel = panel;
    ensureShell();
    document.querySelectorAll('#aylenAdminNav [data-panel]').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-panel') === panel);
    });
    loadPanel(panel);
    updateTopBar();
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

  async function duplicateOne(id, skipConfirm) {
    var p = findInRows(id);
    if (!p) return;
    if (typeof addProductWithPhotos !== 'function') return;
    if (!skipConfirm && !confirm('Duplicate this product?\n\n' + (p.name || p.id || 'Selected product') + '\n\nA new product copy will be created in Firestore.')) return;
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
    if (!skipConfirm) {
      await reloadProducts(true);
      notifyMsg('Product duplicated', 'success');
    }
  }

  async function bulkDuplicate() {
    var ids = selectedIds();
    if (!ids.length) return notifyMsg('Select rows', 'error');
    if (!confirm('Duplicate ' + ids.length + ' selected product(s)?')) return;
    for (var i = 0; i < ids.length; i++) {
      await duplicateOne(ids[i], true);
    }
    await reloadProducts(true);
    notifyMsg('Duplicated ' + ids.length + ' product(s)', 'success');
  }

  function toggleHide(id, hide) {
    var p = findInRows(id) || (typeof products !== 'undefined' ? products.find(function(x) { return String(x.id) === String(id); }) : null);
    if (!p || !global.FBDB || !global.FBDB.updateProduct) {
      notifyMsg('Product not found', 'error');
      return;
    }
    p.active = !hide;
    global.FBDB.updateProduct(p.id, Object.assign({}, p, { active: p.active }));
    notifyMsg(p.active ? 'Product visible' : 'Product hidden', 'success');
    reloadProducts(true);
  }

  function refreshLocations() {
    if (currentPanel !== 'locations') return;
    var body = $('aylenAdminBody');
    if (body) renderLocationsPanel(body);
  }

  function showLegacyAuctionsTable() {
    var body = $('aylenAdminBody');
    if (body) renderAuctionsPanel(body);
  }

  global.AyelenAdminDashboard = {
    open: open,
    openAsync: openAsync,
    enterCms: enterCms,
    enterCmsAsync: enterCmsAsync,
    exitCms: exitCms,
    signOutCompletely: signOutCompletely,
    close: close,
    go: go,
    showShortcuts: showShortcuts,
    mount: ensureShell,
    refreshLocations: refreshLocations,
    refreshAuctionsPanel: refreshAuctionsPanel,
    restoreAuctionCommandCenter: restoreAuctionCommandCenter,
    quickVipItem: quickVipItem,
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
    toggleHide: toggleHide,
    edit: edit,
    editAuction: openAuctionEditor,
    showLegacyAuctionsTable: showLegacyAuctionsTable
  };
})(window);
