#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/workspace/android-tools/sdk}}"
if [[ ! -d "$ANDROID_SDK_ROOT/platforms/android-36" ]]; then
  echo "Install Android SDK platform 36 dan build-tools 36.0.0, lalu atur ANDROID_SDK_ROOT." >&2
  exit 1
fi
WEB_DIR="$HERE/../web"
ASSETS="$HERE/app/src/main/assets"
[[ -f "$WEB_DIR/index.html" ]] || { echo "Aset web/index.html tidak ditemukan." >&2; exit 1; }
mkdir -p "$ASSETS"
find "$ASSETS" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "$WEB_DIR"/. "$ASSETS"/
cd "$HERE"
env -u XYRO_KEYSTORE -u XYRO_KEYSTORE_PASSWORD -u XYRO_KEY_PASSWORD -u XYRO_KEY_ALIAS ./gradlew --no-daemon bundleRelease
printf '\nBundle persiapan UNSIGNED: %s\n' "$HERE/app/build/outputs/bundle/release/app-release.aab"
