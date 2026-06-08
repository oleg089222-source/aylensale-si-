# AYLENSALE — отчёт стабилизации (Phase 0 + Phase 1)

**Дата:** 2026-05-26  
**Режим:** только preview / staging — **production не трогаем** без вашего OK.

---

## Phase 0 — Аудит (без deploy)

### Что уже хорошо

| Область | Статус |
|--------|--------|
| Server-side stock | `api/send-order.js` — Firestore transaction, `stockReservations`, rollback при ошибке Telegram |
| Product grid | `renderProducts` — DOM по карточкам, не один giant innerHTML на весь grid |
| Lazy images | `AYLEN_IMAGES.lazyImgAttrs()` на карточках |
| Contact UI (частично) | `#contactFloat` + FAB на mobile, click outside в `mobile-ui.js` |
| Admin CMS | отдельный full-screen shell (не смешан с витриной) |

### Найденные проблемы

| # | Проблема | Severity | Где |
|---|----------|----------|-----|
| 1 | На **desktop** contact — **две отдельные** кнопки TG/WA всегда видны (FAB скрыт) | High | `css/contact-float.css` |
| 2 | Корзина только в header/modal — после Add to Cart нет sticky preview | High | `js/app.js`, `index.html` |
| 3 | `changeQty(+1)` **не проверяет stock** (только `addToCart`) | High | `js/app.js` |
| 4 | При `stock_unavailable` от API checkout **не обновляет** каталог/корзину | Medium | `submitOrder` xhr handler |
| 5 | `renderProducts` всё ещё `grid.innerHTML = ''` + полный rebuild при каждом listener | Medium | `js/app.js` |
| 6 | Нет `firestore.rules` в репозитории — правила только в Firebase Console (риск audit) | Medium | repo |
| 7 | Нет `npm run lint` / `npm run build` | Low | `package.json` |
| 8 | Inline CSS в `index.html` (~700 строк) конфликтует с `contact-float.css` | Medium | `index.html` |
| 9 | Bottom nav: отдельные TG/WA на desktop width | Low | `index.html` |
| 10 | Админка / недавние CMS-изменения — риск регрессии на prod | High | operational |

### Responsive (code review)

- **390px:** bottom nav + login-box + hero — правки в `mobile-marketplace.css`; риск overflow в длинных названиях карточек (`PRODUCT_CARD_TITLE_MAX_CHARS`).
- **Tablet 768px:** contact и cart могут пересекаться в правом нижнем углу.
- **iPhone Safari:** safe-area учтён в contact-float; cart float добавляется в Phase 1.

---

## Phase 1 — План исправлений (этот PR / preview)

### Задача A — Одна floating contact button (все breakpoints)

**Affected files:** `css/contact-float.css`, `js/mobile-ui.js`  
**Risk:** Low  
**Rollback:** revert 2 files  

### Задача B — Sticky cart bar (mobile)

**Affected files:** `js/app.js`, `css/mobile-marketplace.css`, `index.html` (markup)  
**Risk:** Medium (z-index / overlap)  
**Rollback:** revert 3 files  

**UX:** полоска над bottom nav: `Cart (N) · £subtotal` + кнопка «View cart»; при Add to Cart на mobile — авто-открытие cart modal.

### Задача C — Stock client guards + checkout errors

**Affected files:** `js/app.js`  
**Risk:** Low  
**Rollback:** revert `app.js`  

Server stock уже в `send-order.js`; дополняем клиент и обработку `code: stock_unavailable`.

### Задача D — npm scripts (smoke)

**Affected files:** `package.json`  
**Risk:** None  

---

## Phase 1 — выполнено в коде (2026-05-26)

### Изменённые файлы

| Файл | Что сделано |
|------|-------------|
| `css/contact-float.css` | Одна FAB на всех экранах; popup TG/WA; backdrop |
| `js/mobile-ui.js` | Закрытие по backdrop / Escape |
| `index.html` | Backdrop, cart float bar, cache bump |
| `css/mobile-marketplace.css` | Стили sticky cart bar |
| `js/app.js` | Cart float, stock в changeQty/checkout, auto-open cart mobile |
| `package.json` | `npm run lint` / `npm run build` |
| `scripts/smoke-check.mjs` | Статический smoke |
| `firestore.rules.example` | Шаблон правил (не deployed) |
| `docs/QA_STABILIZATION_REPORT.md` | Этот отчёт |

### Что не исправлено (Phase 2)

- Инкрементальный re-render карточек (без `grid.innerHTML = ''`)
- Полный responsive pass 390px / tablet в браузере
- Firestore rules deploy в Firebase Console
- Discount cards UI
- Admin panel regressions (отдельный трек)

### Тесты

```bash
npm run lint   # OK
npm run build  # OK
```

### Preview deploy (только вы)

```bash
cd "/Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk"
npx vercel --yes
```

**Preview URL:** подставьте URL из вывода Vercel после deploy.

---

## Phase 2 (следующий preview, не в этом коммите)

- Инкрементальный patch карточек в `renderProducts` (без full grid clear)
- `firestore.rules` в repo + документация deploy rules
- Product card CSS: max-height title, overflow ellipsis audit
- Discount cards UI polish
- Lighthouse / Firebase read audit

---

## Rollback plan (preview)

```bash
cd "/Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk"
git checkout -- css/contact-float.css css/mobile-marketplace.css js/app.js js/mobile-ui.js index.html package.json
npx vercel --yes   # redeploy previous commit if needed
```

Или **Vercel → Deployments → Promote** предыдущий зелёный preview.

---

## Manual testing checklist (после preview deploy)

- [ ] Desktop 1440px — одна Contact FAB → popup TG/WA → закрытие кликом снаружи
- [ ] Mobile 390px — contact не перекрывает cart float и Add to Cart
- [ ] Add to Cart → cart bar виден, modal открывается (mobile)
- [ ] 2 вкладки: последний товар — один заказ OK, второй получает ошибку stock
- [ ] Products, filters, Load More, auctions, pickup
- [ ] Enter code + cart checkout
- [ ] iPhone Safari + Android Chrome
- [ ] Нет admin-кнопок в public header

---

## Production approval checklist

- [ ] Preview URL проверен вами 24h+
- [ ] Stock race test пройден
- [ ] Явное сообщение «Deploy to production approved»

**Preview deploy (только вы):**

```bash
cd "/Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk"
npx vercel --yes
```
