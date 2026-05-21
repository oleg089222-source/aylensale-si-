# AYLENSALE — Safe development workflow

This project is **incrementally improved**, not rebuilt. Production data (Firestore, Storage, Firebase config) stays the source of truth.

## Before any code change

1. **Code backup** (local):
   ```bash
   cd "/Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk"
   bash scripts/backup-project.sh
   ```
2. **Firestore backup** (admin, after login):
   - Open site → Admin → **Backup** (or Admin Panel → Backup)
   - Saves `aylensale-backup-YYYY-MM-DD.json` (products, auctions, locations, cards, siteSettings, listingPolicies)
3. **Work on staging branch**, not `main` directly:
   ```bash
   cd "/Users/olegyuryevich/Desktop/aylensale-si"
   git checkout -b staging/admin-improvements
   ```

## Environments

| Environment | How to run | Writes to Firestore |
|-------------|------------|---------------------|
| **Local** | `python3 -m http.server 8765` in `car-sales-uk` | Same project `aylensale` — treat as staging |
| **Vercel preview** | `npx vercel` from `car-sales-uk` (not home dir) | Staging UI; same Firebase unless you use a separate project |
| **Production** | https://aylensale.com | Live data — test on local/preview first |

Runtime banner: `js/runtime-env.js` shows **STAGING** on localhost/preview and a caution strip on production.

## Rollback

1. Restore code: `git checkout main -- AYLEN1/car-sales-uk/`
2. Redeploy previous Vercel deployment from dashboard
3. Firestore: re-import from JSON backup (manual; contact admin with backup file)

## Phase status (roadmap)

| Phase | Topic | Status |
|-------|--------|--------|
| 1 | Save stability (price, stock, photos, duplicates) | Done in `firebase-db.js`, `admin.js` — verify on staging |
| 2 | Responsive product cards | CSS in `index.html` — verify MacBook 3-col grid |
| 3 | Read more / Show less descriptions | `renderProductDescriptionBlock` in `app.js` |
| 4 | Admin sidebar (lite, paginated) | `js/admin-dashboard.js` |
| Perf | Paging, lazy images, no full product listener | `firebase-catalog.js`, `image-utils.js`, `perf-mode.js` |
| 5 | Products table, bulk actions | Admin Panel → Products |
| 6 | Product editor sections | Existing edit modal + dashboard **Edit** |
| 7 | Listing policies | `listing-policies.js` + Firestore `listingPolicies` |
| 8 | Catalog pagination / filters | `catalog-pagination.js` |
| 9 | Auction bid history | `app.js` + admin modal |
| 10 | This document + backups | Ongoing |

## Deploy checklist (production)

```bash
# 1. Firestore rules (parent repo)
cd "/Users/olegyuryevich/Desktop/aylensale-si"
firebase deploy --only firestore:rules

# 2. Site (from car-sales-uk only)
cd AYLEN1/car-sales-uk
npx vercel --prod --yes
```

Hard-refresh after deploy (cache-bust `?v=` on script tags).

## Do not break

- Firebase project `aylensale` and existing collections
- Uploaded Storage images
- Admin auth (`/api/admin-auth`)
- Telegram order/notify APIs
- Domain and SEO URLs
