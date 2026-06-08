#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Sync root → public/ (required for Vercel outputDirectory)"
npm run build

VERCEL="npx --yes vercel@latest"

# Expired VERCEL_OIDC_TOKEN in .env.local overrides `vercel login` and breaks deploy.
unset VERCEL_OIDC_TOKEN VERCEL_TOKEN

echo "→ Vercel auth (uses npx — no global install needed)"
if ! env -u VERCEL_OIDC_TOKEN -u VERCEL_TOKEN $VERCEL whoami >/dev/null 2>&1; then
  echo "Not logged in. Run in browser when prompted:"
  env -u VERCEL_OIDC_TOKEN -u VERCEL_TOKEN $VERCEL login
fi
env -u VERCEL_OIDC_TOKEN -u VERCEL_TOKEN $VERCEL whoami

echo "→ Deploy to production"
env -u VERCEL_OIDC_TOKEN -u VERCEL_TOKEN $VERCEL --prod --yes

echo "Done. Close aylensale.com tab and open again to see changes."
echo "VIP UI demo: https://aylensale.com/vip-member-preview.html"
echo "VIP live stock (admin): https://aylensale.com/vip-live-preview.html"
