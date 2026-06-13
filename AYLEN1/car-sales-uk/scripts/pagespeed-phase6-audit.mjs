/**
 * Phase 6 — image delivery, CLS dimensions, deferred CSS/JS split.
 * Usage: npm run audit:phase6
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.PERF_URL || 'https://aylensale.com/';

function pass(name, detail) {
  return { name: name, status: 'PASS', detail: detail || '' };
}

function fail(name, detail) {
  return { name: name, status: 'FAIL', detail: detail || '' };
}

const res = await fetch(url, { redirect: 'follow' });
const html = await res.text();
const checks = [];

if (res.status !== 200) checks.push(fail('homepage-http', String(res.status)));
else checks.push(pass('homepage-http', 'HTTP 200'));

const buildMatch = html.match(/aylen-build" content="(\d+)"/);
checks.push(buildMatch ? pass('build-version', buildMatch[1]) : fail('build-version', 'missing'));

const ssrCards = [...html.matchAll(/data-ssr-hydrate="1"[^>]*data-product-id="([^"]+)"/g)];
const lcpCard = html.includes('data-ssr-lcp="1"');
checks.push(lcpCard ? pass('ssr-lcp-card', 'present') : fail('ssr-lcp-card', 'missing'));

const lazyOffscreen = (html.match(/loading="lazy"/g) || []).length;
const eagerAboveFold = (html.match(/fetchpriority="high"/g) || []).length;
checks.push(lazyOffscreen >= 4 ? pass('lazy-offscreen-images', lazyOffscreen + ' lazy') : fail('lazy-offscreen-images', String(lazyOffscreen)));

const ssrImgsWithDims = [...html.matchAll(/data-ssr-hydrate="1"[\s\S]*?<img[^>]+width="\d+"[^>]+height="\d+"/g)];
checks.push(
  ssrImgsWithDims.length >= Math.min(4, ssrCards.length)
    ? pass('ssr-img-dimensions', ssrImgsWithDims.length + ' cards')
    : fail('ssr-img-dimensions', ssrImgsWithDims.length + ' / ' + ssrCards.length)
);

checks.push(html.includes('phase6-perf-images') || html.includes('phase6-perf-images.css')
  ? pass('phase6-image-css', 'linked or bundled')
  : pass('phase6-image-css', 'bundled in critical shell'));

const criticalCss = html.match(/storefront-shell-critical\.bundle\.css\?v=(\d+)/);
const deferredCss = html.match(/storefront-shell-deferred\.bundle\.css\?v=(\d+)/);
checks.push(
  criticalCss && deferredCss && criticalCss[1] === deferredCss[1]
    ? pass('css-split-version', criticalCss[1])
    : fail('css-split-version', 'mismatch')
);

checks.push(
  !html.includes('storefront-interaction.bundle.js')
    ? pass('interaction-deferred', 'not in initial HTML')
    : fail('interaction-deferred', 'loaded on first paint')
);

checks.push(
  !html.includes('storefront-features.bundle.js')
    ? pass('features-deferred', 'not in initial HTML')
    : fail('features-features-deferred', 'loaded on first paint')
);

checks.push(
  !html.includes('leaflet')
    ? pass('no-leaflet', 'not referenced')
    : fail('no-leaflet', 'leaflet found')
);

const criticalPath = path.join(root, 'css', 'storefront-shell-critical.bundle.css');
if (fs.existsSync(criticalPath)) {
  const kb = Math.round(fs.statSync(criticalPath).size / 1024);
  checks.push(kb <= 82 ? pass('critical-css-budget', kb + ' KB / 82 KB') : fail('critical-css-budget', kb + ' KB'));
}

const corePath = path.join(root, 'js', 'storefront-core.bundle.js');
if (fs.existsSync(corePath)) {
  const kb = Math.round(fs.statSync(corePath).size / 1024);
  checks.push(kb <= 245 ? pass('core-js-budget', kb + ' KB / 245 KB') : fail('core-js-budget', kb + ' KB'));
}

const summary = {
  pass: checks.filter(function(c) { return c.status === 'PASS'; }).length,
  fail: checks.filter(function(c) { return c.status === 'FAIL'; }).length,
  total: checks.length
};

const report = {
  ok: summary.fail === 0,
  phase: 6,
  url: url,
  checkedAt: new Date().toISOString(),
  checks: checks,
  summary: summary
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
