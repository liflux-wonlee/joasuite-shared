#!/usr/bin/env bash
# Compare an app repo's manifest files against the vendored copies in core/,
# without changing anything. Exits non-zero if any file is missing or drifted.
# Usage: scripts/drift-check.sh <path-to-app-repo>
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-app-repo>" >&2
  exit 1
fi

APP_REPO="$(cd "$1" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$SCRIPT_DIR/manifest.txt"

status=0

while IFS= read -r rel_path; do
  rel_path="${rel_path%%$'\r'}"
  [ -z "$rel_path" ] && continue
  [[ "$rel_path" == \#* ]] && continue

  app_file="$APP_REPO/$rel_path"
  core_file="$SCRIPT_DIR/core/$rel_path"

  if [ ! -f "$core_file" ]; then
    echo "MISSING IN CORE: $rel_path"
    status=1
    continue
  fi
  if [ ! -f "$app_file" ]; then
    echo "MISSING IN APP:  $rel_path"
    status=1
    continue
  fi
  if ! diff -q "$app_file" "$core_file" > /dev/null; then
    echo "DRIFT: $rel_path"
    diff -u "$core_file" "$app_file" || true
    status=1
  fi
done < "$MANIFEST"

if [ "$status" -eq 0 ]; then
  echo "OK: no drift. All manifest files match joasuite-shared/core-vendor."
fi

exit "$status"
