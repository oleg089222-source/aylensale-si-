# AYLENSALE — Redesign backup & rollback (обязательно перед Phase 1–3)

## Текущая «стабильная» точка отката

| Что | Имя / путь |
|-----|------------|
| Локальный архив | `backups/aylensale-code-20260521-020608.tar.gz` (и новые через скрипт) |
| Git (в папке `car-sales-uk`) | branch `backup-before-redesign`, tag `stable-version-may-2026` |
| Firestore | Admin → **Backup** → JSON на диске |
| Vercel | Promote **предыдущий** Production deployment |

**Важно:** родительский репозиторий `aylensale-si` в `.gitignore` игнорирует `/AYLEN1/`.  
Git для сайта — **только внутри** `car-sales-uk/` (см. скрипт ниже).

### Одна команда — полный backup (на Mac)

```bash
cd "/Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk"
chmod +x scripts/create-redesign-backup.sh
bash scripts/create-redesign-backup.sh
```

**Production (live):** https://aylensale.com — не трогать, пока не проверили preview.

---

## Правило работы (3 фазы)

```
PHASE N → develop on branch → Vercel PREVIEW → test → backup → (optional prod)
```

Никогда не делать `--prod` сразу после большого redesign.

---

## 1. Полный backup кода (локально)

```bash
cd "/Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk"
bash scripts/backup-project.sh
```

Создаёт `backups/aylensale-code-<дата>.tar.gz` (без `.env.local` и `.vercel`).

Восстановление из архива:

```bash
cd "/Users/olegyuryevich/Desktop/aylensale-si/AYLEN1"
tar -xzf car-sales-uk/backups/aylensale-code-XXXXXXXX.tar.gz -C car-sales-uk-restored
```

---

## 2. Git — откат к стабильной версии

```bash
cd "/Users/olegyuryevich/Desktop/aylensale-si"

# Посмотреть тег
git show stable-version-may-2026 --oneline -s

# Вернуть только сайт (car-sales-uk)
git checkout stable-version-may-2026 -- AYLEN1/car-sales-uk/

# Или переключиться на ветку backup целиком
git checkout backup-before-redesign
```

После checkout — **Redeploy** на Vercel (см. ниже).

---

## 3. Vercel — откат production за 1–2 минуты

### Вариант A — Dashboard (рекомендуется)

1. [vercel.com](https://vercel.com) → проект **aylensale**
2. **Deployments**
3. Найдите deployment с пометкой **Production** и датой **до redesign**
4. **⋯** → **Promote to Production** (или **Instant Rollback**)

Запишите URL стабильного деплоя в таблицу ниже.

### Вариант B — CLI

```bash
cd "/Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk"
npx vercel ls
# Promote нужный deployment:
npx vercel promote <deployment-url-or-id> --yes
```

### Записать стабильный production (сделайте один раз)

| Поле | Значение |
|------|----------|
| Production URL | https://aylensale.com |
| Stable deployment ID | _заполните из Vercel после Promote_ |
| Дата фиксации | May 2026 |
| Git tag | `stable-version-may-2026` |

---

## 4. Preview / staging (не ломает live)

```bash
cd "/Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk"

# Preview URL (каждый push/деплой без --prod)
npx vercel

# Локально + API
bash scripts/backup-project.sh   # перед началом фазы
node scripts/local-test-server.mjs
# http://127.0.0.1:3340
```

Ветки для фаз (создавать от `backup-before-redesign`):

| Phase | Branch | Содержание |
|-------|--------|------------|
| 1 | `redesign/phase-1-hero` | Hero, header, live bar |
| 2 | `redesign/phase-2-marketplace` | Cards, `product.html`, auctions rail, catalog filters |
| 3 | `redesign/phase-3-pickup-footer` | Pickup, footer, polish |

После каждой фазы:

```bash
bash scripts/backup-project.sh
git add AYLEN1/car-sales-uk
git commit -m "backup: after phase N test"
git tag backup-after-phase-N-$(date +%Y%m%d)
```

---

## 5. Firestore backup (данные)

Код ≠ данные. Перед prod deploy:

1. Сайт → Admin → **Backup**
2. Сохранить `aylensale-backup-YYYY-MM-DD.json`

---

## 6. Roadmap (кратко)

### PHASE 1 — Hero / top
- Premium dark hero, warehouse visual
- Cleaner header, live activity bar
- Mobile-first
- **Не трогать** product grid в этой фазе

### PHASE 2 — Marketplace middle
- Product cards (уже частично в `products-section.css`)
- Отдельная product page по клику
- Auctions horizontal + countdown
- Filters

### PHASE 3 — Pickup / footer
- Pickup cards GREEN/ORANGE/GREY
- Weather block
- Premium footer + live indicators

### Admin & AI (параллельно, только на staging)
- AI assistant, image persistence, admin modals
- Telegram bot (отдельная задача)

---

## 7. Если новый дизайн не понравился

1. **Vercel:** Promote старый Production deployment (самое быстрое)
2. **Git:** `git checkout stable-version-may-2026 -- AYLEN1/car-sales-uk/` → redeploy
3. **Локально:** распаковать `backups/aylensale-code-*.tar.gz`
4. **Данные:** импорт JSON backup при необходимости

---

## 8. Production deploy (только после OK на preview)

```bash
cd "/Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk"
bash scripts/backup-project.sh
npx vercel --prod
```

Hard refresh: **Cmd+Shift+R**
