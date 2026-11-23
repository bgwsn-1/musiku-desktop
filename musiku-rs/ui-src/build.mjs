// Build config untuk UI Musiku di dalam Rust server / Tauri.
//
// Tujuannya: memakai ULANG komponen React asli dari web app (src/components,
// src/lib) apa adanya — tanpa menulis ulang. Yang diganti hanyalah:
//   - `next/link`       → shims/next-link.jsx        (SPA link)
//   - `next/navigation` → shims/next-navigation.jsx  (router SPA)
//   - halaman server    → entry.jsx (fetch ke /api/*)
import { build, context } from "esbuild";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(__dirname, "../../src"); // /home/egobreak/musiku/src
const ROOT_MODULES = path.resolve(__dirname, "../../node_modules"); // satu salinan React
const OUT = path.resolve(__dirname, "../crates/server/ui/assets/app.js");

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: [path.join(__dirname, "entry.jsx")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  outfile: OUT,
  jsx: "automatic",
  jsxImportSource: "react",
  minify: !watch,
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"),
  },
  alias: {
    // Mode imersif, Cover Flow & ikon Apple Music hanya untuk desktop (Win/Linux).
    // Web/Android tetap memakai komponen asli di src/ lewat alias `@` di bawah.
    "@/components/ImmersiveLyrics": path.join(__dirname, "desktop/ImmersiveLyrics.jsx"),
    "@/components/CoverFlow": path.join(__dirname, "desktop/CoverFlow.jsx"),
    "@/components/Icons": path.join(__dirname, "icons/Icons.ios.jsx"),
    "@": WEB_SRC,
    "next/link": path.join(__dirname, "shims/next-link.jsx"),
    "next/navigation": path.join(__dirname, "shims/next-navigation.js"),
    "next/font/google": path.join(__dirname, "shims/next-font.js"),
  },
  // Satu salinan React untuk seluruh bundle. Tanpa ini, ui-src dan web src/
  // masing-masing me-resolve React sendiri → hook gagal (useRef null).
  plugins: [
    {
      name: "single-react",
      setup(b) {
        for (const mod of [
          "react",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-dom",
          "react-dom/client",
        ]) {
          b.onResolve({ filter: new RegExp(`^${mod.replace(/[/]/g, "\\/")}$`) }, () => ({
            path: require.resolve(mod, { paths: [ROOT_MODULES] }),
          }));
        }
      },
    },
  ],
  // React versi Node (CommonJS) → esbuild menanganinya.
  loader: { ".tsx": "tsx", ".ts": "ts", ".jsx": "jsx" },
  banner: {
    js: "/* Musiku UI bundle — dibangun dari komponen React web app. Jangan edit manual. */",
  },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("[ui] watching…");
} else {
  await build(options);
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`[ui] built ${OUT} (${kb} KB)`);
}
