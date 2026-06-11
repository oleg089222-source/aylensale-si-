/**
 * Local storefront performance audit (static weight + HTTP timings).
 * Usage: npm run build && npm run serve (other terminal) && npm run perf
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const baseUrl = process.env.PERF_URL || 'http://127.0.0.1:8888/';

function fmtBytes(n) {
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

function statSafe(rel) {
  const full = path.join(publicDir, rel.replace(/^\//, ''));
  if (!fs.existsSync(full)) return null;
  return fs.statSync(full).size;
}

function extractAssets(html) {
  const css = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((m) => m[1].split('?')[0]);
  const js = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1].split('?')[0]);
  return { css: [...new Set(css)], js: [...new Set(js)] };
}

async function fetchTiming(url) {
  const started = performance.now();
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const body = await res.arrayBuffer();
    const ms = performance.now() - started;
    return {
      ok: res.ok,
      status: res.status,
      ms: Math.round(ms),
      bytes: body.byteLength,
      ttfb: ms
    };
  } catch (err) {
    return { ok: false, error: err.message, ms: Math.round(performance.now() - started) };
  }
}

const indexPath = path.join(publicDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('Run npm run build first — public/index.html missing');
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');
const assets = extractAssets(html);
const rows = [];

for (const rel of [ 'index.html', ...assets.css, ...assets.js ]) {
  if (!rel || rel.startsWith('http')) continue;
  const size = statSafe(rel);
  if (size != null) rows.push({ rel, size, kind: rel.endsWith('.css') ? 'css' : rel.endsWith('.js') ? 'js' : 'html' });
}

rows.sort((a, b) => b.size - a.size);

const totalJs = rows.filter((r) => r.kind === 'js').reduce((s, r) => s + r.size, 0);
const totalCss = rows.filter((r) => r.kind === 'css').reduce((s, r) => s + r.size, 0);
const htmlSize = rows.find((r) => r.rel === 'index.html')?.size || 0;

console.log('\n=== AYLENSALE perf audit ===');
console.log('Public bundle (uncompressed):');
console.log('  HTML:', fmtBytes(htmlSize));
console.log('  CSS :', fmtBytes(totalCss), '(' + assets.css.length + ' files)');
console.log('  JS  :', fmtBytes(totalJs), '(' + assets.js.length + ' files)');
console.log('  Total referenced:', fmtBytes(htmlSize + totalCss + totalJs));

console.log('\nTop 12 largest assets:');
rows.slice(0, 12).forEach((r, i) => {
  console.log('  ' + String(i + 1).padStart(2) + '.', fmtBytes(r.size).padStart(9), r.rel);
});

console.log('\nHTTP timings →', baseUrl);
const home = await fetchTiming(baseUrl);
if (home.ok) {
  console.log('  Homepage:', home.ms + 'ms', fmtBytes(home.bytes));
} else {
  console.log('  Homepage: unavailable (' + (home.error || ('HTTP ' + home.status)) + ')');
  console.log('  Tip: run `npm run serve` in another terminal, then `npm run perf` again.');
}

const critical = [
  baseUrl,
  new URL('css/storefront-shell-critical.bundle.css', baseUrl).href,
  new URL('js/storefront-core.bundle.js', baseUrl).href,
  new URL('js/storefront-catalog-api.js', baseUrl).href,
  new URL('js/storefront-actions.js', baseUrl).href,
  new URL('js/storefront-icons.js', baseUrl).href
];

if (home.ok) {
  console.log('\nCritical path (sequential fetch simulation):');
  let sum = 0;
  for (const url of critical) {
    const t = await fetchTiming(url);
    if (t.ok) {
      sum += t.ms;
      console.log('  ', t.ms + 'ms', fmtBytes(t.bytes).padStart(9), url.replace(baseUrl, ''));
    }
  }
  console.log('  Estimated sequential total:', sum + 'ms');
}

const budget = {
  js: 900 * 1024,
  css: 350 * 1024,
  html: 120 * 1024
};

console.log('\nBudget check (storefront first paint helpers):');
console.log('  JS ', totalJs <= budget.js ? 'OK' : 'HIGH', fmtBytes(totalJs), '/ budget', fmtBytes(budget.js));
console.log('  CSS', totalCss <= budget.css ? 'OK' : 'HIGH', fmtBytes(totalCss), '/ budget', fmtBytes(budget.css));
console.log('  HTML', htmlSize <= budget.html ? 'OK' : 'HIGH', fmtBytes(htmlSize), '/ budget', fmtBytes(budget.html));

console.log('\nVIP paywall page (public/):');
const vipPath = path.join(publicDir, 'vip-stock.html');
if (fs.existsSync(vipPath)) {
  const vipHtml = fs.readFileSync(vipPath, 'utf8');
  const vipAssets = extractAssets(vipHtml);
  let vipTotal = fs.statSync(vipPath).size;
  [...vipAssets.css, ...vipAssets.js].forEach((rel) => {
    const s = statSafe(rel);
    if (s != null) vipTotal += s;
  });
  console.log('  Referenced weight:', fmtBytes(vipTotal), '(' + vipAssets.css.length + ' css, ' + vipAssets.js.length + ' js)');
} else {
  console.log('  vip-stock.html missing');
}

console.log('\nDone. For full Lighthouse: npx lighthouse ' + baseUrl + ' --only-categories=performance --view\n');
