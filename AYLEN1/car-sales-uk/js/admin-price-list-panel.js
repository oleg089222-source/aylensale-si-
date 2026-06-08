/**
 * Admin dashboard — Price List panel (CMS-style).
 */
(function(global) {
  function esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s || '');
  }

  function jsStr(val) {
    return JSON.stringify(String(val == null ? '' : val));
  }

  function onclickAttr(expr) {
    return ' onclick=\'' + String(expr).replace(/'/g, '&#39;') + '\'';
  }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
  }

  function formHtml(prefix, item) {
    item = item || {};
    if (typeof priceListItemFormHtml === 'function') {
      return priceListItemFormHtml(prefix, item);
    }
    return '';
  }

  async function ensurePriceListLoaded() {
    if (!global.FBDB || !global.FBDB.loadPriceListItems) return;
    try {
      var items = await global.FBDB.loadPriceListItems();
      global.priceListItems = Array.isArray(items) ? items : [];
    } catch (e) {
      console.warn('Price list load failed:', e.message);
    }
  }

  function renderEmpty(body) {
    body.innerHTML =
      '<div class="aylen-empty-state">' +
        '<i class="fas fa-file-invoice"></i>' +
        '<h3>Price list is empty</h3>' +
        '<p>Add your first item — retail, wholesale, bulk price and minimum quantity.</p>' +
        '<button type="button" class="aylen-btn" onclick="AyelenAdminPriceList.showAddForm()">+ Add Price List Item</button>' +
      '</div>' +
      '<div id="aylenPriceListEditor" class="aylen-panel-editor is-hidden"></div>';
  }

  function renderList(body) {
    var list = (global.priceListItems || []).slice().sort(function(a, b) {
      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    });

    if (!list.length) {
      renderEmpty(body);
      return;
    }

    var rows = list.map(function(item) {
      var vis = item.visible !== false ? 'Shown' : 'Hidden';
      return '<tr>' +
        '<td><b>' + esc(item.name) + '</b><br><small>' + esc(item.category || item.stockStatus || '') + '</small></td>' +
        '<td>£' + Number(item.retailPrice || 0).toFixed(2) + '</td>' +
        '<td>£' + Number(item.wholesalePrice || 0).toFixed(2) + '</td>' +
        '<td>£' + Number(item.bulkPrice || 0).toFixed(2) + '</td>' +
        '<td>' + Number(item.minQty || 1) + '</td>' +
        '<td>' + vis + '</td>' +
        '<td style="white-space:nowrap">' +
          '<button type="button" class="aylen-btn aylen-btn-quiet"' + onclickAttr('AyelenAdminPriceList.edit(' + jsStr(item.id) + ')') + '>Edit</button> ' +
          '<button type="button" class="aylen-btn aylen-btn-quiet"' + onclickAttr('AyelenAdminPriceList.toggleVisible(' + jsStr(item.id) + ')') + '>' + (item.visible === false ? 'Show' : 'Hide') + '</button> ' +
          '<button type="button" class="aylen-btn aylen-btn-danger"' + onclickAttr('AyelenAdminPriceList.remove(' + jsStr(item.id) + ')') + '>Delete</button>' +
        '</td></tr>';
    }).join('');

    body.innerHTML =
      '<div class="aylen-toolbar aylen-toolbar-sticky">' +
        '<button type="button" class="aylen-btn" onclick="AyelenAdminPriceList.showAddForm()">+ Add item <kbd class="aylen-kbd">N</kbd></button>' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="downloadPriceList()">Download HTML</button>' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="downloadPriceListCsv()">CSV</button>' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminPriceList.refresh()">Refresh</button>' +
      '</div>' +
      '<div id="aylenPriceListEditor" class="aylen-panel-editor is-hidden"></div>' +
      '<div class="aylen-table-wrap" style="margin-top:12px">' +
        '<table class="aylen-table aylen-table-compact"><thead><tr>' +
        '<th>Product</th><th>Retail</th><th>Wholesale</th><th>Bulk</th><th>Min qty</th><th>Status</th><th></th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function readForm(prefix, existing) {
    if (typeof readPriceListItemForm === 'function') {
      return readPriceListItemForm(prefix, existing);
    }
    return existing || {};
  }

  function showEditor(title, prefix, item, onSave) {
    var box = document.getElementById('aylenPriceListEditor');
    if (!box) return;
    box.classList.remove('is-hidden');
    box.innerHTML =
      '<div class="aylen-editor-card">' +
        '<h3>' + esc(title) + '</h3>' +
        '<div class="aylen-editor-grid">' + formHtml(prefix, item) + '</div>' +
        '<div class="aylen-editor-actions">' +
          '<button type="button" class="aylen-btn" id="aylenPriceListSaveBtn">Save</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminPriceList.hideEditor()">Cancel</button>' +
        '</div></div>';
    document.getElementById('aylenPriceListSaveBtn').onclick = onSave;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function renderPanel(body) {
    await ensurePriceListLoaded();
    renderList(body);
  }

  global.AyelenAdminPriceList = {
    renderPanel: renderPanel,
    refresh: async function() {
      var mount = document.getElementById('aylenPriceListMount');
      if (mount) await renderPanel(mount);
    },
    showAddForm: function() {
      var prefix = 'pliNew_';
      showEditor('Add Price List Item', prefix, { sortOrder: (global.priceListItems || []).length + 1 }, async function() {
        var item = readForm(prefix, { id: 'pli_' + Date.now(), sortOrder: (global.priceListItems || []).length + 1 });
        if (typeof uploadPriceListPhotoIfNeeded === 'function') {
          try { await uploadPriceListPhotoIfNeeded(item, prefix + 'Photo'); } catch (e) {
            notifyMsg(e.message || 'Upload failed', 'error');
            return;
          }
        }
        if (typeof savePriceListItemAndRefresh === 'function') {
          await savePriceListItemAndRefresh(item, null);
        } else if (global.FBDB && global.FBDB.savePriceListItem) {
          if (!item.name || item.retailPrice <= 0) {
            notifyMsg('Name and retail price are required', 'error');
            return;
          }
          var saved = await global.FBDB.savePriceListItem(item);
          var idx = global.priceListItems.findIndex(function(x) { return String(x.id) === String(saved.id); });
          if (idx >= 0) global.priceListItems[idx] = saved;
          else global.priceListItems.push(saved);
          notifyMsg('Price list item saved', 'success');
        }
        global.AyelenAdminPriceList.hideEditor();
        global.AyelenAdminPriceList.refresh();
      });
    },
    edit: function(id) {
      var item = (global.priceListItems || []).find(function(x) { return String(x.id) === String(id); });
      if (!item) return notifyMsg('Item not found', 'error');
      var prefix = 'pliEd_' + String(id).replace(/[^a-zA-Z0-9]/g, '_') + '_';
      showEditor('Edit: ' + (item.name || 'Item'), prefix, item, async function() {
        var updated = readForm(prefix, item);
        if (typeof uploadPriceListPhotoIfNeeded === 'function') {
          try { await uploadPriceListPhotoIfNeeded(updated, prefix + 'Photo'); } catch (e) {
            notifyMsg(e.message || 'Upload failed', 'error');
            return;
          }
        }
        if (global.FBDB && global.FBDB.savePriceListItem) {
          var saved = await global.FBDB.savePriceListItem(updated);
          var idx = global.priceListItems.findIndex(function(x) { return String(x.id) === String(saved.id); });
          if (idx >= 0) global.priceListItems[idx] = saved;
          notifyMsg('Saved', 'success');
        }
        global.AyelenAdminPriceList.hideEditor();
        global.AyelenAdminPriceList.refresh();
      });
    },
    toggleVisible: async function(id) {
      var item = (global.priceListItems || []).find(function(x) { return String(x.id) === String(id); });
      if (!item || !global.FBDB) return;
      item.visible = item.visible === false;
      await global.FBDB.savePriceListItem(item);
      notifyMsg(item.visible ? 'Item visible on site' : 'Item hidden', 'success');
      global.AyelenAdminPriceList.refresh();
    },
    remove: async function(id) {
      if (!confirm('Delete this price list item?')) return;
      if (typeof deletePriceListItem === 'function') {
        await deletePriceListItem(id, null);
      } else if (global.FBDB && global.FBDB.deletePriceListItem) {
        await global.FBDB.deletePriceListItem(id);
        global.priceListItems = (global.priceListItems || []).filter(function(x) { return String(x.id) !== String(id); });
      }
      notifyMsg('Deleted', 'success');
      global.AyelenAdminPriceList.refresh();
    },
    hideEditor: function() {
      var box = document.getElementById('aylenPriceListEditor');
      if (box) {
        box.classList.add('is-hidden');
        box.innerHTML = '';
      }
    }
  };
})(window);
