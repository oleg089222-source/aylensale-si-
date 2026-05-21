/**
 * Performance helpers — defer heavy features until idle / pause when admin is open.
 */
(function(global) {
  var engagementStarted = false;
  var engagementPaused = false;
  var deferredEngagement = null;

  function pauseEngagement() {
    engagementPaused = true;
    if (global.presenceInterval) {
      clearInterval(global.presenceInterval);
      global.presenceInterval = null;
    }
  }

  function resumeEngagement() {
    if (engagementPaused) {
      engagementPaused = false;
      if (!engagementStarted && typeof startEngagementTracking === 'function') {
        startEngagementTracking();
        engagementStarted = true;
      }
    }
  }

  function scheduleEngagement() {
    if (engagementStarted || engagementPaused) return;
    var run = function() {
      if (global.isAdminMode && global.AyelenAdminDashboard && global.AyelenAdminDashboard.isOpen()) return;
      if (typeof startEngagementTracking === 'function') {
        startEngagementTracking();
        engagementStarted = true;
      }
    };
    if ('requestIdleCallback' in global) {
      deferredEngagement = global.requestIdleCallback(run, { timeout: 8000 });
    } else {
      deferredEngagement = setTimeout(run, 5000);
    }
  }

  function enableLiteStorefront() {
    document.documentElement.classList.add('perf-lite');
    if (typeof initSmoothReveal === 'function' && global.matchMedia && global.matchMedia('(max-width: 1024px)').matches) {
      document.documentElement.classList.remove('motion-ready');
    }
  }

  global.AYLEN_PERF = {
    scheduleEngagement: scheduleEngagement,
    pauseEngagement: pauseEngagement,
    resumeEngagement: resumeEngagement,
    enableLiteStorefront: enableLiteStorefront
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enableLiteStorefront);
  } else {
    enableLiteStorefront();
  }
})(window);
