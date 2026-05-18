# Настройка AYLENSALE (6 шагов)

## 1. Telegram — новый токен

1. Откройте [@BotFather](https://t.me/BotFather)
2. `/mybots` → ваш бот → **Revoke current token** → скопируйте **новый** токен
3. Напишите боту `/start` в Telegram
4. Получите chat id:
   ```bash
   TELEGRAM_BOT_TOKEN=новый_токен ./scripts/telegram-get-chat-id.sh
   ```

## 2. Vercel — переменные

```bash
npx vercel login
# заполните .env.local (см. ниже)
chmod +x scripts/setup-vercel-env.sh
./scripts/setup-vercel-env.sh .env.local
```

## 3. Firebase — правила

```bash
npm install
npx firebase login
chmod +x scripts/deploy-firebase-rules.sh
./scripts/deploy-firebase-rules.sh
```

Или вручную: Firebase Console → Firestore/Storage → Rules → вставьте `firestore.rules` / `storage.rules`.

## 4. Локально `.env.local`

Скопируйте `.env.example` и заполните все поля (уже частично в `.env.local`).

## 5. Удалить остаток aylensale-com

```bash
sudo rm -rf aylensale-com
```

(если `Operation not permitted` на `.claude` в node_modules)

## 6. Деплой

```bash
git checkout main
git merge refactor/single-aylensale-app
git push origin main
npx vercel --prod
```

Домен: Vercel → Project → Settings → Domains → `aylensale.com`
