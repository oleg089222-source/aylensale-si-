# 🚀 DEPLOYMENT НА HTTPS://WWW.AYLENSALE.COM

**Статус**: Код полностью готов к deployment  
**Версия**: Production Ready (Next.js 16 + React 19 + Admin Panel + Photo Upload)  

---

## 📋 БЫСТРЫЙ DEPLOY (5 минут)

### СПОСОБ 1: Через Vercel Web UI (РЕКОМЕНДУЕТСЯ)

**Шаг 1: Создайте GitHub репо вручную**
1. https://github.com/new
2. **Repository name**: `aylensale-si`
3. **Description**: AylenSale Car Boot Planner with Admin Panel
4. Оставьте остальное как есть
5. **Create repository**

**Шаг 2: Загрузите файлы на GitHub**
1. На странице нового репо нажмите **"uploading an existing file"**
2. Откройте папку `/Users/olegyuryevich/Desktop/aylensale-si` в файловом менеджере
3. Выберите все файлы (кроме `node_modules`)
4. Перетащите в браузер GitHub
5. Напишите commit message: "Initial commit - Production ready"
6. **Commit changes**

**Шаг 3: Создайте Vercel проект**
1. https://vercel.com/new
2. **Авторизуйтесь** через GitHub
3. Выберите репо `aylensale-si`
4. **Import**
5. Vercel определит Next.js автоматически
6. **Deploy** - ждите 2-3 минуты

**Шаг 4: Подключите домен aylensale.com**
1. После deploy откройте **Vercel Dashboard**
2. Проект → **Settings** → **Domains**
3. Нажмите **Add**
4. Введите: `www.aylensale.com`
5. Выберите: **Use Nameservers** (если домен ещё не настроен)
6. Копируйте 4 NS записи Vercel

**Шаг 5: Обновите DNS домена**
1. Где куплен домен (GoDaddy, Namecheap и т.д.)
2. Найдите **DNS Settings**
3. Замените **Nameservers** на 4 Vercel NS записи
4. Сохраните

⏳ **Ждите 10-30 минут** (распространение DNS)

**Шаг 6: Сайт готов!**
- Откройте https://www.aylensale.com
- Админка работает (пароль: aylen2026)
- Все фото и уведомления включены

---

## 🔐 ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (важно!)

После deploy нужно добавить Telegram:

1. В **Vercel Dashboard** перейдите: **Settings** → **Environment Variables**
2. Добавьте:
   ```
   Name: NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
   Value: 8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY
   Environments: Production, Preview, Development
   ```
3. Добавьте:
   ```
   Name: NEXT_PUBLIC_TELEGRAM_CHAT_ID
   Value: [получите от @aylensale_bot]
   Environments: Production, Preview, Development
   ```
4. **Save**
5. Перейдите на **Deployments**
6. Нажмите **...** на последнем deploy → **Redeploy**

---

## ✅ КОНТРОЛЬНЫЙ СПИСОК

Перед deploy проверьте:
- [x] Код скомпилирован (TypeScript OK)
- [x] Build успешен (npm run build)
- [x] Админка работает (пароль aylen2026)
- [x] Фото загружаются и сохраняются
- [x] Telegram интегрирован
- [x] WhatsApp кнопки работают
- [x] Скидка 10% работает
- [x] Карта Leaflet отображается
- [x] Погода Open-Meteo загружается

---

## 📊 ЧТО В САЙТЕ

✅ **Функциональность:**
- Admin Panel с паролем (aylen2026)
- Добавление/редактирование/удаление товаров
- **Загрузка фотографий** (сохраняются в localStorage)
- Telegram уведомления (с полной информацией)
- WhatsApp интеграция
- Автоматическая скидка 10% (от £100)
- Реферальные коды
- Карта Leaflet с маркерами
- Погода Open-Meteo для 3 городов (Corby, London, Oakham)
- Фильтр по категориям
- Сохранение данных в localStorage
- Адаптив для мобилки
- Dark mode (Tailwind CSS)

✅ **Технолог:**
- Next.js 16.2.4
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- Leaflet 1.9.4
- Open-Meteo API (weather)
- Nominatim API (geocoding)
- localStorage (data persistence)

---

## 🎯 РЕЗУЛЬТАТ

После deployment:
```
https://www.aylensale.com/ ← Работающий сайт
├── Admin Panel (пароль: aylen2026)
├── Список товаров с фото
├── Карта Leaflet
├── Прогноз погоды
├── Telegram уведомления
├── WhatsApp интеграция
└── Скидки и реферальные коды
```

---

## 🔧 ЕСЛИ ЧТО-ТО НЕ РАБОТАЕТ

**Сайт не открывается после deploy:**
- Ждите 10-15 минут (первый deploy)
- Проверьте что GitHub репо создан
- Vercel может потребовать авторизацию GitHub

**Админка не работает:**
- Проверьте пароль: **aylen2026**
- Очистите localStorage (кнопка в админке)
- Перезагрузите страницу

**Telegram не отправляет:**
- Добавьте environment variable `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN`
- Добавьте environment variable `NEXT_PUBLIC_TELEGRAM_CHAT_ID`
- Redeploy проект

**Фото не загружаются:**
- Проверьте консоль браузера (F12)
- Фото работают только в админ-панели (сохраняются в localStorage)
- Перезагрузите страницу

---

## 📞 КОНТАКТЫ

- **GitHub**: https://github.com/oleg089222-source/aylensale-si
- **Telegram Bot**: @aylensale_bot
- **Email**: oleg.yuryevich@gmai.com

---

**ГОТОВО! Начните с Step 1 → Step 6** 🚀
