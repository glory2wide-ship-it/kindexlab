#!/usr/bin/env bash
# Fail the job when an ops digest is missing on disk or not git-tracked.
# Admin /admin reads src/data/ops/daily — a successful generation without a
# published digest is a silent ops blackout (seen 2026-09-15).
set -euo pipefail

EDITION="${1:?usage: $0 <edition-date> <kind> [present|tracked]}"
KIND="${2:?kind required (heatmap-analysis|briefings|board-refresh)}"
MODE="${3:-present}"

DIR="src/data/ops/daily"
shopt -s nullglob
files=("${DIR}/${EDITION}-${KIND}"-*.json)

if [ "${#files[@]}" -eq 0 ]; then
  echo "::error::Missing ops digest for edition=${EDITION} kind=${KIND} under ${DIR}"
  if [ -d "$DIR" ]; then
    echo "Present files:"
    ls -la "$DIR" || true
  else
    echo "${DIR} does not exist"
  fi
  exit 1
fi

echo "Found ${#files[@]} ops digest(s) for ${EDITION}/${KIND}:"
printf '  %s\n' "${files[@]}"

if [ "$MODE" = "tracked" ]; then
  missing=0
  for file in "${files[@]}"; do
    if ! git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
      echo "::error::${file} is on disk but not git-tracked — commit/push step failed or skipped it"
      missing=1
    fi
  done
  if [ "$missing" -ne 0 ]; then
    exit 1
  fi
  echo "All matching digests are git-tracked."
fi
