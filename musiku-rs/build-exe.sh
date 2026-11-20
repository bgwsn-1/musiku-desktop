#!/usr/bin/env bash
# Bangun `musiku-desktop.exe` (Windows) dari Linux lewat cargo-xwin.
#
# Kenapa butuh tool ekstra?
#   Tauri resminya tidak mendukung cross-compile Linux→Windows, jadi kita pakai
#   `cargo-xwin`, yang mengunduh Windows SDK + MSVC CRT dan memakai
#   clang-cl + lld-link sebagai linker. Kode Musiku sendiri siap cross:
#   reqwest memakai `rustls-tls` (tanpa OpenSSL).
#
# Prasyarat (Arch):  sudo pacman -S --needed clang nasm lld llvm
#   `nasm`  → assembly `ring` (crypto rustls)
#   `clang` → kode C `ring` & `rquickjs-sys` untuk target MSVC
#   `lld-link` → linker MSVC
#   `llvm-rc` → kompilasi resource .exe (ikon + versi) untuk target MSVC
#
# Catatan ikon: `crates/desktop/icons/icon.ico` harus berformat ICO **asli**
# (header reserved=0, type=1). `llvm-rc` menolak file PNG yang hanya di-rename
# jadi .ico — `rc.exe` MSVC memaafkan itu, `llvm-rc` tidak.
#
# Pakai:
#   ./build-exe.sh              # .exe mentah (tanpa installer NSIS)
#   ./build-exe.sh installer    # sekaligus bikin installer NSIS (butuh makensis)
#
# Hasil: target/x86_64-pc-windows-msvc/release/musiku-desktop.exe
#
# CATATAN: NSIS (.exe installer) TIDAK bisa dibangun di Linux lewat jalur ini —
# pakai GitHub Actions (.github/workflows/build-windows.yml) untuk itu.

set -euo pipefail
cd "$(dirname "$0")"

export CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
export RUSTUP_HOME="${RUSTUP_HOME:-$HOME/.rustup}"
export PATH="$CARGO_HOME/bin:$PATH"

if ! command -v cargo-xwin >/dev/null 2>&1; then
  echo "✗ cargo-xwin tidak ada. Pasang: cargo install cargo-xwin --locked" >&2
  exit 1
fi
for t in clang-cl nasm lld-link; do
  command -v "$t" >/dev/null 2>&1 || { echo "✗ '$t' tidak ada. Pasang paket clang/nasm/lld/llvm." >&2; exit 1; }
done

# Aset UI disematkan lewat include_bytes! → bangun dulu supaya tidak basi.
if [ -f ./build-ui.sh ]; then
  echo "▸ membangun ulang aset UI…"
  ./build-ui.sh
fi

# LTO + codegen-units=1 di pohon dependency Tauri rawan OOM di mesin kecil.
# Untuk build Windows kita matikan dulu (binary sedikit lebih besar, tetap kecil).
export CARGO_PROFILE_RELEASE_LTO=false
export CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16

echo "▸ menyiapkan Windows SDK/CRT (cache cargo-xwin)…"
cargo xwin cache xwin >/dev/null

echo "▸ cross-compile ke x86_64-pc-windows-msvc…"
cargo xwin build --release --target x86_64-pc-windows-msvc -p musiku-desktop

EXE="target/x86_64-pc-windows-msvc/release/musiku-desktop.exe"
echo
if [ -f "$EXE" ]; then
  echo "✓ selesai: $EXE ($(du -h "$EXE" | cut -f1))"
  file "$EXE" 2>/dev/null || true
else
  echo "✗ $EXE tidak ditemukan" >&2
  exit 1
fi

if [ "${1:-}" = "installer" ]; then
  echo
  echo "▸ mencoba bundel NSIS (ini jalur yang TIDAK didukung di Linux)…"
  # Tauri CLI perlu environment cross-compile cargo-xwin disuntik manual,
  # karena ia memanggil cargo sendiri.
  set +u
  eval "$(cargo xwin env --target x86_64-pc-windows-msvc)"
  set -u
  cd crates/desktop
  npx -y @tauri-apps/cli@^2 build \
    --target x86_64-pc-windows-msvc --bundles nsis || {
    echo
    echo "✗ bundel NSIS gagal di Linux — ini wajar, Tauri tak mendukungnya."
    echo "  Pakai GitHub Actions (.github/workflows/build-windows.yml) untuk installer."
    exit 0
  }
fi
