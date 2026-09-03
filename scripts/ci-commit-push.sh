#!/usr/bin/env bash
# Commit path(s) and push to the current branch with rebase retries.
# Survives races with other Actions that also push to main (e.g. ingest every 3m).
set -euo pipefail

MESSAGE="${1:?commit message required}"
shift
if [ "$#" -lt 1 ]; then
  echo "usage: $0 <message> <path> [path...]" >&2
  exit 1
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git add -- "$@"
if git diff --cached --quiet; then
  echo "No staged changes for: $*"
  exit 0
fi

git commit -m "$MESSAGE"

# Ingest (and similar jobs) often leave unrelated dirty files (AGENTS.md, caches).
# Those block `git rebase`; drop them so only the commit we just made is pushed.
git reset --hard HEAD
git clean -fd

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
REMOTE_REF="origin/${BRANCH}"

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  echo "Push attempt ${attempt}…"
  git fetch origin "$BRANCH"
  if git rebase "$REMOTE_REF"; then
    if git push origin "HEAD:${BRANCH}"; then
      echo "Pushed successfully on attempt ${attempt}"
      exit 0
    fi
  else
    echo "Rebase failed on attempt ${attempt}; aborting rebase"
    git rebase --abort 2>/dev/null || true
    git reset --hard HEAD
    git clean -fd
  fi
  sleep $((attempt * 3))
done

echo "::error::Failed to push after retries (likely concurrent writers on ${BRANCH})"
exit 1
