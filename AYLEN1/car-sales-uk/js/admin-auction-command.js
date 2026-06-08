/**
 * Admin — Auction Command Center (live stats, bot controls, bid analytics).
 */
(function(global) {
  var dashData = null;
  var pollTimer = null;
  var tickTimer = null;
  var selectedId = null;

  function esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s || '');
  }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
  }

  function setActionStatus(msg, type) {
    var el = document.getElementById('aacActionStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'aac-action-status' + (type ? ' aac-action-status--' + type : '');
    if (!msg) el.className = 'aac-action-status';
  }

  function setSyncing(on) {
    var dot = document.querySelector('.aac-live-dot');
    if (dot) dot.classList.toggle('aac-live-dot--sync', !!on);
  }

  function jsArg(v) {
    return typeof jsInlineArg === 'function' ? jsInlineArg(v) : JSON.stringify(String(v));
  }

  async function adminToken() {
    if (global.FBDB && global.FBDB.ensureAdminSession) {
      await global.FBDB.ensureAdminSession();
    }
    if (global.FBDB && global.FBDB.getAdminIdToken) {
      return global.FBDB.getAdminIdToken();
    }
    throw new Error('Admin login required — sign in to CMS first');
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
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error || ('Request failed (' + res.status + ')')
      };
    }
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
    try { data = await res.json(); } catch (e) { data = { ok: false, error: 'Invalid server response' }; }
    if (!res.ok && !data.error) data.error = 'Request failed (' + res.status + ')';
    if (!res.ok && data.ok !== false) data.ok = false;
    return data;
  }

  function fmtMoney(n) {
    return '£' + (Number(n) || 0).toFixed(2);
  }

  function fmtTimeLeft(ms) {
    ms = Math.max(0, Number(ms) || 0);
    if (ms >= 86400000) return Math.floor(ms / 86400000) + 'd ' + Math.floor((ms % 86400000) / 3600000) + 'h';
    if (ms >= 3600000) return Math.floor(ms / 3600000) + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';
    var m = Math.floor(ms / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    return m + 'm ' + s + 's';
  }

  function heatLabel(h) {
    if (h === 'hot') return { text: 'Hot', cls: 'aac-heat--hot' };
    if (h === 'warm') return { text: 'Warm', cls: 'aac-heat--warm' };
    if (h === 'solo') return { text: 'Solo', cls: 'aac-heat--solo' };
    return { text: 'Cold', cls: 'aac-heat--cold' };
  }

  function statCards(stats) {
    stats = stats || {};
    return (
      '<div class="aac-stats">' +
      statCard('Active', stats.active, 'fa-gavel', 'aac-stat--green') +
      statCard('Ending soon', stats.endingSoon, 'fa-hourglass-half', 'aac-stat--gold') +
      statCard('Real bids', stats.totalRealBids, 'fa-user-check', 'aac-stat--blue') +
      statCard('Bot bids', stats.totalBotBids, 'fa-robot', 'aac-stat--muted') +
      statCard('Hot lots', stats.hotLots, 'fa-fire', 'aac-stat--pink') +
      '</div>'
    );
  }

  function statCard(label, val, icon, cls) {
    return (
      '<div class="aac-stat ' + cls + '">' +
      '<i class="fas ' + icon + '"></i>' +
      '<div><strong>' + esc(String(val == null ? 0 : val)) + '</strong><span>' + esc(label) + '</span></div>' +
      '</div>'
    );
  }

  function settingsPanel(settings) {
    settings = settings || {};
    return (
      '<div class="aac-settings">' +
      '<h3><i class="fas fa-sliders"></i> Engine settings</h3>' +
      '<div class="aac-settings-grid">' +
      toggleRow('siteRevealed', 'Site revealed (public launch)', !!settings.siteRevealed,
        'When ON, bot bidders stop unless enabled per auction.') +
      toggleRow('botGlobalEnabled', 'Bot bidders (global)', settings.botGlobalEnabled !== false,
        'Simulated small bids up to your max — makes lots look alive before launch.') +
      toggleRow('autoRelistZeroBids', 'Auto-relist if no real bids', settings.autoRelistZeroBids !== false,
        'When auction ends with zero real bids, restart for 24h.') +
      toggleRow('antiSnipeEnabled', 'Anti-snipe (extend time)', settings.antiSnipeEnabled !== false,
        'Bid in last 3 min extends auction by 3 min — stops last-second sniping.') +
      '<label class="aac-field">Default bot max £' +
      '<input type="number" id="aacBotMaxTotal" min="0" step="1" value="' + Number(settings.defaultBotMaxTotal || 150) + '">' +
      '<span class="aac-hint">Bots stop bidding above this price unless you raise it per lot.</span></label>' +
      '</div>' +
      '<div class="aac-settings-actions">' +
      '<button type="button" class="aylen-btn" id="aacSaveSettingsBtn">Save settings</button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet" id="aacRunTickBtn">Run engine tick</button>' +
      '</div>' +
      '<p id="aacActionStatus" class="aac-action-status" aria-live="polite"></p>' +
      '</div>'
    );
  }

  function toggleRow(id, label, on, hint) {
    return (
      '<label class="aac-toggle">' +
      '<input type="checkbox" id="aacSet_' + id + '"' + (on ? ' checked' : '') + '>' +
      '<span class="aac-toggle-ui"></span>' +
      '<span class="aac-toggle-text"><b>' + esc(label) + '</b><small>' + esc(hint) + '</small></span>' +
      '</label>'
    );
  }

  function auctionCards(list) {
    if (!list || !list.length) {
      return '<p class="aac-empty">No auctions yet — create one with + Auction.</p>';
    }
    return (
      '<div class="aac-grid">' +
      list.map(function(a) {
        var heat = heatLabel(a.heat);
        var sel = selectedId === a.id ? ' aac-card--selected' : '';
        return (
          '<article class="aac-card' + sel + '" data-aac-id="' + esc(String(a.id)) + '">' +
          '<div class="aac-card-top">' +
          '<span class="aac-heat ' + heat.cls + '">' + esc(heat.text) + '</span>' +
          '<span class="aac-status">' + esc(a.status) + '</span></div>' +
          '<h4>' + esc(a.name) + '</h4>' +
          '<div class="aac-card-price">' + fmtMoney(a.currentPrice) +
          '<small>start ' + fmtMoney(a.startingPrice) + '</small></div>' +
          '<div class="aac-card-meta">' +
          '<span><i class="fas fa-users"></i> ' + Number(a.participantCount || 0) + ' players</span>' +
          '<span><i class="fas fa-hand-holding-dollar"></i> ' + Number(a.realBids || 0) + ' real / ' + Number(a.botBids || 0) + ' bot</span>' +
          '</div>' +
          '<div class="aac-timer"><i class="fas fa-clock"></i> ' +
          (a.status === 'active' ? fmtTimeLeft(a.msLeft) : 'ended') + '</div>' +
          '<div class="aac-jars">' + participantJars(a.participants) + '</div>' +
          '</article>'
        );
      }).join('') +
      '</div>'
    );
  }

  function participantJars(participants) {
    participants = participants || [];
    if (!participants.length) return '<span class="aac-jar-empty">No real bidders yet</span>';
    return participants.slice(0, 6).map(function(p, i) {
      var h = Math.min(100, 20 + (p.bids * 15));
      return (
        '<div class="aac-jar" title="' + esc(p.name) + ' · ' + fmtMoney(p.maxAmount) + '">' +
        '<div class="aac-jar-fill" style="height:' + h + '%"></div>' +
        '<span>' + esc((p.name || 'P').slice(0, 1)) + '</span></div>'
      );
    }).join('');
  }

  function detailPanel(detail) {
    if (!detail || !detail.ok) return '<p class="aac-empty">Select an auction</p>';
    var a = detail.analysis || {};
    var bids = detail.bids || [];
    var maxAmt = bids.reduce(function(m, b) { return Math.max(m, Number(b.amount || 0)); }, 1);
    return (
      '<div class="aac-detail">' +
      '<h3>' + esc(a.name || 'Auction') + '</h3>' +
      '<div class="aac-detail-stats">' +
      '<span>' + fmtMoney(a.currentPrice) + ' now</span>' +
      '<span>' + Number(a.participantCount || 0) + ' players</span>' +
      '<span>' + fmtTimeLeft(a.msLeft) + ' left</span></div>' +
      '<div class="aac-bot-row">' +
      '<label><input type="checkbox" id="aacDetailBotEnabled"' + (a.botEnabled !== false ? ' checked' : '') + '> Bot on this lot</label>' +
      '<label>Bot max £<input type="number" id="aacDetailBotMax" min="0" step="1" value="' +
      Number(a.botMaxTotal || dashData.settings.defaultBotMaxTotal || 150) + '"></label>' +
      '<button type="button" class="aylen-btn aylen-btn-sm" id="aacSaveLotBotBtn">Apply</button>' +
      '</div>' +
      '<div class="aac-chart">' +
      bids.slice(0, 20).reverse().map(function(b) {
        var w = Math.max(8, Math.round((Number(b.amount || 0) / maxAmt) * 100));
        return (
          '<div class="aac-bar-row' + (b.isBot ? ' aac-bar-row--bot' : '') + '">' +
          '<span class="aac-bar-label">' + esc(b.bidderName) + '</span>' +
          '<div class="aac-bar-track"><div class="aac-bar-fill" style="width:' + w + '%"></div></div>' +
          '<span class="aac-bar-amt">' + fmtMoney(b.amount) + '</span>' +
          '<time>' + esc(new Date(b.timestamp || 0).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })) + '</time>' +
          '</div>'
        );
      }).join('') +
      (bids.length ? '' : '<p class="aac-hint">No bids yet — bots may place first when enabled.</p>') +
      '</div>' +
      '<div class="aac-detail-actions">' +
      '<button type="button" class="aylen-btn aylen-btn-quiet aylen-btn-sm" onclick="AyelenAdminAuctions.openEditor(' + jsArg(a.id) + ')">Full editor</button>' +
      '</div></div>'
    );
  }

  function shellHtml() {
    return (
      '<div class="aac-root">' +
      '<div class="aac-head">' +
      '<h2 class="aylen-page-title"><i class="fas fa-chart-line"></i> Auction Command Center</h2>' +
      '<p class="aylen-hint">Live overview — who is bidding, bot activity, timers. Click a lot for bid timeline.</p>' +
      '<div class="aac-toolbar">' +
      '<button type="button" class="aylen-btn" onclick="openAddAuctionModal()">+ Auction</button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet" id="aacRefreshBtn">Refresh</button>' +
      '<span class="aac-live-dot"><i class="fas fa-circle"></i> Live</span>' +
      '</div></div>' +
      '<div id="aacStatsMount"></div>' +
      '<div id="aacSettingsMount"></div>' +
      '<div class="aac-split">' +
      '<div id="aacCardsMount" class="aac-split-main"></div>' +
      '<div id="aacDetailMount" class="aac-split-side"></div>' +
      '</div></div>'
    );
  }

  function renderLoadingState() {
    var html = '<p class="aac-hint"><i class="fas fa-spinner fa-spin"></i> Loading auction data…</p>';
    ['aacStatsMount', 'aacSettingsMount', 'aacCardsMount'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = html;
    });
  }

  function renderErrorState(message) {
    var errHtml =
      '<div class="aac-error">' +
      '<p class="aac-hint"><i class="fas fa-triangle-exclamation"></i> ' + esc(message || 'Could not load auction dashboard') + '</p>' +
      '<div class="aac-settings-actions" style="margin-top:10px">' +
      '<button type="button" class="aylen-btn" id="aacRetryBtn">Retry</button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet" id="aacReloginBtn">Sign in again</button>' +
      '</div></div>';
    var statsEl = document.getElementById('aacStatsMount');
    var setEl = document.getElementById('aacSettingsMount');
    var cardsEl = document.getElementById('aacCardsMount');
    if (statsEl) statsEl.innerHTML = errHtml;
    if (setEl) setEl.innerHTML = '';
    if (cardsEl) {
      cardsEl.innerHTML = '<p class="aac-empty">Auction stats and lots will appear after you sign in and tap Retry.</p>';
    }
    var retry = document.getElementById('aacRetryBtn');
    if (retry) retry.onclick = function() { refresh(); };
    var relogin = document.getElementById('aacReloginBtn');
    if (relogin) {
      relogin.onclick = function() {
        if (typeof global.showAdminLoginModal === 'function') global.showAdminLoginModal();
        else notifyMsg('Use footer Admin login', 'info');
      };
    }
  }

  async function loadDashboard(opts) {
    opts = opts || {};
    try {
      var data = await apiGet('dashboard');
      if (!data || data.ok === false) {
        if (opts.keepStale && dashData) return dashData;
        var err = (data && data.error) || 'Dashboard unavailable';
        if (data && data.status === 401) {
          err = 'Admin session expired — tap Sign in again, then Retry';
        }
        notifyMsg(err, 'error');
        dashData = null;
        renderErrorState(err);
        return null;
      }
      dashData = data;
      return data;
    } catch (err) {
      if (opts.keepStale && dashData) return dashData;
      var msg = (err && err.message) || 'Network error loading auctions';
      notifyMsg(msg, 'error');
      dashData = null;
      renderErrorState(msg);
      return null;
    }
  }

  async function loadDetail(id) {
    return apiGet('detail', { id: id });
  }

  function renderAll(opts) {
    opts = opts || {};
    if (!dashData) return;
    var statsEl = document.getElementById('aacStatsMount');
    var setEl = document.getElementById('aacSettingsMount');
    var cardsEl = document.getElementById('aacCardsMount');
    if (statsEl) statsEl.innerHTML = statCards(dashData.stats);
    var refreshSettings = !opts.skipSettings || !document.getElementById('aacSaveSettingsBtn');
    if (setEl && refreshSettings) {
      setEl.innerHTML = settingsPanel(dashData.settings);
      bindSettingsEvents();
    }
    if (cardsEl) cardsEl.innerHTML = auctionCards(dashData.auctions);
    bindCardEvents();
  }

  async function refreshDetail() {
    if (!selectedId) return;
    var detail = await loadDetail(selectedId);
    var mount = document.getElementById('aacDetailMount');
    if (mount) {
      mount.innerHTML = detailPanel(detail);
      bindDetailEvents();
    }
  }

  function bindSettingsEvents() {
    var saveBtn = document.getElementById('aacSaveSettingsBtn');
    var tickBtn = document.getElementById('aacRunTickBtn');
    if (saveBtn) {
      saveBtn.onclick = async function() {
        saveBtn.disabled = true;
        setActionStatus('Saving settings…', 'info');
        try {
          var body = {
            action: 'settings',
            siteRevealed: !!(document.getElementById('aacSet_siteRevealed') || {}).checked,
            botGlobalEnabled: !!(document.getElementById('aacSet_botGlobalEnabled') || {}).checked,
            autoRelistZeroBids: !!(document.getElementById('aacSet_autoRelistZeroBids') || {}).checked,
            antiSnipeEnabled: !!(document.getElementById('aacSet_antiSnipeEnabled') || {}).checked,
            defaultBotMaxTotal: Number((document.getElementById('aacBotMaxTotal') || {}).value || 0)
          };
          if (body.siteRevealed && body.botGlobalEnabled) {
            body.botGlobalEnabled = false;
            notifyMsg('Site revealed — bot bidders turned off globally (enable per lot if needed).', 'success');
          }
          var r = await apiPost(body);
          if (r.ok) {
            setActionStatus('Settings saved.', 'success');
            notifyMsg('Auction settings saved', 'success');
            await refresh({ silent: true, refreshSettings: true });
          } else {
            setActionStatus(r.error || 'Save failed', 'error');
            notifyMsg(r.error || 'Save failed', 'error');
          }
        } catch (err) {
          setActionStatus((err && err.message) || 'Save failed', 'error');
          notifyMsg((err && err.message) || 'Save failed', 'error');
        } finally {
          saveBtn.disabled = false;
        }
      };
    }
    if (tickBtn) {
      tickBtn.onclick = async function() {
        tickBtn.disabled = true;
        setActionStatus('Running engine tick…', 'info');
        try {
          var r = await apiPost({ action: 'tick' });
          if (r.ok) {
            var s = r.summary || {};
            var tickMsg = 'Tick: ' + Number(s.botBids || 0) + ' bot bids, ' + Number(s.finalized || 0) + ' finalized, ' + Number(s.relisted || 0) + ' relisted';
            setActionStatus(tickMsg, 'success');
            notifyMsg(tickMsg, 'success');
            await refresh({ silent: true });
          } else {
            setActionStatus(r.error || 'Tick failed', 'error');
            notifyMsg(r.error || 'Tick failed', 'error');
          }
        } catch (err) {
          setActionStatus((err && err.message) || 'Tick failed', 'error');
          notifyMsg((err && err.message) || 'Tick failed', 'error');
        } finally {
          tickBtn.disabled = false;
        }
      };
    }
  }

  function bindCardEvents() {
    document.querySelectorAll('.aac-card[data-aac-id]').forEach(function(card) {
      card.onclick = async function() {
        selectedId = card.getAttribute('data-aac-id');
        document.querySelectorAll('.aac-card').forEach(function(c) {
          c.classList.toggle('aac-card--selected', c === card);
        });
        await refreshDetail();
      };
    });
  }

  function bindDetailEvents() {
    var btn = document.getElementById('aacSaveLotBotBtn');
    if (!btn || !selectedId) return;
    btn.onclick = async function() {
      btn.disabled = true;
      var r = await apiPost({
        action: 'auction-bot',
        auctionId: selectedId,
        botEnabled: !!(document.getElementById('aacDetailBotEnabled') || {}).checked,
        botMaxTotal: Number((document.getElementById('aacDetailBotMax') || {}).value || 0)
      });
      btn.disabled = false;
      if (r.ok) {
        notifyMsg('Lot bot settings updated', 'success');
        await refresh({ silent: true });
        await refreshDetail();
      } else notifyMsg(r.error || 'Update failed', 'error');
    };
  }

  async function refresh(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    if (!silent) {
      renderLoadingState();
    } else {
      setSyncing(true);
    }
    try {
      await loadDashboard({ keepStale: silent });
      if (dashData) {
        renderAll({
          skipSettings: silent && !opts.refreshSettings
        });
      }
      if (selectedId && dashData) await refreshDetail();
    } finally {
      setSyncing(false);
    }
  }

  function startPoll() {
    stopPoll();
    pollTimer = setInterval(function() {
      refresh({ silent: true }).catch(function() {});
    }, 60000);
    tickTimer = setInterval(function() {
      apiPost({ action: 'tick' }).catch(function() {});
    }, 90000);
  }

  function stopPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
  }

  async function renderPanel(mount) {
    if (!mount) return;
    stopPoll();
    if (global.AYLEN_MODAL && global.AYLEN_MODAL.syncAdminShellClasses) {
      global.AYLEN_MODAL.syncAdminShellClasses();
    }
    document.body.classList.remove('admin-modal-open');
    mount.innerHTML = shellHtml();
    var refreshBtn = document.getElementById('aacRefreshBtn');
    if (refreshBtn) {
      refreshBtn.onclick = function() {
        refreshBtn.disabled = true;
        refresh({ silent: true }).finally(function() { refreshBtn.disabled = false; });
      };
    }
    var detailMount = document.getElementById('aacDetailMount');
    if (detailMount) {
      detailMount.innerHTML = '<p class="aac-hint aac-empty">← Click a lot to see bid timeline & bot controls</p>';
    }
    try {
      await refresh();
      if (dashData) startPoll();
    } catch (err) {
      renderErrorState((err && err.message) || 'Failed to load auctions');
    }
  }

  function openEditor(id) {
    if (typeof global.editAuction === 'function') global.editAuction(id);
  }

  global.AyelenAdminAuctions = {
    renderPanel: renderPanel,
    refresh: refresh,
    stopPoll: stopPoll,
    openEditor: openEditor
  };
})(typeof window !== 'undefined' ? window : this);
