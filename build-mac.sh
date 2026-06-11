#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$ROOT_DIR/out"
DIST_DIR="$ROOT_DIR/dist"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "build-mac.sh 只能在 macOS 主机上执行。"
  exit 1
fi

cd "$ROOT_DIR"

echo "========================================"
echo "Building macOS package..."
echo "========================================"

echo "[1/3] Clearing proxy environment variables for this process..."
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
unset npm_config_proxy npm_config_https_proxy NPM_CONFIG_PROXY NPM_CONFIG_HTTPS_PROXY
unset GLOBAL_AGENT_HTTP_PROXY GLOBAL_AGENT_HTTPS_PROXY
export NO_PROXY="*"
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

echo "[2/3] Cleaning old build output..."
rm -rf "$OUTPUT_DIR" "$DIST_DIR"

echo "[3/3] Running build..."
npm run build
npm run pack:mac:dmg

echo "dmg:"
find "$OUTPUT_DIR" -maxdepth 1 -name "*.dmg" -print
