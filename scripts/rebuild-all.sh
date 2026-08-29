#!/usr/bin/env bash
#
# 전체 콘텐츠를 Purge하고 등록된 모든 키워드로 프리미엄 칼럼을 재생성합니다.
#
# /api/admin/purge-and-rebuild 는 한 번의 호출에서 일정 개수만 처리하고 다음
# 시작 위치를 nextOffset 으로 돌려줍니다. done 이 될 때까지 그 값을 따라가며
# 반복 호출하고, Purge 는 첫 호출(offset 0)에서만 수행합니다.
#
# 사용법:
#   ./scripts/rebuild-all.sh
#   BASE_URL=https://kindexlab.com CRON_SECRET=xxx ./scripts/rebuild-all.sh
#   CHANNEL=economy ./scripts/rebuild-all.sh      # 특정 채널만
#   RESUME=200 ./scripts/rebuild-all.sh           # 중단된 지점부터 (Purge 없음)
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
CHANNEL="${CHANNEL:-}"
LIMIT="${LIMIT:-25}"
BATCH="${BATCH:-5}"
DELAY_MS="${DELAY_MS:-2000}"
RESUME="${RESUME:--1}"

command -v jq >/dev/null 2>&1 || { echo "jq가 필요합니다: brew install jq / apt install jq"; exit 1; }

auth=()
[ -n "$CRON_SECRET" ] && auth=(-H "Authorization: Bearer $CRON_SECRET")

if [ "$RESUME" -ge 0 ]; then
  offset="$RESUME"
  purge_first=0
else
  offset=0
  purge_first=1
fi

started=$(date +%s)
total_generated=0
total_failed=0
reasons_file=$(mktemp)
trap 'rm -f "$reasons_file"' EXIT

echo "전체 재생성 시작 · $BASE_URL"
[ "$purge_first" -eq 1 ] && echo "첫 호출에서 기존 DB를 Purge합니다."

while true; do
  query="limit=$LIMIT&offset=$offset&batch=$BATCH&delay=$DELAY_MS"
  [ -n "$CHANNEL" ] && query="$query&channel=$CHANNEL"
  if ! { [ "$purge_first" -eq 1 ] && [ "$offset" -eq 0 ]; }; then
    query="$query&purge=0"
  fi

  call_started=$(date +%s)

  # 한 구간이 실패해도 전체 실행을 버리지 않습니다. 재시도가 모두 소진된
  # 뒤에야 중단하고, 그때는 이어받을 offset을 알려 줍니다.
  response=""
  for attempt in 1 2 3; do
    if response=$(curl -sS --max-time 900 "${auth[@]}" "$BASE_URL/api/admin/purge-and-rebuild?$query"); then
      break
    fi
    echo "요청 실패 (offset=$offset, 시도 $attempt/3)"
    response=""
    [ "$attempt" -lt 3 ] && sleep $(( 10 * attempt ))
  done

  if [ -z "$response" ]; then
    echo "3회 재시도 후에도 실패했습니다 (offset=$offset)."
    echo "이어받기: RESUME=$offset ./scripts/rebuild-all.sh"
    exit 1
  fi

  elapsed=$(( $(date +%s) - call_started ))
  generated=$(echo "$response" | jq -r '.generated // 0')
  failed=$(echo "$response" | jq -r '.failed // 0')
  processed=$(echo "$response" | jq -r '.processed // 0')
  registered=$(echo "$response" | jq -r '.registered // 0')
  done_flag=$(echo "$response" | jq -r '.done // false')
  next_offset=$(echo "$response" | jq -r '.nextOffset // empty')

  total_generated=$(( total_generated + generated ))
  total_failed=$(( total_failed + failed ))
  echo "$response" | jq -r '.items[]? | select(.ok == false) | .reason' >>"$reasons_file"

  printf '[%4d/%s] 생성 %s · 실패 %s · %s초\n' "$(( offset + processed ))" "$registered" "$generated" "$failed" "$elapsed"

  [ "$done_flag" = "true" ] && break
  [ -z "$next_offset" ] && break
  offset="$next_offset"
done

mins=$(( ($(date +%s) - started) / 60 ))
echo
echo "완료 · 생성 ${total_generated}건 · 건너뜀 ${total_failed}건 · 약 ${mins}분"
if [ -s "$reasons_file" ]; then
  echo "건너뛴 사유:"
  sort "$reasons_file" | uniq -c | sort -rn | awk '{printf "  %s : %s\n", $2, $1}'
fi
