#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Sync root → public/"
npm run build

VERCEL="npx --yes vercel@latest"

echo "→ Vercel auth"
if ! $VERCEL whoami >/dev/null 2>&1; then
  echo "Not logged in. Run in browser when prompted:"
  $VERCEL login
fi
$VERCEL whoami

echo "→ Preview deploy (NOT production)"
$VERCEL --yes

echo ""
echo "Preview URL printed above. Check:"
echo "  • Homepage section order: Hero → New Arrivals → VIP → Products"
echo "  • VIP block compact layout + carousel + member counter"
echo "  • /vip-stock paywall + member content"
echo ""
echo "When OK, run: ./scripts/deploy-prod.sh"
