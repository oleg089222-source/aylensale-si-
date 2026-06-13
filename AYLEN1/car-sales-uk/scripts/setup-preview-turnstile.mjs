#!/usr/bin/env node
/**
 * Verify Preview Turnstile uses Cloudflare dummy keys (any hostname).
 * Production TURNSTILE_SITE_KEY is unchanged — only VERCEL_ENV=preview switches keys in code.
 *
 * Usage:
 *   PREVIEW_URL=https://xxx.vercel.app node scripts/setup-preview-turnstile.mjs
 *   node scripts/setup-preview-turnstile.mjs --deploy
 */
import { spawnSync } from 'node:child_process';
import { projectRoot } from './lib/load-env.mjs';

const args = new Set(process.argv.slice(2));
const shouldDeploy = args.has('--deploy');

const PREVIEW_SITE = '1x00000000000000000000AA';

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts
  });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim();
    throw new Error(`${cmd} ${cmdArgs.join(' ')} failed: ${err}`);
  }
  return (res.stdout || '').trim();
}

async function main() {
  console.log('\n=== Preview Turnstile (code-based test keys) ===\n');
  console.log('Preview uses Cloudflare dummy site/secret keys when VERCEL_ENV=preview.');
  console.log('Production hostnames (aylensale.com) stay on TURNSTILE_SITE_KEY env.\n');

  let previewUrl = (process.env.PREVIEW_URL || '').replace(/\/$/, '');
  if (shouldDeploy) {
    console.log('Deploying Preview...');
    const out = run('npx', ['vercel', 'deploy', '--yes']);
    const m = out.match(/https:\/\/car-sales-[a-z0-9-]+\.vercel\.app/);
    if (m) previewUrl = m[0];
    console.log('Deployed:', previewUrl);
  }

  if (!previewUrl) {
    const dep = run('npx', ['vercel', 'ls', '--yes']);
    const m = dep.match(/https:\/\/car-sales-[a-z0-9-]+\.vercel\.app/);
    previewUrl = m ? m[0] : '';
  }
  if (!previewUrl) {
    throw new Error('Set PREVIEW_URL or pass --deploy');
  }

  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
  const headers = bypass ? ['-H', `x-vercel-protection-bypass: ${bypass}`] : [];
  const cfgText = run('curl', ['-sS', ...headers, `${previewUrl}/api/spam-config`]);
  const cfg = JSON.parse(cfgText);

  if (!cfg.previewTurnstile) {
    throw new Error('previewTurnstile not true — redeploy required');
  }
  if (cfg.turnstileSiteKey !== PREVIEW_SITE) {
    throw new Error(`Expected test site key ${PREVIEW_SITE}, got ${cfg.turnstileSiteKey}`);
  }

  const prodCfg = JSON.parse(run('curl', ['-sS', 'https://aylensale.com/api/spam-config']));
  if (prodCfg.turnstileSiteKey === PREVIEW_SITE) {
    throw new Error('Production must not use preview test site key');
  }

  console.log('Preview spam-config OK');
  console.log('  turnstileSiteKey:', cfg.turnstileSiteKey);
  console.log('  previewTurnstile:', cfg.previewTurnstile);
  console.log('Production site key unchanged:', prodCfg.turnstileSiteKey);
  console.log('\nURL:', previewUrl);
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
