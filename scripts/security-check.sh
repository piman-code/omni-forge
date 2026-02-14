#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAILED=0

SOURCE_TARGETS=(
  "src"
  "manifest.json"
  "package.json"
  "versions.json"
  "esbuild.config.mjs"
  "tsconfig.json"
)

echo "[1/4] Checking for possible hardcoded secrets..."
if rg -n \
  '(sk-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_\-]{20,}|AIza[A-Za-z0-9_\-]{30,}|-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----)' \
  "${SOURCE_TARGETS[@]}"; then
  echo "Possible secret-like value detected."
  FAILED=1
fi

echo "[2/4] Checking for absolute personal paths..."
if rg -n \
  '(/Users/[^/\s]+/|[A-Za-z]:\\\\Users\\\\)' \
  "${SOURCE_TARGETS[@]}"; then
  echo "Possible personal absolute path detected."
  FAILED=1
fi

echo "[3/4] Checking for accidentally committed runtime files..."
if [ -f "data.json" ]; then
  echo "data.json is present. Remove it before release."
  FAILED=1
fi

if [ -f ".env" ] || [ -f ".env.local" ]; then
  echo "Environment file detected (.env or .env.local). Remove before release."
  FAILED=1
fi

echo "[4/4] Checking for TODO security markers..."
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
