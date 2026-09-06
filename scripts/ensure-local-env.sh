#!/usr/bin/env bash
# Idempotent local env bootstrap for Cursor / Cloud Agents.
# Production secrets are not required: the app falls back to mock rankings.
set -euo pipefail

if [[ -f .env.local ]]; then
  exit 0
fi

cat > .env.local <<'EOF'
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:43123
NEXT_PUBLIC_CONTACT_EMAIL=glory2wide@gmail.com
NEXT_PUBLIC_MARKET_COUNTRY=KR
TRENDS_DATA_SOURCE=mock
NEWS_RAG_ENABLED=0
ANALYSIS_CHAIN_ENABLED=0
BOARDS_CHAIN_ENABLED=0
EOF
