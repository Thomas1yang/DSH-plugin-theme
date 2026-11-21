#!/usr/bin/env bash
# Publish this bundle to the plugin market.
#
# It pushes the repository to GitHub, regenerates the market index so it names
# the pushed commit, and pushes the index too. Run it after committing your
# change; it commits the regenerated index for you.
#
# Prerequisites: GitHub credentials for the repository's origin.
#
# Usage:
#   ./publish.sh                 # push, regenerate the index, push again
#   ./publish.sh --skip-index    # push only

set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BUNDLE_DIR"

REMOTE="${DSH_PUBLISH_REMOTE:-origin}"
BRANCH="${DSH_PUBLISH_BRANCH:-main}"
SKIP_INDEX=0

for argument in "$@"; do
  case "$argument" in
    --skip-index) SKIP_INDEX=1 ;;
    *) echo "unknown option: $argument" >&2; exit 2 ;;
  esac
done

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "no remote named $REMOTE; add one with:" >&2
  echo "  git remote add $REMOTE https://github.com/<owner>/<repo>.git" >&2
  exit 1
fi

echo "==> pushing $BRANCH to $REMOTE"
git push -u "$REMOTE" "$BRANCH"

if [ "$SKIP_INDEX" -eq 1 ]; then
  echo "==> skipping the index"
  exit 0
fi

echo "==> regenerating the market index"
node build-market-index.mjs

INDEX_FILE="$(git rev-parse --show-toplevel)/market-index.json"
if git diff --quiet -- "$INDEX_FILE"; then
  echo "==> the index already names the pushed commit"
  exit 0
fi

echo "==> committing the regenerated index"
git add "$INDEX_FILE"
git commit -m "Publish $(node -p "require('./package.json').version")"

echo "==> pushing the index"
git push "$REMOTE" "$BRANCH"

SLUG="$(git remote get-url "$REMOTE" | sed -E 's#.*github\.com[:/]+##; s#\.git$##')"
echo
echo "published."
echo "  index url: https://raw.githubusercontent.com/$SLUG/$BRANCH/market-index.json"
echo "  configure it under Plugins > Custom plugin indexes"
