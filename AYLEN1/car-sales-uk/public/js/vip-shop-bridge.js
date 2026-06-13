/**
 * Auto-apply VIP discount code on main shop when member session is active.
 */
(function(global) {
  async function applyVipDiscountOnShop() {
    if (!global.AYLEN_DISCOUNT || !global.AYLEN_DISCOUNT.validateCode) return false;
    var raw = null;
    try { raw = localStorage.getItem('aylen_vip_session_v1'); } catch (e) { return false; }
    if (!raw) return false;
    var session = null;
    try { session = JSON.parse(raw); } catch (e) { return false; }
    if (!session || !session.accessToken) return false;

    try {
      var res = await fetch('/api/vip-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: session.accessToken })
      });
      var data = await res.json();
      if (!res.ok || data.locked || !data.vip || !data.vip.active) return false;

      var code = (data.settings && data.settings.discountCode) || 'VIPSTOCK';
      var result = await global.AYLEN_DISCOUNT.validateCode(code);
      if (result && result.ok) {
        global.__AYLEN_VIP_SHOP_ACTIVE = true;
        if (typeof global.currentUser !== 'undefined' && result.session) {
          global.currentUser = result.session;
          try { localStorage.setItem('aylenuser', JSON.stringify(result.session)); } catch (e) {}
        }
        if (typeof global.showWelcome === 'function' && result.session) {
          global.showWelcome(result.session);
        }
        if (typeof global.updateDiscountUi === 'function') global.updateDiscountUi(true);
        return true;
      }
    } catch (e) {
      console.warn('[VIP shop bridge]', e.message || e);
    }
    return false;
  }

  global.AYLEN_VIP_SHOP_BRIDGE = { apply: applyVipDiscountOnShop };
})(window);
