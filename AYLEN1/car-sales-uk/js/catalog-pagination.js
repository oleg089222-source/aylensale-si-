/**
 * Catalog filtering + pagination — avoids rendering entire inventory at once.
 */
(function(global) {
  var PAGE_SIZE = 24;
  var state = {
    query: '',
    category: '',
    sort: 'newest',
    quickFilter: '',
    visibleLimit: PAGE_SIZE
  };

  function productVisible(p) {
    if (!p) return false;
    if (global.AYLEN_PRODUCTION && global.AYLEN_PRODUCTION.isDemoCatalogProduct(p) && !global.isAdminMode) return false;
    if (!global.isAdminMode && p.active === false) return false;
    return true;
  }

  function productSearchHaystack(p) {
    return [
      p.name,
      p.desc,
      p.description,
      p.sku,
      p.category,
      p.id
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function sortProducts(list) {
    var out = list.slice();
    out.sort(function(a, b) {
      if (state.sort === 'price-asc') {
        return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
      }
      if (state.sort === 'price-desc') {
        return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
      }
      if (state.sort === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (state.sort === 'stock') {
        return (parseInt(b.stock, 10) || 0) - (parseInt(a.stock, 10) || 0);
      }
      var ta = (typeof productAgeMs === 'function' ? productAgeMs(a) : 0) || 0;
      var tb = (typeof productAgeMs === 'function' ? productAgeMs(b) : 0) || 0;
      return tb - ta;
    });
    return out;
  }

  function getFilteredProducts() {
    var list = (typeof products !== 'undefined' ? products : []).filter(productVisible);
    var q = state.query.trim().toLowerCase();
    if (q) {
      list = list.filter(function(p) { return productSearchHaystack(p).indexOf(q) !== -1; });
    }
    if (state.category) {
      list = list.filter(function(p) { return String(p.category || '') === state.category; });
    }
    if (state.quickFilter === 'in-stock') {
      list = list.filter(function(p) { return (parseInt(p.stock, 10) || 0) > 0; });
    } else if (state.quickFilter === 'sale') {
      list = list.filter(function(p) { return Number(p.discount || 0) > 0; });
    } else if (state.quickFilter === 'new') {
      list = list.filter(function(p) {
        if (typeof productAutoBadge !== 'function') return false;
        var badge = productAutoBadge(p);
        return badge === 'NEW' || badge === 'THIS WEEK';
      });
    }
    return sortProducts(list);
  }

  function getCatalogCategories() {
    var set = {};
    (typeof products !== 'undefined' ? products : []).forEach(function(p) {
      if (!productVisible(p) || !p.category) return;
      set[p.category] = true;
    });
    return Object.keys(set).sort();
  }

  function getSlice() {
    var filtered = getFilteredProducts();
    var serverMore = global.AYLEN_CATALOG_HAS_MORE === true;
    var clientMore = filtered.length > state.visibleLimit;
    return {
      all: filtered,
      page: filtered.slice(0, state.visibleLimit),
      total: filtered.length,
      showing: Math.min(state.visibleLimit, filtered.length),
      hasMore: serverMore || clientMore
    };
  }

  function resetVisibleLimit() {
    state.visibleLimit = PAGE_SIZE;
  }

  function mergeCatalogItems(items) {
    if (typeof applyCatalogSnapshot === 'function') {
      applyCatalogSnapshot('products', items || [], { fromServer: true, merge: true });
      return;
    }
    if (typeof products === 'undefined') return;
    (items || []).forEach(function(item) {
      var idx = products.findIndex(function(p) { return String(p.id) === String(item.id); });
      if (idx === -1) products.push(item);
    });
    if (typeof renderProducts === 'function') renderProducts();
  }

  async function loadMoreFromApi() {
    var api = global.AYLEN_STOREFRONT_CATALOG_API;
    if (!api || !global.AYLEN_CATALOG_HAS_MORE) return false;
    try {
      global.AYLEN_CATALOG_LOADING = true;
      var payload = await api.fetchCatalog({
        limit: PAGE_SIZE,
        after: global.AYLEN_CATALOG_LAST_ID || null
      });
      var block = payload.products || {};
      global.AYLEN_CATALOG_LAST_ID = block.lastId || null;
      global.AYLEN_CATALOG_HAS_MORE = !!block.hasMore;
      var items = block.items || [];
      if (global.AYLEN_PRODUCTION && global.AYLEN_PRODUCTION.filterProductionProducts) {
        items = global.AYLEN_PRODUCTION.filterProductionProducts(items);
      }
      mergeCatalogItems(items);
      return true;
    } catch (e) {
      console.warn('Load more (API) failed', e);
      return false;
    } finally {
      global.AYLEN_CATALOG_LOADING = false;
    }
  }

  async function loadMore() {
    if (global.AYLEN_CATALOG_LOADING) return;

    var firestoreReady = global.FBDB && global.FBDB.loadProductsPage && global.isFirebaseReady;
    var firestoreCursorReady = global.AYLEN_CATALOG_LAST_DOC !== undefined && global.AYLEN_CATALOG_LAST_DOC !== null;

    if (firestoreReady && (firestoreCursorReady || !global.AYLEN_CATALOG_FROM_API)) {
      try {
        global.AYLEN_CATALOG_LOADING = true;
        var page = await global.FBDB.loadProductsPage({
          limit: PAGE_SIZE,
          startAfterDoc: global.AYLEN_CATALOG_LAST_DOC || null
        });
        global.AYLEN_CATALOG_LAST_DOC = page.lastDoc;
        global.AYLEN_CATALOG_HAS_MORE = page.hasMore;
        mergeCatalogItems(page.items || []);
      } catch (e) {
        console.warn('Load more failed', e);
      } finally {
        global.AYLEN_CATALOG_LOADING = false;
      }
      return;
    }

    if (global.AYLEN_CATALOG_FROM_API && global.AYLEN_STOREFRONT_CATALOG_API && global.AYLEN_CATALOG_HAS_MORE) {
      var loaded = await loadMoreFromApi();
      if (loaded) return;
    }

    state.visibleLimit += PAGE_SIZE;
    if (typeof renderProducts === 'function') renderProducts();
  }

  function applyFilter(key, value) {
    state[key] = value;
    resetVisibleLimit();
    if (typeof renderProducts === 'function') renderProducts();
  }

  function buildCatalogToolbarHtml(catOpts) {
    return (
      '<div class="catalog-toolbar-row">' +
      '<input type="search" id="catalogSearch" class="catalog-search" placeholder="Search products…" aria-label="Search products">' +
      '<select id="catalogCategory" class="catalog-select" aria-label="Category">' + catOpts + '</select>' +
      '<select id="catalogSort" class="catalog-select" aria-label="Sort">' +
      '<option value="newest">Newest</option>' +
      '<option value="price-asc">Price: low to high</option>' +
      '<option value="price-desc">Price: high to low</option>' +
      '<option value="name">Name</option>' +
      '<option value="stock">Stock</option>' +
      '</select>' +
      '</div>' +
      '<div class="catalog-quick-filters" role="group" aria-label="Quick filters">' +
      '<button type="button" class="catalog-chip" data-quick="">All</button>' +
      '<button type="button" class="catalog-chip" data-quick="in-stock">In stock</button>' +
      '<button type="button" class="catalog-chip" data-quick="sale">On sale</button>' +
      '<button type="button" class="catalog-chip" data-quick="new">New this week</button>' +
      '</div>' +
      '<p id="catalogResultMeta" class="catalog-meta" aria-live="polite"></p>'
    );
  }

  function wireCatalogToolbar(bar) {
    if (!bar || bar.getAttribute('data-catalog-wired') === '1') return;
    bar.setAttribute('data-catalog-wired', '1');

    var searchEl = document.getElementById('catalogSearch');
    var catEl = document.getElementById('catalogCategory');
    var sortEl = document.getElementById('catalogSort');
    var debounce;
    if (searchEl) {
      searchEl.addEventListener('input', function() {
        clearTimeout(debounce);
        debounce = setTimeout(function() {
          applyFilter('query', searchEl.value);
        }, 280);
      });
    }
    if (catEl) {
      catEl.addEventListener('change', function() {
        applyFilter('category', catEl.value);
      });
    }
    if (sortEl) {
      sortEl.addEventListener('change', function() {
        applyFilter('sort', sortEl.value);
      });
    }
    var chips = bar.querySelectorAll('.catalog-chip');
    chips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        var value = chip.getAttribute('data-quick') || '';
        state.quickFilter = value;
        chips.forEach(function(c) {
          c.classList.toggle('is-active', c === chip);
        });
        resetVisibleLimit();
        if (typeof renderProducts === 'function') renderProducts();
      });
    });
    if (chips.length && !bar.querySelector('.catalog-chip.is-active')) {
      chips[0].classList.add('is-active');
    }
  }

  function ensureToolbar() {
    var section = document.getElementById('products');
    if (!section) return;

    var bar = document.getElementById('catalogToolbar');
    if (!bar) {
      var cats = getCatalogCategories();
      var catOpts = '<option value="">All categories</option>';
      cats.forEach(function(c) {
        catOpts += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
      });
      bar = document.createElement('div');
      bar.id = 'catalogToolbar';
      bar.className = 'catalog-toolbar';
      bar.innerHTML = buildCatalogToolbarHtml(catOpts);
      var grid = document.getElementById('productsGrid');
      if (grid && grid.parentNode) {
        grid.parentNode.insertBefore(bar, grid);
      } else {
        section.appendChild(bar);
      }
    }

    refreshCategories();
    wireCatalogToolbar(bar);
  }

  function renderFooter(slice) {
    var host = document.getElementById('catalogPagination');
    if (!host) {
      host = document.createElement('div');
      host.id = 'catalogPagination';
      host.className = 'catalog-pagination';
      var grid = document.getElementById('productsGrid');
      if (grid && grid.parentNode) grid.parentNode.appendChild(host);
    }
    var meta = document.getElementById('catalogResultMeta');
    if (meta) {
      meta.textContent = slice.total
        ? 'Showing ' + slice.showing + ' of ' + slice.total + ' products'
        : 'No products match your filters';
    }
    if (global.AYLEN_STOREFRONT_FOLDS && global.AYLEN_STOREFRONT_FOLDS.syncCatalogFoldMeta) {
      global.AYLEN_STOREFRONT_FOLDS.syncCatalogFoldMeta();
    }
    if (!slice.total) {
      host.innerHTML = '';
      host.setAttribute('aria-hidden', 'true');
      return;
    }
    host.removeAttribute('aria-hidden');
    var html = '';
    if (slice.hasMore) {
      var remain = slice.total - slice.showing;
      html += '<button type="button" class="catalog-load-more" onclick="AYLEN_CATALOG.loadMore()">Load more (' + remain + ' remaining)</button>';
    }
    host.innerHTML = html;
  }

  function refreshCategories() {
    var sel = document.getElementById('catalogCategory');
    if (!sel) return;
    var current = sel.value;
    var cats = getCatalogCategories();
    sel.innerHTML = '<option value="">All categories</option>';
    cats.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
    sel.value = current;
  }

  global.AYLEN_CATALOG = {
    PAGE_SIZE: PAGE_SIZE,
    state: state,
    getFilteredProducts: getFilteredProducts,
    getSlice: getSlice,
    loadMore: loadMore,
    resetVisibleLimit: resetVisibleLimit,
    ensureToolbar: ensureToolbar,
    renderFooter: renderFooter,
    refreshCategories: refreshCategories
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureToolbar);
  } else {
    ensureToolbar();
  }
})(window);
