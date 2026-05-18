#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Деплой правил Firebase для проекта aylensale..."
npx firebase-tools deploy --only firestore:rules,storage:rules --project aylensale
