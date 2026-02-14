#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAILED=0

echo "[1/3] Checking version consistency..."
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
MANIFEST_VERSION="$(node -p "require('./manifest.json').version")"

if [ "$PACKAGE_VERSION" != "$MANIFEST_VERSION" ]; then
  echo "Version mismatch: package.json=$PACKAGE_VERSION, manifest.json=$MANIFEST_VERSION"
  FAILED=1
fi

if ! node -e "const versions=require('./versions.json'); const version=require('./manifest.json').version; if(!Object.prototype.hasOwnProperty.call(versions, version)){process.exit(1)}"; then
  echo "versions.json does not contain key for manifest version: $MANIFEST_VERSION"
  FAILED=1
fi

echo "[2/3] Checking required release assets..."
REQUIRED_FILES=(
  "main.js"
  "manifest.json"
  "versions.json"
  "README.md"
  "CHANGELOG.md"
  "LICENSE"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Missing required file: $file"
    FAILED=1
  fi
done

echo "[3/3] Checking manifest required fields..."
if ! node -e "const m=require('./manifest.json'); const required=['id','name','version','minAppVersion','description','author']; for (const key of required){ if(!m[key] || String(m[key]).trim().length===0){ process.exit(1);} }"; then
  echo "manifest.json has missing required fields."
  FAILED=1
fi

if [ "$FAILED" -ne 0 ]; then
  echo "Release integrity checks failed."
  exit 1
fi

echo "Release integrity checks passed."
