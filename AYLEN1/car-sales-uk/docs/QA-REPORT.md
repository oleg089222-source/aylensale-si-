# QA Report — 28 May 2026

## Метод

- Локальная сборка: `npm run build` → `public/`
- Автопроверка в браузере: http://127.0.0.1:8765/
- Viewports: desktop / tablet / mobile (ручная + browser resize)

---

## Найдено и исправлено в коде

| Проблема | Было | Исправление |
|---------|------|-------------|
| Админ-формы не открывались | `body.aylen-admin-cms-active` скрывал все `.modal` и `#aylen-modal-root` | Скрывается только витрина; модалки CMS `z-index: 10200` |
| Пустой экран при +Product | `admin-modal-open` прятал `#aylenAdminShell` | Shell остаётся видимым (затемнён) внутри CMS |
| Погода «непонятная» | `icon.emoji` undefined, `weekendClass` undefined | FA-иконки, Apple-style блок, дни Saturday/Sunday |
| Card # не та кнопка | `fa-arrow-right` | `fa-ticket` + Code |
| Низ сайта не скроллится | `overflow:hidden` после CMS / modal-locked | Сброс классов при `close()` CMS |
| Cart снизу лишний | bottom-nav Cart + cart-float-bar | Удалены из HTML + CSS hide |
| Mobile nav «размазан» | `grid repeat(6)` при 3 пунктах | `repeat(3)` на mobile |
| Товары огромные | Inline `height:260–300px` в index.html | `storefront-layout-fix.css` перебивает: max ~190px, 1:1 |
| PWA блокирует desktop QA | Popup через 12s на всех | Auto-popup только &lt;1025px |
| Pickup save без сессии | Нет `ensureAdminSession` | Добавлено в `persistLocation` |
| Branding «не работает» | Нет пароля в sessionStorage | `ensureBrandingAuth()` + подсказка войти снова |
| openAddLocation без auth | Сразу форма | `ensureAdminCanWrite()` |
| Pickup Edit/Quick/Delete не работали | `onclick="fn("id")"` — кавычки ломали HTML | `onclick='fn("id")'` через `onclickAttr()` |
| Branding Regenerate 500 | Отсутствовал `api/lib/firestore-admin.mjs` | Файл добавлен + понятные 400/404 |
| Esc в CMS закрывал всю панель | Не проверялся открытый `#aylen-modal-root` | Esc сначала закрывает модалку |

---

## Прогон витрины — раунд 1 (28 May 2026, ~02:00 UTC)

**Локально:** `http://127.0.0.1:8765/`  
**Прод:** `https://aylensale.com/?qa=prod-round1`

| Тест | Desktop | Tablet (834×1194) | Mobile (390×844) | Prod |
|------|---------|-------------------|------------------|------|
| Загрузка, 13 products | PASS | PASS | PASS | PASS |
| Header Card # + Code (ticket) | PASS | PASS | PASS | PASS |
| Bottom nav: Products / Auctions / Pickup (без Cart) | PASS | PASS | PASS | PASS |
| Скролл до Auctions + Pickup + Footer | PASS | PASS | PASS | PASS |
| Add to Cart → модалка корзины | PASS | — | — | — |
| Pickup: 2 карточки, Google Maps, легенда weekend | PASS | PASS | — | PASS |
| Auction ended + Claim winning order | PASS | — | — | PASS |
| PWA «Later» закрывается | PASS | — | — | PASS (tablet viewport) |
| PWA на desktop ≥1025px не всплывает автоматически | PASS | — | — | не проверено (viewport браузера) |

**Заметки раунда 1**

- На проде и локально витрина совпадает по данным (13 товаров, 1 аукцион, 2 pickup).
- Корзина только в шапке (`Open cart`), нижней плавающей корзины нет.
- Админ CRUD (Products / Pickup / Branding / Settings) — **не тестировался** (нужен ваш пароль).
- Следующие раунды QA — по запросу «stop» или продолжение цикла.

---

## Требует проверки на production (с вашим паролем)

1. **Branding** — Save → иконки на `/api/manifest` (Vercel `ADMIN_PASSWORD`)
2. **Pickup** — Add/Edit/Delete + фото → Firestore → витрина
3. **Products** — Add/Edit/Delete + фото → счётчик stock
4. **Синхронизация** — изменение в CMS → закрыть CMS → витрина обновлена

---

## Следующий шаг

```bash
cd .../car-sales-uk && ./scripts/deploy-prod.sh
```

Пройти `docs/QA-TEST-PLAN.md` фазы A → B → C и дописать PASS/FAIL в этот файл.
