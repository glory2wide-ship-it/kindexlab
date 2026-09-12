#!/usr/bin/env bash
# Commit path(s) and push to the current branch with retries.
# For generated artifacts (snapshot.json, published.json, …) we never merge:
# take the latest remote tip, overwrite the target paths with our staged content,
# commit, and push. That avoids JSON rebase conflicts when multiple bots write main.
set -euo pipefail

MESSAGE="${1:?commit message required}"
shift
if [ "$#" -lt 1 ]; then
  echo "usage: $0 <message> <path> [path...]" >&2
  exit 1
fi
PATHS=("$@")

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# -f: overnight analysis cache under src/data/analysis/ is gitignored locally
# but must still ship to production via this workflow.
git add -f -- "${PATHS[@]}"
if git diff --cached --quiet; then
  echo "No staged changes for: ${PATHS[*]}"
  exit 0
fi

STAGE_DIR="$(mktemp -d)"
cleanup() { rm -rf "$STAGE_DIR"; }
trap cleanup EXIT

for path in "${PATHS[@]}"; do
  mkdir -p "$STAGE_DIR/$(dirname "$path")"
  # Prefer the index (what we just staged) so dirty working-tree noise is ignored.
  git show ":${path}" >"${STAGE_DIR}/${path}"
done

# Drop unrelated dirty files (AGENTS.md, caches) before we start resetting.
git reset --hard HEAD
git clean -fd

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  echo "Push attempt ${attempt}…"
  git fetch origin "$BRANCH"
  git reset --hard "origin/${BRANCH}"
  git clean -fd

  for path in "${PATHS[@]}"; do
    mkdir -p "$(dirname "$path")"
    cp "${STAGE_DIR}/${path}" "${path}"
  done

  git add -f -- "${PATHS[@]}"
  if git diff --cached --quiet; then
    echo "Remote already has the same content for: ${PATHS[*]}"
    exit 0
  fi

  git commit -m "$MESSAGE"
  if git push origin "HEAD:${BRANCH}"; then
    echo "Pushed successfully on attempt ${attempt}"
    exit 0
  fi

  echo "Push rejected on attempt ${attempt}; retrying with a fresher tip"
  sleep $((attempt * 3))
done

echo "::error::Failed to push after retries (likely concurrent writers on ${BRANCH})"
exit 1
