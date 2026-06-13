/**
 * Write first catalog page to /data/catalog-bootstrap.json (keeps HTML small for LCP).
 * SSR first product card so LCP image is discoverable before JS runs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'public', 'index.html');
const limit = Number(process.env.CATALOG_INLINE_LIMIT || 24) || 24;
const base = (process.env.CATALOG_URL || process.env.VERIFY_URL || 'https://aylensale.com/').replace(/\/?$/, '/');
const apiUrl = new URL('api/storefront-catalog?limit=' + limit, base).href;
const bootstrapVersion = process.env.CATALOG_BOOTSTRAP_VERSION || '202606110900';
const LCP_THUMB_FILE = 'lcp-thumb.webp';

if (!fs.existsSync(indexPath)) {
  console.error('inline-catalog-bootstrap: public/index.html missing');
  process.exit(1);
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function jsArg(id) {
  return "'" + String(id).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function safeDomId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function truncateTitle(name) {
  const t = String(name || 'Product').trim();
  return t.length > 58 ? t.slice(0, 57).trim() + '…' : t;
}

function cardPriceHtml(p) {
  const retail = Number(p.price || p.retail || 0);
  const hasDiscount = p.discount && p.discount > 0;
  const sale = hasDiscount ? Number(p.salePrice || retail) : retail;
  if (hasDiscount) {
    return (
      '<div class="product-prices">' +
      '<span class="price-original">£' + retail.toFixed(2) + '</span>' +
      '<span class="price-sale">£' + sale.toFixed(2) + '</span>' +
      '<span class="price-badge-discount">-' + p.discount + '%</span></div>'
    );
  }
  return '<div class="product-prices"><span class="price-main">£' + retail.toFixed(2) + '</span></div>';
}

const SSR_MOBILE_CARD_COUNT = 8;
const SSR_EAGER_IMAGE_COUNT = 1;
const MOBILE_ABOVE_HERO_PX = 128;
const MOBILE_ABOVE_STACK_GAP_PX = 8;
const MOBILE_ABOVE_ENGAGEMENT_PX = 92;
const MOBILE_ABOVE_EBAY_PX = 0;
const MOBILE_ABOVE_PRICE_LIST_PX = 0;
const DESKTOP_ABOVE_HERO_PX = 200;
const DESKTOP_ABOVE_ENGAGEMENT_PX = 52;
const DESKTOP_ABOVE_EBAY_PX = 56;

function mobileAboveProductsReservePx() {
  return MOBILE_ABOVE_HERO_PX + MOBILE_ABOVE_STACK_GAP_PX + MOBILE_ABOVE_ENGAGEMENT_PX +
    MOBILE_ABOVE_EBAY_PX + MOBILE_ABOVE_PRICE_LIST_PX;
}

function desktopAboveProductsReservePx(hasEbay) {
  return DESKTOP_ABOVE_HERO_PX + MOBILE_ABOVE_STACK_GAP_PX + DESKTOP_ABOVE_ENGAGEMENT_PX +
    (hasEbay ? DESKTOP_ABOVE_EBAY_PX : 0);
}
const MOBILE_CARD_ROW_PX = 392;
const MOBILE_GRID_GAP_PX = 8;
const MOBILE_GRID_PAD_BOTTOM_PX = 56;
const MOBILE_SECTION_OVERHEAD_PX = 248;
const DESKTOP_CARD_ROW_PX = 320;
const DESKTOP_GRID_GAP_PX = 12;
const DESKTOP_GRID_PAD_BOTTOM_PX = 12;
const DESKTOP_SECTION_OVERHEAD_PX = 320;

function desktopGridColumnsForWidth(width) {
  if (width <= 1024) return 2;
  if (width <= 1399) return 3;
  return 4;
}

function desktopGridReservePx(cardCount, width) {
  const cols = desktopGridColumnsForWidth(width || 1280);
  const rows = Math.ceil(Math.max(0, Number(cardCount) || 0) / cols) || 4;
  return rows * DESKTOP_CARD_ROW_PX + Math.max(0, rows - 1) * DESKTOP_GRID_GAP_PX + DESKTOP_GRID_PAD_BOTTOM_PX;
}

function desktopSectionReservePx(cardCount, width) {
  return desktopGridReservePx(cardCount, width) + DESKTOP_SECTION_OVERHEAD_PX;
}

function mobileGridReservePx(cardCount) {
  const n = Math.max(0, Number(cardCount) || 0);
  if (!n) return 1648;
  const rows = Math.ceil(n / 2);
  return rows * MOBILE_CARD_ROW_PX + Math.max(0, rows - 1) * MOBILE_GRID_GAP_PX + MOBILE_GRID_PAD_BOTTOM_PX;
}

function mobileSectionReservePx(cardCount) {
  return mobileGridReservePx(cardCount) + MOBILE_SECTION_OVERHEAD_PX;
}
const MOBILE_CARD_PX = 176;
const SSR_DEFERRED_IMG =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function validEbayUrl(url) {
  const u = String(url || '').trim();
  return (
    u.startsWith('https://www.ebay.co.uk/') ||
    u.startsWith('https://ebay.co.uk/') ||
    u.startsWith('https://www.ebay.com/') ||
    u.startsWith('https://ebay.com/')
  );
}

function buildEbayPromoCardHtml(settings) {
  const buttonText = settings.buttonText || 'Shop on eBay';
  let description =
    settings.description ||
    'Prefer eBay? Shop our AYLENSALE store on eBay.co.uk.';
  if (description === 'Prefer eBay? You can also buy from our official AYLENSALE eBay store.') {
    description = 'Prefer eBay? Shop our AYLENSALE store on eBay.co.uk.';
  }
  return (
    '<div class="ebay-promo-card">' +
      '<div class="ebay-promo-card__main">' +
        '<div class="ebay-promo-card__icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16v2H4V4zm2 4h12l-1.2 10H7.2L6 8zm6 2v6h2v-6h-2z"/></svg></div>' +
        '<div class="ebay-promo-card__copy">' +
          '<div class="ebay-promo-card__logo" aria-hidden="true">' +
            '<span class="ebay-promo-card__logo-e">e</span><span class="ebay-promo-card__logo-b">B</span><span class="ebay-promo-card__logo-a">a</span><span class="ebay-promo-card__logo-y">y</span>' +
          '</div>' +
          '<p class="ebay-promo-card__desc">' + esc(description) + '</p>' +
        '</div>' +
      '</div>' +
      '<a class="ebay-promo-card__cta" href="' + esc(settings.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<i class="fas fa-external-link-alt" aria-hidden="true"></i> ' + esc(buttonText) +
      '</a>' +
    '</div>'
  );
}

function catalogThumbHref(raw, w, h, q, fmt) {
  if (!raw || String(raw).indexOf('data:') === 0) return '';
  const url = String(raw);
  const media = /[?&]alt=media(?:&|$)/.test(url)
    ? url
    : url + (url.indexOf('?') === -1 ? '?' : '&') + 'alt=media';
  let href =
    '/api/image-thumb?w=' + (w || MOBILE_CARD_PX) +
    '&h=' + (h || MOBILE_CARD_PX) +
    '&q=' + (q || 52) +
    '&url=' + encodeURIComponent(media);
  if (fmt) href += '&fmt=' + encodeURIComponent(fmt);
  return href;
}

function buildSsrPictureHtml(thumbHref, imgRaw, pid, imgAttrs, deferImage, isLcp, fullName) {
  if (deferImage) {
    return (
      '<img data-main-product-image="' + pid + '" data-slide-index="0" src="' + SSR_DEFERRED_IMG +
      '" data-deferred-src="' + esc(thumbHref) + '" alt="' + (isLcp ? fullName : '') +
      '" width="' + MOBILE_CARD_PX + '" height="' + MOBILE_CARD_PX + '"' + imgAttrs +
      ' onerror="this.onerror=null;this.src=\'' + esc(imgRaw || '/logo.png') + '\'" />'
    );
  }
  const widths = [176, 352, 400];
  const srcset = widths.map(function(w) {
    return catalogThumbHref(imgRaw, w, w, 52, 'webp') + ' ' + w + 'w';
  }).join(', ');
  const sizes = '(max-width: 768px) calc(50vw - 14px), 300px';
  const jpegFallback = catalogThumbHref(imgRaw, MOBILE_CARD_PX, MOBILE_CARD_PX, 52, 'jpeg');
  return (
    '<picture class="product-card-picture">' +
    '<source type="image/webp" srcset="' + esc(srcset) + '" sizes="' + sizes + '">' +
    '<img data-main-product-image="' + pid + '" data-slide-index="0" src="' + esc(jpegFallback) + '"' +
    ' srcset="' + esc(srcset) + '" sizes="' + sizes + '" alt="' + (isLcp ? fullName : '') +
    '" width="' + MOBILE_CARD_PX + '" height="' + MOBILE_CARD_PX + '"' + imgAttrs +
    ' onerror="this.onerror=null;this.src=\'' + esc(imgRaw || '/logo.png') + '\'" />' +
    '</picture>'
  );
}

function productAgeMs(product) {
  const raw = product && (product.createdAt || product.updatedAt || product.lastModified);
  if (!raw) return 0;
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : 0;
}

function buildSsrProductCardBadges(p) {
  const badges = [];
  const custom = String(p.badge || '').trim().toUpperCase();
  const ageMs = productAgeMs(p);
  const age = ageMs ? Date.now() - ageMs : 0;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;
  if (custom === 'NEW' || (ageMs && age < weekMs)) {
    badges.push({ label: 'New', className: 'product-card-badge--new' });
  }
  if (p.vipOnly || p.isVipOnly || p.vipStock || String(p.category || '').toLowerCase().indexOf('vip') !== -1) {
    badges.push({ label: 'VIP', className: 'product-card-badge--vip' });
  }
  const wholesale = Number(p.wholesale || p.wholesalePrice || 0);
  const retail = Number(p.price || p.retail || 0);
  if (custom === 'WHOLESALE' || (wholesale > 0 && retail > 0 && wholesale < retail * 0.98)) {
    badges.push({ label: 'Wholesale', className: 'product-card-badge--wholesale' });
  }
  const stock = parseInt(p.stock, 10) || 0;
  if (stock > 0 && stock <= 5) {
    badges.push({ label: 'Low Stock', className: 'product-card-badge--low-stock' });
  }
  if (!badges.length) return '<div class="product-card-badges product-card-badges--empty"></div>';
  let out = '<div class="product-card-badges">';
  badges.forEach(function(b) {
    out += '<span class="product-card-badge ' + b.className + '">' + esc(b.label) + '</span>';
  });
  out += '</div>';
  return out;
}

function buildSsrProductCard(p, thumbHref, opts) {
  opts = opts || {};
  const cardIndex = Number(opts.index) || 0;
  const isLcp = cardIndex === 0;
  const isEagerImage = cardIndex < SSR_EAGER_IMAGE_COUNT;
  const deferImage = !isEagerImage;
  const imgRaw = opts.imgRaw || '';
  const id = String(p.id || '');
  const pid = esc(id);
  const domId = safeDomId(id);
  const detailUrl = '/product.html?id=' + encodeURIComponent(id);
  const name = esc(truncateTitle(p.name));
  const fullName = esc(String(p.name || 'Product').trim());
  const modalClick =
    'data-action="product-modal" data-product-id="' + pid + '"';
  const stock = parseInt(p.stock, 10) || 0;
  const imgAttrs = isLcp
    ? ' loading="eager" decoding="async" fetchpriority="high"'
    : (isEagerImage
      ? ' loading="eager" decoding="async" fetchpriority="low"'
      : ' loading="lazy" decoding="async" fetchpriority="low"');
  const imgSrc = deferImage ? SSR_DEFERRED_IMG : esc(thumbHref);
  const deferAttrs = deferImage
    ? ' data-deferred-src="' + esc(thumbHref) + '"'
    : '';
  const fallbackSrc = esc(imgRaw || '/logo.png');
  const imgOnError = ' onerror="this.onerror=null;this.src=\'' + fallbackSrc + '\'"';

  let out =
    '<div class="product-card product-card-grid-item is-visible" id="product-card-' +
    domId +
    '" data-product-id="' +
    pid +
    '"' +
    ' data-ssr-hydrate="1"' +
    (isLcp ? ' data-ssr-lcp="1"' : '') +
    (deferImage ? ' data-ssr-img-deferred="1"' : '') +
    ' onmouseenter="trackProductView(' +
    jsArg(id) +
    ')" ontouchstart="trackProductView(' +
    jsArg(id) +
    ')">';
  out += '<div class="product-card-media"><div class="product-image-container product-card-hit">';
  out +=
    '<a href="' +
    esc(detailUrl) +
    '" class="product-card-media-link" ' +
    modalClick +
    ' aria-label="View ' +
    fullName +
    '">';
  out +=
    buildSsrPictureHtml(thumbHref, imgRaw, pid, imgAttrs, deferImage, isLcp, fullName);
  out += '</a>';
  out += '<div class="product-image-overlay">' + buildSsrProductCardBadges(p) + '<div class="product-image-actions">';
  out +=
    '<button type="button" class="product-badge product-badge--cart" data-product-cart-badge="' +
    pid +
    '" data-action="add-to-cart" data-action-stop="1" data-product-id="' +
    pid +
    '" aria-label="Add to cart" title="Add to cart"><i class="fas fa-cart-plus" aria-hidden="true"></i></button>';
  out += '</div></div></div>';
  out +=
    '<div class="product-card-title-block"><h3 class="product-card-title"><a href="' +
    esc(detailUrl) +
    '" class="product-card-title-link" title="' +
    fullName +
    '" ' +
    modalClick +
    '>' +
    name +
    '</a></h3></div></div>';
  out +=
    '<div class="product-card-body product-info"><p class="product-card-subtitle">' +
    esc(String(p.category || 'UK warehouse · weekend pickup').trim()) +
    '</p>';
  out += '<div class="product-card-pricing">' + cardPriceHtml(p) + '</div>';
  out += '<div class="product-stock-row"><span class="stock-info">Stock: ' + stock + '</span></div></div>';
  out += '<div class="product-card-footer"><div class="product-card-actions action-buttons">';
  if (stock > 0) {
    out +=
      '<button type="button" class="btn-action primary product-add-to-cart-btn" onclick="addToCart(' +
      jsArg(id) +
      ')"><i class="fas fa-cart-plus" aria-hidden="true"></i><span>Add to Cart</span></button>';
  } else {
    out += '<div class="out-of-stock">Out of stock</div>';
  }
  out +=
    '<button type="button" class="btn-action secondary product-view-details" onclick="openStorefrontProductModal(' +
    jsArg(id) +
    '); return false;"><i class="fas fa-expand"></i> Quick view</button>';
  out += '</div></div></div>';
  return out;
}

let payload;
try {
  const res = await fetch(apiUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  payload = await res.json();
  if (!payload || payload.ok !== true) throw new Error('Invalid catalog payload');
} catch (err) {
  console.warn('inline-catalog-bootstrap: skipped —', err.message || err);
  process.exit(0);
}

function canonicalProductKey(id) {
  const raw = String(id || '').trim();
  if (!raw) return '';
  return raw.indexOf('prod_') === 0 ? raw.slice(5) : raw;
}

function shouldPreferCatalogProduct(candidate, incumbent) {
  if (!incumbent) return true;
  if (!candidate) return false;
  const candProd = String(candidate.id || '').indexOf('prod_') === 0;
  const incProd = String(incumbent.id || '').indexOf('prod_') === 0;
  if (candProd && !incProd) return true;
  if (!candProd && incProd) return false;
  return Number(candidate.stock || 0) >= Number(incumbent.stock || 0);
}

function dedupeCatalogProducts(list) {
  const seen = Object.create(null);
  const result = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    if (!item) return;
    const key = canonicalProductKey(item.id);
    if (!key) return;
    const existing = seen[key];
    if (!existing) {
      seen[key] = item;
      result.push(item);
      return;
    }
    if (shouldPreferCatalogProduct(item, existing)) {
      const idx = result.indexOf(existing);
      if (idx !== -1) result[idx] = item;
      seen[key] = item;
    }
  });
  return result;
}

if (payload.products && Array.isArray(payload.products.items)) {
  payload.products.items = dedupeCatalogProducts(payload.products.items);
}

const dataDir = path.join(root, 'public', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const jsonPath = path.join(dataDir, 'catalog-bootstrap.json');
fs.writeFileSync(jsonPath, JSON.stringify(payload));
const bootstrapHref = '/data/catalog-bootstrap.json?v=' + bootstrapVersion;

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<script id="aylen-catalog-bootstrap"[\s\S]*?<\/script>\s*/g, '');
html = html.replace(/<link[^>]+data-aylen-catalog-preload[^>]*>\s*/g, '');
html = html.replace(/<link[^>]+data-aylen-catalog-prefetch[^>]*>\s*/g, '');
html = html.replace(/<link[^>]+rel="prefetch"[^>]+catalog-bootstrap[^>]*>\s*/gi, '');
html = html.replace(/<link[^>]+data-aylen-lcp-preload[^>]*>\s*/g, '');
html = html.replace(/<!-- aylen-ssr-lcp-start -->[\s\S]*?<!-- aylen-ssr-lcp-end -->\s*/g, '');
html = html.replace(/<div class="product-skeleton product-skeleton--lcp"[\s\S]*?<\/div>\s*/g, '');
html = html.replace(/<img class="product-lcp-prerender"[\s\S]*?>\s*/g, '');

if (html.includes('name="aylen-catalog-bootstrap"')) {
  html = html.replace(
    /(<meta name="aylen-catalog-bootstrap" content=")[^"]*(")/,
    '$1' + bootstrapHref + '$2'
  );
} else if (html.includes('</head>')) {
  html = html.replace(
    '</head>',
    '<meta name="aylen-catalog-bootstrap" content="' + bootstrapHref + '">\n</head>'
  );
}

const items = payload.products && payload.products.items ? payload.products.items : [];
console.log('inline-catalog-bootstrap: deduped products →', items.length);
const ebaySettings = payload.settings && payload.settings.ebay;

function catalogLcpPreloadHref(raw) {
  return catalogThumbHref(raw, MOBILE_CARD_PX, MOBILE_CARD_PX, 52);
}

function mediaUrl(raw) {
  const url = String(raw || '');
  if (!url || url.indexOf('data:') === 0) return '';
  return /[?&]alt=media(?:&|$)/.test(url)
    ? url
    : url + (url.indexOf('?') === -1 ? '?' : '&') + 'alt=media';
}

async function writeStaticLcpThumb(raw) {
  const source = mediaUrl(raw);
  if (!source) return '';
  const outPath = path.join(root, 'public', LCP_THUMB_FILE);
  try {
    const res = await fetch(source, { redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rawBuf = Buffer.from(await res.arrayBuffer());
    if (!rawBuf.length || rawBuf.length > 14 * 1024 * 1024) throw new Error('Image too large');
    const out = await sharp(rawBuf)
      .rotate()
      .resize(MOBILE_CARD_PX, MOBILE_CARD_PX, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 62, effort: 2 })
      .toBuffer();
    fs.writeFileSync(outPath, out);
    return '/' + LCP_THUMB_FILE + '?v=' + bootstrapVersion;
  } catch (err) {
    console.warn('inline-catalog-bootstrap: static LCP thumb skipped —', err.message || err);
    try {
      if (fs.existsSync(outPath)) {
        return '/' + LCP_THUMB_FILE + '?v=' + bootstrapVersion;
      }
    } catch (e) { /* ignore */ }
    return '';
  }
}

const firstImg = items[0] && items[0].images && items[0].images[0];
const staticLcpHref = firstImg ? await writeStaticLcpThumb(firstImg) : '';
const lcpHref = staticLcpHref || (firstImg ? catalogLcpPreloadHref(firstImg) : '');
if (lcpHref) {
  let preload =
    '<link rel="preload" as="image" type="image/webp" href="' + lcpHref + '" fetchpriority="high" data-aylen-lcp-preload="1">\n';
  if (html.includes('<!-- aylen-lcp-preload-top-slot -->')) {
    html = html.replace('<!-- aylen-lcp-preload-top-slot -->', preload + '<!-- aylen-lcp-preload-top-slot -->');
  } else if (html.includes('<!-- aylen-lcp-preload-slot -->')) {
    html = html.replace('<!-- aylen-lcp-preload-slot -->', preload + '<!-- aylen-lcp-preload-slot -->');
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', preload + '</head>');
  }
}

if (items.length) {
  var ssrCount = Math.min(SSR_MOBILE_CARD_COUNT, items.length);
  var ssrHtml = '<!-- aylen-ssr-lcp-start -->\n';
  for (var si = 0; si < ssrCount; si++) {
    var prod = items[si];
    var imgRaw = prod.images && prod.images[0];
    var thumb = imgRaw
      ? (si === 0 && staticLcpHref ? staticLcpHref : catalogLcpPreloadHref(imgRaw))
      : '';
    if (!thumb) continue;
    ssrHtml += buildSsrProductCard(prod, thumb, { index: si, imgRaw: imgRaw }) + '\n';
  }
  ssrHtml += '<!-- aylen-ssr-lcp-end -->\n';
  html = html.replace('<div class="product-skeleton" aria-hidden="true"></div>', ssrHtml);
  html = html.replace(/<div class="product-skeleton" aria-hidden="true"><\/div>\s*/g, '');

  const catalogReserveCount = Math.min(items.length, 24);
  const gridReserve = mobileGridReservePx(catalogReserveCount);
  const sectionReserve = mobileSectionReservePx(catalogReserveCount);
  const desktopGridReserve = desktopGridReservePx(catalogReserveCount, 1280);
  const desktopSectionReserve = desktopSectionReservePx(catalogReserveCount, 1280);
  const hasEbay = !!(ebaySettings && ebaySettings.enabled && validEbayUrl(ebaySettings.url));
  const aboveReserve = mobileAboveProductsReservePx();
  const aboveReserveDesktop = desktopAboveProductsReservePx(hasEbay);
  html = html.replace(/1648px/g, gridReserve + 'px');
  html = html.replace(/1896px/g, sectionReserve + 'px');
  html = html.replace(/228px/g, aboveReserve + 'px');
  html = html.replace(
    /--products-grid-reserved-h-desktop:\s*\d+px/g,
    '--products-grid-reserved-h-desktop:' + desktopGridReserve + 'px'
  );
  html = html.replace(
    /--products-section-reserved-h-desktop:\s*\d+px/g,
    '--products-section-reserved-h-desktop:' + desktopSectionReserve + 'px'
  );
  html = html.replace(
    /--products-grid-reserved-h:\s*\d+px/g,
    '--products-grid-reserved-h:' + gridReserve + 'px'
  );
  html = html.replace(
    /--products-section-reserved-h:\s*\d+px/g,
    '--products-section-reserved-h:' + sectionReserve + 'px'
  );
  if (html.includes('name="aylen-mobile-grid-reserve"')) {
    html = html.replace(
      /(<meta name="aylen-mobile-grid-reserve" content=")[^"]*(")/,
      '$1' + String(gridReserve) + '$2'
    );
    html = html.replace(
      /(<meta name="aylen-mobile-section-reserve" content=")[^"]*(")/,
      '$1' + String(sectionReserve) + '$2'
    );
    html = html.replace(
      /(<meta name="aylen-storefront-above-reserve" content=")[^"]*(")/,
      '$1' + String(aboveReserve) + '$2'
    );
  } else if (html.includes('</head>')) {
    html = html.replace(
      '</head>',
      '<meta name="aylen-mobile-grid-reserve" content="' + gridReserve + '">\n' +
      '<meta name="aylen-mobile-section-reserve" content="' + sectionReserve + '">\n' +
      '<meta name="aylen-storefront-above-reserve" content="' + aboveReserve + '">\n</head>'
    );
  }
  if (html.includes('id="storefrontAboveProducts"')) {
    html = html.replace(
      /(<div id="storefrontAboveProducts"[^>]*)(>)/,
      '$1 style="--storefront-above-reserved-h:' + aboveReserve + 'px;--storefront-above-reserved-h-desktop:' + aboveReserveDesktop + 'px"$2'
    );
  }
}

const inStockCount = items.filter(function(p) {
  return p.active !== false && Number(p.stock || 0) > 0;
}).length;
const auctionItems = payload.auctions && payload.auctions.items ? payload.auctions.items : [];
const activeAuctionCount = auctionItems.filter(function(a) {
  return a && a.active !== false && String(a.status || 'active') !== 'ended';
}).length;
const locationItems = payload.locations && payload.locations.items ? payload.locations.items : [];
const pickupCount = locationItems.filter(function(l) {
  return l && l.active !== false && l.showOnWebsite !== false;
}).length;
const engagementSeed = JSON.stringify({
  productsInStock: inStockCount,
  activeAuctions: activeAuctionCount,
  pickupPoints: pickupCount
});
if (html.includes('name="aylen-engagement-seed"')) {
  html = html.replace(
    /(<meta name="aylen-engagement-seed" content=")[^"]*(")/,
    '$1' + esc(engagementSeed) + '$2'
  );
} else if (html.includes('</head>')) {
  html = html.replace(
    '</head>',
    '<meta name="aylen-engagement-seed" content="' + esc(engagementSeed) + '">\n</head>'
  );
}
html = html.replace(
  /(<b id="productsAvailableCount">)[^<]*(<\/b>)/,
  '$1' + String(inStockCount) + '$2'
);
html = html.replace(
  /(<b id="activeAuctionsCount">)[^<]*(<\/b>)/,
  '$1' + String(activeAuctionCount) + '$2'
);
html = html.replace(
  /(<b id="pickupPointsCount">)[^<]*(<\/b>)/,
  '$1' + String(pickupCount) + '$2'
);

if (ebaySettings && ebaySettings.enabled && validEbayUrl(ebaySettings.url)) {
  const ebayInner = buildEbayPromoCardHtml(ebaySettings);
  html = html.replace(
    /<section id="ebayPromoWrap"[^>]*>\s*<\/section>/,
    '<section id="ebayPromoWrap" class="ebay-promo-wrap is-visible" data-ssr-ebay="1" aria-label="Shop on eBay">' +
      ebayInner +
      '</section>'
  );
}

fs.writeFileSync(indexPath, html);
console.log(
  'inline-catalog-bootstrap OK →',
  items.length,
  'products in data/catalog-bootstrap.json' + (lcpHref ? ', SSR LCP card' : '') +
    (ebaySettings && ebaySettings.enabled && validEbayUrl(ebaySettings.url) ? ', SSR eBay promo' : '')
);
