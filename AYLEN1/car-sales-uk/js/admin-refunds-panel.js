/**
 * Admin — deposit refund requests (losing bidders).
 */
(function(global) {
  var cache = null;

  function esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s || '');
  }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
  }

  function jsInlineArg(val) {
    if (typeof global.jsInlineArg === 'function') return global.jsInlineArg(val);
    return "'" + String(val == null ? '' : val).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }

  async function adminToken() {
    if (global.FBDB && global.FBDB.ensureAdminSession) await global.FBDB.ensureAdminSession();
    if (global.FBDB && global.FBDB.getAdminIdToken) return global.FBDB.getAdminIdToken();
    throw new Error('Admin login required');
  }

  async function apiGet(sub, extra) {
    var q = '?action=auction-engine&sub=' + encodeURIComponent(sub);
    if (extra) {
      Object.keys(extra).forEach(function(k) {
        q += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(extra[k]);
      });
    }
    var token = await adminToken();
    var res = await fetch('/api/spam' + q, {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function apiPost(body) {
    var token = await adminToken();
    var res = await fetch('/api/spam?action=auction-engine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(body)
    });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Update failed');
    return data;
  }

  function formatDate(val) {
    if (!val) return '—';
    try { return new Date(val).toLocaleString('en-GB'); } catch (e) { return '—'; }
  }

  function statusBadge(status) {
    var s = String(status || 'pending').toLowerCase();
    var cls = 'arp-badge arp-badge--' + s;
    return '<span class="' + cls + '">' + esc(s) + '</span>';
  }

  function actionButtons(row) {
    var id = row.id;
    var st = String(row.status || 'pending');
    var html = '';
    if (st === 'pending') {
      html += '<button type="button" class="aylen-btn aylen-btn-sm" onclick="AyelenAdminRefunds.update(' + jsInlineArg(id) + ',\'approved\')">Approve</button> ';
      html += '<button type="button" class="aylen-btn aylen-btn-sm aylen-btn-quiet" onclick="AyelenAdminRefunds.update(' + jsInlineArg(id) + ',\'rejected\')">Reject</button>';
    } else if (st === 'approved') {
      html += '<button type="button" class="aylen-btn aylen-btn-sm" onclick="AyelenAdminRefunds.update(' + jsInlineArg(id) + ',\'refunded\')">Mark refunded</button>';
    }
    return html || '<span class="aylen-hint">—</span>';
  }

  function filterBar(current) {
    var filters = ['', 'pending', 'approved', 'rejected', 'refunded'];
    return filters.map(function(f) {
      var label = f || 'All';
      var active = (current || '') === f ? ' arp-filter--active' : '';
      return '<button type="button" class="arp-filter' + active + '" data-filter="' + esc(f) + '">' + esc(label) + '</button>';
    }).join('');
  }

  function renderTable(requests) {
    requests = requests || [];
    if (!requests.length) return '<p class="aylen-hint">No refund requests for this filter.</p>';
    var rows = requests.map(function(r) {
      return '<tr>' +
        '<td><b>' + formatDate(r.createdAt) + '</b><br><small>' + esc(r.id) + '</small></td>' +
        '<td>' + esc(r.name) + '<br><small>' + esc(r.phone) + '</small><br><small>' + esc(r.email) + '</small></td>' +
        '<td>' + esc(r.auctionName) + '<br><small>' + esc(r.auctionId) + '</small></td>' +
        '<td>' + esc(r.paymentReference) + '</td>' +
        '<td>' + statusBadge(r.status) + '</td>' +
        '<td><input class="aylen-input aylen-input-sm" id="refNote_' + esc(r.id) + '" value="' + esc(r.adminNote || '') + '" placeholder="Admin note…"></td>' +
        '<td class="arp-actions">' + actionButtons(r) + '</td>' +
        '</tr>';
    }).join('');

    return '<div class="aylen-table-wrap"><table class="aylen-table arp-table"><thead><tr>' +
      '<th>Submitted</th><th>Bidder</th><th>Auction</th><th>Payment ref</th><th>Status</th><th>Note</th><th>Actions</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  async function loadRequests(filter) {
    var data = await apiGet('refunds', filter ? { status: filter } : {});
    cache = data;
    return data;
  }

  async function renderPanel(mount, filter) {
    if (!mount) return;
    mount.innerHTML = '<p class="aylen-hint"><i class="fas fa-spinner fa-spin"></i> Loading refund requests…</p>';
    try {
      var data = await loadRequests(filter);
      var counts = data.counts || {};
      mount.innerHTML =
        '<div class="arp-root">' +
        '<p class="aylen-hint">Losing bidder deposit refunds — pending → approved/rejected → refunded. Telegram alerts on status change.</p>' +
        '<div class="arp-stats">' +
        '<span>Pending: <b>' + Number(counts.pending || 0) + '</b></span>' +
        '<span>Approved: <b>' + Number(counts.approved || 0) + '</b></span>' +
        '<span>Refunded: <b>' + Number(counts.refunded || 0) + '</b></span>' +
        '</div>' +
        '<div class="arp-filters" id="arpFilters">' + filterBar(filter || '') + '</div>' +
        '<div id="arpTableMount">' + renderTable(data.requests) + '</div>' +
        '<div class="arp-toolbar">' +
        '<button type="button" class="aylen-btn aylen-btn-quiet aylen-btn-sm" id="arpRefreshBtn"><i class="fas fa-rotate"></i> Refresh</button>' +
        '</div></div>';

      var filtersEl = document.getElementById('arpFilters');
      if (filtersEl) {
        filtersEl.querySelectorAll('[data-filter]').forEach(function(btn) {
          btn.onclick = function() {
            renderPanel(mount, btn.getAttribute('data-filter') || '');
          };
        });
      }
      var refreshBtn = document.getElementById('arpRefreshBtn');
      if (refreshBtn) refreshBtn.onclick = function() { renderPanel(mount, filter || ''); };
    } catch (err) {
      mount.innerHTML =
        '<p class="aylen-hint"><i class="fas fa-triangle-exclamation"></i> ' + esc(err.message || 'Could not load refunds') + '</p>' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" style="margin-top:10px" onclick="AyelenAdminRefunds.renderPanel(document.getElementById(\'aylenRefundsMount\'))">Retry</button>';
    }
  }

  async function update(id, status) {
    var noteEl = document.getElementById('refNote_' + id);
    var note = noteEl ? noteEl.value : '';
    if (status === 'rejected' && !note && !window.confirm('Reject without admin note?')) return;
    if (status === 'refunded' && !window.confirm('Confirm deposit has been refunded to the bidder?')) return;
    try {
      await apiPost({
        action: 'refund-update',
        id: id,
        status: status,
        adminNote: note
      });
      notifyMsg('Refund request updated: ' + status, 'success');
      var mount = document.getElementById('aylenRefundsMount');
      if (mount) await renderPanel(mount);
    } catch (err) {
      notifyMsg(err.message || 'Update failed', 'error');
    }
  }

  global.AyelenAdminRefunds = {
    renderPanel: renderPanel,
    update: update
  };
})(window);
