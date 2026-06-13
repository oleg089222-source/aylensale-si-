/**
 * Real User Metrics — LCP / CLS / INP to GA4 when analytics consent is granted.
 */
(function(global) {
  'use strict';

  var started = false;

  function canSend() {
    return typeof global.gtag === 'function';
  }

  function send(name, value, rating) {
    if (!canSend()) return;
    global.gtag('event', name, {
      event_category: 'Web Vitals',
      event_label: rating || 'unknown',
      value: Math.round(name === 'CLS' ? value * 1000 : value),
      metric_value: value,
      non_interaction: true
    });
  }

  function ratingLcp(ms) {
    if (ms <= 2500) return 'good';
    if (ms <= 4000) return 'needs-improvement';
    return 'poor';
  }

  function ratingCls(score) {
    if (score <= 0.1) return 'good';
    if (score <= 0.25) return 'needs-improvement';
    return 'poor';
  }

  function ratingInp(ms) {
    if (ms <= 200) return 'good';
    if (ms <= 500) return 'needs-improvement';
    return 'poor';
  }

  function observeLcp() {
    if (!('PerformanceObserver' in global)) return;
    try {
      var po = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        var last = entries[entries.length - 1];
        if (!last) return;
        send('LCP', last.startTime, ratingLcp(last.startTime));
      });
      po.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}
  }

  function observeCls() {
    if (!('PerformanceObserver' in global)) return;
    var cls = 0;
    try {
      var po = new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          if (!entry.hadRecentInput) cls += entry.value;
        });
      });
      po.observe({ type: 'layout-shift', buffered: true });
      global.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
          send('CLS', cls, ratingCls(cls));
        }
      }, { once: true });
    } catch (e) {}
  }

  function observeInp() {
    if (!('PerformanceObserver' in global)) return;
    try {
      var po = new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          if (entry.duration) send('INP', entry.duration, ratingInp(entry.duration));
        });
      });
      po.observe({ type: 'event', buffered: true, durationThreshold: 16 });
    } catch (e) {}
  }

  function init() {
    if (started) return;
    started = true;
    observeLcp();
    observeCls();
    observeInp();
  }

  global.AYLEN_WEB_VITALS = {
    init: init
  };

  if (global.AYLEN_COMPLIANCE && global.AYLEN_COMPLIANCE.readConsent) {
    var existing = global.AYLEN_COMPLIANCE.readConsent();
    if (existing && existing.analytics) init();
  }

  var priorApply = null;
  if (global.AYLEN_COMPLIANCE) {
    global.addEventListener('aylen-analytics-ready', init, { once: true });
  }
})(typeof window !== 'undefined' ? window : globalThis);
