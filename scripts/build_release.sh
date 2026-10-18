#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_BUILD=0
if [[ "${1:-}" == "--test-build" ]]; then TEST_BUILD=1; shift; fi
[[ $# -eq 0 ]] || { echo "Penggunaan: scripts/build_release.sh [--test-build]" >&2; exit 2; }
: "${XYRO_KEYSTORE:?Atur path keystore di luar source}"
: "${XYRO_KEYSTORE_PASSWORD:?Atur password keystore lewat environment}"
: "${XYRO_KEY_PASSWORD:?Atur password key lewat environment}"
[[ -f "$XYRO_KEYSTORE" ]] || { echo "Keystore tidak ditemukan." >&2; exit 1; }
if [[ "$TEST_BUILD" == 0 ]]; then
  API_BASE="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("apiBase",""))' "$ROOT/release.json")"
  python3 "$ROOT/deploy/release_preflight.py" --online "$API_BASE"
else
  echo "BUILD UJI SAJA: identitas, backend, layanan API dan kelayakan Play Store belum dinyatakan siap." >&2
fi
export XYRO_TEST_BUILD="$TEST_BUILD"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/workspace/android-tools/sdk}}"
[[ -d "$ANDROID_SDK_ROOT/platforms/android-36" ]] || { echo "Android SDK 36 belum tersedia." >&2; exit 1; }
mkdir -p "$ROOT/android/app/src/main/assets"
find "$ROOT/android/app/src/main/assets" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "$ROOT/web"/. "$ROOT/android/app/src/main/assets"/
cd "$ROOT/android"
./gradlew --no-daemon testDebugUnitTest lintRelease bundleRelease assembleRelease
python3 "$ROOT/scripts/normalize_aab.py" "$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
printf '\nSigned AAB: %s\nSigned APK: %s\n' "$ROOT/android/app/build/outputs/bundle/release/app-release.aab" "$ROOT/android/app/build/outputs/apk/release/app-release.apk"
