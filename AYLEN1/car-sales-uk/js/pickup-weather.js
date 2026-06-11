/**
 * Live weather widget for pickup / car boot cards (Open-Meteo, no API key).
 */
(function(global) {
  var REFRESH_MS = 30 * 60 * 1000;
  var cache = {};
  var inFlight = {};

  function nextWeekendDates() {
    var today = new Date();
    var day = today.getDay();
    var saturdayOffset = (6 - day + 7) % 7;
    var sundayOffset = (7 - day) % 7;
    var saturday = new Date(today);
    saturday.setDate(today.getDate() + saturdayOffset);
    var sunday = new Date(today);
    sunday.setDate(today.getDate() + sundayOffset);
    return {
      saturday: saturday.toISOString().slice(0, 10),
      sunday: sunday.toISOString().slice(0, 10)
    };
  }

  function pickupWeatherDays(value) {
    var clean = String(value || '').toLowerCase();
    var hasSat = clean.indexOf('sat') !== -1 || clean.indexOf('both') !== -1 || clean.indexOf('weekend') !== -1;
    var hasSun = clean.indexOf('sun') !== -1 || clean.indexOf('both') !== -1 || clean.indexOf('weekend') !== -1;
    if (!hasSat && !hasSun) hasSat = true;
    return { saturday: hasSat, sunday: hasSun };
  }

  /** WMO weather_code → visual kind */
  function weatherKindFromCode(code) {
    var c = Number(code);
    if (c === 0) return 'sunny';
    if (c >= 1 && c <= 3) return 'cloudy';
    if (c === 45 || c === 48) return 'fog';
    if (c >= 51 && c <= 57) return 'rain';
    if (c >= 61 && c <= 67) return 'rain';
    if (c >= 71 && c <= 77) return 'snow';
    if (c >= 80 && c <= 82) return 'rain';
    if (c >= 85 && c <= 86) return 'snow';
    if (c >= 95 && c <= 99) return 'storm';
    return 'cloudy';
  }

  function weatherIconMeta(kind) {
    var map = {
      sunny: { fa: 'fa-sun', label: 'Sunny', anim: 'pickup-wx-icon--sunny' },
      cloudy: { fa: 'fa-cloud', label: 'Cloudy', anim: 'pickup-wx-icon--cloudy' },
      rain: { fa: 'fa-cloud-rain', label: 'Rain', anim: 'pickup-wx-icon--rain' },
      storm: { fa: 'fa-cloud-bolt', label: 'Storm', anim: 'pickup-wx-icon--storm' },
      fog: { fa: 'fa-smog', label: 'Fog', anim: 'pickup-wx-icon--fog' },
      snow: { fa: 'fa-snowflake', label: 'Snow', anim: 'pickup-wx-icon--snow' },
      unknown: { fa: 'fa-temperature-half', label: 'Weather', anim: 'pickup-wx-icon--cloudy' }
    };
    return map[kind] || map.unknown;
  }

  function weatherIconHtml(icon, sizeClass) {
    var cls = 'fas ' + icon.fa + (sizeClass ? ' ' + sizeClass : '');
    return '<i class="' + cls + '" aria-hidden="true"></i>';
  }

  /** GOOD / POSSIBLE / BAD for weekend trip */
  function tripStatusFromRainAndCode(rainPct, weatherCode) {
    var rain = Number(rainPct || 0);
    var code = Number(weatherCode);
    if (code >= 95 && code <= 99) return statusMeta('BAD');
    if (code >= 71 && code <= 77) return statusMeta('BAD');
    if (code >= 65 && code <= 67) return statusMeta('BAD');
    if (rain >= 56) return statusMeta('BAD');
    if (rain >= 26) return statusMeta('POSSIBLE');
    return statusMeta('GOOD');
  }

  function normalizeStoredTripStatus(loc) {
    var raw = String((loc && loc.weatherStatus) || 'GOOD').toUpperCase();
    if (raw === 'OK' || raw === 'RISKY') raw = 'POSSIBLE';
    if (raw === 'RAIN LIKELY' || raw === 'RAIN') raw = 'BAD';
    if (raw === 'GOOD' || raw === 'POSSIBLE' || raw === 'BAD') return statusMeta(raw);
    return null;
  }

  function statusMeta(key) {
    var map = {
      GOOD: { key: 'GOOD', label: 'Good — worth the trip', className: 'pickup-wx-verdict--good' },
      POSSIBLE: { key: 'POSSIBLE', label: 'Possible — showers around', className: 'pickup-wx-verdict--possible' },
      BAD: { key: 'BAD', label: 'Bad — rain likely', className: 'pickup-wx-verdict--bad' }
    };
    return map[key] || map.GOOD;
  }

  function rainBand(pct) {
    var rain = Number(pct || 0);
    if (rain >= 56) return 'high';
    if (rain >= 26) return 'mid';
    return 'low';
  }

  function formatTempRange(forecast, days) {
    var temps = [];
    if (days.saturday) temps.push(Number(forecast.saturday.max || 0));
    if (days.sunday) temps.push(Number(forecast.sunday.max || 0));
    if (!temps.length) return String(Math.round(Number(forecast.current.temp || 0))) + '°';
    var min = Math.min.apply(null, temps);
    var max = Math.max.apply(null, temps);
    if (min === max) return String(Math.round(max)) + '°';
    return Math.round(min) + '–' + Math.round(max) + '°';
  }

  function weekendRainWindSummary(forecast, days) {
    var maxRain = 0;
    var maxWind = 0;
    if (days.saturday) {
      maxRain = Math.max(maxRain, Number(forecast.saturday.rain || 0));
      maxWind = Math.max(maxWind, Number(forecast.saturday.wind || 0));
    }
    if (days.sunday) {
      maxRain = Math.max(maxRain, Number(forecast.sunday.rain || 0));
      maxWind = Math.max(maxWind, Number(forecast.sunday.wind || 0));
    }
    return { rain: Math.round(maxRain), wind: Math.round(maxWind) };
  }

  function dominantWeekendKind(forecast, days) {
    var order = { storm: 5, rain: 4, snow: 3, fog: 2, cloudy: 1, sunny: 0 };
    var best = 'cloudy';
    var bestScore = -1;
    function consider(code) {
      var kind = weatherKindFromCode(code);
      var score = order[kind] != null ? order[kind] : 1;
      if (score > bestScore) {
        bestScore = score;
        best = kind;
      }
    }
    if (days.saturday) consider(forecast.saturday.code);
    if (days.sunday) consider(forecast.sunday.code);
    if (bestScore < 0) consider(forecast.current.code);
    return best;
  }

  function worstTripStatus(parts) {
    var order = { BAD: 2, POSSIBLE: 1, GOOD: 0 };
    var worst = statusMeta('GOOD');
    (parts || []).forEach(function(p) {
      var s = tripStatusFromRainAndCode(p.rain, p.code);
      if (order[s.key] > order[worst.key]) worst = s;
    });
    return worst;
  }

  function forecastFromStored(loc) {
    if (!loc) return null;
    var has =
      loc.currentTemp !== undefined ||
      loc.saturdayRainPct !== undefined ||
      loc.sundayRainPct !== undefined;
    if (!has) return null;
    var days = loc.weatherDays || pickupWeatherDays(loc.days || loc.day);
    return {
      days: days,
      current: {
        temp: Number(loc.currentTemp || loc.saturdayTemp || 0),
        rain: Number(loc.currentRainPct != null ? loc.currentRainPct : Math.max(loc.saturdayRainPct || 0, loc.sundayRainPct || 0)),
        wind: Number(loc.windSpeed || loc.currentWind || 0),
        code: Number(loc.weatherCode || loc.currentWeatherCode || 0)
      },
      saturday: {
        rain: Number(loc.saturdayRainPct || 0),
        max: Number(loc.saturdayTemp || 0),
        code: Number(loc.saturdayWeatherCode || 0),
        wind: Number(loc.saturdayWind || 0)
      },
      sunday: {
        rain: Number(loc.sundayRainPct || 0),
        max: Number(loc.sundayTemp || 0),
        code: Number(loc.sundayWeatherCode || 0),
        wind: Number(loc.sundayWind || 0)
      },
      tripStatus: normalizeStoredTripStatus(loc) || worstTripStatus([
        { rain: loc.saturdayRainPct, code: loc.saturdayWeatherCode },
        { rain: loc.sundayRainPct, code: loc.sundayWeatherCode }
      ]),
      fetchedAt: loc.lastWeatherUpdate ? new Date(loc.lastWeatherUpdate).getTime() : 0
    };
  }

  async function fetchLiveForecast(lat, lng, scheduleDays) {
    var key = lat + ',' + lng;
    if (cache[key] && Date.now() - cache[key].fetchedAt < REFRESH_MS) {
      return cache[key].forecast;
    }
    if (inFlight[key]) return inFlight[key];

    var dates = nextWeekendDates();
    var url =
      'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) +
      '&longitude=' + encodeURIComponent(lng) +
      '&current=temperature_2m,weather_code,precipitation_probability,wind_speed_10m' +
      '&daily=weather_code,precipitation_probability_max,temperature_2m_max,wind_speed_10m_max' +
      '&timezone=Europe%2FLondon&start_date=' + dates.saturday + '&end_date=' + dates.sunday;

    inFlight[key] = fetch(url).then(function(response) {
      if (!response.ok) throw new Error('Weather API failed');
      return response.json();
    }).then(function(data) {
      var current = data.current || {};
      var daily = data.daily || {};
      var codes = daily.weather_code || [];
      var rains = daily.precipitation_probability_max || [];
      var temps = daily.temperature_2m_max || [];
      var winds = daily.wind_speed_10m_max || [];
      var days = scheduleDays || { saturday: true, sunday: true };
      var sat = {
        rain: Math.round(Number(rains[0] || 0)),
        max: Math.round(Number(temps[0] || 0)),
        code: Number(codes[0] || 0),
        wind: Math.round(Number(winds[0] || 0))
      };
      var sun = {
        rain: Math.round(Number(rains[1] || rains[0] || 0)),
        max: Math.round(Number(temps[1] || temps[0] || 0)),
        code: Number(codes[1] || codes[0] || 0),
        wind: Math.round(Number(winds[1] || winds[0] || 0))
      };
      var parts = [];
      if (days.saturday) parts.push({ rain: sat.rain, code: sat.code });
      if (days.sunday) parts.push({ rain: sun.rain, code: sun.code });
      if (!parts.length) parts.push({ rain: sat.rain, code: sat.code });

      var forecast = {
        days: days,
        current: {
          temp: Math.round(Number(current.temperature_2m || sat.max || 0)),
          rain: Math.round(Number(current.precipitation_probability || sat.rain || 0)),
          wind: Math.round(Number(current.wind_speed_10m || sat.wind || 0)),
          code: Number(current.weather_code != null ? current.weather_code : sat.code)
        },
        saturday: sat,
        sunday: sun,
        tripStatus: worstTripStatus(parts),
        fetchedAt: Date.now()
      };
      cache[key] = { forecast: forecast, fetchedAt: Date.now() };
      return forecast;
    }).finally(function() {
      delete inFlight[key];
    });

    return inFlight[key];
  }

  function weatherUpdatePayload(forecast, locOrPostcode) {
    if (!forecast) return {};
    var cur = forecast.current || {};
    var trip = forecast.tripStatus || statusMeta('GOOD');
    var pc = '';
    if (typeof locOrPostcode === 'string') {
      pc = locOrPostcode;
    } else if (locOrPostcode) {
      pc = locOrPostcode.weatherPostcode || locOrPostcode.postcode || '';
    }
    return {
      currentTemp: Math.round(Number(cur.temp || 0)),
      currentRainPct: Math.round(Number(cur.rain || 0)),
      currentWind: Math.round(Number(cur.wind || 0)),
      windSpeed: Math.round(Number(cur.wind || 0)),
      weatherCode: Number(cur.code || 0),
      currentWeatherCode: Number(cur.code || 0),
      saturdayTemp: Math.round(Number(forecast.saturday.max || 0)),
      sundayTemp: Math.round(Number(forecast.sunday.max || 0)),
      saturdayRainPct: Math.round(Number(forecast.saturday.rain || 0)),
      sundayRainPct: Math.round(Number(forecast.sunday.rain || 0)),
      saturdayWeatherCode: Number(forecast.saturday.code || 0),
      sundayWeatherCode: Number(forecast.sunday.code || 0),
      saturdayWind: Math.round(Number(forecast.saturday.wind || 0)),
      sundayWind: Math.round(Number(forecast.sunday.wind || 0)),
      weatherDays: forecast.days,
      weatherStatus: trip.key,
      weatherPostcode: pc,
      weatherError: '',
      lastWeatherUpdate: new Date().toISOString(),
      weatherSource: 'open-meteo-live'
    };
  }

  function renderLoadingHtml() {
    return (
      '<div class="pickup-live-weather pickup-live-weather--loading" aria-live="polite">' +
        '<div class="pickup-wx-panel pickup-wx-panel--skeleton">' +
          '<div class="pickup-wx-skeleton pickup-wx-skeleton--head"></div>' +
          '<div class="pickup-wx-skeleton pickup-wx-skeleton--hero"></div>' +
          '<div class="pickup-wx-skeleton pickup-wx-skeleton--days"></div>' +
          '<p class="pickup-wx-skeleton-label">Loading forecast…</p>' +
        '</div>' +
      '</div>'
    );
  }

  function renderFallbackHtml() {
    return (
      '<div class="pickup-live-weather pickup-live-weather--fallback" aria-live="polite">' +
        '<div class="pickup-wx-panel">' +
          '<div class="pickup-wx-panel__head">' +
            '<span class="pickup-wx-panel__title"><i class="fas fa-cloud-sun"></i> Weekend weather</span>' +
          '</div>' +
          '<p class="pickup-wx-panel__empty">Forecast temporarily unavailable. Check again shortly.</p>' +
        '</div>' +
      '</div>'
    );
  }

  function renderWidgetHtml(forecast, loc) {
    if (!forecast || !forecast.current) return renderFallbackHtml();
    var days = forecast.days || pickupWeatherDays(loc && (loc.days || loc.day));
    var trip = forecast.tripStatus || tripStatusFromRainAndCode(
      Math.max(forecast.saturday.rain || 0, forecast.sunday.rain || 0),
      Math.max(forecast.saturday.code || 0, forecast.sunday.code || 0)
    );
    var heroKind = dominantWeekendKind(forecast, days);
    var heroIcon = weatherIconMeta(heroKind);
    var heroTemp = formatTempRange(forecast, days);
    var summary = weekendRainWindSummary(forecast, days);
    var pc = (loc && (loc.weatherPostcode || loc.postcode)) || 'UK';
    var updated = forecast.fetchedAt
      ? new Date(forecast.fetchedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : (loc && loc.lastWeatherUpdate
        ? new Date(loc.lastWeatherUpdate).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'just now');

    var weekendRows = '';
    if (days.saturday) weekendRows += weekendDayCard('Sat', forecast.saturday);
    if (days.sunday) weekendRows += weekendDayCard('Sun', forecast.sunday);
    if (!weekendRows) weekendRows += weekendDayCard('Sat', forecast.saturday);

    var splitClass = 'pickup-wx-panel__split';
    if (!(days.saturday && days.sunday)) splitClass += ' pickup-wx-panel__split--one';

    return (
      '<div class="pickup-live-weather pickup-live-weather--ready pickup-live-weather--' + heroKind + '" aria-live="polite">' +
        '<div class="pickup-wx-panel pickup-wx-panel--' + heroKind + '">' +
          '<div class="pickup-wx-panel__head">' +
            '<span class="pickup-wx-panel__title"><i class="fas fa-cloud-sun"></i> Weekend weather</span>' +
            '<span class="pickup-wx-panel__pc">' + escapeWx(pc) + '</span>' +
          '</div>' +
          '<div class="pickup-wx-panel__hero">' +
            '<div class="pickup-wx-panel__icon pickup-wx-panel__icon--' + heroKind + '" aria-hidden="true">' + weatherIconHtml(heroIcon) + '</div>' +
            '<div class="pickup-wx-panel__summary">' +
              '<div class="pickup-wx-panel__temp">' + escapeWx(heroTemp) + '</div>' +
              '<div class="pickup-wx-panel__cond">' + escapeWx(heroIcon.label) + '</div>' +
              '<div class="pickup-wx-panel__meta">Up to ' + summary.rain + '% rain · ' + summary.wind + ' km/h wind</div>' +
            '</div>' +
          '</div>' +
          '<div class="pickup-wx-panel__verdict ' + trip.className + '">' +
            '<span class="pickup-wx-panel__verdict-dot" aria-hidden="true"></span>' +
            escapeWx(trip.label) +
          '</div>' +
          '<div class="' + splitClass + '">' + weekendRows + '</div>' +
          '<div class="pickup-wx-panel__foot">Updated ' + escapeWx(updated) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function weekendDayCard(shortName, day) {
    var kind = weatherKindFromCode(day.code);
    var icon = weatherIconMeta(kind);
    var rain = Math.round(Number(day.rain || 0));
    var wind = Math.round(Number(day.wind || 0));
    var st = tripStatusFromRainAndCode(rain, day.code);
    return (
      '<div class="pickup-wx-split-day pickup-wx-split-day--' + kind + '">' +
        '<span class="pickup-wx-split-day__name">' + escapeWx(shortName) + '</span>' +
        '<span class="pickup-wx-split-day__icon pickup-wx-split-day__icon--' + kind + '" aria-hidden="true">' + weatherIconHtml(icon) + '</span>' +
        '<span class="pickup-wx-split-day__temp">' + Math.round(day.max || 0) + '°</span>' +
        '<div class="pickup-wx-split-day__stats">' +
          '<span class="pickup-wx-split-day__stat" title="Rain chance"><i class="fas fa-droplet"></i> ' + rain + '%</span>' +
          '<span class="pickup-wx-split-day__stat" title="Wind"><i class="fas fa-wind"></i> ' + wind + '</span>' +
          '<span class="pickup-wx-split-day__status pickup-wx-split-day__status--' + st.key.toLowerCase() + '">' + escapeWx(st.key) + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function escapeWx(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function paint(el, forecast, loc) {
    if (!el) return;
    el.innerHTML = forecast ? renderWidgetHtml(forecast, loc) : renderFallbackHtml();
  }

  global.AYLEN_WEATHER = {
    REFRESH_MS: REFRESH_MS,
    nextWeekendDates: nextWeekendDates,
    pickupWeatherDays: pickupWeatherDays,
    weatherKindFromCode: weatherKindFromCode,
    weatherIconMeta: weatherIconMeta,
    tripStatusFromRainAndCode: tripStatusFromRainAndCode,
    worstTripStatus: worstTripStatus,
    forecastFromStored: forecastFromStored,
    fetchLiveForecast: fetchLiveForecast,
    weatherUpdatePayload: weatherUpdatePayload,
    renderLoadingHtml: renderLoadingHtml,
    renderFallbackHtml: renderFallbackHtml,
    renderWidgetHtml: renderWidgetHtml,
    paint: paint,
    clearCache: function() { cache = {}; }
  };
})(typeof window !== 'undefined' ? window : global);
