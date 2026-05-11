# 🚀 ПОЛНАЯ ИНСТРУКЦИЯ ПО РАЗВЕРТЫВАНИЮ НА VERCEL

## 📋 Данные для подключения

- **GitHub репозиторий**: https://github.com/999Oleh/aylensale-si
- **Vercel Project ID**: prj_gkwDkEyMzngAEiWiFKsx7EADkdgM
- **Telegram Bot**: @aylensale_bot
- **Telegram Bot Token**: `8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY`

---

## 🔧 ШАГ 1: Подключение GitHub репозитория

### Вариант 1: Если репо уже создано
1. Откройте GitHub: https://github.com/999Oleh/aylensale-si
2. Убедитесь, что все коммиты загружены
3. Перейдите на Vercel: https://vercel.com/dashboard

### Вариант 2: Создание нового репо
1. На GitHub нажмите **New Repository**
2. Имя: `aylensale-si`
3. Загрузите файлы из проекта
4. Нажмите **Create repository**

---

## 📡 ШАГ 2: Подключение к Vercel

1. Перейдите на https://vercel.com/dashboard
2. Нажмите **Add New...** → **Project**
3. Импортируйте репозиторий GitHub: `999Oleh/aylensale-si`
4. Vercel автоматически определит Next.js приложение

---

## 🔐 ШАГ 3: Добавьте переменные окружения

В **Vercel Dashboard** → **Project Settings** → **Environment Variables**:

**Добавьте следующие переменные для Production:**

```
Name: NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
Value: 8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY
```

```
Name: NEXT_PUBLIC_TELEGRAM_CHAT_ID
Value: [ВАШ CHAT ID - ПОЛУЧИТЕ ОТ БОТА]
```

```
Name: NEXT_PUBLIC_WHATSAPP_NUMBER
Value: [НОМЕР ТЕЛЕФОНА С КОДОМ - ОПЦИОНАЛЬНО]
```

### Как получить CHAT_ID для Telegram:

1. Отправьте сообщение боту @aylensale_bot
2. Перейдите на: `https://api.telegram.org/bot8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY/getUpdates`
3. В ответе найдите `"chat":{"id": XXXXX}` — это ваш CHAT_ID
4. Скопируйте этот ID в переменную `NEXT_PUBLIC_TELEGRAM_CHAT_ID`

---

## 🎯 ШАГ 4: Выполните deploy

1. В Vercel нажмите кнопку **Deploy**
2. Дождитесь завершения (обычно 2-3 минуты)
3. После завершения получите URL вашего сайта

---

## ✅ ШАГ 5: Проверка функциональности

### Проверить, что сайт открывается:
```
https://your-vercel-url.vercel.app
```

### Проверить погоду:
- На главной странице должны отображаться температура и погода для Corby, London, Oakham

### Проверить карту:
- На странице должна отображаться Leaflet карта с маркерами

### Проверить админку:
1. Нажмите кнопку **Admin** на сайте
2. Введите пароль: `aylen2026`
3. Заполните форму добавления продажи:
   - Название
   - Адрес
   - Категория
   - День и время
   - Описание
   - Сумма (от £100 даёт скидку 10%)
4. Нажмите **Сохранить**
5. Проверьте, что данные появились в списке

### Проверить Telegram уведомления:
1. В админке добавьте новую продажу
2. Проверьте чат Telegram — должно прийти уведомление с деталями продажи

### Проверить WhatsApp:
1. На каждом товаре в списке нажмите **WhatsApp**
2. Должна открыться ссылка для WhatsApp с предзаполненным сообщением

### Проверить загрузку фото:
1. Нажмите на товар в списке
2. Попробуйте загрузить фото (если функция есть)
3. Фото должны сохраняться и отображаться

---

## 📱 Для тестирования на телефоне

1. Откройте сайт на телефоне: `https://your-vercel-url.vercel.app`
2. Нажмите **Admin**
3. Введите пароль: `aylen2026`
4. Протестируйте форму и все функции

---

## 🐛 При возникновении ошибок

1. Проверьте логи в Vercel: **Deployments** → **Latest** → **Logs**
2. Убедитесь, что все переменные окружения добавлены
3. Проверьте, что Telegram Bot Token правильный
4. Проверьте, что CHAT_ID добавлен и правильный

---

## 📚 Локальное тестирование ДО deploy на Vercel

Если хотите протестировать локально с переменными окружения:

```bash
cd /Users/olegyuryevich/Desktop/aylensale-si

# Установите переменные окружения
echo "NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY" > .env.local
echo "NEXT_PUBLIC_TELEGRAM_CHAT_ID=[ВАШ CHAT ID]" >> .env.local

# Запустите dev сервер
npm run dev

# Откройте http://localhost:3000
```

---

## 💾 Финальные действия

После успешного deploy:

1. ✅ Отправьте тестовый заказ через форму
2. ✅ Проверьте, что Telegram получил уведомление
3. ✅ Проверьте WhatsApp ссылку
4. ✅ Проверьте, что данные сохраняются после перезагрузки
5. ✅ Скопируйте финальный URL сайта

**Готовый сайт будет доступен по адресу**: https://your-vercel-project.vercel.app

---

**🎉 Всё готово к развертыванию!**
