#!/usr/bin/env bash
# Copy manifest files FROM an app repo INTO this joasuite-shared repo (core-vendor/core/).
# Usage: scripts/push-to-core.sh <path-to-app-repo>
# After running, review with `git diff` and `git status` before committing.
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

  src="$APP_REPO/$rel_path"
  dst="$SCRIPT_DIR/core/$rel_path"

  if [ ! -f "$src" ]; then
    echo "SKIP (not found in app repo): $rel_path" >&2
    continue
  fi

  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "copied: $rel_path"
done < "$MANIFEST"

echo
echo "Done. Review the diff before committing:"
echo "  cd $SCRIPT_DIR/.. && git status && git diff"
