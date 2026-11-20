#!/usr/bin/env bash
# Bangun aset UI Musiku (CSS + JS) dari komponen React web app.
#
# Hasilnya ditulis ke crates/server/ui/assets/{app.css,app.js} dan di-embed
# ke binary oleh crates/server (include_bytes!), jadi `.exe` mandiri.
#
# Pakai:
#   ./build-ui.sh          # sekali bangun (produksi, minify)
#   ./build-ui.sh --watch  # mode dev, rebuild saat komponen berubah
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/ui-src"

if [ ! -d node_modules ]; then
  echo "[ui] memasang dependensi build (sekali saja)…"
  npm install
fi

if [ "${1:-}" = "--watch" ]; then
  node build-css.mjs
  exec node build.mjs --watch
else
  node build-css.mjs
  node build.mjs
fi
