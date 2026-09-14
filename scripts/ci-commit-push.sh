#!/usr/bin/env bash
# Commit path(s) and push to the current branch with retries.
# For generated artifacts (snapshot.json, published.json, …) we never merge:
# take the latest remote tip, overwrite the target paths with our staged content,
# commit, and push. That avoids JSON rebase conflicts when multiple bots write main.
#
# Paths may be files or directories. Directory paths stage every tracked/untracked
# file under them (via `git add -f`).
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
LIST_FILE="${STAGE_DIR}/.staged-files"
cleanup() { rm -rf "$STAGE_DIR"; }
trap cleanup EXIT

git diff --cached --name-only -z -- "${PATHS[@]}" >"${LIST_FILE}.raw" || true
# Fallback: list every cached path when pathspec filtering yields nothing
# (some git versions are picky about directory pathspecs after add).
if [ ! -s "${LIST_FILE}.raw" ]; then
  git diff --cached --name-only -z >"${LIST_FILE}.raw"
fi

: >"$LIST_FILE"
while IFS= read -r -d '' file; do
  [ -z "$file" ] && continue
  mkdir -p "$STAGE_DIR/$(dirname "$file")"
  git show ":${file}" >"${STAGE_DIR}/${file}"
  printf '%s\0' "$file" >>"$LIST_FILE"
done <"${LIST_FILE}.raw"

# Drop unrelated dirty files (AGENTS.md, caches) before we start resetting.
git reset --hard HEAD
git clean -fd

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  echo "Push attempt ${attempt}…"
  git fetch origin "$BRANCH"
  git reset --hard "origin/${BRANCH}"
  git clean -fd

  while IFS= read -r -d '' file; do
    [ -z "$file" ] && continue
    mkdir -p "$(dirname "$file")"
    cp "${STAGE_DIR}/${file}" "${file}"
  done <"$LIST_FILE"

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
