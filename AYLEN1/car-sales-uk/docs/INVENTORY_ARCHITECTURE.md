# AYLENSALE inventory architecture (API-ready)

Central product record in Firestore `products/{productId}`.

## Core fields (current + future)

| Field | Purpose |
|-------|---------|
| `id` | Firestore document ID (`prod_*`) — never client-generated duplicates on edit |
| `sku` | Unique SKU (`AYLE-*`) for warehouse + channel sync |
| `stock` / `inventory.onHand` | Website quantity |
| `inventory.reserved` | Orders not yet shipped |
| `inventory.channels.*` | Per-marketplace stock + external listing IDs |
| `status` | `active` \| `hidden` \| `draft` |
| `policyId` | Listing policy reference |

## Channel sync (planned)

```
website sale  → decrement inventory.onHand + channels.website.stock
              → push stock to eBay API when channels.ebay.enabled

eBay sale     → webhook/API → decrement channels.ebay.stock
              → sync inventory.onHand + channels.website.stock
```

## Orders (planned collection)

`orders/{orderId}` — source: `website` \| `ebay` \| `manual`, line items with `productId`, `sku`, `qty`.

## Implementation module

`js/inventory-core.js` — `AYLEN_INVENTORY.normalizeInventoryFields(product)` applied on every admin save.

Future: Cloud Functions or Vercel API routes for eBay Trading/Inventory API.
