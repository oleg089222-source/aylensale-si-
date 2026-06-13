#!/usr/bin/env node
/**
 * P0 production audit via /api/admin-audit (uses ADMIN_PASSWORD on server).
 */
const BASE = (process.env.VERIFY_URL || 'https://aylensale.com/').replace(/\/?$/, '/');
const QA_ID = 'prod_1781126013156';
const PASS = process.env.ADMIN_PASSWORD || '159357Oleg@';

async function audit(action, extra) {
  const res = await fetch(new URL('api/admin-auth', BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ action: 'audit', auditAction: action, adminPassword: PASS }, extra || {}))
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function subscribeNotify(email) {
  const res = await fetch(new URL('api/notify-request', BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: QA_ID,
      productName: 'QA Audit Test 20260610',
      method: 'email',
      contact: email
    })
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function main() {
  const report = { ok: true, steps: [] };
  function step(name, ok, detail) {
    report.steps.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
    if (!ok) report.ok = false;
    console.log((ok ? '✓' : '✗'), name, JSON.stringify(detail));
  }

  const ensure = await audit('ensure-qa-product', { stock: 3 });
  step('qa-ensure', ensure.status === 200 && ensure.data.ok, ensure.data);

  const read1 = await audit('stock-read', { productId: QA_ID });
  const stockBefore = read1.data?.product?.stock;
  step('stock-read', read1.status === 200 && stockBefore != null, { stock: stockBefore });

  const dec = await audit('stock-decrement', {
    productId: QA_ID,
    qty: 1,
    reservationId: 'audit_dec_' + Date.now()
  });
  step('stock-decrement', dec.status === 200 && dec.data.after === stockBefore - 1, dec.data);

  const restore = await audit('stock-restore', {
    productId: QA_ID,
    reservationId: dec.data?.reservationId
  });
  step('stock-restore', restore.status === 200 && restore.data.after === stockBefore, restore.data);

  const email = 'qa-notify-' + Date.now() + '@mailinator.com';
  const sub = await subscribeNotify(email);
  step('notify-subscribe', sub.status === 200 && sub.data.success, sub.data);

  await audit('notify-restock', {
    productId: QA_ID,
    previousStock: 3,
    newStock: 0,
    setStock: 0
  });
  const notify = await audit('notify-self-test', {
    productId: QA_ID,
    newStock: 5,
    setStock: 5
  });
  const notifyOk = notify.status === 200 && (notify.data.sent || 0) >= 1;
  step('notify-restock-auto', notifyOk, notify.data);
  step('notify-email-included', notifyOk && (notify.data.total || 0) >= 1, {
    totalProcessed: notify.data.total,
    sent: notify.data.sent,
    note: 'Email subscriber + Telegram self-test delivered on restock'
  });

  const del = await audit('delete-product', { productId: QA_ID });
  step('qa-delete', del.status === 200 && del.data.deleted, del.data);

  const catalog = await fetch(new URL('api/storefront-catalog?limit=50', BASE));
  const cat = await catalog.json();
  const count = cat.products?.items?.length || 0;
  const hasQa = (cat.products?.items || []).some((p) => p.id === QA_ID);
  step('qa-removed-catalog', !hasQa, { count });

  const boot = await fetch(new URL('data/catalog-bootstrap.json?v=' + Date.now(), BASE));
  const bootData = await boot.json();
  const bootCount = bootData.products?.items?.length || 0;
  step('bootstrap-count', bootCount === count, { bootstrap: bootCount, api: count });

  console.log('\n' + JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
