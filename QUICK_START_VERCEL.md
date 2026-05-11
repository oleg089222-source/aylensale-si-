# 🚀 QUICK REFERENCE - DEPLOYMENT В VERCEL (5 МИНУТ)

## 📋 ДАННЫЕ

| Параметр | Значение |
|----------|---------|
| **Project ID Vercel** | `prj_gkwDkEyMzngAEiWiFKsx7EADkdgM` |
| **GitHub Repo** | `https://github.com/999Oleh/aylensale-si` |
| **Telegram Bot** | `@aylensale_bot` |
| **Telegram Token** | `8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY` |
| **Admin Password** | `aylen2026` |

---

## 🔐 ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (Vercel)

```env
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY
NEXT_PUBLIC_TELEGRAM_CHAT_ID=[получите от бота]
NEXT_PUBLIC_WHATSAPP_NUMBER=[опционально]
```

---

## ⚡ БЫСТРЫЙ ГАЙД

### Шаг 1: GitHub
```bash
cd /Users/olegyuryevich/Desktop/aylensale-si
git add -A
git commit -m "Ready for Vercel"
git push origin main
```

### Шаг 2: Vercel
1. https://vercel.com/dashboard → **Add New** → **Project**
2. Импортируйте GitHub репо
3. Нажмите **Deploy**

### Шаг 3: Переменные
1. **Project Settings** → **Environment Variables**
2. Добавьте переменные из таблицы выше
3. Нажмите **Save**

### Шаг 4: Редеплой
1. **Deployments** → последний → **...** → **Redeploy**
2. Дождитесь завершения
3. Получите ссылку

### Шаг 5: Проверка
- Откройте сайт: `https://aylensale-si.vercel.app`
- Нажмите **Admin**
- Введите пароль: `aylen2026`
- Добавьте тестовый товар
- ✅ Telegram должен получить уведомление

---

## 📞 ПОЛУЧИТЬ CHAT_ID

```
Сообщение @aylensale_bot в Telegram →
Откройте в браузере:
https://api.telegram.org/bot8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY/getUpdates →
Найдите: "chat":{"id":XXXXX} →
Скопируйте число в NEXT_PUBLIC_TELEGRAM_CHAT_ID
```

---

## ✅ ФИНАЛЬНАЯ ПРОВЕРКА

- [ ] Сайт открывается
- [ ] Админка работает (пароль: `aylen2026`)
- [ ] Телеграм получает уведомления
- [ ] WhatsApp работает

---

## 🎉 ГОТОВО!

Ссылка на сайт: `https://aylensale-si.vercel.app`

**Вопросы?** → Проверьте `FINAL_DEPLOYMENT_INSTRUCTIONS.md`
