/**
 * Auction winner collection — fixed warehouse address and collection terms.
 */
export const AUCTION_COLLECTION_ADDRESS = Object.freeze({
  warehouse: 'Warehouse 4',
  line1: 'Old Manton Station',
  town: 'Oakham',
  postcode: 'LE15 8SZ'
});

export const AUCTION_COLLECTION_METHODS = Object.freeze([
  'Self Collection',
  'Buyer Courier'
]);

export const AUCTION_COLLECTION_TERMS = Object.freeze([
  'Collection within 5 working days after payment.',
  'Buyer collects personally or arranges own courier.',
  'Storage charges may apply after 5 working days.',
  'Uncollected lots may be cancelled and resold.',
  'All lots sold as seen.'
]);

const LEGACY_METHODS = Object.freeze(['Pickup', 'Delivery', 'Admin follow-up']);

export function isValidAuctionCollectionMethod(method) {
  const safe = String(method || '').trim();
  return AUCTION_COLLECTION_METHODS.indexOf(safe) !== -1
    || LEGACY_METHODS.indexOf(safe) !== -1;
}

export function formatCollectionAddressText() {
  const a = AUCTION_COLLECTION_ADDRESS;
  return [a.warehouse, a.line1, a.town, a.postcode].join('\n');
}

export function formatCollectionAddressHtml() {
  return formatCollectionAddressText().replace(/\n/g, '<br>');
}
