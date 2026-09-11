#!/usr/bin/env bash
# Push whatever is already on disk for today's analysis cache.
# Safe to call mid-run (after each overnight batch) and again on job cancel.
set -euo pipefail

MESSAGE="${1:-chore: checkpoint heatmap today's analysis}"
CACHE_PATH="${2:-src/data/analysis/cache.json}"

if [ ! -f "$CACHE_PATH" ]; then
  echo "No cache file yet: $CACHE_PATH"
  exit 0
fi

chmod +x scripts/ci-commit-push.sh
scripts/ci-commit-push.sh "$MESSAGE" "$CACHE_PATH"
