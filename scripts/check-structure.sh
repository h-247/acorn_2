#!/usr/bin/env sh
set -eu
for p in apps/web apps/api packages/ui packages/contracts infrastructure docs/canonical docs/ui/mockups; do
  test -e "$p" || { echo "Missing $p"; exit 1; }
done
echo "Acorn bootstrap structure OK"
