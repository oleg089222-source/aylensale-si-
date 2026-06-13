# Design System V2 — Admin

Admin reskin (P2) layers DS tokens on top of legacy admin CSS. Business logic and API routes are unchanged.

## CSS load order (`js/admin-loader.js`)

1. `css/ds-v2-tokens.css`
2. Legacy admin CSS (`admin-dashboard.css`, `admin-modals.css`, panel CSS, …)
3. `css/ds-v2-admin-shell.css` — login modal, header toolbar
4. `css/ds-v2-admin-cms.css` — CMS shell, tables, product modals
5. `css/ds-v2-admin-panels.css` — discount codes, auction command, pickup form, visit cards
6. `css/ds-v2-admin-legacy-modals.css` — notify requests, client cards (auxiliary modals)

Later files override earlier ones. Do not reorder without checking specificity.

## Markup conventions

| Area | Classes (no inline styles) |
|------|----------------------------|
| Login modal | `admin-login-modal`, `aylen-admin-login-title`, `aylen-admin-login-subtitle`, `aylen-admin-login-remember`, `aylen-admin-login-submit`, `aylen-admin-login-cancel` |
| Header toolbar | `admin-toolbar`, `admin-toolbar-label`, `admin-toolbar-btn--*`, `admin-toolbar-badge` |

Login HTML is built in `js/admin-gate.js`. Toolbar HTML is built in `js/admin.js` (`addAdminModeUI`).

## Vercel Hobby limit (12 functions)

If deploy fails with “No more than 12 Serverless Functions”, consolidate a standalone `api/*.js` handler into an existing function and add a `vercel.json` rewrite (see `manifest-csv` → `admin-branding`).

## Deploy

```bash
cd AYLEN1/car-sales-uk
node scripts/bundle-storefront-css.mjs
node scripts/bundle-storefront-js.mjs
node scripts/vercel-build.mjs
node scripts/inline-catalog-bootstrap.mjs
npx vercel deploy --prod --yes
```

Bump `index.html` build stamp and `js/admin-loader.js` `VERSION` together after admin CSS/JS changes.

## QA (admin)

- Cmd/Ctrl+Shift+A → login modal (DS inputs, 44px targets)
- Full CMS shell — products table, add/edit modals
- Discount Codes panel — tier jars, bulk card
- Auction Command — stats, cards, detail panel
- Pickup form modal, Visit Cards section titles
- 375px and 1440px widths

See also `docs/ADMIN_DEPLOY_CHECKLIST.md`.
