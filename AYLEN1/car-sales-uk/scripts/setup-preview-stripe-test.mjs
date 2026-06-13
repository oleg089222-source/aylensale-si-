#!/usr/bin/env node
/**
 * Configure Vercel Preview with Stripe TEST keys (Production untouched).
 *
 * Keys source (first match):
 *   STRIPE_TEST_SECRET_KEY + STRIPE_TEST_PUBLISHABLE_KEY + STRIPE_TEST_WEBHOOK_SECRET
 *   or Stripe CLI after `stripe login` (test_mode_api_key / test_mode_pub_key)
 *
 * Usage:
 *   node scripts/setup-preview-stripe-test.mjs
 *   PREVIEW_URL=https://xxx.vercel.app node scripts/setup-preview-stripe-test.mjs --skip-deploy
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadProjectEnv, projectRoot } from './lib/load-env.mjs';

const STRIPE_CLI = process.env.STRIPE_CLI || '/tmp/stripe';
const args = new Set(process.argv.slice(2));
const skipDeploy = args.has('--skip-deploy');

loadProjectEnv();

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

function parseStripeConfig(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([a-z_]+)\s*=\s*['"]?([^'"]+)['"]?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function readStripeCliKeys() {
  if (!existsSync(STRIPE_CLI)) return null;
  try {
    const text = run(STRIPE_CLI, ['config', '--list']);
    const cfg = parseStripeConfig(text);
    if (!cfg.test_mode_api_key || !cfg.test_mode_pub_key) return null;
    return {
      secretKey: cfg.test_mode_api_key,
      publishableKey: cfg.test_mode_pub_key
    };
  } catch (_) {
    return null;
  }
}

function resolveKeys() {
  const fromEnv = {
    secretKey: process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY_TEST || '',
    publishableKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY_TEST || '',
    webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET_TEST || '',
    vipPriceId: process.env.STRIPE_TEST_VIP_PRICE_ID || ''
  };
  if (fromEnv.secretKey.includes('_test_') && fromEnv.publishableKey.includes('_test_')) {
    return fromEnv;
  }
  const cli = readStripeCliKeys();
  if (!cli) return null;
  return {
    secretKey: cli.secretKey,
    publishableKey: cli.publishableKey,
    webhookSecret: fromEnv.webhookSecret,
    vipPriceId: fromEnv.vipPriceId
  };
}

function createTestWebhook(previewUrl, secretKey) {
  const url = `${previewUrl.replace(/\/$/, '')}/api/stripe-webhook`;
  try {
    const out = run(STRIPE_CLI, [
      'webhook_endpoints', 'create',
      '--url', url,
      '-d', 'enabled_events[0]=checkout.session.completed',
      '-d', 'enabled_events[1]=customer.subscription.updated',
      '-d', 'enabled_events[2]=customer.subscription.deleted',
      '-d', 'enabled_events[3]=invoice.payment_failed'
    ], {
      env: { ...process.env, STRIPE_API_KEY: secretKey }
    });
    const parsed = JSON.parse(out);
    if (parsed.secret) return parsed.secret;
  } catch (e) {
    console.warn('webhook create via CLI:', e.message);
  }
  return '';
}

function findTestVipPrice(secretKey) {
  try {
    const out = run(STRIPE_CLI, ['prices', 'list', '--limit', '20', '--active', 'true'], {
      env: { ...process.env, STRIPE_API_KEY: secretKey }
    });
    const parsed = JSON.parse(out);
    const prices = parsed.data || [];
    const sub = prices.find((p) => p.recurring && p.currency === 'gbp');
    return sub ? sub.id : (prices[0] ? prices[0].id : '');
  } catch (_) {
    return '';
  }
}

function upsertPreviewEnv(name, value) {
  try {
    run('npx', ['vercel', 'env', 'rm', name, 'preview', '-y']);
  } catch (_) {}
  run('npx', ['vercel', 'env', 'add', name, 'preview', '--value', value, '--sensitive', '-y']);
}

function vercelCurl(url) {
  const out = execFileSync('npx', ['vercel', 'curl', url], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  return JSON.parse(out.trim());
}

async function main() {
  console.log('\n=== Setup Preview Stripe TEST ===\n');

  const keys = resolveKeys();
  if (!keys || !keys.secretKey.includes('_test_')) {
    console.error('Stripe test keys unavailable.');
    console.error('Run once: stripe login  → approve in browser');
    console.error('Or set STRIPE_TEST_SECRET_KEY, STRIPE_TEST_PUBLISHABLE_KEY, STRIPE_TEST_WEBHOOK_SECRET');
    process.exit(1);
  }

  let previewUrl = (process.env.PREVIEW_URL || '').replace(/\/$/, '');
  if (!previewUrl) {
    const dep = run('npx', ['vercel', 'ls', '--yes']);
    const m = dep.match(/https:\/\/car-sales-[a-z0-9-]+\.vercel\.app/);
    previewUrl = m ? m[0] : '';
  }
  if (!previewUrl) {
    throw new Error('PREVIEW_URL not found — deploy preview first or set PREVIEW_URL');
  }
  console.log('Preview URL:', previewUrl);

  if (!keys.webhookSecret) {
    keys.webhookSecret = createTestWebhook(previewUrl, keys.secretKey);
    if (!keys.webhookSecret) {
      throw new Error('Could not create test webhook — set STRIPE_TEST_WEBHOOK_SECRET manually');
    }
    console.log('Created test webhook whsec');
  }

  if (!keys.vipPriceId) {
    keys.vipPriceId = findTestVipPrice(keys.secretKey);
    if (keys.vipPriceId) console.log('Test VIP price:', keys.vipPriceId);
  }

  const vars = [
    ['STRIPE_SECRET_KEY', keys.secretKey],
    ['STRIPE_PUBLISHABLE_KEY', keys.publishableKey],
    ['STRIPE_WEBHOOK_SECRET', keys.webhookSecret]
  ];
  if (keys.vipPriceId) vars.push(['STRIPE_VIP_PRICE_ID', keys.vipPriceId]);

  console.log('\nUpdating Vercel Preview env (Production untouched)...');
  for (const [name, value] of vars) {
    upsertPreviewEnv(name, value);
    console.log('  OK', name, '(preview only)');
  }

  if (!skipDeploy) {
    console.log('\nRedeploying Preview...');
    const out = run('npx', ['vercel', 'deploy', '--yes']);
    const m = out.match(/https:\/\/car-sales-[a-z0-9-]+\.vercel\.app/);
    if (m) previewUrl = m[0];
    console.log('Deployed:', previewUrl);
  }

  const cfg = vercelCurl(`${previewUrl}/api/vip-config`);
  if (!cfg.testMode) {
    throw new Error('Preview still testMode:false — redeploy may still be building');
  }
  console.log('\nPreview testMode: true');
  console.log('Preview keys готовы');
  console.log('URL:', previewUrl);
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
