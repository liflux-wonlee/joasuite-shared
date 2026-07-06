#!/usr/bin/env bash
# Copy manifest files FROM this joasuite-shared repo (core-vendor/core/) INTO an app repo.
# Usage: scripts/pull-from-core.sh <path-to-app-repo>
# After running, review with `git diff` inside the app repo before committing.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-app-repo>" >&2
  exit 1
fi

APP_REPO="$(cd "$1" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$SCRIPT_DIR/manifest.txt"

while IFS= read -r rel_path; do
  rel_path="${rel_path%%$'\r'}"
  [ -z "$rel_path" ] && continue
  [[ "$rel_path" == \#* ]] && continue

  src="$SCRIPT_DIR/core/$rel_path"
  dst="$APP_REPO/$rel_path"

  if [ ! -f "$src" ]; then
    echo "SKIP (not found in core/): $rel_path" >&2
    continue
  fi

  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "copied: $rel_path"
done < "$MANIFEST"

echo
echo "Done. Review the diff before committing:"
echo "  cd $APP_REPO && git status && git diff"
