#!/usr/bin/env bash
# Загрузка переменных на Vercel (Production + Preview)
# Требуется: npx vercel login
set -euo pipefail
cd "$(dirname "$0")/.."

if ! npx vercel whoami &>/dev/null; then
  echo "Сначала выполните: npx vercel login"
  exit 1
fi

ENV_FILE="${1:-.env.local}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Файл $ENV_FILE не найден"
  exit 1
fi

add_env() {
  local key="$1"
  local val="$2"
  local target="$3"
  if [[ -z "$val" ]]; then
    echo "Пропуск пустого: $key"
    return
  fi
  echo "$val" | npx vercel env add "$key" "$target" --force 2>/dev/null || \
    echo "$val" | npx vercel env add "$key" "$target"
}

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "${line// }" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  for target in production preview development; do
    add_env "$key" "$val" "$target"
  done
  echo "✓ $key"
done < <(grep -E '^(NEXT_PUBLIC_|ADMIN_|TELEGRAM_)' "$ENV_FILE")

echo ""
echo "Готово. Проверка: npx vercel env ls"
echo "Деплой: npx vercel --prod"
