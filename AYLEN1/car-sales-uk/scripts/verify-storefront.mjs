/**
 * Cross-device storefront verification — mobile/tablet/landscape/desktop + HTTP smoke.
 * Usage: npm run build && npm run verify:storefront
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.VERIFY_URL || 'https://aylensale.com/';
const reportsDir = path.join(root, '.perf-reports');

const LH_PROFILES = [
  {
    label: 'mobile-portrait',
    formFactor: 'mobile',
    mobile: true,
    width: 412,
    height: 823,
    dpr: 2.625,
    cpu: 4
  },
  {
    label: 'mobile-landscape',
    formFactor: 'mobile',
    mobile: true,
    width: 823,
    height: 412,
    dpr: 2.625,
    cpu: 4
  },
  {
    label: 'tablet-portrait',
    formFactor: 'mobile',
    mobile: false,
    width: 768,
    height: 1024,
    dpr: 2,
    cpu: 2
  },
  {
    label: 'tablet-landscape',
    formFactor: 'mobile',
    mobile: false,
    width: 1024,
    height: 768,
    dpr: 2,
    cpu: 2
  },
  {
    label: 'desktop',
    formFactor: 'desktop',
    mobile: false,
    cpu: 1
  }
];

function runLighthouse(profile) {
  const out = path.join(reportsDir, 'lh-verify-' + profile.label + '.json');
  const args = [
    url,
    '--only-categories=performance',
    '--form-factor=' + profile.formFactor,
    '--throttling.cpuSlowdownMultiplier=' + (profile.cpu || 1),
    '--quiet',
    '--output=json',
    '--output-path=' + out,
    '--chrome-flags=--headless --no-sandbox'
  ];

  if (profile.formFactor === 'mobile') {
    args.push(profile.mobile ? '--screenEmulation.mobile' : '--screenEmulation.disabled');
  } else {
    args.push('--screenEmulation.disabled');
  }

  if (profile.width && profile.height) {
    args.push(
      '--screenEmulation.width=' + profile.width,
      '--screenEmulation.height=' + profile.height
    );
    if (profile.dpr) {
      args.push('--screenEmulation.deviceScaleFactor=' + profile.dpr);
    }
  }

  const res = spawnSync('npx', ['--yes', 'lighthouse', ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env
  });
  if (res.status !== 0) {
    console.error('Lighthouse failed:', profile.label);
    return null;
  }
  const data = JSON.parse(fs.readFileSync(out, 'utf8'));
  const a = data.audits;
  return {
    label: profile.label,
    perf: Math.round(data.categories.performance.score * 100),
    fcp: a['first-contentful-paint'].displayValue,
    lcp: a['largest-contentful-paint'].displayValue,
    cls: a['cumulative-layout-shift'].displayValue,
    tbt: a['total-blocking-time'].displayValue
  };
}

async function httpChecks() {
  const checks = [];
  const pages = ['/'];
  for (const page of pages) {
    const pageUrl = new URL(page, url).href;
    const started = performance.now();
    const res = await fetch(pageUrl, { redirect: 'follow' });
    const html = await res.text();
    const ms = Math.round(performance.now() - started);
    checks.push({
      page,
      status: res.status,
      ms,
      hasCoreBundle: html.includes('storefront-core.bundle.js'),
      hasFirebaseLoader: html.includes('firebase-loader.js'),
      hasCatalogBootstrap: html.includes('aylen-catalog-bootstrap'),
      hasSrcsetReady: html.includes('productCardImageSrcset') || html.includes('storefront-core.bundle.js'),
      noStorageOnBoot: !html.includes('firebase-storage-compat.js')
    });
  }
  return checks;
}

if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

console.log('\n=== AYLENSALE storefront verify ===');
console.log('URL:', url);

const http = await httpChecks();
console.log('\nHTTP smoke:');
http.forEach(function(row) {
  const ok = row.status === 200 && row.hasCoreBundle && row.hasFirebaseLoader;
  console.log(
    (ok ? '  OK' : ' FAIL'),
    row.page,
    row.status,
    row.ms + 'ms',
    'bootstrap=' + row.hasCatalogBootstrap,
    'no-storage=' + row.noStorageOnBoot
  );
});

console.log('\nLighthouse:');
const results = [];
for (const profile of LH_PROFILES) {
  const row = runLighthouse(profile);
  if (row) results.push(row);
  if (row) {
    console.log(
      ' ',
      row.label + ':',
      'perf=' + row.perf,
      'FCP=' + row.fcp,
      'LCP=' + row.lcp,
      'CLS=' + row.cls,
      'TBT=' + row.tbt
    );
  }
}

let failed = false;
http.forEach(function(row) {
  if (row.status !== 200 || !row.hasCoreBundle) failed = true;
});

const mobilePortrait = results.find(function(r) { return r.label === 'mobile-portrait'; });
const mobileLandscape = results.find(function(r) { return r.label === 'mobile-landscape'; });
const tabletPortrait = results.find(function(r) { return r.label === 'tablet-portrait'; });

if (mobilePortrait && mobilePortrait.cls && parseFloat(mobilePortrait.cls) > 0.1) {
  console.warn('WARN: mobile-portrait CLS above 0.1:', mobilePortrait.cls);
}
if (mobileLandscape && mobileLandscape.cls && parseFloat(mobileLandscape.cls) > 0.15) {
  console.warn('WARN: mobile-landscape CLS above 0.15:', mobileLandscape.cls);
}
if (tabletPortrait && tabletPortrait.cls && parseFloat(tabletPortrait.cls) > 0.15) {
  console.warn('WARN: tablet-portrait CLS above 0.15:', tabletPortrait.cls);
}

if (!mobilePortrait || !mobileLandscape || !tabletPortrait || !results.find(function(r) { return r.label === 'desktop'; })) {
  failed = true;
}

if (failed) process.exit(1);
console.log('\nverify-storefront OK — mobile, landscape, tablet, desktop');
