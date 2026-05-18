#!/usr/bin/env bash
# 1. Откройте Telegram, найдите своего бота, нажмите /start
# 2. Запустите: TELEGRAM_BOT_TOKEN=xxx ./scripts/telegram-get-chat-id.sh
set -euo pipefail

TOKEN="${TELEGRAM_BOT_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  echo "Укажите TELEGRAM_BOT_TOKEN"
  exit 1
fi

echo "Проверка бота..."
curl -s "https://api.telegram.org/bot${TOKEN}/getMe" | head -c 500
echo ""
echo ""
echo "Последние чаты (chat id):"
curl -s "https://api.telegram.org/bot${TOKEN}/getUpdates" | python3 -c "
import sys, json
d=json.load(sys.stdin)
for u in d.get('result', [])[-5:]:
    m=u.get('message') or u.get('channel_post') or {}
    c=m.get('chat', {})
    if c.get('id'):
        print('TELEGRAM_CHAT_ID=', c['id'], ' #', c.get('title') or c.get('username') or c.get('first_name',''))
"
