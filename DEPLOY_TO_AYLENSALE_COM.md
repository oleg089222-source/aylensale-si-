# 🚀 DEPLOYMENT НА HTTPS://WWW.AYLENSALE.COM

**Цель:** Развернуть рабочий сайт на кастомном домене с Vercel

---

## 📋 ШАГ 1: Создайте GitHub репо (2 минуты)

1. Откройте: https://github.com/new
2. **Авторизуйтесь** как `oleg089222-source` (если не авторизованы)
3. Заполните форму:
   ```
   Repository name: aylensale-si
   Description: AylenSale - Car Auction Platform
   Public: ✓
   Add .gitignore: Node (или пропустите)
   Add license: пропустите
   ```
4. Кликнете **"Create repository"**

✅ После создания GitHub скопирует вас на страницу репо

---

## 📋 ШАГ 2: Отправьте код на GitHub (1 минута)

В терминале выполните:

```bash
cd /Users/olegyuryevich/Desktop/aylensale-si

# Переключитесь на HTTPS (проще, чем SSH)
git remote set-url origin https://github.com/oleg089222-source/aylensale-si.git

# Отправьте код
git push -u origin main
```

✅ Код будет на GitHub!

---

## 📋 ШАГ 3: Создайте Vercel проект (3 минуты)

1. Откройте: https://vercel.com/new
2. **Авторизуйтесь** через GitHub
3. Выберите репо: `aylensale-si`
4. Нажмите **"Import"**
5. Vercel начнёт деплой (2-3 минуты)
6. Получите URL: https://aylensale-si.vercel.app

✅ Сайт работает на Vercel!

---

## 📋 ШАГ 4: Добавьте переменные окружения (1 минута)

В Vercel Dashboard:

1. Перейдите: **Settings → Environment Variables**
2. Добавьте 2 переменные:

```
Имя: NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
Значение: 8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY
Для: Production, Preview, Development
```

```
Имя: NEXT_PUBLIC_TELEGRAM_CHAT_ID
Значение: [ваш chat ID от @aylensale_bot]
Для: Production, Preview, Development
```

3. Сохраните
4. Перейдите на **Deployments** и нажмите **"Redeploy"** (последний deploy)

✅ Telegram работает!

---

## 📋 ШАГ 5: Подключите домен AYLENSALE.COM (2 минуты)

В Vercel Dashboard:

1. Перейдите: **Settings → Domains**
2. Нажмите **"Add"**
3. Введите: `www.aylensale.com`
4. Выберите: **"Use Nameservers"**
5. Vercel покажет DNS записи (4 NS записи)
6. Скопируйте эти NS записи

---

## 📋 ШАГ 6: Обновите DNS (5 минут)

На сайте где куплен домен (GoDaddy, Namecheap и т.д.):

1. Найдите **"DNS Settings"** или **"Nameservers"**
2. Замените текущие NS на 4 записи от Vercel:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ns3.vercel-dns.com
   ns4.vercel-dns.com
   ```
3. Сохраните

⏳ Ждите 10-30 минут (DNS распространяется)

---

## 📋 ШАГ 7: Проверьте домен (10 минут после DNS)

1. Откройте: https://www.aylensale.com
2. Должен загрузиться ваш сайт! ✅
3. Проверьте всё:
   - Кнопка Admin работает (пароль: aylen2026)
   - Товары добавляются
   - Telegram уведомления приходят
   - Скидка 10% считается

---

## 🎯 ИТОГОВЫЙ CHECKLIST

- [ ] GitHub репо создано
- [ ] Код отправлен на GitHub (`git push`)
- [ ] Vercel проект создан
- [ ] Переменные Telegram добавлены
- [ ] Сайт работает на vercel.app
- [ ] Домен aylensale.com подключен к Vercel
- [ ] DNS NS записи обновлены
- [ ] Сайт открывается на www.aylensale.com
- [ ] Админка работает
- [ ] Telegram работает

---

## 🔗 ССЫЛКИ

- **GitHub репо:** https://github.com/oleg089222-source/aylensale-si
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Сайт (после DNS):** https://www.aylensale.com

---

## ⚠️ ВАЖНО

- DNS распространяется 10-30 минут
- HTTPS сертификат создастся автоматически (Vercel)
- После изменения DNS проверяйте несколько раз (браузер может кэшировать)

---

**НАЧНИТЕ СО STEP 1! 🚀**
