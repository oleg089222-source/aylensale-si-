# 🚀 ИНСТРУКЦИЯ: Создание репо на GitHub и push

## Шаг 1: Создайте репозиторий на GitHub

1. Откройте https://github.com/new (или https://github.com/ → кнопка "New")
2. **Авторизуйтесь** под аккаунтом `oleg089222-source`
3. Заполните форму:
   ```
   Repository name:        aylensale-si
   Description:            AylenSale - Telegram-integrated Next.js app
   Public / Private:       Public (или Private)
   Initialize with README: НЕ ЧЕКАЙТЕ (оставьте пусто!)
   ```
4. Нажмите кнопку **Create repository**

## Шаг 2: Получите команды для push

GitHub покажет вам команды. Используйте эти (если репо пусто):

```bash
cd /Users/olegyuryevich/Desktop/aylensale-si

# Нижеприведённые команды уже выполнены, но вот для справки:
git remote set-url origin git@github.com:oleg089222-source/aylensale-si.git
git branch -M main
git push -u origin main
```

## Шаг 3: Выполните push

```bash
cd /Users/olegyuryevich/Desktop/aylensale-si
git push -u origin main
```

## Шаг 4: Проверьте на GitHub

Откройте https://github.com/oleg089222-source/aylensale-si

Вы должны увидеть все файлы проекта!

---

**ВАЖНО:** Создайте репо с пустым содержимым (БЕЗ README, .gitignore и т.д.)
