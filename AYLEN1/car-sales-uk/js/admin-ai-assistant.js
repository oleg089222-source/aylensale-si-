/**
 * AI Admin Assistant — voice/text product drafts for UK listings (admin only).
 */
(function(global) {
  var state = {
    open: false,
    listening: false,
    draft: null,
    stockAction: null,
    mode: 'listing',
    targetProductId: null,
    targetModalId: null,
    autoApply: false,
    voiceBaseText: '',
    parseInFlight: false,
    aiConfigured: null,
    aiModel: '',
    history: [],
    undoStack: []
  };

  function modalField(id) {
    if (typeof global.queryInAdminModal === 'function') {
      return global.queryInAdminModal('#' + id);
    }
    return document.getElementById(id);
  }

  function setModalField(id, value) {
    var el = modalField(id);
    if (el) el.value = value == null ? '' : value;
    return el;
  }

  var CATEGORY_OPTIONS = [
    { value: 'electronics', label: 'Electronics' },
    { value: 'job-lots', label: 'Job lots / Mixed pallets' },
    { value: 'cables', label: 'Cables & accessories' },
    { value: 'homeware', label: 'Homeware' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'general', label: 'General' }
  ];

  function getAdminKey() {
    try {
      return sessionStorage.getItem('aylen_admin_key') || '';
    } catch (e) {
      return '';
    }
  }

  function isAdminReady() {
    return global.isAdminMode && global.FBDB && global.FBDB.isAdmin && global.FBDB.isAdmin() && getAdminKey();
  }

  function apiRequest(action, payload) {
    var key = getAdminKey();
    if (!key) return Promise.reject(new Error('Admin session expired. Log in again.'));
    return fetch('/api/ai-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': key
      },
      body: JSON.stringify(Object.assign({ action: action }, payload || {}))
    }).then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) throw new Error(data.error || 'AI request failed');
        return data;
      });
    });
  }

  function fieldStyle() {
    return 'width:100%;padding:8px 10px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;border-radius:8px;margin-bottom:8px;box-sizing:border-box;font-size:13px';
  }

  function emptyDraft() {
    return {
      name: '',
      shortTitle: '',
      category: 'general',
      categoryLabel: '',
      desc: '',
      conditionDesc: '',
      price: 0,
      wholesalePrice: null,
      stock: 1,
      stockStatus: 'available',
      tags: [],
      wholesaleNote: '',
      pickupNote: '',
      disclaimer: '',
      seoTitle: '',
      seoDescription: '',
      badge: '',
      ebayKeywords: [],
      sku: '',
      brand: '',
      model: '',
      imageAltTexts: [],
      questions: [],
      confidence: 0,
      detectedLang: '',
      summary: '',
      assistantReply: '',
      commandApplied: ''
    };
  }

  function aiSettings() {
    return global.AYLEN_AI_SETTINGS || { isEnabled: function() { return true; }, canUseVoice: function() { return true; }, useWhisper: function() { return false; }, canUseCamera: function() { return true; }, canAutoFill: function() { return true; }, canSpeak: function() { return true; }, load: function() { return {}; }, save: function() {} };
  }

  function speakReply(text) {
    if (!text || !aiSettings().canSpeak()) return;
    if (global.AYLEN_AI_MEDIA && global.AYLEN_AI_MEDIA.playTts) {
      global.AYLEN_AI_MEDIA.playTts(apiRequest, text);
    }
  }

  function tagsToString(tags) {
    return Array.isArray(tags) ? tags.join(', ') : '';
  }

  function parseTags(str) {
    return String(str || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean);
  }

  function renderDraftForm() {
    var d = state.draft || emptyDraft();
    var tags = tagsToString(d.tags);
    var questionsHtml = '';
    if (d.questions && d.questions.length) {
      questionsHtml = '<div class="ai-questions"><h4 style="color:#fbbf24;margin:0 0 8px"><i class="fas fa-circle-question"></i> Уточните</h4>' +
        d.questions.map(function(q) {
          return '<div style="margin-bottom:8px"><label style="color:#94a3b8;font-size:12px">' + escapeHtml(q.text) + '</label>' +
            '<input type="text" class="ai-q-answer" data-qid="' + escapeHtml(q.id) + '" data-qfield="' + escapeHtml(q.field || '') + '" placeholder="Ваш ответ…" style="' + fieldStyle() + '"></div>';
        }).join('') +
        '<button type="button" id="aiApplyAnswers" style="padding:8px 12px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;width:100%">Обновить черновик</button></div>';
    }

    var catOptions = CATEGORY_OPTIONS.map(function(c) {
      return '<option value="' + c.value + '"' + (d.category === c.value ? ' selected' : '') + '>' + c.label + '</option>';
    }).join('');

    return '' +
      (d.summary ? '<p style="color:#94a3b8;font-size:12px;margin:0 0 10px">' + escapeHtml(d.summary) + '</p>' : '') +
      (d.aiWarning ? '<p style="color:#f87171;font-size:12px">' + escapeHtml(d.aiWarning) + '</p>' : '') +
      questionsHtml +
      '<label style="color:#cbd5e1;font-size:12px">Product title *</label><input id="aiFieldName" value="' + escapeHtml(d.name) + '" style="' + fieldStyle() + '">' +
      '<label style="color:#cbd5e1;font-size:12px">Short title</label><input id="aiFieldShortTitle" value="' + escapeHtml(d.shortTitle) + '" style="' + fieldStyle() + '">' +
      '<label style="color:#cbd5e1;font-size:12px">Category</label><select id="aiFieldCategory" style="' + fieldStyle() + '">' + catOptions + '</select>' +
      '<label style="color:#cbd5e1;font-size:12px">Description</label><textarea id="aiFieldDesc" rows="4" style="' + fieldStyle() + '">' + escapeHtml(d.desc) + '</textarea>' +
      '<label style="color:#cbd5e1;font-size:12px">Condition</label><textarea id="aiFieldCondition" rows="2" style="' + fieldStyle() + '">' + escapeHtml(d.conditionDesc) + '</textarea>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">' +
        '<div><label style="color:#cbd5e1;font-size:12px">Price £</label><input id="aiFieldPrice" type="number" step="0.01" min="0" value="' + (d.price || '') + '" style="' + fieldStyle() + '"></div>' +
        '<div><label style="color:#cbd5e1;font-size:12px">Wholesale £</label><input id="aiFieldWholesale" type="number" step="0.01" min="0" value="' + (d.wholesalePrice || '') + '" style="' + fieldStyle() + '"></div>' +
        '<div><label style="color:#cbd5e1;font-size:12px">Qty</label><input id="aiFieldStock" type="number" min="0" value="' + (d.stock || 0) + '" style="' + fieldStyle() + '"></div>' +
      '</div>' +
      '<label style="color:#cbd5e1;font-size:12px">Stock status</label><select id="aiFieldStockStatus" style="' + fieldStyle() + '">' +
        ['available', 'low', 'sold_out', 'pre_order'].map(function(s) {
          return '<option value="' + s + '"' + (d.stockStatus === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') +
      '</select>' +
      '<label style="color:#cbd5e1;font-size:12px">Tags (comma separated)</label><input id="aiFieldTags" value="' + escapeHtml(tags) + '" style="' + fieldStyle() + '">' +
      '<label style="color:#cbd5e1;font-size:12px">Wholesale note</label><input id="aiFieldWholesaleNote" value="' + escapeHtml(d.wholesaleNote) + '" style="' + fieldStyle() + '">' +
      '<label style="color:#cbd5e1;font-size:12px">Pickup / delivery note</label><input id="aiFieldPickupNote" value="' + escapeHtml(d.pickupNote) + '" style="' + fieldStyle() + '">' +
      '<label style="color:#cbd5e1;font-size:12px">Disclaimer</label><textarea id="aiFieldDisclaimer" rows="2" style="' + fieldStyle() + '">' + escapeHtml(d.disclaimer) + '</textarea>' +
      '<label style="color:#cbd5e1;font-size:12px">SEO title</label><input id="aiFieldSeoTitle" value="' + escapeHtml(d.seoTitle) + '" style="' + fieldStyle() + '">' +
      '<label style="color:#cbd5e1;font-size:12px">SEO description</label><textarea id="aiFieldSeoDesc" rows="2" style="' + fieldStyle() + '">' + escapeHtml(d.seoDescription) + '</textarea>' +
      '<label style="color:#cbd5e1;font-size:12px">Badge</label><input id="aiFieldBadge" value="' + escapeHtml(d.badge) + '" style="' + fieldStyle() + '">' +
      '<label style="color:#cbd5e1;font-size:12px">SKU</label><input id="aiFieldSku" value="' + escapeHtml(d.sku) + '" style="' + fieldStyle() + '">' +
      '<label style="color:#cbd5e1;font-size:12px">eBay keywords</label><input id="aiFieldEbayKw" value="' + escapeHtml(tagsToString(d.ebayKeywords)) + '" style="' + fieldStyle() + '">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<div><label style="color:#cbd5e1;font-size:12px">Brand</label><input id="aiFieldBrand" value="' + escapeHtml(d.brand) + '" style="' + fieldStyle() + '"></div>' +
      '<div><label style="color:#cbd5e1;font-size:12px">Model</label><input id="aiFieldModel" value="' + escapeHtml(d.model) + '" style="' + fieldStyle() + '"></div></div>' +
      (d.commandApplied ? '<p style="color:#38bdf8;font-size:11px">Command: ' + escapeHtml(d.commandApplied) + '</p>' : '');
  }

  function renderSettingsPanel() {
    var s = aiSettings().load();
    return '<div class="ai-settings-grid">' +
      '<div class="ai-setting-row"><label>AI Assistant (master)</label><input type="checkbox" id="aiSetMaster" ' + (s.master ? 'checked' : '') + '></div>' +
      '<div class="ai-setting-row"><label>Voice input</label><input type="checkbox" id="aiSetVoice" ' + (s.voice ? 'checked' : '') + '></div>' +
      '<div class="ai-setting-row"><label>Whisper (OpenAI, better RU)</label><input type="checkbox" id="aiSetWhisper" ' + (s.whisper ? 'checked' : '') + '></div>' +
      '<div class="ai-setting-row"><label>Camera scan</label><input type="checkbox" id="aiSetCamera" ' + (s.camera ? 'checked' : '') + '></div>' +
      '<div class="ai-setting-row"><label>Auto-fill product form</label><input type="checkbox" id="aiSetAutoFill" ' + (s.autoFill ? 'checked' : '') + '></div>' +
      '<div class="ai-setting-row"><label>AI speaks replies (TTS)</label><input type="checkbox" id="aiSetTts" ' + (s.tts ? 'checked' : '') + '></div>' +
      '<div class="ai-setting-row"><label>Auto-translate after voice</label><input type="checkbox" id="aiSetAutoParse" ' + (s.autoParseAfterVoice ? 'checked' : '') + '></div>' +
      '<div class="ai-setting-row"><label>Browser voice fallback</label><input type="checkbox" id="aiSetBrowserVoice" ' + (s.browserVoiceFallback ? 'checked' : '') + '></div>' +
      '</div><p style="color:#64748b;font-size:11px">Ключ OpenAI только на сервере (Vercel). Выключите AI, если не нужен.</p>';
  }

  function bindSettingsHandlers() {
    var ids = ['aiSetMaster', 'aiSetVoice', 'aiSetWhisper', 'aiSetCamera', 'aiSetAutoFill', 'aiSetTts', 'aiSetAutoParse', 'aiSetBrowserVoice'];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.onchange = function() {
        aiSettings().save({
          master: !!document.getElementById('aiSetMaster').checked,
          voice: !!document.getElementById('aiSetVoice').checked,
          whisper: !!document.getElementById('aiSetWhisper').checked,
          camera: !!document.getElementById('aiSetCamera').checked,
          autoFill: !!document.getElementById('aiSetAutoFill').checked,
          tts: !!document.getElementById('aiSetTts').checked,
          autoParseAfterVoice: !!document.getElementById('aiSetAutoParse').checked,
          browserVoiceFallback: !!document.getElementById('aiSetBrowserVoice').checked
        });
        state.autoApply = aiSettings().canAutoFill() && state.autoApply;
        aiSettings().applyVisibility();
        syncFeatureButtons();
      };
    });
  }

  function syncFeatureButtons() {
    var s = aiSettings().load();
    var mic = document.getElementById('aiMicBtn');
    var cam = document.getElementById('aiCameraBtn');
    var parseBtn = document.getElementById('aiParseBtn');
    if (mic) mic.style.display = s.master && s.voice ? '' : 'none';
    if (cam) cam.style.display = s.master && s.camera ? '' : 'none';
    if (parseBtn) parseBtn.style.display = s.master ? '' : 'none';
  }

  function collectDraftFromForm() {
    var d = state.draft ? Object.assign({}, state.draft) : emptyDraft();
    var g = function(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };
    d.name = g('aiFieldName');
    d.shortTitle = g('aiFieldShortTitle');
    d.category = g('aiFieldCategory') || 'general';
    d.desc = g('aiFieldDesc');
    d.conditionDesc = g('aiFieldCondition');
    d.price = parseFloat(g('aiFieldPrice')) || 0;
    d.wholesalePrice = parseFloat(g('aiFieldWholesale')) || null;
    d.stock = parseInt(g('aiFieldStock'), 10) || 0;
    d.stockStatus = g('aiFieldStockStatus') || 'available';
    d.tags = parseTags(g('aiFieldTags'));
    d.wholesaleNote = g('aiFieldWholesaleNote');
    d.pickupNote = g('aiFieldPickupNote');
    d.disclaimer = g('aiFieldDisclaimer');
    d.seoTitle = g('aiFieldSeoTitle');
    d.seoDescription = g('aiFieldSeoDesc');
    d.badge = g('aiFieldBadge');
    d.sku = g('aiFieldSku');
    d.brand = g('aiFieldBrand');
    d.model = g('aiFieldModel');
    d.ebayKeywords = parseTags(g('aiFieldEbayKw'));
    state.draft = d;
    return d;
  }

  function renderPanel() {
    var panel = document.getElementById('aiAdminPanel');
    if (!panel) return;
    var settingsPane = document.getElementById('aiSettingsPane');
    if (settingsPane && state.uiTab === 'settings') {
      settingsPane.innerHTML = renderSettingsPanel();
      bindSettingsHandlers();
      return;
    }
    var draftHtml = state.draft ? renderDraftForm() : '<p style="color:#64748b;font-size:13px">Говорите по-русски или сфотографируйте товар — AI создаст UK listing на английском.</p>';
    var stockHtml = '';
    if (state.stockAction) {
      stockHtml = '<div class="ai-stock-preview" style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px;margin-bottom:12px">' +
        '<b style="color:#38bdf8">Stock command</b><p style="color:#cbd5e1;font-size:13px;margin:8px 0">' + escapeHtml(state.stockAction.summary || '') + '</p>' +
        '<pre style="font-size:11px;color:#94a3b8;white-space:pre-wrap;margin:0">' + escapeHtml(JSON.stringify(state.stockAction, null, 2)) + '</pre></div>';
    }
    document.getElementById('aiAdminDraftArea').innerHTML = stockHtml + draftHtml;
    bindDraftHandlers();
  }

  function bindDraftHandlers() {
    var applyBtn = document.getElementById('aiApplyAnswers');
    if (applyBtn) {
      applyBtn.onclick = function() {
        var extras = [];
        document.querySelectorAll('.ai-q-answer').forEach(function(input) {
          if (input.value.trim()) {
            extras.push((input.getAttribute('data-qfield') || 'note') + ': ' + input.value.trim());
          }
        });
        var base = document.getElementById('aiAdminInput').value.trim();
        document.getElementById('aiAdminInput').value = base + '\n' + extras.join('\n');
        runParse();
      };
    }
  }

  function setStatus(text, type) {
    var el = document.getElementById('aiAdminStatus');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = type === 'error' ? '#f87171' : type === 'success' ? '#4ade80' : '#94a3b8';
  }

  function updateConnectionBadge() {
    var badge = document.getElementById('aiConnectionBadge');
    if (!badge) return;
    if (state.aiConfigured === true) {
      badge.textContent = 'ChatGPT подключён · ' + (state.aiModel || 'gpt-4o-mini');
      badge.style.background = 'rgba(34,197,94,0.2)';
      badge.style.color = '#4ade80';
      badge.style.borderColor = 'rgba(34,197,94,0.45)';
    } else if (state.aiConfigured === false) {
      badge.textContent = 'Нет API ключа — см. docs/CHATGPT_SETUP.md';
      badge.style.background = 'rgba(248,113,113,0.15)';
      badge.style.color = '#f87171';
      badge.style.borderColor = 'rgba(248,113,113,0.4)';
    } else {
      badge.textContent = 'Проверка подключения…';
      badge.style.background = 'rgba(148,163,184,0.15)';
      badge.style.color = '#94a3b8';
      badge.style.borderColor = 'rgba(148,163,184,0.35)';
    }
  }

  async function refreshAiConnection() {
    if (!isAdminReady()) return;
    state.aiConfigured = null;
    updateConnectionBadge();
    try {
      var res = await apiRequest('status', {});
      state.aiConfigured = !!res.configured;
      state.aiModel = res.model || '';
      updateConnectionBadge();
      if (!res.configured) {
        setStatus('Добавьте OPENAI_API_KEY в Vercel (инструкция: docs/CHATGPT_SETUP.md)', 'error');
      }
    } catch (e) {
      state.aiConfigured = false;
      updateConnectionBadge();
      setStatus('Не удалось проверить ChatGPT: ' + e.message, 'error');
    }
  }

  async function runParse(opts) {
    opts = opts || {};
    if (!aiSettings().isEnabled()) {
      notify('AI выключен в Settings', 'info');
      return;
    }
    if (state.parseInFlight) return;
    var text = document.getElementById('aiAdminInput').value.trim();
    if (!text) {
      notify('Скажите или введите описание товара', 'error');
      return;
    }
    state.parseInFlight = true;
    setStatus('Перевод RU→EN, исправление ошибок, подготовка текста…', 'info');
    state.mode = 'listing';
    state.stockAction = null;
    try {
      var ctx = {};
      if (state.targetProductId) {
        var p = typeof products !== 'undefined' && products.find(function(x) { return sameId(x.id, state.targetProductId); });
        if (p) ctx.existingProduct = { id: p.id, name: p.name, stock: p.stock, price: p.price };
      }
      var voiceLangEl = document.getElementById('aiVoiceLang');
      var res = await apiRequest('parse_listing', {
        text: text,
        voiceLang: voiceLangEl ? voiceLangEl.value : '',
        context: Object.assign({ mode: state.targetProductId ? 'edit' : 'new', imageCount: (global.uploadingFiles && global.uploadingFiles.product) ? global.uploadingFiles.product.length : 0 }, ctx)
      });
      state.draft = res.draft;
      if (state.draft && state.draft.aiWarning) {
        setStatus(state.draft.aiWarning, 'error');
        notify('AI: ' + state.draft.aiWarning, 'error');
      }
      state.history.push({ at: new Date().toISOString(), type: 'parse', input: text });
      renderPanel();
      if (state.draft && state.draft.assistantReply) speakReply(state.draft.assistantReply);
      var shouldApply = (opts.autoApply || state.autoApply) && aiSettings().canAutoFill();
      if (shouldApply && state.draft && state.draft.name && state.draft.price > 0) {
        var applied = state.targetProductId ? applyDraftToEditModal() : applyDraftToAddModal(state.targetModalId);
        if (applied) setStatus('Готовый английский текст вставлен в форму — проверьте и сохраните', 'success');
        else setStatus('Черновик готов — нажмите «Вставить в форму»', 'success');
      } else if (state.draft && state.draft.name) {
        setStatus('Черновик на английском готов — проверьте и «Вставить в форму»', 'success');
      } else {
        setStatus('Нужны уточнения — ответьте на вопросы ниже', 'info');
      }
    } catch (e) {
      setStatus(e.message, 'error');
      notify('AI: ' + e.message, 'error');
    } finally {
      state.parseInFlight = false;
    }
  }

  async function runStockCommand() {
    var text = document.getElementById('aiAdminInput').value.trim();
    if (!text) return;
    setStatus('Parsing stock command…', 'info');
    try {
      var res = await apiRequest('stock_command', { text: text });
      state.stockAction = res.stockAction;
      state.mode = 'stock';
      renderPanel();
      setStatus('Stock command ready — confirm to apply', 'success');
    } catch (e) {
      setStatus(e.message, 'error');
    }
  }

  async function analyzeUploadedImage() {
    var files = global.uploadingFiles && global.uploadingFiles.product;
    if (!files || !files.length) {
      notify('Сначала загрузите фото в Add Product или используйте камеру', 'info');
      return;
    }
    try {
      var frame = await global.AYLEN_AI_MEDIA.captureFromFileInput(files[0]);
      await scanProductImage({ imageBase64: frame.base64, imageMimeType: frame.mimeType });
    } catch (e) {
      setStatus(e.message, 'error');
    }
  }

  function buildFullDescription(d) {
    var parts = [d.desc];
    if (d.brand || d.model) {
      parts.push('\n\n' + [d.brand, d.model].filter(Boolean).join(' — '));
    }
    if (d.conditionDesc) parts.push('\n\nCondition:\n' + d.conditionDesc);
    if (d.pickupNote) parts.push('\n\nPickup / delivery:\n' + d.pickupNote);
    if (d.wholesaleNote) parts.push('\n\nWholesale:\n' + d.wholesaleNote);
    if (d.disclaimer) parts.push('\n\n' + d.disclaimer);
    if (d.ebayKeywords && d.ebayKeywords.length) {
      parts.push('\n\neBay keywords: ' + d.ebayKeywords.join(', '));
    }
    return parts.filter(Boolean).join('');
  }

  function draftToProductPayload(d, imageUrls) {
    var fullDesc = buildFullDescription(d);
    return {
      name: d.name,
      title: d.name,
      shortTitle: d.shortTitle,
      desc: fullDesc,
      description: fullDesc,
      category: d.category,
      categoryLabel: d.categoryLabel,
      price: d.price,
      retail: d.price,
      retailPrice: d.price,
      wholesale: d.wholesalePrice || d.price,
      wholesalePrice: d.wholesalePrice || d.price,
      stock: d.stock,
      stockStatus: d.stockStatus,
      images: imageUrls || [],
      photos: imageUrls || [],
      badge: d.badge || '',
      active: d.stockStatus !== 'sold_out',
      status: d.stockStatus === 'sold_out' ? 'hidden' : 'active',
      discount: 0,
      salePrice: d.price,
      tags: d.tags,
      conditionDesc: d.conditionDesc,
      wholesaleNote: d.wholesaleNote,
      pickupNote: d.pickupNote,
      disclaimer: d.disclaimer,
      seoTitle: d.seoTitle,
      seoDescription: d.seoDescription,
      imageAltTexts: d.imageAltTexts || [],
      aiDraft: true,
      aiUpdatedAt: new Date().toISOString()
    };
  }

  async function logAudit(entry) {
    if (global.FBDB && global.FBDB.saveAiAuditLog) {
      try {
        await global.FBDB.saveAiAuditLog(entry);
      } catch (e) {
        console.warn('Audit log failed', e.message);
      }
    }
  }

  function applyDraftToAddModal(modalId) {
    var d = state.draft ? Object.assign({}, state.draft) : collectDraftFromForm();
    if (!d.name) {
      notify('Нет названия на английском — сначала «Создать текст»', 'error');
      return false;
    }
    if (!d.price || d.price <= 0) {
      notify('Укажите цену в GBP в описании или в черновике', 'error');
      return false;
    }
    var fullDesc = buildFullDescription(d);
    var ok = false;
    if (setModalField('prodName', d.name)) ok = true;
    if (setModalField('prodDesc', fullDesc)) ok = true;
    if (setModalField('prodRetailPrice', d.price)) ok = true;
    if (setModalField('prodWholesalePrice', d.wholesalePrice || d.price)) ok = true;
    if (setModalField('prodCategory', d.category)) ok = true;
    if (setModalField('prodStock', d.stock)) ok = true;
    if (!ok) {
      notify('Откройте форму «Add Product» и попробуйте снова', 'info');
      return false;
    }
    notify('English listing inserted — check photos and Save', 'success');
    return true;
  }

  function applyDraftToEditModal() {
    var d = state.draft ? Object.assign({}, state.draft) : collectDraftFromForm();
    var fullDesc = buildFullDescription(d);
    var ok = false;
    if (setModalField('eprodName', d.name)) ok = true;
    if (setModalField('eprodDesc', fullDesc)) ok = true;
    if (setModalField('eprodCategory', d.category)) ok = true;
    if (setModalField('eprodRetailPrice', d.price)) ok = true;
    if (setModalField('eprodWholesalePrice', d.wholesalePrice || d.price)) ok = true;
    if (setModalField('eprodStock', d.stock)) ok = true;
    if (setModalField('eprodBadge', d.badge)) ok = true;
    if (d.sku && setModalField('eprodSKU', d.sku)) ok = true;
    if (ok) notify('English text inserted — click Save changes', 'success');
    else notify('Open product edit form first', 'info');
    return ok;
  }

  async function publishNewProduct() {
    if (!confirm('Publish this product to the live site?')) return;
    var d = collectDraftFromForm();
    if (!d.name || !d.price || d.price <= 0) {
      notify('Title and valid price required', 'error');
      return;
    }
    notify('Publishing product…', 'info');
    var imageUrls = [];
    if (global.uploadingFiles && global.uploadingFiles.product && global.uploadingFiles.product.length) {
      for (var i = 0; i < global.uploadingFiles.product.length; i++) {
        var result = await uploadImageToCloudinary(global.uploadingFiles.product[i]);
        if (result.success) imageUrls.push(result.url);
        else throw new Error(result.error);
      }
    }
    var payload = draftToProductPayload(d, imageUrls);
    payload.sku = d.sku || ('AYLE-' + String(Date.now()).slice(-5));
    payload.id = 'prod_' + Date.now();
    if (global.addProductFromAiDraft) {
      await global.addProductFromAiDraft(payload);
    } else if (global.FBDB) {
      products.push(Object.assign({ id: payload.id }, payload));
      await global.FBDB.saveProduct(payload);
    }
    await logAudit({ action: 'publish_product', productName: d.name, draft: d });
    global.uploadingFiles.product = [];
    notify('Product published', 'success');
    if (typeof renderProducts === 'function') renderProducts();
    state.draft = null;
    renderPanel();
  }

  async function applyStockAction() {
    var action = state.stockAction;
    if (!action) return;
    if (!confirm('Apply this stock update to the live site?')) return;
    var match = null;
    if (action.productId && typeof products !== 'undefined') {
      match = products.find(function(p) { return sameId(p.id, action.productId); });
    }
    if (!match && action.productQuery && typeof products !== 'undefined') {
      var q = action.productQuery.toLowerCase();
      match = products.find(function(p) { return String(p.name || '').toLowerCase().indexOf(q) !== -1; });
    }
    if (!match) {
      notify('Could not find product. Open edit manually or be more specific.', 'error');
      return;
    }
    state.undoStack.push({ id: match.id, stock: match.stock, price: match.price, stockStatus: match.stockStatus, active: match.active });
    if (action.stock !== null && action.stock !== undefined) match.stock = action.stock;
    if (action.price) {
      match.price = action.price;
      match.retail = action.price;
      match.salePrice = action.price;
    }
    if (action.stockStatus === 'sold_out') {
      match.stock = 0;
      match.active = false;
      match.status = 'hidden';
    }
    if (action.note) match.adminNote = action.note;
    await global.FBDB.updateProduct(match.id, match);
    await logAudit({ action: 'stock_update', productId: match.id, stockAction: action });
    notify('Stock updated: ' + match.name, 'success');
    if (typeof renderProducts === 'function') renderProducts();
    state.stockAction = null;
    renderPanel();
  }

  function undoLastStock() {
    var prev = state.undoStack.pop();
    if (!prev) {
      notify('Nothing to undo', 'info');
      return;
    }
    var p = products.find(function(x) { return sameId(x.id, prev.id); });
    if (!p) return;
    Object.assign(p, prev);
    global.FBDB.updateProduct(p.id, p).then(function() {
      notify('Undone last stock change', 'success');
      if (typeof renderProducts === 'function') renderProducts();
    });
  }

  function afterVoiceCaptured(spoken) {
    var s = aiSettings().load();
    if (spoken.length >= 3 && s.autoParseAfterVoice) {
      runParse({ autoApply: state.autoApply && aiSettings().canAutoFill() });
    } else if (spoken.length >= 3) {
      setStatus('Текст записан — нажмите «Создать текст (RU→EN)»', 'success');
    } else {
      setStatus('Слишком коротко — повторите', 'error');
    }
  }

  function toggleBrowserListen() {
    var SpeechRecognition = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify('Голос не поддерживается — включите Whisper + API ключ', 'error');
      return;
    }
    if (state.listening && state.recognition) {
      state.recognition.stop();
      return;
    }
    var input = document.getElementById('aiAdminInput');
    state.voiceBaseText = input ? input.value.trim() : '';
    var rec = new SpeechRecognition();
    rec.lang = document.getElementById('aiVoiceLang').value || 'ru-RU';
    rec.interimResults = true;
    rec.continuous = false;
    state.recognition = rec;
    rec.onresult = function(event) {
      if (!input) return;
      var finalPart = '';
      var interimPart = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalPart += chunk;
        else interimPart += chunk;
      }
      input.value = (state.voiceBaseText + ' ' + (finalPart || interimPart)).trim();
      if (finalPart) state.voiceBaseText = input.value;
    };
    rec.onend = function() {
      state.listening = false;
      var btn = document.getElementById('aiMicBtn');
      if (btn) btn.classList.remove('listening');
      afterVoiceCaptured(input ? input.value.trim() : '');
    };
    rec.onerror = function(ev) {
      state.listening = false;
      var btn = document.getElementById('aiMicBtn');
      if (btn) btn.classList.remove('listening');
      setStatus('Ошибка микрофона', 'error');
      if (ev && ev.error === 'not-allowed') notify('Разрешите микрофон в Safari/Chrome', 'error');
    };
    state.listening = true;
    document.getElementById('aiMicBtn').classList.add('listening');
    setStatus('Говорите… (браузерное распознавание)', 'info');
    rec.start();
  }

  async function toggleListen() {
    if (!aiSettings().canUseVoice()) {
      notify('Голос выключен в настройках AI', 'info');
      return;
    }
    if (state.listening) {
      if (state.recognition) state.recognition.stop();
      if (state.mediaRecorderStop) {
        try { await state.mediaRecorderStop(); } catch (e) { /* ignore */ }
      }
      return;
    }
    var input = document.getElementById('aiAdminInput');
    var useWhisper = aiSettings().useWhisper() && global.AYLEN_AI_MEDIA && state.aiConfigured;
    if (useWhisper) {
      try {
        state.listening = true;
        document.getElementById('aiMicBtn').classList.add('listening');
        setStatus('Запись… говорите по-русски (Whisper)', 'info');
        await global.AYLEN_AI_MEDIA.startWhisperRecording();
        state.voiceBaseText = input ? input.value.trim() : '';
        state.mediaRecorderStop = async function() {
          var audio = await global.AYLEN_AI_MEDIA.stopWhisperRecording();
          state.listening = false;
          state.mediaRecorderStop = null;
          document.getElementById('aiMicBtn').classList.remove('listening');
          setStatus('Распознаю речь (Whisper)…', 'info');
          var tr = await apiRequest('transcribe', {
            audioBase64: audio.base64,
            mimeType: audio.mimeType,
            language: global.AYLEN_AI_MEDIA.getWhisperLanguage()
          });
          if (input) input.value = (state.voiceBaseText + ' ' + (tr.text || '')).trim();
          afterVoiceCaptured(tr.text || '');
        };
      } catch (e) {
        state.listening = false;
        document.getElementById('aiMicBtn').classList.remove('listening');
        if (aiSettings().load().browserVoiceFallback) toggleBrowserListen();
        else {
          setStatus(e.message, 'error');
          notify(e.message, 'error');
        }
      }
      return;
    }
    toggleBrowserListen();
  }

  async function scanProductImage(payload) {
    setStatus('Сканирую фото (GPT-4o vision)…', 'info');
    var res = await apiRequest('analyze_image', Object.assign({
      text: document.getElementById('aiAdminInput').value.trim()
    }, payload));
    state.draft = res.draft;
    state.uiTab = 'listing';
    renderPanel();
    if (state.draft && state.draft.assistantReply) speakReply(state.draft.assistantReply);
    if (aiSettings().canAutoFill() && state.autoApply && state.draft && state.draft.name) {
      state.targetProductId ? applyDraftToEditModal() : applyDraftToAddModal(state.targetModalId);
    }
    setStatus('Скан готов — проверьте черновик', 'success');
  }

  async function openCameraScan() {
    if (!aiSettings().canUseCamera()) {
      notify('Камера выключена в настройках AI', 'info');
      return;
    }
    if (!state.aiConfigured) {
      notify('Нужен OPENAI_API_KEY на Vercel', 'error');
      return;
    }
    try {
      if (global.AYLEN_AI_MEDIA && global.AYLEN_AI_MEDIA.openCameraPreview) {
        var frame = await global.AYLEN_AI_MEDIA.openCameraPreview();
        await scanProductImage({ imageBase64: frame.base64, imageMimeType: frame.mimeType });
      }
    } catch (e) {
      if (e.message !== 'cancelled') {
        var fileInput = document.getElementById('aiCameraFile');
        if (fileInput) fileInput.click();
        else setStatus(e.message, 'error');
      }
    }
  }

  function ensurePanel() {
    if (document.getElementById('aiAdminPanel')) return;
    state.uiTab = 'listing';
    var html = '' +
      '<div id="aiAdminPanel" class="ai-admin-panel" aria-hidden="true">' +
      '<div class="ai-admin-header">' +
      '<div><h3 style="margin:0;color:#fff;font-size:16px"><i class="fas fa-robot"></i> AI Admin Assistant</h3>' +
      '<p style="margin:4px 0 0;color:#94a3b8;font-size:11px">RU→EN · Whisper · Camera · eBay UK</p>' +
      '<span id="aiConnectionBadge" style="display:inline-block;margin-top:8px;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:800;border:1px solid #334155">…</span></div>' +
      '<button type="button" id="aiAdminClose" style="background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer">&times;</button>' +
      '</div>' +
      '<div class="ai-admin-tabs">' +
      '<button type="button" class="ai-tab active" data-aitab="listing">Listing</button>' +
      '<button type="button" class="ai-tab" data-aitab="stock">Stock</button>' +
      '<button type="button" class="ai-tab" data-aitab="settings">Settings</button>' +
      '</div>' +
      '<div class="ai-admin-body">' +
      '<div id="aiListingPane">' +
      '<select id="aiVoiceLang" style="' + fieldStyle() + '">' +
      '<option value="ru-RU">Голос: русский</option><option value="uk-UA">Голос: украинский</option><option value="en-GB">Voice: English (UK)</option>' +
      '</select>' +
      '<div class="ai-input-row">' +
      '<button type="button" id="aiMicBtn" title="Voice"><i class="fas fa-microphone"></i></button>' +
      '<textarea id="aiAdminInput" rows="3" placeholder="создай лот кабелей 10 кг, цена 39.99, Amazon returns disclaimer"></textarea>' +
      '</div>' +
      '<div class="ai-tool-row">' +
      '<button type="button" id="aiParseBtn" class="ai-tool-btn" style="background:#7c3aed;color:#fff">RU→EN</button>' +
      '<button type="button" id="aiCameraBtn" class="ai-tool-btn" style="background:#0ea5e9;color:#fff"><i class="fas fa-camera"></i></button>' +
      '<button type="button" id="aiImageBtn" class="ai-tool-btn" style="background:#334155;color:#fff" title="Photo in form"><i class="fas fa-image"></i></button>' +
      '<button type="button" id="aiTestBtn" class="ai-tool-btn" style="background:#1e293b;color:#94a3b8;border:1px solid #475569">Test</button>' +
      '<button type="button" id="aiStockBtn" class="ai-tool-btn" style="background:#059669;color:#fff;display:none">Stock</button>' +
      '</div>' +
      '<input type="file" id="aiCameraFile" accept="image/*" capture="environment" style="display:none">' +
      '<p id="aiAdminStatus" style="font-size:12px;min-height:18px;margin:0 0 8px"></p>' +
      '<div id="aiAdminDraftArea" class="ai-draft-area"></div>' +
      '</div>' +
      '<div id="aiSettingsPane" style="display:none"></div>' +
      '</div>' +
      '<div class="ai-admin-footer">' +
      '<button type="button" id="aiApplyAddBtn" style="padding:10px;background:#334155;color:#fff;border:none;border-radius:8px;cursor:pointer">Вставить в Add</button>' +
      '<button type="button" id="aiApplyEditBtn" style="padding:10px;background:#334155;color:#fff;border:none;border-radius:8px;cursor:pointer">Вставить в Edit</button>' +
      '<button type="button" id="aiPublishBtn" style="padding:10px 14px;background:#e94560;color:#fff;border:none;border-radius:8px;font-weight:800;cursor:pointer">Publish</button>' +
      '<button type="button" id="aiUndoBtn" style="padding:10px;background:#475569;color:#fff;border:none;border-radius:8px;cursor:pointer">Undo</button>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('aiAdminClose').onclick = closeAiAdminAssistant;
    document.getElementById('aiMicBtn').onclick = toggleListen;
    document.getElementById('aiCameraBtn').onclick = openCameraScan;
    var camFile = document.getElementById('aiCameraFile');
    if (camFile) {
      camFile.onchange = async function() {
        if (!camFile.files || !camFile.files[0]) return;
        try {
          var frame = await global.AYLEN_AI_MEDIA.captureFromFileInput(camFile.files[0]);
          await scanProductImage({ imageBase64: frame.base64, imageMimeType: frame.mimeType });
        } catch (e) {
          setStatus(e.message, 'error');
        }
        camFile.value = '';
      };
    }
    document.getElementById('aiParseBtn').onclick = function() { runParse(); };
    var testBtn = document.getElementById('aiTestBtn');
    if (testBtn) {
      testBtn.onclick = async function() {
        setStatus('Проверка ключа OpenAI…', 'info');
        try {
          var t = await apiRequest('test', {});
          if (t.success && t.configured) {
            state.aiConfigured = true;
            state.aiModel = t.model || state.aiModel;
            updateConnectionBadge();
            setStatus('ChatGPT отвечает — можно создавать объявления', 'success');
            notify('OpenAI API работает', 'success');
          } else {
            setStatus('Ключ не настроен', 'error');
          }
        } catch (e) {
          setStatus(e.message, 'error');
          notify('OpenAI: ' + e.message, 'error');
        }
      };
    }
    document.getElementById('aiImageBtn').onclick = analyzeUploadedImage;
    document.getElementById('aiStockBtn').onclick = runStockCommand;
    document.getElementById('aiApplyAddBtn').onclick = function() {
      collectDraftFromForm();
      var modal = document.querySelector('[id^="productModal_"]');
      applyDraftToAddModal(modal ? modal.id : null);
    };
    document.getElementById('aiApplyEditBtn').onclick = applyDraftToEditModal;
    document.getElementById('aiPublishBtn').onclick = function() {
      if (state.mode === 'stock' && state.stockAction) applyStockAction();
      else publishNewProduct();
    };
    document.getElementById('aiUndoBtn').onclick = undoLastStock;
    document.querySelectorAll('.ai-tab').forEach(function(tab) {
      tab.onclick = function() {
        document.querySelectorAll('.ai-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var mode = tab.getAttribute('data-aitab');
        state.uiTab = mode;
        state.mode = mode === 'stock' ? 'stock' : 'listing';
        var listingPane = document.getElementById('aiListingPane');
        var settingsPane = document.getElementById('aiSettingsPane');
        var stockBtn = document.getElementById('aiStockBtn');
        if (mode === 'settings') {
          if (listingPane) listingPane.style.display = 'none';
          if (settingsPane) { settingsPane.style.display = 'block'; settingsPane.innerHTML = renderSettingsPanel(); bindSettingsHandlers(); }
          if (stockBtn) stockBtn.style.display = 'none';
        } else {
          if (listingPane) listingPane.style.display = 'block';
          if (settingsPane) settingsPane.style.display = 'none';
          if (stockBtn) stockBtn.style.display = mode === 'stock' ? 'inline-block' : 'none';
          renderPanel();
        }
        syncFeatureButtons();
      };
    });
    syncFeatureButtons();
  }

  function openAiAdminAssistant(opts) {
    if (!isAdminReady()) {
      notify('Сначала войдите в админку', 'error');
      if (typeof showAdminLoginModal === 'function') showAdminLoginModal();
      return;
    }
    if (!aiSettings().isEnabled()) {
      notify('AI выключен — вкладка Settings → включите AI Assistant', 'info');
      ensurePanel();
      var panel = document.getElementById('aiAdminPanel');
      panel.classList.add('open');
      state.uiTab = 'settings';
      document.querySelectorAll('.ai-tab').forEach(function(t) {
        t.classList.toggle('active', t.getAttribute('data-aitab') === 'settings');
      });
      var listingPane = document.getElementById('aiListingPane');
      var settingsPane = document.getElementById('aiSettingsPane');
      if (listingPane) listingPane.style.display = 'none';
      if (settingsPane) { settingsPane.style.display = 'block'; settingsPane.innerHTML = renderSettingsPanel(); bindSettingsHandlers(); }
      return;
    }
    opts = opts || {};
    state.targetProductId = opts.productId || null;
    state.autoApply = opts.autoApply === true && aiSettings().canAutoFill();
    state.targetModalId = null;
    if (opts.fromProductForm && global.AYLEN_MODAL && global.AYLEN_MODAL.getCurrentId) {
      state.targetModalId = global.AYLEN_MODAL.getCurrentId();
    }
    ensurePanel();
    var panel = document.getElementById('aiAdminPanel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    state.open = true;
    if (opts.prefill) document.getElementById('aiAdminInput').value = opts.prefill;
    renderPanel();
    refreshAiConnection();
    setStatus(state.autoApply
      ? 'Нажмите микрофон или «Создать текст» — поля формы заполнятся на английском'
      : 'RU→EN: микрофон или текст, затем «Создать текст»', 'info');
  }

  function closeAiAdminAssistant() {
    var panel = document.getElementById('aiAdminPanel');
    if (panel) {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }
    state.open = false;
    if (state.recognition) try { state.recognition.stop(); } catch (e) {}
  }

  global.openAiAdminAssistant = openAiAdminAssistant;
  global.closeAiAdminAssistant = closeAiAdminAssistant;
  global.AYLEN_AI = {
    open: openAiAdminAssistant,
    close: closeAiAdminAssistant,
    applyDraftToAddModal: applyDraftToAddModal,
    applyDraftToEditModal: applyDraftToEditModal
  };
})(typeof window !== 'undefined' ? window : this);
