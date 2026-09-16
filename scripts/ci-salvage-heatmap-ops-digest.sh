#!/usr/bin/env bash
# Rebuild heatmap ops digest for /admin when the generation step was cancelled
# before deliverGenerationReport ran (seen 2026-09-16: Issue report existed,
# ops/daily digest did not → admin showed 오늘의 분석 0).
set -euo pipefail

EDITION="${1:-}"
if [ -z "$EDITION" ]; then
  EDITION="$(TZ=Asia/Seoul date +%F)"
fi

DIR="src/data/ops/daily"
shopt -s nullglob
existing=("${DIR}/${EDITION}-heatmap-analysis"-*.json)

if [ "${#existing[@]}" -gt 0 ]; then
  echo "Ops digest already present for ${EDITION}/heatmap-analysis:"
  printf '  %s\n' "${existing[@]}"
  exit 0
fi

echo "No heatmap ops digest for ${EDITION} — salvaging for /admin…"
npx tsx scripts/backfill-heatmap-ops-digest.ts --date="$EDITION" --partial
