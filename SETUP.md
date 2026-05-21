# Настройка AYLENSALE

## Учётные данные (ваши)

| Сервис | Значение |
|--------|----------|
| Vercel | `olegyuryevich-5608s-projects` / `olegyuryevich-5608` |
| Email | `oleg.yuryevich@gmail.com` |
| Telegram бот | [@aylensale_bot](https://t.me/aylensale_bot) |
| Admin пароль сайта | `159357Oleg` (в `.env.local` и Vercel) |

Старый пароль `admin2024` в коде **не используется** — только `ADMIN_PASSWORD` из env.

---

## 1. Telegram CHAT_ID

1. Откройте [@aylensale_bot](https://t.me/aylensale_bot) → **Start** (`/start`)
2. В терминале:
   ```bash
   npm run setup:telegram-chat
   ```
3. Скопируйте `TELEGRAM_CHAT_ID=...` в `.env.local`

Токен бота уже в `.env.local` (`TELEGRAM_BOT_TOKEN`).

---

## 2. Vercel

```bash
npx vercel login
# email: oleg.yuryevich@gmail.com

# после TELEGRAM_CHAT_ID в .env.local:
npm run vercel:env
npx vercel --prod
```

Домен: Vercel → **aylensale-si** → Settings → Domains → `aylensale.com`

---

## 3. Firebase rules

```bash
npx firebase login
npm run firebase:rules
```

---

## 4. Локально

```bash
npm run dev
```

Admin → пароль: **159357Oleg**

---

## 5. Удалить остаток (если есть)

```bash
sudo rm -rf aylensale-com
```

---

## 6. Git push

```bash
git push origin main
```
