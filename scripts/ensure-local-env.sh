#!/usr/bin/env bash
# Idempotent local env bootstrap for Cursor / Cloud Agents.
# Defaults to live rankings (crawler snapshot). Mock is opt-in only.
set -euo pipefail

TARGET_URL="http://localhost:3000"

pin_site_url() {
  if grep -q '^NEXT_PUBLIC_SITE_URL=' .env.local; then
    sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=${TARGET_URL}|" .env.local
  else
    printf '\nNEXT_PUBLIC_SITE_URL=%s\n' "$TARGET_URL" >> .env.local
  fi
}

# Older bootstraps wrote TRENDS_DATA_SOURCE=mock and silently served fixtures.
# Flip them to live unless the operator explicitly opted into mock.
ensure_live_trends() {
  if grep -q '^TRENDS_ALLOW_MOCK=1$' .env.local; then
    return 0
  fi
  if grep -q '^TRENDS_DATA_SOURCE=mock$' .env.local; then
    sed -i 's|^TRENDS_DATA_SOURCE=mock$|TRENDS_DATA_SOURCE=live|' .env.local
    echo "[ensure-local-env] TRENDS_DATA_SOURCE mock → live (set TRENDS_ALLOW_MOCK=1 to keep fixtures)"
  elif ! grep -q '^TRENDS_DATA_SOURCE=' .env.local; then
    printf '\nTRENDS_DATA_SOURCE=live\n' >> .env.local
  fi
}

if [[ -f .env.local ]]; then
  pin_site_url
  ensure_live_trends
  exit 0
fi

cat > .env.local <<EOF
NEXT_PUBLIC_SITE_URL=${TARGET_URL}
NEXT_PUBLIC_CONTACT_EMAIL=glory2wide@gmail.com
NEXT_PUBLIC_MARKET_COUNTRY=KR
TRENDS_DATA_SOURCE=live
NEWS_RAG_ENABLED=0
ANALYSIS_CHAIN_ENABLED=0
BOARDS_CHAIN_ENABLED=0
EOF
