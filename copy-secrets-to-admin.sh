#!/bin/bash
# Copy secrets from public Worker to admin Worker
# Run this script after deploying both Workers
#
# Usage:
#   CLOUDFLARE_API_TOKEN=cfat_xxx CLOUDFLARE_ACCOUNT_ID=81e5c8bea4621b4f7649fb50a2deecf3 bash copy-secrets-to-admin.sh
#
# Or just run: bash copy-secrets-to-admin.sh
# (script will prompt for each secret value)

set -e

cd "$(dirname "$0")"

# Check for required env vars
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ Missing CLOUDFLARE_API_TOKEN"
  echo "   export CLOUDFLARE_API_TOKEN=cfat_xxx"
  exit 1
fi
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  export CLOUDFLARE_ACCOUNT_ID=81e5c8bea4621b4f7649fb50a2deecf3
fi

SECRETS=(
  "APP_URL"
  "DATABASE_URL"
  "TURSO_DATABASE_URL"
  "TURSO_AUTH_TOKEN"
  "GMAIL_USER"
  "GMAIL_APP_PASSWORD"
  "IMAGEKIT_URL"
  "IMAGEKIT_PUBLIC_KEY"
  "IMAGEKIT_PRIVATE_KEY"
  "VAPID_PUBLIC_KEY"
  "VAPID_PRIVATE_KEY"
  "VAPID_SUBJECT"
  "TURNSTILE_SECRET"
  "RECAPTCHA_SECRET"
  "SESSION_SECRET"
)

echo "================================================"
echo "  Copy secrets to giaydephuongnho-admin-api"
echo "================================================"
echo ""
echo "This script will prompt you to enter the value of each secret."
echo "Get the values from Cloudflare dashboard → Workers → giaydephuongnho-api → Settings → Variables."
echo ""
echo "Press Ctrl+C to abort. Press Enter to skip a secret (skip = leave it unset)."
echo ""

for SECRET in "${SECRETS[@]}"; do
  echo "Enter value for $SECRET (or Enter to skip):"
  read -r VALUE
  if [ -z "$VALUE" ]; then
    echo "  ⏭️  Skipped $SECRET"
    continue
  fi

  echo "  Setting $SECRET..."
  printf "%s" "$VALUE" | npx wrangler secret put "$SECRET" --config wrangler-admin.toml 2>&1 | tail -2
  echo "  ✅ $SECRET set"
  echo ""
done

echo ""
echo "✅ All secrets processed!"
echo ""
echo "Verify by listing admin Worker secrets:"
echo "  npx wrangler secret list --config wrangler-admin.toml"
