/**
 * Admin — Firebase Storage tools (optimize + orphan cleanup).
 * Applies to products, auctions, VIP — not auction-engine specific.
 */
(function(global) {
  var confirmPending = {};

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
  }

  function setStatus(msg, type) {
    var el = document.getElementById('aylenStorageStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'aac-action-status' + (type ? ' aac-action-status--' + type : '');
    if (!msg) el.className = 'aac-action-status';
  }

  function fmtSaved(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
    if (bytes > 0) return bytes + ' B';
    return '';
  }

  function consumeConfirm(key, label) {
    var now = Date.now();
    var prev = confirmPending[key];
    if (prev && prev.until > now) {
      delete confirmPending[key];
      return true;
    }
    confirmPending[key] = { until: now + 8000 };
    setStatus('Tap “' + label + '” again within 8 seconds to confirm.', 'warn');
    return false;
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

  async function runStorageOrphanCleanup(apply) {
    var token = await adminToken();
    var res = await fetch('/api/storage-orphans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ apply: !!apply, limit: 50 })
    });
    return parseStorageApiResponse(res);
  }

  async function runStorageOptimize(apply) {
    var token = await adminToken();
    var res = await fetch('/api/storage-resize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ apply: !!apply, limit: 30 })
    });
    return parseStorageApiResponse(res);
  }

  async function parseStorageApiResponse(res) {
    var text = '';
    try { text = await res.text(); } catch (e) { text = ''; }
    var data = {};
    if (text) {
      try { data = JSON.parse(text); } catch (e) { /* not JSON */ }
    }
    if (!data.error && !res.ok) {
      var snippet = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      data.error = snippet || ('Server error (' + res.status + ')');
    }
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || ('Request failed (' + res.status + ')'));
    }
    if (!data.ok) data.ok = true;
    return data;
  }

  function panelHtml() {
    return (
      '<div class="aylen-panel-card aylen-storage-card">' +
      '<h3><i class="fas fa-images"></i> Photo storage</h3>' +
      '<p class="aylen-hint">All site photos: products, auctions, VIP stock.</p>' +
      '<div class="aylen-toolbar" style="margin-top:10px">' +
      '<button type="button" class="aylen-btn aylen-btn-quiet" id="aylenOptimizeStorageBtn">Optimize photos</button>' +
      '<button type="button" class="aylen-btn aylen-btn-quiet" id="aylenCleanOrphansBtn">Clean orphan photos</button>' +
      '</div>' +
      '<p id="aylenStorageStatus" class="aac-action-status" aria-live="polite"></p>' +
      '<p class="aylen-hint">Optimize shrinks heavy uploads. Clean orphan deletes files not linked to any live listing.</p>' +
      '</div>'
    );
  }

  function bindEvents() {
    var orphansBtn = document.getElementById('aylenCleanOrphansBtn');
    if (orphansBtn) {
      orphansBtn.onclick = async function() {
        orphansBtn.disabled = true;
        setStatus('Scanning orphan photos…', 'info');
        try {
          var dry = await runStorageOrphanCleanup(false);
          var orphanCount = Number(dry.orphanTotal || 0);
          if (!orphanCount) {
            var noneMsg = 'No orphan photos (' + Number(dry.scanned || 0) + ' checked, ' + Number(dry.referencedCount || 0) + ' in use)';
            setStatus(noneMsg, 'success');
            notifyMsg(noneMsg, 'success');
            return;
          }
          var sample = (dry.rows || []).slice(0, 3).map(function(r) {
            return (r.name || '').split('/').pop();
          }).join(', ');
          var preview = 'Found ' + orphanCount + ' orphan file(s) (~' + (dry.saved || 'space') + '). ' +
            (sample ? 'Examples: ' + sample + '. ' : '') +
            'Tap Clean orphan photos again to delete (50 per batch).';
          setStatus(preview, 'warn');
          if (!consumeConfirm('orphans', 'Clean orphan photos')) return;
          var total = 0;
          var savedBytesTotal = 0;
          do {
            var batch = await runStorageOrphanCleanup(true);
            total += Number(batch.plannedOrDeleted || 0);
            savedBytesTotal += Number(batch.savedBytes || 0);
            orphanCount = Number(batch.orphanTotal || 0);
            if (!batch.plannedOrDeleted) break;
          } while (total < 200);
          var freed = fmtSaved(savedBytesTotal) || dry.saved || 'space';
          var doneMsg = 'Removed ' + total + ' orphan file(s). ~' + freed + ' freed. Remaining: ' + orphanCount;
          setStatus(doneMsg, 'success');
          notifyMsg(doneMsg, 'success');
        } catch (err) {
          setStatus((err && err.message) || 'Orphan cleanup failed', 'error');
          notifyMsg((err && err.message) || 'Orphan cleanup failed', 'error');
        } finally {
          orphansBtn.disabled = false;
        }
      };
    }

    var optimizeBtn = document.getElementById('aylenOptimizeStorageBtn');
    if (optimizeBtn) {
      optimizeBtn.onclick = async function() {
        optimizeBtn.disabled = true;
        setStatus('Scanning heavy photos…', 'info');
        try {
          var dry = await runStorageOptimize(false);
          var planned = Number(dry.plannedOrApplied || 0);
          if (!planned) {
            var optNone = 'No heavy photos need optimization (' + Number(dry.scanned || 0) + ' scanned)';
            setStatus(optNone, 'success');
            notifyMsg(optNone, 'success');
            return;
          }
          setStatus('Optimize ' + planned + ' heavy photo(s)? Saves ~' + (dry.saved || 'space') + '. Tap Optimize photos again to start.', 'warn');
          if (!consumeConfirm('optimize', 'Optimize photos')) return;
          var total = 0;
          var saved = dry.saved || '';
          do {
            var batch = await runStorageOptimize(true);
            total += Number(batch.plannedOrApplied || 0);
            saved = batch.saved || saved;
            if (!batch.plannedOrApplied) break;
          } while (total < 120);
          var optDone = 'Optimized ' + total + ' photo(s). Saved ' + saved + ' this run.';
          setStatus(optDone, 'success');
          notifyMsg(optDone, 'success');
        } catch (err) {
          setStatus((err && err.message) || 'Optimize failed', 'error');
          notifyMsg((err && err.message) || 'Optimize failed', 'error');
        } finally {
          optimizeBtn.disabled = false;
        }
      };
    }
  }

  function renderPanel(mount) {
    if (!mount) return;
    mount.innerHTML = panelHtml();
    bindEvents();
  }

  global.AyelenAdminStorage = {
    renderPanel: renderPanel,
    runStorageOptimize: runStorageOptimize,
    runStorageOrphanCleanup: runStorageOrphanCleanup
  };
})(typeof window !== 'undefined' ? window : this);
