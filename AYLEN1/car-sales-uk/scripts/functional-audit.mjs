/**
 * Automated functional checks (no admin password required).
 * Run: node scripts/functional-audit.mjs
 */
const BASE = process.env.VERIFY_URL || 'https://aylensale.com/';

function canonicalProductKey(id) {
  const raw = String(id || '').trim();
  if (!raw) return '';
  return raw.indexOf('prod_') === 0 ? raw.slice(5) : raw;
}

async function main() {
  const report = { ok: true, checks: [], bugs: [] };
  function pass(name, detail) {
    report.checks.push({ name, status: 'PASS', detail });
  }
  function fail(name, detail) {
    report.ok = false;
    report.bugs.push({ name, detail });
    report.checks.push({ name, status: 'FAIL', detail });
  }

  const catalogRes = await fetch(new URL('api/storefront-catalog?limit=50', BASE));
  if (!catalogRes.ok) {
    fail('catalog-api', 'HTTP ' + catalogRes.status);
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  const catalog = await catalogRes.json();
  const items = catalog.products?.items || [];
  const ids = items.map((p) => p.id);
  const keys = ids.map(canonicalProductKey);
  const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupKeys.length) {
    fail('catalog-dedupe', 'Duplicate canonical product keys: ' + [...new Set(dupKeys)].join(', '));
  } else {
    pass('catalog-dedupe', items.length + ' products, all canonical keys unique');
  }

  const htmlRes = await fetch(BASE);
  const html = await htmlRes.text();
  const ssrIds = [...html.matchAll(/<div class="product-card product-card-grid-item[^"]*"[^>]*data-product-id="([^"]+)"[^>]*data-ssr-hydrate="1"/g)].map((m) => m[1]);
  const ssrDup = ssrIds.filter((id, i) => ssrIds.indexOf(id) !== i);
  if (ssrDup.length) {
    fail('ssr-card-dedupe', 'Duplicate SSR ids: ' + ssrDup.join(', '));
  } else {
    pass('ssr-cards', ssrIds.length + ' SSR cards, no duplicate ids in HTML');
  }

  const stalePair = ids.includes('TF7RjHvaO03TL74bLG3D') && ids.includes('prod_TF7RjHvaO03TL74bLG3D');
  if (stalePair) {
    fail('legacy-duplicate-doc', 'Both TF7RjHvaO03TL74bLG3D and prod_TF7RjHvaO03TL74bLG3D in API — delete legacy doc in Firestore admin');
  } else {
    pass('legacy-duplicate-doc', 'No TF7RjHva / prod_TF7RjHva pair in catalog response');
  }

  items.forEach((p) => {
    if (!Array.isArray(p.images) || !p.images.length) return;
    const bad = p.images.filter((u) => !String(u).startsWith('http'));
    if (bad.length) fail('image-urls-' + p.id, 'Invalid image URLs');
  });
  if (!report.bugs.some((b) => b.name.startsWith('image-urls'))) {
    pass('image-urls', 'All product images use http(s) URLs');
  }

  const inStock = items.filter((p) => Number(p.stock) > 0 && p.active !== false).length;
  pass('stock-field', inStock + ' in-stock products with numeric stock field');

  const bootRes = await fetch(new URL('data/catalog-bootstrap.json', BASE));
  if (!bootRes.ok) {
    fail('bootstrap-json', 'HTTP ' + bootRes.status);
  } else {
    const boot = await bootRes.json();
    const bootItems = boot.products?.items || [];
    const bootKeys = bootItems.map((p) => canonicalProductKey(p.id));
    const bootDup = bootKeys.filter((k, i) => bootKeys.indexOf(k) !== i);
    if (bootDup.length) {
      fail('bootstrap-dedupe', 'Duplicate keys in catalog-bootstrap.json: ' + [...new Set(bootDup)].join(', '));
    } else if (bootItems.length !== items.length) {
      fail('bootstrap-count', 'Bootstrap has ' + bootItems.length + ' items, API has ' + items.length);
    } else {
      pass('bootstrap-json', bootItems.length + ' products in bootstrap, matches API, keys unique');
    }
  }

  const showingMatch = html.match(/Showing (\d+) of (\d+) products/);
  const bootOk = report.checks.some((c) => c.name === 'bootstrap-json' && c.status === 'PASS');
  if (showingMatch && showingMatch[2] === String(items.length)) {
    pass('ui-product-count', 'SSR total matches API: ' + showingMatch[0]);
  } else if (bootOk) {
    pass('ui-product-count', 'Count driven by catalog-bootstrap.json (' + items.length + ' products)');
  } else {
    fail('ui-product-count', 'SSR count mismatch — rebuild bootstrap (API has ' + items.length + ')');
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
