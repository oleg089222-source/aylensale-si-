/**
 * Phase 4 — production PageSpeed validation (Phases 1–3 regression guard).
 * Usage: npm run build && npm run perf:prod
 *        PERF_URL=https://aylensale.com npm run perf:prod
 */
const base = (process.env.PERF_URL || process.env.VERIFY_URL || 'https://aylensale.com').replace(/\/?$/, '/');
const origin = new URL(base).origin;

const BUDGET = {
  htmlKb: 180,
  criticalCssKb: 80,
  deferredCssKb: 160,
  coreJsKb: 280,
  totalFirstPaintKb: 650
};

function kb(n) {
  return Math.round(n / 1024);
}

function pass(name, ok, detail) {
  return { name, status: ok ? 'PASS' : 'FAIL', detail: detail || '' };
}

async function fetchText(url, opts) {
  const res = await fetch(url, { redirect: 'follow', ...opts });
  const text = await res.text();
  return { res, text, url };
}

async function head(url) {
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  return res;
}

function cacheSummary(res) {
  return res.headers.get('cache-control') || '(none)';
}

async function assetSize(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) return { ok: false, status: res.status, bytes: 0 };
  const buf = await res.arrayBuffer();
  return { ok: true, status: res.status, bytes: buf.byteLength };
}

const checks = [];

try {
  const home = await fetchText(base);
  checks.push(pass('homepage-http', home.res.ok, 'HTTP ' + home.res.status));

  const html = home.text;
  const buildMatch = html.match(/aylen-build" content="(\d+)"/);
  const build = buildMatch ? buildMatch[1] : '';
  checks.push(pass('build-version', !!build, build || 'missing'));

  checks.push(pass(
    'no-cdnjs-preconnect',
    !html.includes('cdnjs.cloudflare.com'),
    html.includes('cdnjs.cloudflare.com') ? 'cdnjs hint still present' : 'removed'
  ));

  checks.push(pass(
    'no-font-awesome-css',
    !html.includes('font-awesome'),
    html.includes('font-awesome') ? 'FA reference in HTML' : 'none'
  ));

  checks.push(pass(
    'ssr-picture',
    html.includes('<picture class="product-card-picture"') || html.includes('<picture'),
    html.includes('<picture') ? 'picture in SSR' : 'no picture'
  ));

  checks.push(pass(
    'event-delegation',
    html.includes('data-action=') && html.includes('storefront-actions.js'),
    'data-action + actions script'
  ));

  checks.push(pass(
    'svg-icons',
    html.includes('storefront-icons.js'),
    'inline SVG loader present'
  ));

  checks.push(pass(
    'defer-firebase',
    html.includes('defer-firebase') && html.includes('firebase-loader.js'),
    'deferred Firebase loader'
  ));

  const htmlCache = cacheSummary(home.res);
  checks.push(pass(
    'html-cache',
    /max-age=3600|stale-while-revalidate/i.test(htmlCache),
    htmlCache
  ));

  const coreMatch = html.match(/storefront-core\.bundle\.js\?v=(\d+)/);
  const cssMatch = html.match(/storefront-shell-critical\.bundle\.css\?v=(\d+)/);
  if (coreMatch && build && coreMatch[1] !== build) {
    checks.push(pass('asset-version-sync', false, 'core js v=' + coreMatch[1] + ' vs build ' + build));
  } else {
    checks.push(pass('asset-version-sync', !build || !!coreMatch, build ? 'aligned' : 'n/a'));
  }

  if (cssMatch) {
    const cssUrl = new URL('css/storefront-shell-critical.bundle.css?v=' + cssMatch[1], base).href;
    const cssHead = await head(cssUrl);
    const cssCache = cacheSummary(cssHead);
    checks.push(pass(
      'css-cache-immutable',
      /immutable|max-age=31536000/i.test(cssCache),
      cssCache
    ));
    const cssSize = await assetSize(cssUrl);
    checks.push(pass(
      'critical-css-budget',
      cssSize.ok && kb(cssSize.bytes) <= BUDGET.criticalCssKb,
      kb(cssSize.bytes) + ' KB / ' + BUDGET.criticalCssKb + ' KB'
    ));
  }

  if (coreMatch) {
    const jsUrl = new URL('js/storefront-core.bundle.js?v=' + coreMatch[1], base).href;
    const jsHead = await head(jsUrl);
    checks.push(pass(
      'js-cache-immutable',
      /immutable|max-age=31536000/i.test(cacheSummary(jsHead)),
      cacheSummary(jsHead)
    ));
    const jsSize = await assetSize(jsUrl);
    checks.push(pass(
      'core-js-budget',
      jsSize.ok && kb(jsSize.bytes) <= BUDGET.coreJsKb,
      kb(jsSize.bytes) + ' KB / ' + BUDGET.coreJsKb + ' KB'
    ));
  }

  const apiHead = await head(new URL('api/storefront-catalog', base).href);
  checks.push(pass(
    'api-no-store',
    /no-cache|must-revalidate/i.test(cacheSummary(apiHead)),
    cacheSummary(apiHead)
  ));

  const sw = await fetchText(new URL('sw.js', base).href);
  checks.push(pass(
    'sw-cache-first',
    sw.text.includes('cacheFirst') && sw.text.includes('aylen-pwa-v'),
    sw.text.match(/aylen-pwa-v\d+/)?.[0] || 'unknown version'
  ));

  checks.push(pass(
    'sw-precache-bundles',
    sw.text.includes('storefront-core.bundle.js') && sw.text.includes('storefront-actions.js'),
    'critical bundles in precache list'
  ));

  const deferredMatch = html.match(/storefront-shell-deferred\.bundle\.css\?v=(\d+)/);
  if (deferredMatch) {
    const defUrl = new URL('css/storefront-shell-deferred.bundle.css?v=' + deferredMatch[1], base).href;
    const defFetch = await fetchText(defUrl);
    checks.push(pass(
      'deferred-no-fa',
      !defFetch.text.includes('Font Awesome') && !defFetch.text.includes('fa-solid-900'),
      defFetch.text.includes('Font Awesome') ? 'FA still in deferred CSS' : 'clean'
    ));
    checks.push(pass(
      'deferred-css-budget',
      kb(defFetch.text.length) <= BUDGET.deferredCssKb,
      kb(defFetch.text.length) + ' KB / ' + BUDGET.deferredCssKb + ' KB'
    ));
  }

  const catalogApi = await fetch(new URL('api/storefront-catalog?limit=18', base).href);
  checks.push(pass('catalog-api', catalogApi.ok, 'HTTP ' + catalogApi.status));
  if (catalogApi.ok) {
    const payload = await catalogApi.json();
    checks.push(pass(
      'catalog-products',
      payload.ok && Array.isArray(payload.products?.items) && payload.products.items.length >= 1,
      String(payload.products?.items?.length || 0) + ' products'
    ));
  }

  const thumbGet = await fetch(new URL(
    'api/image-thumb?w=176&h=176&q=52&fmt=webp&url=' + encodeURIComponent('https://firebasestorage.googleapis.com/v0/b/x/o/x?alt=media'),
    base
  ).href);
  checks.push(pass(
    'image-thumb-endpoint',
    thumbGet.status === 400 || thumbGet.status === 403 || thumbGet.status === 404 || thumbGet.status === 502,
    'endpoint reachable (HTTP ' + thumbGet.status + ')'
  ));

  checks.push(pass(
    'html-size-budget',
    kb(html.length) <= BUDGET.htmlKb,
    kb(html.length) + ' KB / ' + BUDGET.htmlKb + ' KB'
  ));
} catch (err) {
  checks.push(pass('pagespeed-prod-audit', false, String(err.message || err)));
}

const failed = checks.filter(function(c) { return c.status === 'FAIL'; });
const report = {
  ok: failed.length === 0,
  url: base,
  origin: origin,
  phase: 4,
  checkedAt: new Date().toISOString(),
  checks: checks,
  summary: {
    pass: checks.filter(function(c) { return c.status === 'PASS'; }).length,
    fail: failed.length,
    total: checks.length
  }
};

console.log(JSON.stringify(report, null, 2));
process.exit(failed.length ? 1 : 0);
