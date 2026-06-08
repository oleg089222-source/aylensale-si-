/**
 * Admin dashboard — Discount Codes panel (loyalty jars + bulk generator).
 */
(function(global) {
  var listFilter = '';
  var lastBatchCodes = [];
  var bulkRunning = false;

  var LOYALTY_TIERS = [
    { tier: 0, percent: 5, label: 'Welcome', orders: 0, spend: 0, fill: 20 },
    { tier: 1, percent: 10, label: 'Regular', orders: 3, spend: 500, fill: 40 },
    { tier: 2, percent: 15, label: 'Frequent', orders: 8, spend: 1500, fill: 60 },
    { tier: 3, percent: 20, label: 'Premium', orders: 15, spend: 3000, fill: 80 },
    { tier: 4, percent: 25, label: 'VIP', orders: 30, spend: 6000, fill: 100 }
  ];

  function esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s || '');
  }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
  }

  function jsArg(v) {
    return typeof jsInlineArg === 'function' ? jsInlineArg(v) : JSON.stringify(String(v));
  }

  function tierByIndex(i) {
    return LOYALTY_TIERS[Math.max(0, Math.min(LOYALTY_TIERS.length - 1, Number(i) || 0))];
  }

  function suggestedTier(orders, spend) {
    var o = Number(orders) || 0;
    var s = Number(spend) || 0;
    var best = 0;
    LOYALTY_TIERS.forEach(function(t) {
      if (o >= t.orders || s >= t.spend) best = Math.max(best, t.tier);
    });
    return best;
  }

  function tierProgressToNext(orders, spend, tier) {
    var t = tierByIndex(tier);
    var next = tierByIndex(tier + 1);
    if (tier >= LOYALTY_TIERS.length - 1) return 100;
    var orderProg = next.orders > t.orders ? Math.min(1, (Number(orders) - t.orders) / (next.orders - t.orders)) : 0;
    var spendProg = next.spend > t.spend ? Math.min(1, (Number(spend) - t.spend) / (next.spend - t.spend)) : 0;
    return Math.round(Math.max(orderProg, spendProg) * 100);
  }

  function jarFillClass(tier) {
    if (tier >= 4) return 'dc-jar-fill--t4';
    if (tier >= 3) return 'dc-jar-fill--t3';
    if (tier >= 2) return 'dc-jar-fill--t2';
    if (tier >= 1) return 'dc-jar-fill--t1';
    return '';
  }

  function jarHtml(tier, orders, spend, small) {
    var t = tierByIndex(tier);
    var prog = tierProgressToNext(orders, spend, tier);
    var fillH = tier >= LOYALTY_TIERS.length - 1 ? 100 : Math.max(t.fill * 0.35, t.fill * 0.35 + prog * 0.006);
    fillH = Math.min(100, Math.max(12, fillH));
    var cls = jarFillClass(tier);
    if (small) {
      return '<span class="dc-list-jar" title="' + esc(t.label + ' · ' + t.percent + '%') + '">' +
        '<span class="dc-jar"><span class="dc-jar-fill ' + cls + '" style="height:' + fillH + '%"></span></span>' +
        '<span class="dc-list-jar-pct">' + t.percent + '%</span></span>';
    }
    return '<div class="dc-jar"><div class="dc-jar-fill ' + cls + '" style="height:' + fillH + '%"></div></div>';
  }

  function tierGridHtml(highlightTier) {
    return LOYALTY_TIERS.map(function(t) {
      var active = highlightTier === t.tier ? ' dc-tier-card--active' : '';
      return '<div class="dc-tier-card' + active + '">' +
        jarHtml(t.tier, t.orders, t.spend, false) +
        '<span class="dc-tier-pct">' + t.percent + '%</span>' +
        '<span class="dc-tier-name">' + esc(t.label) + '</span>' +
        '<span class="dc-tier-rule">' + t.orders + '+ orders<br>or £' + t.spend.toLocaleString() + '+</span>' +
      '</div>';
    }).join('');
  }

  function countStats() {
    var codes = Object.keys(global.cardHolders || {});
    var stats = { total: codes.length, unused: 0, active: 0, tier0: 0 };
    codes.forEach(function(code) {
      var c = global.cardHolders[code] || {};
      if ((c.status || 'active') === 'unused') stats.unused++;
      if ((c.status || 'active') === 'active') stats.active++;
      if (Number(c.loyaltyTier || 0) === 0) stats.tier0++;
    });
    return stats;
  }

  async function ensureCardsLoaded(force) {
    if (!force && global.cardHolders && Object.keys(global.cardHolders).length) return;
    if (!global.FBDB || !global.FBDB.loadCards) return;
    if (!global.FBDB.isAdmin || !global.FBDB.isAdmin()) {
      notifyMsg('Admin login required', 'error');
      return;
    }
    try {
      global.cardHolders = await global.FBDB.loadCards();
    } catch (e) {
      console.warn('Cards load failed:', e.message);
      global.cardHolders = global.cardHolders || {};
    }
  }

  function discountTypeOptions(selected) {
    var types = [
      ['percent', '% discount'],
      ['fixed', 'Fixed £ discount'],
      ['wholesale', 'Wholesale access'],
      ['free_delivery', 'Free delivery'],
      ['price_group', 'Custom price group']
    ];
    return types.map(function(row) {
      return '<option value="' + row[0] + '"' + (selected === row[0] ? ' selected' : '') + '>' + row[1] + '</option>';
    }).join('');
  }

  function statusOptions(selected) {
    var list = ['active', 'paused', 'expired', 'blocked', 'unused'];
    return list.map(function(s) {
      return '<option value="' + s + '"' + (selected === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
  }

  function waLink(phone, code) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    var text = encodeURIComponent(
      'Your AYLENSALE discount code: ' + code + '\nhttps://aylensale.com/?card=' + code
    );
    return 'https://wa.me/' + digits + '?text=' + text;
  }

  function formatExpiry(card) {
    var d = (card.expiryDate || '').slice(0, 10);
    if (!d) return '—';
    var exp = new Date(d + 'T23:59:59');
    if (exp < new Date()) return '<span style="color:#f87171">' + esc(d) + '</span>';
    return esc(d);
  }

  function discountLabel(c) {
    var type = c.discountType || 'percent';
    if (type === 'percent') return Number(c.discountValue || c.discount || 0) + '%';
    if (type === 'fixed') return '£' + Number(c.discountValue || 0).toFixed(2);
    return type.replace(/_/g, ' ');
  }

  function randomBulkCode(prefix, existing) {
    prefix = String(prefix || 'AYL').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code;
    var tries = 0;
    do {
      var s = '';
      for (var i = 0; i < 5; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
      code = prefix + s;
      tries++;
    } while (existing[code] && tries < 200);
    return code;
  }

  function generateUniqueCodes(count, prefix) {
    var existing = global.cardHolders || {};
    var set = {};
    var tries = 0;
    while (Object.keys(set).length < count && tries < count * 30) {
      tries++;
      var code = randomBulkCode(prefix, Object.assign({}, existing, set));
      if (!set[code] && !existing[code]) set[code] = true;
    }
    return Object.keys(set);
  }

  function setBulkProgress(pct, msg) {
    var bar = document.getElementById('dcBulkProgressBar');
    var wrap = document.getElementById('dcBulkProgress');
    var status = document.getElementById('dcBulkStatus');
    if (wrap) wrap.classList.toggle('is-visible', pct >= 0);
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (status && msg != null) status.textContent = msg;
  }

  async function generateBulkCodes() {
    if (bulkRunning) return;
    var countEl = document.getElementById('dcBulkCount');
    var pctEl = document.getElementById('dcBulkPercent');
    var prefixEl = document.getElementById('dcBulkPrefix');
    var count = Math.max(1, Math.min(500, parseInt(countEl && countEl.value, 10) || 100));
    var percent = Math.max(1, Math.min(100, parseFloat(pctEl && pctEl.value) || 5));
    var prefix = (prefixEl && prefixEl.value.trim()) || 'AYL';

    if (!confirm('Generate ' + count + ' unique codes at ' + percent + '% discount?\n\nStatus: unused (ready for visit cards).\nLoyalty tier: Welcome (5% jar).')) {
      return;
    }
    if (!global.FBDB || !global.FBDB.saveCardsBatch) {
      notifyMsg('Firebase batch save not available', 'error');
      return;
    }

    bulkRunning = true;
    setBulkProgress(5, 'Generating unique codes…');
    var codes = generateUniqueCodes(count, prefix);
    if (codes.length < count) {
      notifyMsg('Only generated ' + codes.length + ' unique codes (try different prefix)', 'error');
      bulkRunning = false;
      setBulkProgress(-1, '');
      return;
    }

    var batchTag = 'bulk-' + new Date().toISOString().slice(0, 10);
    var tier = LOYALTY_TIERS.find(function(t) { return t.percent === percent; });
    var loyaltyTier = tier ? tier.tier : 0;
    var payload = {};
    codes.forEach(function(code) {
      payload[code] = {
        code: code,
        name: '',
        phone: '',
        email: '',
        discountType: 'percent',
        discountValue: percent,
        discount: percent,
        status: 'unused',
        active: false,
        loyaltyTier: loyaltyTier,
        loyaltyOrders: 0,
        loyaltySpend: 0,
        batchTag: batchTag,
        usageLimit: 0,
        usageCount: 0,
        minOrderValue: 0
      };
    });

    try {
      setBulkProgress(25, 'Saving to Firestore…');
      await global.FBDB.saveCardsBatch(payload);
      global.cardHolders = global.cardHolders || {};
      codes.forEach(function(code) {
        global.cardHolders[code] = payload[code];
      });
      lastBatchCodes = codes.slice();
      setBulkProgress(100, 'Done — ' + codes.length + ' codes saved (' + batchTag + ')');
      notifyMsg(codes.length + ' codes created at ' + percent + '%', 'success');
      updateHeroStats();
      global.AyelenAdminDiscounts.refresh(true);
    } catch (e) {
      notifyMsg(e.message || 'Bulk save failed', 'error');
      setBulkProgress(-1, e.message || 'Failed');
    } finally {
      bulkRunning = false;
      setTimeout(function() { setBulkProgress(-1, ''); }, 4000);
    }
  }

  function exportLastBatchCsv() {
    if (!lastBatchCodes.length) {
      notifyMsg('Generate a batch first', 'error');
      return;
    }
    var rows = ['code,percent,status,tier,url'];
    lastBatchCodes.forEach(function(code) {
      var c = global.cardHolders[code] || {};
      rows.push([
        code,
        Number(c.discountValue || c.discount || 0),
        c.status || 'unused',
        Number(c.loyaltyTier || 0),
        'https://aylensale.com/?card=' + code
      ].join(','));
    });
    var blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'AYLENSALE-codes-' + lastBatchCodes.length + '.csv';
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 2000);
    notifyMsg('CSV downloaded', 'success');
  }

  function printCodesForCards() {
    var codes = lastBatchCodes.length ? lastBatchCodes.slice() : Object.keys(global.cardHolders || {}).sort();
    if (!codes.length) {
      notifyMsg('Create at least one code first', 'error');
      return;
    }
    var rows = codes.map(function(code) {
      var c = global.cardHolders[code] || {};
      return '<div class="dc-print-card"><div class="dc-print-code">' + esc(code) + '</div>' +
        '<div class="dc-print-meta">' + esc(c.name || 'Customer') + ' · ' + esc(discountLabel(c)) + '</div>' +
        '<div class="dc-print-url">aylensale.com/?card=' + esc(code) + '</div></div>';
    }).join('');
    var win = global.open('', '_blank', 'noopener');
    if (!win) {
      notifyMsg('Allow pop-ups to print codes', 'error');
      return;
    }
    win.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>AYLENSALE discount codes</title>' +
      '<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}' +
      '.dc-print-card{page-break-inside:avoid;border:2px solid #1a1a2e;border-radius:12px;padding:20px 24px;margin:0 0 16px;max-width:320px}' +
      '.dc-print-code{font-size:28px;font-weight:900;letter-spacing:.06em;color:#e94560}' +
      '.dc-print-meta{font-size:14px;margin-top:6px}.dc-print-url{font-size:11px;color:#64748b;margin-top:8px}' +
      '@media print{body{padding:0}.dc-print-card{margin:0 0 12px}}</style></head><body>' +
      '<h1 style="font-size:18px;margin:0 0 16px">AYLENSALE — discount codes</h1>' + rows +
      '</body></html>'
    );
    win.document.close();
    win.focus();
    setTimeout(function() { win.print(); }, 400);
  }

  function filteredCodes() {
    var q = listFilter.trim().toLowerCase();
    return Object.keys(global.cardHolders || {}).filter(function(code) {
      if (!q) return true;
      var c = global.cardHolders[code] || {};
      return [code, c.name, c.phone, c.email, c.discountType, c.status, c.batchTag].join(' ').toLowerCase().indexOf(q) !== -1;
    }).sort();
  }

  function heroHtml() {
    var s = countStats();
    return '<div class="dc-hero">' +
      '<div>' +
        '<h3 class="dc-hero-title">Loyalty visit cards</h3>' +
        '<p class="dc-hero-text">New customers start at <b>5%</b> (bulk generator). When they buy more often or spend more — fill the jar, upgrade tier, print a new visit card with a higher discount.</p>' +
      '</div>' +
      '<div class="dc-hero-stats" id="dcHeroStats">' +
        '<div class="dc-stat"><span class="dc-stat-val">' + s.total + '</span><span class="dc-stat-label">Total codes</span></div>' +
        '<div class="dc-stat"><span class="dc-stat-val">' + s.unused + '</span><span class="dc-stat-label">Unused</span></div>' +
        '<div class="dc-stat"><span class="dc-stat-val">' + s.active + '</span><span class="dc-stat-label">Active</span></div>' +
        '<div class="dc-stat"><span class="dc-stat-val">' + s.tier0 + '</span><span class="dc-stat-label">Welcome 5%</span></div>' +
      '</div>' +
    '</div>';
  }

  function updateHeroStats() {
    var el = document.getElementById('dcHeroStats');
    if (!el) return;
    var s = countStats();
    el.innerHTML =
      '<div class="dc-stat"><span class="dc-stat-val">' + s.total + '</span><span class="dc-stat-label">Total codes</span></div>' +
      '<div class="dc-stat"><span class="dc-stat-val">' + s.unused + '</span><span class="dc-stat-label">Unused</span></div>' +
      '<div class="dc-stat"><span class="dc-stat-val">' + s.active + '</span><span class="dc-stat-label">Active</span></div>' +
      '<div class="dc-stat"><span class="dc-stat-val">' + s.tier0 + '</span><span class="dc-stat-label">Welcome 5%</span></div>';
  }

  function bulkCardHtml() {
    return '<div class="dc-bulk-card">' +
      '<h4 class="dc-bulk-title"><i class="fas fa-layer-group"></i> Bulk generator — visit card batch</h4>' +
      '<p class="aylen-hint" style="margin:0">Creates unused codes for printing visit cards. Shoppers never see this list.</p>' +
      '<div class="dc-bulk-grid">' +
        '<div><label class="aylen-label" for="dcBulkCount">How many codes</label>' +
          '<input id="dcBulkCount" class="aylen-input" type="number" min="1" max="500" value="100"></div>' +
        '<div><label class="aylen-label" for="dcBulkPercent">Discount %</label>' +
          '<input id="dcBulkPercent" class="aylen-input" type="number" min="1" max="100" step="1" value="5"></div>' +
        '<div><label class="aylen-label" for="dcBulkPrefix">Code prefix</label>' +
          '<input id="dcBulkPrefix" class="aylen-input" type="text" value="AYL" maxlength="6" style="text-transform:uppercase"></div>' +
        '<div class="dc-bulk-actions">' +
          '<button type="button" class="aylen-btn" id="dcBulkGenerateBtn"><i class="fas fa-wand-magic-sparkles"></i> Generate batch</button>' +
        '</div>' +
      '</div>' +
      '<div class="dc-bulk-progress" id="dcBulkProgress"><div class="dc-bulk-progress-bar" id="dcBulkProgressBar"></div></div>' +
      '<p class="dc-bulk-status" id="dcBulkStatus"></p>' +
      '<div class="aylen-toolbar" style="margin-top:8px">' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" id="dcExportBatchBtn"><i class="fas fa-file-csv"></i> Export last batch CSV</button>' +
      '</div>' +
    '</div>';
  }

  function renderPanel(body) {
    body.innerHTML =
      '<div class="dc-page">' +
        heroHtml() +
        '<div><p class="aylen-hint" style="margin:0 0 8px">Loyalty tiers — higher jar = higher discount on next visit card</p>' +
        '<div class="dc-tier-grid">' + tierGridHtml(-1) + '</div></div>' +
        bulkCardHtml() +
        '<div class="aylen-toolbar aylen-toolbar-sticky">' +
          '<button type="button" class="aylen-btn" onclick="AyelenAdminDiscounts.showCreate()"><i class="fas fa-plus"></i> Create</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDiscounts.generateRandom()"><i class="fas fa-dice"></i> Random</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDiscounts.printCards()">Print</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDiscounts.refresh(true)">Refresh</button>' +
          '<input type="search" id="aylenDiscountSearch" class="aylen-input aylen-grow" placeholder="Search code, name, batch…">' +
        '</div>' +
        '<div id="aylenDiscountEditor" class="aylen-panel-editor is-hidden"></div>' +
        '<div id="aylenDiscountList" class="aylen-table-wrap"><p class="aylen-hint">Loading…</p></div>' +
      '</div>';

    var search = document.getElementById('aylenDiscountSearch');
    if (search) {
      search.addEventListener('input', function() {
        listFilter = search.value || '';
        renderList();
      });
    }
    var bulkBtn = document.getElementById('dcBulkGenerateBtn');
    if (bulkBtn) bulkBtn.addEventListener('click', function() { generateBulkCodes(); });
    var exportBtn = document.getElementById('dcExportBatchBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportLastBatchCsv);

    global.AyelenAdminDiscounts.refresh(true);
  }

  function loyaltyEditorHtml(card) {
    card = card || {};
    var tier = Number(card.loyaltyTier != null ? card.loyaltyTier : 0);
    var orders = Number(card.loyaltyOrders || 0);
    var spend = Number(card.loyaltySpend || 0);
    var suggest = suggestedTier(orders, spend);
    var suggestTier = tierByIndex(suggest);
    var suggestHint = suggest > tier
      ? '<span class="dc-tier-pill dc-tier-pill--suggest">Suggested: ' + suggestTier.percent + '% — ' + esc(suggestTier.label) + '</span> ' +
        '<button type="button" class="aylen-btn aylen-btn-quiet" id="dcApplySuggestedTier">Apply ' + suggestTier.percent + '% tier</button>'
      : '<span class="dc-tier-pill">' + tierByIndex(tier).label + ' · ' + tierByIndex(tier).percent + '%</span>';

    var tierOptions = LOYALTY_TIERS.map(function(t) {
      return '<option value="' + t.tier + '"' + (tier === t.tier ? ' selected' : '') + '>' +
        t.percent + '% — ' + t.label + '</option>';
    }).join('');

    return '<div class="dc-loyalty-editor">' +
      '<h4 style="margin:0 0 8px;font-size:13px;font-weight:800;color:#ff4f83">Loyalty jar</h4>' +
      '<p class="aylen-hint" style="margin:0 0 10px">Track orders & spend. When the jar fills — upgrade tier and print a new visit card with the new %.</p>' +
      '<div class="dc-loyalty-row">' +
        '<div class="dc-loyalty-jar-wrap">' + jarHtml(tier, orders, spend, false) +
          '<span class="dc-tier-pct" id="dcJarPctLabel">' + tierByIndex(tier).percent + '%</span></div>' +
        '<div style="flex:1;min-width:200px">' +
          '<label class="aylen-label" for="dcLoyaltyTier">Tier</label>' +
          '<select id="dcLoyaltyTier" class="aylen-input">' + tierOptions + '</select>' +
          '<div style="margin-top:8px">' + suggestHint + '</div>' +
        '</div>' +
        '<div><label class="aylen-label" for="dcLoyaltyOrders">Orders count</label>' +
          '<input id="dcLoyaltyOrders" type="number" min="0" class="aylen-input" value="' + orders + '"></div>' +
        '<div><label class="aylen-label" for="dcLoyaltySpend">Total spend (£)</label>' +
          '<input id="dcLoyaltySpend" type="number" min="0" step="0.01" class="aylen-input" value="' + spend + '"></div>' +
      '</div></div>';
  }

  function bindLoyaltyEditorEvents() {
    var tierEl = document.getElementById('dcLoyaltyTier');
    var ordersEl = document.getElementById('dcLoyaltyOrders');
    var spendEl = document.getElementById('dcLoyaltySpend');
    var applyBtn = document.getElementById('dcApplySuggestedTier');

    function syncTierToDiscount() {
      if (!tierEl) return;
      var t = tierByIndex(tierEl.value);
      var typeEl = document.getElementById('dcType');
      var valEl = document.getElementById('dcValue');
      if (typeEl) typeEl.value = 'percent';
      if (valEl) valEl.value = t.percent;
      var lbl = document.getElementById('dcJarPctLabel');
      if (lbl) lbl.textContent = t.percent + '%';
    }

    if (tierEl) tierEl.addEventListener('change', syncTierToDiscount);
    if (applyBtn) {
      applyBtn.addEventListener('click', function() {
        var orders = parseInt(ordersEl && ordersEl.value, 10) || 0;
        var spend = parseFloat(spendEl && spendEl.value) || 0;
        var sug = suggestedTier(orders, spend);
        if (tierEl) tierEl.value = String(sug);
        syncTierToDiscount();
        notifyMsg('Tier updated to ' + tierByIndex(sug).percent + '% — print new visit card', 'success');
      });
    }
  }

  function readEditorForm(code) {
    var tier = parseInt((document.getElementById('dcLoyaltyTier') || {}).value, 10);
    if (isNaN(tier)) tier = 0;
    return {
      code: code,
      name: (document.getElementById('dcName') || {}).value.trim() || 'Customer',
      phone: (document.getElementById('dcPhone') || {}).value.trim(),
      email: (document.getElementById('dcEmail') || {}).value.trim(),
      discountType: (document.getElementById('dcType') || {}).value || 'percent',
      discountValue: parseFloat((document.getElementById('dcValue') || {}).value) || 0,
      expiryDate: (document.getElementById('dcExpiry') || {}).value || '',
      usageLimit: parseInt((document.getElementById('dcUsageLimit') || {}).value, 10) || 0,
      minOrderValue: parseFloat((document.getElementById('dcMinOrder') || {}).value) || 0,
      status: (document.getElementById('dcStatus') || {}).value || 'active',
      priceGroup: (document.getElementById('dcPriceGroup') || {}).value.trim(),
      loyaltyTier: tier,
      loyaltyOrders: parseInt((document.getElementById('dcLoyaltyOrders') || {}).value, 10) || 0,
      loyaltySpend: parseFloat((document.getElementById('dcLoyaltySpend') || {}).value) || 0
    };
  }

  function showEditor(title, card, isNew) {
    card = card || {};
    var code = card.code || '';
    var box = document.getElementById('aylenDiscountEditor');
    if (!box) return;
    box.classList.remove('is-hidden');
    box.innerHTML =
      '<div class="aylen-editor-card">' +
        '<h3>' + esc(title) + '</h3>' +
        '<div class="aylen-form-row">' +
          '<div><label class="aylen-label">Code</label>' +
          '<input id="dcCode" class="aylen-input" value="' + esc(code) + '" placeholder="VIP25" ' + (isNew ? '' : 'readonly') + ' style="text-transform:uppercase"></div>' +
          '<div><label class="aylen-label">Status</label><select id="dcStatus" class="aylen-input">' + statusOptions(card.status || 'active') + '</select></div>' +
        '</div>' +
        '<div class="aylen-form-row">' +
          '<div><label class="aylen-label">Customer name</label><input id="dcName" class="aylen-input" value="' + esc(card.name || '') + '"></div>' +
          '<div><label class="aylen-label">Phone (WhatsApp)</label><input id="dcPhone" class="aylen-input" value="' + esc(card.phone || '') + '" placeholder="+44…"></div>' +
        '</div>' +
        loyaltyEditorHtml(card) +
        '<label class="aylen-label">Email (optional)</label><input id="dcEmail" type="email" class="aylen-input" value="' + esc(card.email || '') + '">' +
        '<div class="aylen-form-row">' +
          '<div><label class="aylen-label">Discount type</label><select id="dcType" class="aylen-input">' + discountTypeOptions(card.discountType || 'percent') + '</select></div>' +
          '<div><label class="aylen-label">Discount value</label><input id="dcValue" type="number" step="0.01" min="0" class="aylen-input" value="' + Number(card.discountValue ?? card.discount ?? 0) + '">' +
          '<div class="aylen-chip-row"><button type="button" class="aylen-chip" data-pct="5">5%</button><button type="button" class="aylen-chip" data-pct="10">10%</button><button type="button" class="aylen-chip" data-pct="15">15%</button><button type="button" class="aylen-chip" data-pct="20">20%</button><button type="button" class="aylen-chip" data-pct="25">25%</button></div></div>' +
        '</div>' +
        '<div class="aylen-form-row">' +
          '<div><label class="aylen-label">Expiry date</label><input id="dcExpiry" type="date" class="aylen-input" value="' + esc((card.expiryDate || '').slice(0, 10)) + '"></div>' +
          '<div><label class="aylen-label">Usage limit (0 = unlimited)</label><input id="dcUsageLimit" type="number" min="0" class="aylen-input" value="' + Number(card.usageLimit || 0) + '"></div>' +
          '<div><label class="aylen-label">Min order (£)</label><input id="dcMinOrder" type="number" step="0.01" min="0" class="aylen-input" value="' + Number(card.minOrderValue || 0) + '"></div>' +
        '</div>' +
        '<label class="aylen-label">Price group (optional)</label><input id="dcPriceGroup" class="aylen-input" value="' + esc(card.priceGroup || '') + '" placeholder="trade / vip">' +
        '<div class="aylen-toolbar" style="margin-top:12px">' +
          '<button type="button" class="aylen-btn" id="dcSaveBtn">Save</button>' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDiscounts.hideEditor()">Cancel</button>' +
        '</div></div>';
    box.querySelectorAll('.aylen-chip[data-pct]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var val = document.getElementById('dcValue');
        var type = document.getElementById('dcType');
        if (type) type.value = 'percent';
        if (val) val.value = btn.getAttribute('data-pct');
      });
    });
    bindLoyaltyEditorEvents();
    var focusEl = document.getElementById(isNew ? 'dcCode' : 'dcName');
    if (focusEl) setTimeout(function() { focusEl.focus(); }, 30);
    return isNew;
  }

  async function saveCardFromEditor(isNew) {
    var code = (document.getElementById('dcCode') || {}).value.trim().toUpperCase();
    if (!code || code.length < 3) {
      notifyMsg('Code must be at least 3 characters', 'error');
      return;
    }
    var data = readEditorForm(code);
    if (data.discountType === 'percent' && (data.discountValue < 0 || data.discountValue > 100)) {
      notifyMsg('Percent discount must be 0–100', 'error');
      return;
    }
    data.discount = data.discountType === 'percent' ? data.discountValue : 0;
    data.active = data.status === 'active';
    data.code = code;

    if (!global.FBDB || !global.FBDB.saveCard) {
      notifyMsg('Firebase not ready', 'error');
      return;
    }
    try {
      await global.FBDB.saveCard(code, data);
      global.cardHolders = global.cardHolders || {};
      global.cardHolders[code] = data;
      notifyMsg('Discount code saved', 'success');
      global.AyelenAdminDiscounts.hideEditor();
      updateHeroStats();
      global.AyelenAdminDiscounts.refresh(true);
    } catch (e) {
      notifyMsg(e.message || 'Save failed', 'error');
    }
  }

  function renderList() {
    var list = document.getElementById('aylenDiscountList');
    if (!list) return;
    var codes = filteredCodes();
    if (!codes.length) {
      list.innerHTML =
        '<div class="aylen-empty-state">' +
          '<i class="fas fa-ticket"></i>' +
          '<h3>No discount codes</h3>' +
          '<p>Generate 100 codes or create one manually.</p>' +
          '<button type="button" class="aylen-btn" onclick="document.getElementById(\'dcBulkGenerateBtn\').click()">Generate 100 at 5%</button>' +
        '</div>';
      return;
    }

    var rows = codes.map(function(code) {
      var c = global.cardHolders[code] || {};
      var wa = waLink(c.phone, code);
      var waBtn = wa
        ? '<a class="aylen-btn aylen-btn-quiet" href="' + esc(wa) + '" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i></a> '
        : '';
      var tier = Number(c.loyaltyTier != null ? c.loyaltyTier : 0);
      return '<tr class="aylen-row-clickable" data-code="' + esc(code) + '">' +
        '<td><b>' + esc(code) + '</b><br><small>' + esc(c.name || '') + '</small></td>' +
        '<td>' + jarHtml(tier, c.loyaltyOrders, c.loyaltySpend, true) + '<br><small>' + esc(discountLabel(c)) + '</small></td>' +
        '<td>' + formatExpiry(c) + '</td>' +
        '<td>' + esc(c.status || 'active') + '</td>' +
        '<td>' + Number(c.usageCount || 0) + (c.usageLimit ? ' / ' + c.usageLimit : '') + '</td>' +
        '<td class="aylen-row-actions">' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDiscounts.edit(' + jsArg(code) + ')">Edit</button> ' +
          '<button type="button" class="aylen-btn aylen-btn-quiet" onclick="AyelenAdminDiscounts.copyCode(' + jsArg(code) + ')">Copy</button> ' +
          waBtn +
          '<button type="button" class="aylen-btn aylen-btn-danger" onclick="AyelenAdminDiscounts.remove(' + jsArg(code) + ')">Del</button>' +
        '</td></tr>';
    }).join('');

    list.innerHTML =
      '<table class="aylen-table aylen-table-compact"><thead><tr>' +
      '<th>Code / Customer</th><th>Loyalty / Discount</th><th>Expiry</th><th>Status</th><th>Uses</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
    if (!list._aylenRowClick) {
      list._aylenRowClick = true;
      list.addEventListener('click', function(e) {
        var tr = e.target.closest('tr[data-code]');
        if (!tr || e.target.closest('button,a')) return;
        global.AyelenAdminDiscounts.edit(tr.getAttribute('data-code'));
      });
    }
  }

  global.AyelenAdminDiscounts = {
    renderPanel: renderPanel,
    renderList: renderList,
    printCards: printCodesForCards,
    generateBulk: generateBulkCodes,
    refresh: async function(force) {
      await ensureCardsLoaded(!!force);
      updateHeroStats();
      renderList();
    },
    showCreate: function() {
      var isNew = showEditor('Create discount code', {
        status: 'unused',
        discountType: 'percent',
        discountValue: 5,
        loyaltyTier: 0,
        loyaltyOrders: 0,
        loyaltySpend: 0
      }, true);
      document.getElementById('dcSaveBtn').onclick = function() { saveCardFromEditor(isNew); };
    },
    generateRandom: function() {
      var code = global.AYLEN_DISCOUNT
        ? global.AYLEN_DISCOUNT.randomCode('AYL')
        : ('AYL' + Math.random().toString(36).slice(2, 7).toUpperCase());
      var isNew = showEditor('New random code', {
        code: code,
        status: 'unused',
        discountType: 'percent',
        discountValue: 5,
        loyaltyTier: 0
      }, true);
      document.getElementById('dcSaveBtn').onclick = function() { saveCardFromEditor(isNew); };
    },
    edit: function(code) {
      var card = (global.cardHolders || {})[code];
      if (!card) return;
      showEditor('Edit: ' + code, Object.assign({ code: code }, card), false);
      document.getElementById('dcSaveBtn').onclick = function() { saveCardFromEditor(false); };
    },
    copyCode: function(code) {
      var link = 'https://aylensale.com/?card=' + code;
      var text = code + ' — ' + link;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          notifyMsg('Copied code + link', 'success');
        }).catch(function() {
          notifyMsg(code, 'info');
        });
      } else {
        notifyMsg(code, 'info');
      }
    },
    remove: async function(code) {
      if (!confirm('Delete code ' + code + '?')) return;
      if (global.FBDB && global.FBDB.deleteCard) {
        await global.FBDB.deleteCard(code);
      }
      delete global.cardHolders[code];
      notifyMsg('Deleted', 'success');
      updateHeroStats();
      global.AyelenAdminDiscounts.refresh(true);
    },
    hideEditor: function() {
      var box = document.getElementById('aylenDiscountEditor');
      if (box) {
        box.classList.add('is-hidden');
        box.innerHTML = '';
      }
    }
  };
})(window);
