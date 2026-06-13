/**
 * Phase 5 — Lighthouse prod audit with regression thresholds.
 * Usage: npm run audit:lighthouse
 *        PERF_URL=https://aylensale.com npm run audit:lighthouse
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.PERF_URL || process.env.VERIFY_URL || 'https://aylensale.com/';
const reportsDir = path.join(root, '.perf-reports');

const THRESHOLDS = {
  performanceMin: Number(process.env.LH_PERF_MIN || 80),
  clsMax: Number(process.env.LH_CLS_MAX || 0.1),
  lcpMsMax: Number(process.env.LH_LCP_MS_MAX || 3000),
  desktopPerformanceMin: Number(process.env.LH_DESKTOP_PERF_MIN || 70),
  desktopClsMax: Number(process.env.LH_DESKTOP_CLS_MAX || 0.35)
};

const PROFILES = [
  {
    label: 'mobile',
    formFactor: 'mobile',
    mobile: true,
    width: 412,
    height: 823,
    dpr: 2.625,
    cpu: 4
  },
  {
    label: 'desktop',
    formFactor: 'desktop',
    mobile: false,
    cpu: 1
  }
];

function parseMs(display) {
  if (!display) return null;
  var m = String(display).match(/([\d.]+)\s*s/);
  if (m) return Math.round(parseFloat(m[1]) * 1000);
  m = String(display).match(/([\d.]+)\s*ms/);
  if (m) return Math.round(parseFloat(m[1]));
  return null;
}

function parseCls(display) {
  if (!display) return null;
  var n = parseFloat(String(display).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function runProfile(profile) {
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  var stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  var out = path.join(reportsDir, 'lh-phase5-' + profile.label + '-' + stamp + '.json');
  var args = [
    url,
    '--only-categories=performance',
    '--form-factor=' + profile.formFactor,
    '--throttling.cpuSlowdownMultiplier=' + (profile.cpu || 1),
    '--quiet',
    '--output=json',
    '--output-path=' + out,
    '--chrome-flags=--headless --no-sandbox --disable-gpu'
  ];

  if (profile.formFactor === 'mobile') {
    args.push(profile.mobile ? '--screenEmulation.mobile' : '--screenEmulation.disabled');
    if (profile.width && profile.height) {
      args.push(
        '--screenEmulation.width=' + profile.width,
        '--screenEmulation.height=' + profile.height
      );
      if (profile.dpr) args.push('--screenEmulation.deviceScaleFactor=' + profile.dpr);
    }
  } else {
    args.push('--screenEmulation.disabled');
  }

  var res = spawnSync('npx', ['--yes', 'lighthouse', ...args], {
    cwd: root,
    stdio: 'pipe',
    env: process.env
  });

  if (res.status !== 0) {
    return {
      label: profile.label,
      ok: false,
      error: (res.stderr && res.stderr.toString()) || 'lighthouse exit ' + res.status
    };
  }

  var data = JSON.parse(fs.readFileSync(out, 'utf8'));
  var audits = data.audits || {};
  var perf = Math.round((data.categories.performance.score || 0) * 100);
  var lcpMs = parseMs(audits['largest-contentful-paint'] && audits['largest-contentful-paint'].displayValue);
  var cls = parseCls(audits['cumulative-layout-shift'] && audits['cumulative-layout-shift'].displayValue);
  var fcp = audits['first-contentful-paint'] && audits['first-contentful-paint'].displayValue;
  var tbt = audits['total-blocking-time'] && audits['total-blocking-time'].displayValue;

  var perfMin = profile.label === 'desktop' ? THRESHOLDS.desktopPerformanceMin : THRESHOLDS.performanceMin;
  var clsMax = profile.label === 'desktop' ? THRESHOLDS.desktopClsMax : THRESHOLDS.clsMax;

  var checks = [];
  checks.push({ name: 'performance-score', ok: perf >= perfMin, detail: perf + ' / min ' + perfMin });
  if (cls != null) {
    checks.push({ name: 'cls', ok: cls <= clsMax, detail: cls + ' / max ' + clsMax });
  }
  if (lcpMs != null && profile.label !== 'desktop') {
    checks.push({ name: 'lcp', ok: lcpMs <= THRESHOLDS.lcpMsMax, detail: lcpMs + 'ms / max ' + THRESHOLDS.lcpMsMax + 'ms' });
  }

  var required = profile.label === 'mobile';

  return {
    label: profile.label,
    required: required,
    ok: checks.every(function(c) { return c.ok; }),
    reportPath: out,
    perf: perf,
    fcp: fcp,
    lcp: audits['largest-contentful-paint'] && audits['largest-contentful-paint'].displayValue,
    cls: audits['cumulative-layout-shift'] && audits['cumulative-layout-shift'].displayValue,
    tbt: tbt,
    checks: checks
  };
}

const results = [];
for (var i = 0; i < PROFILES.length; i++) {
  results.push(runProfile(PROFILES[i]));
}

var report = {
  ok: results.filter(function(r) { return r.required; }).every(function(r) { return r.ok; }),
  phase: 5,
  url: url,
  checkedAt: new Date().toISOString(),
  thresholds: THRESHOLDS,
  profiles: results,
  warnings: results.filter(function(r) { return !r.required && !r.ok; }).map(function(r) { return r.label + ' advisory failed'; })
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
