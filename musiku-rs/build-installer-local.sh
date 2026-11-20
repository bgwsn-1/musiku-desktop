#!/usr/bin/env bash
# Bangun installer Windows Musiku dari Linux, tanpa GitHub Actions.
#
# Prasyarat: wine, curl, unzip, dan `./build-exe.sh` sudah pernah dijalankan
# supaya exe Windows tersedia. NSIS 3.11 dan WebView2 bootstrapper diunduh
# sekali ke $HOME/.cache/musiku-windows-build lalu dipakai ulang.
#
# Hasil: musiku-rs/target/windows-installer/Musiku-<versi>-setup.exe
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXE="$HERE/target/x86_64-pc-windows-msvc/release/musiku-desktop.exe"
ICON="$HERE/crates/desktop/icons/icon.ico"
TEMPLATE="$HERE/installer/musiku.nsi.template"
CACHE="${MUSIKU_BUILD_CACHE:-$HOME/.cache/musiku-windows-build}"
NSIS_DIR="$CACHE/nsis-3.11"
WORK="$CACHE/installer-work"
NSIS_URL="https://sourceforge.net/projects/nsis/files/NSIS%203/3.11/nsis-3.11.zip/download"
WEBVIEW_URL="https://go.microsoft.com/fwlink/p/?LinkId=2124703"

if [ ! -s "$EXE" ]; then
  echo "[installer] exe belum ada. Jalankan ./build-exe.sh dulu." >&2
  exit 1
fi
for tool in wine curl unzip python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "[installer] butuh: $tool" >&2; exit 1; }
done

VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$HERE/crates/desktop/tauri.conf.json")"
OUT_DIR="$HERE/target/windows-installer"
OUT="$OUT_DIR/Musiku-${VERSION}-setup.exe"
mkdir -p "$WORK" "$OUT_DIR"

# NSIS dijalankan lewat Wine, jadi semua path harus berbentuk Z:\...
winpath() { printf 'Z:%s' "$(printf '%s' "$1" | sed 's|/|\\\\|g')"; }

if [ ! -x "$NSIS_DIR/Bin/makensis.exe" ]; then
  echo "[installer] mengunduh NSIS 3.11…"
  mkdir -p "$CACHE"
  curl -sSL --max-time 300 -o "$CACHE/nsis-3.11.zip" "$NSIS_URL"
  unzip -q -o "$CACHE/nsis-3.11.zip" -d "$CACHE"
fi

if [ ! -s "$WORK/MicrosoftEdgeWebview2Setup.exe" ]; then
  echo "[installer] mengunduh WebView2 bootstrapper…"
  curl -sSL --max-time 300 -o "$WORK/MicrosoftEdgeWebview2Setup.exe" "$WEBVIEW_URL"
fi

cp -f "$EXE" "$WORK/Musiku.exe"
cp -f "$ICON" "$WORK/icon.ico"

sed \
  -e "s|@EXE@|$(winpath "$WORK/Musiku.exe")|g" \
  -e "s|@ICON@|$(winpath "$WORK/icon.ico")|g" \
  -e "s|@WEBVIEW@|$(winpath "$WORK/MicrosoftEdgeWebview2Setup.exe")|g" \
  -e "s|@OUT@|$(winpath "$OUT")|g" \
  -e "s|@VERSION@|$VERSION|g" \
  "$TEMPLATE" > "$WORK/musiku.nsi"

echo "[installer] mengompilasi installer…"
(cd "$NSIS_DIR" && WINEDEBUG=-all wine makensis.exe /V2 "$(winpath "$WORK/musiku.nsi")")

file "$OUT"
echo "✓ selesai: $OUT"
