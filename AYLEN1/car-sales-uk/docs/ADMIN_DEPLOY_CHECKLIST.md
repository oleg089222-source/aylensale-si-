# AYLENSALE Admin — deploy checklist

## Preview (`npx vercel`)

1. **Admin login** — Cmd/Ctrl+Shift+A → password → full-screen dark CMS (no storefront hero/cart in background).
2. **Public header** — no Admin / Backup / App Icon / Codes buttons.
3. **Products** — table loads, search, edit, hide/show, duplicate.
4. **Branding / App Icon** — upload PNG/JPG/WEBP → local preview → Preview icons → Save branding → check `<link rel="apple-touch-icon">` and manifest point to `/api/manifest?v=…`.
5. **Discount Codes** — create, random, copy, WhatsApp (needs phone), expiry column.
6. **Storefront** — products &lt;3s, cart, auctions, pickup, Enter code + ticket icon, PWA install.

## Production (`npx vercel --prod`)

Same checks on https://aylensale.com after hard refresh (Cmd+Shift+R).

### Vercel env (required)

- `ADMIN_PASSWORD`
- `FIREBASE_SERVICE_ACCOUNT`

### If branding save fails

- Run via `npx vercel dev` locally, or deploy preview first.
- Confirm Storage + Firestore rules allow service account writes to `siteSettings/branding`.
