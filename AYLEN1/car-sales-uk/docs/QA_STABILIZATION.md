# AYLENSALE — Deep QA & Stabilization (pre-production)

**Mindset:** polish the system, not ship features fast.  
**Branch:** `qa/stabilization` (from `redesign/phase-2-marketplace`)  
**Production:** only after sign-off on this checklist.

---

## Rules (non-negotiable)

1. **Backup before each fix cycle** — `bash scripts/create-redesign-backup.sh`
2. **Git branch** — work on `qa/stabilization`; merge only after regression pass
3. **Deploy** — `npx vercel` (preview) → manual QA → then `npx vercel --prod`
4. **Rollback** — `docs/REDESIGN_ROLLBACK.md` + Vercel Promote previous Production
5. **One fix → one retest** — update `docs/QA_BUG_REGISTER.md` status

---

## Workflow

```
BACKUP → FIX (by priority) → PREVIEW DEPLOY → RETEST affected + regression → repeat
         ↓
    All P0/P1 closed + regression green → PROD CANDIDATE → full manual pass → PROD
```

### Fix cycle (each bug)

| Step | Action |
|------|--------|
| 1 | Pick bug from register (P0 first) |
| 2 | Implement minimal fix |
| 3 | Note files + commit message |
| 4 | Preview deploy |
| 5 | Retest bug steps + 5 min regression (cart, modals, one product, one auction) |
| 6 | Mark `fixed` / `verified-preview` in register |

---

## Manual test matrix

### Devices & browsers

| | Chrome | Safari |
|---|--------|--------|
| Desktop 1440px | ☐ | ☐ |
| Tablet 768px | ☐ | ☐ |
| Mobile 390px | ☐ | ☐ |

### Storefront (`/` + `product.html`)

| Area | Checks |
|------|--------|
| Header | Logo, nav, card login, cart count, eBay link |
| Hero / live bar | Loads, counts update, no layout jump |
| Products | Grid, filters, search, sort, load more, card → product page |
| Product page | Gallery, thumbs, add to cart, checkout, back link |
| Cart | Add/remove/qty, total, empty state, mobile safe area |
| Checkout | Form, pickup select, honeypot, submit |
| Auctions | Horizontal scroll, timer, bid modal, no flicker/rebuild loop |
| Pickup | Cards, weather, scroll row |
| Footer / legal | Links, cookie banner |
| Floats | Telegram, WhatsApp |
| Bottom nav | All targets, cart button |

### Admin

| Area | Checks |
|------|--------|
| Login | Triple-click logo / credentials |
| Products | Add, edit, photos, delete (modals don’t kill unrelated UI) |
| Auctions | CRUD, finalize, bids |
| Pickup | Locations, active toggle |
| AI assistant | Translate, save settings (staging) |
| Backup | Export JSON |

### Persistence

| Data | Verify |
|------|--------|
| Firestore | Product save survives refresh |
| Cart | `localStorage` + session |
| Card login | Discount applies |
| Images | Broken URL → fallback, not blank card |

### Performance

| Check | Pass criteria |
|-------|----------------|
| Scroll | No jank on product grid (mobile) |
| Auction timer | No full grid rebuild every second |
| Modals | Open/close < 200ms feel, no stuck scroll |
| Images | Lazy load, no flash loop on carousel |

---

## Regression smoke (5 min, after every fix)

1. Home → open cart → close  
2. Add product → checkout modal opens → cancel  
3. Open product page → add to cart → order flow visible  
4. One auction — timer ticks, no console spam  
5. Admin login → edit product modal → close  

---

## Production readiness gate

All must be **yes**:

- [ ] P0 = 0 open  
- [ ] P1 = 0 open (or documented accept)  
- [ ] Full matrix above checked on Chrome + Safari mobile  
- [ ] Preview URL signed off by owner  
- [ ] Firestore backup taken  
- [ ] Stable Vercel deployment ID recorded in `REDESIGN_ROLLBACK.md`  
- [ ] `npx vercel --prod` + hard refresh verified  

---

## Local QA commands

```bash
cd "/Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk"
bash scripts/create-redesign-backup.sh
node scripts/local-test-server.mjs
# http://127.0.0.1:3340 — API routes work (not python http.server)
npx vercel   # preview
```

---

## Related docs

- Bug register: `docs/QA_BUG_REGISTER.md`
- Rollback: `docs/REDESIGN_ROLLBACK.md`
