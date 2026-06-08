/**
 * Stripe client — server-side only.
 */
import Stripe from 'stripe';

let stripeClient = null;

export function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !String(key).trim()) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  stripeClient = new Stripe(String(key).trim());
  return stripeClient;
}

export function getVipPriceId() {
  const id = process.env.STRIPE_VIP_PRICE_ID;
  if (!id || !String(id).trim()) {
    throw new Error('STRIPE_VIP_PRICE_ID is not configured');
  }
  return String(id).trim();
}

export function getSiteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'aylensale.com';
  return String(proto).split(',')[0].trim() + '://' + String(host).split(',')[0].trim();
}
