/**
 * Phase 6.1 — inline CLS guard for bottom-nav dock + body padding tokens.
 * Usage: npm run audit:phase6-1
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

const clsZero = html.match(/id="aylen-cls-zero"[^>]*>([\s\S]*?)<\/style>/);
const clsBlock = clsZero ? clsZero[1] : '';

checks.push(
  clsBlock.includes('--aylen-page-pad-bottom') && clsBlock.includes('--aylen-bottom-nav-h:58px')
    ? pass('cls-zero-tokens', '58px nav + page pad token')
    : fail('cls-zero-tokens', 'missing aligned tokens')
);

checks.push(
  clsBlock.includes('.bottom-nav{') && clsBlock.includes('bottom:0') && clsBlock.includes('transform:none')
    ? pass('cls-zero-dock-nav', 'dock layout in first inline CSS')
    : fail('cls-zero-dock-nav', 'pill nav or missing dock rules')
);

checks.push(
  clsBlock.includes('padding-bottom:var(--aylen-page-pad-bottom)')
    ? pass('cls-zero-body-pad', 'tokenized body padding')
    : fail('cls-zero-body-pad', 'hardcoded padding')
);

checks.push(
  !html.includes('padding-bottom:calc(94px + env(safe-area-inset-bottom')
    ? pass('no-hardcoded-body-inline', 'removed inline 94px pad')
    : fail('no-hardcoded-body-inline', 'legacy inline padding remains')
);

const criticalBlock = html.match(/id="aylen-storefront-critical"[^>]*>([\s\S]*?)<\/style>/);
const critical = criticalBlock ? criticalBlock[1] : '';
checks.push(
  critical.includes('bottom:0') && critical.includes('transform:none') && critical.includes('--aylen-bottom-nav-h:58px')
    ? pass('critical-dock-nav', 'critical block matches dock + tokens')
    : fail('critical-dock-nav', 'critical nav/tokens mismatch')
);

const guardPath = path.join(root, 'css', 'storefront-cls-guard.css');
if (fs.existsSync(guardPath)) {
  const guard = fs.readFileSync(guardPath, 'utf8');
  checks.push(
    guard.includes('--aylen-page-pad-bottom') && guard.includes('.bottom-nav') && guard.includes('bottom: 0')
      ? pass('cls-guard-css', 'storefront-cls-guard.css synced')
      : fail('cls-guard-css', 'cls guard file incomplete')
  );
}

const summary = {
  pass: checks.filter(function(c) { return c.status === 'PASS'; }).length,
  fail: checks.filter(function(c) { return c.status === 'FAIL'; }).length,
  total: checks.length
};

const report = {
  ok: summary.fail === 0,
  phase: '6.1',
  url: url,
  checkedAt: new Date().toISOString(),
  checks: checks,
  summary: summary
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
