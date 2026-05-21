#!/usr/bin/env bash
# Local code snapshot before changes (does not export Firestore — use Admin → Backup for that).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${ROOT}/backups"
mkdir -p "$DEST"
ARCHIVE="${DEST}/aylensale-code-${STAMP}.tar.gz"
tar -czf "$ARCHIVE" \
  --exclude='./backups' \
  --exclude='./.vercel' \
  --exclude='./.env.local' \
  -C "$ROOT" .
echo "Created: $ARCHIVE"
ls -lh "$ARCHIVE"
