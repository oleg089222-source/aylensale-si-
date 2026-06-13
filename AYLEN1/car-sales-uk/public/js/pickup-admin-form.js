/**
 * Pickup / Car Boot — fast CMS admin form (autocomplete, drafts, stable save).
 */
(function(global) {
  var DRAFT_KEY_ADD = 'aylen_pickup_draft_add';
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  var AUTOSAVE_MS = 600;
  var activeModalId = null;
  var autosaveTimer = null;
  var placesService = null;
  var autocompleteSession = null;

  function esc(s) {
    if (typeof escapeHtml === 'function') return escapeHtml(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type || 'info');
  }

  function sameId(a, b) {
    return String(a || '') === String(b || '');
  }

  function field(form, name) {
    return form ? form.querySelector('[data-field="' + name + '"]') : null;
  }

  function buildGoingToggleHtml(selected) {
    var s = 'not_confirmed';
    if (global.AYLEN_PICKUP && global.AYLEN_PICKUP.normalizePickupStatus) {
      s = global.AYLEN_PICKUP.normalizePickupStatus({ status: selected });
    }
    return (
      '<div class="pickup-going-switch" data-going-switch role="group" aria-label="Going status">' +
        '<button type="button" class="pickup-going-switch__btn' + (s === 'going' ? ' is-active' : '') + '" data-going-value="going">Going ON</button>' +
        '<button type="button" class="pickup-going-switch__btn' + (s === 'not_confirmed' ? ' is-active' : '') + '" data-going-value="not_confirmed">Going OFF</button>' +
      '</div>' +
      '<input type="hidden" data-field="status" value="' + esc(s) + '">' +
      '<p class="pickup-hint">Going ON = green card + WE ARE GOING badge. Weather risk never turns this off — admin decides.</p>' +
      '<label class="pickup-label">Or mark as possible</label>' +
      '<button type="button" class="pickup-btn pickup-btn-ghost pickup-btn-sm" data-mark-possible>Mark POSSIBLE</button>'
    );
  }

  function buildStatusOptions(selected) {
    var s = 'not_confirmed';
    if (global.AYLEN_PICKUP && global.AYLEN_PICKUP.normalizePickupStatus) {
      s = global.AYLEN_PICKUP.normalizePickupStatus({ status: selected });
    }
    var opts = [
      ['going', 'We are going this weekend'],
      ['possible', 'Possible this weekend'],
      ['not_confirmed', 'Not confirmed yet']
    ];
    return opts.map(function(pair) {
      return '<option value="' + pair[0] + '"' + (s === pair[0] ? ' selected' : '') + '>' + pair[1] + '</option>';
    }).join('');
  }

  function dayOptionsHtml(dayValue) {
    var d = String(dayValue || '').toLowerCase();
    var both = d.indexOf('sat') !== -1 && d.indexOf('sun') !== -1;
    var sat = both || (d.indexOf('sat') !== -1 && d.indexOf('sun') === -1);
    var sun = both || (d.indexOf('sun') !== -1 && d.indexOf('sat') === -1);
    if (!d) sat = true;
    return [
      ['Saturday', sat && !both],
      ['Sunday', sun && !both],
      ['Saturday and Sunday', both]
    ].map(function(row) {
      return '<option value="' + row[0] + '"' + (row[1] ? ' selected' : '') + '>' + row[0] + '</option>';
    }).join('');
  }

  function readForm(form) {
    var name = (field(form, 'name') || {}).value || '';
    var address = (field(form, 'address') || {}).value || '';
    var postcode = (field(form, 'postcode') || {}).value || '';
    var venueSearch = (field(form, 'venueSearch') || {}).value || '';
    if (!postcode && !address && venueSearch.trim()) {
      var v = venueSearch.trim();
      var maybePc = v.toUpperCase().replace(/\s+/g, ' ');
      if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(maybePc.replace(/\s/g, '')) ||
          /^[A-Z]{1,2}\d/.test(maybePc)) {
        postcode = maybePc;
      } else {
        address = v;
      }
    }
    var city = (field(form, 'city') || {}).value || '';
    var weatherPostcode = (field(form, 'weatherPostcode') || {}).value || '';
    var day = (field(form, 'day') || {}).value || '';
    var openingTime = (field(form, 'openingTime') || {}).value || '';
    var mapLink = (field(form, 'mapLink') || {}).value || '';
    var note = (field(form, 'note') || {}).value || '';
    var description = (field(form, 'description') || {}).value || '';
    var sortOrder = parseInt((field(form, 'sortOrder') || {}).value, 10) || 0;
    var status = (field(form, 'status') || {}).value || 'not_confirmed';
    var showEl = field(form, 'showOnWebsite');
    var showOnWebsite = showEl ? showEl.checked : true;
    var pinned = field(form, 'pinned') && field(form, 'pinned').checked;

    postcode = postcode.trim().toUpperCase();
    weatherPostcode = (weatherPostcode.trim() || postcode).toUpperCase();
    if (global.AYLEN_PICKUP && global.AYLEN_PICKUP.normalizeUKPostcode) {
      postcode = global.AYLEN_PICKUP.normalizeUKPostcode(postcode) || postcode;
      if (weatherPostcode) {
        weatherPostcode = global.AYLEN_PICKUP.normalizeUKPostcode(weatherPostcode) || weatherPostcode;
      }
    }

    var data = {
      name: name.trim(),
      address: address.trim(),
      postcode: postcode,
      city: city.trim(),
      weatherPostcode: weatherPostcode,
      day: day.trim(),
      days: day.trim(),
      openingTime: openingTime.trim(),
      time: openingTime.trim(),
      mapLink: mapLink.trim(),
      note: note.trim(),
      description: description.trim(),
      desc: description.trim(),
      sortOrder: sortOrder,
      status: status,
      showOnWebsite: showOnWebsite,
      pinned: pinned
    };

    if (global.AYLEN_PICKUP && global.AYLEN_PICKUP.syncPickupStatusFields) {
      global.AYLEN_PICKUP.syncPickupStatusFields(data);
    } else {
      data.active = status === 'going';
      data.goingThisWeekend = status === 'going';
    }

    if (!data.mapLink) {
      var q = data.postcode || data.address;
      if (q) {
        data.mapLink = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
      }
    }
    return data;
  }

  function writeForm(form, data) {
    if (!form || !data) return;
    if (field(form, 'name')) field(form, 'name').value = data.name || '';
    if (field(form, 'address')) field(form, 'address').value = data.address || '';
    if (field(form, 'postcode')) field(form, 'postcode').value = data.postcode || '';
    if (field(form, 'city')) field(form, 'city').value = data.city || '';
    if (field(form, 'weatherPostcode')) {
      var wp = data.weatherPostcode || '';
      var vp = data.postcode || '';
      field(form, 'weatherPostcode').value = wp && wp !== vp ? wp : '';
    }
    if (field(form, 'day')) field(form, 'day').value = data.day || data.days || 'Saturday';
    if (field(form, 'openingTime')) field(form, 'openingTime').value = data.openingTime || data.time || '';
    if (field(form, 'mapLink')) field(form, 'mapLink').value = data.mapLink || '';
    if (field(form, 'note')) field(form, 'note').value = data.note || '';
    if (field(form, 'description')) field(form, 'description').value = data.description || data.desc || '';
    if (field(form, 'sortOrder')) field(form, 'sortOrder').value = String(data.sortOrder || 0);
    if (field(form, 'status')) {
      field(form, 'status').value = data.status || 'not_confirmed';
      syncGoingSwitchUi(form, data.status || 'not_confirmed');
    }
    if (field(form, 'showOnWebsite')) field(form, 'showOnWebsite').checked = data.showOnWebsite !== false;
    if (field(form, 'pinned')) field(form, 'pinned').checked = !!data.pinned;
    if (field(form, 'venueSearch')) {
      field(form, 'venueSearch').value = data.venueSearch || data.postcode || data.address || '';
    }
  }

  function draftKey(mode, locationId) {
    if (mode === 'edit' && locationId) return 'aylen_pickup_draft_edit_' + locationId;
    return DRAFT_KEY_ADD;
  }

  function saveDraft(form) {
    try {
      var mode = form.getAttribute('data-mode') || 'add';
      var id = form.getAttribute('data-location-id') || '';
      var payload = readForm(form);
      payload.venueSearch = (field(form, 'venueSearch') || {}).value || '';
      payload._savedAt = Date.now();
      localStorage.setItem(draftKey(mode, id), JSON.stringify(payload));
      var badge = form.closest('.pickup-admin-modal');
      if (badge) {
        var el = badge.querySelector('.pickup-draft-badge');
        if (el) el.textContent = 'Draft saved locally';
      }
    } catch (e) { /* quota */ }
  }

  function loadDraft(form) {
    try {
      var mode = form.getAttribute('data-mode') || 'add';
      var id = form.getAttribute('data-location-id') || '';
      var raw = localStorage.getItem(draftKey(mode, id));
      if (!raw) return false;
      var data = JSON.parse(raw);
      writeForm(form, data);
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearDraft(form) {
    try {
      var mode = form.getAttribute('data-mode') || 'add';
      var id = form.getAttribute('data-location-id') || '';
      localStorage.removeItem(draftKey(mode, id));
    } catch (e) { /* ignore */ }
  }

  function syncGoingSwitchUi(form, status) {
    if (!form) return;
    var s = 'not_confirmed';
    if (global.AYLEN_PICKUP && global.AYLEN_PICKUP.normalizePickupStatus) {
      s = global.AYLEN_PICKUP.normalizePickupStatus({ status: status });
    }
    var hidden = field(form, 'status');
    if (hidden) hidden.value = s;
    form.querySelectorAll('[data-going-switch] [data-going-value]').forEach(function(btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-going-value') === s);
    });
  }

  function wireGoingSwitch(form) {
    if (!form) return;
    var switchEl = form.querySelector('[data-going-switch]');
    if (!switchEl) return;
    switchEl.querySelectorAll('[data-going-value]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        syncGoingSwitchUi(form, btn.getAttribute('data-going-value'));
        saveDraft(form);
      });
    });
    var possibleBtn = form.querySelector('[data-mark-possible]');
    if (possibleBtn) {
      possibleBtn.addEventListener('click', function() {
        syncGoingSwitchUi(form, 'possible');
        saveDraft(form);
      });
    }
  }

  function showAlert(form, message, type) {
    var el = form.querySelector('.pickup-form-alert');
    if (!el) return;
    el.textContent = message || '';
    el.className = 'pickup-form-alert pickup-form-alert--' + (type || 'error') + (message ? ' is-visible' : '');
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('.pickup-field--error').forEach(function(wrap) {
      wrap.classList.remove('pickup-field--error');
      var msg = wrap.querySelector('.pickup-field-msg');
      if (msg) msg.textContent = '';
    });
  }

  function setFieldError(form, fieldName, message) {
    var wrap = form.querySelector('[data-wrap="' + fieldName + '"]');
    if (!wrap) return;
    wrap.classList.add('pickup-field--error');
    var msg = wrap.querySelector('.pickup-field-msg');
    if (msg) msg.textContent = message;
  }

  function validateForm(form) {
    clearFieldErrors(form);
    var data = readForm(form);
    var errors = [];
    if (!data.name) {
      setFieldError(form, 'name', 'Market name is required');
      errors.push('Market name is required');
    }
    if (!data.postcode && !data.address) {
      setFieldError(form, 'venue', 'Enter a postcode or address');
      errors.push('Enter a postcode or address');
    }
    if (!data.day) {
      setFieldError(form, 'day', 'Select a day');
      errors.push('Select a day');
    }
    if (!data.openingTime) {
      setFieldError(form, 'openingTime', 'Opening time is required');
      errors.push('Opening time is required');
    }
    if (errors.length) {
      showAlert(form, errors[0], 'error');
      return null;
    }
    showAlert(form, '', 'error');
    return data;
  }

  function buildFormHtml(opts) {
    var mode = opts.mode || 'add';
    var loc = opts.location || {};
    var title = opts.title || (mode === 'edit' ? 'Edit Car Boot Location' : 'Add Car Boot Location');
    var photoUrl = loc.photoUrl || '';
    var optionalOpen = mode === 'edit' ? ' is-open' : '';

    return (
      '<div class="aylen-modal-panel pickup-admin-modal" id="' + esc(opts.modalId) + '">' +
        '<div class="pickup-modal-head">' +
          '<span class="close" onclick="AYLEN_MODAL.close()" aria-label="Close">&times;</span>' +
          '<h2 class="pickup-modal-title"><i class="fas fa-map-marker-alt"></i> ' + esc(title) + '</h2>' +
          '<div class="pickup-draft-badge"></div>' +
        '</div>' +
        '<div class="pickup-modal-body">' +
          '<form class="pickup-admin-form" data-mode="' + esc(mode) + '" data-location-id="' + esc(loc.id || '') + '" novalidate>' +
            '<div class="pickup-form-alert"></div>' +
            '<div class="pickup-form-grid">' +
              '<section class="pickup-form-section pickup-form-section--full">' +
                '<h3>Required</h3>' +
                '<div class="pickup-field" data-wrap="name">' +
                  '<label class="pickup-label">Market name <span class="req">*</span></label>' +
                  '<input class="pickup-input" data-field="name" type="text" placeholder="e.g. Dunton Car Boot Sale" value="' + esc(loc.name || '') + '">' +
                  '<div class="pickup-field-msg"></div>' +
                '</div>' +
                '<div class="pickup-field" data-wrap="venue">' +
                  '<label class="pickup-label">Postcode or address <span class="req">*</span></label>' +
                  '<div class="pickup-autocomplete">' +
                    '<input class="pickup-input" data-field="venueSearch" type="text" autocomplete="off" placeholder="Start typing: Dunton, CM12, Birmingham…">' +
                    '<ul class="pickup-suggestions is-hidden" data-suggestions></ul>' +
                  '</div>' +
                  '<p class="pickup-hint">UK address suggestions — fills postcode, city and maps link automatically.</p>' +
                  '<div class="pickup-field-msg"></div>' +
                '</div>' +
                '<div class="pickup-form-row">' +
                  '<div class="pickup-field" data-wrap="day">' +
                    '<label class="pickup-label">Working days <span class="req">*</span></label>' +
                    '<select class="pickup-select" data-field="day">' + dayOptionsHtml(loc.days || loc.day) + '</select>' +
                    '<div class="pickup-field-msg"></div>' +
                  '</div>' +
                  '<div class="pickup-field" data-wrap="openingTime">' +
                    '<label class="pickup-label">Opening time <span class="req">*</span></label>' +
                    '<input class="pickup-input" data-field="openingTime" type="text" placeholder="7:00–13:00" value="' + esc(loc.openingTime || loc.time || '') + '">' +
                    '<div class="pickup-field-msg"></div>' +
                  '</div>' +
                '</div>' +
                '<div class="pickup-field pickup-form-section--full" data-wrap="photo">' +
                  '<h3>Photo</h3>' +
                  '<div class="pickup-upload-zone" data-upload-zone>' +
                    '<input type="file" data-field="photoFile" accept="image/*">' +
                    '<div data-upload-label><i class="fas fa-cloud-upload-alt"></i> Drop car boot photo or click to upload (max 5 MB)</div>' +
                    '<div class="pickup-upload-progress"><span></span></div>' +
                    '<div class="pickup-upload-status" data-upload-status></div>' +
                    '<div class="pickup-upload-preview' + (photoUrl ? ' is-visible' : '') + '" data-upload-preview>' +
                      (photoUrl ? '<img src="' + esc(photoUrl) + '" alt="Location">' : '') +
                    '</div>' +
                  '</div>' +
                  '<input type="hidden" data-field="existingPhotoUrl" value="' + esc(photoUrl) + '">' +
                '</div>' +
              '</section>' +
              '<button type="button" class="pickup-optional-toggle" data-optional-toggle>+ More options (address, description, weather, going)</button>' +
              '<div class="pickup-optional-panel' + optionalOpen + '" data-optional-panel>' +
                '<section class="pickup-form-section">' +
                  '<h3>Address</h3>' +
                  '<label class="pickup-label">Street / venue address</label>' +
                  '<input class="pickup-input" data-field="address" type="text" value="' + esc(loc.address || '') + '">' +
                  '<label class="pickup-label">Postcode</label>' +
                  '<input class="pickup-input" data-field="postcode" type="text" value="' + esc(loc.postcode || '') + '">' +
                  '<label class="pickup-label">City</label>' +
                  '<input class="pickup-input" data-field="city" type="text" value="' + esc(loc.city || '') + '">' +
                  '<label class="pickup-label">Description</label>' +
                  '<textarea class="pickup-input pickup-textarea" data-field="description" rows="3" placeholder="What buyers should know about this car boot">' + esc(loc.description || loc.desc || '') + '</textarea>' +
                  '<label class="pickup-label">Google Maps link</label>' +
                  '<input class="pickup-input" data-field="mapLink" type="url" value="' + esc(loc.mapLink || '') + '">' +
                '</section>' +
                '<section class="pickup-form-section">' +
                  '<h3>Weekend &amp; display</h3>' +
                  '<label class="pickup-label">Weather postcode</label>' +
                  '<input class="pickup-input" data-field="weatherPostcode" type="text" placeholder="Leave blank = venue postcode" value="' + esc((loc.weatherPostcode && loc.weatherPostcode !== loc.postcode) ? loc.weatherPostcode : '') + '">' +
                  '<p class="pickup-hint">Forecast updates automatically from this postcode.</p>' +
                  '<label class="pickup-label">Going this weekend</label>' +
                  buildGoingToggleHtml(loc.status) +
                  '<label class="pickup-label">Customer note</label>' +
                  '<input class="pickup-input" data-field="note" type="text" value="' + esc(loc.note || '') + '">' +
                  '<label class="pickup-label">Sort order</label>' +
                  '<input class="pickup-input" data-field="sortOrder" type="number" step="1" value="' + esc(String(loc.sortOrder || 0)) + '">' +
                  '<div class="pickup-check-row">' +
                    '<label><input type="checkbox" data-field="showOnWebsite"' + (loc.showOnWebsite !== false ? ' checked' : '') + '> Show on website</label>' +
                    '<label><input type="checkbox" data-field="pinned"' + (loc.pinned ? ' checked' : '') + '> Pin in status group</label>' +
                  '</div>' +
                '</section>' +
              '</div>' +
            '</div>' +
          '</form>' +
        '</div>' +
        '<div class="pickup-form-sticky" data-sticky-actions>' +
          (mode === 'edit'
            ? '<button type="button" class="pickup-btn pickup-btn-ghost" data-action="quick">Quick edit</button>' +
              '<button type="button" class="pickup-btn pickup-btn-ghost" data-action="duplicate">Duplicate</button>'
            : '') +
          '<button type="button" class="pickup-btn pickup-btn-secondary" data-action="cancel">Cancel</button>' +
          (mode === 'add'
            ? '<button type="button" class="pickup-btn pickup-btn-secondary" data-action="save-another">Save &amp; add another</button>'
            : '') +
          '<button type="button" class="pickup-btn pickup-btn-primary" data-action="save">' +
            (mode === 'edit' ? 'Save changes' : 'Save location') +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  async function searchVenueSuggestions(query) {
    var q = String(query || '').trim();
    if (q.length < 2) return [];

    var results = [];
    var seen = {};

    function push(item) {
      var key = (item.label + '|' + (item.postcode || '') + '|' + (item.address || '')).toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      results.push(item);
    }

    if (global.AYLEN_PICKUP && global.AYLEN_PICKUP.searchVenueSuggestions) {
      var fromModule = await global.AYLEN_PICKUP.searchVenueSuggestions(q);
      (fromModule || []).forEach(push);
    }

    if (placesService && global.google && global.google.maps) {
      try {
        var preds = await new Promise(function(resolve) {
          placesService.getPlacePredictions(
            { input: q, componentRestrictions: { country: 'gb' }, types: ['establishment', 'geocode'] },
            function(pred, status) {
              if (status !== global.google.maps.places.PlacesServiceStatus.OK || !pred) resolve([]);
              else resolve(pred);
            }
          );
        });
        preds.slice(0, 6).forEach(function(p) {
          push({
            label: p.structured_formatting && p.structured_formatting.main_text ? p.structured_formatting.main_text : p.description,
            sublabel: p.structured_formatting && p.structured_formatting.secondary_text ? p.structured_formatting.secondary_text : p.description,
            placeId: p.place_id,
            source: 'google'
          });
        });
      } catch (e) { /* ignore */ }
    }

    return results.slice(0, 10);
  }

  async function fillPostcodeFromCoords(item) {
    if (!item || item.postcode || !item.lat || !item.lng) return item;
    try {
      var res = await fetch(
        'https://api.postcodes.io/postcodes?lon=' + encodeURIComponent(item.lng) + '&lat=' + encodeURIComponent(item.lat)
      );
      if (res.ok) {
        var data = await res.json();
        if (data && data.result && data.result.length) {
          var r = data.result[0];
          item.postcode = global.AYLEN_PICKUP && global.AYLEN_PICKUP.normalizeUKPostcode
            ? global.AYLEN_PICKUP.normalizeUKPostcode(r.postcode)
            : r.postcode;
          item.city = item.city || r.admin_district || r.region || '';
        }
      }
    } catch (e) { /* ignore */ }
    return item;
  }

  async function resolveSuggestion(item) {
    if (!item) return null;
    if (item.postcode || (item.address && !item.placeId)) {
      return fillPostcodeFromCoords(item);
    }

    if (item.placeId && placesService && global.google && global.google.maps) {
      var details = await new Promise(function(resolve) {
        var svc = new global.google.maps.places.PlacesService(document.createElement('div'));
        svc.getDetails(
          { placeId: item.placeId, fields: ['name', 'formatted_address', 'address_components', 'geometry', 'url'] },
          function(place, status) {
            if (status !== global.google.maps.places.PlacesServiceStatus.OK || !place) resolve(null);
            else resolve(place);
          }
        );
      });
      if (details) {
        var pc = '';
        var city = '';
        (details.address_components || []).forEach(function(c) {
          if (c.types.indexOf('postal_code') !== -1) pc = c.long_name;
          if (c.types.indexOf('postal_town') !== -1 || c.types.indexOf('locality') !== -1) city = c.long_name;
        });
        return {
          name: details.name || item.label,
          address: details.formatted_address || '',
          postcode: pc,
          city: city,
          mapLink: details.url || '',
          lat: details.geometry && details.geometry.location ? details.geometry.location.lat() : null,
          lng: details.geometry && details.geometry.location ? details.geometry.location.lng() : null
        };
      }
    }

    if (item.source === 'postcode' && item.postcode && global.AYLEN_PICKUP && global.AYLEN_PICKUP.lookupUKPostcode) {
      var looked = await global.AYLEN_PICKUP.lookupUKPostcode(item.postcode);
      return looked ? Object.assign({ label: item.postcode, postcode: item.postcode }, looked) : item;
    }

    var resolved = await fillPostcodeFromCoords(item);
    return resolved;
  }

  function applySuggestionToForm(form, item) {
    if (!item) return;
    if (item.name && field(form, 'name') && !field(form, 'name').value.trim()) {
      field(form, 'name').value = item.name;
    } else if (item.label && field(form, 'name') && !field(form, 'name').value.trim()) {
      field(form, 'name').value = item.label;
    }
    if (item.address && field(form, 'address')) field(form, 'address').value = item.address;
    if (item.postcode && field(form, 'postcode')) field(form, 'postcode').value = item.postcode;
    if (item.city && field(form, 'city')) field(form, 'city').value = item.city;
    if (item.mapLink && field(form, 'mapLink')) field(form, 'mapLink').value = item.mapLink;
    if (field(form, 'venueSearch')) {
      field(form, 'venueSearch').value = item.postcode || item.address || item.label || '';
    }
    form._suggestionCoords = item.lat && item.lng ? { lat: item.lat, lng: item.lng } : null;
    saveDraft(form);
  }

  function wireAutocomplete(form) {
    var input = field(form, 'venueSearch');
    var list = form.querySelector('[data-suggestions]');
    if (!input || !list) return;

    var debounce = null;
    var activeIdx = -1;

    function hideList() {
      list.classList.add('is-hidden');
      activeIdx = -1;
    }

    function showList() {
      list.classList.remove('is-hidden');
    }

    input.addEventListener('input', function() {
      clearTimeout(debounce);
      debounce = setTimeout(async function() {
        var items = await searchVenueSuggestions(input.value);
        if (!items.length) {
          list.innerHTML = '<li class="pickup-suggestions__empty">No matches — type postcode or full address</li>';
          showList();
          return;
        }
        list.innerHTML = items.map(function(it, i) {
          return '<li data-idx="' + i + '">' + esc(it.label) +
            (it.sublabel ? '<small>' + esc(it.sublabel) + '</small>' : '') + '</li>';
        }).join('');
        list._items = items;
        showList();
      }, 280);
    });

    list.addEventListener('click', async function(ev) {
      var li = ev.target.closest('li[data-idx]');
      if (!li || !list._items) return;
      var item = list._items[Number(li.getAttribute('data-idx'))];
      hideList();
      showAlert(form, 'Applying address…', 'info');
      var resolved = await resolveSuggestion(item);
      applySuggestionToForm(form, resolved || item);
      showAlert(form, '', 'info');
    });

    input.addEventListener('keydown', function(ev) {
      var items = list.querySelectorAll('li[data-idx]');
      if (!items.length || list.classList.contains('is-hidden')) return;
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
      } else if (ev.key === 'Enter' && activeIdx >= 0) {
        ev.preventDefault();
        items[activeIdx].click();
        return;
      } else if (ev.key === 'Escape') {
        hideList();
        return;
      } else return;
      items.forEach(function(el, i) {
        el.classList.toggle('is-active', i === activeIdx);
      });
    });

    document.addEventListener('click', function(ev) {
      if (!form.contains(ev.target)) hideList();
    });
  }

  function wireUpload(form) {
    var zone = form.querySelector('[data-upload-zone]');
    var fileInput = field(form, 'photoFile');
    var preview = form.querySelector('[data-upload-preview]');
    var progress = form.querySelector('.pickup-upload-progress');
    var progressBar = progress ? progress.querySelector('span') : null;
    var statusEl = form.querySelector('[data-upload-status]');
    if (!zone || !fileInput) return;

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text || '';
    }

    function showProgress(pct) {
      if (!progress || !progressBar) return;
      progress.classList.add('is-visible');
      progressBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
    }

    function hideProgress() {
      if (progress) progress.classList.remove('is-visible');
      if (progressBar) progressBar.style.width = '0%';
    }

    function handleFile(file) {
      if (!file) return;
      if (!file.type || file.type.indexOf('image/') !== 0) {
        setStatus('Please choose an image file');
        showAlert(form, 'Please choose an image file', 'error');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setStatus('Image too large (max 5 MB)');
        showAlert(form, 'Image too large (max 5 MB)', 'error');
        return;
      }
      form._pendingPhotoFile = file;
      var url = URL.createObjectURL(file);
      if (preview) {
        preview.innerHTML = '<img src="' + url + '" alt="Preview">';
        preview.classList.add('is-visible');
      }
      setStatus(file.name + ' ready to upload on save');
      showAlert(form, '', 'error');
    }

    zone.addEventListener('click', function() { fileInput.click(); });
    fileInput.addEventListener('change', function() {
      if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
    });
    zone.addEventListener('dragover', function(ev) {
      ev.preventDefault();
      zone.classList.add('is-dragover');
    });
    zone.addEventListener('dragleave', function() { zone.classList.remove('is-dragover'); });
    zone.addEventListener('drop', function(ev) {
      ev.preventDefault();
      zone.classList.remove('is-dragover');
      if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]) {
        handleFile(ev.dataTransfer.files[0]);
      }
    });

    form._uploadUi = { setStatus: setStatus, showProgress: showProgress, hideProgress: hideProgress };
  }

  async function uploadLocationPhoto(file, locationId, ui) {
    if (!file) return { success: true, url: '' };
    if (ui) {
      ui.setStatus('Uploading…');
      ui.showProgress(5);
    }
    var productId = 'location_' + locationId;
    global.currentEditingProductId = productId;

    if (global.FBDB && global.FBDB.uploadImageWithProgress) {
      return global.FBDB.uploadImageWithProgress(file, productId, function(pct) {
        if (ui) ui.showProgress(pct);
      });
    }
    if (typeof uploadImageToCloudinary === 'function') {
      if (ui) ui.showProgress(40);
      var result = await uploadImageToCloudinary(file);
      if (ui) {
        ui.hideProgress();
        ui.setStatus(result.success ? 'Upload complete' : '');
      }
      return result;
    }
    return { success: false, error: 'Upload not available' };
  }

  async function enrichWeatherSoft(location) {
    if (typeof enrichPickupLocationWeather === 'function') {
      try {
        return await enrichPickupLocationWeather(location);
      } catch (error) {
        location.weatherError = (error && error.message) ? error.message : 'Weather unavailable';
        if (location.weatherError.indexOf('Invalid postcode') !== -1) {
          location.weatherError = 'Weather unavailable for this postcode — location will still save.';
        }
        return location;
      }
    }
    return location;
  }

  function refreshSiteUi() {
    if (typeof renderLocations === 'function') renderLocations();
    if (typeof fillPickup === 'function') fillPickup();
    if (global.AyelenAdminDashboard && global.AyelenAdminDashboard.refreshLocations) {
      global.AyelenAdminDashboard.refreshLocations();
    }
  }

  function setSaving(form, saving) {
    form._saving = saving;
    var panel = form.closest('.pickup-admin-modal');
    if (!panel) return;
    panel.querySelectorAll('[data-action]').forEach(function(btn) {
      btn.disabled = saving;
    });
    if (saving) showAlert(form, 'Saving…', 'info');
  }

  async function persistLocation(form, options) {
    options = options || {};
    var data = validateForm(form);
    if (!data) return { ok: false };

    var mode = form.getAttribute('data-mode') || 'add';
    var locationId = form.getAttribute('data-location-id') || '';
    var isEdit = mode === 'edit' && locationId;

    setSaving(form, true);

    try {
      if (!isEdit && !locationId) {
        locationId = 'loc_' + Date.now();
        form.setAttribute('data-location-id', locationId);
      }

      var photoUrl = (field(form, 'existingPhotoUrl') || {}).value || '';
      var pendingFile = form._pendingPhotoFile;

      if (pendingFile) {
        var uploadId = locationId;
        var upload = await uploadLocationPhoto(pendingFile, uploadId, form._uploadUi);
        if (!upload.success) {
          var errMsg = upload.error || 'Upload failed';
          if (errMsg.indexOf('size') !== -1) errMsg = 'Image too large';
          showAlert(form, 'Upload failed: ' + errMsg, 'error');
          if (form._uploadUi) form._uploadUi.setStatus('Upload failed');
          setSaving(form, false);
          return { ok: false };
        }
        photoUrl = upload.url;
        form._pendingPhotoFile = null;
      }

      var location;
      if (isEdit) {
        location = (typeof locations !== 'undefined' ? locations : []).find(function(l) {
          return sameId(l.id, locationId);
        });
        if (!location) throw new Error('Location not found. Refresh and try again.');
        Object.assign(location, data, {
          photoUrl: photoUrl,
          updatedAt: new Date().toISOString()
        });
      } else {
        location = Object.assign({
          id: locationId,
          lat: 0,
          lng: 0,
          lon: 0,
          useCount: 0,
          photoUrl: photoUrl
        }, data);
      }

      if (form._suggestionCoords) {
        location.lat = form._suggestionCoords.lat;
        location.lng = form._suggestionCoords.lng;
        location.lon = form._suggestionCoords.lng;
      }

      if (!global.FBDB || !global.FBDB.saveLocation) {
        throw new Error('Firebase is not ready. Location was not saved.');
      }
      if (global.FBDB.ensureAdminSession) {
        await global.FBDB.ensureAdminSession();
      }

      location = await enrichWeatherSoft(location);
      var saved = await global.FBDB.saveLocation(location);

      if (isEdit) {
        var idx = locations.findIndex(function(l) { return sameId(l.id, locationId); });
        if (idx !== -1) locations[idx] = saved;
      } else {
        if (typeof locations !== 'undefined') locations.push(saved);
      }

      clearDraft(form);
      refreshSiteUi();

      var weatherNote = saved.weatherError ? ' Saved — weather update skipped.' : '';
      showAlert(form, (isEdit ? 'Location saved!' : 'Location added!') + weatherNote, 'success');
      notifyMsg(isEdit ? 'Location saved!' : 'Location added!', 'success');

      setSaving(form, false);
      return { ok: true, saved: saved, locationId: saved.id };
    } catch (error) {
      console.error('[Pickup admin] save failed', error);
      var msg = (error && error.message) ? error.message : 'Save failed';
      if (msg.indexOf('Invalid postcode') !== -1) msg = 'Invalid postcode';
      showAlert(form, msg, 'error');
      notifyMsg(msg, 'error');
      saveDraft(form);
      setSaving(form, false);
      return { ok: false };
    }
  }

  function wireForm(form, opts) {
    var panel = form.closest('.pickup-admin-modal');
    if (!panel) return;

    if (opts.restoreDraft !== false && loadDraft(form)) {
      showAlert(form, 'Restored unsaved draft from this device', 'info');
    } else if (opts.location) {
      writeForm(form, opts.location);
      if (field(form, 'venueSearch')) {
        field(form, 'venueSearch').value = opts.location.postcode || opts.location.address || '';
      }
    }

    wireAutocomplete(form);
    wireUpload(form);
    wireGoingSwitch(form);

    form.addEventListener('input', function() {
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(function() { saveDraft(form); }, AUTOSAVE_MS);
    });
    form.addEventListener('change', function() {
      saveDraft(form);
    });

    var toggle = form.querySelector('[data-optional-toggle]');
    var optional = form.querySelector('[data-optional-panel]');
    if (toggle && optional) {
      toggle.addEventListener('click', function() {
        optional.classList.toggle('is-open');
        toggle.textContent = optional.classList.contains('is-open')
          ? '− Hide optional fields'
          : '+ More options (address, description, weather, going)';
      });
    }

    panel.querySelectorAll('[data-action]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var action = btn.getAttribute('data-action');
        if (action === 'cancel') {
          if (global.AYLEN_MODAL) global.AYLEN_MODAL.close();
          return;
        }
        if (action === 'quick') {
          openQuickEdit(form.getAttribute('data-location-id'));
          return;
        }
        if (action === 'duplicate') {
          duplicateFromId(form.getAttribute('data-location-id'));
          return;
        }
        if (action === 'save' || action === 'save-another') {
          var result = await persistLocation(form, {});
          if (result.ok) {
            if (action === 'save-another') {
              resetAddForm(form);
              showAlert(form, 'Saved. Add another location below.', 'success');
            } else if (global.AYLEN_MODAL) {
              global.AYLEN_MODAL.close();
            }
          }
        }
      });
    });
  }

  function resetAddForm(form) {
    form.reset();
    clearFieldErrors(form);
    form._pendingPhotoFile = null;
    form._suggestionCoords = null;
    if (field(form, 'showOnWebsite')) field(form, 'showOnWebsite').checked = true;
    var preview = form.querySelector('[data-upload-preview]');
    if (preview) {
      preview.innerHTML = '';
      preview.classList.remove('is-visible');
    }
    if (field(form, 'existingPhotoUrl')) field(form, 'existingPhotoUrl').value = '';
    form.setAttribute('data-location-id', '');
    field(form, 'name') && field(form, 'name').focus();
  }

  function openModal(html, modalId, formOpts) {
    activeModalId = modalId;
    if (global.AYLEN_MODAL) {
      global.AYLEN_MODAL.open(html, {
        id: modalId,
        panelClass: 'pickup-admin-modal-wrap',
        afterOpen: function(panel) {
          var root = panel || document.getElementById(modalId);
          var form = root && root.querySelector ? root.querySelector('.pickup-admin-form') : null;
          if (form) wireForm(form, formOpts || {});
          var nameInput = form && field(form, 'name');
          if (nameInput) nameInput.focus();
        }
      });
      return;
    }
    document.body.insertAdjacentHTML('beforeend', html);
    var panel = document.getElementById(modalId);
    var form = panel && panel.querySelector('.pickup-admin-form');
    if (form) wireForm(form, formOpts || {});
    if (form && field(form, 'name')) field(form, 'name').focus();
  }

  function openAdd(prefill) {
    var modalId = 'pickupModal_' + Date.now();
    var html = buildFormHtml({ mode: 'add', modalId: modalId, location: prefill || {} });
    openModal(html, modalId, { location: prefill, restoreDraft: !prefill });
  }

  function openEdit(id) {
    var loc = (typeof locations !== 'undefined' ? locations : []).find(function(l) {
      return sameId(l.id, id);
    });
    if (!loc) {
      notifyMsg('Location not found', 'error');
      return;
    }
    var modalId = 'pickupEdit_' + Date.now();
    var html = buildFormHtml({ mode: 'edit', modalId: modalId, location: loc, title: 'Edit: ' + (loc.name || 'Location') });
    openModal(html, modalId, { location: loc, restoreDraft: true });
  }

  function openQuickEdit(id) {
    var loc = (typeof locations !== 'undefined' ? locations : []).find(function(l) {
      return sameId(l.id, id);
    });
    if (!loc) return;
    var modalId = 'pickupQuick_' + Date.now();
    var html =
      '<div class="aylen-modal-panel pickup-admin-modal" id="' + esc(modalId) + '">' +
        '<div class="pickup-modal-head">' +
          '<span class="close" onclick="AYLEN_MODAL.close()">&times;</span>' +
          '<h2 class="pickup-modal-title">Quick edit — ' + esc(loc.name || '') + '</h2>' +
        '</div>' +
        '<div class="pickup-modal-body">' +
          '<form class="pickup-admin-form" data-mode="edit" data-location-id="' + esc(loc.id) + '" data-quick="1">' +
            '<div class="pickup-form-alert"></div>' +
            '<div class="pickup-field" data-wrap="name">' +
              '<label class="pickup-label">Market name</label>' +
              '<input class="pickup-input" data-field="name" value="' + esc(loc.name || '') + '">' +
            '</div>' +
            '<div class="pickup-form-row">' +
              '<div><label class="pickup-label">Day</label><select class="pickup-select" data-field="day">' + dayOptionsHtml(loc.days || loc.day) + '</select></div>' +
              '<div><label class="pickup-label">Time</label><input class="pickup-input" data-field="openingTime" value="' + esc(loc.openingTime || loc.time || '') + '"></div>' +
            '</div>' +
            '<label class="pickup-label">Postcode</label>' +
            '<input class="pickup-input" data-field="postcode" value="' + esc(loc.postcode || '') + '">' +
            '<label class="pickup-label">Going</label>' +
            buildGoingToggleHtml(loc.status) +
            '<input type="hidden" data-field="address" value="' + esc(loc.address || '') + '">' +
            '<input type="hidden" data-field="city" value="' + esc(loc.city || '') + '">' +
            '<input type="hidden" data-field="mapLink" value="' + esc(loc.mapLink || '') + '">' +
            '<input type="hidden" data-field="weatherPostcode" value="' + esc(loc.weatherPostcode || '') + '">' +
            '<input type="hidden" data-field="note" value="' + esc(loc.note || '') + '">' +
            '<input type="hidden" data-field="sortOrder" value="' + esc(String(loc.sortOrder || 0)) + '">' +
            '<input type="hidden" data-field="existingPhotoUrl" value="' + esc(loc.photoUrl || '') + '">' +
          '</form>' +
        '</div>' +
        '<div class="pickup-form-sticky">' +
          '<button type="button" class="pickup-btn pickup-btn-secondary" data-action="cancel">Cancel</button>' +
          '<button type="button" class="pickup-btn pickup-btn-primary" data-action="save">Save</button>' +
          '<button type="button" class="pickup-btn pickup-btn-ghost" data-action="full">Full form</button>' +
        '</div>' +
      '</div>';
    openModal(html, modalId, { location: loc, restoreDraft: false });
    var panel = document.getElementById(modalId);
    var form = panel && panel.querySelector('.pickup-admin-form');
    if (form) {
      panel.querySelector('[data-action="full"]').addEventListener('click', function() {
        if (global.AYLEN_MODAL) global.AYLEN_MODAL.close(modalId);
        openEdit(id);
      });
    }
  }

  function duplicateFromId(id) {
    var loc = (typeof locations !== 'undefined' ? locations : []).find(function(l) {
      return sameId(l.id, id);
    });
    if (!loc) return;
    var copy = Object.assign({}, loc, {
      id: '',
      name: (loc.name || 'Location') + ' (copy)',
      useCount: 0
    });
    delete copy.weatherUpdatedAt;
    if (global.AYLEN_MODAL) global.AYLEN_MODAL.close();
    openAdd(copy);
  }

  function loadGooglePlacesIfConfigured() {
    var key = (global.AYLEN_SITE && global.AYLEN_SITE.googlePlacesApiKey) || '';
    if (!key || global.google && global.google.maps && global.google.maps.places) {
      if (global.google && global.google.maps && global.google.maps.places) {
        placesService = new global.google.maps.places.AutocompleteService();
      }
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&libraries=places&callback=aylenPickupPlacesReady';
    script.async = true;
    global.aylenPickupPlacesReady = function() {
      if (global.google && global.google.maps && global.google.maps.places) {
        placesService = new global.google.maps.places.AutocompleteService();
      }
    };
    document.head.appendChild(script);
  }

  global.AYLEN_PICKUP_ADMIN = {
    openAdd: openAdd,
    openEdit: openEdit,
    openQuickEdit: openQuickEdit,
    duplicateFromId: duplicateFromId
  };

  loadGooglePlacesIfConfigured();
})(typeof window !== 'undefined' ? window : global);
