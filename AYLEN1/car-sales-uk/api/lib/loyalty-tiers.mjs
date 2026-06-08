/** Shared loyalty tier definitions (server). */
export const LOYALTY_TIERS = [
  { tier: 0, percent: 5, label: 'Welcome', orders: 0, spend: 0, fill: 20 },
  { tier: 1, percent: 10, label: 'Regular', orders: 3, spend: 500, fill: 40 },
  { tier: 2, percent: 15, label: 'Frequent', orders: 8, spend: 1500, fill: 60 },
  { tier: 3, percent: 20, label: 'Premium', orders: 15, spend: 3000, fill: 80 },
  { tier: 4, percent: 25, label: 'VIP', orders: 30, spend: 6000, fill: 100 }
];

export function tierByIndex(i) {
  return LOYALTY_TIERS[Math.max(0, Math.min(LOYALTY_TIERS.length - 1, Number(i) || 0))];
}

export function suggestedTier(orders, spend) {
  const o = Number(orders) || 0;
  const s = Number(spend) || 0;
  let best = 0;
  LOYALTY_TIERS.forEach(function(t) {
    if (o >= t.orders || s >= t.spend) best = Math.max(best, t.tier);
  });
  return best;
}

export function tierProgressToNext(orders, spend, tier) {
  const t = tierByIndex(tier);
  const next = tierByIndex(tier + 1);
  if (tier >= LOYALTY_TIERS.length - 1) return 100;
  const orderProg = next.orders > t.orders
    ? Math.min(1, (Number(orders) - t.orders) / (next.orders - t.orders))
    : 0;
  const spendProg = next.spend > t.spend
    ? Math.min(1, (Number(spend) - t.spend) / (next.spend - t.spend))
    : 0;
  return Math.round(Math.max(orderProg, spendProg) * 100);
}

export function jarFillHeight(tier, orders, spend) {
  const t = tierByIndex(tier);
  const prog = tierProgressToNext(orders, spend, tier);
  if (tier >= LOYALTY_TIERS.length - 1) return 100;
  let fillH = Math.max(t.fill * 0.35, t.fill * 0.35 + prog * 0.006);
  return Math.min(100, Math.max(12, fillH));
}
