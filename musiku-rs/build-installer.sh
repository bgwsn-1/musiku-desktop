#!/usr/bin/env bash
# Bangun installer Musiku Desktop.
#
# Linux  : .deb + .AppImage  → bisa di sini juga
# Windows: .exe (NSIS/MSI)  → harus di Windows (atau CI, lihat bawah)
# macOS  : .dmg             → harus di macOS
#
# Pakai:
#   ./build-installer.sh            # auto: target OS sekarang
#   ./build-installer.sh deb        # hanya .deb
#   ./build-installer.sh appimage   # hanya .AppImage
#
# Windows/macOS: jalankan `npx @tauri-apps/cli build` di OS bersangkutan.
# Satu mesin tak bisa menghasilkan tiga OS sekaligus.

set -euo pipefail

cd "$(dirname "$0")"
DESKTOP="crates/desktop"
CLI=(npx -y @tauri-apps/cli@^2)

if ! command -v npx >/dev/null 2>&1; then
  echo "✗ butuh Node/npx, atau pasang tauri-cli: cargo install tauri-cli --version '^2'" >&2
  exit 1
fi

# --- pastikan aset UI ter-embed sudah segar ------------------------------
# Server menyematkan app.css/app.js/app fonts lewat include_bytes!, jadi
# setiap perubahan di ../src/ harus dibangun dulu sebelum bundling.
if [ -f ./build-ui.sh ]; then
  echo "▸ membangun ulang aset UI…"
  ./build-ui.sh
fi

TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
  case "$(uname -s)" in
    Linux)  TARGETS=(deb appimage) ;;
    Darwin) TARGETS=(dmg app) ;;
    *)      TARGETS=(nsis msi) ;;
  esac
fi

echo "▸ membundel: ${TARGETS[*]}"
for t in "${TARGETS[@]}"; do
  echo "── $t ────────────────────────────────────────────────"
  ( cd "$DESKTOP" && "${CLI[@]}" build --bundles "$t" )
done

echo
echo "✓ selesai. Hasil ada di:"
find target/release/bundle -maxdepth 2 -type d -mindepth 1 2>/dev/null | sort | sed 's/^/   /'
echo
find target/release/bundle -type f \( -name '*.deb' -o -name '*.AppImage' -o -name '*.exe' -o -name '*.msi' -o -name '*.dmg' \) \
  -printf '   %-60p %s\n' 2>/dev/null | awk '{ printf "%s  (%.1f MB)\n", $1, $2/1048576 }'
