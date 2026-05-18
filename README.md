# AYLENSALE

Единый production-сайт на **Next.js 16**: каталог товаров, car boot локации с погодой, карта, админ-панель.

## Стек

- Next.js 16 (App Router)
- Firebase Firestore + Storage (проект `aylensale`)
- Telegram уведомления через `app/api/telegram`
- Деплой: Vercel → [aylensale.com](https://aylensale.com)

## Локальный запуск

```bash
cp .env.example .env.local
# заполните .env.local (см. VERCEL_ENV.md)
npm install
npm run dev
```

## Сборка

```bash
npm run build
```

## Структура

```
app/
  components/   # UI
  lib/          # Firebase, Firestore, Storage, weather
  api/          # telegram, admin/verify
```

Резервная копия до очистки: ветка `backup/pre-single-app-2026-05-18`.
