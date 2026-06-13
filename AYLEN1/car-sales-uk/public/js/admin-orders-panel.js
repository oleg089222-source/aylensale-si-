/**
 * Admin — shop orders from main checkout.
 */
(function(global) {
  function esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s || '');
  }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
  }

  function formatDate(val) {
    if (!val) return '—';
    try {
      if (val.toDate) return val.toDate().toLocaleDateString('en-GB');
      return new Date(val).toLocaleDateString('en-GB');
    } catch (e) {
      return '—';
    }
  }

  function statusOptions(current) {
    var opts = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    return opts.map(function(s) {
      return '<option value="' + s + '"' + (String(current || 'new').toLowerCase() === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
  }

  function itemsSummary(items) {
    if (!items || !items.length) return '—';
    return items.map(function(it) {
      return esc(it.name || 'item') + ' ×' + Number(it.qty || 0);
    }).join(', ').slice(0, 120);
  }

  function jsInlineArg(val) {
    if (typeof global.jsInlineArg === 'function') return global.jsInlineArg(val);
    return "'" + String(val == null ? '' : val).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }

  async function renderPanel(mount) {
    if (!mount) return;
    mount.innerHTML = '<p class="aylen-hint">Loading shop orders…</p>';
    if (!global.FBDB || !global.FBDB.loadOrders) {
      mount.innerHTML = '<p class="aylen-hint">Orders module not ready.</p>';
      return;
    }
    var orders = [];
    try {
      orders = await global.FBDB.loadOrders();
    } catch (err) {
      mount.innerHTML = '<p class="aylen-hint">Could not load orders: ' + esc(err.message) + '</p>';
      return;
    }

    var rows = orders.map(function(o) {
      var vipTag = o.vipMember ? ' <span style="color:#fcd34d">VIP</span>' : '';
      return '<tr>' +
        '<td><b>' + formatDate(o.createdAt) + '</b><br><small>' + esc(o.id) + '</small></td>' +
        '<td>' + esc(o.name) + '<br><small>' + esc(o.phone) + '</small>' + vipTag + '</td>' +
        '<td>' + itemsSummary(o.items) + '<br><small>£' + esc(Number(o.total || 0).toFixed(2)) +
          (o.card ? ' · ' + esc(o.card) : '') + '</small></td>' +
        '<td>' + esc(o.pickup || '—') + '</td>' +
        '<td><select class="aylen-input aylen-input-sm" id="shopOrdSt_' + esc(o.id) + '">' + statusOptions(o.status) + '</select></td>' +
        '<td><input class="aylen-input aylen-input-sm" id="shopOrdNote_' + esc(o.id) + '" value="' + esc(o.adminNote || '') + '" placeholder="Note…"></td>' +
        '<td><button type="button" class="aylen-btn aylen-btn-sm" onclick="AyelenAdminOrders.saveOrder(' + jsInlineArg(o.id) + ')">Save</button></td>' +
        '</tr>';
    }).join('');

    mount.innerHTML =
      '<p class="aylen-hint" style="margin-bottom:12px">Orders from main shop checkout (Telegram + Firestore). Status: new → confirmed → preparing → ready → delivered.</p>' +
      '<div class="aylen-table-wrap"><table class="aylen-table"><thead><tr>' +
        '<th>Date</th><th>Customer</th><th>Items</th><th>Pickup</th><th>Status</th><th>Admin note</th><th></th>' +
      '</tr></thead><tbody>' +
        (rows || '<tr><td colspan="7">No shop orders yet.</td></tr>') +
      '</tbody></table></div>';
  }

  async function saveOrder(orderId) {
    if (!global.FBDB || !global.FBDB.updateShopOrder) {
      notifyMsg('Update not available — refresh admin', 'error');
      return;
    }
    var statusEl = document.getElementById('shopOrdSt_' + orderId);
    var noteEl = document.getElementById('shopOrdNote_' + orderId);
    try {
      await global.FBDB.updateShopOrder(orderId, {
        status: statusEl ? statusEl.value : 'new',
        adminNote: noteEl ? noteEl.value : ''
      });
      notifyMsg('Shop order updated', 'success');
    } catch (err) {
      notifyMsg(err.message || 'Save failed', 'error');
    }
  }

  global.AyelenAdminOrders = {
    renderPanel: renderPanel,
    saveOrder: saveOrder
  };
})(window);
