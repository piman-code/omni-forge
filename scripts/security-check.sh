#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAILED=0

SECURITY_TARGETS=(
  "src"
  "scripts"
  "docs"
  "README.md"
  "README_KO.md"
  "CHANGELOG.md"
  "SECURITY.md"
  "RELEASE.md"
  "COMMUNITY_SUBMISSION_CHECKLIST.md"
  "manifest.json"
  "package.json"
  "versions.json"
  "esbuild.config.mjs"
  "tsconfig.json"
  ".gitignore"
  "main.js"
)

echo "[1/6] Checking for possible hardcoded secrets..."
if rg -n \
  '(sk-[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_\-]{20,}|sk-ant-[A-Za-z0-9_\-]{20,}|AIza[A-Za-z0-9_\-]{30,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----)' \
  "${SECURITY_TARGETS[@]}"; then
  echo "Possible secret-like value detected."
  FAILED=1
fi

echo "[2/6] Checking for absolute personal paths..."
if rg -n \
  '(/Users/[A-Za-z0-9._-]+/|/home/[A-Za-z0-9._-]+/|[A-Za-z]:\\\\Users\\\\[A-Za-z0-9._-]+\\\\)' \
  "${SECURITY_TARGETS[@]}"; then
  echo "Possible personal absolute path detected."
  FAILED=1
fi

echo "[3/6] Checking for accidentally committed runtime files..."
if [ -f "data.json" ]; then
  echo "data.json is present. Remove it before release."
  FAILED=1
fi

if [ -f ".env" ] || [ -f ".env.local" ] || compgen -G ".env.*" > /dev/null; then
  echo "Environment file detected (.env*). Remove before release."
  FAILED=1
fi

if compgen -G "*.pem" > /dev/null || compgen -G "*.key" > /dev/null; then
  echo "Potential key material file detected (*.pem or *.key). Remove before release."
  FAILED=1
fi

echo "[4/6] Checking .gitignore hardening..."
if ! grep -Fxq ".env" ".gitignore"; then
  echo ".gitignore is missing '.env'."
  FAILED=1
fi

if ! grep -Fxq ".env.local" ".gitignore"; then
  echo ".gitignore is missing '.env.local'."
  FAILED=1
fi

if ! grep -Fxq "data.json" ".gitignore"; then
  echo ".gitignore is missing 'data.json'."
  FAILED=1
fi

echo "[5/6] Checking release artifact presence..."
RELEASE_FILES=(
  "main.js"
  "manifest.json"
  "versions.json"
  "README.md"
  "LICENSE"
  "CHANGELOG.md"
)

for file in "${RELEASE_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Missing release file: $file"
    FAILED=1
  fi
done

echo "[6/6] Checking for TODO security markers..."
if rg -n \
  '(TODO_SECURITY|FIXME_SECURITY)' \
  src; then
  echo "Security TODO markers detected."
  FAILED=1
fi

if [ "$FAILED" -ne 0 ]; then
  echo "Security checks failed."
  exit 1
fi

echo "Security checks passed."
