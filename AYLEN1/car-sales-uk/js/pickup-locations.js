/**
 * Pickup / car boot locations — status, sorting, postcode helpers (shared).
 */
(function(global) {
  var STATUS_ORDER = { going: 0, possible: 1, not_confirmed: 2 };

  function normalizeUKPostcode(postcode) {
    var s = String(postcode || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!s) return '';
    if (s.length > 3) return s.slice(0, -3) + ' ' + s.slice(-3);
    return s;
  }

  function normalizePickupStatus(loc) {
    if (!loc) return 'not_confirmed';
    var s = String(loc.status || '').toLowerCase().replace(/-/g, '_').replace(/_/g, '_');
    if (s === 'notconfirmed') s = 'not_confirmed';
    if (s === 'going') return 'going';
    if (s === 'possible') return 'possible';
    if (s === 'not_confirmed') return 'not_confirmed';
    if (loc.goingThisWeekend === true || loc.active === true) return 'going';
    return 'not_confirmed';
  }

  function syncPickupStatusFields(loc) {
    if (!loc) return loc;
    var status = normalizePickupStatus(loc);
    loc.status = status;
    loc.active = status === 'going';
    loc.goingThisWeekend = status === 'going';
    return loc;
  }

  function hydrateLocationRecord(item) {
    if (!item) return item;
    var loc = Object.assign({}, item);
    var rawStatus = String(loc.status || '').toLowerCase().replace(/-/g, '_');
    if (rawStatus === 'notconfirmed') rawStatus = 'not_confirmed';
    if (rawStatus === 'going' || rawStatus === 'possible' || rawStatus === 'not_confirmed') {
      loc.status = rawStatus;
    } else if (loc.goingThisWeekend === true || loc.active === true) {
      loc.status = 'going';
    } else {
      loc.status = 'not_confirmed';
    }
    return syncPickupStatusFields(loc);
  }

  function pickupStatusMeta(status) {
    if (status === 'going') {
      return {
        status: 'going',
        label: 'We are going this weekend',
        shortLabel: 'Going',
        badge: 'GOING THIS WEEKEND',
        cardClass: 'pickup-card--going',
        borderColor: '#00ff88',
        glow: true
      };
    }
    if (status === 'possible') {
      return {
        status: 'possible',
        label: 'Possible this weekend',
        shortLabel: 'Possible',
        cardClass: 'pickup-card--possible',
        borderColor: '#fb923c',
        glow: false
      };
    }
    return {
      status: 'not_confirmed',
      label: 'Not confirmed yet',
      shortLabel: 'Not confirmed',
      cardClass: 'pickup-card--not-confirmed',
      borderColor: '#64748b',
      glow: false
    };
  }

  function sortPickupLocations(list) {
    return (Array.isArray(list) ? list.slice() : []).sort(function(a, b) {
      var sa = STATUS_ORDER[normalizePickupStatus(a)] ?? 9;
      var sb = STATUS_ORDER[normalizePickupStatus(b)] ?? 9;
      if (sa !== sb) return sa - sb;
      var pinned = (b.pinned === true) - (a.pinned === true);
      if (pinned) return pinned;
      var order = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      if (order) return order;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function isPickupVisibleOnSite(loc, isAdmin) {
    if (!loc) return false;
    if (isAdmin) return true;
    return loc.showOnWebsite !== false;
  }

  /** Pickup edit controls — Firebase admin session only (not isAdminMode). */
  function canManagePickupLocations() {
    return !!(global.FBDB && typeof global.FBDB.isAdmin === 'function' && global.FBDB.isAdmin());
  }

  async function geocodeUKPostcode(postcode) {
    var clean = normalizeUKPostcode(postcode);
    if (!clean) return null;
    var tries = [clean, clean.replace(/\s/g, '')];
    for (var i = 0; i < tries.length; i++) {
      try {
        var response = await fetch('https://api.postcodes.io/postcodes/' + encodeURIComponent(tries[i]));
        if (!response.ok) continue;
        var data = await response.json();
        if (data && data.result) {
          return {
            lat: Number(data.result.latitude),
            lng: Number(data.result.longitude),
            postcode: data.result.postcode || clean
          };
        }
      } catch (e) {
        /* fall through to same-origin proxy */
      }
    }
    for (var j = 0; j < tries.length; j++) {
      try {
        var proxyRes = await fetch('/api/geocode-postcode?postcode=' + encodeURIComponent(tries[j]));
        if (!proxyRes.ok) continue;
        var proxyData = await proxyRes.json();
        if (proxyData && proxyData.lat && proxyData.lng) {
          return {
            lat: Number(proxyData.lat),
            lng: Number(proxyData.lng),
            postcode: proxyData.postcode || clean
          };
        }
      } catch (proxyErr) {
        console.warn('Postcode geocode failed:', tries[j], proxyErr.message || proxyErr);
      }
    }
    return null;
  }

  function weatherLabelFromRain(rainPercent) {
    var r = Number(rainPercent || 0);
    if (r <= 25) return { label: 'Good', color: '#00ff88' };
    if (r <= 55) return { label: 'Risky', color: '#fb923c' };
    return { label: 'Rain likely', color: '#f87171' };
  }

  global.AYLEN_PICKUP = {
    normalizeUKPostcode: normalizeUKPostcode,
    normalizePickupStatus: normalizePickupStatus,
    syncPickupStatusFields: syncPickupStatusFields,
    pickupStatusMeta: pickupStatusMeta,
    sortPickupLocations: sortPickupLocations,
    isPickupVisibleOnSite: isPickupVisibleOnSite,
    canManagePickupLocations: canManagePickupLocations,
    geocodeUKPostcode: geocodeUKPostcode,
    weatherLabelFromRain: weatherLabelFromRain,
    hydrateLocationRecord: hydrateLocationRecord,
    STATUS_ORDER: STATUS_ORDER
  };
})(typeof window !== 'undefined' ? window : global);
