# QA Bug Register

**Branch:** `qa/stabilization`  
**Legend:** `open` | `fixing` | `fixed` | `verified-preview` | `verified-prod` | `wontfix`

| ID | P | Status | Area | Summary |
|----|---|--------|------|---------|
| AUC-001 | P0 | fixed | Auctions | Timer loop calls `renderAuctions()` every second after end |
| PRD-001 | P0 | fixed | product.html | Missing `#checkoutModal` |
| PRD-002 | P0 | fixed | product.html | Missing modal CSS (cart/checkout invisible) |
| PRD-003 | P0 | fixed | Checkout | `openStatic('checkoutModal')` no-op without DOM |
| PRD-004 | P1 | fixed | product.html | Product not in first page — no `loadProductById` |
| PRD-005 | P1 | fixed | Catalog | `refreshCatalogFirstPage` replaces full `products` array |
| PRD-006 | P1 | fixed | product.html | Double init / loading flash |
| MOD-001 | P1 | fixed | Product cards | Save/carousel inside `<a>` — invalid HTML |
| CAR-001 | P2 | fixed | Cart | Duplicate qty change on mobile (onclick + ontouchend) |
| CAR-002 | P2 | fixed | Cart | Weak dedupe in `normalizeCart` |
| CAR-003 | P2 | fixed | Cart | No stock cap on `addToCart` |
| MOD-002 | P2 | fixed | Modals | `admin-modal-open` on storefront cart |
| ADM-002 | P1 | fixed | Admin | `closeAll` on product delete closes everything |
| DUP-001 | P0 | verified-prod | Catalog | Public API deduped; legacy doc pair not in catalog response |
| DUP-002 | P0 | verified-prod | Catalog | Post-merge dedupe; admin shows 18 of 18, no duplicate cards |
| UPL-001 | P0 | fixing | Admin upload | Byte % progress + retry added; not screenshot-verified |
| STOCK-001 | P0 | verified-prod | Stock | send-order decrements Firestore; VIP order decrements vipStockItems |
| NTF-001 | P0 | verified-prod | Notify Me | Server restock notify — Telegram + email/fallback on 0→stock |
| ADM-003 | P0 | verified-prod | Admin CRUD | Create/edit persist; QA product removed after audit |
| CAT-001 | P1 | verified-prod | Catalog | Bootstrap 18 matches API 18 after rebuild |
| ADM-004 | P0 | open | Admin UX | Loading overlay stuck after login — code fixed in admin-gate.js; needs manual verify on prod |
| CAT-001 | P1 | open | Catalog | Load-more + admin refresh confusion |
| AUC-002 | P1 | open | Auctions | Optimistic duplicate auction push |
| IMG-001 | P1 | open | Images | `sanitizeProductImageUrls` empties arrays |
| ADM-001 | P1 | open | Admin | Email vs username login mismatch |
| CSS-001 | P2 | open | CSS | Grid breakpoint wars index vs products-section.css |
| MOB-001 | P2 | fixing | Mobile | product.html cart modal safe area |
| PRD-007 | P3 | open | Saved | savedItems id type mismatch |
| PERF-001 | P2 | open | perf-lite | Reveal disabled on mobile |
| PRD-010 | P1 | fixed | product.html | White flash on load — critical dark CSS + skeleton |
| PRD-011 | P1 | fixed | product page | Premium gallery: arrows, thumbs, swipe, lightbox, counter |
| PRD-012 | P2 | fixed | product page | Skip auctions/locations render on product page |

---

## Detail (P0/P1)

### AUC-001 — Auction timer rebuild loop
- **Repro:** Ended auction on home; watch Network/DOM for 1s interval full re-render
- **Files:** `js/app.js` `startAuctionTimers`
- **Fix:** Update timer text only; finalize once per auction id

### PRD-001–003 — product.html checkout broken
- **Repro:** product page → cart → Order
- **Files:** `product.html`, `css/storefront-modals.css`
- **Fix:** Mirror cart/checkout modals + shared modal CSS

### PRD-004 — Deep link product not loaded
- **Repro:** `/product.html?id=<id>` where id not in first Firestore page
- **Files:** `js/product-page.js`
- **Fix:** `FBDB.loadProductById` + merge into catalog

### PRD-005 — Catalog wiped on refresh
- **Repro:** Load more → admin refresh catalog
- **Files:** `js/firebase-db.js` `refreshCatalogFirstPage`
- **Fix:** `merge: true` instead of replace

### MOD-001 — Controls inside anchor
- **Repro:** Tap ★ or carousel on card (Safari)
- **Files:** `js/app.js` `renderProducts`
- **Fix:** Link wraps image only; actions outside

---

*Update Status column after each verified retest.*
