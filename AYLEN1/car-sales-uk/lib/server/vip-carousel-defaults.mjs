/** VIP carousel defaults — Amazon warehouse / fulfillment imagery only. */

/** Bump when slide URLs change — ignores old Firestore lists until admin re-saves. */
export const VIP_CAROUSEL_SCHEMA_VERSION = 4;

function pexelsWarehouse(id) {
  return (
    'https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + '.jpeg' +
    '?auto=compress&cs=tinysrgb&w=1200&h=675&fit=crop'
  );
}

/** Pexels — warehouse aisles, pallets, parcel shelves (hotlink-friendly). */
export const DEFAULT_VIP_WAREHOUSE_CAROUSEL = [
  pexelsWarehouse(4483610),
  pexelsWarehouse(5857521),
  pexelsWarehouse(4483618),
  pexelsWarehouse(5857534),
  pexelsWarehouse(5857525),
  pexelsWarehouse(4484702),
  pexelsWarehouse(1571468)
];

export const DEFAULT_VIP_PAYWALL_CAROUSEL = DEFAULT_VIP_WAREHOUSE_CAROUSEL.slice(0, 6);
export const DEFAULT_VIP_HUB_CAROUSEL = DEFAULT_VIP_WAREHOUSE_CAROUSEL.slice();

/** @deprecated use DEFAULT_VIP_PAYWALL_CAROUSEL */
export const DEFAULT_VIP_CAROUSEL = DEFAULT_VIP_PAYWALL_CAROUSEL;

export const LEGACY_VIP_CAROUSEL_RE =
  /mario|nintendo|gaming|zelda|pokemon|luigi|gameboy|xbox|playstation|retro.?game|hub-mario|vip-mario|mario-hub|game.?hub|imgbb|ebayimg|grailed|stockx|console|lego|fortnite|roblox/i;

/** Old Unsplash / broken URLs — treat as legacy so we fall back to Pexels warehouse set. */
const NON_WAREHOUSE_UNSPLASH_RE =
  /images\.unsplash\.com|photo-1600880292203|photo-1558618666|photo-1605746182332|photo-1587291322375|photo-1560174036/i;

export function isLegacyVipCarouselUrl(url) {
  const u = String(url || '');
  if (LEGACY_VIP_CAROUSEL_RE.test(u)) return true;
  if (NON_WAREHOUSE_UNSPLASH_RE.test(u)) return true;
  if (/images\.pexels\.com\/photos\/\d+/.test(u)) return false;
  if (/upload\.wikimedia\.org/.test(u) && /warehouse|distribution|fulfil/i.test(u)) return false;
  if (!/^https?:\/\//i.test(u)) return true;
  return false;
}

export function sanitizeVipCarouselUrls(urls, fallback) {
  const fb = (fallback && fallback.length)
    ? fallback.slice()
    : DEFAULT_VIP_WAREHOUSE_CAROUSEL.slice();
  const list = (Array.isArray(urls) ? urls : []).map(String).filter(Boolean);
  if (!list.length) return fb;
  const clean = list.filter(function(u) { return !isLegacyVipCarouselUrl(u); });
  if (!clean.length) return fb;
  if (clean.length < Math.ceil(list.length / 2)) return fb;
  return clean.slice(0, 12);
}

function hasCurrentCarouselSchema(settings) {
  return settings && Number(settings.carouselSchemaVersion) === VIP_CAROUSEL_SCHEMA_VERSION;
}

export function resolveVipPaywallCarousel(settings) {
  if (!hasCurrentCarouselSchema(settings)) {
    return DEFAULT_VIP_PAYWALL_CAROUSEL.slice();
  }
  const raw = settings && settings.carouselImages;
  if (Array.isArray(raw) && raw.length) {
    return sanitizeVipCarouselUrls(raw, DEFAULT_VIP_PAYWALL_CAROUSEL);
  }
  return DEFAULT_VIP_PAYWALL_CAROUSEL.slice();
}

export function resolveVipHubCarousel(settings) {
  if (!hasCurrentCarouselSchema(settings)) {
    return DEFAULT_VIP_HUB_CAROUSEL.slice();
  }
  const raw = settings && settings.hubCarouselImages;
  if (Array.isArray(raw) && raw.length) {
    return sanitizeVipCarouselUrls(raw, DEFAULT_VIP_HUB_CAROUSEL);
  }
  return DEFAULT_VIP_HUB_CAROUSEL.slice();
}
