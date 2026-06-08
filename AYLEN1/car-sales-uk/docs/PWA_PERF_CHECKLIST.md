# AYLENSALE — PWA & performance checklist (pre-production)

## Public vs admin bundles

- **Public** (`index.html`): Firebase, catalog, cart, auctions, pickup, discount engine, PWA install, `admin-gate` + `admin-loader` only (~2 small files).
- **Admin** (lazy after login): `admin.js`, dashboard, AI, pickup admin form, price list & discount panels, Cloudinary upload helpers.

Verify in DevTools → Network (disable cache): public visit should **not** request `admin.js`, `admin-dashboard.js`, `ai-settings.js`, `admin-ai-assistant.js`, `pickup-admin-form.js`, `admin-price-list-panel.js`, `admin-discount-cards-panel.js`.

## Lighthouse (mobile)

1. Open https://aylensale.com (or preview URL) in Chrome Incognito.
2. DevTools → Lighthouse → Mobile → Performance + PWA.
3. Targets: Performance ≥ 75, PWA installable, no render-blocking admin JS.

## PWA install smoke tests

| Device | Browser | Steps |
|--------|---------|--------|
| iPhone | Safari | Add to Home Screen; icon = metallic A on dark; offline opens `offline.html` |
| Android | Chrome | Install app prompt; maskable icon crops safely |
| MacBook | Chrome | Install from omnibox; standalone window |
| Windows | Chrome | Same as Mac |

## Icons (regenerate after SVG change)

```bash
cd AYLEN1/car-sales-uk
node scripts/generate-brand-icons.mjs
```

Expected files: `favicon.ico`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `maskable-192.png`, `maskable-512.png`.

Regenerate after SVG edits:

```bash
node scripts/generate-brand-icons.mjs
```

## Must not break

- [ ] Products load and paginate
- [ ] Stock badges update
- [ ] Auctions bid / winner flow
- [ ] Discount code via `/api/validate-discount` (needs `FIREBASE_SERVICE_ACCOUNT` on Vercel)
- [ ] Admin login → panel → products / pickup / cards / backup
- [ ] Firebase real-time auctions & locations

## Service worker

After deploy, hard-refresh twice or Application → Clear storage → unregister old SW (current: `aylen-pwa-v3`). Reinstall PWA on phone/desktop so the home-screen icon updates.
