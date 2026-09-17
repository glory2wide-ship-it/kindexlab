#!/usr/bin/env bash
# Commit path(s) and push to the current branch with retries.
# For generated artifacts (snapshot.json, published.json, …) we never merge:
# take the latest remote tip, overwrite the target paths with our staged content,
# commit, and push. That avoids JSON rebase conflicts when multiple bots write main.
#
# Paths may be files or directories. Directory paths stage every tracked/untracked
# file under them (via `git add -f`).
#
# Handles replacements that delete an older tracked file and add a new one
# (e.g. ops digest prune on skip re-run) — `git show :deleted` is invalid.
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
# Also stage deletions of tracked files under these paths (digest prune).
git add -u -- "${PATHS[@]}" 2>/dev/null || true

if git diff --cached --quiet; then
  echo "No staged changes for: ${PATHS[*]}"
  exit 0
fi

STAGE_DIR="$(mktemp -d)"
ADD_LIST="${STAGE_DIR}/.staged-adds"
DEL_LIST="${STAGE_DIR}/.staged-deletes"
cleanup() { rm -rf "$STAGE_DIR"; }
trap cleanup EXIT

: >"$ADD_LIST"
: >"$DEL_LIST"

# Added / copied / modified / renamed — extract blob from index.
while IFS= read -r -d '' file; do
  [ -z "$file" ] && continue
  if ! git cat-file -e ":${file}" 2>/dev/null; then
    echo "warn: skip unreadable staged path ${file}"
    continue
  fi
  mkdir -p "$STAGE_DIR/$(dirname "$file")"
  git show ":${file}" >"${STAGE_DIR}/${file}"
  printf '%s\0' "$file" >>"$ADD_LIST"
done < <(git diff --cached --diff-filter=ACMR --name-only -z -- "${PATHS[@]}" || true)

# Fallback when pathspec filtering yields nothing.
if [ ! -s "$ADD_LIST" ]; then
  while IFS= read -r -d '' file; do
    [ -z "$file" ] && continue
    if ! git cat-file -e ":${file}" 2>/dev/null; then
      continue
    fi
    mkdir -p "$STAGE_DIR/$(dirname "$file")"
    git show ":${file}" >"${STAGE_DIR}/${file}"
    printf '%s\0' "$file" >>"$ADD_LIST"
  done < <(git diff --cached --diff-filter=ACMR --name-only -z || true)
fi

# Deleted — record path only (no blob).
while IFS= read -r -d '' file; do
  [ -z "$file" ] && continue
  printf '%s\0' "$file" >>"$DEL_LIST"
done < <(git diff --cached --diff-filter=D --name-only -z -- "${PATHS[@]}" || true)

if [ ! -s "$ADD_LIST" ] && [ ! -s "$DEL_LIST" ]; then
  # Last resort: any cached change under PATHS
  while IFS= read -r -d '' file; do
    [ -z "$file" ] && continue
    if git cat-file -e ":${file}" 2>/dev/null; then
      mkdir -p "$STAGE_DIR/$(dirname "$file")"
      git show ":${file}" >"${STAGE_DIR}/${file}"
      printf '%s\0' "$file" >>"$ADD_LIST"
    else
      printf '%s\0' "$file" >>"$DEL_LIST"
    fi
  done < <(git diff --cached --name-only -z || true)
fi

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
  done <"$ADD_LIST"

  while IFS= read -r -d '' file; do
    [ -z "$file" ] && continue
    if [ -e "$file" ] || [ -L "$file" ]; then
      rm -f "$file"
    fi
  done <"$DEL_LIST"

  git add -f -- "${PATHS[@]}"
  git add -u -- "${PATHS[@]}" 2>/dev/null || true

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
