#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Deploy Firestore rules (VIP admin + view-stats read-only for clients)"
echo "  Project: aylensale"
echo "  File:    firestore.rules"
echo ""

if ! command -v firebase >/dev/null 2>&1; then
  echo "Firebase CLI not found. Install: npm i -g firebase-tools"
  echo "Or paste firestore.rules manually:"
  echo "  https://console.firebase.google.com/project/aylensale/firestore/rules"
  exit 1
fi

firebase deploy --only firestore:rules --project aylensale

echo "Done. View counts write via /api/record-view only; clients can still read stats."
