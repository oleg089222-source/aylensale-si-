/**
 * VIP early access — VIP members see/bid before public launch.
 */
export const AUCTION_DURATION_PRESETS = Object.freeze({
  quick: { label: 'Quick (3 days)', hours: 72 },
  standard: { label: 'Standard (7 days)', hours: 168 },
  extended: { label: 'Extended (14 days)', hours: 336 }
});

export const DEFAULT_AUCTION_DURATION_TYPE = 'standard';
export const DEFAULT_VIP_EARLY_ACCESS_HOURS = 24;

export function resolveDurationHours(durationType, durationHours) {
  const custom = Number(durationHours);
  if (Number.isFinite(custom) && custom > 0) return Math.round(custom);
  const preset = AUCTION_DURATION_PRESETS[String(durationType || DEFAULT_AUCTION_DURATION_TYPE)];
  return preset ? preset.hours : AUCTION_DURATION_PRESETS.standard.hours;
}

export function buildAuctionSchedule(opts) {
  const nowMs = Number(opts?.nowMs) || Date.now();
  const earlyHours = Math.max(0, Number(opts?.vipEarlyAccessHours) || 0);
  const durationHours = resolveDurationHours(opts?.durationType, opts?.durationHours);
  const publicStartMs = earlyHours > 0 ? nowMs + earlyHours * 3600000 : nowMs;
  const endMs = publicStartMs + durationHours * 3600000;
  return {
    vipEarlyAccessHours: earlyHours,
    durationType: String(opts?.durationType || DEFAULT_AUCTION_DURATION_TYPE),
    durationHours: durationHours,
    publicStartAt: new Date(publicStartMs).toISOString(),
    endTime: new Date(endMs).toISOString(),
    createdAt: new Date(nowMs).toISOString()
  };
}

export function isPubliclyVisible(auction, nowMs) {
  const a = auction || {};
  const publicStart = Date.parse(a.publicStartAt || a.createdAt || 0);
  const now = Number(nowMs) || Date.now();
  if (!publicStart || publicStart <= now) return true;
  return false;
}

export function isVipEarlyAccessActive(auction, nowMs) {
  const a = auction || {};
  const earlyHours = Number(a.vipEarlyAccessHours || 0);
  if (earlyHours <= 0) return false;
  return !isPubliclyVisible(a, nowMs);
}

export function canShopperSeeAuction(auction, isVipMember, nowMs) {
  if (!auction) return false;
  if (isPubliclyVisible(auction, nowMs)) return true;
  return !!isVipMember;
}

export function canPlacePublicBid(auction, nowMs) {
  return isPubliclyVisible(auction, nowMs);
}
