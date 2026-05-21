#!/usr/bin/env bash
# Full backup before redesign: tar archive + optional git tag in car-sales-uk repo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1/3 Code archive ==="
bash scripts/backup-project.sh

echo ""
echo "=== 2/3 Git (car-sales-uk only) ==="
echo "Parent repo ignores /AYLEN1/ — git must be initialized HERE."
if [ ! -d .git ]; then
  git init -b backup-before-redesign
  git add -A
  git commit -m "Stable site snapshot before redesign (May 2026)"
  git tag -a stable-version-may-2026 -m "Rollback before redesign"
  git branch redesign/phase-1-hero 2>/dev/null || true
  echo "Created branch backup-before-redesign + tag stable-version-may-2026"
else
  git add -A
  if git diff --cached --quiet; then
    echo "No new changes to commit."
  else
    git commit -m "Backup snapshot $(date +%Y-%m-%d)"
  fi
  git tag -f stable-version-may-2026 2>/dev/null || git tag -a stable-version-may-2026 -m "Rollback before redesign"
  echo "Tag stable-version-may-2026 updated."
fi
git log -1 --oneline 2>/dev/null || true
git tag -l 'stable*' 2>/dev/null || true

echo ""
echo "=== 3/3 Firestore (manual) ==="
echo "Open https://aylensale.com → Admin → Backup → save JSON file."
echo ""
echo "=== Vercel rollback ==="
echo "Dashboard → Deployments → find LAST GOOD production → Promote to Production"
echo "See docs/REDESIGN_ROLLBACK.md"
echo ""
echo "Done. Do NOT run: npx vercel --prod (until phase tested on preview)"
