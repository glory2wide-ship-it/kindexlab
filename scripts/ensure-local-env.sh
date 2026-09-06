#!/usr/bin/env bash
# Idempotent local env bootstrap for Cursor / Cloud Agents.
# Production secrets are not required: the app falls back to mock rankings.
set -euo pipefail

TARGET_URL="http://localhost:3000"

if [[ -f .env.local ]]; then
  # Keep other overrides, but always pin the public site URL to the local
  # Next.js port so metadataBase / absolute links match the running server.
  if grep -q '^NEXT_PUBLIC_SITE_URL=' .env.local; then
    sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=${TARGET_URL}|" .env.local
  else
    printf '\nNEXT_PUBLIC_SITE_URL=%s\n' "$TARGET_URL" >> .env.local
  fi
  exit 0
fi

cat > .env.local <<EOF
NEXT_PUBLIC_SITE_URL=${TARGET_URL}
NEXT_PUBLIC_CONTACT_EMAIL=glory2wide@gmail.com
NEXT_PUBLIC_MARKET_COUNTRY=KR
TRENDS_DATA_SOURCE=mock
NEWS_RAG_ENABLED=0
ANALYSIS_CHAIN_ENABLED=0
BOARDS_CHAIN_ENABLED=0
EOF
