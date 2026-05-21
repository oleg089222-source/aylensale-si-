# ChatGPT / OpenAI для AI Admin Assistant

## Важно

Подписка **ChatGPT Plus** в приложении chatgpt.com **не заменяет** API-ключ.  
Нужен ключ с [platform.openai.com/api-keys](https://platform.openai.com/api-keys) и включённый биллинг (pay-as-you-go).

## Шаг 1 — получить ключ

1. Войдите на [platform.openai.com](https://platform.openai.com)
2. **API keys** → **Create new secret key**
3. Скопируйте ключ (`sk-...`) — он показывается один раз

## Шаг 2 — Vercel (сайт aylensale.com)

1. [vercel.com](https://vercel.com) → проект **aylensale**
2. **Settings** → **Environment Variables**
3. Добавьте:

| Name | Value | Environments |
|------|--------|----------------|
| `OPENAI_API_KEY` | `sk-...` | Production, Preview |
| `OPENAI_MODEL` | `gpt-4o-mini` (или `gpt-4o`) | Production, Preview |
| `ADMIN_PASSWORD` | ваш пароль админа | Production, Preview |

4. **Deployments** → **Redeploy** последнего деплоя

## Шаг 3 — локально (Mac)

```bash
cd car-sales-uk
cp .env.example .env.local
# отредактируйте .env.local — вставьте OPENAI_API_KEY и ADMIN_PASSWORD
node scripts/local-test-server.mjs
```

Откройте `http://127.0.0.1:3340/`, войдите в админку, откройте **AI Assistant** — статус должен быть **ChatGPT подключён**.

## Проверка

В AI-панели справа: зелёный бейдж **ChatGPT подключён** = ключ на сервере есть.  
Красный **Нет API ключа** = добавьте `OPENAI_API_KEY` в Vercel и redeploy.

Голос по-русски → Whisper распознаёт → GPT переводит на UK English → поля формы заполняются.

## Переключатели (Settings в AI-панели)

| Опция | Назначение |
|--------|------------|
| AI Assistant (master) | Вкл/выкл весь AI и кнопки на сайте |
| Voice input | Микрофон |
| Whisper | OpenAI Whisper (лучше для русского) |
| Camera scan | Скан коробки / Amazon label |
| Auto-fill product form | Вставка в Add/Edit автоматически |
| AI speaks replies (TTS) | Голосовой ответ OpenAI |
| Auto-translate after voice | RU→EN сразу после записи |

## Модели (env)

- `OPENAI_MODEL` — текст (gpt-4o-mini)
- `OPENAI_VISION_MODEL` — камера / фото
- `OPENAI_WHISPER_MODEL` — голос (whisper-1)
- `OPENAI_TTS_MODEL` / `OPENAI_TTS_VOICE` — ответ голосом

## Модели

- `OPENAI_MODEL` — текст объявлений (рекомендуется `gpt-4o-mini` — дёшево и быстро)
- `OPENAI_VISION_MODEL` — разбор фото товара

Ключ **никогда** не вставляйте в код сайта или в Firebase — только Vercel / `.env.local`.
