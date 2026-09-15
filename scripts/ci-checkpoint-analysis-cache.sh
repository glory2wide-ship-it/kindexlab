#!/usr/bin/env bash
# Push whatever is already on disk for today's analysis cache.
# Safe to call mid-run (after each overnight batch) and again on job cancel.
set -euo pipefail

# Avoid apostrophes in ${1:-default} — bash treats ' specially inside :- words
# and aborts with "unexpected EOF while looking for matching `''" (seen 2026-09-15).
MESSAGE="${1:-chore: checkpoint heatmap analysis cache}"
CACHE_PATH="${2:-src/data/analysis/cache.json}"

if [ ! -f "$CACHE_PATH" ]; then
  echo "No cache file yet: $CACHE_PATH"
  exit 0
fi

chmod +x scripts/ci-commit-push.sh
PATHS=("$CACHE_PATH")
if [ -d src/data/ops/daily ]; then
  PATHS+=(src/data/ops/daily)
fi

# Final publish must include the edition digest; mid-run checkpoints leave this unset.
if [ -n "${REQUIRE_OPS_DIGEST:-}" ] && [ -n "${OPS_DIGEST_EDITION:-}" ]; then
  chmod +x scripts/ci-assert-ops-digest.sh
  scripts/ci-assert-ops-digest.sh \
    "$OPS_DIGEST_EDITION" \
    "${OPS_DIGEST_KIND:-heatmap-analysis}" \
    present
fi

scripts/ci-commit-push.sh "$MESSAGE" "${PATHS[@]}"

if [ -n "${REQUIRE_OPS_DIGEST:-}" ] && [ -n "${OPS_DIGEST_EDITION:-}" ]; then
  scripts/ci-assert-ops-digest.sh \
    "$OPS_DIGEST_EDITION" \
    "${OPS_DIGEST_KIND:-heatmap-analysis}" \
    tracked
fi
