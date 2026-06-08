#!/usr/bin/env node
/**
 * Quick VIP / Stripe health check (prod or preview URL).
 * Usage: node scripts/verify-vip.mjs [baseUrl]
 * Example: node scripts/verify-vip.mjs https://aylensale.com
 */
const base = (process.argv[2] || 'https://aylensale.com').replace(/\/$/, '');

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const warn = (s) => `\x1b[33m!\x1b[0m ${s}`;
const fail = (s) => `\x1b[31m✗\x1b[0m ${s}`;

async function getJson(path, opts) {
  const res = await fetch(base + path, opts);
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  return { res, data };
}

async function main() {
  console.log(`\nVIP check: ${base}\n`);

  try {
    const { res, data } = await getJson('/api/vip-config');
    if (!res.ok) {
      console.log(fail(`/api/vip-config → HTTP ${res.status}`));
      process.exit(1);
    }

    console.log(ok('API /api/vip-config'));
    console.log(`   enabled:           ${data.enabled}`);
    console.log(`   checkoutReady:     ${data.checkoutReady}`);
    console.log(`   stripeConfigured:  ${data.stripeConfigured}`);
    console.log(`   webhookConfigured: ${data.webhookConfigured}`);
    console.log(`   testMode:          ${data.testMode}`);
    console.log(`   memberCount:       ${data.memberCount}`);
    console.log(`   foundingLimit:     ${data.foundingMemberLimit}`);

    if (!data.checkoutReady) {
      console.log('\n' + warn('Checkout not ready — set in Vercel env:'));
      console.log('   STRIPE_SECRET_KEY, STRIPE_VIP_PRICE_ID, VIP_ENABLED=true');
    }
    if (!data.webhookConfigured) {
      console.log('\n' + warn('Webhook secret missing — set STRIPE_WEBHOOK_SECRET'));
      console.log(`   Stripe endpoint: ${base}/api/stripe-webhook`);
    }
    if (data.checkoutReady && !data.testMode) {
      console.log('\n' + warn('LIVE Stripe — test payments charge real money.'));
      console.log('   Use sk_test_… keys on Preview only for safe testing.');
    }

    const status = await getJson('/api/vip-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (status.res.ok && status.data.vip) {
      console.log('\n' + ok('/api/vip-status (anonymous)'));
    } else {
      console.log('\n' + fail(`/api/vip-status → HTTP ${status.res.status}`));
    }

    const badCheckout = await getJson('/api/stripe-create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' })
    });
    if (badCheckout.res.status === 400) {
      console.log(warn('Checkout still requires email (expected wallet-first flow)'));
    } else if (badCheckout.res.status === 200 && badCheckout.data.url) {
      console.log(ok('Checkout opens without email (wallet / Stripe form)'));
    } else if (badCheckout.res.status === 503) {
      console.log(warn(`Checkout → HTTP 503 (${badCheckout.data.error || 'not configured'})`));
    } else {
      console.log(warn(`Checkout → HTTP ${badCheckout.res.status}`));
    }

    const walletCheckout = await getJson('/api/stripe-create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (walletCheckout.res.status === 200 && walletCheckout.data.url) {
      console.log(ok('Empty-body checkout returns Stripe URL'));
    } else if (walletCheckout.res.status === 503) {
      console.log(warn('Empty checkout blocked — Stripe keys missing on this env'));
    } else {
      console.log(warn(`Empty checkout → HTTP ${walletCheckout.res.status}`));
    }

    const page = await fetch(base + '/vip-stock.html');
    console.log(page.ok ? ok('/vip-stock.html loads') : fail(`/vip-stock.html → HTTP ${page.status}`));

    console.log('\nAdmin panel (manual): log in → VIP Members');
    console.log('  • Save settings (counter, carousel)');
    console.log('  • Add VIP stock item');
    console.log('  • After payment: subscriber row appears\n');
  } catch (err) {
    console.error(fail(err.message || String(err)));
    process.exit(1);
  }
}

main();
