#!/usr/bin/env bash
# Syntax-check CI shell scripts and reject a known footgun:
# apostrophes inside ${n:-default} words break bash parsing before the script runs
# (heatmap publish aborted 2026-09-15 with "unexpected EOF while looking for matching `''").
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

while IFS= read -r -d '' file; do
  if ! bash -n "$file"; then
    echo "::error::bash -n failed: ${file#"$ROOT"/}"
    fail=1
    continue
  fi

  # Match ${1:-...} / ${2:-...} defaults that contain a literal apostrophe.
  if grep -nE '\$\{[0-9]+:-[^}\}]*'\''[^}\}]*\}' "$file" >/tmp/shell-apostrophe-hits.txt; then
    echo "::error::Apostrophe inside \${n:-default} in ${file#"$ROOT"/} — use a quote-free default"
    cat /tmp/shell-apostrophe-hits.txt
    fail=1
  fi
done < <(find "$ROOT/scripts" -type f -name '*.sh' -print0 | sort -z)

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "Shell scripts OK ($(find "$ROOT/scripts" -type f -name '*.sh' | wc -l) files)"
