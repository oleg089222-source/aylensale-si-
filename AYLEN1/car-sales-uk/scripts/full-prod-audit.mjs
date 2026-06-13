/**
 * Phase 5 — full production audit (functional + pagespeed + optional P0 + lighthouse).
 * Usage: npm run audit:prod
 *        ADMIN_PASSWORD=... RUN_LIGHTHOUSE=1 npm run audit:prod
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runStep(name, cmd, args) {
  var res = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'pipe',
    env: process.env,
    encoding: 'utf8'
  });
  var stdout = res.stdout || '';
  var stderr = res.stderr || '';
  var summary = null;
  try {
    summary = JSON.parse(stdout);
  } catch (e) {}
  return {
    name: name,
    ok: res.status === 0,
    exitCode: res.status,
    summary: summary,
    stderr: stderr.trim().slice(0, 500)
  };
}

const steps = [
  runStep('functional-audit', process.execPath, ['scripts/functional-audit.mjs']),
  runStep('pagespeed-prod-audit', process.execPath, ['scripts/pagespeed-prod-audit.mjs'])
];

if (process.env.ADMIN_PASSWORD) {
  steps.push(runStep('p0-prod-audit', process.execPath, ['scripts/p0-prod-audit.mjs']));
}

if (process.env.RUN_LIGHTHOUSE === '1' || process.env.RUN_LIGHTHOUSE === 'true') {
  steps.push(runStep('lighthouse-prod-audit', process.execPath, ['scripts/lighthouse-prod-audit.mjs']));
}

if (process.env.RUN_PHASE6 === '1' || process.env.RUN_PHASE6 === 'true') {
  steps.push(runStep('pagespeed-phase6-audit', process.execPath, ['scripts/pagespeed-phase6-audit.mjs']));
}

if (process.env.RUN_PHASE6_1 === '1' || process.env.RUN_PHASE6_1 === 'true') {
  steps.push(runStep('pagespeed-phase6-1-audit', process.execPath, ['scripts/pagespeed-phase6-1-audit.mjs']));
}

var report = {
  ok: steps.every(function(s) { return s.ok; }),
  phase: 5,
  checkedAt: new Date().toISOString(),
  steps: steps.map(function(s) {
    return {
      name: s.name,
      status: s.ok ? 'PASS' : 'FAIL',
      exitCode: s.exitCode,
      summary: s.summary && s.summary.summary ? s.summary.summary : (s.summary && s.summary.ok != null ? { ok: s.summary.ok } : undefined),
      error: s.ok ? undefined : s.stderr
    };
  })
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
