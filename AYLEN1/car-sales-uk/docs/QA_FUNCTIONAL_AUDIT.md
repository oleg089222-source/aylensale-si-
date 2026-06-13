# AYLENSALE — Functional Audit Report (Final)

**Date:** 10 June 2026  
**Production URL:** https://aylensale.com  
**Build version:** `202606109720`  
**Evidence:** Screenshots in `docs/qa-screenshots/` + automated scripts

---

## PASS / FAIL summary

| Area | Result | Evidence |
|------|--------|----------|
| Admin CRUD | **PASS** | Create/edit persist to Firestore + API; login works |
| Upload (progress/retry) | **PARTIAL** | Code shipped; not screenshot-verified at 1/10/50 scale |
| Stock Sync (STOCK-001) | **PASS** | Order decrements Firestore; storefront API updates; rollback works |
| Notify Me (NTF-001) | **PASS** | Subscribe → restock 0→N → auto Telegram + email/fallback |
| VIP | **PASS** | Paywall UI; VIP order decrements `vipStockItems.stock` server-side |
| Cart | **PASS** | Add/qty/persist; stock-aware checkout |
| Mobile | **PASS** | iPhone 13 emulated — nav, products, auctions, pickup |
| Tablet | **PASS** | iPad 820px grid |
| Desktop | **PASS** | 3-column grid, filters, 18 products |

**Advertising readiness:** STOCK-001 and NTF-001 closed on production. Upload audit remains partial (P0 code, not fully evidenced).

---

## STOCK-001 — before/after (production)

| Step | Product | Before | After |
|------|---------|--------|-------|
| Server decrement | `prod_1781126013156` | 3 | 2 |
| Server restore | `prod_1781126013156` | 2 | 3 |
| Shop order path | via `api/send-order` | reserves stock before Telegram; rolls back on Telegram failure |

**Implementation:** `lib/server/inventory-stock.mjs` + `api/send-order.js` transaction on `products.stock`, `inventory.onHand`, `inventory.channels.website.stock`. Linked `vipStockItems` sync via `linkedProductId`. VIP orders use `decrementVipStockItem` in `lib/server/vip-handlers.mjs`.

---

## NTF-001 — Notify Me cycle (production)

1. Customer subscribes via `/api/notify-request` (email/telegram/whatsapp)
2. Admin restock OR server `processRestockNotifications` when stock crosses **0 → positive**
3. **Telegram** numeric `chat_id` → Bot API auto-send
4. **Email** → Resend; fallback to admin Telegram relay if Resend unavailable
5. **WhatsApp** → auto-mark sent with `wa.me` deep link payload stored on request

**Server entry:** `/api/process-restock-notify` → `api/spam?action=process-restock-notify`  
**Audit result:** `sent: 2, failed: 0` (email subscriber + Telegram self-test)

---

## DUP-002 — admin dedupe

**Fix:** `js/firebase-db.js` — `dedupeProductionProducts()` after every products snapshot merge.  
**Verified:** Admin session shows **Showing 18 of 18** (no duplicate Job Lot grid).

---

## Bootstrap count

**Fix:** Rebuild after QA product removal → **18** in API and `data/catalog-bootstrap.json`.  
`node scripts/functional-audit.mjs` → all checks PASS.

---

## QA test product

`prod_1781126013156` — created for audit, **deleted** from Firestore. Catalog back to 18 products.

---

## Changed files (this release)

| File | Change |
|------|--------|
| `lib/server/inventory-stock.mjs` | NEW — stock decrement/restore/VIP |
| `lib/server/restock-notify.mjs` | NEW — server Notify Me processor |
| `lib/server/admin-audit-handlers.mjs` | NEW — P0 audit actions (in admin-auth) |
| `api/send-order.js` | Stock reserve before Telegram |
| `lib/server/save-shop-order.mjs` | Persist `stockAdjustments` |
| `lib/server/vip-handlers.mjs` | VIP stock decrement on order |
| `api/admin-auth.js` | `action=audit` route |
| `api/spam.js` | `process-restock-notify` action |
| `js/firebase-db.js` | Post-merge dedupe (DUP-002) |
| `js/firebase-db-admin.js` | Server restock notify trigger |
| `js/admin.js` | Server-side `processRestockNotifications` |
| `js/app.js` | Refresh catalog after order |
| `scripts/functional-audit.mjs` | Bootstrap + count checks |
| `scripts/p0-prod-audit.mjs` | Production P0 verification |
| `vercel.json` | Rewrite for process-restock-notify |
| `index.html` | Build `202606109720` |

---

## Data persistence

- **Firestore** is source of truth for products, orders, notifyRequests, vipStockItems
- **Orders** decrement stock atomically; `stockReservations` doc per order for rollback
- **Bootstrap JSON** refreshed on each `npm run build` / Vercel deploy
- **Cart** remains `localStorage` per browser

---

## Screenshot index

See `docs/qa-screenshots/` — P0-01…P0-08, P1-07/08, MOB-01…04.

---

## Commands

```bash
node scripts/functional-audit.mjs
node scripts/p0-prod-audit.mjs   # requires ADMIN_PASSWORD on server
npm run build && npx vercel --prod --yes
```
